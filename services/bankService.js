const { ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { COLORS, EMOJIS, FOOTER_TEXT, formatError, createCurrencyField } = require('../utils/uiConstants');

function createModal(action, userId) {
    const modal = new ModalBuilder()
        .setCustomId(`bank:${action}:${userId}`)
        .setTitle(action === 'withdraw' ? `${EMOJIS.WITHDRAW} سحب | Withdraw` : `${EMOJIS.DEPOSIT} إيداع | Deposit`);

    // Gold input
    const goldInput = new TextInputBuilder()
        .setCustomId('gold')
        .setLabel('الذهب | Gold')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('0');

    // Gems input
    const gemsInput = new TextInputBuilder()
        .setCustomId('gems')
        .setLabel('جواهر | Gems')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('0');

    // Honor input
    const honorInput = new TextInputBuilder()
        .setCustomId('honor')
        .setLabel('شرف | Honor')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('0');

    modal.addComponents(
        new ActionRowBuilder().addComponents(goldInput),
        new ActionRowBuilder().addComponents(gemsInput),
        new ActionRowBuilder().addComponents(honorInput)
    );
    return modal;
}

async function showBalance(interaction, OWNER_ID) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const bank = await db.getBank();
        const isOwner = interaction.user.id === OWNER_ID;
        const user = await db.getUser(interaction.user.id);
        const hasAccess = isOwner || user.bank_access;

        const fields = [
            createCurrencyField(`${EMOJIS.GOLD} الذهب | Gold`, (bank.balance / 10).toLocaleString(), 'ذهب', true),
            createCurrencyField(`${EMOJIS.GEMS} جواهر | Gems`, bank.gems, 'جواهر', true),
            createCurrencyField(`${EMOJIS.HONOR} شرف | Honor`, bank.honor, 'شرف', true)
        ];

        // Only show credit if owner or has bank access
        if (hasAccess) {
            fields.push(createCurrencyField(`${EMOJIS.CREDIT} رصيد بروبوت | ProBot Credit`, bank.credit.toLocaleString(), 'رصيد', true));
        }

        const embed = new EmbedBuilder()
            .setColor(COLORS.BANK)
            .setTitle(`${EMOJIS.BANK} **رصيد البنك | Bank Balance**`)
            .addFields(...fields)
            .setFooter({ text: FOOTER_TEXT })
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('showBalance error:', err);
        return interaction.followUp({ content: formatError('خطأ في جلب الرصيد.', 'Error fetching balance.'), ephemeral: true });
    }
}

async function handleModal(interaction, action, userId, OWNER_ID) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const isOwner = interaction.user.id === OWNER_ID;
        const user = await db.getUser(interaction.user.id);
        const hasAccess = isOwner || user.bank_access;

        // Only owner and authorized users can deposit/withdraw
        if (!hasAccess) {
            return interaction.editReply({ content: formatError('لا تملك صلاحية للقيام بهذه العملية.', 'You do not have permission to perform this action.') });
        }

        // Parse all three currencies
        const goldRaw   = interaction.fields.getTextInputValue('gold');
        const gemsRaw   = interaction.fields.getTextInputValue('gems');
        const honorRaw  = interaction.fields.getTextInputValue('honor');

        const goldAmount   = parseInt(goldRaw, 10) * 10 || 0;   // display → internal units
        const gemsAmount   = parseInt(gemsRaw, 10) || 0;
        const honorAmount  = parseInt(honorRaw, 10) || 0;

        // Validate amounts
        if (isNaN(goldAmount) || isNaN(gemsAmount) || isNaN(honorAmount) || 
            goldAmount < 0 || gemsAmount < 0 || honorAmount < 0) {
            return interaction.editReply({ content: formatError('أدخل أرقامًا صحيحة.', 'Enter valid numbers.') });
        }

        // Ensure at least one currency is being transferred
        if (goldAmount === 0 && gemsAmount === 0 && honorAmount === 0) {
            return interaction.editReply({ content: formatError('يجب تحويل عملة واحدة على الأقل.', 'Transfer at least one currency.') });
        }

        const bankUser = await db.getUser(userId);
        const bank = await db.getBank();

        if (action === 'withdraw') {
            // Check bank has sufficient balances
            if (bank.balance < goldAmount || bank.gems < gemsAmount || bank.honor < honorAmount) {
                return interaction.editReply({ content: formatError('البنك لا يملك رصيد كافي 💀', 'Bank has insufficient balance 💀') });
            }
            // Withdraw from bank
            bankUser.gold    += goldAmount;
            bankUser.gems    += gemsAmount;
            bankUser.honor   += honorAmount;
            bank.balance     -= goldAmount;
            bank.gems        -= gemsAmount;
            bank.honor       -= honorAmount;
            await db.logBankAction({ userId, action: 'withdraw', amount: goldAmount / 10, extra: `gems: ${gemsAmount}, honor: ${honorAmount}` });
        }

        if (action === 'deposit') {
            // Check user has sufficient balances
            if (bankUser.gold < goldAmount || bankUser.gems < gemsAmount || bankUser.honor < honorAmount) {
                return interaction.editReply({ content: formatError('أنت لا تملك رصيد كافي 💀', 'You have insufficient balance 💀') });
            }
            // Deposit to bank
            bankUser.gold    -= goldAmount;
            bankUser.gems    -= gemsAmount;
            bankUser.honor   -= honorAmount;
            bank.balance     += goldAmount;
            bank.gems        += gemsAmount;
            bank.honor       += honorAmount;
            await db.logBankAction({ userId, action: 'deposit', amount: goldAmount / 10, extra: `gems: ${gemsAmount}, honor: ${honorAmount}` });
        }

        await db.saveUser(bankUser);
        await db.saveBank(bank);

        // Build response fields
        const fields = [];
        if (goldAmount > 0) {
            fields.push(createCurrencyField(`${EMOJIS.GOLD} الذهب | Gold`, (goldAmount / 10).toLocaleString(), 'ذهب', true));
        }
        if (gemsAmount > 0) {
            fields.push(createCurrencyField(`${EMOJIS.GEMS} الجواهر | Gems`, gemsAmount.toLocaleString(), 'جواهر', true));
        }
        if (honorAmount > 0) {
            fields.push(createCurrencyField(`${EMOJIS.HONOR} الشرف | Honor`, honorAmount.toLocaleString(), 'شرف', true));
        }

        // Add new balances
        fields.push(
            createCurrencyField(`${EMOJIS.GOLD} رصيدك الآن | Your Gold`, (bankUser.gold / 10).toLocaleString(), 'ذهب', true),
            createCurrencyField(`${EMOJIS.GEMS} جواهرك الآن | Your Gems`, bankUser.gems.toLocaleString(), 'جواهر', true),
            createCurrencyField(`${EMOJIS.HONOR} شرفك الآن | Your Honor`, bankUser.honor.toLocaleString(), 'شرف', true)
        );

        const embed = new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle(action === 'withdraw' ? `${EMOJIS.WITHDRAW} **سحب ناجح | Withdrawal Successful**` : `${EMOJIS.DEPOSIT} **إيداع ناجح | Deposit Successful**`)
            .addFields(...fields)
            .setFooter({ text: FOOTER_TEXT })
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('handleModal error:', err);
        return interaction.followUp({ content: formatError('حدث خطأ!', 'Something went wrong!'), ephemeral: true });
    }
}

module.exports = { createModal, showBalance, handleModal };
