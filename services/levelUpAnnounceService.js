const cfg = require('../config/progressionConfig');

const LEVEL_UP_CHANNEL_ID = '1481796885718106163';

function getRouteThresholds(route) {
    const thresholds = cfg.ROUTE_LEVEL_THRESHOLDS?.[route]
        || cfg.ROUTE_LEVEL_THRESHOLDS_DEFAULT
        || [1, 3, 7, 11, 15, 19, 22];
    return Array.isArray(thresholds) ? thresholds : [1, 3, 7, 11, 15, 19, 22];
}

function getRouteFromMember(member) {
    if (!member?.roles?.cache) return null;

    for (const route of cfg.ROUTES) {
        const levelIds = cfg.ROUTE_LEVEL_ROLE_IDS?.[route] || [];
        if (levelIds.some((id) => member.roles.cache.has(id))) return route;
    }

    for (const route of cfg.ROUTES) {
        const specialties = cfg.SPECIALTY_ROLE_IDS?.[route] || {};
        if (Object.values(specialties).some((id) => member.roles.cache.has(id))) return route;
    }

    return null;
}

function getRouteIndexForLevel(route, level) {
    if (!route) return -1;
    const roleIds = cfg.ROUTE_LEVEL_ROLE_IDS?.[route] || [];
    if (!roleIds.length) return -1;

    const thresholds = getRouteThresholds(route);
    const maxIndex = Math.max(0, roleIds.length - 1);
    const safeLevel = Math.max(1, Number(level || 1));

    for (let i = Math.min(maxIndex, thresholds.length - 1); i >= 0; i -= 1) {
        if (safeLevel >= Number(thresholds[i] || 1)) return i;
    }

    return 0;
}

function buildLevelEvents(oldLevel, newLevel, route) {
    const events = [];
    if (newLevel <= oldLevel) return events;

    const labels = cfg.ROUTE_LEVEL_LABELS?.[route] || [];

    for (let level = oldLevel + 1; level <= newLevel; level += 1) {
        const from = level - 1;
        const to = level;
        const prevIdx = getRouteIndexForLevel(route, from);
        const nextIdx = getRouteIndexForLevel(route, to);
        const routeRankUp = route && nextIdx > prevIdx
            ? (labels[nextIdx] || `level_${nextIdx + 1}`)
            : null;

        events.push({ from, to, routeRankUp });
    }

    return events;
}

async function getLevelChannel(guild) {
    if (!guild) return null;
    return guild.channels.cache.get(LEVEL_UP_CHANNEL_ID)
        || await guild.channels.fetch(LEVEL_UP_CHANNEL_ID).catch(() => null);
}

async function announceLevelUps({ guild, member, userId, oldLevel, newLevel }) {
    if (!guild || !userId) return;
    if (Number(newLevel || 0) <= Number(oldLevel || 0)) return;

    const channel = await getLevelChannel(guild);
    if (!channel || !channel.isTextBased()) return;

    const route = getRouteFromMember(member);
    const events = buildLevelEvents(Number(oldLevel || 1), Number(newLevel || 1), route);
    if (!events.length) return;

    for (const event of events) {
        const rankText = event.routeRankUp
            ? `\n🧭 Route rank up: **${event.routeRankUp}** (${route})`
            : '';
        const content = [
            `🎉 Congrats <@${userId}>! Level up: **${event.from} → ${event.to}**`,
            `🎉 مبروك <@${userId}>! لفل أب: **${event.from} → ${event.to}**${rankText}`,
            '────────────────────────'
        ].join('\n');

        await channel.send(content).catch(() => {});
    }
}

module.exports = {
    LEVEL_UP_CHANNEL_ID,
    announceLevelUps
};
