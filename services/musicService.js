const play = require('play-dl');
const ytdl = require('@distube/ytdl-core');
const { Innertube } = require('youtubei.js');
const { spawn } = require('child_process');
const fs = require('fs');
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    NoSubscriberBehavior,
    AudioPlayerStatus,
    StreamType,
    VoiceConnectionStatus,
    entersState,
    getVoiceConnection
} = require('@discordjs/voice');

const guildMusicState = new Map();
const VOICE_READY_TIMEOUT_MS = 20_000;
const MAX_QUEUE_SIZE = 50;
let innertubeClientPromise = null;

function getInnertubeClient() {
    if (!innertubeClientPromise) {
        innertubeClientPromise = Innertube.create().catch((err) => {
            innertubeClientPromise = null;
            throw err;
        });
    }
    return innertubeClientPromise;
}

function mapVoiceError(err) {
    const msg = String(err?.message || err || '');
    if (/IP discovery|socket closed/i.test(msg)) return 'VOICE_NETWORK_BLOCKED';
    if (/aborted|abort/i.test(msg)) return 'VOICE_CONNECT_ABORTED';
    return 'VOICE_CONNECT_TIMEOUT';
}

function truncateTitle(title, max = 80) {
    if (!title) return 'Unknown title';
    return title.length > max ? `${title.slice(0, max - 1)}…` : title;
}

function resolveYtDlpExecutable() {
    if (process.env.YT_DLP_PATH) return process.env.YT_DLP_PATH;

    const userProfile = process.env.USERPROFILE || '';
    const wingetPath = `${userProfile}\\AppData\\Local\\Microsoft\\WinGet\\Packages\\yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe\\yt-dlp.exe`;
    if (wingetPath && fs.existsSync(wingetPath)) return wingetPath;

    return 'yt-dlp';
}

function resolveDenoExecutable() {
    if (process.env.DENO_PATH) return process.env.DENO_PATH;

    const userProfile = process.env.USERPROFILE || '';
    const wingetDenoPath = `${userProfile}\\AppData\\Local\\Microsoft\\WinGet\\Packages\\DenoLand.Deno_Microsoft.Winget.Source_8wekyb3d8bbwe\\deno.exe`;
    if (wingetDenoPath && fs.existsSync(wingetDenoPath)) return wingetDenoPath;

    return null;
}

function buildControlRows(guildId, isPaused = false) {
    const pauseLabel = isPaused ? 'Resume' : 'Pause';
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`music:pause:${guildId}`)
            .setLabel(`⏯ ${pauseLabel}`)
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`music:skip:${guildId}`)
            .setLabel('⏭ Skip')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`music:stop:${guildId}`)
            .setLabel('⏹ Stop')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`music:queue:${guildId}`)
            .setLabel('📜 Show Queue')
            .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`music:remove:${guildId}`)
            .setLabel('🗑 Remove')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`music:volume:${guildId}`)
            .setLabel('🔊 Set Volume')
            .setStyle(ButtonStyle.Secondary)
    );

    return [row1, row2];
}

function formatQueue(guildId) {
    const state = guildMusicState.get(guildId);
    if (!state || (!state.current && !state.queue.length)) {
        return '📭 Queue is empty.';
    }

    const lines = [];
    if (state.current) {
        lines.push(`🎶 **Now Playing**: [${truncateTitle(state.current.title)}](${state.current.url}) — ${state.current.requestedBy}`);
    }

    if (!state.queue.length) {
        lines.push('📭 No upcoming tracks.');
        return lines.join('\n');
    }

    lines.push('');
    lines.push('📜 **Up Next:**');

    const display = state.queue.slice(0, 20);
    display.forEach((track, index) => {
        lines.push(`${index + 1}. [${truncateTitle(track.title, 70)}](${track.url}) — ${track.requestedBy}`);
    });

    if (state.queue.length > display.length) {
        lines.push(`…and ${state.queue.length - display.length} more track(s).`);
    }

    return lines.join('\n');
}

