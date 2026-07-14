const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');
const db = require('../db');
const { COLORS, BUTTON_STYLES, FOOTER_TEXT, EMOJIS, formatError } = require('../utils/uiConstants');

const OWNER_ID = process.env.OWNER_ID || '1156642624770424902';
const PAY_TIMEOUT_MS = 5 * 60 * 1000;

const pendingTransfers = new Map();
const pendingGives = new Map();

function normalizeCurrency(input) {
    const key = String(input || '').trim().toLowerCase();
    if (key === 'gold' || key === 'gems' || key === 'honor') return key;
    return null;
}

function parsePositiveInt(input) {
    const parsed = Number(String(input || '').trim());
    if (!Number.isFinite(parsed)) return null;
    if (!Number.isInteger(parsed) || parsed <= 0) return null;
    return parsed;
}

function getCurrencyMeta(currency) {
    if (currency === 'gold') {
        return {
            userField: 'gold',
            bankField: 'balance',
            emoji: EMOJIS.GOLD,
            labelEn: 'Gold',
            labelAr: 'ذهب',
            toInternal: (display) => display * 10,
            toDisplay: (internal) => internal / 10
        };
    }

    if (currency === 'gems') {
        return {
            userField: 'gems',
            bankField: 'gems',
            emoji: EMOJIS.GEMS,
            labelEn: 'Gems',
            labelAr: 'جواهر',
            toInternal: (display) => display,
            toDisplay: (internal) => internal
        };
    }

    return {
        userField: 'honor',
        bankField: 'honor',
        emoji: EMOJIS.HONOR,
        labelEn: 'Honor',
        labelAr: 'شرف',
        toInternal: (display) => display,
        toDisplay: (internal) => internal
    };
}

function buildConfirmRow(customId, disabled = false) {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(customId)
                .setLabel('✅ Confirm | تأكيد')
                .setStyle(BUTTON_STYLES.SUCCESS)
                .setDisabled(disabled)
        )
    ];
}

function buildClaimRow(customId, disabled = false) {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(customId)
                .setLabel('🎁 Claim | استلام')
                .setStyle(BUTTON_STYLES.PRIMARY)
                .setDisabled(disabled)
        )
    ];
}

function buildRequestEmbed({ requesterId, approverId, currency, amountDisplay }) {
    const meta = getCurrencyMeta(currency);
    return new EmbedBuilder()
        .setColor(COLORS.BANK)
        .setTitle(`${EMOJIS.TRANSFER} Manual Transfer Request | طلب تحويل يدوي`)
        .setDescription([
            `A manual transfer approval is required from <@${approverId}>.`,
            `يتطلب التحويل اليدوي موافقة من <@${approverId}>.`
        ].join('\n'))
        .addFields(
            { name: 'Requester | مقدم الطلب', value: `<@${requesterId}>`, inline: true },
            { name: 'Approver | المعتمد', value: `<@${approverId}>`, inline: true },
            { name: 'Currency | العملة', value: `${meta.emoji} ${meta.labelEn} | ${meta.labelAr}`, inline: true },
            { name: 'Amount | القيمة', value: `**${amountDisplay.toLocaleString()}**`, inline: true },
            { name: 'Action | الإجراء', value: 'Confirm to move amount from requester to bank.\nقم بالتأكيد لتحويل المبلغ من مقدم الطلب إلى البنك.', inline: false }
        )
        .setFooter({ text: FOOTER_TEXT })
        .setTimestamp();
}

function buildResolvedEmbed({ baseEmbed, statusEn, statusAr, approverId }) {
    const clone = EmbedBuilder.from(baseEmbed);
    clone.addFields({
        name: 'Status | الحالة',
        value: `${statusEn}\n${statusAr}${approverId ? `\nApproved by <@${approverId}>` : ''}`,
        inline: false
    });
    clone.setTimestamp();
    return clone;
}

function buildGiveRequestEmbed({ giverId, recipientId, currency, amountDisplay }) {
    const meta = getCurrencyMeta(currency);
    return new EmbedBuilder()
        .setColor(COLORS.BANK)
        .setTitle(`${EMOJIS.TRANSFER} Bank Give Request | طلب منح من البنك`)
        .setDescription([
            `<@${recipientId}> must press **Claim** to receive this amount from the bank.`,
            `يجب على <@${recipientId}> الضغط على **Claim** لاستلام هذا المبلغ من البنك.`
        ].join('\n'))
        .addFields(
            { name: 'Given By | بواسطة', value: `<@${giverId}>`, inline: true },
            { name: 'Recipient | المستلم', value: `<@${recipientId}>`, inline: true },
            { name: 'Currency | العملة', value: `${meta.emoji} ${meta.labelEn} | ${meta.labelAr}`, inline: true },
            { name: 'Amount | القيمة', value: `**${amountDisplay.toLocaleString()}**`, inline: true },
            { name: 'Source | المصدر', value: 'Bank balance | رصيد البنك', inline: true }
        )
        .setFooter({ text: FOOTER_TEXT })
        .setTimestamp();
}

