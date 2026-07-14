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
        return parsed && typeof parsed === 'object' ? parsed : { clans: [] };
    } catch {
        return { clans: [] };
    }
}

async function writeStore(store) {
    await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function ensureClanUserFields(user) {
    if (!user.clan || typeof user.clan !== 'object') {
        user.clan = { id: null, role: null, joinedAt: 0, contribution: 0 };
    }
    if (user.clan.id === undefined) user.clan.id = null;
    if (user.clan.role === undefined) user.clan.role = null;
    if (user.clan.joinedAt === undefined) user.clan.joinedAt = 0;
    if (user.clan.contribution === undefined) user.clan.contribution = 0;
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
    clan.members = Array.isArray(clan.members) ? clan.members : [];
    clan.status = clan.status || 'active';
    clan.path = clan.path || clan.route || null;
    clan.route = clan.route || clan.path || null;
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
    const normalized = normalizeClan(clan);
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

function getMemberRoute(member, user) {
    return progressionService.getRouteLevelInfo(member).route || user.currentRoute || null;
}

function parseAdminCreate(message) {
    const match = String(message.content || '').match(/^%clan\s+admincreate\s+<@!?([0-9]+)>\s+<@!?([0-9]+)>\s+"([^"]+)"\s*(.*)$/i);
    if (!match) return null;

    const [, leaderId, deputyId, clanName, remainder] = match;
    const memberIds = [...String(remainder || '').matchAll(/<@!?([0-9]+)>/g)].map((item) => item[1]);
    const ids = [leaderId, deputyId, ...memberIds];
    const uniqueIds = [...new Set(ids)];

    return {
        leaderId,
        deputyId,
        clanName: clanName.trim(),
        memberIds,
        uniqueIds
    };
}

async function syncClanRoles(member, roleKind) {
    if (!member?.roles) return;

    const clanRoleIds = Object.values(gameplayCfg.CLAN_ROLES).filter(Boolean);
    for (const roleId of clanRoleIds) {
        if (member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId).catch(() => {});
        }
    }

    const targetRoleId = gameplayCfg.CLAN_ROLES[roleKind];
    if (targetRoleId) {
        await member.roles.add(targetRoleId).catch(() => {});
    }
}

async function pushClanRoleState(client, clan) {
    if (!client?.guilds) return;
    const guild = client.guilds.cache.first() || await client.guilds.fetch().then((col) => col.first()).catch(() => null);
    if (!guild) return;

    for (const memberId of clan.members) {
        const member = await guild.members.fetch(memberId).catch(() => null);
        if (!member) continue;
        await syncClanRoles(member, clanRoleForUser(clan, memberId));
    }
}

async function setUserClanState(userId, clanId, role) {
    const user = ensureClanUserFields(await db.getUser(userId));
    user.clan = { id: clanId, role, joinedAt: Date.now(), contribution: 0 };
    await db.saveUser(user);
    return user;
}

async function clearUserClanState(userId) {
    const user = ensureClanUserFields(await db.getUser(userId));
    user.clan = { id: null, role: null, joinedAt: 0, contribution: 0 };
    await db.saveUser(user);
    return user;
}

