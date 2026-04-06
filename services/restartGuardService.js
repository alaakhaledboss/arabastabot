const fs = require('fs');
const path = require('path');

const STATE_FILE_PATH = path.join(__dirname, '..', 'data', 'runtime_state.json');

function readState() {
    try {
        if (!fs.existsSync(STATE_FILE_PATH)) return {};
        const raw = fs.readFileSync(STATE_FILE_PATH, 'utf8');
        if (!raw.trim()) return {};
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

function writeState(state) {
    try {
        fs.mkdirSync(path.dirname(STATE_FILE_PATH), { recursive: true });
        fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2), 'utf8');
    } catch (err) {
        console.error('[restart-guard] failed to write runtime state:', err?.message || err);
    }
}

function serializeError(err) {
    if (!err) return null;
    return {
        name: err.name || 'Error',
        message: err.message || String(err),
        stack: String(err.stack || '').slice(0, 4000)
    };
}

function markPendingCrash(type, err) {
    const state = readState();
    state.pendingCrash = {
        type: String(type || 'fatal_error'),
        timestamp: new Date().toISOString(),
        error: serializeError(err)
    };
    writeState(state);
}

function consumePendingCrash() {
    const state = readState();
    const pending = state.pendingCrash || null;
    if (!pending) return null;

    delete state.pendingCrash;
    writeState(state);
    return pending;
}

module.exports = {
    STATE_FILE_PATH,
    markPendingCrash,
    consumePendingCrash
};
