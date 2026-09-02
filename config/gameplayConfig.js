const CLAN_ROLES = {
    founder: '1526672521758507240',
    deputy: '1526672645632954554',
    member: '1526672710313181425'
};

const CHANNELS = {
    forestHunt: '1497870261234565151',
    lakeHunt: '1497870477295747154',
    theValley: '1497870721202913351',
    theMaze: '1499687080714829834',
    clanPanel: '1526679696840851656',
    clanAdminReview: '1526680260341666037',
    gearStore: '1526680744196440104',
    gearPostStore: '1526680918721302818'
};

const CLAN = {
    maxMembers: 12,
    minMembers: 5,
    founderAbsenceDays: 21,
    approvalRequiredMembers: 5,
    monthlyResetDay: 1
};

const ITEM_DEFINITIONS = {
    grass: { id: 'grass', displayName: 'Grass', arabicName: 'عشب', rarity: 'common', type: 'material', quantityBehavior: 'stack' },
    poison_mushroom: { id: 'poison_mushroom', displayName: 'Poisonous Mushroom', arabicName: 'فطر سام', rarity: 'common', type: 'material', quantityBehavior: 'stack' },
    magic_flower: { id: 'magic_flower', displayName: 'Magical Flower', arabicName: 'زهرة سحرية', rarity: 'epic', type: 'material', quantityBehavior: 'stack' },
    forest_heart: { id: 'forest_heart', displayName: 'Forest Heart', arabicName: 'قلب الغابة', rarity: 'legendary', type: 'material', quantityBehavior: 'stack' },
    algae: { id: 'algae', displayName: 'Algae', arabicName: 'طحالب', rarity: 'common', type: 'material', quantityBehavior: 'stack' },
    shell: { id: 'shell', displayName: 'Seashell', arabicName: 'صدفة', rarity: 'common', type: 'material', quantityBehavior: 'stack' },
    coral: { id: 'coral', displayName: 'Coral', arabicName: 'مرجان', rarity: 'epic', type: 'material', quantityBehavior: 'stack' },
    sea_heart: { id: 'sea_heart', displayName: 'Sea Heart', arabicName: 'قلب البحر', rarity: 'legendary', type: 'material', quantityBehavior: 'stack' },
    tiger_skin: { id: 'tiger_skin', displayName: 'Tiger Skin', arabicName: 'جلد النمر', rarity: 'common', type: 'material', quantityBehavior: 'stack' },
    boar_horn: { id: 'boar_horn', displayName: 'Wild Boar Horn', arabicName: 'قرن الخنزير البري', rarity: 'rare', type: 'material', quantityBehavior: 'stack' },
    green_mana_stone: { id: 'green_mana_stone', displayName: 'Green Mana Stone', arabicName: 'حجر السحر الأخضر', rarity: 'epic', type: 'material', quantityBehavior: 'stack' },
    starfish: { id: 'starfish', displayName: 'Starfish', arabicName: 'نجم البحر', rarity: 'common', type: 'material', quantityBehavior: 'stack' },
    sea_dragon_bones: { id: 'sea_dragon_bones', displayName: 'Sea Dragon Bones', arabicName: 'عظام تنين البحر', rarity: 'rare', type: 'material', quantityBehavior: 'stack' },
    sea_dragon_scales: { id: 'sea_dragon_scales', displayName: 'Sea Dragon Scales', arabicName: 'قشور تنين البحر', rarity: 'epic', type: 'material', quantityBehavior: 'stack' },
    blue_mana_stone: { id: 'blue_mana_stone', displayName: 'Blue Mana Stone', arabicName: 'حجر السحر الأزرق', rarity: 'legendary', type: 'material', quantityBehavior: 'stack' },
    dark_forest_sword: { id: 'dark_forest_sword', displayName: 'Dark Forest Sword', arabicName: 'سيف الغابة المظلمة', rarity: 'epic', type: 'weapon', quantityBehavior: 'unique', unique: true },
    dark_forest_shield: { id: 'dark_forest_shield', displayName: 'Dark Forest Hand Shield', arabicName: 'درع يد الغابة المظلمة', rarity: 'epic', type: 'shield', quantityBehavior: 'unique', unique: true, effect: { damageReduction: 5 } },
    deep_lake_sword: { id: 'deep_lake_sword', displayName: 'Deep Lake Sword', arabicName: 'سيف البحيرة العميقة', rarity: 'epic', type: 'weapon', quantityBehavior: 'unique', unique: true },
    deep_lake_shield: { id: 'deep_lake_shield', displayName: 'Deep Lake Hand Shield', arabicName: 'درع يد البحيرة العميقة', rarity: 'epic', type: 'shield', quantityBehavior: 'unique', unique: true, effect: { damageReduction: 5 } }
};

const MONTHLY_LIMITS = {
    scholarPotions: { legendary: 1, epic: 5, rare: 10, common: Infinity },
    atelierCrafting: { legendary: 1, epic: 2, rare: 4, common: Infinity },
    merchantSelling: { legendary: 1, epic: 4, rare: 6, common: Infinity },
    merchantTransfers: { noble: 2, experienced_merchant: 4, beginner_merchant: 6 }
};

