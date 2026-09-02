const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../db');
const cfg = require('../config/gameplayConfig');
const { formatError } = require('../utils/uiConstants');

const PANEL_MESSAGES = new Map();

function normalizeArea(area) {
    const value = String(area || '').trim().toLowerCase();
    if (!value) return null;
    return Object.prototype.hasOwnProperty.call(cfg.LOCATIONS || {}, value) ? value : null;
}

function getSupportedAreas() {
    return Object.keys(cfg.LOCATIONS || {});
}

function getAreaDisplay(area) {
    const normalized = normalizeArea(area);
    if (!normalized) return 'Unknown';
    return normalized === 'forest' ? 'Forest' : normalized === 'lake' ? 'Lake' : normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getAreaArabic(area) {
    const normalized = normalizeArea(area);
    if (!normalized) return 'غير معروف';
    return normalized === 'forest' ? 'الغابة' : normalized === 'lake' ? 'البحيرة' : normalized;
}

function buildAreaEmbed(area) {
    const normalized = normalizeArea(area);
    if (!normalized) {
        return new EmbedBuilder()
            .setColor('#FFB84D')
            .setTitle('Invalid Area | منطقة غير صالحة');
    }

    return new EmbedBuilder()
        .setColor('#FFB84D')
        .setTitle(`${getAreaDisplay(normalized)}\n${getAreaArabic(normalized)}`)
        .setDescription('Choose an activity | اختر نشاطًا')
        .addFields(
            { name: 'Activities | الأنشطة', value: '• Hunt / صيد\n• Research / استكشاف', inline: false }
        )
        .setFooter({ text: 'ArabastaBot | Forest & Lake Panels' })
        .setTimestamp();
}

function buildAreaButtons(area) {
    const normalized = normalizeArea(area);
    if (!normalized) return new ActionRowBuilder();

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`game:hunt:${normalized}`)
            .setLabel('Hunt / صيد')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`game:research:${normalized}`)
            .setLabel('Research / استكشاف')
            .setStyle(ButtonStyle.Secondary)
    );
}

async function summonAreaPanel({ message, area, OWNER_ID }) {
    const normalized = normalizeArea(area);
    if (!normalized) {
        return message.reply({
            content: formatError('Available game areas:\nforest\nlake', 'Available game areas:\nforest\nlake'),
            allowedMentions: { parse: [] }
        });
    }

    const isOwner = message.author.id === OWNER_ID;
    const authorized = await db.getAuthorizedUsers();
    if (!isOwner && !authorized.has(message.author.id)) {
        return message.reply(formatError('ليس لديك صلاحية لاستخدام أمر %game.', 'You do not have permission to use %game.')).catch(() => {});
    }

    const panelKey = normalized;
    const existing = PANEL_MESSAGES.get(panelKey);
    const channel = message.channel;

    if (existing && existing.channelId === channel.id) {
        const existingMessage = await channel.messages.fetch(existing.messageId).catch(() => null);
        if (existingMessage) {
            await existingMessage.edit({
                embeds: [buildAreaEmbed(panelKey)],
                components: [buildAreaButtons(panelKey)]
            }).catch(() => {});
            return existingMessage;
        }
    }

    const sent = await channel.send({
        embeds: [buildAreaEmbed(panelKey)],
        components: [buildAreaButtons(panelKey)]
    }).catch((err) => {
        console.error('game panel send failed:', err);
        return null;
    });

    if (!sent) {
        return null;
    }

    PANEL_MESSAGES.set(panelKey, { channelId: channel.id, messageId: sent.id });
    return sent;
}

async function handleGameButton(interaction, activity, area) {
    const normalizedArea = normalizeArea(area);
    if (!normalizedArea) {
        return interaction.reply({
            content: formatError('This game area is not supported.', 'This game area is not supported.'),
            ephemeral: true
        });
    }

    if (!['hunt', 'research'].includes(String(activity || '').trim().toLowerCase())) {
        return interaction.reply({
            content: formatError('This action is not supported.', 'This action is not supported.'),
            ephemeral: true
        });
    }

    return require('./huntingService').handleButtonActivity({ interaction, activity, area: normalizedArea });
}

module.exports = {
    normalizeArea,
    getSupportedAreas,
    getAreaDisplay,
    getAreaArabic,
    buildAreaEmbed,
    buildAreaButtons,
    summonAreaPanel,
    handleGameButton,
    PANEL_MESSAGES
};
