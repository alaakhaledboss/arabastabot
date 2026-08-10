const db = require('../db');
const { EmbedBuilder } = require('discord.js');
const { COLORS, FOOTER_TEXT, formatError, formatSuccess } = require('../utils/uiConstants');
const cfg = require('../config/gameplayConfig');

const STORE_ITEMS = cfg.GEAR.storeItems.map((item) => ({
    ...item,
    priceInternal: Number(item.priceGold || 0) * 10
}));

const SLOT_ALIASES = {
    helmet: 'helmet',
    head: 'helmet',
    cap: 'helmet',
    vest: 'chest',
    chest: 'chest',
    armor: 'chest',
    tunic: 'chest',
    pants: 'pants',
    trousers: 'pants',
    shoes: 'shoes',
    boots: 'shoes',
    weapon: 'weapon',
    sword: 'weapon',
    shield: 'shield',
    defense: 'shield'
};

const UNIQUE_GEAR_SLOTS = {
    forest_dark_sword: 'weapon',
    forest_dark_armor: 'chest',
    sea_dragon_vest: 'chest',
    sea_dragon_waist: 'pants'
};

function ensureGearFields(user) {
    if (!user.gearInventory || typeof user.gearInventory !== 'object') {
        user.gearInventory = {};
    }

    if (!user.gearEquipment || typeof user.gearEquipment !== 'object') {
        user.gearEquipment = { helmet: null, chest: null, pants: null, shoes: null, weapon: null, shield: null };
    }

    for (const slot of cfg.GEAR.slots) {
        if (!Array.isArray(user.gearInventory[slot])) user.gearInventory[slot] = [];
        if (user.gearEquipment[slot] === undefined) user.gearEquipment[slot] = null;
    }

    if (typeof user.gold !== 'number') user.gold = Number(user.gold || 0);
    if (typeof user.gems !== 'number') user.gems = Number(user.gems || 0);
    if (typeof user.honor !== 'number') user.honor = Number(user.honor || 0);

    return user;
}

function slotLabel(slot) {
    return cfg.GEAR.slotLabels[slot] || slot;
}

function slotValue(slot, value) {
    return `${slotLabel(slot)}: ${value || 'فارغ'}`;
}

