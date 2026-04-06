const { createAudioPlayer, NoSubscriberBehavior } = require('@discordjs/voice');

const guildMusicState = new Map();
const MAX_QUEUE_SIZE = 50;

function truncateTitle(title, max = 80) {
    if (!title) return 'Unknown title';
    return title.length > max ? `${title.slice(0, max - 1)}…` : title;
}

function getGuildState(guildId) {
    return guildMusicState.get(guildId) || null;
}

function setGuildState(guildId, state) {
    guildMusicState.set(guildId, state);
    return state;
}

function deleteGuildState(guildId) {
    guildMusicState.delete(guildId);
}

function createDefaultState() {
    const player = createAudioPlayer({
        behaviors: {
            noSubscriber: NoSubscriberBehavior.Pause
        }
    });

    return {
        player,
        connection: null,
        current: null,
        queue: [],
        textChannelId: null,
        client: null,
        isAdvancing: false,
        volume: 1,
        nowPlayingMessageId: null,
        listenersAttached: false,
        connectionListenerAttached: false
    };
}

function getOrCreateGuildState(guildId) {
    const existing = getGuildState(guildId);
    if (existing) return existing;

    const created = createDefaultState();
    setGuildState(guildId, created);
    return created;
}

function formatQueue(guildId) {
    const state = getGuildState(guildId);
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

module.exports = {
    MAX_QUEUE_SIZE,
    truncateTitle,
    getGuildState,
    getOrCreateGuildState,
    setGuildState,
    deleteGuildState,
    formatQueue
};