async function resolveTextChannel(state) {
    if (!state?.textChannelId || !state?.client) return null;

    return state.client.channels.cache.get(state.textChannelId)
        || await state.client.channels.fetch(state.textChannelId).catch(() => null);
}

async function sendNowPlayingMessage(guildId, track) {
    const state = guildMusicState.get(guildId);
    if (!state) return;

    const channel = await resolveTextChannel(state);
    if (!channel || !channel.isTextBased()) return;

    if (state.nowPlayingMessageId) {
        await channel.messages.delete(state.nowPlayingMessageId).catch(() => {});
        state.nowPlayingMessageId = null;
    }

    const isPaused = state.player.state.status === AudioPlayerStatus.Paused;
    const sent = await channel.send({
        content: `🎶 Now playing: **${track.title}**\nRequested by: ${track.requestedBy}\nVolume: **${Math.round((state.volume || 1) * 100)}%**`,
        components: buildControlRows(guildId, isPaused)
    }).catch((err) => {
        console.error('[music] Failed to send now-playing message:', err?.message || err);
        return null;
    });

    if (sent?.id) state.nowPlayingMessageId = sent.id;
}

async function createYtDlpOpusResource(trackUrl) {
    async function spawnYtDlpResource(formatSelector, inputType, strategyLabel) {
        return new Promise((resolve, reject) => {
            const ytDlpExe = resolveYtDlpExecutable();
            const denoExe = resolveDenoExecutable();
            const args = [
                '--no-playlist',
                '--quiet',
                '--no-warnings',
                '-f',
                formatSelector,
                '-o',
                '-',
                trackUrl
            ];

            if (denoExe) {
                args.unshift(`deno:${denoExe}`);
                args.unshift('--js-runtimes');
            }

            const proc = spawn(ytDlpExe, args, { stdio: ['ignore', 'pipe', 'pipe'] });
            let settled = false;
            let stderr = '';

            const fail = (error) => {
                if (settled) return;
                settled = true;
                try { proc.kill(); } catch (_) {}
                reject(error);
            };

            const success = (resource) => {
                if (settled) return;
                settled = true;
                resolve(resource);
            };

            proc.on('error', (err) => {
                if (String(err?.message || '').includes('ENOENT')) return fail(new Error('YTDLP_NOT_FOUND'));
                fail(new Error('YTDLP_SPAWN_FAILED'));
            });

            proc.stderr.on('data', (chunk) => {
                stderr += chunk.toString();
            });

            try {
                // Do not consume stdout before resource creation, or container headers can be lost.
                const resource = createAudioResource(proc.stdout, {
                    inputType,
                    inlineVolume: true
                });
                success(resource);
            } catch (err) {
                const msg = String(err?.message || err || '');
                if (/ffmpeg|avconv/i.test(msg)) return fail(new Error('FFMPEG_MISSING'));
                if (/@discordjs\/opus|opusscript|node-opus/.test(msg)) return fail(new Error('OPUS_CODEC_MISSING'));
                console.warn(`[music] yt-dlp resource strategy failed (${strategyLabel}): ${msg || 'unknown error'}`);
                fail(new Error('YTDLP_RESOURCE_FAILED'));
            }

            proc.on('close', (code) => {
                if (!settled) {
                    console.error(`[music] yt-dlp exited early (${strategyLabel}) code=${code}; stderr=${stderr.trim() || 'n/a'}`);
                    fail(new Error('YTDLP_EXITED_EARLY'));
                }
            });
        });
    }

    // Strategy A: Keep zero-transcode Opus/WebM path (fastest and most reliable when available).
    try {
        return await spawnYtDlpResource(
            'bestaudio[acodec=opus][ext=webm]/bestaudio[acodec=opus]/bestaudio[ext=webm]',
            StreamType.WebmOpus,
            'webm-opus'
        );
    } catch (err) {
        if (err.message === 'YTDLP_NOT_FOUND' || err.message === 'YTDLP_SPAWN_FAILED' || err.message === 'FFMPEG_MISSING') {
            throw err;
        }
    }

    // Strategy B: Generic bestaudio stream for cases where Opus metadata/container path fails.
    return await spawnYtDlpResource(
        'bestaudio/best',
        StreamType.Arbitrary,
        'generic-bestaudio'
    );
}

