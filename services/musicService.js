const play = require('play-dl');
const ytdl = require('@distube/ytdl-core');
const { spawn } = require('child_process');
const fs = require('fs');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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

function buildControlRow(guildId, isPaused = false) {
    const pauseLabel = isPaused ? 'Resume' : 'Pause';
    return new ActionRowBuilder().addComponents(
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

    const isPaused = state.player.state.status === AudioPlayerStatus.Paused;
    await channel.send({
        content: `🎶 Now playing: **${track.title}**\nRequested by: ${track.requestedBy}`,
        components: [buildControlRow(guildId, isPaused)]
    }).catch((err) => {
        console.error('[music] Failed to send now-playing message:', err?.message || err);
    });
}

async function createYtDlpOpusResource(trackUrl) {
    return new Promise((resolve, reject) => {
        const ytDlpExe = resolveYtDlpExecutable();
        const denoExe = resolveDenoExecutable();
        const args = [
            '--no-playlist',
            '--quiet',
            '--no-warnings',
            '-f',
            'bestaudio[acodec=opus][ext=webm]/bestaudio[acodec=opus]/bestaudio[ext=webm]',
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
            // Do not consume stdout before resource creation, or EBML header can be lost.
            const resource = createAudioResource(proc.stdout, { inputType: StreamType.WebmOpus });
            success(resource);
        } catch (_) {
            fail(new Error('YTDLP_RESOURCE_FAILED'));
        }

        proc.on('close', (code) => {
            if (!settled) {
                console.error(`[music] yt-dlp exited early code=${code}; stderr=${stderr.trim() || 'n/a'}`);
                fail(new Error('YTDLP_EXITED_EARLY'));
            }
        });
    });
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

        return createAudioResource(stream, { inputType: StreamType.WebmOpus });
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
        return createAudioResource(stream.stream, { inputType: stream.type });
    } catch (_) {
        try {
            const info = await play.video_info(trackUrl);
            const stream = await play.stream_from_info(info);
            return createAudioResource(stream.stream, { inputType: stream.type });
        } catch (_) {
            if (!ytdl.validateURL(trackUrl)) throw new Error('TRACK_URL_MISSING');

            try {
                return await createYtdlOpusResource(trackUrl);
            } catch (ytdlErr) {
                if (ytdlErr.message === 'NO_PLAYABLE_FORMATS') {
                    return await createYtDlpOpusResource(trackUrl);
                }
                throw ytdlErr;
            }
        }
    }
}

async function searchYouTubeFirst(query) {
    const results = await play.search(query, {
        limit: 1,
        source: { youtube: 'video' }
    });

    if (!results || !results.length) return null;

    const first = results[0];
    return {
        title: first.title || 'Unknown title',
        url: first.url || (first.id ? `https://www.youtube.com/watch?v=${first.id}` : null),
        requestedBy: null
    };
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
        isAdvancing: false
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

async function destroyGuildState(guildId) {
    const state = guildMusicState.get(guildId);
    if (!state) return;

    try { state.player.stop(true); } catch (_) {}
    try { state.connection?.destroy(); } catch (_) {}
    guildMusicState.delete(guildId);
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

        console.error('[music] Control interaction error:', err);
        await interaction.reply({ content: 'Music control failed. Please try again.', ephemeral: true });
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
    formatQueue,
    MAX_QUEUE_SIZE
};
