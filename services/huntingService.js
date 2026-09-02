const db = require('../db');
const { EmbedBuilder } = require('discord.js');
const { COLORS, FOOTER_TEXT, formatError } = require('../utils/uiConstants');
const clanService = require('./clanService');
const cfg = require('../config/gameplayConfig');
const progressionService = require('./progressionService');

const COOLDOWN_MS = cfg.HUNTING.cooldownMinutes * 60 * 1000;

const HUNT_TABLES = {
    forest: {
        scholar: {
            professor: [
                { name: 'herb', amount: 5, chance: 62 },
                { name: 'poison_mushroom', amount: 2, chance: 20 },
                { name: 'magic_flower', amount: 1, chance: 10 },
                { name: 'forest_heart', amount: 1, chance: 6 }
            ],
            expert: [
                { name: 'herb', amount: 7, chance: 50 },
                { name: 'poison_mushroom', amount: 4, chance: 26.5 },
                { name: 'magic_flower', amount: 2, chance: 18 },
                { name: 'forest_heart', amount: 1, chance: 3.5 }
            ],
            instructor: [
                { name: 'herb', amount: 7, chance: 50 },
                { name: 'poison_mushroom', amount: 4, chance: 26.5 },
                { name: 'magic_flower', amount: 2, chance: 18 },
                { name: 'forest_heart', amount: 1, chance: 3.5 }
            ]
        },
        combat: {
            swordmaster: [
                { name: 'tiger_skin', amount: 1, chance: 37 },
                { name: 'boar_horn', amount: 2, chance: 35 },
                { name: 'green_mana_stone', amount: 2, chance: 25 }
            ],
            armorer: [
                { name: 'tiger_skin', amount: 2, chance: 40 },
                { name: 'boar_horn', amount: 3, chance: 39.5 },
                { name: 'green_mana_stone', amount: 3, chance: 18.5 }
            ],
            wizard: [
                { name: 'tiger_skin', amount: 1, chance: 45 },
                { name: 'boar_horn', amount: 2, chance: 42 },
                { name: 'green_mana_stone', amount: 3, chance: 11 }
            ]
        }
    },
    lake: {
        scholar: {
            professor: [
                { name: 'algae', amount: 5, chance: 62 },
                { name: 'shell', amount: 2, chance: 20 },
                { name: 'coral', amount: 1, chance: 10 },
                { name: 'sea_heart', amount: 1, chance: 6 }
            ],
            expert: [
                { name: 'algae', amount: 8, chance: 50.5 },
                { name: 'shell', amount: 3, chance: 26.5 },
                { name: 'coral', amount: 2, chance: 18 },
                { name: 'sea_heart', amount: 1, chance: 3.5 }
            ],
            instructor: [
                { name: 'algae', amount: 8, chance: 50.5 },
                { name: 'shell', amount: 3, chance: 26.5 },
                { name: 'coral', amount: 2, chance: 18 },
                { name: 'sea_heart', amount: 1, chance: 3.5 }
            ]
        },
        combat: {
            swordmaster: [
                { name: 'starfish', amount: 1, chance: 62 },
                { name: 'sea_dragon_bones', amount: 2, chance: 20 },
                { name: 'sea_dragon_scales', amount: 2, chance: 10 },
                { name: 'blue_mana_stone', amount: 2, chance: 6 }
            ],
            armorer: [
                { name: 'starfish', amount: 1, chance: 54 },
                { name: 'sea_dragon_bones', amount: 3, chance: 25 },
                { name: 'sea_dragon_scales', amount: 3, chance: 15 },
                { name: 'blue_mana_stone', amount: 3, chance: 4 }
            ],
            wizard: [
                { name: 'starfish', amount: 1, chance: 65 },
                { name: 'sea_dragon_bones', amount: 4, chance: 20 },
                { name: 'sea_dragon_scales', amount: 3, chance: 10 },
                { name: 'blue_mana_stone', amount: 3, chance: 3 }
            ]
        }
    }
};

const UNIQUE_REWARDS = {
    forest: [
        { name: 'dark_forest_sword', display: 'Dark Forest Sword', chance: 0.5, duplicateRefund: { gold: 2000, gems: 3 } },
        { name: 'dark_forest_armor', display: 'Dark Forest Armor', chance: 0.5, duplicateRefund: { gold: 2000, gems: 3 } }
    ],
    lake: [
        { name: 'sea_dragon_vest', display: 'Sea Dragon Vest', chance: 0.5, duplicateRefund: { gold: 2000, gems: 3 } },
        { name: 'sea_dragon_waist', display: 'Sea Dragon Waist', chance: 0.5, duplicateRefund: { gold: 2000, gems: 3 } }
    ]
};

