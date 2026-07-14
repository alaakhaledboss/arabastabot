// In-memory disabled commands registry.
// Resets automatically on process restart.

const disabledCommands = new Set();
let disableAllCommands = false;

function normalize(name) {
    return String(name || '').trim().toLowerCase();
}

function disableCommand(name) {
    const key = normalize(name);
    if (!key) return false;
    disabledCommands.add(key);
    return true;
}

function enableCommand(name) {
    const key = normalize(name);
    if (!key) return false;
    return disabledCommands.delete(key);
}

function isCommandDisabled(name) {
    return disabledCommands.has(normalize(name));
}

function disableAllCommandsGlobally() {
    disableAllCommands = true;
}

function enableAllCommandsGlobally() {
    disableAllCommands = false;
}

function isAllCommandsDisabled() {
    return disableAllCommands;
}

function clearDisabledCommands() {
    disabledCommands.clear();
    disableAllCommands = false;
}

function getDisabledCommands() {
    return Array.from(disabledCommands.values()).sort();
}

module.exports = {
    disableCommand,
    enableCommand,
    isCommandDisabled,
    disableAllCommandsGlobally,
    enableAllCommandsGlobally,
    isAllCommandsDisabled,
    clearDisabledCommands,
    getDisabledCommands
};
