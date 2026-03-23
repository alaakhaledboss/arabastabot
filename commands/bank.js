const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const db = require('../db');

module.exports = async function (message, OWNER_ID) {
    try {
        const authorized = await db.getAuthorizedUsers();
        const isOwner = message.author.id === OWNER_ID;

        if (!isOwner && !authorized.has(message.author.id)) {
            return message.reply('You don\'t have permission to access the bank. ليس لديك إذن للوصول إلى البنك.');
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`bank:show:0:${message.author.id}`)
                .setLabel('Balance الرصيد')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`bank:withdraw:0:${message.author.id}`)
                .setLabel('Withdraw سحب')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`bank:deposit:0:${message.author.id}`)
                .setLabel('Deposit إيداع')
                .setStyle(ButtonStyle.Success)
        );

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('Bank Account حساب البنك')
            .setDescription('Manage the bank account. قم بإدارة حساب البنك.');

        return message.reply({ embeds: [embed], components: [row] });
    } catch (err) {
        console.error('bank command error:', err);
        return message.reply('Error loading bank. خطأ في تحميل البنك.');
    }
};