const DAMAGE_RULES = {
    scholar: {
        professor: 5,
        expert: 3.5,
        instructor: 2.5
    },
    combat: {
        forest: {
            swordmaster: {
                tiger_skin: [13, 25],
                boar_horn: [5, 12.5],
                green_mana_stone: [0, 0]
            },
            armorer: {
                tiger_skin: [10, 17.5],
                boar_horn: [4, 10],
                green_mana_stone: [0, 0]
            },
            wizard: {
                tiger_skin: [8, 14],
                boar_horn: [3, 7],
                green_mana_stone: [0, 0]
            }
        },
        lake: {
            swordmaster: {
                starfish: [5, 7],
                sea_dragon_bones: [10, 15],
                sea_dragon_scales: [15, 30],
                blue_mana_stone: [0, 0]
            },
            armorer: {
                starfish: [4, 5],
                sea_dragon_bones: [10, 13],
                sea_dragon_scales: [13, 22],
                blue_mana_stone: [0, 0]
            },
            wizard: {
                starfish: [3, 5],
                sea_dragon_bones: [8, 12],
                sea_dragon_scales: [10, 18],
                blue_mana_stone: [0, 0]
            }
        }
    }
};

const DAMAGE_REDUCTION_BY_ITEM = {
    'Leather Cap': 2,
    'Iron Helmet': 4,
    'Tattered Tunic': 2,
    'Iron Plate': 6,
    'Cloth Pants': 2,
    'Worn Boots': 2,
    'Rusty Sword': 1,
    'Wooden Shield': 5,
    'Dark Forest Sword': 8,
    'Dark Forest Armor': 25,
    'Sea Dragon Vest': 25,
    'Sea Dragon Waist': 20
};

const FULL_SET_BONUS = {
    forest: { withoutShield: 70, withShield: 75 },
    lake: { withoutShield: 75, withShield: 80 }
};

const ROUTE_LABELS = {
    combat: 'Combat',
    scholar: 'Scholar',
    atelier: 'Atelier',
    merchant: 'Merchant'
};

const TIER_LABELS = {
    professor: 'Professor',
    expert: 'Expert',
    instructor: 'Instructor',
    swordmaster: 'Swordmaster',
    armorer: 'Armorer',
    wizard: 'Wizard'
};

function getCombatDamageModifier(route, specialty) {
    if (route !== 'combat') return 1;

    const target = normalizeSpecialtyName(specialty || '');
    const skillMap = {
        swordmaster: 1.45,
        armorer: 1.2,
        wizard: 1.35
    };

    return skillMap[target] || 1;
}

function getHuntingRewardChance(location, route, specialty, rewardChance) {
    const base = Number(rewardChance || 0);
    if (!Number.isFinite(base) || base <= 0) return 0;

    const maxChance = Number(cfg.HUNTING.rewardChanceModifier || 1) * getCombatDamageModifier(route, specialty);
    const adjusted = base * maxChance;
    return Math.min(adjusted, 100);
}

function pickWeighted(entries, modifier = 1) {
    const weighted = entries
        .filter((entry) => entry && Number.isFinite(Number(entry.chance)))
        .map((entry) => ({
            ...entry,
            chance: Math.max(0, Number(entry.chance || 0) * (Number(modifier) || 1))
        }));

    const totalChance = weighted.reduce((sum, entry) => sum + entry.chance, 0);
    if (!totalChance || totalChance <= 0) return null;

    let roll = Math.random() * totalChance;
    for (const entry of weighted) {
        roll -= entry.chance;
        if (roll <= 0) return entry;
    }

    return weighted[weighted.length - 1] || null;
}

