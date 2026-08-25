/**
 * shopService.js
 * Arabasta Bot — Shop System
 *
 * QUICK EDIT GUIDE
 * ─────────────────────────────────────────────────────────────────
 *  • Change color prices   → ROLE_COLOR_PRICES (default: DEFAULT_COLOR_PRICE)
 *  • Change color names    → COLOR_HEX_MAP
 *  • Change access prices  → ROLE_ACCESS_CONFIG
 *  • Fill access role IDs  → ROLE_ACCESS_CONFIG[n].roleId
 *  • Fill color role IDs   → ROLE_COLOR_IDS
 * ─────────────────────────────────────────────────────────────────
 */

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelType,
    PermissionFlagsBits
} = require('discord.js');
const db = require('../db');
const { COLORS, BUTTON_STYLES, EMOJIS, FOOTER_TEXT, formatError, createCurrencyField } = require('../utils/uiConstants');

// Guild + category for gold→ticket channels
const GUILD_ID = '1209486578812981288';
const BANK_CATEGORY_ID = '1258935899031601243';

// ════════════════════════════════════════════════════════════════
//  COLOR CONFIG
// ════════════════════════════════════════════════════════════════

const DEFAULT_COLOR_PRICE = 5000;

const ROLE_COLOR_PRICES = {
    22: 15000,
    24: 20000
};

const COLOR_HEX_MAP = {
    1:  'Teal Green',
    2:  'Lime Green',
    3:  'Green',
    4:  'Dark Forest Green',
    5:  'Mustard Yellow',
    6:  'Bronze',
    7:  'Dark Olive',
    8:  'Bright Orange',
    9:  'Crimson Red',
    10: 'Red',
    11: 'Dark Red',
    12: 'Magenta',
    13: 'Orchid Purple',
    14: 'Dark Purple',
    15: 'Deep Purple',
    16: 'Dark Blue',
    17: 'Cyan',
    18: 'Royal Blue',
    19: 'Deep Blue',
    20: 'Blue',
    21: 'Golden Yellow',
    22: 'White',
    23: 'Silver',
    24: 'Black'
};

// ── Fill in the actual Discord role IDs for each color slot ──
const ROLE_COLOR_IDS = {
    1:  '1481803583778455683',
    2:  '1481804057218650213',
    3:  '1481802450980573284',
    4:  '1482391315051446360',
    5:  '1482389051637235947',
    6:  '1482391885963198599',
    7:  '1481802335176097802',
    8:  '1481803730797199401',
    9:  '1482391130636030123',
    10: '1481801883822850088',
    11: '1482388879892811796',
    12: '1481803257461608499',
    13: '1481803963765362718',
    14: '1482388693762314321',
    15: '1481802542064074762',
    16: '1481802273033293954',
    17: '1481803833515442267',
    18: '1482391763065766001',
    19: '1481803329888587797',
    20: '1482391675291570246',
    21: '1482392346019762187',
    22: '1481804332650332374',
    23: '1482393205461745797',
    24: '1481804222977675264'
};

const COLOR_COUNT = 24;
const ALL_COLOR_ROLE_IDS = Object.values(ROLE_COLOR_IDS);

// ════════════════════════════════════════════════════════════════
//  ACCESS ROLE CONFIG (lowest → highest level)
// ════════════════════════════════════════════════════════════════

/**
 * level: determines upgrade hierarchy. Buying a role requires the
 * target level to be STRICTLY HIGHER than the user's current level.
 * If equal or lower → DENIED.
 *
 * ⚠️  REPLACE each roleId with the actual Discord role ID!
 */
const ROLE_ACCESS_CONFIG = [
    {
        value:       'vip2',
        label:       'VIP 2',
        emoji:       '🌟',
        roleId:      '1482402547393101834',       // VIP 2
        price:       { gold: 10000, gems: 0, honor: 0 },
        description: '**10,000** 💰 gold',
        level:       0
    },
    {
        value:       'vip1',
        label:       'VIP 1',
        emoji:       '⭐',
        roleId:      '1482401409537278186',       // VIP 1
        price:       { gold: 10000, gems: 5, honor: 0 },
        description: '**10,000** 💰 gold + **5** 💎 gems',
        level:       1
    },
    {
        value:       'velvet',
        label:       'rich',
        emoji:       '🌹',
        roleId:      '1482403173082599555',     // مخمل (Velvet)
        price:       { gold: 20000, gems: 20, honor: 1 },
        description: '**20,000** 💰 gold + **20** 💎 gems + **1** ⚔️ honor',
        level:       2
    },
    {
        value:       'bourgeois',
        label:       'bourgeois',
        emoji:       '👑',
        roleId:      '1482403333871501352',  // برجوازي (Bourgeois)
        price:       { gold: 20000, gems: 50, honor: 3 },
        description: '**20,000** 💰 gold + **50** 💎 gems + **3** ⚔️ honor',
        level:       3
    }
    ,
    {
        value:       'gif',
        label:       'GIF',
        emoji:       '🎞️',
        roleId:      '1488618034062033048',
        price:       { gold: 5000, gems: 0, honor: 0 },
        description: '**5,000** 💰 gold — lasts for a week , can be bought once a month',
        level:       4
    }
];

// ── Hierarchy helpers ─────────────────────────────────────────

function getRoleId(config) {
    return config.roleId && !config.roleId.startsWith('ROLE_ID_') ? config.roleId : null;
}

