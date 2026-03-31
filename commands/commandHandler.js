const db = require('../db');
const { EmbedBuilder } = require('discord.js');

const bankCmd        = require('./bank');
const shopCmd        = require('./shop');
const miscCmd        = require('./misc');
const profileCmd     = require('./profile');
const leaderboardCmd = require('./leaderboard');
const permissionCmd  = require('./permission');
const convertCmd     = require('./convert');

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
                { name: '🔧 Utility | أدوات',          value: '`%ping` `%help` `%command` `%convert` [@user]', inline: false }
            );

        if (isAdmin) {
            embed.addFields({
                name: '🛡️ Admin Commands | أوامر الإدارة',
                value: '`%a @user` — منح صلاحية المتجر/البنك\n`%da @user` — سحب الصلاحية\n`%log` — سجل تحويل العملات',
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

        switch (cmd) {

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

            case 'p':
            case 'profile':
                return await profileCmd(message, args);

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

            // ── Owner: reset all users (hidden) ───────────────────
            case 'reseteverything': {
                if (message.author.id !== OWNER_ID) return;
                await db.resetAllUsers();
                return message.reply('✅ **تم إعادة تعيين جميع المستخدمين. | All users have been reset.**').catch(() => {});
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