async function createYtdlOpusResource(trackUrl) {
    try {
        const info = await ytdl.getInfo(trackUrl);
        const formats = info?.formats || [];
        const audioOnly = ytdl.filterFormats(formats, 'audioonly');
        const opusCandidates = audioOnly.filter((f) => {
            const codec = String(f.audioCodec || f.codecs || '').toLowerCase();
            const container = String(f.container || '').toLowerCase();
            const mime = String(f.mimeType || '').toLowerCase();
            return codec.includes('opus') && (container === 'webm' || mime.includes('webm'));
        });

        if (!opusCandidates.length) throw new Error('NO_PLAYABLE_FORMATS');

        const selected = opusCandidates.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];
        const stream = ytdl.downloadFromInfo(info, {
            format: selected,
            highWaterMark: 1 << 25,
            dlChunkSize: 0
        });

        stream.on('error', (err) => {
            console.error('[music] ytdl stream runtime error:', err?.message || err);
        });

        return createAudioResource(stream, {
            inputType: StreamType.WebmOpus,
            inlineVolume: true
        });
    } catch (err) {
        const msg = String(err?.message || err || '');
        if (/FFmpeg|avconv/i.test(msg)) throw new Error('FFMPEG_MISSING');
        if (err?.message === 'NO_PLAYABLE_FORMATS' || /playable formats/i.test(msg)) throw new Error('NO_PLAYABLE_FORMATS');
        throw new Error('YTDL_INFO_FAILED');
    }
}

async function createTrackResource(trackUrl) {
    try {
        const stream = await play.stream(trackUrl);
    return createAudioResource(stream.stream, { inputType: stream.type, inlineVolume: true });
    } catch (_) {
        try {
            const info = await play.video_info(trackUrl);
            const stream = await play.stream_from_info(info);
            return createAudioResource(stream.stream, { inputType: stream.type, inlineVolume: true });
        } catch (_) {
            if (!ytdl.validateURL(trackUrl)) throw new Error('TRACK_URL_MISSING');

            try {
                return await createYtdlOpusResource(trackUrl);
            } catch (ytdlErr) {
                if (ytdlErr.message === 'NO_PLAYABLE_FORMATS' || ytdlErr.message === 'YTDL_INFO_FAILED') {
                    return await createYtDlpOpusResource(trackUrl);
                }
                throw ytdlErr;
            }
        }
    }
}

async function searchYouTubeFirst(query) {
    const text = String(query || '').trim();
    if (!text) return null;

    // Direct YouTube URL input should bypass search providers.
    if (ytdl.validateURL(text)) {
        try {
            const info = await ytdl.getBasicInfo(text);
            return {
                title: info?.videoDetails?.title || 'Unknown title',
                url: text,
                requestedBy: null
            };
        } catch (_) {
            return {
                title: 'YouTube Track',
                url: text,
                requestedBy: null
            };
        }
    }

    // Primary provider: play-dl
    try {
        const results = await play.search(text, {
            limit: 1,
            source: { youtube: 'video' }
        });

        if (results?.length) {
            const first = results[0];
            return {
                title: first.title || 'Unknown title',
                url: first.url || (first.id ? `https://www.youtube.com/watch?v=${first.id}` : null),
                requestedBy: null
            };
        }
    } catch (err) {
        console.warn('[music] play-dl search failed, falling back to youtubei.js:', err?.message || err);
    }

    // Fallback provider: youtubei.js
    try {
        const yt = await getInnertubeClient();
        const results = await yt.search(text, { type: 'video' });
        const first = results?.videos?.[0] || results?.results?.[0] || null;
        if (!first) return null;

        const videoId = first.video_id || first.id || first?.endpoint?.payload?.videoId || null;
        const url = first.url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : null);

        return {
            title: first.title?.text || first.title || 'Unknown title',
            url,
            requestedBy: null
        };
    } catch (err) {
        console.error('[music] youtubei.js search fallback failed:', err?.message || err);
        throw new Error('SEARCH_FAILED');
    }
}

