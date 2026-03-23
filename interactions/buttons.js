const shopservice = require('../services/shopservice');
const bankService = require('../services/bankService');

module.exports = async function (interaction) {
    try {
        const [system, action, value, userId] = interaction.customId.split(':');

        if (interaction.user.id !== userId) {
            return interaction.reply({ content: '❌ This is not for you. هذا ليس لك.', ephemeral: true });
        }

        if (system === 'shop') {
            if (action === 'products') return await shopservice.showProducts(interaction);
            if (action === 'buy') return await shopservice.buyProduct(interaction, value);
            if (action === 'bag') return await shopservice.showBag(interaction);
            if (action === 'prices') return await shopservice.showPrices(interaction);
        }

        if (system === 'bank') {
            if (action === 'show') return await bankService.showBalance(interaction);
            if (action === 'withdraw' || action === 'deposit') {
                return interaction.showModal(bankService.createModal(action, userId));
            }
        }

        // Unknown button action
        return interaction.reply({ content: '❌ Unknown button action. خطأ غير معروف.', ephemeral: true });
    } catch (err) {
        console.error('Button interaction error:', err);
        const reply = { content: '❌ Error processing button. خطأ في معالجة الزر.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
            return interaction.followUp(reply).catch(() => {});
        }
        return interaction.reply(reply).catch(() => {});
    }
};