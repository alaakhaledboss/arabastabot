const db = require('../db');
const { AuditLogEvent, PermissionFlagsBits } = require('discord.js');

const BLACKLIST_ROLE_ID = '1483105190398787736';

const OWNER_ID = process.env.OWNER_ID;

const ALLOWED_WARNERS = [
    OWNER_ID,
    '1079479751200227388',
    '747389646232748123'
];

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function isAdminMember(member) {
    return !!member?.permissions?.has?.(PermissionFlagsBits.Administrator);
}

function ensureModerationFields(user) {
    if (user.warnings === undefined) user.warnings = 0;
    if (!user.blacklist || typeof user.blacklist !== 'object') {
        user.blacklist = { active: false, expiresAt: 0 };
    }
    if (user.blacklist.active === undefined) user.blacklist.active = false;
    if (user.blacklist.expiresAt === undefined) user.blacklist.expiresAt = 0;
}

function isAllowedWarner(userId) {
    return ALLOWED_WARNERS.includes(String(userId || ''));
}

async function applyBlacklist(member) {
    if (!member) return false;

    if (isAdminMember(member)) {
        const user = await db.getUser(member.id);
        ensureModerationFields(user);
        user.blacklist.active = false;
        user.blacklist.expiresAt = 0;
        await db.saveUser(user);

        if (member.roles.cache.has(BLACKLIST_ROLE_ID)) {
            await member.roles.remove(BLACKLIST_ROLE_ID).catch((err) => {
                console.error('[moderation] applyBlacklist admin cleanup role remove failed:', err?.message || err);
            });
        }

        return false;
    }

    const user = await db.getUser(member.id);
    ensureModerationFields(user);

    user.blacklist.active = true;
    user.blacklist.expiresAt = Date.now() + ONE_WEEK_MS;
    await db.saveUser(user);

    if (!member.roles.cache.has(BLACKLIST_ROLE_ID)) {
        await member.roles.add(BLACKLIST_ROLE_ID).catch((err) => {
            console.error('[moderation] applyBlacklist role add failed:', err?.message || err);
        });
    }

    return true;
}

async function removeBlacklist(member) {
    if (!member) return false;

    const user = await db.getUser(member.id);
    ensureModerationFields(user);

    user.blacklist.active = false;
    user.blacklist.expiresAt = 0;
    await db.saveUser(user);

    if (member.roles.cache.has(BLACKLIST_ROLE_ID)) {
        await member.roles.remove(BLACKLIST_ROLE_ID).catch((err) => {
            console.error('[moderation] removeBlacklist role remove failed:', err?.message || err);
        });
    }

    return true;
}

async function removeBlacklistByUserId(userId, guild) {
    const normalizedUserId = String(userId || '');
    if (!normalizedUserId) {
        return { ok: false, removedRole: false, userFoundInGuild: false, wasBlacklisted: false };
    }

    const user = await db.getUser(normalizedUserId);
    ensureModerationFields(user);

    const wasBlacklisted = !!user.blacklist.active;
    const member = guild ? await guild.members.fetch(normalizedUserId).catch(() => null) : null;

    if (member) {
        await removeBlacklist(member);
        return {
            ok: true,
            removedRole: true,
            userFoundInGuild: true,
            wasBlacklisted
        };
    }

    user.blacklist.active = false;
    user.blacklist.expiresAt = 0;
    await db.saveUser(user);

    return {
        ok: true,
        removedRole: false,
        userFoundInGuild: false,
        wasBlacklisted
    };
}

async function addWarning(userId, guild) {
    const member = guild ? await guild.members.fetch(String(userId)).catch(() => null) : null;
    if (member && isAdminMember(member)) {
        const user = await db.getUser(String(userId));
        ensureModerationFields(user);
        user.warnings = 0;
        user.blacklist.active = false;
        user.blacklist.expiresAt = 0;
        await db.saveUser(user);

        if (member.roles.cache.has(BLACKLIST_ROLE_ID)) {
            await member.roles.remove(BLACKLIST_ROLE_ID).catch((err) => {
                console.error('[moderation] addWarning admin cleanup role remove failed:', err?.message || err);
            });
        }

        return { blacklisted: false, warnings: 0, skippedAdmin: true };
    }

    const user = await db.getUser(String(userId));
    ensureModerationFields(user);

    user.warnings = Number(user.warnings || 0) + 1;

    const reachedThreshold = user.warnings >= 3;
    if (!reachedThreshold) {
        await db.saveUser(user);
        return { blacklisted: false, warnings: user.warnings };
    }

    user.warnings = 0;
    await db.saveUser(user);

    if (member) {
        await applyBlacklist(member);
    } else {
        user.blacklist.active = true;
        user.blacklist.expiresAt = Date.now() + ONE_WEEK_MS;
        await db.saveUser(user);
    }

    return { blacklisted: true, warnings: 0 };
}

