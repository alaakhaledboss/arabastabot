const fs = require('fs').promises;
const path = require('path');

const dataFolder = path.join(__dirname, 'data');
const filePath = path.join(dataFolder, 'users.json');

async function ensureDataFile() {
    try {
        await fs.mkdir(dataFolder, { recursive: true });
        try {
            await fs.access(filePath);
        } catch {
            await fs.writeFile(filePath, JSON.stringify({ users: [] }, null, 2), 'utf8');
        }
    } catch (err) {
        console.error('Failed to ensure data file:', err);
        throw err;
    }
}

async function readDB() {
    await ensureDataFile();
    const raw = await fs.readFile(filePath, 'utf8');
    try {
        return JSON.parse(raw);
    } catch (err) {
        // If JSON corrupted, recreate safe empty DB
        console.error('Corrupted DB file, recreating:', err);
        const init = { users: [] };
        await fs.writeFile(filePath, JSON.stringify(init, null, 2), 'utf8');
        return init;
    }
}

async function writeDB(data) {
    const tmp = `${filePath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(tmp, filePath);
}

async function initDB() {
    await ensureDataFile();
    // validate structure
    const db = await readDB();
    db.users ||= [];
    await writeDB(db);
}

async function getUser(userId) {
    const db = await readDB();
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
            last_daily_reset: 0
        };
        db.users.push(user);
        await writeDB(db);
    }
    return user;
}

async function saveUser(user) {
    const db = await readDB();
    db.users ||= [];
    const idx = db.users.findIndex(u => u.user_id === user.user_id);
    if (idx !== -1) db.users[idx] = user;
    else db.users.push(user);
    await writeDB(db);
}

// Get leaderboard for a stat (supports 'xp' as total XP across levels)
async function getLeaderboard(field, limit = 10) {
    const db = await readDB();
    db.users ||= [];
    if (db.users.length === 0) return [];

    const usersWithTotal = db.users.map(u => {
        let total = u[field] ?? 0;
        if (field === 'xp') {
            // total XP including all previous levels:
            // sum of 100 * level for levels 1..(level-1) = 100 * (level*(level-1)/2)
            total += 100 * (u.level * (u.level - 1) / 2);
        }
        return { ...u, totalField: total };
    });

    const sorted = usersWithTotal.sort((a, b) => b.totalField - a.totalField);
    return sorted.slice(0, limit);
}

module.exports = { initDB, getUser, saveUser, getLeaderboard };