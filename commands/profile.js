const { EmbedBuilder } = require('discord.js');
const db = require('../db');
const progressionService = require('../services/progressionService');
const { COLORS, EMOJIS, FOOTER_TEXT, formatError } = require('../utils/uiConstants');

module.exports = async (message, args) => {
    try {
        const targetId = args[0]?.replace(/<@!?|>/g, '') || message.author.id;
        const discordUser = await message.client.users.fetch(targetId).catch(() => null);

        if (!discordUser) {
            return message.reply(formatError('المستخدم غير موجود.', 'User not found.'));
        }

        const user = await db.getUser(targetId);
        const xpNeeded = 100 * user.level;
        const targetMember = message.guild
            ? await message.guild.members.fetch(targetId).catch(() => null)
            : null;
        const routeInfo = progressionService.getRouteLevelInfo(targetMember);
        const routeText = routeInfo.route
            ? `${routeInfo.route} • ${routeInfo.levelName || 'unknown'}`
            : 'Not assigned';

        // simple ASCII-style progress bar
        const filled = Math.round((user.xp / xpNeeded) * 10);
        const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

        const embed = new EmbedBuilder()
            .setColor(COLORS.PROFILE)
            .setTitle(`${EMOJIS.PROFILE} **${discordUser.username}**`)
            .setThumbnail(discordUser.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: `${EMOJIS.LEVEL} المستوى | Level`, value: `**${user.level}**`, inline: true },
                { name: '🧭 Route | المسار', value: `**${routeText}**`, inline: true },
                { name: `${EMOJIS.XP} XP Progress`, value: `**${user.xp}** / ${xpNeeded}\n[${bar}]`, inline: false },
                { name: `${EMOJIS.GOLD} ذهب | Gold`, value: `**${(user.gold / 10).toLocaleString()}**`, inline: true },
                { name: `${EMOJIS.GEMS} جواهر | Gems`, value: `**${user.gems}**`, inline: true },
                { name: `${EMOJIS.HONOR} شرف | Honor`, value: `**${user.honor}**`, inline: true }
            )
            .setFooter({ text: FOOTER_TEXT })
            .setTimestamp();

        return message.reply({ embeds: [embed] });
    } catch (err) {
        console.error('profile error:', err);
        return message.reply(formatError('خطأ في تحميل الملف الشخصي.', 'Error loading profile.'));
    }
};