function normalizeItemName(input) {
    return String(input || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function getGearByName(input) {
    const normalized = normalizeItemName(input);
    return STORE_ITEMS.find((item) => normalizeItemName(item.name) === normalized) || null;
}

function resolveSlotFromInput(input) {
    const normalized = normalizeItemName(input);
    if (cfg.GEAR.slots.includes(normalized)) return normalized;
    return SLOT_ALIASES[normalized] || null;
}

function findItemSlot(user, itemName) {
    const normalized = normalizeItemName(itemName);

    for (const slot of cfg.GEAR.slots) {
        const found = user.gearInventory[slot].find((item) => normalizeItemName(item) === normalized);
        if (found) return { slot, itemName: found };
    }

    for (const [itemKey, slot] of Object.entries(UNIQUE_GEAR_SLOTS)) {
        if (normalizeItemName(itemKey) === normalized) {
            const storedName = user.gearInventory[slot].find((item) => normalizeItemName(item) === normalized)
                || Object.values(user.gearEquipment).find((item) => normalizeItemName(item) === normalized)
                || itemKey;
            return { slot, itemName: storedName };
        }
    }

    const storeItem = getGearByName(itemName);
    if (storeItem) {
        const storedName = user.gearInventory[storeItem.slot].find((item) => normalizeItemName(item) === normalized)
            || Object.values(user.gearEquipment).find((item) => normalizeItemName(item) === normalized)
            || storeItem.name;
        return { slot: storeItem.slot, itemName: storedName };
    }

    return null;
}

function gearSummary(user) {
    return cfg.GEAR.slots.map((slot) => slotValue(slot, user.gearEquipment[slot])).join('\n');
}

function inventorySummary(user) {
    return cfg.GEAR.slots.map((slot) => {
        const items = user.gearInventory[slot];
        return `${slotLabel(slot)}: ${items.length ? items.join(', ') : 'فارغ'}`;
    }).join('\n');
}

function buildMenuEmbed(user) {
    return new EmbedBuilder()
        .setColor(COLORS.PROFILE)
        .setTitle('🛡️ Gear System | نظام العتاد')
        .setDescription([
            'Buy gear only in the gear store channel.',
            `Store channel: <#${cfg.CHANNELS.gearStore || '0'}>`,
            `Post channel: <#${cfg.CHANNELS.gearPostStore || '0'}>`
        ].join('\n'))
        .addFields(
            { name: 'Equipped', value: gearSummary(user), inline: false },
            { name: 'Inventory', value: inventorySummary(user), inline: false }
        )
        .setFooter({ text: FOOTER_TEXT })
        .setTimestamp();
}

async function logStorePurchase(message, item, priceDisplay) {
    const channelId = cfg.CHANNELS.gearPostStore;
    if (!message.client || !channelId) return;

    const channel = message.client.channels.cache.get(channelId)
        || await message.client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const text = `🛒 ${message.author.tag} bought **${item.name}** for **${priceDisplay.toLocaleString()}** gold in <#${cfg.CHANNELS.gearStore || '0'}>.`;
    await channel.send(text).catch(() => {});
}

async function buyGear(message, user, itemName) {
    if (!message.channelId || message.channelId !== cfg.CHANNELS.gearStore) {
        return message.reply(formatError('شراء العتاد متاح فقط داخل متجر العتاد.', 'Gear purchases are only allowed in the gear store channel.'));
    }

    const item = getGearByName(itemName);
    if (!item) {
        return message.reply(formatError('عنصر العتاد غير موجود.', 'That gear item does not exist.'));
    }

    if (!cfg.GEAR.slots.includes(item.slot)) {
        return message.reply(formatError('هذا العنصر لا يملك خانة صالحة.', 'That item does not map to a valid slot.'));
    }

    if ((user.gold || 0) < item.priceInternal) {
        const missing = Math.ceil((item.priceInternal - user.gold) / 10);
        return message.reply(formatError(`تحتاج إلى ${missing.toLocaleString()} ذهب إضافي.`, `You need ${missing.toLocaleString()} more gold.`));
    }

    user.gold -= item.priceInternal;
    user.gearInventory[item.slot].push(item.name);
    await db.saveUser(user);

    await logStorePurchase(message, item, item.priceGold);

    return message.reply({
        embeds: [new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle('✅ Purchase Successful')
            .setDescription([
                `Item: **${item.name}**`,
                `Slot: **${slotLabel(item.slot)}**`,
                `Price: **${item.priceGold.toLocaleString()}** gold`,
                `Remaining gold: **${Math.floor(user.gold / 10).toLocaleString()}**`
            ].join('\n'))
            .setFooter({ text: FOOTER_TEXT })
            .setTimestamp()]
    });
}

async function equipGear(message, user, itemName) {
    const resolved = findItemSlot(user, itemName);
    if (!resolved) {
        return message.reply(formatError('هذا العتاد غير موجود في المخزون.', 'That gear item is not in your inventory.'));
    }

    user.gearEquipment[resolved.slot] = resolved.itemName;
    await db.saveUser(user);

    return message.reply(formatSuccess(`تم تجهيز **${resolved.itemName}** في خانة **${slotLabel(resolved.slot)}**.`, `Equipped **${resolved.itemName}** in **${slotLabel(resolved.slot)}**.`));
}

async function unequipGear(message, user, slotInput) {
    const slot = resolveSlotFromInput(slotInput);
    if (!slot) {
        return message.reply('Usage: `%gear unequip <slot>`').catch(() => {});
    }

    user.gearEquipment[slot] = null;
    await db.saveUser(user);

    return message.reply(formatSuccess(`تم إزالة العتاد من خانة **${slotLabel(slot)}**.`, `Unequipped **${slotLabel(slot)}**.`));
}

function getItemNameFromArgs(args) {
    if (!args.length) return '';
    const first = normalizeItemName(args[0]);
    if (['buy', 'purchase', 'store', 'menu', 'status', 'inventory', 'equip', 'unequip'].includes(first)) {
        return args.slice(1).join(' ').trim();
    }
    return args.join(' ').trim();
}

async function handleGearCommand(message, args = []) {
    const action = normalizeItemName(args[0] || 'status');
    const user = ensureGearFields(await db.getUser(message.author.id));

    if (action === 'status' || action === 'menu') {
        return message.reply({ embeds: [buildMenuEmbed(user)] });
    }

    if (action === 'inventory') {
        return message.reply({
            embeds: [new EmbedBuilder()
                .setColor(COLORS.INFO)
                .setTitle('🎒 Gear Inventory | مخزن العتاد')
                .setDescription(inventorySummary(user))
                .setFooter({ text: FOOTER_TEXT })
                .setTimestamp()]
        });
    }

    if (action === 'buy' || getGearByName(args.join(' '))) {
        const itemName = getItemNameFromArgs(args);
        if (!itemName) {
            const items = STORE_ITEMS.map((item) => `• ${item.name} — ${item.priceGold.toLocaleString()} gold`).join('\n');
            return message.reply(`Available items:\n${items}`).catch(() => {});
        }

        return buyGear(message, user, itemName);
    }

    if (action === 'equip') {
        const itemName = args.slice(1).join(' ').trim();
        if (!itemName) {
            return message.reply('Usage: `%gear equip <item_name>`').catch(() => {});
        }
        return equipGear(message, user, itemName);
    }

    if (action === 'unequip') {
        return unequipGear(message, user, args[1]);
    }

    const maybeItem = getGearByName(args.join(' '));
    if (maybeItem) {
        return buyGear(message, user, maybeItem.name);
    }

    return message.reply('Usage: `%gear [buy|status|inventory|equip|unequip]`').catch(() => {});
}

module.exports = {
    ensureGearFields,
    handleGearCommand,
    gearSummary,
    inventorySummary,
    slotLabel
};