/**
 * Find the highest-level access role the member currently holds.
 * Returns { config, level } or { config: null, level: -1 }.
 */
function getCurrentAccessRole(member) {
    let currentLevel  = -1;
    let currentConfig = null;

    for (const cfg of ROLE_ACCESS_CONFIG) {
        const rid = getRoleId(cfg);
        if (rid && member.roles.cache.has(rid) && cfg.level > currentLevel) {
            currentLevel  = cfg.level;
            currentConfig = cfg;
        }
    }

    return { config: currentConfig, level: currentLevel };
}

function formatAccessPriceCompact(price) {
    const parts = [];
    if ((price.gold || 0) > 0) parts.push(`${price.gold.toLocaleString()} gold`);
    if ((price.gems || 0) > 0) parts.push(`${price.gems} gems`);
    if ((price.honor || 0) > 0) parts.push(`${price.honor} honor`);
    return parts.join(' + ') || 'Free';
}

// ════════════════════════════════════════════════════════════════
//  MODAL BUILDERS (for currency exchange + gold→credit)
// ════════════════════════════════════════════════════════════════

function createGoldCreditModal(userId) {
    const modal = new ModalBuilder()
        .setCustomId(`gold_credit:amount:${userId}`)
        .setTitle(`${EMOJIS.CREDIT} ذهب إلى كريديت | Gold to Credit`);

    const input = new TextInputBuilder()
        .setCustomId('amount')
        .setLabel('الكمية | Amount')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('الحد الأدنى 1000 ذهب | Min 1000 gold');

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
}

function createConvertToGemsModal(userId) {
    const modal = new ModalBuilder()
        .setCustomId(`convert:to_gems:${userId}`)
        .setTitle(`${EMOJIS.EXCHANGE} ذهب → جواهر | Gold → Gems`);

    const input = new TextInputBuilder()
        .setCustomId('amount')
        .setLabel('عدد الجواهر | Gems')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('أقصى 10 شهريًا | Max 10 per month');

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
}

function createConvertToHonorModal(userId) {
    const modal = new ModalBuilder()
        .setCustomId(`convert:to_honor:${userId}`)
        .setTitle(`${EMOJIS.EXCHANGE} جواهر → شرف | Gems → Honor`);

    const input = new TextInputBuilder()
        .setCustomId('amount')
        .setLabel('عدد الشرف | Honor')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('أقصى 10 شهريًا | Max 10 per month');

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
}

// ════════════════════════════════════════════════════════════════
//  MONTHLY RESET HELPER
// ════════════════════════════════════════════════════════════════

function ensureMonthlyReset(user) {
    const currentMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
    if ((user.conversion_month || '') !== currentMonth) {
        user.monthly_gold_to_gems  = 0;
        user.monthly_gems_to_honor = 0;
        user.conversion_month      = currentMonth;
        // reset gif monthly purchases
        user.monthly_gif_buys = 0;
        user.gif_month = currentMonth;
    }
}

// ════════════════════════════════════════════════════════════════
//  SHOW BAG
// ════════════════════════════════════════════════════════════════

async function showBag(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const user = await db.getUser(interaction.user.id);
        ensureMonthlyReset(user);

        const embed = new EmbedBuilder()
            .setColor(COLORS.SHOP)
            .setTitle(`${EMOJIS.BAG} **حقيبتك | Your Bag**`)
            .addFields(
                createCurrencyField(`${EMOJIS.GOLD} ذهب | Gold`, (user.gold / 10).toLocaleString(), '', true),
                createCurrencyField(`${EMOJIS.GEMS} جواهر | Gems`, user.gems, '', true),
                createCurrencyField(`${EMOJIS.HONOR} شرف | Honor`, user.honor, '', true),
                createCurrencyField(`${EMOJIS.CREDIT} كريديت | Credit`, (user.credit || 0).toLocaleString(), '', true),
                createCurrencyField(`${EMOJIS.XP} XP`, user.xp, '', true),
                createCurrencyField(`${EMOJIS.LEVEL} المستوى | Level`, user.level, '', true),
                createCurrencyField('💱 ذهب←جواهر هذا الشهر\nGold→Gems this month', `**${user.monthly_gold_to_gems || 0}/10**`, '', true),
                createCurrencyField('💱 جواهر←شرف هذا الشهر\nGems→Honor this month', `**${user.monthly_gems_to_honor || 0}/10**`, '', true),
                createCurrencyField('🎞️ صورة متحركة هذا الشهر\nGIF this month', `**${user.monthly_gif_buys || 0}/1**`, '', true)
            )
            .setFooter({ text: FOOTER_TEXT })
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('showBag error:', err);
        return interaction.followUp({ content: formatError('خطأ في تحميل الحقيبة.', 'Error loading bag.'), ephemeral: true });
    }
}

// ════════════════════════════════════════════════════════════════
//  SHOW PRODUCTS
// ════════════════════════════════════════════════════════════════

