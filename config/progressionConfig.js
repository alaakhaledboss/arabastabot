const ROUTES = ['combat', 'scholar', 'atelier', 'merchant'];

module.exports = {
    VERIFIED_ROLE_ID: '1490079203087876206',

    // Route level progression thresholds (index maps to ROUTE_LEVEL_ROLE_IDS index).
    // Last route-tier unlocks before specialty gate at level 25.
    ROUTE_LEVEL_THRESHOLDS_DEFAULT: [1, 3, 7, 11, 15, 19, 22],

    // Any role in each array means the member belongs to that route.
    ROUTE_LEVEL_ROLE_IDS: {
        combat: [
            '1483055696810610792', // neophyte
            '1483056507950993439', // squire
            '1483056454683590656', // sentinel
            '1483056668031062016', // crusader
            '1483055652325818381', // warlord
            '1483055481311334613', // conqueror
            '1483055295008608397'  // immortal
        ],
        scholar: [
            '1483057508414394408', // seeker
            '1483057593269227631', // scribe
            '1483057637754142730', // analyst
            '1483057676450664619', // philosopher
            '1483057701348180010', // sage
            '1483057748055691274', // oracle
            '1483057803294670959'  // omniscient
        ],
        atelier: [
            '1483059322601869363', // fledgling
            '1483059336895922189', // artisan
            '1483059379845726229', // designer
            '1483059363143880866', // visionary
            '1483059429724127355', // genius
            '1483059469280612443', // virtuoso
            '1483059478302822421'  // maestro
        ],
        merchant: [
            '1483060797054914571', // peddler
            '1483060878482997268', // trader
            '1483060887303749713', // broker
            '1483060915766300803', // affluent
            '1483060943847030865', // tycoon
            '1483060963740618772', // magnate
            '1483060995634102293'  // sovereign
        ]
    },

    ROUTE_LEVEL_LABELS: {
        combat: ['neophyte', 'squire', 'sentinel', 'crusader', 'warlord', 'conqueror', 'immortal'],
        scholar: ['seeker', 'scribe', 'analyst', 'philosopher', 'sage', 'oracle', 'omniscient'],
        atelier: ['fledgling', 'artisan', 'designer', 'visionary', 'genius', 'virtuoso', 'maestro'],
        merchant: ['peddler', 'trader', 'broker', 'affluent', 'tycoon', 'magnate', 'sovereign']
    },

    SPECIALTY_ROLE_IDS: {
        combat: {
            duelist: '1483063329143521370',
            berserker: '1483063382721433672',
            marshal: '1483063428124770404'
        },
        scholar: {
            theorist: '1483064441489850368',
            dialectician: '1483064475581022299',
            archivist: '1483064511148724235'
        },
        atelier: {
            illustrator: '1483064526596472892',
            raconteur: '1483064549170086030',
            auteur: '1483064579121483839'
        },
        merchant: {
            patrician: '1483064586054799461',
            syndicate: '1483064606141452433',
            oligarch: '1483064639028985936'
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