async function ensureConnection(voiceChannel) {
    const guildId = voiceChannel.guild.id;
    const me = voiceChannel.guild.members.me;

    if (!me) throw new Error('BOT_MEMBER_NOT_FOUND');

    const perms = voiceChannel.permissionsFor(me);
    if (!perms?.has('ViewChannel') || !perms?.has('Connect') || !perms?.has('Speak')) {
        throw new Error('MISSING_VOICE_PERMISSIONS');
    }

    if (typeof voiceChannel.joinable === 'boolean' && !voiceChannel.joinable) {
        throw new Error('VOICE_CHANNEL_NOT_JOINABLE');
    }

    if (typeof voiceChannel.full === 'boolean' && voiceChannel.full && !voiceChannel.members?.has(me.id)) {
        throw new Error('VOICE_CHANNEL_FULL');
    }

    let connection = getVoiceConnection(guildId);
    if (!connection || connection.joinConfig.channelId !== voiceChannel.id) {
        if (connection) {
            try { connection.destroy(); } catch (_) {}
        }

        connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            selfDeaf: true
        });
    }

    try {
        await entersState(connection, VoiceConnectionStatus.Ready, VOICE_READY_TIMEOUT_MS);
        return connection;
    } catch (err) {
        try { connection.destroy(); } catch (_) {}

        const retryConnection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            selfDeaf: true
        });

        try {
            await entersState(retryConnection, VoiceConnectionStatus.Ready, VOICE_READY_TIMEOUT_MS);
            return retryConnection;
        } catch (retryErr) {
            try { retryConnection.destroy(); } catch (_) {}
            throw new Error(mapVoiceError(retryErr));
        }
    }
}

function getOrCreateGuildState(guildId) {
    let state = guildMusicState.get(guildId);
    if (state) return state;

    const player = createAudioPlayer({
        behaviors: {
            noSubscriber: NoSubscriberBehavior.Pause
        }
    });

    state = {
        player,
        connection: null,
        current: null,
        queue: [],
        textChannelId: null,
        client: null,
        isAdvancing: false,
        volume: 1,
        nowPlayingMessageId: null
    };

    player.on('error', async (err) => {
        console.error(`[music] Player error in guild ${guildId}:`, err?.message || err);
        state.current = null;
        await playNext(guildId);
    });

    player.on(AudioPlayerStatus.Idle, async () => {
        const s = guildMusicState.get(guildId);
        if (!s) return;
        s.current = null;
        await playNext(guildId);
    });

    guildMusicState.set(guildId, state);
    return state;
}

function attachConnectionStateListener(guildId, connection) {
    if (!connection) return;

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        console.log(`[music] Voice connection disconnected in guild ${guildId}`);
        await destroyGuildState(guildId);
    });

    connection.on(VoiceConnectionStatus.Destroyed, async () => {
        console.log(`[music] Voice connection destroyed in guild ${guildId}`);
        await destroyGuildState(guildId);
    });
}

async function destroyGuildState(guildId) {
    const state = guildMusicState.get(guildId);
    if (!state) return;

    try {
        const channel = await resolveTextChannel(state);
        if (channel?.isTextBased() && state.nowPlayingMessageId) {
            await channel.messages.delete(state.nowPlayingMessageId).catch(() => {});
        }
    } catch (_) {}

    try { state.player.stop(true); } catch (_) {}
    try { state.connection?.destroy(); } catch (_) {}
    try { state.connection?.removeAllListeners(); } catch (_) {}
    
    state.queue = [];
    state.current = null;
    state.isAdvancing = false;
    
    guildMusicState.delete(guildId);
    console.log(`[music] Guild ${guildId} state cleaned up`);
}

