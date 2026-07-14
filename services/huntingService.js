const db = require('../db');
const { EmbedBuilder } = require('discord.js');
const { COLORS, FOOTER_TEXT, formatError } = require('../utils/uiConstants');
const progressionService = require('./progressionService');
const cfg = require('../config/gameplayConfig');

const FOREST_TABLES = {
    scholar: {
        professor: [
            { name: 'herb', amount: 5, chance: 62 },
            { name: 'poison_mushroom', amount: 2, chance: 20 },
            { name: 'magic_flower', amount: 1, chance: 10 },
            { name: 'forest_heart', amount: 1, chance: 6 }
        ],
        expert: [
            { name: 'herb', amount: 5, chance: 50 },
            { name: 'poison_mushroom', amount: 2, chance: 26.5 },
            { name: 'magic_flower', amount: 1, chance: 18 },
            { name: 'forest_heart', amount: 1, chance: 3.5 }
        ],
        teacher: [
            { name: 'herb', amount: 5, chance: 50 },
            { name: 'poison_mushroom', amount: 2, chance: 26.5 },
            { name: 'magic_flower', amount: 1, chance: 18 },
            { name: 'forest_heart', amount: 1, chance: 3.5 }
        ]
    },
    combat: {
        swordsman: [
            { name: 'tiger_skin', amount: 1, chance: 37 },
            { name: 'boar_horn', amount: 2, chance: 35 },
            { name: 'green_mana_stone', amount: 2, chance: 25 }
        ],
        mage: [
            { name: 'tiger_skin', amount: 1, chance: 40 },
            { name: 'boar_horn', amount: 2, chance: 39.5 },
            { name: 'green_mana_stone', amount: 2, chance: 18.5 }
        ],
        defender: [
            { name: 'tiger_skin', amount: 1, chance: 45 },
            { name: 'boar_horn', amount: 2, chance: 42 },
            { name: 'green_mana_stone', amount: 2, chance: 11 }
        ]
    }
};

const LAKE_TABLES = {
    scholar: {
        professor: [
            { name: 'algae', amount: 5, chance: 62 },
            { name: 'shell', amount: 2, chance: 20 },
            { name: 'coral', amount: 1, chance: 10 },
            { name: 'sea_heart', amount: 1, chance: 6 }
        ],
        expert: [
            { name: 'algae', amount: 5, chance: 50.5 },
            { name: 'shell', amount: 2, chance: 26.5 },
            { name: 'coral', amount: 1, chance: 18 },
            { name: 'sea_heart', amount: 1, chance: 3.5 }
        ],
        teacher: [
            { name: 'algae', amount: 5, chance: 50.5 },
            { name: 'shell', amount: 2, chance: 26.5 },
            { name: 'coral', amount: 1, chance: 18 },
            { name: 'sea_heart', amount: 1, chance: 3.5 }
        ]
    },
    combat: {
        swordsman: [
            { name: 'starfish', amount: 1, chance: 62 },
            { name: 'sea_dragon_bones', amount: 2, chance: 20 },
            { name: 'sea_dragon_scales', amount: 2, chance: 10 },
            { name: 'blue_mana_stone', amount: 2, chance: 6 }
        ],
        mage: [
            { name: 'starfish', amount: 1, chance: 58 },
            { name: 'sea_dragon_bones', amount: 2, chance: 24 },
            { name: 'sea_dragon_scales', amount: 2, chance: 12 },
            { name: 'blue_mana_stone', amount: 2, chance: 6 }
        ],
        defender: [
            { name: 'starfish', amount: 1, chance: 65 },
            { name: 'sea_dragon_bones', amount: 2, chance: 19 },
            { name: 'sea_dragon_scales', amount: 2, chance: 11 },
            { name: 'blue_mana_stone', amount: 2, chance: 5 }
        ]
    }
};