async function createPayRequest(message, args, ownerId = OWNER_ID) {
    if (!message?.guild || !message?.author) {
        return { ok: false, reply: formatError('هذا الأمر يعمل داخل السيرفر فقط.', 'This command can only be used in a server.') };
    }

    const authorized = await db.getAuthorizedUsers();
    const isAllowed = message.author.id === ownerId || authorized.has(message.author.id);
    if (!isAllowed) {
        return { ok: false, reply: formatError('ليس لديك صلاحية استخدام أمر التحويل اليدوي.', 'You are not allowed to use manual transfer commands.') };
    }

    const currency = normalizeCurrency(args?.[0]);
    if (!currency) {
        return { ok: false, reply: formatError('الاستخدام: %pay gold|gems|honor @user <value>', 'Usage: %pay gold|gems|honor @user <value>') };
    }

    const approverId = args?.[1]?.replace(/<@!?|>/g, '');
    if (!approverId || !/^\d+$/.test(approverId)) {
        return { ok: false, reply: formatError('يرجى منشن مستخدم صحيح للتأكيد.', 'Please mention a valid user to confirm.') };
    }

    const approverMember = await message.guild.members.fetch(approverId).catch(() => null);
    if (!approverMember) {
        return { ok: false, reply: formatError('المستخدم المطلوب غير موجود في السيرفر.', 'The requested approver is not in this server.') };
    }

    if (approverId === message.author.id) {
        return { ok: false, reply: formatError('لا يمكنك اعتماد طلبك بنفسك.', 'You cannot approve your own transfer request.') };
    }

    const amountDisplay = parsePositiveInt(args?.[2]);
    if (!amountDisplay) {
        return { ok: false, reply: formatError('القيمة يجب أن تكون رقم صحيح أكبر من 0.', 'Amount must be a whole number greater than 0.') };
    }

    const requestId = `${Date.now()}_${message.author.id}_${Math.floor(Math.random() * 1000)}`;
    const buttonId = `pay:confirm:${requestId}`;

    const embed = buildRequestEmbed({
        requesterId: message.author.id,
        approverId,
        currency,
        amountDisplay
    });

    const sent = await message.reply({
        content: `Waiting for confirmation from <@${approverId}>.\nبانتظار تأكيد <@${approverId}>.`,
        embeds: [embed],
        components: buildConfirmRow(buttonId, false)
    });

    const meta = getCurrencyMeta(currency);
    const amountInternal = meta.toInternal(amountDisplay);

    const timeoutId = setTimeout(async () => {
        const pending = pendingTransfers.get(requestId);
        if (!pending) return;

        pendingTransfers.delete(requestId);

        const timedOutEmbed = buildResolvedEmbed({
            baseEmbed: pending.embed,
            statusEn: 'Request timed out (no confirmation).',
            statusAr: 'انتهت مهلة الطلب بدون تأكيد.'
        });

        await pending.message.edit({
            embeds: [timedOutEmbed],
            components: buildConfirmRow(pending.buttonId, true)
        }).catch(() => {});
    }, PAY_TIMEOUT_MS);

    pendingTransfers.set(requestId, {
        requestId,
        buttonId,
        message: sent,
        requesterId: message.author.id,
        approverId,
        currency,
        amountInternal,
        amountDisplay,
        embed,
        timeoutId,
        createdAt: Date.now()
    });

    return { ok: true };
}

