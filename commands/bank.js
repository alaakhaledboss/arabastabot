const { ActionRowBuilder, ButtonBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { COLORS, BUTTON_STYLES, EMOJIS, FOOTER_TEXT, formatError } = require('../utils/uiConstants');

module.exports = async function (message, OWNER_ID) {
    try {
        const authorized = await db.getAuthorizedUsers();
        const isOwner = message.author.id === OWNER_ID;

        if (!isOwner && !authorized.has(message.author.id)) {
            return message.reply(formatError('ليس لديك إذن للوصول إلى البنك.', 'You don\'t have permission to access the bank.'));
        }

        // Row 1: Main bank operations (for all authorized users)
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`bank:show:0:${message.author.id}`)
                .setLabel(`${EMOJIS.BANK} الرصيد | Balance`)
                .setStyle(BUTTON_STYLES.SECONDARY),
            new ButtonBuilder()
                .setCustomId(`bank:withdraw:0:${message.author.id}`)
                .setLabel(`${EMOJIS.WITHDRAW} سحب | Withdraw`)
                .setStyle(BUTTON_STYLES.PRIMARY),
            new ButtonBuilder()
                .setCustomId(`bank:deposit:0:${message.author.id}`)
                .setLabel(`${EMOJIS.DEPOSIT} إيداع | Deposit`)
                .setStyle(BUTTON_STYLES.SUCCESS)
        );

        const embed = new EmbedBuilder()
            .setColor(COLORS.BANK)
            .setTitle(`${EMOJIS.BANK} **حساب البنك | Bank Account**`)
            .setDescription('قم بإدارة حساب البنك.\nManage your bank account.')
            .addFields(
                { name: `${EMOJIS.INFO} معلومات | Information`, value: isOwner ? '🔓 أنت المالك | You are the owner' : '🔒 مستخدم مصرح | Authorized user', inline: false }
            )
            .setFooter({ text: FOOTER_TEXT })
            .setTimestamp();

        return message.reply({ embeds: [embed], components: [row1] });
    } catch (err) {
        console.error('bank command error:', err);
        return message.reply(formatError('خطأ في تحميل البنك.', 'Error loading bank.'));
    }
};