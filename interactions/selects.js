const shopService = require('../services/shopService');
const { formatError } = require('../utils/uiConstants');

module.exports = async function (interaction) {
    const parts  = interaction.customId.split(':');
    const system = parts[0];
    const action = parts[1];

    try {
        // Shop select menus — anyone can interact (shop is public once summoned)
        if (system === 'shop') {
            if (action === 'buy_color')  return await shopService.buyColor(interaction);
            if (action === 'buy_access') return await shopService.buyAccess(interaction);
        }

        return interaction.reply({ content: formatError('اختيار غير معروف.', 'Unknown selection.'), ephemeral: true });

    } catch (err) {
        console.error('Select interaction error:', err);
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
