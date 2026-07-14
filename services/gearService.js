const db = require('../db');
const { EmbedBuilder } = require('discord.js');
const { COLORS, EMOJIS, FOOTER_TEXT, formatError } = require('../utils/uiConstants');
const cfg = require('../config/gameplayConfig');

function ensureGearFields(user) {
    if (!user.gearInventory || typeof user.gearInventory !== 'object') user.gearInventory = {};
    if (!user.gearEquipment || typeof user.gearEquipment !== 'object') {
        user.gearEquipment = { helmet: null, chest: null, pants: null, shoes: null, weapon: null, shield: null };
    }

    for (const slot of cfg.GEAR.slots) {
        if (!Array.isArray(user.gearInventory[slot])) user.gearInventory[slot] = [];
        if (user.gearEquipment[slot] === undefined) user.gearEquipment[slot] = null;
    }

    return user;
}

function gearSummary(user) {
    return cfg.GEAR.slots.map((slot) => `${cfg.GEAR.slotLabels[slot]}: ${user.gearEquipment[slot] || '-'}`).join('\n');
}

async function showGearPanel(message) {
    const user = ensureGearFields(await db.getUser(message.author.id));

    const embed = new EmbedBuilder()
        .setColor(COLORS.PROFILE)
        .setTitle(`${EMOJIS.ROLE} Gear System | نظام العتاد`)
        .setDescription('Use `%gear status`, `%gear inventory`, `%gear equip <slot> <item>`, `%gear unequip <slot>`.')
        .addFields(
            { name: 'Equipped', value: gearSummary(user), inline: false },
            { name: 'Inventory Slots', value: cfg.GEAR.slots.map((slot) => `${slot}: ${user.gearInventory[slot].length}`).join(' | '), inline: false }
        )
        .setFooter({ text: FOOTER_TEXT })
        .setTimestamp();

    return message.reply({ embeds: [embed] });
}

async function handleGearCommand(message, args = []) {
    const action = String(args[0] || 'status').toLowerCase();
    const user = ensureGearFields(await db.getUser(message.author.id));

    if (action === 'status' || action === 'menu') {
        return showGearPanel(message);
    }

    if (action === 'inventory') {
        const lines = cfg.GEAR.slots.map((slot) => {
            const items = user.gearInventory[slot].length ? user.gearInventory[slot].join(', ') : '-';
            return `${cfg.GEAR.slotLabels[slot]}: ${items}`;
        }).join('\n');

        return message.reply({
            embeds: [new EmbedBuilder()
                .setColor(COLORS.INFO)
                .setTitle('🎒 Gear Inventory | مخزن العتاد')
                .setDescription(lines)
                .setFooter({ text: FOOTER_TEXT })
                .setTimestamp()]
        });
    }

    if (action === 'equip') {
        const slot = String(args[1] || '').toLowerCase();
        const item = String(args[2] || '').trim();
        if (!cfg.GEAR.slots.includes(slot) || !item) {
            return message.reply('Usage: `%gear equip <slot> <item>`').catch(() => {});
        }
        if (!user.gearInventory[slot].includes(item)) {
            return message.reply(formatError('هذا العتاد غير موجود في المخزون.', 'That gear item is not in your inventory.'));
        }
        user.gearEquipment[slot] = item;
        await db.saveUser(user);
        return message.reply(`✅ Equipped **${item}** in **${slot}**.`).catch(() => {});
    }

    if (action === 'unequip') {
        const slot = String(args[1] || '').toLowerCase();
        if (!cfg.GEAR.slots.includes(slot)) {
            return message.reply('Usage: `%gear unequip <slot>`').catch(() => {});
        }
        user.gearEquipment[slot] = null;
        await db.saveUser(user);
        return message.reply(`✅ Unequipped **${slot}**.`).catch(() => {});
    }

    return message.reply('Usage: `%gear [status|inventory|equip|unequip]`').catch(() => {});
}

module.exports = {
    ensureGearFields,
    handleGearCommand,
    gearSummary
};