async function showProducts(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const embed = new EmbedBuilder()
            .setColor(COLORS.SHOP)
            .setTitle(`${EMOJIS.SHOP} **قائمة المتجر | Shop Menu**`)
            .setDescription(
                'اختر نوع المنتج الذي تريد شراؤه.\n' +
                'Choose a product category below.'
            )
            .setFooter({ text: FOOTER_TEXT })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`shop:color_menu:0:${interaction.user.id}`)
                .setLabel(`${EMOJIS.COLOR} رتب اللون | Color Roles`)
                .setStyle(BUTTON_STYLES.PRIMARY),
            new ButtonBuilder()
                .setCustomId(`shop:access_menu:0:${interaction.user.id}`)
                .setLabel(`الرتب المميزة | Special Roles`)
                .setStyle(BUTTON_STYLES.SUCCESS)
        );

        return interaction.editReply({ embeds: [embed], components: [row] });
    } catch (err) {
        console.error('showProducts error:', err);
        return interaction.followUp({ content: formatError('خطأ في تحميل المنتجات.', 'Error loading products.'), ephemeral: true });
    }
}

// ════════════════════════════════════════════════════════════════
//  SHOW COLOR MENU
// ════════════════════════════════════════════════════════════════

async function showColorMenu(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const options = [];
        for (let slot = 1; slot <= COLOR_COUNT; slot++) {
            const gold = ROLE_COLOR_PRICES[slot] ?? DEFAULT_COLOR_PRICE;
            const name = COLOR_HEX_MAP[slot];
            options.push({
                label:       name ? `Color #${slot} — ${name}` : `Color #${slot}`,
                value:       `color:${slot}`,
                description: `${EMOJIS.GOLD} ${gold.toLocaleString()} ذهب`
            });
        }

        const lines = [];
        for (let slot = 1; slot <= COLOR_COUNT; slot++) {
            const roleId = ROLE_COLOR_IDS[slot];
            const price  = ROLE_COLOR_PRICES[slot] ?? DEFAULT_COLOR_PRICE;
            const name   = COLOR_HEX_MAP[slot];
            const mention = roleId ? `<@&${roleId}>` : `Color #${slot}`;
            lines.push(`**${slot}** — ${mention}${name ? ` (${name})` : ''} — ${EMOJIS.GOLD} **${price.toLocaleString()}** gold`);
        }

        const embed = new EmbedBuilder()
            .setColor(COLORS.SHOP)
            .setTitle(`${EMOJIS.COLOR} **رتب اللون | Color Roles**`)
            .setDescription(
                `اختر اللون من القائمة أدناه.\nSelect a color from the dropdown.\n\n` +
                lines.join('\n')
            )
            .setFooter({ text: FOOTER_TEXT })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`shop:buy_color:0:${interaction.user.id}`)
                .setPlaceholder('🎨 اختر لوناً — Pick a color...')
                .addOptions(options)
        );

        return interaction.editReply({ embeds: [embed], components: [row] });
    } catch (err) {
        console.error('showColorMenu error:', err);
        return interaction.followUp({ content: formatError('خطأ في تحميل قائمة الألوان.', 'Error loading color menu.'), ephemeral: true });
    }
}

// ════════════════════════════════════════════════════════════════
//  BUY COLOR
// ════════════════════════════════════════════════════════════════

async function buyColor(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const selected = interaction.values[0];
        const slot     = parseInt(selected.split(':')[1], 10);

        if (!slot || slot < 1 || slot > COLOR_COUNT) {
            return interaction.editReply({ content: formatError('اختيار لون غير صالح.', 'Invalid color selection.') });
        }

        const roleId = ROLE_COLOR_IDS[slot];
        if (!roleId) {
            return interaction.editReply({ content: formatError(`معرّف الرتبة للون #${slot} غير مُعين. تواصل مع الإدارة.`, `Role ID for Color #${slot} is not configured.`) });
        }

        const goldDisplay  = ROLE_COLOR_PRICES[slot] ?? DEFAULT_COLOR_PRICE;
        const goldInternal = goldDisplay * 10;

        const user   = await db.getUser(interaction.user.id);
        const bank   = await db.getBank();
        const member = interaction.member;

        if (member && member.roles.cache.has(roleId)) {
            return interaction.editReply({ content: formatError(`لديك هذا اللون بالفعل!`, `You already own **Color #${slot}**!`) });
        }

        if (user.gold < goldInternal) {
            const need = (goldInternal - user.gold) / 10;
            return interaction.editReply({
                content: formatError('رصيدك غير كافٍ | Insufficient gold.', '') + 
                         `\nتحتاج **${need.toLocaleString()} ذهب** إضافياً. | You need **${need.toLocaleString()} more gold**.`
            });
        }

        user.gold    -= goldInternal;
        bank.balance += goldInternal;

        await db.saveUser(user);
        await db.saveBank(bank);
        await db.logBankAction({ userId: interaction.user.id, action: 'buy_color', amount: goldDisplay, extra: `Color #${slot}` });
        await db.logTransaction({
            userId: interaction.user.id,
            action: 'buy_color',
            goldAmount: -goldDisplay,
            reason: `Bought role color #${slot}`,
            details: `slot:${slot}`
        });

        // Remove existing color role (only one at a time)
        if (member) {
            const existing = member.roles.cache.find(r => ALL_COLOR_ROLE_IDS.includes(r.id) && r.id !== roleId);
            if (existing) await member.roles.remove(existing.id).catch(e => console.error('Remove old color error:', e));

            try {
                await member.roles.add(roleId);
            } catch (roleErr) {
                console.error('Failed to assign color role:', roleErr);
                user.gold    += goldInternal;
                bank.balance -= goldInternal;
                await db.saveUser(user);
                await db.saveBank(bank);
                return interaction.editReply({ content: formatError('تعذّر تعيين الرتبة. تواصل مع الإدارة.', 'Could not assign the role.') });
            }
        }

        const colorName = COLOR_HEX_MAP[slot] ?? `Color #${slot}`;
        const embed = new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle(`${EMOJIS.SUCCESS} **تم الشراء بنجاح! | Purchase Successful!**`)
            .addFields(
                createCurrencyField(`${EMOJIS.COLOR} اللون | Color`, `<@&${roleId}> (${colorName})`, '', false),
                createCurrencyField(`${EMOJIS.GOLD} السعر | Price`, goldDisplay.toLocaleString(), 'ذهب', true),
                createCurrencyField(`${EMOJIS.GOLD} رصيدك | Balance`, (user.gold / 10).toLocaleString(), 'ذهب', true)
            )
            .setFooter({ text: FOOTER_TEXT })
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('buyColor error:', err);
        return interaction.followUp({ content: formatError('حدث خطأ!', 'Something went wrong!'), ephemeral: true });
    }
}

