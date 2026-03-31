const bankService = require('../services/bankService');
const shopService = require('../services/shopService');
const { formatError } = require('../utils/uiConstants');

const OWNER_ID = process.env.OWNER_ID || '1156642624770424902';

module.exports = async function (interaction) {
    try {
        const [system, action, userId] = interaction.customId.split(':');

        // ── Bank modals (deposit / withdraw) ───────────────────
        if (system === 'bank') {
            return await bankService.handleModal(interaction, action, userId, OWNER_ID);
        }

        // ── Gold → Credit (Ticket) modal ───────────────────────
        if (system === 'gold_credit' && action === 'amount') {
            return await shopService.processGoldCredit(interaction, userId);
        }

        // ── Currency conversion modals ─────────────────────────
        if (system === 'convert') {
            if (action === 'to_gems')  return await shopService.processConvertToGems(interaction, userId);
            if (action === 'to_honor') return await shopService.processConvertToHonor(interaction, userId);
        }

        // ── Fallback ───────────────────────────────────────────
        return interaction.reply({ content: formatError('موديول غير معروف.', 'Unknown modal.'), ephemeral: true });

    } catch (err) {
        console.error('Modal interaction error:', err);
        try {
            const reply = { content: formatError('حدث خطأ!', 'Something went wrong!'), ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply);
            } else {
                await interaction.reply(reply);
            }
        } catch (e) {}
    }
};