const EXPLORATION_TABLES = {
    valley: {
        scholar: {
            professor: [
                { name: 'valley_herb', amount: 4, chance: 58 },
                { name: 'spring_water', amount: 2, chance: 24 },
                { name: 'ancient_leaf', amount: 1, chance: 12 },
                { name: 'valley_relic', amount: 1, chance: 6 }
            ],
            expert: [
                { name: 'valley_herb', amount: 4, chance: 52 },
                { name: 'spring_water', amount: 2, chance: 26 },
                { name: 'ancient_leaf', amount: 1, chance: 15 },
                { name: 'valley_relic', amount: 1, chance: 5 }
            ],
            teacher: [
                { name: 'valley_herb', amount: 4, chance: 52 },
                { name: 'spring_water', amount: 2, chance: 26 },
                { name: 'ancient_leaf', amount: 1, chance: 15 },
                { name: 'valley_relic', amount: 1, chance: 5 }
            ]
        },
        combat: {
            swordsman: [
                { name: 'stone_chunk', amount: 2, chance: 60 },
                { name: 'old_coin', amount: 3, chance: 25 },
                { name: 'maze_chip', amount: 1, chance: 10 },
                { name: 'lost_map_fragment', amount: 1, chance: 5 }
            ],
            mage: [
                { name: 'stone_chunk', amount: 2, chance: 60 },
                { name: 'old_coin', amount: 3, chance: 25 },
                { name: 'maze_chip', amount: 1, chance: 10 },
                { name: 'lost_map_fragment', amount: 1, chance: 5 }
            ],
            defender: [
                { name: 'stone_chunk', amount: 2, chance: 60 },
                { name: 'old_coin', amount: 3, chance: 25 },
                { name: 'maze_chip', amount: 1, chance: 10 },
                { name: 'lost_map_fragment', amount: 1, chance: 5 }
            ]
        }
    },
    maze: {
        scholar: {
            professor: [
                { name: 'maze_ink', amount: 4, chance: 55 },
                { name: 'rune_piece', amount: 2, chance: 25 },
                { name: 'cipher_stone', amount: 1, chance: 12 },
                { name: 'labyrinth_core', amount: 1, chance: 8 }
            ],
            expert: [
                { name: 'maze_ink', amount: 4, chance: 50 },
                { name: 'rune_piece', amount: 2, chance: 28 },
                { name: 'cipher_stone', amount: 1, chance: 15 },
                { name: 'labyrinth_core', amount: 1, chance: 7 }
            ],
            teacher: [
                { name: 'maze_ink', amount: 4, chance: 50 },
                { name: 'rune_piece', amount: 2, chance: 28 },
                { name: 'cipher_stone', amount: 1, chance: 15 },
                { name: 'labyrinth_core', amount: 1, chance: 7 }
            ]
        },
        combat: {
            swordsman: [
                { name: 'rust_fragment', amount: 2, chance: 58 },
                { name: 'maze_fang', amount: 2, chance: 27 },
                { name: 'broken_emblem', amount: 1, chance: 10 },
                { name: 'maze_core', amount: 1, chance: 5 }
            ],
            mage: [
                { name: 'rust_fragment', amount: 2, chance: 58 },
                { name: 'maze_fang', amount: 2, chance: 27 },
                { name: 'broken_emblem', amount: 1, chance: 10 },
                { name: 'maze_core', amount: 1, chance: 5 }
            ],
            defender: [
                { name: 'rust_fragment', amount: 2, chance: 58 },
                { name: 'maze_fang', amount: 2, chance: 27 },
                { name: 'broken_emblem', amount: 1, chance: 10 },
                { name: 'maze_core', amount: 1, chance: 5 }
            ]
        }
    }
};

const UNIQUE_REWARDS = {
    forest: [
        { name: 'forest_dark_sword', display: 'Dark Forest Sword', chance: 0.5, refund: cfg.HUNTING.uniqueDropRefunds.forest_dark_sword },
        { name: 'forest_dark_armor', display: 'Dark Forest Armor', chance: 1.5, refund: cfg.HUNTING.uniqueDropRefunds.forest_dark_armor }
    ],
    lake: [
        { name: 'sea_dragon_vest', display: 'Sea Dragon Vest', chance: 1, refund: cfg.HUNTING.uniqueDropRefunds.sea_dragon_vest },
        { name: 'sea_dragon_waist', display: 'Sea Dragon Waist', chance: 1, refund: cfg.HUNTING.uniqueDropRefunds.sea_dragon_waist_armor }
    ]
};

const CHANNEL_BY_LOCATION = {
    forest: 'forestHunt',
    lake: 'lakeHunt',
    valley: 'theValley',
    maze: 'theMaze'
};