async function createClanFromAdmin(message) {
    const payload = parseAdminCreate(message);
    if (!payload) {
        return message.reply('Usage: `%clan admincreate <@Leader> <@Deputy> "Clan Name" <@Member3> <@Member4> ...`').catch(() => {});
    }

    if (!message.member?.permissions?.has?.(PermissionFlagsBits.Administrator)) {
        return message.reply(formatError('هذا الأمر للإداريين فقط.', 'This command is admin-only.'));
    }

    const guild = message.guild;
    if (!guild) {
        return message.reply(formatError('هذا الأمر يعمل داخل السيرفر فقط.', 'This command only works inside a guild.'));
    }

    const totalMembers = payload.uniqueIds.length;
    if (totalMembers < 5 || totalMembers > 12) {
        return message.reply(formatError('يجب أن يتكون الكلان من 5 إلى 12 عضوًا.', 'Clan size must be between 5 and 12 members.'));
    }

    const fetchedMembers = [];
    for (const memberId of payload.uniqueIds) {
        const member = await guild.members.fetch(memberId).catch(() => null);
        if (!member || member.user?.bot) {
            return message.reply(formatError(`تعذر العثور على العضو <@${memberId}>.`, `Could not resolve member <@${memberId}>.`));
        }
        fetchedMembers.push(member);
    }

    const routes = new Set(fetchedMembers.map((member) => getMemberRoute(member, ensureClanUserFields({ currentRoute: null }))));
    if (routes.has(null) || routes.size !== 1) {
        return message.reply(formatError('كل الأعضاء يجب أن يكونوا على نفس المسار تمامًا.', 'All members must be on the exact same starting path.'));
    }

    const path = [...routes][0];
    if (!['combat', 'scholar'].includes(path)) {
        return message.reply(formatError('الكلانات المدارة هنا مدعومة للمقاتل أو الباحث فقط.', 'Admin-managed clans are supported for Combat or Scholar routes only.'));
    }

    for (const member of fetchedMembers) {
        const user = ensureClanUserFields(await db.getUser(member.id));
        if (user.clan?.id) {
            return message.reply(formatError(`العضو <@${member.id}> ينتمي إلى كلان بالفعل.`, `Member <@${member.id}> is already in a clan.`));
        }
    }

    const clanId = `clan_${Date.now()}_${payload.leaderId}`;
    const clan = {
        id: clanId,
        name: payload.clanName,
        path,
        route: path,
        leaderId: payload.leaderId,
        deputyId: payload.deputyId,
        members: payload.uniqueIds,
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: message.author.id
    };

    for (const member of fetchedMembers) {
        const roleKind = member.id === payload.leaderId ? 'leader' : member.id === payload.deputyId ? 'deputy' : 'member';
        await setUserClanState(member.id, clanId, roleKind);
    }

    await saveClan(clan);
    await pushClanRoleState(message.client, clan);

    return message.reply([
        `✅ Clan created: **${payload.clanName}**`,
        `Path: **${routeLabel(path)}**`,
        `Leader: <@${payload.leaderId}>`,
        `Deputy: <@${payload.deputyId}>`,
        `Members: **${payload.uniqueIds.length}**`
    ].join('\n')).catch(() => {});
}

async function showClanMenu(message) {
    const user = ensureClanUserFields(await db.getUser(message.author.id));
    const clan = user.clan?.id ? await getClanById(user.clan.id) : await findClanByMemberId(message.author.id);

    const lines = [
        'Use `%clan admincreate <@Leader> <@Deputy> "Clan Name" <@Member3> ...`.',
        'Use `%clan status`, `%clan list`, `%clan leave`, or `%clan disband` when applicable.',
        '',
        `Your clan: **${clan?.name || '-'}**`,
        `Your role: **${user.clan?.role || '-'}**`,
        `Your route: **${routeLabel(getMemberRoute(message.member, user))}**`,
        `Clan size limit: **${gameplayCfg.CLAN.maxMembers}**`
    ];

    return message.reply({
        embeds: [
            {
                color: COLORS.PRIMARY,
                title: '🛡️ Clan System',
                description: lines.join('\n'),
                footer: { text: FOOTER_TEXT },
                timestamp: new Date().toISOString()
            }
        ]
    });
}

async function showClanStatus(message) {
    const user = ensureClanUserFields(await db.getUser(message.author.id));
    const clan = user.clan?.id ? await getClanById(user.clan.id) : await findClanByMemberId(message.author.id);

    if (!clan) {
        return message.reply('You are not in a clan.').catch(() => {});
    }

    const summary = clan.members.map((memberId) => `<@${memberId}> (${clanRoleForUser(clan, memberId)})`).join('\n');
    return message.reply({
        embeds: [
            {
                color: COLORS.INFO,
                title: `🛡️ Clan: ${clan.name}`,
                fields: [
                    { name: 'Path', value: routeLabel(clan.path), inline: true },
                    { name: 'Leader', value: `<@${clan.leaderId}>`, inline: true },
                    { name: 'Deputy', value: clan.deputyId ? `<@${clan.deputyId}>` : '-', inline: true },
                    { name: 'Members', value: `${clan.members.length}/${gameplayCfg.CLAN.maxMembers}`, inline: true },
                    { name: 'Roster', value: summary || '-', inline: false }
                ],
                footer: { text: FOOTER_TEXT },
                timestamp: new Date().toISOString()
            }
        ]
    });
}