async function playNext(guildId) {
    const state = guildMusicState.get(guildId);
    if (!state) return false;
    if (state.isAdvancing) return false;

    state.isAdvancing = true;
    try {
        while (state.queue.length > 0) {
            const nextTrack = state.queue.shift();
            state.current = nextTrack;

            try {
                const resource = await createTrackResource(nextTrack.url);
                if (!state.connection) throw new Error('VOICE_CONNECTION_MISSING');

                if (resource.volume) {
                    resource.volume.setVolume(state.volume || 1);
                }

                state.player.play(resource);
                state.connection.subscribe(state.player);
                await sendNowPlayingMessage(guildId, nextTrack);
                return true;
            } catch (err) {
                console.error('[music] Failed to play queued track:', err?.message || err);
                state.current = null;

                const channel = await resolveTextChannel(state);
                if (channel?.isTextBased()) {
                    await channel.send(`❌ Failed to play **${truncateTitle(nextTrack.title)}**. Skipping to next track.`).catch(() => {});
                }
            }
        }

        await destroyGuildState(guildId);
        return false;
    } finally {
        const latest = guildMusicState.get(guildId);
        if (latest) latest.isAdvancing = false;
    }
}

async function addToQueue({ message, query }) {
    if (!message.guild) throw new Error('GUILD_ONLY');

    const member = message.member;
    const voiceChannel = member?.voice?.channel;
    if (!voiceChannel) throw new Error('USER_NOT_IN_VOICE');

    const guildId = message.guild.id;
    const state = getOrCreateGuildState(guildId);
    state.client = message.client;
    state.textChannelId = message.channel.id;

    if (state.connection?.joinConfig?.channelId && state.connection.joinConfig.channelId !== voiceChannel.id) {
        throw new Error('BOT_IN_ANOTHER_VOICE_CHANNEL');
    }

    state.connection = await ensureConnection(voiceChannel);
    attachConnectionStateListener(guildId, state.connection);

    const track = await searchYouTubeFirst(query);
    if (!track) throw new Error('NO_RESULTS');
    if (!track.url) throw new Error('TRACK_URL_MISSING');

    if (state.queue.length >= MAX_QUEUE_SIZE) {
        throw new Error('QUEUE_LIMIT_REACHED');
    }

    const queuePositionBeforePush = state.queue.length + 1;
    const playerBusy = [
        AudioPlayerStatus.Playing,
        AudioPlayerStatus.Buffering,
        AudioPlayerStatus.Paused,
        AudioPlayerStatus.AutoPaused
    ].includes(state.player.state.status);

    const currentlyPlaying = !!state.current || playerBusy || state.isAdvancing;
    const queuedTrack = {
        title: track.title,
        url: track.url,
        requestedBy: `<@${message.author.id}>`
    };

    state.queue.push(queuedTrack);

    if (!currentlyPlaying) {
        await playNext(guildId);
        return { track: queuedTrack, queued: false, position: 0 };
    }

    return { track: queuedTrack, queued: true, position: queuePositionBeforePush };
}

async function stopPlayback(guildId) {
    const state = guildMusicState.get(guildId);
    if (!state) throw new Error('NOTHING_PLAYING');

    state.queue = [];
    state.current = null;
    await destroyGuildState(guildId);
    return true;
}

async function skipTrack(guildId) {
    const state = guildMusicState.get(guildId);
    if (!state || !state.current) throw new Error('NOTHING_PLAYING');

    state.player.stop(true);
    return true;
}

async function togglePause(guildId) {
    const state = guildMusicState.get(guildId);
    if (!state || !state.current) throw new Error('NOTHING_PLAYING');

    if (state.player.state.status === AudioPlayerStatus.Paused) {
        const resumed = state.player.unpause();
        if (!resumed) throw new Error('PAUSE_RESUME_FAILED');
        return { paused: false };
    }

    const paused = state.player.pause(true);
    if (!paused) throw new Error('PAUSE_RESUME_FAILED');
    return { paused: true };
}