function ensureHuntingFields(user) {
    if (!user.hunting || typeof user.hunting !== 'object') {
        user.hunting = { lastHuntAt: 0, cooldownUntil: 0, history: [] };
    }
    if (!Array.isArray(user.hunting.history)) user.hunting.history = [];
    if (!user.materials || typeof user.materials !== 'object') user.materials = {};
    if (!user.gearInventory || typeof user.gearInventory !== 'object') {
        user.gearInventory = { helmet: [], chest: [], pants: [], shoes: [], weapon: [], shield: [] };
    }
    if (!user.gearEquipment || typeof user.gearEquipment !== 'object') {
        user.gearEquipment = { helmet: null, chest: null, pants: null, shoes: null, weapon: null, shield: null };
    }
    return user;
}

function routeLabel(route) {
    return ({ combat: 'Combat', scholar: 'Scholar', atelier: 'Atelier', merchant: 'Merchant' })[route] || route || '-';
}

function currentRoute(member, user) {
    return progressionService.getRouteLevelInfo(member).route || user.currentRoute || null;
}

function resolveHuntingTier(route, user) {
    const specialty = String(user.currentSpecialty || '').toLowerCase();

    if (route === 'scholar') {
        if (specialty === 'archivist') return 'professor';
        if (specialty === 'dialectician') return 'expert';
        if (specialty === 'theorist') return 'teacher';
        return 'teacher';
    }

    if (route === 'combat') {
        if (specialty === 'marshal') return 'defender';
        if (specialty === 'berserker') return 'mage';
        if (specialty === 'duelist') return 'swordsman';
        return 'swordsman';
    }

    return null;
}

function pickOne(entries) {
    const total = entries.reduce((sum, item) => sum + Number(item.chance || 0), 0);
    let roll = Math.random() * total;
    for (const item of entries) {
        roll -= Number(item.chance || 0);
        if (roll <= 0) return item;
    }
    return entries[entries.length - 1];
}

function getTable(location, route, tier) {
    if (location === 'forest') return FOREST_TABLES[route]?.[tier] || null;
    if (location === 'lake') return LAKE_TABLES[route]?.[tier] || null;
    return EXPLORATION_TABLES[location]?.[route]?.[tier] || null;
}

function getUniqueReward(location) {
    const entries = UNIQUE_REWARDS[location] || [];
    const total = entries.reduce((sum, item) => sum + Number(item.chance || 0), 0);
    let roll = Math.random() * 100;

    if (roll > total) return null;

    for (const item of entries) {
        roll -= Number(item.chance || 0);
        if (roll <= 0) return item;
    }

    return null;
}

function grantMaterial(user, name, amount) {
    user.materials[name] = Number(user.materials[name] || 0) + Number(amount || 0);
}

function grantUnique(user, reward) {
    const alreadyOwned = Object.values(user.gearInventory).some((items) => Array.isArray(items) && items.includes(reward.name))
        || Object.values(user.gearEquipment).includes(reward.name);

    if (alreadyOwned) {
        user.gold += Number(reward.refund?.gold || 0);
        user.gems += Number(reward.refund?.gems || 0);
        return { duplicate: true };
    }

    const slot = reward.name.includes('sword') ? 'weapon'
        : reward.name.includes('armor') || reward.name.includes('vest') ? 'chest'
            : reward.name.includes('waist') ? 'pants'
                : 'shield';

    if (!Array.isArray(user.gearInventory[slot])) user.gearInventory[slot] = [];
    user.gearInventory[slot].push(reward.name);
    return { duplicate: false };
}

function resolveModeAndLocation(args = []) {
    const first = String(args[0] || '').toLowerCase();
    const second = String(args[1] || '').toLowerCase();

    if (['forest', 'lake', 'valley', 'maze'].includes(first)) {
        return { mode: first, location: first };
    }

    if (first === 'explore' && ['valley', 'maze'].includes(second)) {
        return { mode: 'explore', location: second };
    }

    return { mode: 'menu', location: null };
}

function matchesChannel(message, location) {
    const expectedKey = CHANNEL_BY_LOCATION[location];
    const expectedId = cfg.CHANNELS[expectedKey];
    return Boolean(expectedId) && message.channel?.id === expectedId;
}

function channelLabel(location) {
    return location === 'forest' ? 'forestHunt'
        : location === 'lake' ? 'lakeHunt'
            : location === 'valley' ? 'theValley'
                : 'theMaze';
}

