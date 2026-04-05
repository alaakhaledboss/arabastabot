const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../db');
const cfg = require('../config/progressionConfig');

function toTitle(value) {
    const str = String(value || '');
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

function ensureProgressFields(user) {
    user.currentRoute = user.currentRoute || null;
    user.currentSpecialty = user.currentSpecialty || null;
    user.specialties = user.specialties && typeof user.specialties === 'object'
        ? user.specialties
        : { combat: null, scholar: null, atelier: null, merchant: null };

        for (const route of cfg.ROUTES) {
            if (user.specialties[route] === undefined) user.specialties[route] = null;
        }

    if (!Array.isArray(user.completedRoutes)) user.completedRoutes = [];
    if (!Array.isArray(user.prestigeRoles)) user.prestigeRoles = [];
    if (typeof user.prestigeCount !== 'number') user.prestigeCount = user.prestigeRoles.length || 0;
    if (typeof user.rebirthCount !== 'number') user.rebirthCount = 0;
    if (typeof user.pendingFinalRestoreRoute !== 'string') user.pendingFinalRestoreRoute = '';

    return user;
}

function normalizeRoute(input) {
    const key = String(input || '').trim().toLowerCase();
    return cfg.ROUTES.includes(key) ? key : null;
}

function normalizeSpecialty(route, input) {
    if (!route || !cfg.SPECIALTY_ROLE_IDS[route]) return null;
    const key = String(input || '').trim().toLowerCase();
    return cfg.SPECIALTY_ROLE_IDS[route][key] ? key : null;
}

function memberHasRole(member, roleId) {
    if (!member || !roleId) return false;
    return member.roles?.cache?.has(roleId) || false;
}

function isVerifiedMember(member) {
    return memberHasRole(member, cfg.VERIFIED_ROLE_ID);
}

function routeFromMemberRoles(member) {
    if (!member?.roles?.cache) return null;

    for (const route of cfg.ROUTES) {
        const ids = cfg.ROUTE_LEVEL_ROLE_IDS[route] || [];
        if (ids.some((id) => member.roles.cache.has(id))) {
            return route;
        }
    }

    return null;
}

function getRouteLevelInfo(member) {
    if (!member?.roles?.cache) {
        return { route: null, levelName: null, levelIndex: -1 };
    }

    for (const route of cfg.ROUTES) {
        const ids = cfg.ROUTE_LEVEL_ROLE_IDS[route] || [];
        const labels = cfg.ROUTE_LEVEL_LABELS?.[route] || [];

        for (let i = ids.length - 1; i >= 0; i -= 1) {
            if (member.roles.cache.has(ids[i])) {
                return {
                    route,
                    levelName: labels[i] || `level_${i + 1}`,
                    levelIndex: i
                };
            }
        }
    }

    return { route: null, levelName: null, levelIndex: -1 };
}

function specialtiesFromMemberRoles(member) {
    const out = { combat: null, scholar: null, atelier: null, merchant: null };
    if (!member?.roles?.cache) return out;

    for (const route of cfg.ROUTES) {
        const specialties = cfg.SPECIALTY_ROLE_IDS[route] || {};
        for (const [name, roleId] of Object.entries(specialties)) {
            if (roleId && member.roles.cache.has(roleId)) {
                out[route] = name;
                break;
            }
        }
    }

    return out;
}

function getRouteForRouteChannel(channelId) {
    for (const route of cfg.ROUTES) {
        if (cfg.ROUTE_CHANNEL_IDS[route] === channelId) return route;
    }
    return null;
}

async function addRole(member, roleId) {
    if (!member || !roleId) return;
    if (member.roles.cache.has(roleId)) return;
    await member.roles.add(roleId).catch((err) => {
        console.error(`[progression] failed to add role ${roleId} to ${member.id}:`, err?.message || err);
    });
}

async function removeRole(member, roleId) {
    if (!member || !roleId) return;
    if (!member.roles.cache.has(roleId)) return;
    await member.roles.remove(roleId).catch((err) => {
        console.error(`[progression] failed to remove role ${roleId} from ${member.id}:`, err?.message || err);
    });
}

async function setRouteLevelRoles(member, targetRoute) {
    // Remove all route level roles, then add the first level of target route.
    for (const route of cfg.ROUTES) {
        for (const roleId of (cfg.ROUTE_LEVEL_ROLE_IDS[route] || [])) {
            await removeRole(member, roleId);
        }
    }

    const firstRole = cfg.ROUTE_LEVEL_ROLE_IDS[targetRoute]?.[0];
    if (firstRole) {
        await addRole(member, firstRole);
    }
}

async function setPrestigeTierRole(member, tierCount) {
    for (const roleId of cfg.PRESTIGE_TIER_ROLE_IDS) {
        await removeRole(member, roleId);
    }

    const roleId = cfg.PRESTIGE_TIER_ROLE_IDS[tierCount - 1];
    if (roleId) {
        await addRole(member, roleId);
    }
}

async function grantRebirthRole(member, rebirthCount) {
    const roleId = cfg.REBIRTH_ROLE_IDS[rebirthCount - 1];
    if (!roleId) return;
    await addRole(member, roleId);
}

async function updateSpecialtyChannelVisibility(member, user) {
    if (!member?.guild || !member.id) return;

    for (const route of cfg.ROUTES) {
        const channelId = cfg.SPECIALTY_CHANNEL_IDS[route];
        if (!channelId) continue;

        const channel = member.guild.channels.cache.get(channelId)
            || await member.guild.channels.fetch(channelId).catch(() => null);
        if (!channel || !channel.permissionOverwrites) continue;

        const shouldView = user.currentRoute === route && !user.specialties[route];

        await channel.permissionOverwrites.edit(member.id, {
            ViewChannel: shouldView
        }).catch((err) => {
            console.error(`[progression] channel visibility update failed for ${member.id} in ${channelId}:`, err?.message || err);
        });
    }
}

async function syncMemberState(member, { allowRestoreFromDb = false } = {}) {
    if (!member || !member.id) return null;

    const user = ensureProgressFields(await db.getUser(member.id));
    const verified = isVerifiedMember(member);

    if (!verified) {
        // System ignores unverified users.
        await db.saveUser(user);
        return user;
    }

    let detectedRoute = routeFromMemberRoles(member);
    const detectedSpecialties = specialtiesFromMemberRoles(member);

    // Restore route role from DB if user rejoined and has verified role but no route roles.
    if (!detectedRoute && allowRestoreFromDb && user.currentRoute && cfg.ROUTES.includes(user.currentRoute)) {
        await setRouteLevelRoles(member, user.currentRoute);
        detectedRoute = user.currentRoute;
    }

    if (detectedRoute !== user.currentRoute) {
        user.currentRoute = detectedRoute;
    }

    for (const route of cfg.ROUTES) {
        user.specialties[route] = detectedSpecialties[route] || null;
    }

    user.currentSpecialty = user.currentRoute ? (user.specialties[user.currentRoute] || null) : null;

    // If final role exists on Discord, keep DB pending restore clear.
    if (memberHasRole(member, cfg.FINAL_COMPLETION_ROLE)) {
        user.pendingFinalRestoreRoute = '';
    }

    await updateSpecialtyChannelVisibility(member, user);
    await db.saveUser(user);
    return user;
}

async function getXpMultiplierForMessage(message) {
    const member = message.member;
    if (!member) return 1;
    if (!isVerifiedMember(member)) return 1;

    const route = routeFromMemberRoles(member);
    if (!route) return 1;

    const routeChannelId = cfg.ROUTE_CHANNEL_IDS[route];
    if (routeChannelId && message.channelId === routeChannelId) {
        return 1.5;
    }

    return 1;
}

function canAfford(user, cost) {
    const gold = Number(user.gold || 0);
    const gems = Number(user.gems || 0);
    const honor = Number(user.honor || 0);

    return gold >= (cost.gold || 0)
        && gems >= (cost.gems || 0)
        && honor >= (cost.honor || 0);
}

function applyCost(user, cost) {
    user.gold = Number(user.gold || 0) - Number(cost.gold || 0);
    user.gems = Number(user.gems || 0) - Number(cost.gems || 0);
    user.honor = Number(user.honor || 0) - Number(cost.honor || 0);
}

async function handleSpecialtySelection(message, args) {
    const member = message.member;
    if (!member || !message.guild) return 'This command can only be used in a server.';
    if (!isVerifiedMember(member)) return 'You must be verified to use progression commands.';

    const user = await syncMemberState(member);
    const route = user.currentRoute;
    if (!route) return 'You do not have a valid route level role.';

    if (message.channelId !== cfg.SPECIALTY_CHANNEL_IDS[route]) {
        return `Use this command in your route specialty channel only.`;
    }

    if (Number(user.level || 1) < cfg.LEVEL_GATES.specialty) {
        return `Specialty unlocks at level ${cfg.LEVEL_GATES.specialty}.`;
    }

    if (user.specialties[route]) {
        return `You already selected **${user.specialties[route]}** for route **${route}**.`;
    }

    const requested = normalizeSpecialty(route, args[0]);
    if (!requested) {
        const options = Object.keys(cfg.SPECIALTY_ROLE_IDS[route]).join(', ');
        return `Usage: \`%specialty <name>\`\nAvailable for **${route}**: ${options}`;
    }

    const roleId = cfg.SPECIALTY_ROLE_IDS[route][requested];
    if (!roleId) return 'Specialty role is not configured.';

    await addRole(member, roleId);

    user.specialties[route] = requested;
    user.currentSpecialty = requested;

    if (user.pendingFinalRestoreRoute && user.pendingFinalRestoreRoute === route) {
        await addRole(member, cfg.FINAL_COMPLETION_ROLE);
        user.pendingFinalRestoreRoute = '';
    }

    await updateSpecialtyChannelVisibility(member, user);
    await db.saveUser(user);

    return `✅ Specialty selected: **${requested}** for route **${route}**.`;
}

async function handlePrestige(message, args) {
    const member = message.member;
    if (!member || !message.guild) return 'This command can only be used in a server.';
    if (!isVerifiedMember(member)) return 'You must be verified to use progression commands.';

    if (message.channelId !== cfg.PRESTIGE_CHANNEL_ID) {
        return 'Use this command in the prestige channel only.';
    }

    const user = await syncMemberState(member);

    if (Number(user.level || 1) < cfg.LEVEL_GATES.prestige) {
        return `Prestige unlocks at level ${cfg.LEVEL_GATES.prestige}.`;
    }

    if (Number(user.prestigeCount || 0) >= cfg.LIMITS.maxPrestige) {
        return `Prestige is no longer available after ${cfg.LIMITS.maxPrestige} prestiges.`;
    }

    const currentRoute = user.currentRoute;
    if (!currentRoute) return 'Could not detect your current route from roles.';

    const targetRoute = normalizeRoute(args[0]);
    if (!targetRoute) {
        return `Usage: \`%prestige <combat|scholar|atelier|merchant>\``;
    }

    if (targetRoute === currentRoute) {
        return 'You must choose a different route than your current one.';
    }

    if (!canAfford(user, cfg.COSTS.prestige)) {
        const c = cfg.COSTS.prestige;
        return `Not enough currency. Required: ${c.gold} gold, ${c.gems} gems, ${c.honor} honor.`;
    }

    applyCost(user, cfg.COSTS.prestige);

    if (!user.completedRoutes.includes(currentRoute)) {
        user.completedRoutes.push(currentRoute);
    }

    user.prestigeCount += 1;
    user.prestigeRoles.push(`tier_${user.prestigeCount}`);

    user.level = 1;
    user.xp = 0;

    user.currentRoute = targetRoute;
    user.currentSpecialty = user.specialties[targetRoute] || null;

    await setRouteLevelRoles(member, targetRoute);
    await setPrestigeTierRole(member, user.prestigeCount);

    if (user.prestigeCount >= cfg.LIMITS.maxPrestige) {
        await addRole(member, cfg.FINAL_COMPLETION_ROLE);
    }

    await updateSpecialtyChannelVisibility(member, user);
    await db.saveUser(user);

    return `✅ Prestige successful. New route: **${targetRoute}**. Level reset to 1, XP reset to 0.`;
}

async function handleRebirth(message, args) {
    const member = message.member;
    if (!member || !message.guild) return 'This command can only be used in a server.';
    if (!isVerifiedMember(member)) return 'You must be verified to use progression commands.';

    if (message.channelId !== cfg.REBIRTH_CHANNEL_ID) {
        return 'Use this command in the rebirth channel only.';
    }

    if (!memberHasRole(member, cfg.FINAL_COMPLETION_ROLE)) {
        return 'Rebirth is unlocked only for users with the final completion role.';
    }

    const user = await syncMemberState(member);
    const targetRoute = normalizeRoute(args[0]);

    if (!targetRoute) {
        return `Usage: \`%rebirth <combat|scholar|atelier|merchant>\``;
    }

    if (!user.completedRoutes.includes(targetRoute)) {
        return `You can only rebirth into a previously completed route.`;
    }

    if (!canAfford(user, cfg.COSTS.rebirth)) {
        const c = cfg.COSTS.rebirth;
        return `Not enough currency. Required: ${c.gold} gold and ${c.gems} gems.`;
    }

    applyCost(user, cfg.COSTS.rebirth);

    // Reset level progression
    user.level = 1;
    user.xp = 0;

    // Remove specialty only for target route
    const oldSpecialty = user.specialties[targetRoute];
    if (oldSpecialty) {
        const roleId = cfg.SPECIALTY_ROLE_IDS[targetRoute]?.[oldSpecialty];
        if (roleId) await removeRole(member, roleId);
    }
    user.specialties[targetRoute] = null;

    user.currentRoute = targetRoute;
    user.currentSpecialty = null;

    // Temporarily remove final role and restore after picking specialty again.
    await removeRole(member, cfg.FINAL_COMPLETION_ROLE);
    user.pendingFinalRestoreRoute = targetRoute;

    user.rebirthCount += 1;
    await grantRebirthRole(member, user.rebirthCount);

    await setRouteLevelRoles(member, targetRoute);

    await updateSpecialtyChannelVisibility(member, user);
    await db.saveUser(user);

    return `✅ Rebirth complete. Route set to **${targetRoute}**. Level reset to 1 and XP reset to 0.`;
}

async function showProgressionStatus(message, args) {
    const targetId = args?.[0]?.replace(/<@!?|>/g, '') || message.author.id;
    const member = await message.guild.members.fetch(targetId).catch(() => null);
    if (!member) return 'User not found in this server.';

    const user = ensureProgressFields(await db.getUser(targetId));
    const route = routeFromMemberRoles(member) || user.currentRoute || 'none';
    const verified = isVerifiedMember(member);

    const specialties = cfg.ROUTES
        .map((r) => `${r}: ${user.specialties[r] || '-'}`)
        .join('\n');

    return [
        `📌 **Progression Status** for <@${targetId}>`,
        `Verified: **${verified ? 'Yes' : 'No'}**`,
        `Current Route: **${route}**`,
        `Current Specialty: **${user.currentSpecialty || '-'}**`,
        `Prestige Count: **${user.prestigeCount || 0}/${cfg.LIMITS.maxPrestige}**`,
        `Rebirth Count: **${user.rebirthCount || 0}**`,
        `Completed Routes: **${user.completedRoutes.join(', ') || '-'}**`,
        `Pending Final Restore Route: **${user.pendingFinalRestoreRoute || '-'}**`,
        '',
        '**Specialties by Route:**',
        specialties
    ].join('\n');
}

function buildSpecialtyButtons(route, userId) {
    const entries = Object.keys(cfg.SPECIALTY_ROLE_IDS[route] || {});
    const row = new ActionRowBuilder();
    for (const specialty of entries.slice(0, 3)) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`progression:specialty:${route}:${specialty}:${userId}`)
                .setLabel(toTitle(specialty))
                .setStyle(ButtonStyle.Success)
        );
    }
    return [row];
}

