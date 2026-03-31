const { EmbedBuilder } = require('discord.js');
const db = require('../db');
const { COLORS, EMOJIS, FOOTER_TEXT, formatError } = require('../utils/uiConstants');

const VALID_FIELDS = ['xp', 'gold', 'gems', 'honor'];

module.exports = async (message, args) => {
    const field = args[0]?.toLowerCase() || 'xp';

    if (!VALID_FIELDS.includes(field)) {
        return message.reply(
            `${formatError('حقل غير صالح.', 'Invalid field.')}\n` +
            `استخدم أحد: ${VALID_FIELDS.join(', ')}`
        );
    }

    try {
        const users = await db.getLeaderboard(field, 10);

        if (!users.length) {
            return message.reply(formatError('لا توجد بيانات بعد.', 'No data yet.'));
        }

        const lines = await Promise.all(users.map(async (u, i) => {
            const discordUser = await message.client.users.fetch(u.user_id).catch(() => null);
            const name = discordUser?.username || `Unknown (${u.user_id})`;
            const value = field === 'xp' ? u.totalField : u[field];
            return `**${i + 1}.** ${name} — **${value.toLocaleString()}**`;
        }));

        const fieldEmoji = {
            xp: EMOJIS.XP,
            gold: EMOJIS.GOLD,
            gems: EMOJIS.GEMS,
            honor: EMOJIS.HONOR
        }[field] || EMOJIS.TROPHY;

        const embed = new EmbedBuilder()
            .setColor(COLORS.PRIMARY)
            .setTitle(`${EMOJIS.TROPHY} **تصنيف أفضل 10 | Top 10 Leaderboard**`)
            .setDescription(
                `**${fieldEmoji} ${field.toUpperCase()}**\n\n` +
                lines.join('\n')
            )
            .setFooter({ text: FOOTER_TEXT })
            .setTimestamp();

        return message.reply({ embeds: [embed] });
    } catch (err) {
        console.error('leaderboard error:', err);
        return message.reply(formatError('خطأ في تحميل المتصدرين.', 'Error fetching leaderboard.'));
    }
};