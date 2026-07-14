const fs = require('fs').promises;
const path = require('path');
const util = require('util');
const { exec } = require('child_process');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

const db = require('../db');
const progressionService = require('./progressionService');
const disabledCommandsService = require('./disabledCommandsService');
const qaAccessService = require('./qaAccessService');

const execAsync = util.promisify(exec);
const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

const DATA_FILES = {
    users: path.join(DATA_DIR, 'users.json'),
    bank: path.join(DATA_DIR, 'bank.json'),
    products: path.join(DATA_DIR, 'products.json'),
    banklog: path.join(DATA_DIR, 'bank_log.json'),
    conversionlog: path.join(DATA_DIR, 'conversion_log.json'),
    transactionlog: path.join(DATA_DIR, 'transaction_log.json'),
    commandlog: path.join(DATA_DIR, 'command_log.json')
};

const OWNER_ADVANCED_COMMANDS = new Set([
    'status',
    'eval',
    'shutdown',
    'restart',
    'update',
    'exportdb',
    'importdb',
    'resetuser',
    'transferall',
    'alert',
    'simulate',
    'forceprestige',
    'forcerebirth',
    'giveall',
    'viewlogs',
    'clearspecificlog',
    'reloadcommand',
    'togglefeature'
]);

const OWNER_ONLY_RESTRICTED_COMMANDS = new Set([
    'eval',
    'shutdown',
    'restart',
    'update',
    'exportdb',
    'importdb',
    'disableallcommands',
    'enableallcommands',
    'reseteverything'
]);

const QA_ALLOWED_ADVANCED_COMMANDS = new Set([
    'status',
    'simulate',
    'forceprestige',
    'forcerebirth',
    'giveall',
    'resetuser',
    'transferall',
    'viewlogs',
    'clearspecificlog',
    'alert',
    'reloadcommand',
    'togglefeature'
]);

function parseUserId(input) {
    const raw = String(input || '').trim();
    const id = raw.replace(/<@!?|>/g, '');
    return /^\d+$/.test(id) ? id : null;
}