function buildRouteButtons(prefix, routes, userId, disabledRoute = null) {
    const row = new ActionRowBuilder();
    for (const route of routes.slice(0, 4)) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`progression:${prefix}:${route}:${userId}`)
                .setLabel(toTitle(route))
                .setStyle(ButtonStyle.Primary)
                .setDisabled(disabledRoute === route)
        );
    }
    return [row];
}

async function sendSpecialtySelectionEmbed(message, args = []) {
    const member = message.member;
    if (!member || !message.guild) return message.reply('This command can only be used in a server.');

    const user = await syncMemberState(member);
    const currentRoute = user.currentRoute;
    const requestedRoute = normalizeRoute(args[0]) || currentRoute;

    if (!requestedRoute) {
        return message.reply('Usage: `%speciality <combat|scholar|atelier|merchant>`');
    }

    const embed = new EmbedBuilder()
        .setColor('#00BFA6')
        .setTitle(`🧭 ${toTitle(requestedRoute)} Specialty Selection`)
        .setDescription('Choose one specialty via buttons below.\nValidation happens when you click a button.')
        .addFields({
            name: 'Options',
            value: Object.keys(cfg.SPECIALTY_ROLE_IDS[requestedRoute] || {}).map((s) => `• ${toTitle(s)}`).join('\n') || 'No specialties configured.'
        })
        .setFooter({ text: `Requested by ${message.author.tag}` });

    return message.reply({
        embeds: [embed],
        components: buildSpecialtyButtons(requestedRoute, message.author.id)
    });
}