// ════════════════════════════════════════════════════════════════
//  SHOW ACCESS MENU
// ════════════════════════════════════════════════════════════════

async function showAccessMenu(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const member = interaction.member;
        const { level: currentLevel } = getCurrentAccessRole(member);

        const displayRoles = [...ROLE_ACCESS_CONFIG].sort((a, b) => {
            if (a.value === 'gif' && b.value !== 'gif') return -1;
            if (b.value === 'gif' && a.value !== 'gif') return 1;
            return a.level - b.level;
        });

        const options = displayRoles.map(role => ({
            label:       role.label,
            value:       role.value,
            description: formatAccessPriceCompact(role.price)
        }));

        const lines = displayRoles.map(r => {
            const isCurrent = member && getRoleId(r) && member.roles.cache.has(getRoleId(r));
            const canBuy    = r.level > currentLevel;
            const status    = isCurrent ? ' (لديك حالياً)' : (!canBuy ? ' (غير متاح حالياً)' : '');
            return `• ${r.label}${status}\n  السعر: ${formatAccessPriceCompact(r.price)}`;
        });

        const embed = new EmbedBuilder()
            .setColor(COLORS.ACCESS)
            .setTitle('الرتب المميزة | Special Roles')
            .setDescription(
                'الترتيب: GIF → VIP 2 → VIP 1 → rich → bourgeois\n' +
                'يمكنك شراء رتبة أعلى فقط من رتبتك الحالية.\n\n' +
                lines.join('\n\n')
            )
            .setFooter({ text: FOOTER_TEXT })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`shop:buy_access:0:${interaction.user.id}`)
                .setPlaceholder('اختر رتبة مميزة | Choose a special role')
                .addOptions(options)
        );

        return interaction.editReply({ embeds: [embed], components: [row] });
    } catch (err) {
        console.error('showAccessMenu error:', err);
        return interaction.followUp({ content: formatError('خطأ في تحميل قائمة الصلاحيات.', 'Error loading access menu.'), ephemeral: true });
    }
}

// ════════════════════════════════════════════════════════════════
//  BUY ACCESS
// ════════════════════════════════════════════════════════════════

