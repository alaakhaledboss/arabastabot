const db = require('../db');
const levelUpAnnounceService = require('./levelUpAnnounceService');
const progressionService = require('./progressionService');

const COOLDOWN_MS  = 60 * 1000;       // 1 minute between rewards
const DEFAULT_DAILY_CAP = 350 * 10;   // 3500 internal units = 350 display gold
const CLAN_DAILY_CAP = 450 * 10;      // 4500 internal units = 450 display gold
const GOLD_REWARD  = 75;              // internal units per tick (= 7.5 display gold)
const XP_REWARD    = 15;
const ONE_DAY_MS   = 24 * 60 * 60 * 1000;

function getDailyCapForMessage(message) {
    const route = progressionService.getRouteLevelInfo(message?.member).route;
    return route === 'merchant' ? CLAN_DAILY_CAP : DEFAULT_DAILY_CAP;
}

async function handleRewards(message, options = {}) {
    try {
        const user = await db.getUser(message.author.id);
        const oldLevel = Number(user.level || 1);
        const now = Date.now();
        const dailyCap = getDailyCapForMessage(message);
        const xpMultiplier = Number(options.xpMultiplier || 1);
        const effectiveXpReward = Math.max(0, Math.round(XP_REWARD * xpMultiplier));

        // reset daily counter if 24 h have passed
        if (!user.last_daily_reset || now - user.last_daily_reset >= ONE_DAY_MS) {
            user.daily_gold_earned = 0;
            user.last_daily_reset = now;
        }

        // give rewards if cooldown has elapsed
        if (!user.last_reward_time || now - user.last_reward_time >= COOLDOWN_MS) {
            const remaining = dailyCap - (user.daily_gold_earned || 0);
            const goldToGive = remaining > 0 ? Math.min(GOLD_REWARD, remaining) : 0;

            user.gold += goldToGive;
            user.daily_gold_earned = (user.daily_gold_earned || 0) + goldToGive;
            user.xp += effectiveXpReward;
            user.last_reward_time = now;
        }

        // level-up loop
        let leveledUp = false;
        while (user.xp >= 100 * user.level) {
            user.xp -= 100 * user.level;
            user.level += 1;
            leveledUp = true;
        }

        await db.saveUser(user);

        if (leveledUp) {
            await levelUpAnnounceService.announceLevelUps({
                guild: message.guild,
                member: message.member,
                userId: message.author.id,
                oldLevel,
                newLevel: user.level
            });
        }

        
    } catch (err) {
        console.error('rewardService error:', err);
    }
}

module.exports = { handleRewards };