async function setVolume(guildId, percent) {
    const state = guildMusicState.get(guildId);
    if (!state || !state.current) throw new Error('NOTHING_PLAYING');

    const parsed = Number(percent);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 200) {
        throw new Error('INVALID_VOLUME_RANGE');
    }

    const volume = parsed / 100;
    state.volume = volume;

    const currentResource = state.player.state?.resource;
    if (currentResource?.volume) {
        currentResource.volume.setVolume(volume);
    }

    return { percent: Math.round(parsed) };
}

function removeQueueItem(guildId, position) {
    const state = guildMusicState.get(guildId);
    if (!state) throw new Error('NOTHING_PLAYING');
    if (!state.queue.length) throw new Error('QUEUE_EMPTY');

    const index = Number(position) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= state.queue.length) {
        throw new Error('INVALID_QUEUE_POSITION');
    }

    const [removed] = state.queue.splice(index, 1);
    return { removed, position: index + 1 };
}

function createVolumeModal(guildId) {
    const modal = new ModalBuilder()
        .setCustomId(`musicModal:setVolume:${guildId}`)
        .setTitle('Set Music Volume');

    const input = new TextInputBuilder()
        .setCustomId('volumePercent')
        .setLabel('Volume Percentage (0-200)')
        .setPlaceholder('100')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(3);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
}

function createRemoveQueueModal(guildId) {
    const modal = new ModalBuilder()
        .setCustomId(`musicModal:removeQueue:${guildId}`)
        .setTitle('Remove Track From Queue');

    const input = new TextInputBuilder()
        .setCustomId('queuePosition')
        .setLabel('Queue Position (1 = next track)')
        .setPlaceholder('1')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(3);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
}

function assertSameVoiceChannel(interaction, state) {
    const userChannelId = interaction.member?.voice?.channelId;
    if (!userChannelId) throw new Error('USER_NOT_IN_VOICE');

    const botChannelId = state?.connection?.joinConfig?.channelId;
    if (!botChannelId) throw new Error('NOTHING_PLAYING');

    if (userChannelId !== botChannelId) throw new Error('NOT_SAME_VOICE_CHANNEL');
}

async function handleControlInteraction(interaction) {
    const [system, action, guildIdFromButton] = String(interaction.customId || '').split(':');
    if (system !== 'music') return false;

    const guildId = interaction.guildId;
    if (!guildId || (guildIdFromButton && guildIdFromButton !== guildId)) {
        await interaction.reply({ content: 'This control is not valid for this server.', ephemeral: true });
        return true;
    }

    const state = guildMusicState.get(guildId);

    try {
        if (!state) throw new Error('NOTHING_PLAYING');
        assertSameVoiceChannel(interaction, state);

        switch (action) {
            case 'pause': {
                const result = await togglePause(guildId);
                await interaction.reply({
                    content: result.paused ? '⏸ Playback paused.' : '▶️ Playback resumed.',
                    ephemeral: true
                });
                return true;
            }

            case 'skip': {
                await skipTrack(guildId);
                await interaction.reply({ content: '⏭ Skipped current track.', ephemeral: true });
                return true;
            }

            case 'stop': {
                await stopPlayback(guildId);
                await interaction.reply({ content: '⏹ Stopped playback, cleared queue, and left voice channel.', ephemeral: true });
                return true;
            }

            case 'queue': {
                await interaction.reply({ content: formatQueue(guildId), ephemeral: true });
                return true;
            }

            case 'volume': {
                await interaction.showModal(createVolumeModal(guildId));
                return true;
            }

            case 'remove': {
                if (!state.queue.length) {
                    await interaction.reply({ content: 'Queue is empty. Nothing to remove.', ephemeral: true });
                    return true;
                }
                await interaction.showModal(createRemoveQueueModal(guildId));
                return true;
            }

            default:
                await interaction.reply({ content: 'Unknown music control.', ephemeral: true });
                return true;
        }
    } catch (err) {
        if (err.message === 'NOTHING_PLAYING') {
            await interaction.reply({ content: 'There is no active playback right now.', ephemeral: true });
            return true;
        }
        if (err.message === 'USER_NOT_IN_VOICE') {
            await interaction.reply({ content: 'You must be in a voice channel to use music controls.', ephemeral: true });
            return true;
        }
        if (err.message === 'NOT_SAME_VOICE_CHANNEL') {
            await interaction.reply({ content: 'You must be in the same voice channel as the bot to use these buttons.', ephemeral: true });
            return true;
        }
        if (err.message === 'INVALID_VOLUME_RANGE') {
            await interaction.reply({ content: 'Volume must be between 0 and 200.', ephemeral: true });
            return true;
        }

        console.error('[music] Control interaction error:', err);
        await interaction.reply({ content: 'Music control failed. Please try again.', ephemeral: true });
        return true;
    }
}

