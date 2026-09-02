const fs = require('fs').promises;
const path = require('path');

const dataFolder      = path.join(__dirname, 'data');
const filePath        = path.join(dataFolder, 'users.json');
const bankFilePath    = path.join(dataFolder, 'bank.json');
const productsFilePath = path.join(dataFolder, 'products.json');
const bankLogPath     = path.join(dataFolder, 'bank_log.json');
const convLogPath     = path.join(dataFolder, 'conversion_log.json');
const transactionLogPath = path.join(dataFolder, 'transaction_log.json');
const commandLogPath     = path.join(dataFolder, 'command_log.json');

/* ── helpers ── */

let memoryDb = null;
let pendingSave = null;

async function flushDB() {
    if (memoryDb) await atomicWrite(filePath, memoryDb);
    pendingSave = false;
}

function queueSave() {
    if (!pendingSave) {
        pendingSave = true;
        setTimeout(flushDB, 3000); // Batch saves every 3s
    }
}

async function loadDB() {
    if (memoryDb) return memoryDb;
    await ensureFile(filePath, { users: [] });
    memoryDb = await safeRead(filePath, { users: [] });
    memoryDb.users ||= [];
    return memoryDb;
}

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

function createDefaultGearInventory() {
    return {
        helmet: [],
        chest: [],
        pants: [],
        shoes: [],
        weapon: [],
        shield: []
    };
}

function createDefaultEquippedGear() {
    return {
        helmet: null,
        chest: null,
        pants: null,
        shoes: null,
        weapon: null,
        shield: null
    };
}

function createDefaultInventory() {
    return {
        materials: {},
        items: [],
        gear: createDefaultGearInventory()
    };
}

function createDefaultClanState() {
    return {
        id: null,
        role: null,
        joinedAt: 0,
        contribution: 0
    };
}

function createDefaultUser(userId = null) {
    return {
        user_id: userId,
        gold: 0,
        xp: 0,
        level: 1,
        gems: 0,
        honor: 0,
        hp: 100,
        path: null,
        specialization: null,
        inventory: createDefaultInventory(),
        equippedGear: createDefaultEquippedGear(),
        clanId: null,
        monthly_gold_to_gems: 0,
        monthly_gems_to_honor: 0,
        conversion_month: '',
        last_reward_time: 0,
        lastActiveAt: 0,
        daily_gold_earned: 0,
        last_daily_reset: 0,
        bank_access: false,

        // Daily tasks (active now)
        task_daily_date: '',
        task_daily_messages: 0,
        task_daily_message_bonus_claimed: false,
        task_daily_voice_seconds: 0,
        task_daily_voice_bonus_claimed: false,

        // Role-driven progression system
        currentRoute: null,
        currentSpecialty: null,
        specialties: {
            combat: null,
            scholar: null,
            atelier: null,
            merchant: null
        },
        completedRoutes: [],
        prestigeRoles: [],
        prestigeCount: 0,
        rebirthCount: 0,
        rebirthPendingRoute: '',
        pendingFinalRestoreRoute: '',

        gearInventory: createDefaultGearInventory(),
        gearEquipment: createDefaultEquippedGear(),
        materials: {},
        hunting: {
            lastHuntAt: 0,
            cooldownUntil: 0,
            history: []
        },
        clan: createDefaultClanState(),
        monthly_gif_buys: 0,
        gif_expires: 0,
        gif_month: '',

        // Moderation
        warnings: 0,
        blacklist: {
            active: false,
            expiresAt: 0
        },

        // Future slots (not active yet)
        task_weekly: { slots: {} },
        task_monthly: { slots: {} }
    };
}

