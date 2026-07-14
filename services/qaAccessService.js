const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const QA_USERS_FILE = path.join(DATA_DIR, 'qa_users.json');
const QA_AUDIT_LOG_FILE = path.join(DATA_DIR, 'qa_audit_log.json');
const QA_FEATURES_FILE = path.join(DATA_DIR, 'qa_features.json');

const MAX_AUDIT_ENTRIES = 1000;

async function ensureFile(filePath, defaultData) {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
        await fs.access(filePath);
    } catch {
        await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2), 'utf8');
    }
}

async function readJson(filePath, defaultData) {
    await ensureFile(filePath, defaultData);
    try {
        const raw = await fs.readFile(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        return parsed;
    } catch {
        await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2), 'utf8');
        return defaultData;
    }
}

async function writeJson(filePath, data) {
    const tmp = `${filePath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(tmp, filePath);
}

function normalizeUserId(input) {
    const raw = String(input || '').trim();
    const id = raw.replace(/<@!?|>/g, '');
    return /^\d+$/.test(id) ? id : null;
}

function normalizeFeatureName(input) {
    return String(input || '').trim().toLowerCase();
}

function isOwner(userId, ownerId = process.env.OWNER_ID || '') {
    return String(userId || '') === String(ownerId || '');
}

async function getQAUsers() {
    const data = await readJson(QA_USERS_FILE, { users: [] });
    const users = Array.isArray(data.users) ? data.users : [];
    return users.filter((id) => /^\d+$/.test(String(id))).map(String);
}

async function isQA(userId) {
    const target = normalizeUserId(userId);
    if (!target) return false;
    const users = await getQAUsers();
    return users.includes(target);
}

async function addQAUser(userId) {
    const target = normalizeUserId(userId);
    if (!target) return { ok: false, reason: 'invalid_user_id' };

    const data = await readJson(QA_USERS_FILE, { users: [] });
    data.users = Array.isArray(data.users) ? data.users.map(String) : [];

    if (data.users.includes(target)) {
        return { ok: true, added: false, userId: target };
    }

    data.users.push(target);
    await writeJson(QA_USERS_FILE, data);
    return { ok: true, added: true, userId: target };
}

async function removeQAUser(userId) {
    const target = normalizeUserId(userId);
    if (!target) return { ok: false, reason: 'invalid_user_id' };

    const data = await readJson(QA_USERS_FILE, { users: [] });
    data.users = Array.isArray(data.users) ? data.users.map(String) : [];

    const before = data.users.length;
    data.users = data.users.filter((id) => id !== target);
    const removed = before !== data.users.length;

    await writeJson(QA_USERS_FILE, data);
    return { ok: true, removed, userId: target };
}

async function listQAUsers() {
    return getQAUsers();
}

async function logQACommandUsage({ userId, command, target, details }) {
    const log = await readJson(QA_AUDIT_LOG_FILE, []);
    const rows = Array.isArray(log) ? log : [];

    rows.push({
        userId: String(userId || ''),
        command: String(command || '').toLowerCase(),
        target: target || null,
        details: details || null,
        timestamp: new Date().toISOString()
    });

    while (rows.length > MAX_AUDIT_ENTRIES) rows.shift();
    await writeJson(QA_AUDIT_LOG_FILE, rows);
}

async function getQAAuditLog() {
    const log = await readJson(QA_AUDIT_LOG_FILE, []);
    return Array.isArray(log) ? log : [];
}

async function getFeatureFlags() {
    const data = await readJson(QA_FEATURES_FILE, { features: {} });
    const features = data && typeof data.features === 'object' && data.features !== null
        ? data.features
        : {};
    return features;
}

async function isFeatureEnabled(featureName) {
    const key = normalizeFeatureName(featureName);
    if (!key) return false;
    const features = await getFeatureFlags();
    return !!features[key];
}

async function toggleFeature(featureName) {
    const key = normalizeFeatureName(featureName);
    if (!key) return { ok: false, reason: 'invalid_feature_name' };

    const data = await readJson(QA_FEATURES_FILE, { features: {} });
    if (!data.features || typeof data.features !== 'object') data.features = {};

    const next = !data.features[key];
    data.features[key] = next;

    await writeJson(QA_FEATURES_FILE, data);
    return { ok: true, feature: key, enabled: next };
}

module.exports = {
    QA_USERS_FILE,
    QA_AUDIT_LOG_FILE,
    QA_FEATURES_FILE,
    isOwner,
    isQA,
    addQAUser,
    removeQAUser,
    listQAUsers,
    logQACommandUsage,
    getQAAuditLog,
    getFeatureFlags,
    isFeatureEnabled,
    toggleFeature,
    normalizeUserId
};
