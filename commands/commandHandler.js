const db = require('../db');
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const bankCmd        = require('./bank');
const shopCmd        = require('./shop');
const miscCmd        = require('./misc');
const profileCmd     = require('./profile');
const leaderboardCmd = require('./leaderboard');
const permissionCmd  = require('./permission');
const convertCmd     = require('./convert');
const musicCmd       = require('./music');
const progressionCmd = require('./progression');
const payCmd         = require('./pay');
const testingCmd     = require('./testing');
const warnCmd        = require('./warn');
const clanCmd        = require('./clan');
const gearCmd        = require('./gear');
const craftCmd       = require('./craft');
const sellCmd        = require('./sell');
const taskService    = require('../services/taskService');
const progressionService = require('../services/progressionService');
const disabledCommandsService = require('../services/disabledCommandsService');
const ownerOpsService = require('../services/ownerOpsService');
const qaAccessService = require('../services/qaAccessService');
const manualCmd = require('./manual');

// ── Command normalization / aliases ──────────────────────────

const COMMAND_ALIAS_TO_CANONICAL = {
    help: 'help',
    man: 'man',
    manual: 'man',
    command: 'commands',
    commands: 'commands',
    owner: 'owner',
    enableqa: 'enableqa',
    disableqa: 'disableqa',
    qalist: 'qalist',

    b: 'bank',
    bank: 'bank',

    s: 'shop',
    shop: 'shop',

    ping: 'ping',
    play: 'play',
    song: 'song',
    pay: 'pay',
    give: 'give',
    specialty: 'specialty',
    prestige: 'prestige',
    rebirth: 'rebirth',
    setlevel: 'setlevel',
    setxp: 'setxp',
    warn: 'warn',
    warning: 'warn',
    removewarning: 'removewarning',
    unwarn: 'removewarning',
    reblacklist: 'reblacklist',
    removeblacklist: 'reblacklist',
    clan: 'clan',
    gear: 'gear',
    craft: 'craft',
    sell: 'sell',

    p: 'profile',
    profile: 'profile',

    t: 'tasks',
    task: 'tasks',
    tasks: 'tasks',

    lb: 'leaderboard',
    leaderboard: 'leaderboard',

    a: 'permission',
    da: 'permission',

    c: 'convert',
    convert: 'convert',
    showbanklog: 'showbanklog',
    log: 'log',
    logtransaction: 'logtransaction',
    logtransactionreset: 'logtransactionreset',
    logcommands: 'logcommands',
    logcommandsreset: 'logcommandsreset',
    reseteverything: 'reseteverything',
    disablecommand: 'disablecommand',
    enablecommand: 'enablecommand',
    disableallcommands: 'disableallcommands',
    enableallcommands: 'enableallcommands',

    shutdown: 'shutdown',
    restart: 'restart',
    update: 'update',
    status: 'status',
    eval: 'eval',
    exportdb: 'exportdb',
    importdb: 'importdb',
    resetuser: 'resetuser',
    transferall: 'transferall',
    alert: 'alert',
    simulate: 'simulate',
    forceprestige: 'forceprestige',
    forcerebirth: 'forcerebirth',
    forcerrebirth: 'forcerebirth',
    giveall: 'giveall',
    viewlogs: 'viewlogs',
    clearspecificlog: 'clearspecificlog',
    reloadcommand: 'reloadcommand',
    togglefeature: 'togglefeature'
};

const PROTECTED_COMMANDS = new Set([
    'disablecommand',
    'enablecommand',
    'disableallcommands',
    'enableallcommands',
    'enableqa',
    'disableqa',
    'qalist',
    'owner',
    'status',
    'eval',
    'shutdown',
    'restart',
    'update',
    'reseteverything'
]);

function normalizeCommandName(input) {
    const key = String(input || '').trim().toLowerCase();
    return COMMAND_ALIAS_TO_CANONICAL[key] || key;
}

function isKnownCommand(input) {
    const key = String(input || '').trim().toLowerCase();
    return !!COMMAND_ALIAS_TO_CANONICAL[key];
}