async function createGiveRequest(message, args, ownerId = OWNER_ID) {
    if (!message?.guild || !message?.author) {
        return { ok: false, reply: formatError('هذا الأمر يعمل داخل السيرفر فقط.', 'This command can only be used in a server.') };
    }

    const authorized = await db.getAuthorizedUsers();
    const isAllowed = message.author.id === ownerId || authorized.has(message.author.id);
    if (!isAllowed) {
        return { ok: false, reply: formatError('ليس لديك صلاحية استخدام أمر المنح.', 'You are not allowed to use give commands.') };
    }

    const currency = normalizeCurrency(args?.[0]);
    if (!currency) {
        return { ok: false, reply: formatError('الاستخدام: %give gold|gems|honor @user <value>', 'Usage: %give gold|gems|honor @user <value>') };
    }

    const recipientId = args?.[1]?.replace(/<@!?|>/g, '');
    if (!recipientId || !/^\d+$/.test(recipientId)) {
        return { ok: false, reply: formatError('يرجى منشن مستخدم صحيح للاستلام.', 'Please mention a valid user to receive.') };
    }

    const recipientMember = await message.guild.members.fetch(recipientId).catch(() => null);
    if (!recipientMember) {
        return { ok: false, reply: formatError('المستخدم المطلوب غير موجود في السيرفر.', 'The requested recipient is not in this server.') };
    }

    if (recipientMember.user?.bot) {
        return { ok: false, reply: formatError('لا يمكن منح العملات للبوتات.', 'You cannot give currency to bots.') };
    }

    const amountDisplay = parsePositiveInt(args?.[2]);
    if (!amountDisplay) {
        return { ok: false, reply: formatError('القيمة يجب أن تكون رقم صحيح أكبر من 0.', 'Amount must be a whole number greater than 0.') };
    }

    const meta = getCurrencyMeta(currency);
    const amountInternal = meta.toInternal(amountDisplay);

    const bank = await db.getBank();
    const bankBalance = Number(bank[meta.bankField] || 0);
    if (bankBalance < amountInternal) {
        return {
            ok: false,
            reply: formatError(
                'رصيد البنك غير كافٍ لهذه المنحة.',
                `Bank has insufficient ${meta.labelEn.toLowerCase()} for this give request.`
            )
        };
    }

    const requestId = `${Date.now()}_${message.author.id}_${Math.floor(Math.random() * 1000)}`;
    const buttonId = `give:claim:${requestId}`;

    const embed = buildGiveRequestEmbed({
        giverId: message.author.id,
        recipientId,
        currency,
        amountDisplay
    });

    const sent = await message.reply({
        content: `Gift prepared for <@${recipientId}>. Press **Claim** to receive.\nتم تجهيز المنحة لـ <@${recipientId}>. اضغط **Claim** للاستلام.`,
        embeds: [embed],
        components: buildClaimRow(buttonId, false)
    });

    const timeoutId = setTimeout(async () => {
        const pending = pendingGives.get(requestId);
        if (!pending) return;

        pendingGives.delete(requestId);

        const timedOutEmbed = buildResolvedEmbed({
            baseEmbed: pending.embed,
            statusEn: 'Claim timed out (not claimed in time).',
            statusAr: 'انتهت مهلة الاستلام بدون Claim.'
        });

        await pending.message.edit({
            embeds: [timedOutEmbed],
            components: buildClaimRow(pending.buttonId, true)
        }).catch(() => {});
    }, PAY_TIMEOUT_MS);

    pendingGives.set(requestId, {
        requestId,
        buttonId,
        message: sent,
        giverId: message.author.id,
        recipientId,
        currency,
        amountInternal,
        amountDisplay,
        embed,
        timeoutId,
        createdAt: Date.now()
    });

    return { ok: true };
}

