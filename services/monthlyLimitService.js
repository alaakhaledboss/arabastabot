function getCurrentMonthKey(date = new Date()) {
    const safeDate = date instanceof Date ? date : new Date(date);
    const year = safeDate.getFullYear();
    const month = String(safeDate.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

function ensureMonthlyUsageObject(user, property) {
    if (!user || typeof user !== 'object') return {};
    if (!user[property] || typeof user[property] !== 'object') {
        user[property] = {};
    }
    return user[property];
}

function getMonthlyUsage(user, property, monthKey = getCurrentMonthKey()) {
    const bucket = ensureMonthlyUsageObject(user, property);
    return Number(bucket[monthKey] || 0);
}

function incrementMonthlyUsage(user, property, amount = 1, monthKey = getCurrentMonthKey()) {
    const bucket = ensureMonthlyUsageObject(user, property);
    const safeAmount = Number(amount || 0);
    bucket[monthKey] = Number(bucket[monthKey] || 0) + safeAmount;
    return bucket[monthKey];
}

function canUseMonthlyLimit(user, property, limit, amount = 1, monthKey = getCurrentMonthKey()) {
    if (!Number.isFinite(Number(limit)) || Number(limit) <= 0) return true;
    const current = getMonthlyUsage(user, property, monthKey);
    return current + Number(amount || 0) <= Number(limit);
}

function getLocationCooldown(user, location) {
    if (!user || typeof user !== 'object') return 0;
    if (!user.locationCooldowns || typeof user.locationCooldowns !== 'object') {
        user.locationCooldowns = {};
    }
    const key = String(location || '').trim().toLowerCase();
    return Number(user.locationCooldowns[key] || 0);
}

function setLocationCooldown(user, location, expiresAtMs) {
    if (!user || typeof user !== 'object') return 0;
    if (!user.locationCooldowns || typeof user.locationCooldowns !== 'object') {
        user.locationCooldowns = {};
    }
    const key = String(location || '').trim().toLowerCase();
    const safeValue = Number(expiresAtMs || 0);
    user.locationCooldowns[key] = safeValue;
    return safeValue;
}

function locationReadyAt(user, location, cooldownMs = 0) {
    const expiry = getLocationCooldown(user, location);
    const now = Date.now();
    return expiry <= now ? 0 : Math.max(0, expiry - now + cooldownMs);
}

module.exports = {
    getCurrentMonthKey,
    ensureMonthlyUsageObject,
    getMonthlyUsage,
    incrementMonthlyUsage,
    canUseMonthlyLimit,
    getLocationCooldown,
    setLocationCooldown,
    locationReadyAt
};