function parseChannelId(input) {
    const raw = String(input || '').trim();
    const id = raw.replace(/<#|>/g, '');
    return /^\d+$/.test(id) ? id : null;
}

function parseRoleId(input) {
    const raw = String(input || '').trim();
    const id = raw.replace(/<@&|>/g, '');
    return /^\d+$/.test(id) ? id : null;
}

function normalizeCurrencyMeta(input) {
    const key = String(input || '').trim().toLowerCase();
    if (key === 'gold') {
        return { key, userField: 'gold', bankField: 'balance', toInternal: (n) => n * 10, toDisplay: (n) => n / 10 };
    }
    if (key === 'gems') {
        return { key, userField: 'gems', bankField: 'gems', toInternal: (n) => n, toDisplay: (n) => n };
    }
    if (key === 'honor') {
        return { key, userField: 'honor', bankField: 'honor', toInternal: (n) => n, toDisplay: (n) => n };
    }
    return null;
}

function parsePositiveInt(input) {
    const value = Number(String(input || '').trim());
    if (!Number.isInteger(value) || value <= 0) return null;
    return value;
}

function parseLogType(input) {
    const key = String(input || '').trim().toLowerCase();
    if (key === 'bank' || key === 'banklog') return 'bank';
    if (key === 'conversion' || key === 'conversionlog' || key === 'convert') return 'conversion';
    if (key === 'transaction' || key === 'transactionlog' || key === 'tx') return 'transaction';
    if (key === 'command' || key === 'commandlog' || key === 'commands') return 'command';
    if (key === 'qa' || key === 'qalog' || key === 'qaaudit') return 'qa';
    return null;
}

function getLogFilePathByType(type) {
    if (type === 'bank') return DATA_FILES.banklog;
    if (type === 'conversion') return DATA_FILES.conversionlog;
    if (type === 'transaction') return DATA_FILES.transactionlog;
    if (type === 'command') return DATA_FILES.commandlog;
    return null;
}

async function readLogByType(type) {
    if (type === 'qa') {
        return qaAccessService.getQAAuditLog();
    }

    const filePath = getLogFilePathByType(type);
    if (!filePath) return null;

    try {
        const raw = await fs.readFile(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

async function writeLogByType(type, entries) {
    const filePath = getLogFilePathByType(type);
    if (!filePath) return false;
    await fs.writeFile(filePath, JSON.stringify(entries, null, 2), 'utf8');
    return true;
}

function extractQaTarget(commandName, args) {
    if (!Array.isArray(args) || !args.length) return null;

    if (commandName === 'status') return 'system';
    if (commandName === 'togglefeature') return String(args[0] || '').trim().toLowerCase() || null;
    if (commandName === 'viewlogs' || commandName === 'clearspecificlog') return parseLogType(args[0]) || null;

    const mentionTarget = parseUserId(args[0]);
    if (mentionTarget) return mentionTarget;

    return String(args[0] || '').trim() || null;
}

function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts = [];
    if (days) parts.push(`${days}d`);
    if (hours || days) parts.push(`${hours}h`);
    if (minutes || hours || days) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    return parts.join(' ');
}

function sanitizeEvalOutput(text) {
    const token = process.env.DISCORD_TOKEN;
    let output = String(text || '');
    if (token && output.includes(token)) {
        output = output.split(token).join('[REDACTED_TOKEN]');
    }
    return output;
}

async function sendOwnerOnly(message) {
    return message.reply('❌ Owner only command.').catch(() => {});
}

function resetUserToDefaults(user) {
    user.gold = 0;
    user.xp = 0;
    user.level = 1;
    user.gems = 0;
    user.honor = 0;
    user.monthly_gold_to_gems = 0;
    user.monthly_gems_to_honor = 0;
    user.conversion_month = '';
    user.last_reward_time = 0;
    user.daily_gold_earned = 0;
    user.last_daily_reset = 0;

    user.task_daily_date = '';
    user.task_daily_messages = 0;
    user.task_daily_message_bonus_claimed = false;
    user.task_daily_voice_seconds = 0;
    user.task_daily_voice_bonus_claimed = false;

    user.currentRoute = null;
    user.currentSpecialty = null;
    user.specialties = { combat: null, scholar: null, atelier: null, merchant: null };
    user.completedRoutes = [];
    user.prestigeRoles = [];
    user.prestigeCount = 0;
    user.rebirthCount = 0;
    user.pendingFinalRestoreRoute = '';

    user.task_weekly = { slots: {} };
    user.task_monthly = { slots: {} };

    user.monthly_gif_buys = 0;
    if (user.gif_expires !== undefined) delete user.gif_expires;
    if (user.gif_month !== undefined) delete user.gif_month;
}

async function handleStatus(client, message) {
    const guildCount = client.guilds.cache.size;
    const userCount = (await db.getAllUsers()).length;
    const disabled = disabledCommandsService.getDisabledCommands();

    const mem = process.memoryUsage();
    const rssMb = (mem.rss / 1024 / 1024).toFixed(1);
    const heapUsedMb = (mem.heapUsed / 1024 / 1024).toFixed(1);
    const heapTotalMb = (mem.heapTotal / 1024 / 1024).toFixed(1);

    const embed = new EmbedBuilder()
        .setColor('#4CAF50')
        .setTitle('🛠️ Bot Status | حالة البوت')
        .addFields(
            { name: 'Uptime', value: formatDuration(process.uptime() * 1000), inline: true },
            { name: 'Guilds', value: String(guildCount), inline: true },
            { name: 'Tracked Users', value: String(userCount), inline: true },
            { name: 'Memory (RSS)', value: `${rssMb} MB`, inline: true },
            { name: 'Heap', value: `${heapUsedMb}/${heapTotalMb} MB`, inline: true },
            { name: 'Node', value: process.version, inline: true },
            {
                name: 'Disabled Commands',
                value: disabled.length ? disabled.map((x) => `\`%${x}\``).join(', ').slice(0, 1000) : 'None',
                inline: false
            },
            {
                name: 'Global Lock',
                value: disabledCommandsService.isAllCommandsDisabled() ? 'ENABLED' : 'OFF',
                inline: true
            }
        )
        .setTimestamp();

    return message.reply({ embeds: [embed] });
}

async function handleEval(client, message, args) {
    const code = (args || []).join(' ').trim();
    if (!code) {
        return message.reply('Usage: `%eval <javascript>`').catch(() => {});
    }

    try {
        const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
        const fn = new AsyncFunction('client', 'message', 'db', 'progressionService', `return (${code});`);
        const result = await fn(client, message, db, progressionService);
        const inspected = sanitizeEvalOutput(util.inspect(result, { depth: 2, maxArrayLength: 30 }));
        const out = inspected.length > 1800 ? `${inspected.slice(0, 1800)}\n...truncated` : inspected;
        return message.reply(`✅ Eval result:\n\`\`\`js\n${out}\n\`\`\``).catch(() => {});
    } catch (err) {
        const errorText = sanitizeEvalOutput(err?.stack || err?.message || String(err));
        const out = errorText.length > 1800 ? `${errorText.slice(0, 1800)}\n...truncated` : errorText;
        return message.reply(`❌ Eval error:\n\`\`\`js\n${out}\n\`\`\``).catch(() => {});
    }
}

async function handleShutdown(message) {
    await message.reply('🛑 Shutting down bot process...').catch(() => {});
    setTimeout(() => process.exit(0), 200);
}

async function handleRestart(message) {
    await message.reply('🔄 Restarting bot process...').catch(() => {});
    setTimeout(() => process.exit(1), 200);
}

async function handleUpdate(message) {
    try {
        const { stdout, stderr } = await execAsync('git --no-pager pull --ff-only', {
            cwd: ROOT_DIR,
            timeout: 30_000,
            windowsHide: true
        });

        const merged = `${stdout || ''}${stderr ? `\n${stderr}` : ''}`.trim() || 'No output';
        const safeOutput = merged.length > 1500 ? `${merged.slice(0, 1500)}\n...truncated` : merged;

        return message.reply(`✅ Update command finished.\n\`\`\`\n${safeOutput}\n\`\`\``).catch(() => {});
    } catch (err) {
        const output = `${err?.stdout || ''}\n${err?.stderr || ''}\n${err?.message || ''}`.trim();
        const safeOutput = output.length > 1500 ? `${output.slice(0, 1500)}\n...truncated` : output;
        return message.reply(`❌ Update failed.\n\`\`\`\n${safeOutput || 'Unknown git error'}\n\`\`\``).catch(() => {});
    }
}

async function handleExportDb(message, args) {
    const target = String(args?.[0] || 'all').trim().toLowerCase();
    if (target !== 'all' && !DATA_FILES[target]) {
        return message.reply('Usage: `%exportdb all|users|bank|products|banklog|conversionlog|transactionlog|commandlog`').catch(() => {});
    }

    try {
        if (target === 'all') {
            const payload = {};
            for (const [name, filePath] of Object.entries(DATA_FILES)) {
                const raw = await fs.readFile(filePath, 'utf8').catch(() => 'null');
                payload[name] = JSON.parse(raw);
            }

            const buffer = Buffer.from(JSON.stringify(payload, null, 2), 'utf8');
            const attachment = new AttachmentBuilder(buffer, { name: `arabasta_export_all_${Date.now()}.json` });
            return message.reply({ content: '✅ Export complete (all DB files).', files: [attachment] }).catch(() => {});
        }

        const raw = await fs.readFile(DATA_FILES[target], 'utf8');
        const buffer = Buffer.from(raw, 'utf8');
        const attachment = new AttachmentBuilder(buffer, { name: `arabasta_export_${target}_${Date.now()}.json` });
        return message.reply({ content: `✅ Export complete (${target}).`, files: [attachment] }).catch(() => {});
    } catch (err) {
        return message.reply(`❌ Export failed: ${err?.message || 'unknown error'}`).catch(() => {});
    }
}

async function handleImportDb(message, args) {
    const target = String(args?.[0] || '').trim().toLowerCase();
    if (!DATA_FILES[target]) {
        return message.reply('Usage: `%importdb users|bank|products|banklog|conversionlog|transactionlog|commandlog` (attach a JSON file)').catch(() => {});
    }

    const attachment = message.attachments?.first?.();
    if (!attachment?.url) {
        return message.reply('❌ Attach a `.json` file with this command.').catch(() => {});
    }

    try {
        const response = await fetch(attachment.url);
        if (!response.ok) {
            return message.reply(`❌ Failed to fetch attachment: HTTP ${response.status}`).catch(() => {});
        }

        const text = await response.text();
        const parsed = JSON.parse(text);

        if (target === 'users' && (!parsed || !Array.isArray(parsed.users))) {
            return message.reply('❌ Invalid users.json format. Expected `{ "users": [] }`.').catch(() => {});
        }

        if (target === 'bank' && (!parsed || typeof parsed !== 'object')) {
            return message.reply('❌ Invalid bank.json format.').catch(() => {});
        }

        await fs.writeFile(DATA_FILES[target], JSON.stringify(parsed, null, 2), 'utf8');

        if (target === 'bank') {
            await db.saveBank(parsed);
        }
        if (target === 'products') {
            await db.saveProducts(Array.isArray(parsed) ? parsed : []);
        }

        const extra = target === 'users'
            ? '\n⚠️ Users cache may still be in memory. Use `%restart` to fully apply.'
            : '';
        return message.reply(`✅ Imported \`${target}\` successfully.${extra}`).catch(() => {});
    } catch (err) {
        return message.reply(`❌ Import failed: ${err?.message || 'unknown error'}`).catch(() => {});
    }
}

async function handleResetUser(message, args) {
    const targetId = parseUserId(args?.[0]);
    if (!targetId) {
        return message.reply('Usage: `%resetuser @user`').catch(() => {});
    }

    const user = await db.getUser(targetId);
    const bankAccess = !!user.bank_access;
    resetUserToDefaults(user);
    user.bank_access = bankAccess;

    await db.saveUser(user);

    const member = message.guild ? await message.guild.members.fetch(targetId).catch(() => null) : null;
    if (member) {
        await progressionService.syncMemberState(member, { allowRestoreFromDb: false }).catch(() => {});
    }

    return message.reply(`✅ Reset completed for <@${targetId}>.`).catch(() => {});
}

async function handleTransferAll(message, args) {
    let currency = normalizeCurrencyMeta(args?.[0]);
    let fromId = parseUserId(args?.[1]);
    let toId = parseUserId(args?.[2]);

    // Compatibility form: %transferall @user1 @user2  (defaults to gold)
    if (!currency) {
        fromId = parseUserId(args?.[0]);
        toId = parseUserId(args?.[1]);
        if (fromId && toId) {
            currency = normalizeCurrencyMeta('gold');
        }
    }

    if (!currency || !fromId || !toId) {
        return message.reply('Usage: `%transferall gold|gems|honor @from @to` or `%transferall @from @to` (gold default)').catch(() => {});
    }

    if (fromId === toId) {
        return message.reply('❌ Source and destination must be different users.').catch(() => {});
    }

    const fromUser = await db.getUser(fromId);
    const toUser = await db.getUser(toId);

    const amountInternal = Number(fromUser[currency.userField] || 0);
    if (amountInternal <= 0) {
        return message.reply('❌ Source user has no balance in that currency.').catch(() => {});
    }

    fromUser[currency.userField] = 0;
    toUser[currency.userField] = Number(toUser[currency.userField] || 0) + amountInternal;

    await db.saveUser(fromUser);
    await db.saveUser(toUser);

    await db.logTransaction({
        userId: toId,
        action: 'owner_transfer_all',
        goldAmount: currency.key === 'gold' ? currency.toDisplay(amountInternal) : 0,
        reason: `owner transferall ${currency.key}`,
        details: `from:${fromId} to:${toId} amount:${currency.toDisplay(amountInternal)}`
    });

    return message.reply(`✅ Transferred all ${currency.key} (${currency.toDisplay(amountInternal).toLocaleString()}) from <@${fromId}> to <@${toId}>.`).catch(() => {});
}

async function handleAlert(client, message, args) {
    if (!args?.length) {
        return message.reply('Usage: `%alert [#channel] <message>`').catch(() => {});
    }

    let channel = message.channel;
    let textArgs = args;

    const maybeChannelId = parseChannelId(args[0]);
    if (maybeChannelId) {
        const fetched = message.guild
            ? (message.guild.channels.cache.get(maybeChannelId) || await message.guild.channels.fetch(maybeChannelId).catch(() => null))
            : null;

        if (fetched && fetched.isTextBased()) {
            channel = fetched;
            textArgs = args.slice(1);
        }
    }

    const text = textArgs.join(' ').trim();
    if (!text) {
        return message.reply('❌ Alert text is empty.').catch(() => {});
    }

    await channel.send(`📢 **Owner Alert**\n${text}\n────────────────────────`).catch(() => {});
    if (channel.id !== message.channel.id) {
        await message.reply(`✅ Alert sent to <#${channel.id}>.`).catch(() => {});
    }
}

async function handleSimulate(message, args) {
    const targetId = parseUserId(args?.[0]);
    if (!targetId) {
        return message.reply('Usage: `%simulate @user <messageCount|action>`').catch(() => {});
    }

    const ticks = parsePositiveInt(args?.[1]);
    if (!ticks) {
        const action = String(args?.slice(1).join(' ') || '').trim();
        if (!action) {
            return message.reply('Usage: `%simulate @user <messageCount|action>`').catch(() => {});
        }

        return message.reply([
            `🧪 Simulation (dry-run) for <@${targetId}>`,
            `- Action: **${action}**`,
            'ℹ️ No data changed.'
        ].join('\n')).catch(() => {});
    }

    const user = await db.getUser(targetId);
    const member = message.guild ? await message.guild.members.fetch(targetId).catch(() => null) : null;
    const route = progressionService.getRouteLevelInfo(member).route;

    const dailyCapInternal = route === 'merchant' ? 4500 : 3500;
    const remainingCap = Math.max(0, dailyCapInternal - Number(user.daily_gold_earned || 0));
    const potentialGold = Math.min(remainingCap, ticks * 75);
    const potentialXp = ticks * 15;

    return message.reply([
        `🧪 Simulation for <@${targetId}> (${ticks.toLocaleString()} messages):`,
        `- Estimated Gold: **+${(potentialGold / 10).toLocaleString()}**`,
        `- Estimated XP: **+${potentialXp.toLocaleString()}**`,
        `- Daily cap considered: **${(dailyCapInternal / 10).toLocaleString()}**`,
        'ℹ️ This command does not modify data.'
    ].join('\n')).catch(() => {});
}

async function handleForcePrestige(message, args) {
    const targetId = parseUserId(args?.[0]);
    const user = targetId ? await db.getUser(targetId) : null;
    const route = progressionService.normalizeRoute(args?.[1])
        || progressionService.normalizeRoute(user?.currentRoute)
        || 'combat';

    if (!targetId) {
        return message.reply('Usage: `%forceprestige @user [combat|scholar|atelier|merchant]`').catch(() => {});
    }

    const previousRoute = user.currentRoute || null;

    if (previousRoute && !Array.isArray(user.completedRoutes)) {
        user.completedRoutes = [];
    }
    if (previousRoute && !user.completedRoutes.includes(previousRoute)) {
        user.completedRoutes.push(previousRoute);
    }

    user.currentRoute = route;
    user.currentSpecialty = null;
    user.specialties = user.specialties && typeof user.specialties === 'object'
        ? user.specialties
        : { combat: null, scholar: null, atelier: null, merchant: null };
    user.specialties[route] = null;
    user.prestigeCount = Number(user.prestigeCount || 0) + 1;

    await db.saveUser(user);

    const member = message.guild ? await message.guild.members.fetch(targetId).catch(() => null) : null;
    if (member) {
        await progressionService.syncMemberState(member, { allowRestoreFromDb: false }).catch(() => {});
    }

    return message.reply(`✅ Force prestige applied to <@${targetId}> → route **${route}**.`).catch(() => {});
}

async function handleForceRebirth(message, args) {
    const targetId = parseUserId(args?.[0]);
    const user = targetId ? await db.getUser(targetId) : null;
    const route = progressionService.normalizeRoute(args?.[1])
        || progressionService.normalizeRoute(user?.currentRoute)
        || 'combat';

    if (!targetId) {
        return message.reply('Usage: `%forcerebirth @user [combat|scholar|atelier|merchant]`').catch(() => {});
    }

    user.currentRoute = route;
    user.currentSpecialty = null;
    user.specialties = { combat: null, scholar: null, atelier: null, merchant: null };
    user.completedRoutes = [];
    user.prestigeRoles = [];
    user.prestigeCount = 0;
    user.rebirthCount = Number(user.rebirthCount || 0) + 1;

    await db.saveUser(user);

    const member = message.guild ? await message.guild.members.fetch(targetId).catch(() => null) : null;
    if (member) {
        await progressionService.syncMemberState(member, { allowRestoreFromDb: false }).catch(() => {});
    }

    return message.reply(`✅ Force rebirth applied to <@${targetId}> → route **${route}**.`).catch(() => {});
}

async function handleGiveAll(message, args) {
    if (!message.guild) {
        return message.reply('❌ This command must run inside a server.').catch(() => {});
    }

    const currency = normalizeCurrencyMeta(args?.[0]);
    const amountDisplay = parsePositiveInt(args?.[1]);
    const roleId = parseRoleId(args?.[2]);

    if (!currency || !amountDisplay) {
        return message.reply('Usage: `%giveall gold|gems|honor <amount> [@role]`').catch(() => {});
    }

    const amountInternalPerUser = currency.toInternal(amountDisplay);
    await message.guild.members.fetch().catch(() => {});

    const members = message.guild.members.cache.filter((m) => {
        if (!m || m.user?.bot) return false;
        if (roleId) return m.roles?.cache?.has?.(roleId);
        return true;
    });

    const recipients = Array.from(members.values());
    if (!recipients.length) {
        return message.reply('❌ No matching recipients found.').catch(() => {});
    }

    const bank = await db.getBank();
    const totalRequired = amountInternalPerUser * recipients.length;
    const currentBank = Number(bank[currency.bankField] || 0);

    if (currentBank < totalRequired) {
        return message.reply(`❌ Bank has insufficient ${currency.key}. Required: ${currency.toDisplay(totalRequired).toLocaleString()}, Available: ${currency.toDisplay(currentBank).toLocaleString()}`).catch(() => {});
    }

    for (const member of recipients) {
        const user = await db.getUser(member.id);
        user[currency.userField] = Number(user[currency.userField] || 0) + amountInternalPerUser;
        await db.saveUser(user);
    }

    bank[currency.bankField] = currentBank - totalRequired;
    await db.saveBank(bank);

    await db.logBankAction({
        userId: message.author.id,
        action: `owner_giveall_${currency.key}`,
        amount: amountDisplay,
        extra: `recipients:${recipients.length}`
    });

    return message.reply(`✅ Sent ${amountDisplay.toLocaleString()} ${currency.key} to **${recipients.length}** users. Total deducted from bank: ${currency.toDisplay(totalRequired).toLocaleString()}.`).catch(() => {});
}

async function handleViewLogs(message, args) {
    const type = parseLogType(args?.[0]);
    if (!type) {
        return message.reply('Usage: `%viewlogs bank|conversion|transaction|command|qa`').catch(() => {});
    }

    const rows = await readLogByType(type);
    if (!rows || !rows.length) {
        return message.reply(`📋 ${type} log is empty.`).catch(() => {});
    }

    const slice = rows.slice(-20).reverse();
    const lines = slice.map((entry, idx) => {
        const t = entry?.timestamp ? new Date(entry.timestamp).toLocaleString('en-GB') : 'unknown-time';
        if (type === 'qa') {
            return `#${idx + 1} | user:<@${entry.userId || '-'}> | cmd:${entry.command || '-'} | target:${entry.target || '-'} | ${t}`;
        }

        const action = entry.action || entry.command || `${type}_entry`;
        const user = entry.userId || '-';
        return `#${idx + 1} | ${action} | user:<@${user}> | ${t}`;
    });

    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(`📋 ${type.toUpperCase()} Logs (Last 20)`)
        .setDescription(lines.join('\n').slice(0, 3900))
        .setTimestamp();

    return message.reply({ embeds: [embed] }).catch(() => {});
}

async function handleClearSpecificLog(message, args) {
    const type = parseLogType(args?.[0]);
    const amount = parsePositiveInt(args?.[1]);

    if (!type || !amount) {
        return message.reply('Usage: `%clearspecificlog bank|conversion|transaction|command|qa <amount>`').catch(() => {});
    }

    if (type === 'qa') {
        return message.reply('❌ QA audit log cannot be partially cleared for safety.').catch(() => {});
    }

    const rows = await readLogByType(type);
    if (!rows?.length) {
        return message.reply(`📋 ${type} log is already empty.`).catch(() => {});
    }

    const removed = Math.min(amount, rows.length);
    const remaining = rows.slice(0, rows.length - removed);
    await writeLogByType(type, remaining);

    return message.reply(`✅ Cleared ${removed} entries from ${type} log.`).catch(() => {});
}

async function handleReloadCommand(message, args) {
    const commandName = String(args?.[0] || '').trim().toLowerCase();
    if (!commandName || !/^[a-z0-9_-]+$/.test(commandName)) {
        return message.reply('Usage: `%reloadcommand <commandFileName>`').catch(() => {});
    }

    const filePath = path.join(ROOT_DIR, 'commands', `${commandName}.js`);
    try {
        await fs.access(filePath);
    } catch {
        return message.reply('❌ Command file not found under `commands/`.').catch(() => {});
    }

    try {
        const resolved = require.resolve(filePath);
        delete require.cache[resolved];
        require(filePath);
        return message.reply(`✅ Reloaded commands/${commandName}.js into require cache.`).catch(() => {});
    } catch (err) {
        return message.reply(`❌ Reload failed: ${err?.message || 'unknown error'}`).catch(() => {});
    }
}

async function handleToggleFeature(message, args) {
    const feature = String(args?.[0] || '').trim().toLowerCase();
    if (!feature) {
        return message.reply('Usage: `%togglefeature <featureName>`').catch(() => {});
    }

    const result = await qaAccessService.toggleFeature(feature);
    if (!result.ok) {
        return message.reply('❌ Invalid feature name.').catch(() => {});
    }

    return message.reply(`✅ Feature ${result.feature} is now **${result.enabled ? 'ENABLED' : 'DISABLED'}**.`).catch(() => {});
}

async function handleOwnerAdvancedCommand({ client, message, commandName, args, ownerId }) {
    if (!OWNER_ADVANCED_COMMANDS.has(commandName)) {
        return false;
    }

    const isOwnerUser = qaAccessService.isOwner(message.author.id, ownerId);
    const isQAUser = !isOwnerUser && await qaAccessService.isQA(message.author.id);

    if (!isOwnerUser) {
        // Silent fail for restricted/sensitive commands and any non-QA user.
        if (!isQAUser) return true;
        if (OWNER_ONLY_RESTRICTED_COMMANDS.has(commandName)) return true;
        if (!QA_ALLOWED_ADVANCED_COMMANDS.has(commandName)) return true;

        const target = extractQaTarget(commandName, args);
        await qaAccessService.logQACommandUsage({
            userId: message.author.id,
            command: commandName,
            target,
            details: { channelId: message.channel?.id || null, guildId: message.guild?.id || null }
        }).catch(() => {});
    }

    switch (commandName) {
        case 'status':
            await handleStatus(client, message);
            return true;
        case 'eval':
            await handleEval(client, message, args);
            return true;
        case 'shutdown':
            await handleShutdown(message);
            return true;
        case 'restart':
            await handleRestart(message);
            return true;
        case 'update':
            await handleUpdate(message);
            return true;
        case 'exportdb':
            await handleExportDb(message, args);
            return true;
        case 'importdb':
            await handleImportDb(message, args);
            return true;
        case 'resetuser':
            await handleResetUser(message, args);
            return true;
        case 'transferall':
            await handleTransferAll(message, args);
            return true;
        case 'alert':
            await handleAlert(client, message, args);
            return true;
        case 'simulate':
            await handleSimulate(message, args);
            return true;
        case 'forceprestige':
            await handleForcePrestige(message, args);
            return true;
        case 'forcerebirth':
            await handleForceRebirth(message, args);
            return true;
        case 'giveall':
            await handleGiveAll(message, args);
            return true;
        case 'viewlogs':
            await handleViewLogs(message, args);
            return true;
        case 'clearspecificlog':
            await handleClearSpecificLog(message, args);
            return true;
        case 'reloadcommand':
            await handleReloadCommand(message, args);
            return true;
        case 'togglefeature':
            await handleToggleFeature(message, args);
            return true;
        default:
            return false;
    }
}

function isAdvancedOwnerCommand(commandName) {
    return OWNER_ADVANCED_COMMANDS.has(String(commandName || '').trim().toLowerCase());
}

async function canUseAdvancedOwnerCommand({ userId, ownerId, commandName }) {
    const normalized = String(commandName || '').trim().toLowerCase();
    if (!isAdvancedOwnerCommand(normalized)) return false;

    const isOwnerUser = qaAccessService.isOwner(userId, ownerId);
    if (isOwnerUser) return true;

    const isQAUser = await qaAccessService.isQA(userId);
    if (!isQAUser) return false;
    if (OWNER_ONLY_RESTRICTED_COMMANDS.has(normalized)) return false;

    return QA_ALLOWED_ADVANCED_COMMANDS.has(normalized);
}

module.exports = {
    handleOwnerAdvancedCommand,
    isAdvancedOwnerCommand,
    canUseAdvancedOwnerCommand
};
