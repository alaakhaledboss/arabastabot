const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = async function (message) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`shop:bag:0:${message.author.id}`)
            .setLabel('Bag الحقيبة')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`shop:products:0:${message.author.id}`)
            .setLabel('Products المنتجات')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`shop:prices:0:${message.author.id}`)
            .setLabel('Prices الأسعار')
            .setStyle(ButtonStyle.Secondary)
    );

    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('Shop المتجر')
        .setDescription('Welcome to the shop! مرحبًا بك في المتجر!');

    return message.reply({ embeds: [embed], components: [row] });
};