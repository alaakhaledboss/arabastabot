const fs = require('fs').promises;
const path = require('path');

const dataFolder = path.join(__dirname, 'data');
const filePath = path.join(dataFolder, 'users.json');
const bankFilePath = path.join(dataFolder, 'bank.json');
const productsFilePath = path.join(dataFolder, 'products.json');

/* ── helpers ── */

async function ensureFile(file, defaultData) {
    await fs.mkdir(dataFolder, { recursive: true });
    try {
        await fs.access(file);
    } catch {
        await fs.writeFile(file, JSON.stringify(defaultData, null, 2), 'utf8');
    }
}

async function safeRead(file, defaultData) {
    const raw = await fs.readFile(file, 'utf8');
    try {
        return JSON.parse(raw);
    } catch (err) {
        console.error(`Corrupted file ${file}, recreating:`, err);
        await fs.writeFile(file, JSON.stringify(defaultData, null, 2), 'utf8');
        return defaultData;
    }
}

async function atomicWrite(file, data) {
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(tmp, file);
}

/* ── init ── */

async function initDB() {
    await ensureFile(filePath, { users: [] });
    await ensureFile(bankFilePath, { balance: 1000000 });
    await ensureFile(productsFilePath, []);

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
        user = {
            user_id: userId,
            gold: 0,
            xp: 0,
            level: 1,
            gems: 0,
            honor: 0,
            last_reward_time: 0,
            daily_gold_earned: 0,
            last_daily_reset: 0,
            bank_access: false
        };
        db.users.push(user);
        await atomicWrite(filePath, db);
    }

    // ensure bank_access field exists on older records
    if (user.bank_access === undefined) user.bank_access = false;

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
    return new Set(
        db.users
            .filter(u => u.bank_access === true)
            .map(u => u.user_id)
    );
}

async function setBankAccess(userId, value) {
    const user = await getUser(userId);
    user.bank_access = value;
    await saveUser(user);
}

/* ── leaderboard ── */

async function getLeaderboard(field, limit = 10) {
    await ensureFile(filePath, { users: [] });
    const db = await safeRead(filePath, { users: [] });
    db.users ||= [];
    if (db.users.length === 0) return [];

    const withTotal = db.users
        .filter(u => u.user_id) // skip orphan records
        .map(u => {
            let total = u[field] ?? 0;
            if (field === 'xp') {
                total += 100 * (u.level * (u.level - 1) / 2);
            }
            return { ...u, totalField: total };
        });

    return withTotal
        .sort((a, b) => b.totalField - a.totalField)
        .slice(0, limit);
}

/* ── bank ── */

async function getBank() {
    await ensureFile(bankFilePath, { balance: 1000000 });
    return safeRead(bankFilePath, { balance: 1000000 });
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

module.exports = {
    initDB,
    getUser,
    saveUser,
    getAuthorizedUsers,
    setBankAccess,
    getLeaderboard,
    getBank,
    saveBank,
    getProducts,
    saveProducts
};