function normalizeUserRecord(user) {
    if (!user || typeof user !== 'object') return user;

    if (user.path === undefined || user.path === null) user.path = user.currentRoute ?? null;
    if (user.currentRoute === undefined || user.currentRoute === null) user.currentRoute = user.path ?? null;
    if (user.specialization === undefined || user.specialization === null) user.specialization = user.currentSpecialty ?? null;
    if (user.currentSpecialty === undefined || user.currentSpecialty === null) user.currentSpecialty = user.specialization ?? null;
    if (user.hp === undefined || user.hp === null || Number.isNaN(Number(user.hp))) user.hp = 100;
    user.hp = Math.max(0, Math.min(100, Number(user.hp)));

    if (!user.inventory || typeof user.inventory !== 'object') {
        user.inventory = createDefaultInventory();
    }
    if (!user.inventory.materials || typeof user.inventory.materials !== 'object') user.inventory.materials = {};
    if (!Array.isArray(user.inventory.items)) user.inventory.items = [];
    if (!user.inventory.gear || typeof user.inventory.gear !== 'object') user.inventory.gear = createDefaultGearInventory();
    for (const slot of ['helmet', 'chest', 'pants', 'shoes', 'weapon', 'shield']) {
        if (!Array.isArray(user.inventory.gear[slot])) user.inventory.gear[slot] = [];
    }

    if (!user.materials || typeof user.materials !== 'object') user.materials = user.inventory.materials;
    else user.inventory.materials = user.materials;

    if (!user.gearInventory || typeof user.gearInventory !== 'object') user.gearInventory = user.inventory.gear;
    else user.inventory.gear = user.gearInventory;

    if (!user.equippedGear || typeof user.equippedGear !== 'object') {
        user.equippedGear = user.gearEquipment && typeof user.gearEquipment === 'object'
            ? user.gearEquipment
            : createDefaultEquippedGear();
    }
    user.gearEquipment = user.equippedGear;
    for (const slot of ['helmet', 'chest', 'pants', 'shoes', 'weapon', 'shield']) {
        if (user.equippedGear[slot] === undefined) user.equippedGear[slot] = null;
    }

    if (!user.clan || typeof user.clan !== 'object') user.clan = createDefaultClanState();
    if (user.clanId === undefined || user.clanId === null) user.clanId = user.clan.id ?? null;
    if (user.clan.id === undefined) user.clan.id = user.clanId ?? null;
    if (user.clan.role === undefined) user.clan.role = null;
    if (user.clan.joinedAt === undefined) user.clan.joinedAt = 0;
    if (user.clan.contribution === undefined) user.clan.contribution = 0;

    if (!user.specialties || typeof user.specialties !== 'object') {
        user.specialties = { combat: null, scholar: null, atelier: null, merchant: null };
    }
    if (user.specialties.combat === undefined) user.specialties.combat = null;
    if (user.specialties.scholar === undefined) user.specialties.scholar = null;
    if (user.specialties.atelier === undefined) user.specialties.atelier = null;
    if (user.specialties.merchant === undefined) user.specialties.merchant = null;
    if (!Array.isArray(user.completedRoutes)) user.completedRoutes = [];
    if (!Array.isArray(user.prestigeRoles)) user.prestigeRoles = [];
    if (typeof user.prestigeCount !== 'number') user.prestigeCount = user.prestigeRoles.length || 0;
    if (typeof user.rebirthCount !== 'number') user.rebirthCount = 0;
    if (typeof user.rebirthPendingRoute !== 'string') user.rebirthPendingRoute = typeof user.pendingFinalRestoreRoute === 'string' ? user.pendingFinalRestoreRoute : '';
    if (typeof user.pendingFinalRestoreRoute !== 'string') user.pendingFinalRestoreRoute = user.rebirthPendingRoute || '';
    if (typeof user.lastActiveAt !== 'number') user.lastActiveAt = Number(user.lastActiveAt || 0);

    if (!user.hunting || typeof user.hunting !== 'object') {
        user.hunting = { lastHuntAt: 0, cooldownUntil: 0, history: [] };
    }
    if (typeof user.hunting.lastHuntAt !== 'number') user.hunting.lastHuntAt = Number(user.hunting.lastHuntAt || 0);
    if (typeof user.hunting.cooldownUntil !== 'number') user.hunting.cooldownUntil = Number(user.hunting.cooldownUntil || 0);
    if (!Array.isArray(user.hunting.history)) user.hunting.history = [];

    if (!user.blacklist || typeof user.blacklist !== 'object') {
        user.blacklist = { active: false, expiresAt: 0 };
    }
    if (user.blacklist.active === undefined) user.blacklist.active = false;
    if (user.blacklist.expiresAt === undefined) user.blacklist.expiresAt = 0;

    if (user.gift_month === undefined) user.gift_month = '';
    if (user.monthly_gif_buys === undefined) user.monthly_gif_buys = 0;

    return user;
}

