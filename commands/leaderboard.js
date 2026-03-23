const { EmbedBuilder } = require('discord.js');
const db = require('../db');

const VALID_FIELDS = ['xp', 'gold', 'gems', 'honor'];

module.exports = async (message, args) => {
    const field = args[0]?.toLowerCase() || 'xp';

    if (!VALID_FIELDS.includes(field)) {
        return message.reply(`Invalid field. Use one of: ${VALID_FIELDS.join(', ')}\nاستخدم أحد: ${VALID_FIELDS.join(', ')}`);
    }

    try {
        const users = await db.getLeaderboard(field, 10);

        if (!users.length) {
            return message.reply('No data yet. لا توجد بيانات بعد.');
        }

        const lines = await Promise.all(users.map(async (u, i) => {
            const discordUser = await message.client.users.fetch(u.user_id).catch(() => null);
            const name = discordUser?.username || `Unknown (${u.user_id})`;
            const value = field === 'xp' ? u.totalField : u[field];
            return `**${i + 1}.** ${name} — ${value}`;
        }));

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle(`🏆 Top 10 — ${field.toUpperCase()}`)
            .setDescription(lines.join('\n'))
            .setTimestamp();

        return message.reply({ embeds: [embed] });
    } catch (err) {
        console.error('leaderboard error:', err);
        return message.reply('Error fetching leaderboard. خطأ في تحميل المتصدرين.');
    }
};