function ensureHuntingFields(user) {
    if (!user.inventory || typeof user.inventory !== 'object') {
        user.inventory = { materials: {}, items: [], gear: { helmet: [], chest: [], pants: [], shoes: [], weapon: [], shield: [] } };
    }
    if (!user.materials || typeof user.materials !== 'object') user.materials = user.inventory.materials || {};
    if (!user.equippedGear || typeof user.equippedGear !== 'object') {
        user.equippedGear = user.gearEquipment || { helmet: null, chest: null, pants: null, shoes: null, weapon: null, shield: null };
    }
    if (!user.gearEquipment || typeof user.gearEquipment !== 'object') user.gearEquipment = user.equippedGear;
    if (!user.gearInventory || typeof user.gearInventory !== 'object') user.gearInventory = user.inventory.gear || { helmet: [], chest: [], pants: [], shoes: [], weapon: [], shield: [] };
    if (!user.hunting || typeof user.hunting !== 'object') user.hunting = { lastHuntAt: 0, cooldownUntil: 0, history: [] };
    if (!Array.isArray(user.hunting.history)) user.hunting.history = [];
    if (typeof user.hp !== 'number') user.hp = Number(user.hp || 100);
    if (typeof user.path !== 'string') user.path = user.currentRoute || null;
    if (typeof user.specialization !== 'string') user.specialization = user.currentSpecialty || null;
    if (typeof user.clanId !== 'string' && user.clanId !== null) user.clanId = user.clan?.id || null;
    return user;
}

async function loadHuntingUser(message) {
    const synced = message.member ? await progressionService.syncMemberState(message.member).catch(() => null) : null;
    const user = ensureHuntingFields(synced || await db.getUser(message.author.id));
    return user;
}

function routeLabel(route) {
    return ROUTE_LABELS[route] || route || '-';
}

function tierLabel(tier) {
    return TIER_LABELS[tier] || tier || '-';
}

function normalizeKey(value) {
    return String(value || '').trim().toLowerCase();
}

function resolveRoute(user) {
    return normalizeKey(user.path || user.currentRoute);
}

const LEGACY_SPECIALTY_ALIASES = {
    theorist: 'professor',
    dialectician: 'expert',
    archivist: 'instructor',
    duelist: 'swordmaster',
    berserker: 'armorer',
    marshal: 'wizard',
    swordsman: 'swordmaster',
    mage: 'armorer',
    defender: 'wizard',
    teacher: 'instructor'
};

function normalizeSpecialtyName(value) {
    const normalized = normalizeKey(value);
    return LEGACY_SPECIALTY_ALIASES[normalized] || normalized;
}

function resolveTier(route, user) {
    const specialty = normalizeSpecialtyName(user.specialization || user.currentSpecialty);
    if (route === 'scholar') {
        if (['professor', 'expert', 'instructor'].includes(specialty)) return specialty;
        return 'professor';
    }

    if (route === 'combat') {
        if (['swordmaster', 'armorer', 'wizard'].includes(specialty)) return specialty;
        return 'swordmaster';
    }

    return null;
}

function pickOne(entries) {
    const total = entries.reduce((sum, entry) => sum + Number(entry.chance || 0), 0);
    let roll = Math.random() * total;
    for (const entry of entries) {
        roll -= Number(entry.chance || 0);
        if (roll <= 0) return entry;
    }
    return entries[entries.length - 1] || null;
}

function getTable(location, route, tier) {
    if (location === 'forest') return HUNT_TABLES.forest[route]?.[tier] || null;
    if (location === 'lake') return HUNT_TABLES.lake[route]?.[tier] || null;
    return null;
}

function getDamageRange(location, route, tier, itemName) {
    if (route === 'scholar') {
        return [DAMAGE_RULES.scholar[tier] || 0, DAMAGE_RULES.scholar[tier] || 0];
    }

    return DAMAGE_RULES.combat[location]?.[tier]?.[itemName] || [0, 0];
}

function getUniqueReward(location) {
    const entries = UNIQUE_REWARDS[location] || [];
    const total = entries.reduce((sum, entry) => sum + Number(entry.chance || 0), 0);
    const roll = Math.random() * 100;
    if (roll > total) return null;

    let remaining = roll;
    for (const entry of entries) {
        remaining -= Number(entry.chance || 0);
        if (remaining <= 0) return entry;
    }

    return null;
}

function grantMaterial(user, name, amount) {
    user.materials[name] = Number(user.materials[name] || 0) + Number(amount || 0);
    if (user.inventory?.materials) user.inventory.materials[name] = user.materials[name];
}

function addUniqueItem(user, reward) {
    const owned = Object.values(user.equippedGear || {}).includes(reward.name)
        || Object.values(user.gearInventory || {}).some((items) => Array.isArray(items) && items.includes(reward.name))
        || Array.isArray(user.inventory?.items) && user.inventory.items.some((item) => item?.name === reward.name);

    if (owned) {
        user.gold = Number(user.gold || 0) + Number(reward.duplicateRefund?.gold || 0) * 10;
        user.gems = Number(user.gems || 0) + Number(reward.duplicateRefund?.gems || 0);
        return { duplicate: true, stored: false };
    }

    if (!Array.isArray(user.inventory.items)) user.inventory.items = [];
    user.inventory.items.push({
        id: `${reward.name}_${Date.now()}`,
        name: reward.display,
        key: reward.name,
        type: 'unique',
        category: 'hunt_unique',
        source: 'hunt'
    });
    return { duplicate: false, stored: true };
}

