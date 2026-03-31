const { ActionRowBuilder, ButtonBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { COLORS, BUTTON_STYLES, EMOJIS, FOOTER_TEXT, formatError } = require('../utils/uiConstants');

module.exports = async function (message, OWNER_ID) {
    try {
        const authorized = await db.getAuthorizedUsers();
        const isOwner    = message.author.id === OWNER_ID;

        if (!isOwner && !authorized.has(message.author.id)) {
            return message.reply(formatError('ليس لديك إذن لفتح المتجر.', 'You don\'t have permission to open the shop.'));
        }

        const embed = new EmbedBuilder()
            .setColor(COLORS.SHOP)
            .setTitle(`${EMOJIS.SHOP} **وزارة المالية | مملكة أراباستا**\n**Ministry of Finance | Kingdom of Arabasta**`)
            .setDescription(
                'مرحبًا بك في وزارة المالية! اختر ما تريد أدناه.\n' +
                'Welcome to the Ministry of Finance! Choose an option below.\n\n' +
                `> **${EMOJIS.GOLD} ذهب Gold** — يُكسب بالمحادثة | Earned by chatting\n` +
                `> **${EMOJIS.GEMS} جواهر Gems** — عملة نادرة | Rare currency\n` +
                `> **${EMOJIS.HONOR} شرف Honor** — عملة المكانة | Prestige currency\n` +
                `> **${EMOJIS.CREDIT} رصيد Credit** — رصيد بروبوت | ProBot credit`
            )
            .setFooter({ text: FOOTER_TEXT })
            .setTimestamp();

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`shop:bag:0:${message.author.id}`)
                .setLabel(`${EMOJIS.BAG} حقيبتي | My Bag`)
                .setStyle(BUTTON_STYLES.PRIMARY),
            new ButtonBuilder()
                .setCustomId(`shop:products:0:${message.author.id}`)
                .setLabel(`${EMOJIS.SHOP} قائمة المتجر | Shop Menu`)
                .setStyle(BUTTON_STYLES.SUCCESS)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`shop:currency_exchange:0:${message.author.id}`)
                .setLabel(`${EMOJIS.EXCHANGE} تحويل عملات | Exchange`)
                .setStyle(BUTTON_STYLES.SECONDARY),
            new ButtonBuilder()
                .setCustomId(`shop:role_features:0:${message.author.id}`)
                .setLabel(`${EMOJIS.ROLE} خصائص الرتب | Features`)
                .setStyle(BUTTON_STYLES.SECONDARY),
            new ButtonBuilder()
                .setCustomId(`shop:gold_credit:0:${message.author.id}`)
                .setLabel(`${EMOJIS.CREDIT} ذهب → رصيد | Gold → Credit`)
                .setStyle(BUTTON_STYLES.SECONDARY)
        );

        return message.reply({ embeds: [embed], components: [row1, row2] });
    } catch (err) {
        console.error('shop command error:', err);
        return message.reply(formatError('خطأ في تحميل المتجر.', 'Error loading shop.')).catch(() => {});
    }
};