function canManageCommandState(userId, OWNER_ID) {
    // Owner-only command control
    return userId === OWNER_ID;
}

const PUBLIC_COMMANDS = new Set([
    'help', 'man',
    'ping', 'play', 'song', 'profile', 'tasks', 'leaderboard', 'convert', 'clan', 'gear', 'craft', 'sell'
]);

const AUTHORIZED_OR_ADMIN_COMMANDS = new Set(['commands']);

const AUTHORIZED_COMMANDS = new Set([
    'bank', 'shop',
    'pay', 'give',
    'specialty', 'prestige', 'rebirth',
    'setlevel', 'setxp',
    'log', 'logtransaction', 'logcommands'
]);

const OWNER_ONLY_NON_ADVANCED_COMMANDS = new Set([
    'owner',
    'permission',
    'showbanklog',
    'logtransactionreset',
    'logcommandsreset',
    'reseteverything',
    'disablecommand',
    'enablecommand',
    'disableallcommands',
    'enableallcommands',
    'enableqa',
    'disableqa',
    'qalist'
]);

// ── Help ──────────────────────────────────────────────────────

async function showHelp(message) {
    try {
        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('📖 **Public Commands | الأوامر العامة**')
            .setDescription('Available to everyone | متاحة للجميع')
            .addFields(
                { name: '👤 Profile | الملف الشخصي', value: '`%p` / `%profile` [@user] — Show profile | عرض الملف الشخصي', inline: false },
                { name: '🏆 Leaderboard | المتصدرين', value: '`%lb` / `%leaderboard` [xp|gold|gems|honor] — Top rankings | أفضل المتصدرين', inline: false },
                { name: '🗓️ Tasks | المهام', value: '`%t` / `%task` / `%tasks` — Daily progress | تقدم المهام اليومية', inline: false },
                { name: '🧩 Gameplay | اللعب', value: '`%clan` — Clan system | نظام الكلان\n`%gear status` — Gear management | إدارة العتاد\n`%craft` — Clan crafting panel | لوحة التصنيع\n`%sell <item> <price>` — Merchant listing | قائمة البيع', inline: false },
                { name: '🎵 Music | الموسيقى', value: '`%play <query>` — Play/queue music | تشغيل/إضافة أغاني\n`%song <query>` — Get YouTube URL only | جلب رابط يوتيوب فقط', inline: false },
                { name: '🔧 Utility | أدوات', value: '`%ping` — Ping bot | التحقق من البوت\n`%convert` [@user] — Keyboard convert | تحويل لوحة المفاتيح', inline: false },
                { name: '🔐 Restricted Menus | قوائم الصلاحيات', value: '`%command` — Authorized/Admin commands | أوامر المصرّح لهم/الإداريين\n`%owner` — Owner-only commands | أوامر المالك فقط', inline: false }
            )
            .setFooter({ text: 'ArabastaBot | وزارة المالية • مملكة أراباستا' })
            .setTimestamp();

        return message.reply({ embeds: [embed] });
    } catch (err) {
        console.error('showHelp error:', err);
        return message.reply('❌ Error displaying help. خطأ في عرض المساعدة.').catch(() => {});
    }
}