async function sendPrestigeSelectionEmbed(message) {
    const member = message.member;
    if (!member || !message.guild) return message.reply('This command can only be used in a server.');

    const user = await syncMemberState(member);
    const currentRoute = user.currentRoute;

    const c = cfg.COSTS.prestige;
    const embed = new EmbedBuilder()
        .setColor('#F59E0B')
        .setTitle('👑 Prestige Shift')
        .setDescription('Choose your next route.\nValidation happens when you click a button.')
        .addFields(
            { name: 'Current Route', value: `**${toTitle(currentRoute || 'unknown')}**`, inline: true },
            { name: 'Cost', value: `${c.gold} gold • ${c.gems} gems • ${c.honor} honor`, inline: true }
        )
        .setFooter({ text: `Requested by ${message.author.tag}` });

    return message.reply({
        embeds: [embed],
        components: buildRouteButtons('prestige', cfg.ROUTES, message.author.id, currentRoute)
    });
}

async function sendRebirthSelectionEmbed(message) {
    const member = message.member;
    if (!member || !message.guild) return message.reply('This command can only be used in a server.');

    await syncMemberState(member);

    const c = cfg.COSTS.rebirth;
    const embed = new EmbedBuilder()
        .setColor('#8B5CF6')
        .setTitle('🔥 Rebirth Selection')
        .setDescription('Choose one route as rebirth target.\nValidation happens when you click a button.')
        .addFields(
            { name: 'Routes', value: cfg.ROUTES.map((r) => toTitle(r)).join(', '), inline: true },
            { name: 'Cost', value: `${c.gold} gold • ${c.gems} gems`, inline: true }
        )
        .setFooter({ text: `Requested by ${message.author.tag}` });

    return message.reply({
        embeds: [embed],
        components: buildRouteButtons('rebirth', cfg.ROUTES, message.author.id)
    });
}

