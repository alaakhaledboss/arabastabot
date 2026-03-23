const bankService = require('../services/bankService');
const productService = require('../services/shopservice');

module.exports = async function (interaction) {
    try {
        const [system, action, userId] = interaction.customId.split(':');

        if (system === 'bank') {
            return await bankService.handleModal(interaction, action, userId);
        }

        if (system === 'product' && action === 'add') {
            const productCmd = require('../commands/product');
            return await productCmd.addProductFromModal(interaction);
        }

        // Unknown modal
        return interaction.reply({ content: '❌ Unknown modal. خطأ غير معروف.', ephemeral: true });
    } catch (err) {
        console.error('Modal interaction error:', err);
        const reply = { content: '❌ Error processing modal. خطأ في معالجة النموذج.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
            return interaction.followUp(reply).catch(() => {});
        }
        return interaction.reply(reply).catch(() => {});
    }
};