const db = require('../db');
const { EmbedBuilder } = require('discord.js');

const bankCmd        = require('./bank');
const shopCmd        = require('./shop');
const miscCmd        = require('./misc');
const profileCmd     = require('./profile');
const leaderboardCmd = require('./leaderboard');
const permissionCmd  = require('./permission');
const convertCmd     = require('./convert');
const musicCmd       = require('./music');
const progressionCmd = require('./progression');
const testingCmd     = require('./testing');
const taskService    = require('../services/taskService');
const disabledCommandsService = require('../services/disabledCommandsService');

// ── Command normalization / aliases ──────────────────────────

const COMMAND_ALIAS_TO_CANONICAL = {
    help: 'help',
    command: 'commands',
    commands: 'commands',

    b: 'bank',
    bank: 'bank',

    s: 'shop',
    shop: 'shop',

    ping: 'ping',
    play: 'play',
    specialty: 'specialty',
    speciality: 'specialty',
    specialties: 'specialty',
    specialities: 'specialty',
    prestige: 'prestige',
    rebirth: 'rebirth',
    setlevel: 'setlevel',

    p: 'profile',
    profile: 'profile',

    t: 'tasks',
    task: 'tasks',
    tasks: 'tasks',

    lb: 'leaderboard',
    leaderboard: 'leaderboard',

    a: 'permission',
    da: 'permission',

    convert: 'convert',
    showbanklog: 'showbanklog',
    log: 'log',
    logtransaction: 'logtransaction',
    logtransactionreset: 'logtransactionreset',
    logcommands: 'logcommands',
    logcommandsreset: 'logcommandsreset',
    reseteverything: 'reseteverything',
    disablecommand: 'disablecommand',
    enablecommand: 'enablecommand'
};

const PROTECTED_COMMANDS = new Set(['disablecommand', 'enablecommand', 'reseteverything']);

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

// ── Help ──────────────────────────────────────────────────────

async function showHelp(message) {
    try {
        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('📖 **ArabastaBot Commands | أوامر البوت**')
            .addFields(
                { name: '👤 Profile | الملف الشخصي', value: '`%p` أو `%profile` [@user] — عرض الملف الشخصي', inline: false },
                { name: '🏆 Rankings | المتصدرين',   value: '`%lb` أو `%leaderboard` [xp|gold|gems|honor] — أفضل 10', inline: false },
                { name: '🛍️ Shop | المتجر',          value: '`%s` أو `%shop` — فتح المتجر (للمصرّح لهم)', inline: false },
                { name: '💰 Bank | البنك',            value: '`%b` أو `%bank` — فتح البنك (للمصرّح لهم)', inline: false },
                { name: '🗓️ Tasks | المهام',          value: '`%t` أو `%task` — تقدم المهام اليومية', inline: false },
                { name: '🎵 Music | الموسيقى',        value: '`%play` [query] — تشغيل/إضافة للأغاني مع أزرار تحكم (Pause/Skip/Stop/Queue)', inline: false },
                { name: '🧭 Progression | التقدم',     value: '`%speciality <route>` — لوحة اختيار التخصص\n`%prestige` — لوحة الانتقال\n`%rebirth` — لوحة إعادة الولادة', inline: false },
                { name: '🧪 Testing | الاختبار',        value: '`%setlevel @user <value>` — ضبط المستوى للاختبار (Owner/Authorized)', inline: false },
                { name: '🔧 Utility | أدوات',         value: '`%ping` — التحقق من البوت\n`%convert` [@user] — تحويل لوحة المفاتيح', inline: false }
            )
            .setFooter({ text: 'ArabastaBot | وزارة المالية • مملكة أراباستا' })
            .setTimestamp();

        return message.reply({ embeds: [embed] });
    } catch (err) {
        console.error('showHelp error:', err);
        return message.reply('❌ Error displaying help. خطأ في عرض المساعدة.').catch(() => {});
    }
}