function consumeHp(user, location, route, tier, itemName) {
    const [minDamage, maxDamage] = getDamageRange(location, route, tier, itemName);
    const baseDamage = minDamage === maxDamage ? minDamage : (Math.random() * (maxDamage - minDamage) + minDamage);

    let reduction = 0;
    const equipped = user.equippedGear || {};
    const usedItems = Object.values(equipped).filter(Boolean);

    for (const equippedItem of usedItems) {
        reduction += Number(DAMAGE_REDUCTION_BY_ITEM[equippedItem] || 0);
    }

    const hasFullForestSet = ['helmet', 'chest', 'pants', 'shoes'].every((slot) => String(equipped[slot] || '').toLowerCase().includes('dark forest'));
    const hasFullLakeSet = ['helmet', 'chest', 'pants', 'shoes'].every((slot) => String(equipped[slot] || '').toLowerCase().includes('sea dragon'));
    const shieldSlot = String(equipped.shield || '').toLowerCase();

    if (hasFullForestSet) {
        reduction = Math.max(reduction, FULL_SET_BONUS.forest[shieldSlot.includes('shield') ? 'withShield' : 'withoutShield']);
    }
    if (hasFullLakeSet) {
        reduction = Math.max(reduction, FULL_SET_BONUS.lake[shieldSlot.includes('shield') ? 'withShield' : 'withoutShield']);
    }

    const effectiveDamagePercent = Math.max(0, baseDamage - reduction);
    const damage = Math.max(0, Math.round((effectiveDamagePercent / 100) * 100));
    user.hp = Math.max(0, Number(user.hp || 100) - damage);

    return { baseDamage, reduction, effectiveDamagePercent, damage };
}

function maybeWarnLowHp(user, client, userId, previousHp = 100) {
    if (!client || typeof client.users?.fetch !== 'function') return;
    const hp = Number(user.hp || 0);
    if (hp > 10 || Number(previousHp || 0) <= 10) return;

    client.users.fetch(userId).then((discordUser) => {
        if (!discordUser) return;
        return discordUser.send(`⚠️ تنبيه صحي: وصلت نقاط حياتك إلى ${hp}/100. إذا وصلت إلى 5/100 أو أقل فلن تتمكن من الصيد أو الاستكشاف حتى تتعافى.`).catch(() => {});
    }).catch(() => {});
}

function getHpBlockReason(user) {
    if (Number(user.hp || 0) <= 5) {
        return formatError('لا يمكنك الصيد أو الاستكشاف لأن نقاط حياتك 5/100 أو أقل. تعافَ أولاً.', 'You cannot hunt or explore because your HP is 5/100 or below. Recover first.');
    }
    return null;
}

function buildMenuEmbed(user) {
    return new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle('🏹 نظام الصيد والاستكشاف')
        .setDescription([
            'استخدم أزرار Hunt / Research داخل القناة المخصصة للغابة أو البحيرة.',
            'تم حذف واجهة الأمر النصي القديم لصالح النظام التفاعلي الجديد.',
            `الانتظار الثابت: **${cfg.HUNTING.cooldownMinutes} دقيقة** لكل مستخدم.`,
            '',
            `HP الحالي: **${Number(user.hp || 0)}/100**`,
            `المسار: **${routeLabel(resolveRoute(user))}**`,
            `التخصص: **${tierLabel(resolveTier(resolveRoute(user), user))}**`,
            '',
            `غابة: <#${cfg.CHANNELS.forestHunt || '0'}>`,
            `بحيرة: <#${cfg.CHANNELS.lakeHunt || '0'}>`
        ].join('\n'))
        .setFooter({ text: FOOTER_TEXT })
        .setTimestamp();
}

