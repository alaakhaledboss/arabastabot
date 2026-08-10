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

const HUNTING = {
    cooldownMinutes: 20,
    uniqueDropRefunds: {
        forest_dark_sword: { gold: 1000, gems: 3 },
        forest_dark_armor: { gold: 500, gems: 1 },
        sea_dragon_vest: { gold: 1000, gems: 3 },
        sea_dragon_waist: { gold: 1000, gems: 3 }
    }
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
    HUNTING,
    GEAR,
    getMissingPlaceholders
};