async function showAllCommands(message, OWNER_ID) {
    try {
        const isOwner = message.author.id === OWNER_ID;
        const authorized = await db.getAuthorizedUsers();
        const isAdmin = isOwner || authorized.has(message.author.id);

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('📖 **ArabastaBot — All Commands | جميع الأوامر**')
            .addFields(
                { name: '👤 Profile | الملف الشخصي', value: '`%p` / `%profile` [@user]\n`%lb` / `%leaderboard` [xp|gold|gems|honor]', inline: false },
                { name: '🛍️ Shop | المتجر',           value: '`%s` / `%shop` — المتجر (للمصرّح لهم فقط)', inline: false },
                { name: '💰 Bank | البنك',             value: '`%b` / `%bank` — البنك (للمصرّح لهم فقط)', inline: false },
                { name: '�️ Tasks | المهام',          value: '`%t` / `%task` / `%tasks` — عرض تقدم المهام اليومية', inline: false },
                { name: '🎵 Music | الموسيقى',        value: '`%play` [query] — play or queue YouTube tracks with button controls', inline: false },
                { name: '🧭 Progression',             value: '`%speciality <route>` `%prestige` `%rebirth`', inline: false },
                { name: '🧪 Testing',                 value: '`%setlevel @user <value>` (Owner/Authorized)', inline: false },
                { name: '�🔧 Utility | أدوات',          value: '`%ping` `%help` `%command` `%convert` [@user]', inline: false }
            );

        if (isAdmin) {
            embed.addFields({
                name: '🛡️ Admin Commands | أوامر الإدارة',
                value: '`%a @user` — منح الصلاحية الخاصة | Grant special authorization\n`%da @user` — سحب الصلاحية الخاصة | Revoke special authorization\n`%log` — سجل تحويل العملات',
                inline: false
            });
        }

        if (isOwner) {
            embed.addFields({
                name: '👑 Owner Commands | أوامر المالك',
                value: '`%bank` → Credit buttons | البنك → أزرار إدارة الرصيد\n`%showbanklog` — سجل البنك الكامل\n`%reseteverything` — إعادة تعيين جميع المستخدمين',
                inline: false
            });
        }

        embed.setFooter({ text: isOwner ? '👑 You are the owner | أنت المالك' : 'Contact owner for admin access' })
             .setTimestamp();

        return message.reply({ embeds: [embed] });
    } catch (err) {
        console.error('showAllCommands error:', err);
        return message.reply('❌ Error displaying commands.').catch(() => {});
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
        if (disabledCommandsService.isCommandDisabled(commandName)) {
            return message.reply('This command is currently disabled.').catch(() => {});
        }

        switch (rawCommand) {

            case 'help':
                return await showHelp(message);

            case 'command':
            case 'commands':
            case '':
                return await showAllCommands(message, OWNER_ID);

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

                case 'specialty':
                case 'speciality':
                case 'specialties':
                case 'specialities': {
                    const authorized = await db.getAuthorizedUsers();
                    const isAllowed = message.author.id === OWNER_ID || authorized.has(message.author.id);
                    if (!isAllowed) {
                        return message.reply('❌ ليس لديك صلاحية لاستخدام أوامر التقدم. | You do not have permission to use progression commands.');
                    }
                    return await progressionCmd.specialty(message, args);
                }

                case 'prestige': {
                    const authorized = await db.getAuthorizedUsers();
                    const isAllowed = message.author.id === OWNER_ID || authorized.has(message.author.id);
                    if (!isAllowed) {
                        return message.reply('❌ ليس لديك صلاحية لاستخدام أوامر التقدم. | You do not have permission to use progression commands.');
                    }
                    return await progressionCmd.prestige(message, args);
                }

                case 'rebirth': {
                    const authorized = await db.getAuthorizedUsers();
                    const isAllowed = message.author.id === OWNER_ID || authorized.has(message.author.id);
                    if (!isAllowed) {
                        return message.reply('❌ ليس لديك صلاحية لاستخدام أوامر التقدم. | You do not have permission to use progression commands.');
                    }
                    return await progressionCmd.rebirth(message, args);
                }

                case 'setlevel': {
                    const authorized = await db.getAuthorizedUsers();
                    const isAllowed = message.author.id === OWNER_ID || authorized.has(message.author.id);
                    if (!isAllowed) {
                        return message.reply('❌ You do not have permission to use testing commands.');
                    }
                    return await testingCmd.setLevel(message, args);
                }

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
                const authorized = await db.getAuthorizedUsers();
                if (message.author.id !== OWNER_ID && !authorized.has(message.author.id)) {
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
                const authorized = await db.getAuthorizedUsers();
                if (message.author.id !== OWNER_ID && !authorized.has(message.author.id)) {
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
                const authorized = await db.getAuthorizedUsers();
                if (message.author.id !== OWNER_ID && !authorized.has(message.author.id)) {
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