async function handleHuntCommand(message, args = []) {
    const user = await loadHuntingUser(message);
    const location = normalizeKey(args[0]);
    const route = resolveRoute(user);

    if (!location) {
        return message.reply({ embeds: [buildMenuEmbed(user)] });
    }

    if (!['forest', 'lake'].includes(location)) {
        return message.reply(formatError('هذا المكان غير مدعوم للصيد.', 'This location is not supported for hunting.'));
    }

    if (!route || !['combat', 'scholar'].includes(route)) {
        return message.reply(formatError('هذا النظام متاح للمقاتل أو الباحث فقط.', 'This system is only available for Combat or Scholar.'));
    }

    const hpBlockReason = getHpBlockReason(user);
    if (hpBlockReason) return message.reply(hpBlockReason);

    const expectedChannelId = location === 'forest' ? cfg.CHANNELS.forestHunt : cfg.CHANNELS.lakeHunt;
    if (message.channel?.id !== expectedChannelId) {
        return message.reply(formatError(
            `استخدم أمر ${location === 'forest' ? 'الغابة' : 'البحيرة'} داخل رومه المخصص فقط.`,
            `Use the ${location} hunt only in its dedicated channel.`
        ));
    }

    const now = Date.now();
    const lastHuntAt = Number(user.hunting.lastHuntAt || 0);
    if (lastHuntAt && now - lastHuntAt < COOLDOWN_MS) {
        const remainingMinutes = Math.ceil((COOLDOWN_MS - (now - lastHuntAt)) / 60000);
        return message.reply(formatError(
            `لا يزال عليك الانتظار ${remainingMinutes} دقيقة قبل استخدام الصيد مرة أخرى.`,
            `You must wait ${remainingMinutes} more minute(s) before hunting again.`
        ));
    }

    const tier = resolveTier(route, user);
    const table = getTable(location, route, tier);
    if (!table || !table.length) {
        return message.reply(formatError('هذا المسار أو التخصص غير مضبوط لهذا المكان بعد.', 'This route or specialty is not configured for this location yet.'));
    }

    const rewardModifier = getCombatDamageModifier(route, tier);
    const drop = pickWeighted(table, rewardModifier);
    if (drop) grantMaterial(user, drop.name, drop.amount);

    const damage = consumeHp(user, location, route, tier, drop?.name || '');
    const uniqueReward = getUniqueReward(location);
    const uniqueResult = uniqueReward ? addUniqueItem(user, uniqueReward) : null;

    user.hunting.lastHuntAt = now;
    user.hunting.cooldownUntil = now + COOLDOWN_MS;
    user.hunting.history.unshift({
        at: now,
        location,
        route,
        tier,
        drop: drop ? { name: drop.name, amount: drop.amount } : null,
        unique: uniqueReward ? { name: uniqueReward.name, duplicate: !!uniqueResult?.duplicate } : null,
        damage: damage.damage
    });
    user.hunting.history = user.hunting.history.slice(0, 20);

    const hpBeforeWarning = Number(user.hp || 0) + damage.damage;
    const hpNow = Number(user.hp || 0);

    if (hpNow === 0) {
        progressionService.resetUserRouteState(user);
        await clanService.handleFighterDeath(message.author.id, message.client).catch(() => {});
    }

    await db.saveUser(user);

    maybeWarnLowHp(user, message.client, message.author.id, hpBeforeWarning);

    const responseLines = [
        `المكان: **${location}**`,
        `المسار: **${routeLabel(route)}**`,
        `التخصص: **${tierLabel(tier)}**`,
        `المادة: **${drop ? `${drop.amount}x ${drop.name}` : 'لا شيء'}**`,
        `الضرر: **${damage.effectiveDamagePercent.toFixed(1)}%** (${damage.damage}/100)`,
        `HP الحالي: **${hpNow}/100**`,
        `انتهاء الانتظار: <t:${Math.floor(user.hunting.cooldownUntil / 1000)}:R>`
    ];

    if (uniqueReward) {
        responseLines.push(uniqueResult?.duplicate
            ? `الدروب النادر: **${uniqueReward.display}** كان مملوكًا، وتم منح التعويض البديل.`
            : `الدروب النادر: **${uniqueReward.display}** أُضيف إلى مخزونك.`);
    }

    if (hpBeforeWarning > 10 && hpNow <= 10) {
        responseLines.push('تم إرسال تنبيه خاص لأن HP وصل إلى 10/100 أو أقل.');
    }

    if (hpNow === 0) {
        responseLines.push('اللاعب وصل إلى 0 HP وتم تطبيق عقوبة الموت.');
    }

    const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle('🏹 نتيجة الصيد')
        .setDescription(responseLines.join('\n'))
        .setFooter({ text: FOOTER_TEXT })
        .setTimestamp();

    return message.reply({ embeds: [embed] });
}

module.exports = {
    ensureHuntingFields,
    handleHuntCommand,
    resolveRoute,
    resolveTier,
    getCombatDamageModifier,
    getHuntingRewardChance,
    pickWeighted
};