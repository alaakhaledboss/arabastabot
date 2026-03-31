const db = require('../db');
const { ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle, ButtonBuilder, ButtonStyle } = require('discord.js');

async function addProduct(message, args, OWNER_ID) {
    try {
        if (message.author.id !== OWNER_ID) {
            return message.reply('❌ Only the owner can add products. فقط المالك يمكنه إضافة منتجات.');
        }

        // Create a button that opens the modal
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('product:modal:add')
                .setLabel('Click to Add Product')
                .setStyle(ButtonStyle.Primary)
        );

        return message.reply({
            content: '📝 Click the button below to add a new product:',
            components: [row]
        });
    } catch (err) {
        console.error('addProduct error:', err);
        return message.reply('❌ Error showing modal. خطأ في عرض النموذج.').catch(() => {});
    }
}

async function addProductFromModal(interaction) {
    try {
        const name = interaction.fields.getTextInputValue('product_name')?.trim();
        const priceStr = interaction.fields.getTextInputValue('product_price')?.trim();
        const desc = interaction.fields.getTextInputValue('product_desc')?.trim() || '';

        if (!name || !priceStr) {
            return interaction.reply({ content: '❌ Name and price are required. الاسم والسعر مطلوبان.', flags: 64 });
        }

        const price = parseInt(priceStr, 10) * 10; // convert display gold → internal
        if (isNaN(price) || price <= 0) {
            return interaction.reply({ content: '❌ Price must be a positive number. السعر يجب أن يكون رقم موجب.', flags: 64 });
        }

        const products = await db.getProducts();
        products.push({ name, price, description: desc, id: Date.now() });
        await db.saveProducts(products);

        return interaction.reply({ content: `✅ Product "${name}" added for ${price / 10} gold!`, flags: 64 });
    } catch (err) {
        console.error('addProductFromModal error:', err);
        return interaction.reply({ content: '❌ Error adding product. خطأ في إضافة المنتج.', flags: 64 });
    }
}

function createProductModal() {
    const modal = new ModalBuilder()
        .setCustomId('product:add')
        .setTitle('Add Product إضافة منتج');

    const nameInput = new TextInputBuilder()
        .setCustomId('product_name')
        .setLabel('Product Name اسم المنتج')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const priceInput = new TextInputBuilder()
        .setCustomId('product_price')
        .setLabel('Product Price (display gold) السعر')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const descInput = new TextInputBuilder()
        .setCustomId('product_desc')
        .setLabel('Description (optional) الوصف')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(priceInput),
        new ActionRowBuilder().addComponents(descInput)
    );

    return modal;
}

module.exports = { addProduct, addProductFromModal, createProductModal };