async function handleHuntCommand(message, args = []) {
    const user = ensureHuntingFields(await db.getUser(message.author.id));
    const route = currentRoute(message.member, user);
    const { mode, location } = resolveModeAndLocation(args);
    const now = Date.now();

    if (mode === 'menu') {
        const embed = new EmbedBuilder()
            .setColor(COLORS.INFO)
            .setTitle('🏹 Hunting & Exploring')
            .setDescription([
                'Use `%hunt forest`, `%hunt lake`, `%hunt valley`, or `%hunt maze` in the matching channel.',
                'Cooldown: 20 minutes per user.',
                '',
                `Route: **${routeLabel(route)}**`,
                `Current specialty: **${user.currentSpecialty || '-'}**`,
                '',
                `Forest: <#${cfg.CHANNELS.forestHunt || '0'}>`,
                `Lake: <#${cfg.CHANNELS.lakeHunt || '0'}>`,
                `Valley: <#${cfg.CHANNELS.theValley || '0'}>`,
                `Maze: <#${cfg.CHANNELS.theMaze || '0'}>`
            ].join('\n'))
            .setFooter({ text: FOOTER_TEXT })
            .setTimestamp();

        return message.reply({ embeds: [embed] });
    }

    if (!route) {
        return message.reply(formatError('اختر مسارًا أولًا قبل الصيد أو الاستكشاف.', 'Choose a route before hunting or exploring.'));
    }

    if (!['combat', 'scholar'].includes(route)) {
        return message.reply(formatError('هذا النظام متاح للمقاتل أو الباحث فقط.', 'This system is available for Combat or Scholar routes only.'));
    }

    if (!matchesChannel(message, location)) {
        return message.reply(formatError(
            `استخدم أمر ${channelLabel(location)} فقط داخل رومه المخصص.`,
            `Use the ${channelLabel(location)} command only in its dedicated channel.`
        ));
    }

    const lastHuntAt = Number(user.hunting.lastHuntAt || 0);
    if (lastHuntAt && now - lastHuntAt < cfg.HUNTING.cooldownMinutes * 60 * 1000) {
        const remainingMs = (cfg.HUNTING.cooldownMinutes * 60 * 1000) - (now - lastHuntAt);
        const remainingMinutes = Math.ceil(remainingMs / 60000);
        return message.reply(formatError(
            `لا يزال عليك الانتظار ${remainingMinutes} دقيقة قبل استخدام الصيد/الاستكشاف مرة أخرى.`,
            `You must wait ${remainingMinutes} more minute(s) before hunting or exploring again.`
        ));
    }

    const tier = resolveHuntingTier(route, user);
    const table = getTable(location, route, tier);
    if (!table || !table.length) {
        return message.reply(formatError('هذا المسار/التخصص غير مضبوط لهذا المكان بعد.', 'This route/specialty is not configured for this location yet.'));
    }

    const drop = pickOne(table);
    if (drop) grantMaterial(user, drop.name, drop.amount);

    let uniqueResult = null;
    if (location === 'forest' || location === 'lake') {
        const unique = getUniqueReward(location);
        if (unique) uniqueResult = grantUnique(user, unique);
    }

    user.hunting.lastHuntAt = now;
    user.hunting.cooldownUntil = now + (cfg.HUNTING.cooldownMinutes * 60 * 1000);
    user.hunting.history.unshift({
        at: now,
        route,
        tier,
        location,
        drop: drop?.name || null,
        unique: uniqueResult?.name || null
    });
    user.hunting.history = user.hunting.history.slice(0, 20);

    await db.saveUser(user);

    const lines = [
        `Location: **${location}**`,
        `Route: **${routeLabel(route)}**`,
        `Tier: **${tier || '-'}**`,
        `Material: **${drop ? `${drop.amount}x ${drop.name}` : 'none'}**`
    ];

    if (uniqueResult) {
        lines.push(uniqueResult.duplicate
            ? 'Unique drop was already owned, so fallback compensation was granted.'
            : 'Unique gear was found and stored in your inventory.');
    }

    const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle('🏹 Hunt Result')
        .setDescription(lines.join('\n'))
        .addFields(
            { name: 'Next use', value: `<t:${Math.floor(user.hunting.cooldownUntil / 1000)}:R>`, inline: true },
            { name: 'Tracked materials', value: Object.keys(user.materials).slice(0, 6).join(', ') || '-', inline: true }
        )
        .setFooter({ text: FOOTER_TEXT })
        .setTimestamp();

    return message.reply({ embeds: [embed] });
}

module.exports = {
    ensureHuntingFields,
    resolveHuntingTier,
    handleHuntCommand
};