async function buyAccess(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const selected = interaction.values[0];
        const config   = ROLE_ACCESS_CONFIG.find(r => r.value === selected);

        if (!config) {
            return interaction.editReply({ content: formatError('اختيار رتبة غير صالح.', 'Unknown role selection.') });
        }

        const roleId = getRoleId(config);
        if (!roleId) {
            return interaction.editReply({ content: formatError(`معرّف رتبة **${config.label}** غير مُعين. تواصل مع الإدارة.`) });
        }

        const member = interaction.member;

        // ── Hierarchy check ───────────────────────────────────
        const { config: currentCfg, level: currentLevel } = getCurrentAccessRole(member);

        if (config.level <= currentLevel) {
            return interaction.editReply({
                content:
                    formatError('رتبتك الحالية أعلى أو مساوية للرتبة المطلوبة.', `Your current role (${currentCfg?.label || 'none'}) is equal or higher than ${config.label}.`) + 
                    `\n\n> الترتيب: VIP 2 < VIP 1 < rich < bourgeois`
            });
        }

        // ── Already owns this exact role ──────────────────────
        // If GIF role, handle temporary ownership & monthly limit
        if (config.value === 'gif') {
            const user = await db.getUser(interaction.user.id);
            ensureMonthlyReset(user);

            // Remove expired GIF role if present
            if (user.gif_expires && Date.now() > user.gif_expires) {
                try {
                    if (member.roles.cache.has(roleId)) await member.roles.remove(roleId).catch(() => {});
                } catch (e) {}
                delete user.gif_expires;
                await db.saveUser(user);
            }

            if ((user.monthly_gif_buys || 0) >= 1) {
                return interaction.editReply({ content: formatError('يمكن شراء GIF مرة واحدة فقط في الشهر.', 'You can only buy GIF once per month.') });
            }

            if (member.roles.cache.has(roleId)) {
                return interaction.editReply({ content: formatError(`لديك رتبة **${config.label}** بالفعل!`, `You already have this role!`) });
            }
        }
        else {
            if (member.roles.cache.has(roleId)) {
                return interaction.editReply({ content: formatError(`لديك رتبة **${config.label}** بالفعل!`, `You already have this role!`) });
            }
        }

        const user = await db.getUser(interaction.user.id);
        const bank = await db.getBank();

        const goldInternal  = (config.price.gold  || 0) * 10;
        const gemsRequired  =  config.price.gems  || 0;
        const honorRequired =  config.price.honor || 0;

        // ── Affordability ──────────────────────────────────────
        const missing = [];
        if (goldInternal  > 0 && user.gold  < goldInternal)  missing.push(`${config.price.gold.toLocaleString()} ${EMOJIS.GOLD} ذهب`);
        if (gemsRequired  > 0 && user.gems  < gemsRequired)  missing.push(`${gemsRequired} ${EMOJIS.GEMS} جواهر`);
        if (honorRequired > 0 && user.honor < honorRequired) missing.push(`${honorRequired} ${EMOJIS.HONOR} شرف`);

        if (missing.length) {
            return interaction.editReply({
                content: formatError('رصيدك غير كافٍ | Insufficient resources.', '') + `\nتحتاج: ${missing.join(' + ')}`
            });
        }

        // ── Deduct ────────────────────────────────────────────
        user.gold  -= goldInternal;
        user.gems  -= gemsRequired;
        user.honor -= honorRequired;

        bank.balance += goldInternal;
        bank.gems    += gemsRequired;
        bank.honor   += honorRequired;

        await db.saveUser(user);
        await db.saveBank(bank);
        await db.logBankAction({ userId: interaction.user.id, action: 'buy_access', amount: config.price.gold, extra: `${config.label} (gems:${gemsRequired} honor:${honorRequired})` });
        if ((config.price.gold || 0) > 0) {
            await db.logTransaction({
                userId: interaction.user.id,
                action: 'buy_access',
                goldAmount: -config.price.gold,
                reason: `Bought role access ${config.label}`,
                details: `gems:${gemsRequired} honor:${honorRequired}`
            });
        }

        // ── Remove old lower role (upgrade) ───────────────────
        if (currentCfg) {
            const oldRoleId = getRoleId(currentCfg);
            if (oldRoleId) {
                await member.roles.remove(oldRoleId).catch(e => console.error('Remove old access role error:', e));
            }
        }

        // ── Assign new role ────────────────────────────────────
        try {
            await member.roles.add(roleId);
        } catch (roleErr) {
            console.error('Failed to assign access role:', roleErr);
            // Refund
            user.gold  += goldInternal;
            user.gems  += gemsRequired;
            user.honor += honorRequired;
            bank.balance -= goldInternal;
            bank.gems    -= gemsRequired;
            bank.honor   -= honorRequired;
            await db.saveUser(user);
            await db.saveBank(bank);
            return interaction.editReply({ content: formatError('تعذّر تعيين الرتبة. تواصل مع الإدارة.', 'Could not assign the role.') });
        }

        // Special handling for GIF temporary role
        if (config.value === 'gif') {
            const now = Date.now();
            const weekMs = 7 * 24 * 60 * 60 * 1000;
            user.gif_expires = now + weekMs;
            user.monthly_gif_buys = (user.monthly_gif_buys || 0) + 1;
            user.gif_month = new Date().toISOString().slice(0,7);
            await db.saveUser(user);
        }

        const embed = new EmbedBuilder()
            .setColor(COLORS.ACCESS)
            .setTitle(`${EMOJIS.SUCCESS} **تم الشراء بنجاح! | Purchase Successful!**`)
            .addFields(
                createCurrencyField(`${EMOJIS.ACCESS} الرتبة | Role`, `${config.emoji || ''} **${config.label}**`, '', true),
                { name: `${EMOJIS.GOLD} السعر | Price`, value: config.description, inline: false },
                createCurrencyField(`${EMOJIS.GOLD} ذهب متبقٍ`, (user.gold / 10).toLocaleString(), '', true),
                createCurrencyField(`${EMOJIS.GEMS} جواهر متبقية`, user.gems, '', true),
                createCurrencyField(`${EMOJIS.HONOR} شرف متبقٍ`, user.honor, '', true)
            )
            .setFooter({ text: FOOTER_TEXT })
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('buyAccess error:', err);
        return interaction.followUp({ content: formatError('حدث خطأ!', 'Something went wrong!'), ephemeral: true });
    }
}

// ════════════════════════════════════════════════════════════════
//  CURRENCY EXCHANGE MENU
// ════════════════════════════════════════════════════════════════

