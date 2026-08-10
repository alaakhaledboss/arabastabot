const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { COLORS, FOOTER_TEXT, formatError, formatSuccess } = require('../utils/uiConstants');

function ensureSellFields(user) {
    if (!user.inventory || typeof user.inventory !== 'object') {
        user.inventory = { materials: {}, items: [], gear: { helmet: [], chest: [], pants: [], shoes: [], weapon: [], shield: [] } };
    }
    if (!user.inventory.materials || typeof user.inventory.materials !== 'object') user.inventory.materials = {};
    if (!Array.isArray(user.inventory.items)) user.inventory.items = [];
    if (!user.market || typeof user.market !== 'object') user.market = { listing: null, history: [] };
    if (!user.path) user.path = user.currentRoute || null;
    if (!user.clanId && user.clan?.id) user.clanId = user.clan.id;
    return user;
}

function resolveItemFromInventory(user, query) {
    const normalized = String(query || '').trim().toLowerCase();
    const itemIndex = user.inventory.items.findIndex((item) => {
        const name = String(item?.name || '').toLowerCase();
        const key = String(item?.key || '').toLowerCase();
        return name === normalized || key === normalized || name.includes(normalized) || normalized.includes(name);
    });

    if (itemIndex !== -1) {
        const [item] = user.inventory.items.splice(itemIndex, 1);
        return { kind: 'item', payload: item };
    }

    if (Object.prototype.hasOwnProperty.call(user.inventory.materials, normalized) && Number(user.inventory.materials[normalized] || 0) > 0) {
        user.inventory.materials[normalized] -= 1;
        return {
            kind: 'material',
            payload: {
                key: normalized,
                name: normalized,
                amount: 1,
                type: 'material'
            }
        };
    }

    return null;
}

function buildSellEmbed(user, listing = null) {
    const lines = [
        'أدخل `%sell <item> <price>` لإنشاء قائمة بيع.',
        'يمكن لأي لاعب خارج الكلان نفسه الشراء من الزر الظاهر في الإعلان.',
        '',
        `المسار الحالي: **${user.path || user.currentRoute || '-'}**`
    ];

    if (listing) {
        lines.push('');
        lines.push(`القائمة الحالية: **${listing.item.name || listing.item.key}**`);
        lines.push(`السعر: **${listing.price}** ذهب`);
    }

    return new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle('🪙 سوق البيع')
        .setDescription(lines.join('\n'))
        .setFooter({ text: FOOTER_TEXT })
        .setTimestamp();
}

function buildSellComponents(sellerId, listingId, soldOut = false) {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`sell:buy:${sellerId}:${listingId}`)
                .setLabel(soldOut ? 'تم البيع' : 'شراء')
                .setStyle(ButtonStyle.Success)
                .setDisabled(soldOut)
        )
    ];
}

async function handleSellCommand(message, args = []) {
    const user = ensureSellFields(await db.getUser(message.author.id));
    const path = String(user.path || user.currentRoute || '').toLowerCase();

    if (path !== 'merchant') {
        return message.reply(formatError('أمر البيع متاح لمسار Merchant فقط.', 'Selling is only available for the Merchant path.'));
    }

    if (!args.length) {
        return message.reply({ embeds: [buildSellEmbed(user)] });
    }

    const priceText = args[args.length - 1];
    const price = Number(priceText);
    if (!Number.isFinite(price) || price <= 0) {
        return message.reply(formatError('أدخل السعر في آخر الأمر بشكل صحيح.', 'Provide a valid price as the last argument.'));
    }

    const query = args.slice(0, -1).join(' ').trim();
    if (!query) {
        return message.reply(formatError('حدد العنصر المراد بيعه.', 'Specify the item to sell.'));
    }

    const soldItem = resolveItemFromInventory(user, query);
    if (!soldItem) {
        return message.reply(formatError('العنصر غير موجود في مخزونك.', 'The item was not found in your inventory.'));
    }

    const listingId = `listing_${Date.now()}_${message.author.id}`;
    user.market.listing = {
        id: listingId,
        sellerId: message.author.id,
        price,
        item: soldItem.payload,
        createdAt: Date.now(),
        status: 'active'
    };
    user.market.history.unshift({
        id: listingId,
        price,
        item: soldItem.payload,
        createdAt: Date.now(),
        status: 'active'
    });
    user.market.history = user.market.history.slice(0, 20);

    await db.saveUser(user);

    return message.reply({
        embeds: [buildSellEmbed(user, user.market.listing)],
        components: buildSellComponents(message.author.id, listingId)
    });
}

async function handleSellInteraction(interaction, parts) {
    const sellerId = parts[2];
    const listingId = parts[3];

    const seller = ensureSellFields(await db.getUser(sellerId));
    const buyer = ensureSellFields(await db.getUser(interaction.user.id));

    if (!seller.market?.listing || seller.market.listing.id !== listingId) {
        return interaction.reply({ content: formatError('قائمة البيع هذه لم تعد متاحة.', 'This listing is no longer available.'), ephemeral: true });
    }

    if ((seller.clanId || null) && seller.clanId === (buyer.clanId || null)) {
        return interaction.reply({ content: formatError('لا يمكن لأعضاء نفس الكلان الشراء من بعضهم.', 'Clan members cannot buy from the same clan.'), ephemeral: true });
    }

    const price = Number(seller.market.listing.price || 0);
    if (Number(buyer.gold || 0) < price) {
        return interaction.reply({ content: formatError('ليس لديك ذهب كافٍ للشراء.', 'You do not have enough gold.'), ephemeral: true });
    }

    const soldItem = seller.market.listing.item;
    buyer.gold = Number(buyer.gold || 0) - price;
    seller.gold = Number(seller.gold || 0) + price;

    if (soldItem?.type === 'material') {
        if (!buyer.inventory.materials[soldItem.key]) {
            buyer.inventory.materials[soldItem.key] = 0;
        }
        buyer.inventory.materials[soldItem.key] += Number(soldItem.amount || 1);
    } else {
        buyer.inventory.items.push(soldItem);
    }

    seller.market.listing.status = 'sold';
    seller.market.history.unshift({
        ...seller.market.listing,
        status: 'sold',
        soldAt: Date.now(),
        buyerId: interaction.user.id
    });
    seller.market.history = seller.market.history.slice(0, 20);
    seller.market.listing = null;

    await db.saveUser(buyer);
    await db.saveUser(seller);

    const embed = buildSellEmbed(seller, null);
    embed.setColor(COLORS.SUCCESS).setDescription([
        `تم بيع **${soldItem?.name || soldItem?.key || 'العنصر'}** بنجاح.`,
        `السعر: **${price}** ذهب`,
        `المشتري: <@${interaction.user.id}>`
    ].join('\n'));

    await interaction.update({ embeds: [embed], components: buildSellComponents(sellerId, listingId, true) }).catch(() => {});
}

module.exports = {
    ensureSellFields,
    handleSellCommand,
    handleSellInteraction,
    buildSellEmbed,
    buildSellComponents
};