async function handleConfirmInteraction(interaction) {
    const parts = String(interaction.customId || '').split(':');
    if (parts[0] !== 'pay' || parts[1] !== 'confirm') return false;

    const requestId = parts[2];
    const pending = pendingTransfers.get(requestId);
    if (!pending) {
        await interaction.reply({
            content: formatError('هذا الطلب غير متاح أو انتهت صلاحيته.', 'This request is no longer available or has expired.'),
            ephemeral: true
        }).catch(() => {});
        return true;
    }

    if (interaction.user.id !== pending.approverId) {
        await interaction.reply({
            content: formatError('فقط المستخدم المطلوب يمكنه تأكيد هذا الطلب.', 'Only the requested user can confirm this transfer.'),
            ephemeral: true
        }).catch(() => {});
        return true;
    }

    const requester = await db.getUser(pending.requesterId);
    const bank = await db.getBank();
    const meta = getCurrencyMeta(pending.currency);

    const requesterBalance = Number(requester[meta.userField] || 0);
    if (requesterBalance < pending.amountInternal) {
        await interaction.reply({
            content: formatError('رصيد مقدم الطلب غير كافٍ عند التأكيد.', 'Requester balance is insufficient at confirmation time.'),
            ephemeral: true
        }).catch(() => {});
        return true;
    }

    requester[meta.userField] = requesterBalance - pending.amountInternal;
    bank[meta.bankField] = Number(bank[meta.bankField] || 0) + pending.amountInternal;

    await db.saveUser(requester);
    await db.saveBank(bank);

    await db.logBankAction({
        userId: pending.requesterId,
        action: `manual_pay_${pending.currency}`,
        amount: pending.amountDisplay,
        extra: `approved_by:${interaction.user.id}`
    });

    await db.logTransaction({
        userId: pending.requesterId,
        action: 'manual_pay_to_bank',
        goldAmount: pending.currency === 'gold' ? -pending.amountDisplay : 0,
        reason: `Manual pay (${pending.currency}) approved`,
        details: `currency:${pending.currency} amount:${pending.amountDisplay} approved_by:${interaction.user.id}`
    });

    clearTimeout(pending.timeoutId);
    pendingTransfers.delete(requestId);

    const approvedEmbed = buildResolvedEmbed({
        baseEmbed: pending.embed,
        statusEn: 'Transfer approved and processed.',
        statusAr: 'تم اعتماد التحويل وتنفيذه.',
        approverId: interaction.user.id
    });

    await interaction.update({
        embeds: [approvedEmbed],
        components: buildConfirmRow(pending.buttonId, true)
    }).catch(async () => {
        await pending.message.edit({
            embeds: [approvedEmbed],
            components: buildConfirmRow(pending.buttonId, true)
        }).catch(() => {});
    });

    return true;
}

async function handleGiveClaimInteraction(interaction) {
    const parts = String(interaction.customId || '').split(':');
    if (parts[0] !== 'give' || parts[1] !== 'claim') return false;

    const requestId = parts[2];
    const pending = pendingGives.get(requestId);
    if (!pending) {
        await interaction.reply({
            content: formatError('هذا الطلب غير متاح أو انتهت صلاحيته.', 'This give request is no longer available or has expired.'),
            ephemeral: true
        }).catch(() => {});
        return true;
    }

    if (interaction.user.id !== pending.recipientId) {
        await interaction.reply({
            content: formatError('فقط المستلم المحدد يمكنه استلام هذه المنحة.', 'Only the specified recipient can claim this give request.'),
            ephemeral: true
        }).catch(() => {});
        return true;
    }

    const recipient = await db.getUser(pending.recipientId);
    const bank = await db.getBank();
    const meta = getCurrencyMeta(pending.currency);

    const bankBalance = Number(bank[meta.bankField] || 0);
    if (bankBalance < pending.amountInternal) {
        await interaction.reply({
            content: formatError('رصيد البنك غير كافٍ الآن لتنفيذ المنحة.', 'Bank balance is insufficient now to process this give request.'),
            ephemeral: true
        }).catch(() => {});
        return true;
    }

    bank[meta.bankField] = bankBalance - pending.amountInternal;
    recipient[meta.userField] = Number(recipient[meta.userField] || 0) + pending.amountInternal;

    await db.saveBank(bank);
    await db.saveUser(recipient);

    await db.logBankAction({
        userId: pending.recipientId,
        action: `manual_give_${pending.currency}`,
        amount: pending.amountDisplay,
        extra: `given_by:${pending.giverId} claimed_by:${interaction.user.id}`
    });

    await db.logTransaction({
        userId: pending.recipientId,
        action: 'manual_give_from_bank',
        goldAmount: pending.currency === 'gold' ? pending.amountDisplay : 0,
        reason: `Manual give (${pending.currency}) claimed`,
        details: `currency:${pending.currency} amount:${pending.amountDisplay} given_by:${pending.giverId} claimed_by:${interaction.user.id}`
    });

    clearTimeout(pending.timeoutId);
    pendingGives.delete(requestId);

    const claimedEmbed = buildResolvedEmbed({
        baseEmbed: pending.embed,
        statusEn: 'Claimed and credited successfully.',
        statusAr: 'تم الاستلام والإضافة بنجاح.',
        approverId: interaction.user.id
    });

    await interaction.update({
        embeds: [claimedEmbed],
        components: buildClaimRow(pending.buttonId, true)
    }).catch(async () => {
        await pending.message.edit({
            embeds: [claimedEmbed],
            components: buildClaimRow(pending.buttonId, true)
        }).catch(() => {});
    });

    return true;
}

module.exports = {
    createPayRequest,
    createGiveRequest,
    handleConfirmInteraction,
    handleGiveClaimInteraction,
    PAY_TIMEOUT_MS
};