async function showCurrencyExchange(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const user = await db.getUser(interaction.user.id);
        ensureMonthlyReset(user);
        await db.saveUser(user);

        const usedGoldToGems  = user.monthly_gold_to_gems  || 0;
        const usedGemsToHonor = user.monthly_gems_to_honor || 0;

        const embed = new EmbedBuilder()
            .setColor(COLORS.ACCESS)
            .setTitle('تحويل العملات\nCurrency Exchange')
            .setDescription(
                `${EMOJIS.EXCHANGE}\n` +
                `معدلات التحويل\n` +
                `Exchange Rates\n\n` +
                `${EMOJIS.GOLD} ${EMOJIS.GEMS}\n` +
                `ذهب إلى جواهر\n` +
                `Gold to Gems\n` +
                `كل 1000 ذهب يعطي 1 جوهر\n` +
                `Every 1000 gold gives 1 gem\n` +
                `استخدمت هذا الشهر ${usedGoldToGems} من أصل 10\n` +
                `Used this month ${usedGoldToGems} out of 10\n\n` +
                `${EMOJIS.GEMS} ${EMOJIS.HONOR}\n` +
                `جواهر إلى شرف\n` +
                `Gems to Honor\n` +
                `كل 100 جوهر يعطي 1 شرف\n` +
                `Every 100 gems gives 1 honor\n` +
                `استخدمت هذا الشهر ${usedGemsToHonor} من أصل 10\n` +
                `Used this month ${usedGemsToHonor} out of 10\n\n` +
                `الحدود الشهرية\n` +
                `Monthly Limits\n` +
                `الحد الأقصى 10 جواهر و10 شرف كل شهر\n` +
                `Maximum 10 gems and 10 honor each month\n` +
                `إعادة التعيين في أول كل شهر\n` +
                `Resets on the first day of each month`
            )
            .addFields(
                createCurrencyField(`${EMOJIS.GOLD} رصيدك الحالي\nCurrent Gold Balance`, (user.gold / 10).toLocaleString(), '', true),
                createCurrencyField(`${EMOJIS.GEMS} جواهرك الحالية\nCurrent Gems`, user.gems, '', true)
            )
            .setFooter({ text: FOOTER_TEXT })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`shop:convert_to_gems:0:${interaction.user.id}`)
                .setLabel('Gold to Gems')
                .setStyle(BUTTON_STYLES.PRIMARY)
                .setDisabled(usedGoldToGems >= 10),
            new ButtonBuilder()
                .setCustomId(`shop:convert_to_honor:0:${interaction.user.id}`)
                .setLabel('Gems to Honor')
                .setStyle(BUTTON_STYLES.SUCCESS)
                .setDisabled(usedGemsToHonor >= 10)
        );

        return interaction.editReply({ embeds: [embed], components: [row] });
    } catch (err) {
        console.error('showCurrencyExchange error:', err);
        return interaction.followUp({ content: formatError('خطأ في تحميل قائمة التحويل.', 'Error loading exchange menu.'), ephemeral: true });
    }
}

// ════════════════════════════════════════════════════════════════
//  PROCESS GOLD → CREDIT (ticket creation)
// ════════════════════════════════════════════════════════════════

async function processGoldCredit(interaction, userId) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const raw         = interaction.fields.getTextInputValue('amount');
        const goldDisplay = parseInt(raw, 10);

        if (isNaN(goldDisplay) || goldDisplay < 1000) {
            return interaction.editReply({ content: formatError('الحد الأدنى هو **1,000 ذهب**.', 'Minimum is **1,000 gold**.') });
        }

        const goldInternal = goldDisplay * 10; // stored as x10

        const user = await db.getUser(userId);
        const bank = await db.getBank();

        if (user.gold < goldInternal) {
            return interaction.editReply({
                content: formatError('رصيد الذهب غير كافٍ | Insufficient gold.', '') +
                         `\nلديك **${(user.gold / 10).toLocaleString()}** ذهب. | You have **${(user.gold / 10).toLocaleString()}** gold.`
            });
        }

        // Move gold to bank immediately
        user.gold      -= goldInternal;
        bank.balance   += goldInternal;

        await db.saveUser(user);
        await db.saveBank(bank);
        await db.logBankAction({ userId, action: 'gold_ticket', amount: goldDisplay, extra: 'Gold paid for manual credit ticket' });
        await db.logTransaction({
            userId,
            action: 'gold_ticket',
            goldAmount: -goldDisplay,
            reason: 'Paid gold for manual credit ticket',
            details: `ticketCategory:${BANK_CATEGORY_ID}`
        });

        // Build mentions for authorized users
    const authorizedSet = await db.getAuthorizedUsers();
    const authorizedIds = Array.from(authorizedSet || []);
        const mentionLine   = authorizedIds.length ? authorizedIds.map(id => `<@${id}>`).join(' ') : 'لا يوجد مستخدمون مخولون.';

        // Resolve guild and create ticket channel
        const guild = interaction.client.guilds.cache.get(GUILD_ID) || await interaction.client.guilds.fetch(GUILD_ID).catch(() => null);
        if (!guild) {
            return interaction.editReply({ content: formatError('تعذر الوصول إلى السيرفر المحدد.', 'Unable to access the target server.') });
        }

        const safeUserTag = interaction.user.id;
        const channelName = `gold-credit-${safeUserTag}`;
        const openerId = interaction.user.id;

        // Build safe permission overwrites: only include members that actually exist in the guild
        const overwrites = [];
        // deny everyone
        overwrites.push({ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] });
        // bot full access
        overwrites.push({ id: interaction.client.user.id, allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AttachFiles
        ] });

        // opener: view + read, no send
        overwrites.push({ id: openerId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] });

        // authorized users (exclude opener)
        for (const id of authorizedIds) {
            if (id === openerId) continue;
            const member = await guild.members.fetch(id).catch(() => null);
            if (!member) continue; // skip non-members to avoid API errors
            overwrites.push({ id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
        }

        // owner fallback (only if present in guild and not already added)
        const ownerId = process.env.OWNER_ID;
        if (ownerId && ownerId !== openerId) {
            const ownerMember = await guild.members.fetch(ownerId).catch(() => null);
            if (ownerMember && !overwrites.find(o => o.id === ownerId)) {
                overwrites.push({ id: ownerId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
            }
        }

        // Ensure category exists and is a valid category channel
        let parentId = undefined;
        const category = guild.channels.cache.get(BANK_CATEGORY_ID) || await guild.channels.fetch(BANK_CATEGORY_ID).catch(() => null);
        if (category && category.type === ChannelType.GuildCategory) parentId = category.id;

        let ticketChannel;
        try {
            ticketChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: parentId,
                permissionOverwrites: overwrites
            });
        } catch (e) {
            console.error('create ticket channel error:', e);
            return interaction.editReply({ content: formatError('تعذر إنشاء قناة التذكرة. تحقق من الصلاحيات.', 'Could not create ticket channel. Check permissions.') });
        }

        const timestamp = new Date().toLocaleString('en-GB', { timeZone: 'UTC', hour12: false });

        const embed = new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle(`${EMOJIS.GOLD} طلب تحويل ذهب إلى كريديت (يدوي)`)
            .setDescription([
                `المستخدم: <@${interaction.user.id}>`,
                `الكمية المدفوعة: **${goldDisplay.toLocaleString()} ذهب**`,
                `التاريخ/الوقت (UTC): **${timestamp}**`,
                `\nتم تحويل الذهب إلى البنك. الرجاء الدفع يدويًا للمستخدم في بروبوت.`
            ].join('\n'))
            .setFooter({ text: FOOTER_TEXT })
            .setTimestamp();

        await ticketChannel.send({ content: `${EMOJIS.INFO} تنبيه: ${mentionLine}`, embeds: [embed] });

        return interaction.editReply({ content: `✅ تم إنشاء تذكرة: ${ticketChannel}` });
    } catch (err) {
        console.error('processGoldCredit error:', err);
        return interaction.followUp({ content: formatError('حدث خطأ!', 'Something went wrong!'), ephemeral: true });
    }
}