async function handleModalInteraction(interaction) {
    const [system, action, guildIdFromModal] = String(interaction.customId || '').split(':');
    if (system !== 'musicModal') return false;

    const guildId = interaction.guildId;
    if (!guildId || (guildIdFromModal && guildIdFromModal !== guildId)) {
        await interaction.reply({ content: 'This music form is not valid for this server.', ephemeral: true });
        return true;
    }

    const state = guildMusicState.get(guildId);

    try {
        if (!state) throw new Error('NOTHING_PLAYING');
        assertSameVoiceChannel(interaction, state);

        if (action === 'setVolume') {
            const value = interaction.fields.getTextInputValue('volumePercent');
            const result = await setVolume(guildId, value);
            await interaction.reply({ content: `🔊 Volume set to **${result.percent}%**.`, ephemeral: true });

            if (state.current) {
                const channel = await resolveTextChannel(state);
                if (channel?.isTextBased()) {
                    await sendNowPlayingMessage(guildId, state.current);
                }
            }

            return true;
        }

        if (action === 'removeQueue') {
            const value = interaction.fields.getTextInputValue('queuePosition');
            const result = removeQueueItem(guildId, value);
            await interaction.reply({
                content: `🗑 Removed **#${result.position}** from queue: **${truncateTitle(result.removed.title)}**`,
                ephemeral: true
            });
            return true;
        }

        await interaction.reply({ content: 'Unknown music form action.', ephemeral: true });
        return true;
    } catch (err) {
        if (err.message === 'NOTHING_PLAYING') {
            await interaction.reply({ content: 'There is no active playback right now.', ephemeral: true });
            return true;
        }
        if (err.message === 'USER_NOT_IN_VOICE') {
            await interaction.reply({ content: 'You must be in a voice channel to use music controls.', ephemeral: true });
            return true;
        }
        if (err.message === 'NOT_SAME_VOICE_CHANNEL') {
            await interaction.reply({ content: 'You must be in the same voice channel as the bot to use these controls.', ephemeral: true });
            return true;
        }
        if (err.message === 'INVALID_VOLUME_RANGE') {
            await interaction.reply({ content: 'Volume must be a number between 0 and 200.', ephemeral: true });
            return true;
        }
        if (err.message === 'QUEUE_EMPTY') {
            await interaction.reply({ content: 'Queue is empty. Nothing to remove.', ephemeral: true });
            return true;
        }
        if (err.message === 'INVALID_QUEUE_POSITION') {
            await interaction.reply({ content: 'Invalid queue position. Use a number from the current queue list.', ephemeral: true });
            return true;
        }

        console.error('[music] Modal interaction error:', err);
        await interaction.reply({ content: 'Music action failed. Please try again.', ephemeral: true });
        return true;
    }
}

module.exports = {
    addToQueue,
    playNext,
    stopPlayback,
    skipTrack,
    searchYouTubeFirst,
    handleControlInteraction,
    handleModalInteraction,
    formatQueue,
    MAX_QUEUE_SIZE
};