const LOCATION_COOLDOWNS = {
    forest: 30 * 60 * 1000,
    lake: 60 * 60 * 1000
};

const LOCATIONS = {
    forest: {
        cooldownMs: LOCATION_COOLDOWNS.forest,
        activities: {
            combat: { label: 'Hunt', labelAr: 'صيد', enabledRoutes: ['combat'] },
            scholar: { label: 'Explore', labelAr: 'استكشاف', enabledRoutes: ['scholar'] }
        },
        universalDrops: [
            { id: 'dark_forest_sword', chance: 1, rarity: 'epic', quantity: 1, duplicateRefund: { gold: 2000, gems: 3 } },
            { id: 'dark_forest_shield', chance: 1, rarity: 'epic', quantity: 1, duplicateRefund: { gold: 2000, gems: 3 }, effect: { damageReduction: 5 } }
        ],
        rewardTables: {
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
            },
            scholar: {
                professor: [
                    { name: 'grass', amount: 5, chance: 62 },
                    { name: 'poison_mushroom', amount: 2, chance: 20 },
                    { name: 'magic_flower', amount: 1, chance: 10 },
                    { name: 'forest_heart', amount: 1, chance: 6 }
                ],
                expert: [
                    { name: 'grass', amount: 7, chance: 50 },
                    { name: 'poison_mushroom', amount: 4, chance: 26.5 },
                    { name: 'magic_flower', amount: 2, chance: 18 },
                    { name: 'forest_heart', amount: 1, chance: 3.5 }
                ],
                instructor: [
                    { name: 'grass', amount: 7, chance: 50 },
                    { name: 'poison_mushroom', amount: 4, chance: 26.5 },
                    { name: 'magic_flower', amount: 2, chance: 18 },
                    { name: 'forest_heart', amount: 1, chance: 3.5 }
                ]
            }
        }
    },
    lake: {
        cooldownMs: LOCATION_COOLDOWNS.lake,
        activities: {
            combat: { label: 'Hunt', labelAr: 'صيد', enabledRoutes: ['combat'] },
            scholar: { label: 'Explore', labelAr: 'استكشاف', enabledRoutes: ['scholar'] }
        },
        universalDrops: [
            { id: 'deep_lake_sword', chance: 1, rarity: 'epic', quantity: 1, duplicateRefund: { gold: 2000, gems: 3 } },
            { id: 'deep_lake_shield', chance: 1, rarity: 'epic', quantity: 1, duplicateRefund: { gold: 2000, gems: 3 }, effect: { damageReduction: 5 } }
        ],
        rewardTables: {
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
            },
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
            }
        }
    }
};

const HUNTING = {
    cooldownMinutes: 20,
    uniqueDropRefunds: {
        forest_dark_sword: { gold: 1000, gems: 3 },
        forest_dark_armor: { gold: 500, gems: 1 },
        sea_dragon_vest: { gold: 1000, gems: 3 },
        sea_dragon_waist: { gold: 1000, gems: 3 }
    },
    merchantDailyGoldBonus: 100,
    damageMultiplier: 1,
    rewardChanceModifier: 1
};

const GEAR = {
    slots: ['helmet', 'chest', 'pants', 'shoes', 'weapon', 'shield'],
    slotLabels: {
        helmet: 'الخوذة',
        chest: 'السترة',
        pants: 'البنطلون',
        shoes: 'الحذاء',
        weapon: 'السلاح',
        shield: 'الدرع'
    },
    storeItems: [
        { slot: 'helmet', name: 'Leather Cap', priceGold: 500 },
        { slot: 'helmet', name: 'Iron Helmet', priceGold: 1500 },
        { slot: 'chest', name: 'Tattered Tunic', priceGold: 300 },
        { slot: 'chest', name: 'Iron Plate', priceGold: 2000 },
        { slot: 'pants', name: 'Cloth Pants', priceGold: 400 },
        { slot: 'shoes', name: 'Worn Boots', priceGold: 250 },
        { slot: 'weapon', name: 'Rusty Sword', priceGold: 1000 },
        { slot: 'shield', name: 'Wooden Shield', priceGold: 800 }
    ]
};

function getMissingPlaceholders() {
    const required = [
        'CLAN_ROLES.founder',
        'CLAN_ROLES.deputy',
        'CLAN_ROLES.member',
        'CHANNELS.forestHunt',
        'CHANNELS.lakeHunt',
        'CHANNELS.theValley',
        'CHANNELS.theMaze',
        'CHANNELS.clanPanel',
        'CHANNELS.clanAdminReview',
        'CHANNELS.gearStore',
        'CHANNELS.gearPostStore'
    ];

    return required.filter((key) => {
        const [group, field] = key.split('.');
        const value = group === 'CLAN_ROLES' ? CLAN_ROLES[field] : CHANNELS[field];
        return !String(value || '').trim();
    });
}

module.exports = {
    CLAN_ROLES,
    CHANNELS,
    CLAN,
    ITEM_DEFINITIONS,
    MONTHLY_LIMITS,
    LOCATION_COOLDOWNS,
    LOCATIONS,
    HUNTING,
    GEAR,
    getMissingPlaceholders
};