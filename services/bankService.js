const { ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');
const db = require('../db');

function createModal(action, userId) {
    const modal = new ModalBuilder()
        .setCustomId(`bank:${action}:${userId}`)
        .setTitle(action === 'withdraw' ? 'Withdraw سحب' : 'Deposit إيداع');

    const input = new TextInputBuilder()
        .setCustomId('amount')
        .setLabel('Amount (gold) الكمية')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
}

async function showBalance(interaction) {
    try {
        const bank = await db.getBank();
        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('Bank Balance رصيد البنك')
            .addFields({ name: 'Balance الرصيد', value: `${bank.balance / 10} gold ذهب` })
            .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
        console.error('showBalance error:', err);
        return interaction.reply({ content: 'Error fetching balance.', ephemeral: true });
    }
}

async function handleModal(interaction, action, userId) {
    try {
        const raw = interaction.fields.getTextInputValue('amount');
        const amount = parseInt(raw, 10) * 10; // convert display gold → internal units

        if (isNaN(amount) || amount <= 0) {
            return interaction.reply({ content: 'Invalid amount. أدخل رقمًا صحيحًا أكبر من صفر.', ephemeral: true });
        }

        const user = await db.getUser(userId);
        const bank = await db.getBank();

        if (action === 'withdraw') {
            if (bank.balance < amount) {
                return interaction.reply({ content: 'Bank is broke 💀 البنك مفلس', ephemeral: true });
            }
            user.gold += amount;
            bank.balance -= amount;
        }

        if (action === 'deposit') {
            if (user.gold < amount) {
                return interaction.reply({ content: 'You are broke 💀 أنت مفلس', ephemeral: true });
            }
            user.gold -= amount;
            bank.balance += amount;
        }

        await db.saveUser(user);
        await db.saveBank(bank);

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle(action === 'withdraw' ? 'Withdrawal سحب' : 'Deposit إيداع')
            .addFields(
                { name: 'Amount الكمية', value: `${amount / 10} gold ذهب`, inline: true },
                { name: 'Your gold ذهبك', value: `${user.gold / 10}`, inline: true }
            )
            .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
        console.error('handleModal error:', err);
        return interaction.reply({ content: 'Something went wrong.', ephemeral: true });
    }
}

module.exports = { createModal, showBalance, handleModal };