/* ── init ── */

async function initDB() {
    await ensureFile(filePath, { users: [] });
    await ensureFile(bankFilePath, DEFAULT_BANK);
    await ensureFile(productsFilePath, []);
    await ensureFile(bankLogPath, []);
    await ensureFile(convLogPath, []);
    await ensureFile(transactionLogPath, []);
    await ensureFile(commandLogPath, []);

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
    const db = await loadDB();
    let user = db.users.find(u => u.user_id === userId);
    if (!user) {
        user = createDefaultUser(userId);
        db.users.push(user);
        queueSave();
    }

    // Migrate older records
    if (user.bank_access             === undefined) user.bank_access             = false;
    if (user.gems                    === undefined) user.gems                    = 0;
    if (user.honor                   === undefined) user.honor                   = 0;
    if (user.gold                    === undefined) user.gold                    = 0;
    if (user.xp                      === undefined) user.xp                      = 0;
    if (user.level                   === undefined) user.level                   = 1;
    if (user.hp                      === undefined) user.hp                      = 100;
    if (user.path                    === undefined) user.path                    = user.currentRoute ?? null;
    if (user.specialization          === undefined) user.specialization          = user.currentSpecialty ?? null;
    if (user.monthly_gold_to_gems    === undefined) user.monthly_gold_to_gems    = 0;
    if (user.monthly_gems_to_honor   === undefined) user.monthly_gems_to_honor   = 0;
    if (user.conversion_month        === undefined) user.conversion_month        = '';
    if (user.task_daily_date         === undefined) user.task_daily_date         = '';
    if (user.task_daily_messages     === undefined) user.task_daily_messages     = 0;
    if (user.task_daily_message_bonus_claimed === undefined) user.task_daily_message_bonus_claimed = false;
    if (user.task_daily_voice_seconds === undefined) user.task_daily_voice_seconds = 0;
    if (user.task_daily_voice_bonus_claimed === undefined) user.task_daily_voice_bonus_claimed = false;
    if (!user.task_weekly || typeof user.task_weekly !== 'object') user.task_weekly = { slots: {} };
    if (!user.task_monthly || typeof user.task_monthly !== 'object') user.task_monthly = { slots: {} };
    if (user.currentRoute === undefined) user.currentRoute = null;
    if (user.currentSpecialty === undefined) user.currentSpecialty = null;
    if (!user.specialties || typeof user.specialties !== 'object') {
        user.specialties = { combat: null, scholar: null, atelier: null, merchant: null };
    }
    if (user.specialties.combat === undefined) user.specialties.combat = null;
    if (user.specialties.scholar === undefined) user.specialties.scholar = null;
    if (user.specialties.atelier === undefined) user.specialties.atelier = null;
    if (user.specialties.merchant === undefined) user.specialties.merchant = null;
    if (!Array.isArray(user.completedRoutes)) user.completedRoutes = [];
    if (!Array.isArray(user.prestigeRoles)) user.prestigeRoles = [];
    if (user.prestigeCount === undefined) user.prestigeCount = user.prestigeRoles.length || 0;
    if (user.rebirthCount === undefined) user.rebirthCount = 0;
    if (user.rebirthPendingRoute === undefined) user.rebirthPendingRoute = user.pendingFinalRestoreRoute ?? '';
    if (user.pendingFinalRestoreRoute === undefined) user.pendingFinalRestoreRoute = user.rebirthPendingRoute ?? '';
    if (user.lastActiveAt === undefined) user.lastActiveAt = 0;
    if (user.clanId === undefined) user.clanId = user.clan?.id ?? null;
    if (user.inventory === undefined || typeof user.inventory !== 'object') {
        user.inventory = createDefaultInventory();
    }
    if (!user.gearInventory || typeof user.gearInventory !== 'object') {
        user.gearInventory = user.inventory.gear || createDefaultGearInventory();
    }
    if (!user.gearEquipment || typeof user.gearEquipment !== 'object') {
        user.gearEquipment = createDefaultEquippedGear();
    }
    if (!user.equippedGear || typeof user.equippedGear !== 'object') user.equippedGear = user.gearEquipment;
    if (!user.materials || typeof user.materials !== 'object') user.materials = user.inventory.materials || {};
    if (!user.hunting || typeof user.hunting !== 'object') {
        user.hunting = { lastHuntAt: 0, cooldownUntil: 0, history: [] };
    }
    if (!Array.isArray(user.hunting.history)) user.hunting.history = [];
    if (!user.clan || typeof user.clan !== 'object') {
        user.clan = { id: null, role: null, joinedAt: 0, contribution: 0 };
    }
    if (user.clan.id === undefined) user.clan.id = null;
    if (user.clan.role === undefined) user.clan.role = null;
    if (user.clan.joinedAt === undefined) user.clan.joinedAt = 0;
    if (user.clan.contribution === undefined) user.clan.contribution = 0;
    if (user.monthly_gif_buys === undefined) user.monthly_gif_buys = 0;
    if (user.gif_expires === undefined) user.gif_expires = 0;
    if (user.gif_month === undefined) user.gif_month = '';
    if (user.warnings === undefined) user.warnings = 0;
    if (!user.blacklist || typeof user.blacklist !== 'object') {
        user.blacklist = { active: false, expiresAt: 0 };
    }
    if (user.blacklist.active === undefined) user.blacklist.active = false;
    if (user.blacklist.expiresAt === undefined) user.blacklist.expiresAt = 0;
    // Remove credit field if it exists (migration)
    if (user.credit !== undefined) delete user.credit;

    normalizeUserRecord(user);

    return user;
}

