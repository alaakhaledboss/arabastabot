const fs = require('fs').promises;
const path = require('path');
const { PermissionFlagsBits } = require('discord.js');
const db = require('../db');
const { COLORS, FOOTER_TEXT, formatError } = require('../utils/uiConstants');
const progressionService = require('./progressionService');
const gameplayCfg = require('../config/gameplayConfig');

const DATA_FILE = path.join(__dirname, '..', 'data', 'clans.json');
const DAY_MS = 24 * 60 * 60 * 1000;

async function ensureStore() {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    try {
        await fs.access(DATA_FILE);
    } catch {
        await fs.writeFile(DATA_FILE, JSON.stringify({ clans: [] }, null, 2), 'utf8');
    }
}

async function readStore() {
    await ensureStore();
    try {
        const raw = await fs.readFile(DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return { clans: [] };
        if (!Array.isArray(parsed.clans)) parsed.clans = [];
        return parsed;
    } catch {
        return { clans: [] };
    }
}

async function writeStore(store) {
    await ensureStore();
    const tmp = `${DATA_FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(store, null, 2), 'utf8');
    await fs.rename(tmp, DATA_FILE);
}

function ensureClanUserFields(user) {
    if (!user.clan || typeof user.clan !== 'object') {
        user.clan = { id: null, role: null, joinedAt: 0, contribution: 0 };
    }

    if (user.clan.id === undefined) user.clan.id = null;
    if (user.clan.role === undefined) user.clan.role = null;
    if (user.clan.joinedAt === undefined) user.clan.joinedAt = 0;
    if (user.clan.contribution === undefined) user.clan.contribution = 0;
    if (user.clanId === undefined || user.clanId === null) user.clanId = user.clan.id ?? null;
    if (user.clan.id === undefined) user.clan.id = user.clanId ?? null;

    if (typeof user.lastActiveAt !== 'number') user.lastActiveAt = Number(user.lastActiveAt || 0);
    return user;
}

function routeLabel(route) {
    return ({ combat: 'Combat', scholar: 'Scholar', atelier: 'Atelier', merchant: 'Merchant' })[route] || route || '-';
}

function clanRoleForUser(clan, userId) {
    if (clan.leaderId === userId) return 'leader';
    if (clan.deputyId === userId) return 'deputy';
    return 'member';
}

function normalizeClan(clan) {
    if (!clan || typeof clan !== 'object') return null;
    clan.members = Array.isArray(clan.members) ? [...new Set(clan.members)] : [];
    clan.status = clan.status || 'active';
    clan.path = clan.path || clan.route || null;
    clan.route = clan.route || clan.path || null;
    clan.createdAt = Number(clan.createdAt || Date.now());
    clan.updatedAt = Number(clan.updatedAt || clan.createdAt);
    return clan;
}

async function getClanById(clanId) {
    const store = await readStore();
    return normalizeClan(store.clans.find((clan) => clan.id === clanId) || null);
}

async function findClanByMemberId(memberId) {
    const store = await readStore();
    return normalizeClan(store.clans.find((clan) => Array.isArray(clan.members) && clan.members.includes(memberId)) || null);
}

async function saveClan(clan) {
    const store = await readStore();
    const normalized = normalizeClan({ ...clan });
    const index = store.clans.findIndex((item) => item.id === normalized.id);
    if (index === -1) store.clans.push(normalized);
    else store.clans[index] = normalized;
    await writeStore(store);
}

async function removeClan(clanId) {
    const store = await readStore();
    store.clans = store.clans.filter((clan) => clan.id !== clanId);
    await writeStore(store);
}

function normalizePathValue(route) {
    const value = String(route || '').trim().toLowerCase();
    return ['combat', 'scholar', 'atelier', 'merchant'].includes(value) ? value : null;
}

function getMemberRoute(member, user) {
    return progressionService.getRouteLevelInfo(member).route || user.currentRoute || null;
}

function parseAdminCreate(message) {
    const content = String(message.content || '').trim();
    const match = content.match(/^%clan\s+admincreate\s+<@!?([0-9]+)>\s+<@!?([0-9]+)>\s+"([^"]+)"\s*(.*)$/i);
    if (!match) return null;

    const [, leaderId, deputyId, clanName, remainder] = match;
    const memberIds = [...String(remainder || '').matchAll(/<@!?([0-9]+)>/g)].map((entry) => entry[1]);
    const uniqueIds = [...new Set([leaderId, deputyId, ...memberIds])];

    return {
        leaderId,
        deputyId,
        clanName: clanName.trim(),
        uniqueIds
    };
}

async function removeAllClanRoles(member) {
    if (!member?.roles?.cache) return;
    const roleIds = Object.values(gameplayCfg.CLAN_ROLES).filter(Boolean);
    for (const roleId of roleIds) {
        if (member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId).catch(() => {});
        }
    }
}

async function applyClanRole(member, roleKind) {
    if (!member?.roles) return;
    await removeAllClanRoles(member);
    const roleId = gameplayCfg.CLAN_ROLES[roleKind];
    if (roleId) {
        await member.roles.add(roleId).catch(() => {});
    }
}

async function syncClanRoles(client, clan) {
    if (!client?.guilds) return;
    const guild = client.guilds.cache.first() || await client.guilds.fetch().then((collection) => collection.first()).catch(() => null);
    if (!guild) return;

    for (const memberId of clan.members) {
        const member = await guild.members.fetch(memberId).catch(() => null);
        if (!member) continue;
        await applyClanRole(member, clanRoleForUser(clan, memberId));
    }
}

async function setUserClanState(userId, clanId, role, joinedAt = Date.now()) {
    const user = ensureClanUserFields(await db.getUser(userId));
    user.clan = { id: clanId, role, joinedAt, contribution: 0 };
    user.clanId = clanId;
    await db.saveUser(user);
    return user;
}

async function clearUserClanState(userId) {
    const user = ensureClanUserFields(await db.getUser(userId));
    user.clan = { id: null, role: null, joinedAt: 0, contribution: 0 };
    user.clanId = null;
    await db.saveUser(user);
    return user;
}

async function resolveMemberRoute(member, user) {
    const route = normalizePathValue(getMemberRoute(member, user));
    if (route) return route;
    return normalizePathValue(user.currentRoute);
}

async function createClanFromAdmin(message) {
    if (!message.member?.permissions?.has?.(PermissionFlagsBits.Administrator)) {
        return message.reply(formatError('هذا الأمر للإداريين فقط.', 'This command is admin-only.'));
    }

    const payload = parseAdminCreate(message);
    if (!payload) {
        return message.reply('Usage: `%clan admincreate <@Leader> <@Deputy> "Clan Name" <@Member3> <@Member4> ...`').catch(() => {});
    }

    if (!message.guild) {
        return message.reply(formatError('هذا الأمر يعمل داخل السيرفر فقط.', 'This command only works inside a guild.'));
    }

    if (payload.uniqueIds.length < gameplayCfg.CLAN.minMembers || payload.uniqueIds.length > gameplayCfg.CLAN.maxMembers) {
        return message.reply(formatError(
            `يجب أن يتكون الكلان من ${gameplayCfg.CLAN.minMembers} إلى ${gameplayCfg.CLAN.maxMembers} أعضاء.`,
            `Clan size must be between ${gameplayCfg.CLAN.minMembers} and ${gameplayCfg.CLAN.maxMembers} members.`
        ));
    }

    const fetchedMembers = [];
    for (const memberId of payload.uniqueIds) {
        const member = await message.guild.members.fetch(memberId).catch(() => null);
        if (!member || member.user?.bot) {
            return message.reply(formatError(`تعذر العثور على العضو <@${memberId}>.`, `Could not resolve member <@${memberId}>.`));
        }
        fetchedMembers.push(member);
    }

    const routeMap = new Map();
    for (const member of fetchedMembers) {
        const user = ensureClanUserFields(await db.getUser(member.id));
        const route = await resolveMemberRoute(member, user);
        if (!route) {
            return message.reply(formatError(`العضو <@${member.id}> لم يحدد مساره بعد.`, `Member <@${member.id}> has not selected a path yet.`));
        }
        routeMap.set(member.id, route);
    }

    const routes = new Set(routeMap.values());
    if (routes.size !== 1) {
        return message.reply(formatError('كل الأعضاء يجب أن يكونوا على نفس المسار تماماً.', 'All members must share the exact same starting path.'));
    }

    const pathRoute = [...routes][0];
    if (!['combat', 'scholar', 'atelier', 'merchant'].includes(pathRoute)) {
        return message.reply(formatError('المسار المحدد غير صالح.', 'The selected path is invalid.'));
    }

    for (const member of fetchedMembers) {
        const user = ensureClanUserFields(await db.getUser(member.id));
        if (user.clan?.id) {
            return message.reply(formatError(`العضو <@${member.id}> ينتمي إلى كلان بالفعل.`, `Member <@${member.id}> is already in a clan.`));
        }
    }

    const clanId = `clan_${Date.now()}_${payload.leaderId}`;
    const now = Date.now();
    const clan = {
        id: clanId,
        name: payload.clanName,
        path: pathRoute,
        route: pathRoute,
        leaderId: payload.leaderId,
        deputyId: payload.deputyId,
        members: payload.uniqueIds,
        status: 'active',
        createdAt: now,
        updatedAt: now,
        createdBy: message.author.id
    };

    for (const member of fetchedMembers) {
        const roleKind = member.id === payload.leaderId ? 'leader' : member.id === payload.deputyId ? 'deputy' : 'member';
        await setUserClanState(member.id, clanId, roleKind, now);
    }

    await saveClan(clan);
    await syncClanRoles(message.client, clan);

    return message.reply([
        `✅ Clan created: **${payload.clanName}**`,
        `Path: **${routeLabel(pathRoute)}**`,
        `Leader: <@${payload.leaderId}>`,
        `Deputy: <@${payload.deputyId}>`,
        `Members: **${payload.uniqueIds.length}**`
    ].join('\n')).catch(() => {});
}

async function showClanMenu(message) {
    const user = ensureClanUserFields(await db.getUser(message.author.id));
    const clan = user.clan?.id ? await getClanById(user.clan.id) : await findClanByMemberId(message.author.id);
    const route = await resolveMemberRoute(message.member, user);

    return message.reply({
        embeds: [{
            color: COLORS.PRIMARY,
            title: '🛡️ Clan System',
            description: [
                'Use `%clan admincreate <@Leader> <@Deputy> "Clan Name" <@Member3> ...`.',
                'Use `%clan status`, `%clan list`, `%clan leave`, or `%clan disband` when applicable.',
                '',
                `Your clan: **${clan?.name || '-'}**`,
                `Your role: **${user.clan?.role || '-'}**`,
                `Your path: **${routeLabel(route)}**`,
                `Clan size limit: **${gameplayCfg.CLAN.maxMembers}**`
            ].join('\n'),
            footer: { text: FOOTER_TEXT },
            timestamp: new Date().toISOString()
        }]
    });
}

async function showClanStatus(message) {
    const user = ensureClanUserFields(await db.getUser(message.author.id));
    const clan = user.clan?.id ? await getClanById(user.clan.id) : await findClanByMemberId(message.author.id);

    if (!clan) {
        return message.reply('You are not in a clan.').catch(() => {});
    }

    const roster = clan.members.map((memberId) => `<@${memberId}> (${clanRoleForUser(clan, memberId)})`).join('\n');
    return message.reply({
        embeds: [{
            color: COLORS.INFO,
            title: `🛡️ Clan: ${clan.name}`,
            fields: [
                { name: 'Path', value: routeLabel(clan.path), inline: true },
                { name: 'Leader', value: `<@${clan.leaderId}>`, inline: true },
                { name: 'Deputy', value: clan.deputyId ? `<@${clan.deputyId}>` : '-', inline: true },
                { name: 'Members', value: `${clan.members.length}/${gameplayCfg.CLAN.maxMembers}`, inline: true },
                { name: 'Roster', value: roster || '-', inline: false }
            ],
            footer: { text: FOOTER_TEXT },
            timestamp: new Date().toISOString()
        }]
    });
}

async function removeMemberFromClan(clan, memberId, client, options = {}) {
    const currentClan = normalizeClan(clan);
    if (!currentClan) return null;

    const wasLeader = currentClan.leaderId === memberId;
    const wasDeputy = currentClan.deputyId === memberId;

    currentClan.members = currentClan.members.filter((id) => id !== memberId);

    if (wasLeader) {
        currentClan.leaderId = currentClan.deputyId || currentClan.members[0] || null;
        currentClan.deputyId = currentClan.members.find((id) => id !== currentClan.leaderId) || null;
    } else if (wasDeputy) {
        currentClan.deputyId = currentClan.members.find((id) => id !== currentClan.leaderId) || null;
    }

    await clearUserClanState(memberId);
    currentClan.updatedAt = Date.now();

    for (const remainingId of currentClan.members) {
        const memberUser = ensureClanUserFields(await db.getUser(remainingId));
        memberUser.clan = {
            id: currentClan.id,
            role: clanRoleForUser(currentClan, remainingId),
            joinedAt: memberUser.clan?.joinedAt || currentClan.createdAt || Date.now(),
            contribution: memberUser.clan?.contribution || 0
        };
        memberUser.clanId = currentClan.id;
        await db.saveUser(memberUser);
    }

    if (client && currentClan.members.length) {
        await syncClanRoles(client, currentClan);
    }

    if (!options.skipSave) {
        await saveClan(currentClan);
    }

    return currentClan;
}

async function leaveClan(message) {
    const user = ensureClanUserFields(await db.getUser(message.author.id));
    if (!user.clan?.id) return message.reply('You are not in a clan.').catch(() => {});

    const clan = await getClanById(user.clan.id);
    if (!clan) {
        await clearUserClanState(message.author.id);
        return message.reply('You are not in a clan.').catch(() => {});
    }

    await removeMemberFromClan(clan, message.author.id, message.client);
    return message.reply(`✅ <@${message.author.id}> left clan **${clan.name}**.`).catch(() => {});
}

async function disbandClan(message) {
    const user = ensureClanUserFields(await db.getUser(message.author.id));
    const clan = user.clan?.id ? await getClanById(user.clan.id) : await findClanByMemberId(message.author.id);
    if (!clan) return message.reply('No clan to disband.').catch(() => {});
    if (clan.leaderId !== message.author.id) return message.reply('Only clan leader can disband the clan.').catch(() => {});

    for (const memberId of clan.members) {
        await clearUserClanState(memberId);
    }

    await removeClan(clan.id);
    return message.reply(`✅ Clan **${clan.name}** disbanded.`).catch(() => {});
}

async function runClanMaintenance(client) {
    const store = await readStore();
    const now = Date.now();
    let changed = false;

    for (const clan of store.clans) {
        normalizeClan(clan);
        if (!clan.leaderId || !clan.deputyId) continue;

        const leader = ensureClanUserFields(await db.getUser(clan.leaderId));
        const lastActiveAt = Number(leader.lastActiveAt || 0);
        if (!lastActiveAt) continue;

        if (now - lastActiveAt < gameplayCfg.CLAN.founderAbsenceDays * DAY_MS) continue;

        const deputyId = clan.deputyId;
        if (!deputyId) continue;

        clan.members = clan.members.filter((id) => id !== clan.leaderId);
        if (!clan.members.includes(deputyId)) clan.members.unshift(deputyId);
        clan.leaderId = deputyId;
        clan.deputyId = clan.members.find((id) => id !== clan.leaderId) || null;
        clan.updatedAt = now;
        changed = true;

        leader.clan = { id: clan.id, role: 'member', joinedAt: leader.clan?.joinedAt || now, contribution: leader.clan?.contribution || 0 };
        leader.clanId = clan.id;
        await db.saveUser(leader);

        const deputy = ensureClanUserFields(await db.getUser(deputyId));
        deputy.clan = { id: clan.id, role: 'leader', joinedAt: deputy.clan?.joinedAt || now, contribution: deputy.clan?.contribution || 0 };
        deputy.clanId = clan.id;
        await db.saveUser(deputy);

        for (const memberId of clan.members) {
            if (memberId === deputyId) continue;
            const member = ensureClanUserFields(await db.getUser(memberId));
            member.clan = {
                id: clan.id,
                role: 'member',
                joinedAt: member.clan?.joinedAt || now,
                contribution: member.clan?.contribution || 0
            };
            member.clanId = clan.id;
            await db.saveUser(member);
        }

        await syncClanRoles(client, clan);
    }

    if (changed) {
        await writeStore(store);
    }
}

async function handleFighterDeath(userId, client = null) {
    const user = ensureClanUserFields(await db.getUser(userId));
    const clanId = user.clan?.id || null;
    const clan = clanId ? await getClanById(clanId) : null;

    user.level = 0;
    user.xp = 0;
    user.currentRoute = null;
    user.currentSpecialty = null;
    user.specialties = { combat: null, scholar: null, atelier: null, merchant: null };
    user.completedRoutes = [];
    user.prestigeRoles = [];
    user.prestigeCount = 0;
    user.rebirthCount = 0;
    user.pendingFinalRestoreRoute = '';
    user.hp = 0;
    user.clan = { id: null, role: null, joinedAt: 0, contribution: 0 };
    user.clanId = null;
    await db.saveUser(user);

    if (clan) {
        await removeMemberFromClan(clan, userId, client, { skipSave: false });
    }

    if (client?.guilds) {
        const guild = client.guilds.cache.first() || await client.guilds.fetch().then((collection) => collection.first()).catch(() => null);
        const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
        if (member) {
            await member.roles.remove(Object.values(gameplayCfg.CLAN_ROLES).filter(Boolean)).catch(() => {});
        }
    }

    return true;
}

async function handleClanCommand(message, args = []) {
    const action = String(args[0] || 'menu').toLowerCase();

    if (action === 'admincreate') return createClanFromAdmin(message);
    if (action === 'menu' || action === 'help') return showClanMenu(message);
    if (action === 'status') return showClanStatus(message);
    if (action === 'leave') return leaveClan(message);
    if (action === 'disband') return disbandClan(message);

    if (action === 'list') {
        const store = await readStore();
        const clans = store.clans.map((clan) => `• **${clan.name}** | ${routeLabel(clan.path)} | ${clan.members.length}/${gameplayCfg.CLAN.maxMembers}`);
        return message.reply(clans.length ? clans.join('\n') : 'No clans created yet.').catch(() => {});
    }

    return message.reply('Usage: `%clan [admincreate|menu|status|leave|list|disband]`').catch(() => {});
}

module.exports = {
    ensureClanUserFields,
    handleClanCommand,
    getClanById,
    findClanByMemberId,
    runClanMaintenance,
    handleFighterDeath,
    removeMemberFromClan,
    saveClan,
    readStore
};