// ════════════════════════════════════════════════════════════════
//  PROCESS GOLD → GEMS
// ════════════════════════════════════════════════════════════════

async function processConvertToGems(interaction, userId) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const raw        = interaction.fields.getTextInputValue('amount');
        const gemsWanted = parseInt(raw, 10);

        if (isNaN(gemsWanted) || gemsWanted < 1) {
            return interaction.editReply({ content: formatError('أدخل عدداً صحيحاً.', 'Enter a valid number.') });
        }
        if (gemsWanted > 10) {
            return interaction.editReply({ content: formatError('الحد الأقصى هو **10 جواهر** لكل طلب.', 'Maximum is **10 gems** per request.') });
        }

        const user = await db.getUser(userId);
        const bank = await db.getBank();
        ensureMonthlyReset(user);

        const alreadyUsed = user.monthly_gold_to_gems || 0;
        const remaining   = 10 - alreadyUsed;

        if (remaining <= 0) {
            return interaction.editReply({
                content: formatError('وصلت للحد الشهري — لا يمكنك شراء المزيد من الجواهر هذا الشهر.', 'Monthly limit reached — no more gems this month.')
            });
        }
        if (gemsWanted > remaining) {
            return interaction.editReply({
                content: formatError(`يمكنك شراء **${remaining}** جوهر فقط هذا الشهر.`, `You can buy only **${remaining}** more gems this month.`)
            });
        }

        const goldCostDisplay  = gemsWanted * 1000;
        const goldCostInternal = goldCostDisplay * 10;

        if (user.gold < goldCostInternal) {
            const need = goldCostDisplay - user.gold / 10;
            return interaction.editReply({
                content: formatError('رصيد الذهب غير كافٍ | Insufficient gold.', '') + 
                         `\nتحتاج **${need.toLocaleString()} ذهب** إضافياً. | You need **${need.toLocaleString()} more gold**.`
            });
        }

        user.gold               -= goldCostInternal;
        user.gems               += gemsWanted;
        user.monthly_gold_to_gems = alreadyUsed + gemsWanted;
        bank.balance             += goldCostInternal;

        await db.saveUser(user);
        await db.saveBank(bank);
        await db.logConversion({ userId, fromType: 'gold', fromAmount: goldCostDisplay, toType: 'gems', toAmount: gemsWanted });
        await db.logTransaction({
            userId,
            action: 'convert_gold_to_gems',
            goldAmount: -goldCostDisplay,
            reason: 'Converted gold to gems',
            details: `toGems:${gemsWanted}`
        });

        const embed = new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle(`${EMOJIS.SUCCESS} **تحويل ناجح | Conversion Successful**`)
            .addFields(
                createCurrencyField(`${EMOJIS.GOLD} ذهب مُستخدم | Gold Used`, goldCostDisplay.toLocaleString(), '', true),
                createCurrencyField(`${EMOJIS.GEMS} جواهر مُضافة | Gems Received`, `+${gemsWanted}`, '', true),
                createCurrencyField(`${EMOJIS.GOLD} ذهب متبقٍ | Gold Left`, (user.gold / 10).toLocaleString(), '', true),
                createCurrencyField(`${EMOJIS.GEMS} جواهر الكل | Total Gems`, user.gems, '', true),
                { name: '📅 استخدمت هذا الشهر', value: `**${user.monthly_gold_to_gems}/10** جواهر`, inline: true }
            )
            .setFooter({ text: FOOTER_TEXT })
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('processConvertToGems error:', err);
        return interaction.followUp({ content: formatError('حدث خطأ!', 'Something went wrong!'), ephemeral: true });
    }
}

// ════════════════════════════════════════════════════════════════
//  PROCESS GEMS → HONOR
// ════════════════════════════════════════════════════════════════