async function removeWarning(userId) {
    const user = await db.getUser(String(userId));
    ensureModerationFields(user);

    const currentWarnings = Number(user.warnings || 0);
    if (currentWarnings <= 0) {
        return { removed: false, warnings: 0 };
    }

    user.warnings = currentWarnings - 1;
    await db.saveUser(user);

    return { removed: true, warnings: user.warnings };
}

async function findMemberAcrossGuilds(client, userId) {
    for (const guild of client.guilds.cache.values()) {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member) return member;
    }
    return null;
}

async function checkExpiredBlacklists(client) {
    try {
        const now = Date.now();
        const users = await db.getAllUsers();

        for (const user of users) {
            ensureModerationFields(user);
            if (!user.blacklist.active) continue;

            const expiresAt = Number(user.blacklist.expiresAt || 0);
            if (!expiresAt || now < expiresAt) continue;

            const member = await findMemberAcrossGuilds(client, user.user_id);
            if (!member) continue;

            if (member.roles.cache.has(BLACKLIST_ROLE_ID)) {
                await removeBlacklist(member);
            } else {
                // Tampering during active blacklist window: restore and restart timer.
                await applyBlacklist(member);
            }
        }
    } catch (err) {
        console.error('[moderation] checkExpiredBlacklists error:', err);
    }
}

async function handleManualRemoval(oldMember, newMember) {
    try {
        const hadRole = !!oldMember?.roles?.cache?.has?.(BLACKLIST_ROLE_ID);
        const hasRoleNow = !!newMember?.roles?.cache?.has?.(BLACKLIST_ROLE_ID);
        if (!hadRole || hasRoleNow) return;

        const user = await db.getUser(newMember.id);
        ensureModerationFields(user);

        if (!user.blacklist.active) return;

        const guild = newMember.guild;
        const botMember = guild?.members?.me || null;

        if (guild && botMember?.permissions?.has(PermissionFlagsBits.ViewAuditLog)) {
            try {
                const logs = await guild.fetchAuditLogs({
                    type: AuditLogEvent.MemberRoleUpdate,
                    limit: 6
                });

                const now = Date.now();
                const matched = logs.entries.find((entry) => {
                    if (!entry?.target || String(entry.target.id) !== String(newMember.id)) return false;

                    const removedRole = Array.isArray(entry.changes)
                        ? entry.changes.find((change) => change.key === '$remove' && Array.isArray(change.new) && change.new.some((r) => String(r.id) === BLACKLIST_ROLE_ID))
                        : null;

                    if (!removedRole) return false;

                    return Math.abs(now - Number(entry.createdTimestamp || 0)) <= 15_000;
                });

                if (matched) {
                    const executorId = matched.executor?.id || 'unknown';
                    console.warn(`[moderation] Blacklist role removed from ${newMember.id} by ${executorId}; role restored and timer reset.`);
                } else {
                    console.warn(`[moderation] Blacklist role removed from ${newMember.id}; actor not found in recent audit entries.`);
                }
            } catch (err) {
                console.error('[moderation] audit log lookup failed:', err?.message || err);
            }
        }

        await applyBlacklist(newMember);
    } catch (err) {
        console.error('[moderation] handleManualRemoval error:', err);
    }
}

module.exports = {
    BLACKLIST_ROLE_ID,
    OWNER_ID,
    ALLOWED_WARNERS,
    addWarning,
    removeWarning,
    applyBlacklist,
    removeBlacklist,
    removeBlacklistByUserId,
    checkExpiredBlacklists,
    handleManualRemoval,
    isAllowedWarner,
    isAdminMember
};