async function saveUser(user) {
    normalizeUserRecord(user);
    const db = await loadDB();
    const idx = db.users.findIndex(u => u.user_id === user.user_id);
    if (idx !== -1) db.users[idx] = user;
    else db.users.push(user);
    queueSave();
}

let authCache = null;
let authCacheTime = 0;

async function getAuthorizedUsers() {
    const db = await loadDB();
    const now = Date.now();
    if (!authCache || (now - authCacheTime > 60000)) {
        authCache = new Set(db.users.filter(u => u.bank_access === true).map(u => u.user_id));
        authCacheTime = now;
    }
    return authCache;
}

async function getAllUsers() {
    const db = await loadDB();
    return db.users.slice();
}

async function setBankAccess(userId, value) {
    const user = await getUser(userId);
    user.bank_access = value;
    authCacheTime = 0; // invalidate cache
    await saveUser(user);
}

async function resetAllUsers() {
    const db = await loadDB();
    // Preserve punishment-related fields (if any) so a later punishment system
    // can remain intact while everything else is reset.
    const preservedRE = /punish|punishment|ban|mute|strike|moderation/i;
    db.users = db.users.map(u => {
        const base = createDefaultUser(u.user_id);
        base.bank_access = u.bank_access ?? false;
        for (const k of Object.keys(u)) {
            if (preservedRE.test(k)) base[k] = u[k];
        }
        // Reset GIF monthly counters and remove any GIF expiry metadata so the
        // monthly limit is cleared by this operation.
        base.monthly_gif_buys = 0;
        if (base.gif_expires !== undefined) delete base.gif_expires;
        if (base.gif_month !== undefined) delete base.gif_month;

        return base;
    });
    
    // reset cache
    authCacheTime = 0;
    queueSave();

    // Reset global/system files so the bot looks unused:
    // - bank (balances)
    // - bank log
    // - conversion log
    // - products
    await ensureFile(bankFilePath, DEFAULT_BANK);
    await atomicWrite(bankFilePath, DEFAULT_BANK);
    await ensureFile(bankLogPath, []);
    await atomicWrite(bankLogPath, []);
    await ensureFile(convLogPath, []);
    await atomicWrite(convLogPath, []);
    await ensureFile(productsFilePath, []);
    await atomicWrite(productsFilePath, []);
}