async function runActionFromButton(interaction, action, targetRoute, specialty, ownerId) {
    // Progression panel actions are public; all prerequisite validation is handled
    // in the action handlers at click time.

    if (action === 'specialty') {
        const reply = await handleSpecialtySelection({
            member: interaction.member,
            guild: interaction.guild,
            channelId: cfg.SPECIALTY_CHANNEL_IDS[targetRoute],
            author: interaction.user
        }, [specialty]);
        await interaction.reply({ content: reply, ephemeral: true });
        return true;
    }

    if (action === 'prestige') {
        const reply = await handlePrestige({
            member: interaction.member,
            guild: interaction.guild,
            channelId: cfg.PRESTIGE_CHANNEL_ID,
            author: interaction.user
        }, [targetRoute]);
        await interaction.reply({ content: reply, ephemeral: true });
        return true;
    }

    if (action === 'rebirth') {
        const reply = await handleRebirth({
            member: interaction.member,
            guild: interaction.guild,
            channelId: cfg.REBIRTH_CHANNEL_ID,
            author: interaction.user
        }, [targetRoute]);
        await interaction.reply({ content: reply, ephemeral: true });
        return true;
    }

    await interaction.reply({ content: 'Unknown progression action.', ephemeral: true });
    return true;
}

async function handleButtonInteraction(interaction) {
    const parts = String(interaction.customId || '').split(':');
    const system = parts[0];
    if (system !== 'progression') return false;

    const action = parts[1];
    const targetRoute = normalizeRoute(parts[2]);
    const maybeSpecialty = parts[3];
    const ownerId = action === 'specialty' ? parts[4] : parts[3];
    const specialty = action === 'specialty' ? normalizeSpecialty(targetRoute, maybeSpecialty) : null;

    try {
        return await runActionFromButton(interaction, action, targetRoute, specialty, ownerId);
    } catch (err) {
        console.error('progression button error:', err);
        await interaction.reply({ content: 'Progression action failed. Please try again.', ephemeral: true }).catch(() => {});
        return true;
    }
}

module.exports = {
    normalizeRoute,
    getXpMultiplierForMessage,
    syncMemberState,
    getRouteLevelInfo,
    handleSpecialtySelection,
    handlePrestige,
    handleRebirth,
    showProgressionStatus,
    sendSpecialtySelectionEmbed,
    sendPrestigeSelectionEmbed,
    sendRebirthSelectionEmbed,
    handleButtonInteraction
};
