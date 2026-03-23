const { EmbedBuilder } = require('discord.js');
const db = require('../db');

module.exports = async (message, args) => {
    try {
        const targetId = args[0]?.replace(/<@!?|>/g, '') || message.author.id;
        const discordUser = await message.client.users.fetch(targetId).catch(() => null);

        if (!discordUser) {
            return message.reply('User not found. المستخدم غير موجود.');
        }

        const user = await db.getUser(targetId);
        const xpNeeded = 100 * user.level;

        // simple ASCII-style progress bar
        const filled = Math.round((user.xp / xpNeeded) * 10);
        const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle(`${discordUser.username}'s Profile`)
            .setThumbnail(discordUser.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: 'Level المستوى', value: `${user.level}`, inline: true },
                { name: 'XP', value: `${user.xp} / ${xpNeeded}\n[${bar}]`, inline: true },
                { name: 'Gold ذهب', value: `${user.gold / 10}`, inline: true },
                { name: 'Gems جواهر', value: `${user.gems}`, inline: true },
                { name: 'Honor شرف', value: `${user.honor}`, inline: true }
            )
            .setFooter({ text: 'ArabastaBot • Profile' })
            .setTimestamp();

        return message.reply({ embeds: [embed] });
    } catch (err) {
        console.error('profile error:', err);
        return message.reply('Error loading profile. خطأ في تحميل الملف الشخصي.');
    }
};