async function processConvertToHonor(interaction, userId) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const raw         = interaction.fields.getTextInputValue('amount');
        const honorWanted = parseInt(raw, 10);

        if (isNaN(honorWanted) || honorWanted < 1) {
            return interaction.editReply({ content: formatError('أدخل عدداً صحيحاً.', 'Enter a valid number.') });
        }
        if (honorWanted > 10) {
            return interaction.editReply({ content: formatError('الحد الأقصى هو **10 شرف** لكل طلب.', 'Maximum is **10 honor** per request.') });
        }

        const user = await db.getUser(userId);
        const bank = await db.getBank();
        ensureMonthlyReset(user);

        const alreadyUsed = user.monthly_gems_to_honor || 0;
        const remaining   = 10 - alreadyUsed;

        if (remaining <= 0) {
            return interaction.editReply({
                content: formatError('وصلت للحد الشهري — لا يمكنك شراء المزيد من الشرف هذا الشهر.', 'Monthly limit reached — no more honor this month.')
            });
        }
        if (honorWanted > remaining) {
            return interaction.editReply({
                content: formatError(`يمكنك شراء **${remaining}** شرف فقط هذا الشهر.`, `You can buy only **${remaining}** more honor this month.`)
            });
        }

        const gemsCostRequired = honorWanted * 100;

        if (user.gems < gemsCostRequired) {
            const need = gemsCostRequired - user.gems;
            return interaction.editReply({
                content: formatError('رصيد الجواهر غير كافٍ | Insufficient gems.', '') + 
                         `\nتحتاج **${need}** جوهر إضافياً. | You need **${need} more gems**.`
            });
        }

        user.gems               -= gemsCostRequired;
        user.honor              += honorWanted;
        user.monthly_gems_to_honor = alreadyUsed + honorWanted;
        bank.gems               += gemsCostRequired;

        await db.saveUser(user);
        await db.saveBank(bank);
        await db.logConversion({ userId, fromType: 'gems', fromAmount: gemsCostRequired, toType: 'honor', toAmount: honorWanted });

        const embed = new EmbedBuilder()
            .setColor(COLORS.HONOR)
            .setTitle(`${EMOJIS.SUCCESS} **تحويل ناجح | Conversion Successful**`)
            .addFields(
                createCurrencyField(`${EMOJIS.GEMS} جواهر مُستخدمة | Gems Used`, gemsCostRequired, '', true),
                createCurrencyField(`${EMOJIS.HONOR} شرف مُضاف | Honor Received`, `+${honorWanted}`, '', true),
                createCurrencyField(`${EMOJIS.GEMS} جواهر متبقية | Gems Left`, user.gems, '', true),
                createCurrencyField(`${EMOJIS.HONOR} شرف الكل | Total Honor`, user.honor, '', true),
                { name: '📅 استخدمت هذا الشهر', value: `**${user.monthly_gems_to_honor}/10** شرف`, inline: true }
            )
            .setFooter({ text: FOOTER_TEXT })
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('processConvertToHonor error:', err);
        return interaction.followUp({ content: formatError('حدث خطأ!', 'Something went wrong!'), ephemeral: true });
    }
}

// ════════════════════════════════════════════════════════════════
//  ROLE FEATURES
// ════════════════════════════════════════════════════════════════

async function showRoleFeatures(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const embed = new EmbedBuilder()
            .setColor(COLORS.PRIMARY)
            .setTitle(`${EMOJIS.ROLE} **خصائص الرتب | Role Features**`)
            .setDescription([
                `${EMOJIS.VIP} **VIP 2**`,
                '> • استخدام روم تبادل في اي بي',
                '> • Access to IP-exchange room',
                '',
                `⭐ **VIP 1**`,
                '> • كل ما سبق + نشر صور و فيديوهات',
                '> • All above + share images and videos',
                '',
                `🌹 **rich**`,
                '> • كل ما سبق + ستيكرات + ايموجيات خارج السيرفر + AI روم + رياكشن',
                '> • All above + stickers + external emojis + AI room + reactions',
                '',
                `${EMOJIS.ROLE} **bourgeois**`,
                '> • كل ما سبق + استخدام بوت الذكاء الاصطناعي في كل الشاتات',
                '> • All above + AI bot access in all chats'
            ].join('\n'))
            .setFooter({ text: FOOTER_TEXT })
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('showRoleFeatures error:', err);
        return interaction.followUp({ content: formatError('خطأ في تحميل خصائص الرتب.', 'Error loading role features.'), ephemeral: true });
    }
}

// ════════════════════════════════════════════════════════════════
//  LEGACY
// ════════════════════════════════════════════════════════════════

async function showPrices(interaction) {
    await interaction.deferReply({ ephemeral: true });
    return interaction.editReply({ content: '💡 Prices are shown directly inside each product menu!' });
}

// ════════════════════════════════════════════════════════════════
//  EXPORTS
// ════════════════════════════════════════════════════════════════

module.exports = {
    showBag,
    showProducts,
    showColorMenu,
    buyColor,
    showAccessMenu,
    buyAccess,
    showCurrencyExchange,
    processGoldCredit,
    processConvertToGems,
    processConvertToHonor,
    showRoleFeatures,
    showPrices,
    createGoldCreditModal,
    createConvertToGemsModal,
    createConvertToHonorModal
};

// Export a small helper so other modules (e.g. main.js) can remove expired GIF roles
// without duplicating the ROLE_ACCESS_CONFIG or GUILD_ID values.
function getGifRoleInfo() {
    const cfg = ROLE_ACCESS_CONFIG.find(r => r.value === 'gif');
    return { guildId: GUILD_ID, roleId: getRoleId(cfg) };
}

module.exports.getGifRoleInfo = getGifRoleInfo;
