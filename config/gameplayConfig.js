const CLAN_ROLES = {
    founder: '1526672521758507240',
    deputy: '1526672645632954554',
    member: '1526672710313181425'
};

const CHANNELS = {
    clanPanel: '',
    clanAdminReview: '',
    forestHunt: '1497870261234565151',
    lakeHunt: '1497870477295747154',
    theValley: '1497870721202913351',
    theMaze: '1499687080714829834',
    gearStore: '',
    gearPostStore: ''
};

const CLAN = {
    maxMembers: 12,
    founderLevel: 25,
    deputyLevel: 15,
    memberLevel: 10,
    founderAbsenceDays: 21,
    voteFallbackDays: 7,
    approvalRequiredMembers: 5,
    foundingCost: { gold: 10000, gems: 10, credit: 1000000 },
    monthlyResetDay: 1
};

const HUNTING = {
    cooldownMinutes: 20,
    uniqueDropRefunds: {
        forest_dark_sword: { gold: 1000, gems: 3 },
        forest_dark_armor: { gold: 500, gems: 1 },
        sea_dragon_vest: { gold: 1000, gems: 3 },
        sea_dragon_waist_armor: { gold: 1000, gems: 3 }
    }
};

const GEAR = {
    slots: ['helmet', 'chest', 'pants', 'shoes', 'weapon', 'shield'],
    slotLabels: {
        helmet: 'الخوذة/القبعة',
        chest: 'السترة',
        pants: 'البنطلون',
        shoes: 'الحذاء',
        weapon: 'السلاح',
        shield: 'الدرع'
    }
};

function getMissingPlaceholders() {
    const required = [
        'CLAN_ROLES.founder',
        'CLAN_ROLES.deputy',
        'CLAN_ROLES.member',
        'CHANNELS.clanPanel',
        'CHANNELS.clanAdminReview',
        'CHANNELS.forestHunt',
        'CHANNELS.lakeHunt',
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