async function showAuthorizedCommands(message, OWNER_ID) {
    try {
        const isOwner = message.author.id === OWNER_ID;
        const authorized = await db.getAuthorizedUsers();
        const isAuthorized = isOwner || authorized.has(message.author.id);
        const isServerAdmin = message.member?.permissions?.has?.(PermissionFlagsBits.Administrator) || false;

        if (!isAuthorized && !isServerAdmin) {
            return message.reply('❌ هذا الأمر للمصرّح لهم أو الإداريين فقط. | This command is only for authorized users or server admins.').catch(() => {});
        }

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('�️ **Authorized/Admin Commands | أوامر المصرّح لهم والإداريين**')
            .addFields(
                { name: '� Bank/Shop | البنك/المتجر', value: '`%b` / `%bank`\n`%s` / `%shop`', inline: false },
                { name: '� Transfers | التحويلات', value: '`%pay gold|gems|honor @user <amount>` — Manual pay flow\n`%give gold|gems|honor @user <amount>` — Bank give + claim', inline: false },
                { name: '🧭 Progression | التقدم', value: '`%specialty <name>`\n`%prestige <route>`\n`%rebirth <route>`', inline: false },
                { name: '🧩 Gameplay | اللعب', value: '`%clan`\n`%clan admincreate <@Leader> <@Deputy> "Clan Name" <@Member3> ...`\n`%gear status`\n`%craft`\n`%sell <item> <price>`', inline: false },
                { name: '⚖️ Moderation | الإشراف', value: '`%warn @user` — Warn user | تحذير المستخدم\n`%removewarning @user` — Remove warning | إزالة التحذير\n`%reblacklist @user` — Reapply blacklist | إعادة الحظر', inline: false },
                { name: '🧪 Testing | الاختبار', value: '`%setlevel @user <value>`\n`%setxp @user <value>`', inline: false },
                { name: '📜 Logs | السجلات', value: '`%log`\n`%logtransaction`\n`%logcommands`', inline: false }
            );

        if (isAuthorized || isServerAdmin) {
            embed.addFields({
                name: 'ℹ️ Access Note | ملاحظة الصلاحيات',
                value: 'Some commands may still enforce owner/%a checks at execution time depending on server policy.\nبعض الأوامر قد تتحقق من صلاحية المالك/%a أثناء التنفيذ حسب سياسة السيرفر.',
                inline: false
            });
        }

        embed.setFooter({ text: isOwner ? '👑 Owner view | عرض المالك' : 'Authorized/Admin view | عرض المصرّح/الإداري' })
             .setTimestamp();

        return message.reply({ embeds: [embed] });
    } catch (err) {
        console.error('showAuthorizedCommands error:', err);
        return message.reply('❌ Error displaying commands.').catch(() => {});
    }
}

async function showOwnerCommands(message, OWNER_ID) {
    try {
        if (message.author.id !== OWNER_ID) return;

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('👑 **Owner Commands | أوامر المالك**')
            .addFields(
                {
                    name: '✅ Implemented | متاح حالياً',
                    value: '`%a @user` — Grant authorization\n`%da @user` — Revoke authorization\n`%enableqa @user` `%disableqa @user` `%qalist`\n`%showbanklog`\n`%logtransactionreset`\n`%logcommandsreset`\n`%disablecommand <name>`\n`%enablecommand <name>`\n`%disableallcommands`\n`%enableallcommands`\n`%reseteverything`',
                    inline: false
                },
                {
                    name: '🛠️ Advanced Owner Ops | أوامر المالك المتقدمة',
                    value: '`%status` `%eval` `%shutdown` `%restart` `%update`\n`%exportdb` `%importdb` `%resetuser` `%transferall`\n`%alert` `%simulate` `%forceprestige` `%forcerebirth` `%giveall`\n`%viewlogs` `%clearspecificlog` `%reloadcommand` `%togglefeature`',
                    inline: false
                }
            )
            .setFooter({ text: 'Owner-only menu (silent to non-owner) | قائمة المالك فقط' })
            .setTimestamp();

        return message.reply({ embeds: [embed] });
    } catch (err) {
        console.error('showOwnerCommands error:', err);
        return message.reply('❌ Error displaying owner commands.').catch(() => {});
    }
}

// ── Main handler ──────────────────────────────────────────────

