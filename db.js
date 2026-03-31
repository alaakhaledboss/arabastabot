const fs = require('fs').promises;
const path = require('path');

const dataFolder      = path.join(__dirname, 'data');
const filePath        = path.join(dataFolder, 'users.json');
const bankFilePath    = path.join(dataFolder, 'bank.json');
const productsFilePath = path.join(dataFolder, 'products.json');
const bankLogPath     = path.join(dataFolder, 'bank_log.json');
const convLogPath     = path.join(dataFolder, 'conversion_log.json');

/* ── helpers ── */

async function ensureFile(file, defaultData) {
    await fs.mkdir(dataFolder, { recursive: true });
    try { await fs.access(file); }
    catch { await fs.writeFile(file, JSON.stringify(defaultData, null, 2), 'utf8'); }
}

async function safeRead(file, defaultData) {
    try {
        const raw = await fs.readFile(file, 'utf8');
        return JSON.parse(raw);
    } catch (err) {
        console.error(`Corrupted/missing file ${file}, recreating:`, err.message);
        await fs.writeFile(file, JSON.stringify(defaultData, null, 2), 'utf8');
        return defaultData;
    }
}

async function atomicWrite(file, data) {
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(tmp, file);
}

/* ── defaults ── */

const DEFAULT_BANK = { balance: 10000000, gems: 10000, honor: 1000 };

const DEFAULT_USER = {
    gold: 0,
    xp: 0,
    level: 1,
    gems: 0,
    honor: 0,
    monthly_gold_to_gems: 0,
    monthly_gems_to_honor: 0,
    conversion_month: '',
    last_reward_time: 0,
    daily_gold_earned: 0,
    last_daily_reset: 0,
    bank_access: false
};

/* ── init ── */

async function initDB() {
    await ensureFile(filePath, { users: [] });
    await ensureFile(bankFilePath, DEFAULT_BANK);
    await ensureFile(productsFilePath, []);
    await ensureFile(bankLogPath, []);
    await ensureFile(convLogPath, []);

    const bank = await safeRead(bankFilePath, DEFAULT_BANK);
    let bankChanged = false;
    if (bank.gems    === undefined) { bank.gems    = 10000; bankChanged = true; }
    if (bank.honor   === undefined) { bank.honor   = 1000; bankChanged = true; }
    if (bankChanged) await atomicWrite(bankFilePath, bank);

    const db = await safeRead(filePath, { users: [] });
    db.users ||= [];
    await atomicWrite(filePath, db);
}

/* ── users ── */

async function getUser(userId) {
    await ensureFile(filePath, { users: [] });
    const db = await safeRead(filePath, { users: [] });
    db.users ||= [];

    let user = db.users.find(u => u.user_id === userId);
    if (!user) {
        user = { user_id: userId, ...DEFAULT_USER };
        db.users.push(user);
        await atomicWrite(filePath, db);
    }

    // Migrate older records
    if (user.bank_access             === undefined) user.bank_access             = false;
    if (user.gems                    === undefined) user.gems                    = 0;
    if (user.honor                   === undefined) user.honor                   = 0;
    if (user.gold                    === undefined) user.gold                    = 0;
    if (user.xp                      === undefined) user.xp                      = 0;
    if (user.level                   === undefined) user.level                   = 1;
    if (user.monthly_gold_to_gems    === undefined) user.monthly_gold_to_gems    = 0;
    if (user.monthly_gems_to_honor   === undefined) user.monthly_gems_to_honor   = 0;
    if (user.conversion_month        === undefined) user.conversion_month        = '';
    // Remove credit field if it exists (migration)
    if (user.credit !== undefined) delete user.credit;

    return user;
}

async function saveUser(user) {
    await ensureFile(filePath, { users: [] });
    const db = await safeRead(filePath, { users: [] });
    db.users ||= [];
    const idx = db.users.findIndex(u => u.user_id === user.user_id);
    if (idx !== -1) db.users[idx] = user;
    else db.users.push(user);
    await atomicWrite(filePath, db);
}

async function getAuthorizedUsers() {
    await ensureFile(filePath, { users: [] });
    const db = await safeRead(filePath, { users: [] });
    db.users ||= [];
    return new Set(db.users.filter(u => u.bank_access === true).map(u => u.user_id));
}

async function setBankAccess(userId, value) {
    const user = await getUser(userId);
    user.bank_access = value;
    await saveUser(user);
}

async function resetAllUsers() {
    await ensureFile(filePath, { users: [] });
    const db = await safeRead(filePath, { users: [] });
    db.users ||= [];
    db.users = db.users.map(u => ({
        user_id: u.user_id,
        ...DEFAULT_USER,
        bank_access: u.bank_access ?? false
    }));
    await atomicWrite(filePath, db);
}

/* ── leaderboard ── */

async function getLeaderboard(field, limit = 10) {
    await ensureFile(filePath, { users: [] });
    const db = await safeRead(filePath, { users: [] });
    db.users ||= [];
    if (!db.users.length) return [];

    const withTotal = db.users.filter(u => u.user_id).map(u => {
        let total = u[field] ?? 0;
        if (field === 'xp') total += 100 * (u.level * (u.level - 1) / 2);
        return { ...u, totalField: total };
    });

    return withTotal.sort((a, b) => b.totalField - a.totalField).slice(0, limit);
}

/* ── bank ── */

async function getBank() {
    await ensureFile(bankFilePath, DEFAULT_BANK);
    const bank = await safeRead(bankFilePath, DEFAULT_BANK);
    if (bank.gems  === undefined) bank.gems  = 0;
    if (bank.honor === undefined) bank.honor = 0;
    return bank;
}

async function saveBank(bank) {
    await atomicWrite(bankFilePath, bank);
}

/* ── products ── */

async function getProducts() {
    await ensureFile(productsFilePath, []);
    return safeRead(productsFilePath, []);
}

async function saveProducts(products) {
    await atomicWrite(productsFilePath, products);
}

/* ── bank log ── */

async function logBankAction({ userId, action, amount, extra }) {
    await ensureFile(bankLogPath, []);
    const log = await safeRead(bankLogPath, []);
    log.push({
        userId,
        action,
        amount: amount ?? 0,
        extra: extra || null,
        timestamp: new Date().toISOString()
    });
    await atomicWrite(bankLogPath, log);
}

async function getBankLog() {
    await ensureFile(bankLogPath, []);
    return safeRead(bankLogPath, []);
}

/* ── conversion log ── */

async function logConversion({ userId, fromType, fromAmount, toType, toAmount }) {
    await ensureFile(convLogPath, []);
    const log = await safeRead(convLogPath, []);
    log.push({ userId, fromType, fromAmount, toType, toAmount, timestamp: new Date().toISOString() });
    await atomicWrite(convLogPath, log);
}

async function getConversionLog() {
    await ensureFile(convLogPath, []);
    return safeRead(convLogPath, []);
}

module.exports = {
    initDB,
    getUser, saveUser,
    getAuthorizedUsers, setBankAccess, resetAllUsers,
    getLeaderboard,
    getBank, saveBank,
    getProducts, saveProducts,
    logBankAction, getBankLog,
    logConversion, getConversionLog
};
