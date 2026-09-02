const shopService = require('../services/shopService');
const bankService = require('../services/bankService');
const musicService = require('../services/musicService');
const progressionService = require('../services/progressionService');
const payService = require('../services/payService');
const craftService = require('../services/craftService');
const sellService = require('../services/sellService');
const gamePanelService = require('../services/gamePanelService');
const db          = require('../db');
const { formatError } = require('../utils/uiConstants');

const OWNER_ID = process.env.OWNER_ID || '1156642624770424902';

module.exports = async function (interaction) {
    const parts  = interaction.customId.split(':');
    const system = parts[0];
    const action = parts[1];
    // parts[2] = value (unused)
    const userId = parts[3];

    try {

        // ── Music buttons ─────────────────────────────────────
        // Only users in the same voice channel as the bot can use controls.
        if (system === 'music') {
            return await musicService.handleControlInteraction(interaction);
        }

        // ── Manual pay confirmation buttons ──────────────────
        if (system === 'pay') {
            return await payService.handleConfirmInteraction(interaction);
        }

        // ── Manual give claim buttons ───────────────────────
        if (system === 'give') {
            return await payService.handleGiveClaimInteraction(interaction);
        }

        if (system === 'craft') {
            return await craftService.handleCraftInteraction(interaction, parts);
        }

        if (system === 'sell') {
            return await sellService.handleSellInteraction(interaction, parts);
        }

        // ── Progression buttons ───────────────────────────────
        if (system === 'progression') {
            return await progressionService.handleButtonInteraction(interaction);
        }

        // ── Game panel buttons ───────────────────────────────
        if (system === 'game') {
            return await gamePanelService.handleGameButton(interaction, action, parts[2]);
        }

        // ── Shop buttons ──────────────────────────────────────
        // Anyone may click shop buttons once the panel is posted.
        if (system === 'shop') {
            if (action === 'bag')              return await shopService.showBag(interaction);
            if (action === 'products')         return await shopService.showProducts(interaction);
            if (action === 'color_menu')       return await shopService.showColorMenu(interaction);
            if (action === 'access_menu')      return await shopService.showAccessMenu(interaction);
            if (action === 'prices')           return await shopService.showPrices(interaction);
            if (action === 'currency_exchange') return await shopService.showCurrencyExchange(interaction);
            if (action === 'role_features')    return await shopService.showRoleFeatures(interaction);

            // These open modals — MUST be the FIRST response (no deferReply)
            if (action === 'gold_credit') {
                return interaction.showModal(shopService.createGoldCreditModal(interaction.user.id));
            }
            if (action === 'convert_to_gems') {
                return interaction.showModal(shopService.createConvertToGemsModal(interaction.user.id));
            }
            if (action === 'convert_to_honor') {
                return interaction.showModal(shopService.createConvertToHonorModal(interaction.user.id));
            }
        }

        // ── Bank buttons ──────────────────────────────────────
        // Owner + authorized users can click any bank panel.
        // Everyone else can only use their own panel.
        if (system === 'bank') {
            const authorized = await db.getAuthorizedUsers();
            const isOwner    = interaction.user.id === OWNER_ID;
            const isAuth     = isOwner || authorized.has(interaction.user.id);
            const isOriginal = interaction.user.id === userId;

            if (!isAuth && !isOriginal) {
                return interaction.reply({
                    content: formatError('ليس لديك صلاحية للوصول لهذا البنك.', 'You don\'t have permission to access this bank panel.'),
                    ephemeral: true
                });
            }

            // Use the INTERACTING user's own ID for all bank transactions
            const effectiveUserId = interaction.user.id;

            if (action === 'show') return await bankService.showBalance(interaction, OWNER_ID);

            if (action === 'withdraw' || action === 'deposit') {
                // Modal must be first response — no defer allowed here
                return interaction.showModal(bankService.createModal(action, effectiveUserId));
            }
        }

        return interaction.reply({ content: formatError('إجراء غير معروف.', 'Unknown action.'), ephemeral: true });

    } catch (err) {
        console.error('Button interaction error:', err);
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