async function leaveClan(message) {
    const user = ensureClanUserFields(await db.getUser(message.author.id));
    if (!user.clan?.id) return message.reply('You are not in a clan.').catch(() => {});

    const clan = await getClanById(user.clan.id);
    if (!clan) {
        await clearUserClanState(message.author.id);
        return message.reply('You are not in a clan.').catch(() => {});
    }

    await removeMemberFromClan(clan, message.author.id, message.client, { silent: true });
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

async function removeMemberFromClan(clan, memberId, client, options = {}) {
    const index = clan.members.indexOf(memberId);
    if (index !== -1) clan.members.splice(index, 1);

    const wasLeader = clan.leaderId === memberId;
    const wasDeputy = clan.deputyId === memberId;

    if (wasLeader) {
        clan.leaderId = clan.deputyId || clan.members[0] || null;
        clan.deputyId = clan.members.find((id) => id !== clan.leaderId) || null;
    } else if (wasDeputy) {
        clan.deputyId = clan.members.find((id) => id !== clan.leaderId) || null;
    }

    await clearUserClanState(memberId);
    clan.updatedAt = Date.now();

    for (const remainingId of clan.members) {
        const role = clanRoleForUser(clan, remainingId);
        const memberUser = ensureClanUserFields(await db.getUser(remainingId));
        memberUser.clan = {
            id: clan.id,
            role,
            joinedAt: memberUser.clan?.joinedAt || clan.createdAt || Date.now(),
            contribution: memberUser.clan?.contribution || 0
        };
        await db.saveUser(memberUser);
    }

    if (client && clan.members.length) {
        await pushClanRoleState(client, clan);
    }

    await saveClan(clan);
    if (!options.silent) return clan;
    return clan;
}

async function runClanMaintenance(client) {
    const store = await readStore();
    const now = Date.now();

    for (const clan of store.clans) {
        normalizeClan(clan);
        if (!clan.leaderId || !clan.deputyId) continue;

        const leader = ensureClanUserFields(await db.getUser(clan.leaderId));
        const lastActiveAt = Number(leader.lastActiveAt || leader.clan?.joinedAt || clan.createdAt || 0);
        if (!lastActiveAt) continue;

        const inactiveFor = now - lastActiveAt;
        if (inactiveFor < gameplayCfg.CLAN.founderAbsenceDays * DAY_MS) continue;

        const deputyId = clan.deputyId;
        clan.members = clan.members.filter((id) => id !== clan.leaderId);
        clan.members = [...new Set([deputyId, ...clan.members])];
        clan.leaderId = deputyId;
        clan.deputyId = clan.members.find((id) => id !== clan.leaderId) || null;
        clan.updatedAt = now;

        leader.clan = { id: clan.id, role: 'member', joinedAt: leader.clan?.joinedAt || now, contribution: leader.clan?.contribution || 0 };
        await db.saveUser(leader);

        const deputy = ensureClanUserFields(await db.getUser(deputyId));
        deputy.clan = { id: clan.id, role: 'leader', joinedAt: deputy.clan?.joinedAt || now, contribution: deputy.clan?.contribution || 0 };
        await db.saveUser(deputy);

        for (const memberId of clan.members) {
            if (memberId === deputyId) continue;
            const member = ensureClanUserFields(await db.getUser(memberId));
            member.clan = { id: clan.id, role: 'member', joinedAt: member.clan?.joinedAt || now, contribution: member.clan?.contribution || 0 };
            await db.saveUser(member);
        }

        await saveClan(clan);
        await pushClanRoleState(client, clan);
    }
}

async function applyFighterDeathPenalty(userId, client) {
    const user = ensureClanUserFields(await db.getUser(userId));
    const guild = client?.guilds?.cache?.first() || null;
    const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
    const route = progressionService.getRouteLevelInfo(member).route || user.currentRoute;
    if (route !== 'combat' && user.currentRoute !== 'combat') return false;

    const clanId = user.clan?.id || null;
    const clan = clanId ? await getClanById(clanId) : null;

    user.level = 0;
    user.xp = 0;
    user.currentRoute = null;
    user.currentSpecialty = null;
    user.specialties = { combat: null, scholar: user.specialties?.scholar || null, atelier: user.specialties?.atelier || null, merchant: user.specialties?.merchant || null };
    user.completedRoutes = [];
    user.prestigeRoles = [];
    user.prestigeCount = 0;
    user.rebirthCount = 0;
    user.pendingFinalRestoreRoute = '';
    await db.saveUser(user);

    if (!clan) return true;

    await removeMemberFromClan(clan, userId, client, { silent: true });

    if (member) {
        await member.roles.remove(Object.values(gameplayCfg.CLAN_ROLES).filter(Boolean)).catch(() => {});
    }

    return true;
}

async function handleClanCommand(message, args = []) {
    const action = String(args[0] || 'menu').toLowerCase();

    if (action === 'admincreate') {
        return createClanFromAdmin(message);
    }

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
    applyFighterDeathPenalty,
    removeMemberFromClan,
    saveClan,
    readStore
};