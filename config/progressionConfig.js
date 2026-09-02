const ROUTES = ['combat', 'scholar', 'atelier', 'merchant'];

module.exports = {
    VERIFIED_ROLE_ID: '1490079203087876206',

    // Route role system simplified: route identity is no longer tied to the old 7-rank ladder.
    ROUTE_LEVEL_THRESHOLDS_DEFAULT: [1],

    ROUTE_LEVEL_ROLE_IDS: {
        combat: ['1483055696810610792'],
        scholar: ['1483057508414394408'],
        atelier: ['1483059322601869363'],
        merchant: ['1483060797054914571']
    },

    ROUTE_LEVEL_LABELS: {
        combat: ['route'],
        scholar: ['route'],
        atelier: ['route'],
        merchant: ['route']
    },

    SPECIALTY_ROLE_IDS: {
        combat: {
            swordmaster: '1483063329143521370',
            armorer: '1483063382721433672',
            wizard: '1483063428124770404'
        },
        scholar: {
            professor: '1483064441489850368',
            expert: '1483064475581022299',
            instructor: '1483064511148724235'
        },
        atelier: {
            engineer: '1483064526596472892',
            craftsman: '1483064549170086030',
            workman: '1483064579121483839'
        },
        merchant: {
            noblesse: '1483064586054799461',
            grand_merchant: '1483064606141452433',
            novice_trader: '1483064639028985936'
        }
    },

    // Shared prestige tiers (all routes).
    PRESTIGE_TIER_ROLE_IDS: [
        '1483051812914462812', // renaissance
        '1483050081564496103', // strategos
        '1483050384032272455', // vanguard
        '1483051176516784251'  // imperator (final completion)
    ],

    FINAL_COMPLETION_ROLE: '1483051176516784251', // imperator

    REBIRTH_ROLE_IDS: [
        '1483053791409340518', // phoenix
        '1483053649839263805', // mythic
        '1483053532209746063', // eternal
        '1483053340081524868'  // overlord
    ],

    ROUTE_CHANNEL_IDS: {
        combat: '1489352247598121052',
        scholar: '1489352270205419721',
        atelier: '1489352285061386380',
        merchant: '1489352308910194688'
    },

    SPECIALTY_CHANNEL_IDS: {
        combat: '1490081092466643004',
        scholar: '1490224488497938602',
        atelier: '1490224435410501734',
        merchant: '1490224360907215041'
    },

    PRESTIGE_CHANNEL_ID: '1490224893055471646',
    REBIRTH_CHANNEL_ID: '1490225008373403758',

    COSTS: {
        prestige: { gold: 20000, gems: 15, honor: 1 },
        rebirth: { gold: 10000, gems: 5 }
    },

    LEVEL_GATES: {
        specialty: 25,
        prestige: 50
    },

    LIMITS: {
        maxPrestige: 4
    },

    ROUTES
};