module.exports = async function (client, message, cmd, args, OWNER_ID) {
    try {
        if (!message || !message.author || typeof message.reply !== 'function') {
            console.error('Invalid message object passed to commandHandler.');
            return;
        }
        if (!cmd) return;

        // Normalize command names to support aliases and case-insensitive checks
        const rawCommand = String(cmd || '').trim().toLowerCase();
        const commandName = normalizeCommandName(rawCommand);
        const isOwner = message.author.id === OWNER_ID;
        let authorizedUsersPromise = null;

        const getAuthorizedUsersCached = async () => {
            if (!authorizedUsersPromise) {
                authorizedUsersPromise = db.getAuthorizedUsers();
            }
            return authorizedUsersPromise;
        };

        const isAuthorizedUser = async () => {
            if (isOwner) return true;
            const authorized = await getAuthorizedUsersCached();
            return authorized.has(message.author.id);
        };

        const canAccessCommandManual = async (targetCommandName) => {
            const normalizedTarget = normalizeCommandName(targetCommandName);

            if (PUBLIC_COMMANDS.has(normalizedTarget)) return true;
            if (AUTHORIZED_OR_ADMIN_COMMANDS.has(normalizedTarget)) {
                const isServerAdmin = message.member?.permissions?.has?.(PermissionFlagsBits.Administrator) || false;
                return isServerAdmin || await isAuthorizedUser();
            }
            if (AUTHORIZED_COMMANDS.has(normalizedTarget)) return await isAuthorizedUser();
            if (OWNER_ONLY_NON_ADVANCED_COMMANDS.has(normalizedTarget)) return isOwner;

            if (ownerOpsService.isAdvancedOwnerCommand(normalizedTarget)) {
                return ownerOpsService.canUseAdvancedOwnerCommand({
                    userId: message.author.id,
                    ownerId: OWNER_ID,
                    commandName: normalizedTarget
                });
            }

            return false;
        };

        // Persistent command log (last 100)
        await db.logCommandUsage({
            userId: message.author.id,
            username: message.author.tag,
            guildId: message.guild?.id || null,
            channelId: message.channel?.id || null,
            command: commandName,
            args,
            rawContent: message.content || '',
            status: 'invoked',
            details: `normalized:${commandName}`
        });

        // Block disabled commands before execution
        if (!PROTECTED_COMMANDS.has(commandName) && disabledCommandsService.isAllCommandsDisabled()) {
            return message.reply('All commands are currently disabled by owner control.').catch(() => {});
        }

        if (disabledCommandsService.isCommandDisabled(commandName)) {
            return message.reply('This command is currently disabled.').catch(() => {});
        }

        const handledByOwnerOps = await ownerOpsService.handleOwnerAdvancedCommand({
            client,
            message,
            commandName,
            args,
            ownerId: OWNER_ID
        });
        if (handledByOwnerOps) return;

        switch (rawCommand) {

            case 'help':
                return await showHelp(message);

            case 'man': {
                const targetRaw = String(args?.[0] || '').trim().toLowerCase();
                if (!targetRaw) {
                    return message.reply('Usage: `%man <command>`').catch(() => {});
                }

                const targetCommand = normalizeCommandName(targetRaw);
                const manual = manualCmd.getManual(targetCommand);

                if (!manual) {
                    return message.reply('❌ No manual found for that command.').catch(() => {});
                }

                const canView = await canAccessCommandManual(targetCommand);
                if (!canView) {
                    return message.reply('❌ You cannot view this command manual.').catch(() => {});
                }

                const embed = manualCmd.buildManualEmbed({
                    commandName: targetCommand,
                    manual,
                    requesterTag: message.author.tag
                });
                return message.reply({ embeds: [embed] }).catch(() => {});
            }

            case 'command':
            case 'commands':
            case '':
                return await showAuthorizedCommands(message, OWNER_ID);

            case 'owner':
                return await showOwnerCommands(message, OWNER_ID);

            case 'enableqa': {
                if (!isOwner) return;
                const userId = qaAccessService.normalizeUserId(args?.[0]);
                if (!userId) {
                    return message.reply('Usage: `%enableqa @user`').catch(() => {});
                }

                const result = await qaAccessService.addQAUser(userId);
                if (!result.ok) {
                    return message.reply('❌ Invalid user id.').catch(() => {});
                }

                return message.reply(result.added
                    ? `✅ QA enabled for <@${userId}>.`
                    : `ℹ️ <@${userId}> is already QA.`).catch(() => {});
            }

            case 'disableqa': {
                if (!isOwner) return;
                const userId = qaAccessService.normalizeUserId(args?.[0]);
                if (!userId) {
                    return message.reply('Usage: `%disableqa @user`').catch(() => {});
                }

                const result = await qaAccessService.removeQAUser(userId);
                if (!result.ok) {
                    return message.reply('❌ Invalid user id.').catch(() => {});
                }

                return message.reply(result.removed
                    ? `✅ QA disabled for <@${userId}>.`
                    : `ℹ️ <@${userId}> was not in QA list.`).catch(() => {});
            }

            case 'qalist': {
                if (!isOwner) return;
                const users = await qaAccessService.listQAUsers();
                if (!users.length) {
                    return message.reply('📋 QA list is empty.').catch(() => {});
                }
                return message.reply(`📋 QA Users:\n${users.map((id) => `• <@${id}>`).join('\n')}`).catch(() => {});
            }

            case 'b':
            case 'bank':
                return await bankCmd(message, OWNER_ID);

            case 's':
            case 'shop':
                return await shopCmd(message, OWNER_ID);

            case 'ping':
                return miscCmd.ping(message);

            case 'play':
                return await musicCmd.play(message, args);

            case 'song':
                return await musicCmd.song(message, args);

            case 'pay':
                return await payCmd.pay(message, args, OWNER_ID);

            case 'give':
                return await payCmd.give(message, args, OWNER_ID);

            case 'clan':
                return await clanCmd(message, args);

            case 'gear':
                return await gearCmd(message, args);

            case 'craft':
                return await craftCmd(message, args);

            case 'sell':
                return await sellCmd(message, args);

                case 'specialty':
                {
                    const isAllowed = await isAuthorizedUser();
                    if (!isAllowed) {
                        return message.reply('❌ ليس لديك صلاحية لاستخدام أوامر التقدم. | You do not have permission to use progression commands.');
                    }
                    return await progressionCmd.specialty(message, args);
                }

                case 'prestige': {
                    const isAllowed = await isAuthorizedUser();
                    if (!isAllowed) {
                        return message.reply('❌ ليس لديك صلاحية لاستخدام أوامر التقدم. | You do not have permission to use progression commands.');
                    }
                    return await progressionCmd.prestige(message, args);
                }

                case 'rebirth': {
                    const isAllowed = await isAuthorizedUser();
                    if (!isAllowed) {
                        return message.reply('❌ ليس لديك صلاحية لاستخدام أوامر التقدم. | You do not have permission to use progression commands.');
                    }
                    return await progressionCmd.rebirth(message, args);
                }

                case 'setlevel': {
                    const isAllowed = await isAuthorizedUser();
                    if (!isAllowed) {
                        return message.reply('❌ You do not have permission to use testing commands.');
                    }
                    return await testingCmd.setLevel(message, args);
                }

                case 'setxp': {
                    const isAllowed = await isAuthorizedUser();
                    if (!isAllowed) {
                        return message.reply('❌ You do not have permission to use testing commands.');
                    }
                    return await testingCmd.setXp(message, args);
                }

                case 'warn':
                case 'warning':
                    return await warnCmd.warn(message, args);

                case 'removewarning':
                case 'unwarn':
                    return await warnCmd.removeWarning(message, args);

                case 'reblacklist':
                case 'removeblacklist':
                    return await warnCmd.reblacklist(message, args);

            case 'p':
            case 'profile':
                return await profileCmd(message, args);

            case 't':
            case 'task':
            case 'tasks':
                return await taskService.showTaskProgress(message, args);

            case 'lb':
            case 'leaderboard':
                return await leaderboardCmd(message, args);

            case 'a':
            case 'da':
                return await permissionCmd.handlePermission(message, cmd, args, OWNER_ID);

            case 'c':
            case 'convert':
                return await convertCmd(message, args);

            // ── Owner: view bank log ──────────────────────────────
            case 'showbanklog': {
                if (message.author.id !== OWNER_ID) return;

                const log = await db.getBankLog();
                if (!log.length) {
                    return message.reply('📋 **سجل البنك فارغ. | Bank log is empty.**');
                }

                const last = log.slice(-20).reverse();
                const lines = last.map(entry => {
                    const date = new Date(entry.timestamp);
                    const dateStr = date.toLocaleDateString('en-GB');
                    const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                    const extra = entry.extra ? ` *(${entry.extra})*` : '';
                    return `**${entry.action}** | <@${entry.userId}> | ${entry.amount}${extra} | ${dateStr} ${timeStr}`;
                });

                const embed = new EmbedBuilder()
                    .setColor('#FFD700')
                    .setTitle('📋 **سجل البنك | Bank Log** (آخر 20 عملية | Last 20)')
                    .setDescription(lines.join('\n'))
                    .setTimestamp();

                return message.reply({ embeds: [embed] });
            }

            // ── Admin + Owner: view conversion log ────────────────
            case 'log': {
                if (!(await isAuthorizedUser())) {
                    return message.reply('❌ ليس لديك صلاحية. | You don\'t have permission.');
                }

                const log = await db.getConversionLog();
                if (!log.length) {
                    return message.reply('📋 **سجل التحويل فارغ. | Conversion log is empty.**');
                }

                const last = log.slice(-20).reverse();
                const lines = last.map(entry => {
                    const date = new Date(entry.timestamp);
                    const dateStr = date.toLocaleDateString('en-GB');
                    const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                    return `**${entry.fromType} → ${entry.toType}** | <@${entry.userId}> | ${entry.fromAmount} → ${entry.toAmount} | ${dateStr} ${timeStr}`;
                });

                const embed = new EmbedBuilder()
                    .setColor('#00CED1')
                    .setTitle('📋 **سجل تحويل العملات | Conversion Log** (آخر 20 | Last 20)')
                    .setDescription(lines.join('\n'))
                    .setTimestamp();

                return message.reply({ embeds: [embed] });
            }

            // ── Admin + Owner: transaction log (last 100) ───────
            case 'logtransaction': {
                if (!(await isAuthorizedUser())) {
                    return message.reply('❌ ليس لديك صلاحية. | You don\'t have permission.');
                }

                const log = await db.getTransactionLog();
                if (!log.length) {
                    return message.reply('📋 **Transaction log is empty.**');
                }

                const last = log.slice(-100).reverse();
                const lines = last.map(entry => {
                    const date = new Date(entry.timestamp);
                    const dateStr = date.toLocaleDateString('en-GB');
                    const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                    const amount = Number(entry.goldAmount || 0);
                    const signed = amount > 0 ? `+${amount.toLocaleString()}` : amount.toLocaleString();
                    const details = entry.details ? ` | ${entry.details}` : '';
                    return `**${entry.action || 'tx'}** | <@${entry.userId}> | ${signed} gold | ${entry.reason || '-'}${details} | ${dateStr} ${timeStr}`;
                });

                const chunkSize = 15;
                const embeds = [];
                for (let i = 0; i < lines.length; i += chunkSize) {
                    const pageLines = lines.slice(i, i + chunkSize);
                    embeds.push(
                        new EmbedBuilder()
                            .setColor('#FFD700')
                            .setTitle(`📋 **Gold Transaction Log** (Last 100) — Page ${Math.floor(i / chunkSize) + 1}`)
                            .setDescription(pageLines.join('\n'))
                            .setTimestamp()
                    );
                }

                return message.reply({ embeds });
            }

            // ── Owner only: clear transaction log ────────────────
            case 'logtransactionreset': {
                if (message.author.id !== OWNER_ID) {
                    return message.reply('❌ You do not have permission to use this command.');
                }
                await db.clearTransactionLog();
                return message.reply('✅ Transaction log has been reset.');
            }

            // ── Admin + Owner: command log (last 100) ───────────
            case 'logcommands': {
                if (!(await isAuthorizedUser())) {
                    return message.reply('❌ ليس لديك صلاحية. | You don\'t have permission.');
                }

                const log = await db.getCommandLog();
                if (!log.length) {
                    return message.reply('📋 **Command log is empty.**');
                }

                const last = log.slice(-100).reverse();
                const lines = last.map(entry => {
                    const date = new Date(entry.timestamp);
                    const dateStr = date.toLocaleDateString('en-GB');
                    const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                    const argsText = (entry.args || []).join(' ');
                    const raw = String(entry.rawContent || '').replace(/\n/g, ' ').slice(0, 60);
                    const details = entry.details ? ` | ${entry.details}` : '';
                    return `**%${entry.command || '?'}** | <@${entry.userId}> | args: \`${argsText || '-'}\` | raw: \`${raw || '-'}\` | status: ${entry.status || 'n/a'}${details} | ${dateStr} ${timeStr}`;
                });

                const chunkSize = 15;
                const embeds = [];
                for (let i = 0; i < lines.length; i += chunkSize) {
                    const pageLines = lines.slice(i, i + chunkSize);
                    embeds.push(
                        new EmbedBuilder()
                            .setColor('#00CED1')
                            .setTitle(`📋 **Command Usage Log** (Last 100) — Page ${Math.floor(i / chunkSize) + 1}`)
                            .setDescription(pageLines.join('\n'))
                            .setTimestamp()
                    );
                }

                return message.reply({ embeds });
            }

            // ── Owner only: clear command log ────────────────────
            case 'logcommandsreset': {
                if (message.author.id !== OWNER_ID) {
                    return message.reply('❌ You do not have permission to use this command.');
                }
                await db.clearCommandLog();
                return message.reply('✅ Command log has been reset.');
            }

            // ── Owner: reset all users (hidden) ───────────────────
            case 'reseteverything': {
                if (message.author.id !== OWNER_ID) return;
                await db.resetAllUsers();
                // Also reset in-memory disabled command list
                disabledCommandsService.clearDisabledCommands();
                return message.reply('✅ **تم إعادة تعيين جميع المستخدمين. | All users have been reset.**').catch(() => {});
            }

            // ── Authorized: disable command ─────────────────────
            case 'disablecommand': {
                const canManage = canManageCommandState(message.author.id, OWNER_ID);
                if (!canManage) {
                    return message.reply('You do not have permission to use this command.').catch(() => {});
                }

                const targetRaw = String(args?.[0] || '').trim().toLowerCase();
                if (!targetRaw) {
                    return message.reply('Usage: `%disablecommand <commandName>`').catch(() => {});
                }

                const target = normalizeCommandName(targetRaw);

                if (!isKnownCommand(targetRaw)) {
                    return message.reply('Unknown command name.').catch(() => {});
                }

                if (PROTECTED_COMMANDS.has(target)) {
                    return message.reply('You cannot disable this command.').catch(() => {});
                }

                disabledCommandsService.disableCommand(target);
                return message.reply(`✅ Command \`%${target}\` has been disabled.`).catch(() => {});
            }

            // ── Authorized: enable command ──────────────────────
            case 'enablecommand': {
                const canManage = canManageCommandState(message.author.id, OWNER_ID);
                if (!canManage) {
                    return message.reply('You do not have permission to use this command.').catch(() => {});
                }

                const targetRaw = String(args?.[0] || '').trim().toLowerCase();
                if (!targetRaw) {
                    return message.reply('Usage: `%enablecommand <commandName>`').catch(() => {});
                }

                const target = normalizeCommandName(targetRaw);

                if (!isKnownCommand(targetRaw)) {
                    return message.reply('Unknown command name.').catch(() => {});
                }

                disabledCommandsService.enableCommand(target);
                return message.reply(`✅ Command \`%${target}\` has been enabled.`).catch(() => {});
            }

            case 'disableallcommands': {
                const canManage = canManageCommandState(message.author.id, OWNER_ID);
                if (!canManage) {
                    return;
                }

                disabledCommandsService.disableAllCommandsGlobally();
                return message.reply('✅ Global command lock enabled.').catch(() => {});
            }

            case 'enableallcommands': {
                const canManage = canManageCommandState(message.author.id, OWNER_ID);
                if (!canManage) {
                    return;
                }

                disabledCommandsService.enableAllCommandsGlobally();
                return message.reply('✅ Global command lock disabled.').catch(() => {});
            }

            default:
                return message.reply(`❌ Unknown command. اكتب \`%help\` للأوامر أو \`%command\` لجميع الأوامر.`);
        }
    } catch (err) {
        console.error('Command execution error:', err);
        if (message && typeof message.reply === 'function') {
            return message.reply('❌ Error running that command. خطأ في تنفيذ الأمر.').catch(() => {});
        }
    }
};
