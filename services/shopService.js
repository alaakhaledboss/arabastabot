const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../db');

// ── Product Management ──
async function showProducts(interaction) {
    try {
        const products = await db.getProducts();

        if (!products.length) {
            return interaction.reply({ content: '❌ No products available. لا توجد منتجات متاحة.', ephemeral: true });
        }

        const lines = products.map((p, i) => `**${i + 1}.** ${p.name} — ${p.price / 10} gold ذهب`);
        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🛍️ Products المنتجات')
            .setDescription(lines.join('\n'))
            .setFooter({ text: `Total: ${products.length}` })
            .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
        console.error('showProducts error:', err);
        return interaction.reply({ content: '❌ Error loading products. خطأ في تحميل المنتجات.', ephemeral: true });
    }
}

async function buyProduct(interaction, index) {
    try {
        const idx = parseInt(index, 10);
        const products = await db.getProducts();
        const product = products[idx];

        if (!product) {
            return interaction.reply({ content: '❌ Product not found. المنتج غير موجود.', ephemeral: true });
        }

        const user = await db.getUser(interaction.user.id);
        const bank = await db.getBank();

        if (user.gold < product.price) {
            return interaction.reply({ content: `❌ Insufficient gold. You need ${(product.price - user.gold) / 10} more. لا توجد ذهب كافية.`, ephemeral: true });
        }

        user.gold -= product.price;
        bank.balance += product.price;

        await db.saveUser(user);
        await db.saveBank(bank);

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('✅ Purchase Successful شراء ناجح')
            .addFields(
                { name: 'Product المنتج', value: product.name, inline: true },
                { name: 'Price السعر', value: `${product.price / 10} gold ذهب`, inline: true },
                { name: 'Your Gold ذهبك', value: `${user.gold / 10}`, inline: true }
            )
            .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
        console.error('buyProduct error:', err);
        return interaction.reply({ content: '❌ Error processing purchase. خطأ في معالجة الشراء.', ephemeral: true });
    }
}

async function showBag(interaction) {
    try {
        const user = await db.getUser(interaction.user.id);
        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🎒 Your Bag حقيبتك')
            .addFields(
                { name: 'Gold ذهب', value: `${user.gold / 10}`, inline: true },
                { name: 'XP', value: `${user.xp}`, inline: true },
                { name: 'Level المستوى', value: `${user.level}`, inline: true },
                { name: 'Gems جواهر', value: `${user.gems}`, inline: true },
                { name: 'Honor شرف', value: `${user.honor}`, inline: true }
            )
            .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
        console.error('showBag error:', err);
        return interaction.reply({ content: '❌ Error loading bag. خطأ في تحميل الحقيبة.', ephemeral: true });
    }
}

async function showPrices(interaction) {
    try {
        const products = await db.getProducts();

        if (!products.length) {
            return interaction.reply({ content: '❌ No products available. لا توجد منتجات متاحة.', ephemeral: true });
        }

        const lines = products.map((p, i) => `**${i + 1}.** ${p.name} — \`${p.price / 10}\` gold ذهب`);
        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('💰 Price List قائمة الأسعار')
            .setDescription(lines.join('\n'))
            .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
        console.error('showPrices error:', err);
        return interaction.reply({ content: '❌ Error loading prices. خطأ في تحميل الأسعار.', ephemeral: true });
    }
}

module.exports = { showProducts, buyProduct, showBag, showPrices };