/* ── leaderboard ── */

async function getLeaderboard(field, limit = 10) {
    const db = await loadDB();
    if (!db.users.length) return [];

    const withTotal = db.users.filter(u => u.user_id).map(u => {
        let total = u[field] ?? 0;
        if (field === 'xp') total += 100 * (u.level * (u.level - 1) / 2);
        return { ...u, totalField: total };
    });

    return withTotal.sort((a, b) => b.totalField - a.totalField).slice(0, limit);
}

/* ── bank ── */

let bankMemory = null;
let pendingBankSave = null;
async function flushBank() {
    if (bankMemory) await atomicWrite(bankFilePath, bankMemory);
    pendingBankSave = false;
}
function queueBankSave() {
    if (!pendingBankSave) { 
        pendingBankSave = true; 
        setTimeout(flushBank, 3000); 
    }
}
async function getBank() {
    if (bankMemory) return bankMemory;
    await ensureFile(bankFilePath, DEFAULT_BANK);
    const bank = await safeRead(bankFilePath, DEFAULT_BANK);
    if (bank.gems  === undefined) bank.gems  = 0;
    if (bank.honor === undefined) bank.honor = 0;
    bankMemory = bank;
    return bank;
}

async function saveBank(bank) {
    bankMemory = bank;
    queueBankSave();
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

async function appendCappedLog(file, entry, maxEntries = 100) {
    await ensureFile(file, []);
    const log = await safeRead(file, []);
    log.push(entry);
    while (log.length > maxEntries) log.shift();
    await atomicWrite(file, log);
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

/* ── transaction log (last 100) ── */

async function logTransaction({ userId, action, goldAmount, reason, details }) {
    await appendCappedLog(transactionLogPath, {
        userId,
        action,
        goldAmount: goldAmount ?? 0,
        reason: reason || action || 'unknown',
        details: details || null,
        timestamp: new Date().toISOString()
    }, 100);
}

async function getTransactionLog() {
    await ensureFile(transactionLogPath, []);
    return safeRead(transactionLogPath, []);
}

async function clearTransactionLog() {
    await atomicWrite(transactionLogPath, []);
}

/* ── command log (last 100) ── */

async function logCommandUsage({
    userId,
    username,
    guildId,
    channelId,
    command,
    args,
    rawContent,
    status,
    details
}) {
    await appendCappedLog(commandLogPath, {
        userId,
        username: username || null,
        guildId: guildId || null,
        channelId: channelId || null,
        command,
        args: Array.isArray(args) ? args : [],
        rawContent: rawContent || '',
        status: status || 'unknown',
        details: details || null,
        timestamp: new Date().toISOString()
    }, 100);
}

async function getCommandLog() {
    await ensureFile(commandLogPath, []);
    return safeRead(commandLogPath, []);
}

async function clearCommandLog() {
    await atomicWrite(commandLogPath, []);
}

module.exports = {
    initDB,
    getUser, saveUser,
    getAuthorizedUsers, setBankAccess, resetAllUsers,
    getLeaderboard,
    getAllUsers,
    getBank, saveBank,
    getProducts, saveProducts,
    logBankAction, getBankLog,
    logConversion, getConversionLog,
    logTransaction, getTransactionLog, clearTransactionLog,
    logCommandUsage, getCommandLog, clearCommandLog
};
