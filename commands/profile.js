const { EmbedBuilder } = require('discord.js');
const db = require('../db');
const gearService = require('../services/gearService');
const { COLORS, EMOJIS, FOOTER_TEXT, formatError } = require('../utils/uiConstants');

function buildHpBar(hp) {
    const value = Math.max(0, Math.min(100, Number(hp || 0)));
    const filled = Math.round(value / 10);
    return `${'█'.repeat(filled)}${'░'.repeat(10 - filled)}`;
}

module.exports = async (message, args) => {
    try {
        const targetId = args[0]?.replace(/<@!?|>/g, '') || message.author.id;
        const discordUser = await message.client.users.fetch(targetId).catch(() => null);

        if (!discordUser) {
            return message.reply(formatError('المستخدم غير موجود.', 'User not found.'));
        }

        const user = gearService.ensureGearFields(await db.getUser(targetId));
        const displayLevel = Math.max(1, Number(user.level || 1));
        const xpNeeded = 100 * displayLevel;
        const routeText = user.path || user.currentRoute || 'Not assigned';
        const specializationText = user.specialization || user.currentSpecialty || 'Not assigned';
        const hpValue = Number(user.hp ?? 100);
        const hpBar = buildHpBar(hpValue);

        const gearText = [
            `Helmet: ${user.gearEquipment?.helmet || 'Empty'}`,
            `Suit: ${user.gearEquipment?.chest || 'Empty'}`,
            `Pants: ${user.gearEquipment?.pants || 'Empty'}`,
            `Shoes: ${user.gearEquipment?.shoes || 'Empty'}`,
            `Weapon: ${user.gearEquipment?.weapon || 'Empty'}`,
            `Shield: ${user.gearEquipment?.shield || 'Empty'}`
        ].join('\n');

        const filled = Math.max(0, Math.min(10, Math.round((Number(user.xp || 0) / xpNeeded) * 10)));
        const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

        const embed = new EmbedBuilder()
            .setColor(COLORS.PROFILE)
            .setTitle(`${EMOJIS.PROFILE} **${discordUser.username}**`)
            .setThumbnail(discordUser.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: `${EMOJIS.LEVEL} Level`, value: `**${user.level}**`, inline: true },
                { name: '🧭 Route', value: `**${routeText}**`, inline: true },
                { name: '🎯 Specialization', value: `**${specializationText}**`, inline: true },
                { name: '❤️ HP Status', value: `**${hpValue}/100 HP**\n[${hpBar}]`, inline: false },
                { name: `${EMOJIS.XP} XP Progress`, value: `**${user.xp}** / ${xpNeeded}\n[${bar}]`, inline: false },
                { name: `${EMOJIS.GOLD} ذهب | Gold`, value: `**${(user.gold / 10).toLocaleString()}**`, inline: true },
                { name: `${EMOJIS.GEMS} جواهر | Gems`, value: `**${user.gems}**`, inline: true },
                { name: `${EMOJIS.HONOR} شرف | Honor`, value: `**${user.honor}**`, inline: true },
                { name: '🧰 Gear | العتاد', value: gearText, inline: false }
            )
            .setFooter({ text: FOOTER_TEXT })
            .setTimestamp();

        return message.reply({ embeds: [embed] });
    } catch (err) {
        console.error('profile error:', err);
        return message.reply(formatError('خطأ في تحميل الملف الشخصي.', 'Error loading profile.'));
    }
};