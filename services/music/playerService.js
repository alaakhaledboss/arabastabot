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
    createAudioResource,
    AudioPlayerStatus,
    StreamType,
    VoiceConnectionStatus,
    entersState,
    getVoiceConnection
} = require('@discordjs/voice');
const queueManager = require('./queueManager');
const streamHandler = require('./streamHandler');

const VOICE_READY_TIMEOUT_MS = 20_000;

function mapVoiceError(err) {
    const msg = String(err?.message || err || '');
    if (/IP discovery|socket closed/i.test(msg)) return 'VOICE_NETWORK_BLOCKED';
    if (/aborted|abort/i.test(msg)) return 'VOICE_CONNECT_ABORTED';
    return 'VOICE_CONNECT_TIMEOUT';
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

async function resolveTextChannel(state) {
    if (!state?.textChannelId || !state?.client) return null;

    return state.client.channels.cache.get(state.textChannelId)
        || await state.client.channels.fetch(state.textChannelId).catch(() => null);
}

async function sendNowPlayingMessage(guildId, track) {
    const state = queueManager.getGuildState(guildId);
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

function ensurePlayerListeners(guildId, state) {
    if (state.listenersAttached) return;

    state.player.on('error', async (err) => {
        console.error(`[music] Player error in guild ${guildId}:`, err?.message || err);
        state.current = null;
        await playNext(guildId);
    });

    state.player.on(AudioPlayerStatus.Idle, async () => {
        const s = queueManager.getGuildState(guildId);
        if (!s) return;
        s.current = null;
        await playNext(guildId);
    });

    state.listenersAttached = true;
}

function attachConnectionStateListener(guildId, state, connection) {
    if (!connection || state.connectionListenerAttached) return;

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        console.log(`[music] Voice connection disconnected in guild ${guildId}`);
        await destroyGuildState(guildId);
    });

    connection.on(VoiceConnectionStatus.Destroyed, async () => {
        console.log(`[music] Voice connection destroyed in guild ${guildId}`);
        await destroyGuildState(guildId);
    });

    state.connectionListenerAttached = true;
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

async function destroyGuildState(guildId) {
    const state = queueManager.getGuildState(guildId);
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

    queueManager.deleteGuildState(guildId);
    console.log(`[music] Guild ${guildId} state cleaned up`);
}

async function playNext(guildId) {
    const state = queueManager.getGuildState(guildId);
    if (!state) return false;
    if (state.isAdvancing) return false;

    state.isAdvancing = true;
    try {
        while (state.queue.length > 0) {
            const nextTrack = state.queue.shift();
            state.current = nextTrack;

            try {
                const resource = await streamHandler.createTrackResource(nextTrack.url);
                if (!state.connection) throw new Error('VOICE_CONNECTION_MISSING');

                if (resource.volume) {
                    resource.volume.setVolume(state.volume || 1);
                }

                state.player.play(resource);
                state.connection.subscribe(state.player);

                await sendNowPlayingMessage(guildId, nextTrack);

                void streamHandler.enrichTrackMetadata(nextTrack)
                    .then(async (updated) => {
                        if (updated?.title && state.current?.url === updated.url) {
                            await sendNowPlayingMessage(guildId, updated);
                        }
                    })
                    .catch(() => {});

                return true;
            } catch (err) {
                console.error('[music] Failed to play queued track:', err?.message || err);
                state.current = null;

                const channel = await resolveTextChannel(state);
                if (channel?.isTextBased()) {
                    await channel.send(`❌ Failed to play **${queueManager.truncateTitle(nextTrack.title)}**. Skipping to next track.`).catch(() => {});
                }
            }
        }

        await destroyGuildState(guildId);
        return false;
    } finally {
        const latest = queueManager.getGuildState(guildId);
        if (latest) latest.isAdvancing = false;
    }
}

async function addToQueue({ message, query }) {
    if (!message.guild) throw new Error('GUILD_ONLY');

    const member = message.member;
    const voiceChannel = member?.voice?.channel;
    if (!voiceChannel) throw new Error('USER_NOT_IN_VOICE');

    const guildId = message.guild.id;
    const state = queueManager.getOrCreateGuildState(guildId);
    ensurePlayerListeners(guildId, state);

    state.client = message.client;
    state.textChannelId = message.channel.id;

    if (state.connection?.joinConfig?.channelId && state.connection.joinConfig.channelId !== voiceChannel.id) {
        throw new Error('BOT_IN_ANOTHER_VOICE_CHANNEL');
    }

    const [connection, track] = await Promise.all([
        ensureConnection(voiceChannel),
        streamHandler.searchYouTubeFirst(query)
    ]);

    if (!track) throw new Error('NO_RESULTS');
    if (!track.url) throw new Error('TRACK_URL_MISSING');

    state.connection = connection;
    attachConnectionStateListener(guildId, state, state.connection);

    if (state.queue.length >= queueManager.MAX_QUEUE_SIZE) {
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
    const state = queueManager.getGuildState(guildId);
    if (!state) throw new Error('NOTHING_PLAYING');

    state.queue = [];
    state.current = null;
    await destroyGuildState(guildId);
    return true;
}

async function skipTrack(guildId) {
    const state = queueManager.getGuildState(guildId);
    if (!state || !state.current) throw new Error('NOTHING_PLAYING');

    state.player.stop(true);
    return true;
}

async function togglePause(guildId) {
    const state = queueManager.getGuildState(guildId);
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
    const state = queueManager.getGuildState(guildId);
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
    const state = queueManager.getGuildState(guildId);
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

    const state = queueManager.getGuildState(guildId);

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
                await interaction.reply({ content: queueManager.formatQueue(guildId), ephemeral: true });
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

    const state = queueManager.getGuildState(guildId);

    try {
        if (!state) throw new Error('NOTHING_PLAYING');
        assertSameVoiceChannel(interaction, state);

        if (action === 'setVolume') {
            const value = interaction.fields.getTextInputValue('volumePercent');
            const result = await setVolume(guildId, value);
            await interaction.reply({ content: `🔊 Volume set to **${result.percent}%**.`, ephemeral: true });

            if (state.current) {
                await sendNowPlayingMessage(guildId, state.current);
            }

            return true;
        }

        if (action === 'removeQueue') {
            const value = interaction.fields.getTextInputValue('queuePosition');
            const result = removeQueueItem(guildId, value);
            await interaction.reply({
                content: `🗑 Removed **#${result.position}** from queue: **${queueManager.truncateTitle(result.removed.title)}**`,
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
    searchYouTubeFirst: streamHandler.searchYouTubeFirst,
    handleControlInteraction,
    handleModalInteraction,
    formatQueue: queueManager.formatQueue,
    MAX_QUEUE_SIZE: queueManager.MAX_QUEUE_SIZE
};
