const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { COLORS, FOOTER_TEXT, formatError, formatSuccess } = require('../utils/uiConstants');
const cfg = require('../config/gameplayConfig');
const progressionService = require('./progressionService');

const CRAFT_RECIPES = {
    life_elixir: {
        id: 'life_elixir',
        label: 'إكسير الحياة / نبض المحيط',
        path: 'atelier',
        category: 'legendary_potion',
        variants: {
            forest: {
                outputName: 'إكسير الحياة',
                requirements: [
                    { options: ['forest_heart', 'sea_heart'], amount: 1 },
                    { options: ['magic_flower', 'coral'], amount: 3 },
                    { options: ['herb', 'algae'], amount: 20 }
                ],
                effect: 'يمنع نقصان الـ HP لمدة 30 يوماً.'
            },
            lake: {
                outputName: 'نبض المحيط',
                requirements: [
                    { options: ['forest_heart', 'sea_heart'], amount: 1 },
                    { options: ['magic_flower', 'coral'], amount: 3 },
                    { options: ['herb', 'algae'], amount: 20 }
                ],
                effect: 'يمنع نقصان الـ HP لمدة 30 يوماً.'
            }
        }
    },
    forest_sap: {
        id: 'forest_sap',
        label: 'عصارة الغابة / سائل خارق',
        path: 'atelier',
        category: 'epic_potion',
        variants: {
            forest: {
                outputName: 'عصارة الغابة',
                requirements: [
                    { options: ['magic_flower', 'coral'], amount: 3 },
                    { options: ['poison_mushroom', 'shell'], amount: 6 },
                    { options: ['herb', 'algae'], amount: 25 }
                ],
                effect: 'يعيد الـ HP إلى 100%.'
            },
            lake: {
                outputName: 'سائل خارق',
                requirements: [
                    { options: ['magic_flower', 'coral'], amount: 3 },
                    { options: ['poison_mushroom', 'shell'], amount: 6 },
                    { options: ['herb', 'algae'], amount: 25 }
                ],
                effect: 'يعيد الـ HP إلى 100%.'
            }
        }
    },
    healing_magic: {
        id: 'healing_magic',
        label: 'سحر الشفاء / ماء شافي',
        path: 'atelier',
        category: 'rare_potion',
        variants: {
            forest: {
                outputName: 'سحر الشفاء',
                requirements: [
                    { options: ['magic_flower', 'coral'], amount: 1 },
                    { options: ['poison_mushroom', 'shell'], amount: 10 }
                ],
                effect: 'يعيد +30% HP.'
            },
            lake: {
                outputName: 'ماء شافي',
                requirements: [
                    { options: ['magic_flower', 'coral'], amount: 1 },
                    { options: ['poison_mushroom', 'shell'], amount: 10 }
                ],
                effect: 'يعيد +30% HP.'
            }
        }
    },
    herbs: {
        id: 'herbs',
        label: 'أعشاب / طحالب مائية',
        path: 'atelier',
        category: 'common_potion',
        variants: {
            forest: {
                outputName: 'أعشاب',
                requirements: [
                    { options: ['herb', 'algae'], amount: 40 }
                ],
                effect: 'يعيد +5% HP.'
            },
            lake: {
                outputName: 'طحالب مائية',
                requirements: [
                    { options: ['herb', 'algae'], amount: 40 }
                ],
                effect: 'يعيد +5% HP.'
            }
        }
    },
    dark_forest_set: {
        id: 'dark_forest_set',
        label: 'طقم الغابة المظلمة',
        path: 'atelier',
        category: 'gear_set',
        outputName: 'طقم الغابة المظلمة',
        requirements: [
            { options: ['green_mana_stone'], amount: 10 },
            { options: ['boar_horn'], amount: 12 },
            { options: ['tiger_skin'], amount: 5 }
        ],
        effect: 'تقليل ضرر بنسبة 70%، أو 75% مع الدرع اليدوي.'
    },
    deep_lake_set: {
        id: 'deep_lake_set',
        label: 'طقم البحيرة العميقة',
        path: 'atelier',
        category: 'gear_set',
        outputName: 'طقم البحيرة العميقة',
        requirements: [
            { options: ['blue_mana_stone'], amount: 10 },
            { options: ['sea_dragon_scales'], amount: 6 },
            { options: ['sea_dragon_bones'], amount: 6 },
            { options: ['starfish'], amount: 10 }
        ],
        effect: 'تقليل ضرر بنسبة 75%، أو 80% مع الدرع اليدوي.'
    }
};

const RECIPE_ORDER = [
    'life_elixir',
    'forest_sap',
    'healing_magic',
    'herbs',
    'dark_forest_set',
    'deep_lake_set'
];

function ensureCraftFields(user) {
    if (!user.inventory || typeof user.inventory !== 'object') {
        user.inventory = { materials: {}, items: [], gear: { helmet: [], chest: [], pants: [], shoes: [], weapon: [], shield: [] } };
    }
    if (!user.inventory.materials || typeof user.inventory.materials !== 'object') user.inventory.materials = {};
    if (!Array.isArray(user.inventory.items)) user.inventory.items = [];
    if (!user.inventory.gear || typeof user.inventory.gear !== 'object') {
        user.inventory.gear = { helmet: [], chest: [], pants: [], shoes: [], weapon: [], shield: [] };
    }
    if (!user.crafting || typeof user.crafting !== 'object') {
        user.crafting = { active: null, history: [] };
    }
    if (!Array.isArray(user.crafting.history)) user.crafting.history = [];
    if (!user.path) user.path = user.currentRoute || null;
    if (!user.clanId && user.clan?.id) user.clanId = user.clan.id;
    return user;
}

async function loadCraftUser(message) {
    const synced = message.member ? await progressionService.syncMemberState(message.member).catch(() => null) : null;
    return ensureCraftFields(synced || await db.getUser(message.author.id));
}

function getRecipe(recipeId) {
    return CRAFT_RECIPES[recipeId] || null;
}

function getRecipeVariant(recipe, user, chosenVariant = null) {
    if (!recipe.variants) {
        return { outputName: recipe.outputName, requirements: recipe.requirements, effect: recipe.effect };
    }

    const preferred = chosenVariant && recipe.variants[chosenVariant] ? chosenVariant : null;
    if (preferred) {
        return recipe.variants[preferred];
    }

    const availableMaterials = user.inventory?.materials || {};
    const forestMaterialSet = ['forest_heart', 'magic_flower', 'herb', 'poison_mushroom'];
    const lakeMaterialSet = ['sea_heart', 'coral', 'algae', 'shell'];
    const forestScore = forestMaterialSet.reduce((sum, name) => sum + Number(availableMaterials[name] || 0), 0);
    const lakeScore = lakeMaterialSet.reduce((sum, name) => sum + Number(availableMaterials[name] || 0), 0);

    if (forestScore === 0 && lakeScore === 0) {
        return recipe.variants.forest || recipe.variants.lake || null;
    }

    return forestScore >= lakeScore ? (recipe.variants.forest || recipe.variants.lake) : (recipe.variants.lake || recipe.variants.forest);
}

function recipeProgressText(active, recipe) {
    if (!active) return 'لا توجد جلسة تصنيع نشطة حالياً.';

    const lines = recipe.requirements.map((req) => {
        const current = req.options.reduce((sum, key) => sum + Number(active.collected?.[key] || 0), 0);
        const required = Number(req.amount || 0);
        return `• ${req.options.join(' / ')} ${current}/${required}`;
    });

    return lines.join('\n');
}

function getRequirementProgress(active, requirement) {
    return requirement.options.reduce((sum, key) => sum + Number(active.collected?.[key] || 0), 0);
}

function buildCraftEmbed(owner, ownerUser) {
    const active = ownerUser.crafting?.active || null;
    const activeRecipe = active ? getRecipe(active.recipeId) : null;
    const activeVariant = active && activeRecipe ? getRecipeVariant(activeRecipe, ownerUser, active.variant) : null;

    const description = [
        'التصنيع يعمل عبر النقر على الأزرار أدناه.',
        'صاحب الجلسة يبدأ المشروع، ثم يساهم أعضاء الكلان من مخزونهم الخاص.',
        '',
        `صاحب الجلسة: **${owner.displayName || owner.user?.tag || owner.id}**`,
        `كلان صاحب الجلسة: **${ownerUser.clanId || '-'}**`,
        `المسار المطلوب: **Atelier**`,
        '',
        activeRecipe
            ? `العمل النشط: **${activeRecipe.label}**${activeVariant?.outputName ? `\nالناتج الحالي: **${activeVariant.outputName}**` : ''}\n${recipeProgressText(active, activeRecipe)}`
            : 'اختر وصفة من الأزرار لبدء جلسة تصنيع.'
    ].join('\n');

    return new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle('🛠️ التصنيع الجماعي')
        .setDescription(description)
        .setFooter({ text: FOOTER_TEXT })
        .setTimestamp();
}

function buildCraftComponents(ownerId) {
    const buttons = RECIPE_ORDER.map((recipeId) => {
        const recipe = getRecipe(recipeId);
        return new ButtonBuilder()
            .setCustomId(`craft:recipe:${ownerId}:${recipeId}`)
            .setLabel(recipe.label)
            .setStyle(ButtonStyle.Primary);
    });

    return [
        new ActionRowBuilder().addComponents(buttons.slice(0, 3)),
        new ActionRowBuilder().addComponents(buttons.slice(3, 6))
    ];
}

function findAvailableContribution(materials, requirement) {
    for (const option of requirement.options) {
        const available = Number(materials[option] || 0);
        if (available > 0) {
            return { key: option, amount: Math.min(available, requirement.amount) };
        }
    }
    return null;
}

function determineVariantFromContribution(recipe, contributionKey) {
    if (!recipe.variants) return null;
    if (!contributionKey) return null;

    if (recipe.id === 'life_elixir') {
        return contributionKey === 'sea_heart' ? 'lake' : 'forest';
    }
    if (recipe.id === 'forest_sap') {
        return contributionKey === 'coral' || contributionKey === 'shell' ? 'lake' : 'forest';
    }
    if (recipe.id === 'healing_magic') {
        return contributionKey === 'coral' || contributionKey === 'shell' ? 'lake' : 'forest';
    }
    if (recipe.id === 'herbs') {
        return contributionKey === 'algae' ? 'lake' : 'forest';
    }

    return null;
}

function isCraftComplete(active, recipe) {
    return recipe.requirements.every((requirement) => {
        const current = getRequirementProgress(active, requirement);
        return current >= Number(requirement.amount || 0);
    });
}

function consumeMaterialsFromUser(user, recipe, active) {
    const materials = user.inventory.materials;
    if (!active.collected) active.collected = {};

    let usedAny = false;
    let chosenVariant = active.variant || null;

    for (const requirement of recipe.requirements) {
        let remaining = Number(requirement.amount || 0) - getRequirementProgress(active, requirement);
        if (remaining <= 0) continue;

        const contribution = findAvailableContribution(materials, requirement);
        if (!contribution) continue;

        const deposit = Math.min(contribution.amount, remaining);
        materials[contribution.key] = Number(materials[contribution.key] || 0) - deposit;
        if (materials[contribution.key] < 0) materials[contribution.key] = 0;
        active.collected[contribution.key] = Number(active.collected[contribution.key] || 0) + deposit;
        usedAny = true;

        if (!chosenVariant) {
            chosenVariant = determineVariantFromContribution(recipe, contribution.key);
        }
    }

    user.materials = materials;
    user.inventory.materials = materials;
    return { usedAny, chosenVariant };
}

function addCraftedOutput(ownerUser, recipe, active) {
    const variant = getRecipeVariant(recipe, ownerUser, active.variant);
    if (!Array.isArray(ownerUser.inventory.items)) ownerUser.inventory.items = [];

    ownerUser.inventory.items.push({
        id: `${recipe.id}_${Date.now()}`,
        name: variant.outputName,
        key: recipe.id,
        type: recipe.category,
        category: 'craft_output',
        effect: variant.effect,
        craftedAt: Date.now(),
        variant: active.variant || null
    });
}

async function refreshCraftMessage(interaction, ownerUser) {
    const ownerId = ownerUser.id || ownerUser.userId || interaction.user.id;
    const owner = interaction.user.id === ownerId ? interaction.user : await interaction.client.users.fetch(ownerId).catch(() => null);
    const embed = buildCraftEmbed(owner || { displayName: ownerId, id: ownerId }, ownerUser);
    const components = buildCraftComponents(ownerId);
    await interaction.update({ embeds: [embed], components }).catch(() => {});
}

async function handleCraftCommand(message) {
    const user = await loadCraftUser(message);
    const path = String(user.path || user.currentRoute || '').toLowerCase();

    if (path !== 'atelier') {
        return message.reply(formatError('أمر التصنيع متاح لمسار Atelier فقط.', 'Crafting is only available for the Atelier path.'));
    }

    const embed = buildCraftEmbed(message.author, user);
    const components = buildCraftComponents(message.author.id);

    return message.reply({ embeds: [embed], components });
}

async function handleCraftInteraction(interaction, parts) {
    const ownerId = parts[2];
    const recipeId = parts[3];
    const recipe = getRecipe(recipeId);
    if (!recipe) {
        return interaction.reply({ content: formatError('وصفة غير معروفة.', 'Unknown crafting recipe.'), ephemeral: true });
    }

    const ownerUser = ensureCraftFields(await db.getUser(ownerId));
    const clickerSynced = interaction.member ? await progressionService.syncMemberState(interaction.member).catch(() => null) : null;
    const clickerUser = ensureCraftFields(clickerSynced || await db.getUser(interaction.user.id));

    if (!ownerUser.clanId || ownerUser.clanId !== clickerUser.clanId) {
        return interaction.reply({ content: formatError('يمكن لأعضاء نفس الكلان فقط المساهمة.', 'Only clan members can contribute.'), ephemeral: true });
    }

    if (String(ownerUser.path || ownerUser.currentRoute || '').toLowerCase() !== 'atelier') {
        return interaction.reply({ content: formatError('صاحب الجلسة ليس على مسار Atelier.', 'The session owner is not on the Atelier path.'), ephemeral: true });
    }

    if (interaction.user.id !== ownerId && !ownerUser.crafting?.active) {
        return interaction.reply({ content: formatError('يجب أن يبدأ صاحب الجلسة التصنيع أولاً.', 'The owner must start the crafting session first.'), ephemeral: true });
    }

    if (!ownerUser.crafting || typeof ownerUser.crafting !== 'object') {
        ownerUser.crafting = { active: null, history: [] };
    }

    if (!ownerUser.crafting.active) {
        if (interaction.user.id !== ownerId) {
            return interaction.reply({ content: formatError('فقط صاحب الجلسة يمكنه البدء.', 'Only the session owner can start the craft.'), ephemeral: true });
        }

        ownerUser.crafting.active = {
            recipeId,
            variant: null,
            collected: {},
            startedAt: Date.now(),
            updatedAt: Date.now(),
            contributors: []
        };
    }

    if (ownerUser.crafting.active.recipeId !== recipeId) {
        return interaction.reply({ content: formatError('هذه الجلسة مرتبطة بوصفة مختلفة.', 'This session is tied to a different recipe.'), ephemeral: true });
    }

    const active = ownerUser.crafting.active;
    const result = consumeMaterialsFromUser(clickerUser, recipe, active);
    if (!result.usedAny && interaction.user.id !== ownerId) {
        return interaction.reply({ content: formatError('لا تملك مواد مناسبة للمساهمة.', 'You do not have matching materials to contribute.'), ephemeral: true });
    }

    if (!active.variant) {
        active.variant = result.chosenVariant || determineVariantFromContribution(recipe, Object.keys(clickerUser.inventory.materials).find((key) => Number(clickerUser.inventory.materials[key] || 0) > 0)) || 'forest';
    }
    active.updatedAt = Date.now();
    if (!active.contributors.includes(interaction.user.id)) active.contributors.push(interaction.user.id);

    let completed = false;
    if (isCraftComplete(active, recipe)) {
        addCraftedOutput(ownerUser, recipe, active);
        ownerUser.crafting.history.unshift({
            recipeId,
            variant: active.variant,
            completedAt: Date.now(),
            contributors: [...active.contributors]
        });
        ownerUser.crafting.history = ownerUser.crafting.history.slice(0, 20);
        ownerUser.crafting.active = null;
        completed = true;
    }

    await db.saveUser(clickerUser);
    await db.saveUser(ownerUser);

    const owner = await interaction.client.users.fetch(ownerId).catch(() => null);
    const embed = buildCraftEmbed(owner || interaction.user, ownerUser);
    const components = buildCraftComponents(ownerId);

    if (completed) {
        embed.setColor(COLORS.SUCCESS);
        embed.setDescription([
            `تم إكمال **${recipe.label}** بنجاح.`,
            `الناتج: **${getRecipeVariant(recipe, ownerUser, active.variant).outputName}**`,
            `التأثير: ${getRecipeVariant(recipe, ownerUser, active.variant).effect}`,
            '',
            `المساهمون: ${[...active.contributors].map((id) => `<@${id}>`).join(', ') || '-'}`
        ].join('\n'));
    }

    await interaction.update({ embeds: [embed], components }).catch(() => {});
}

module.exports = {
    ensureCraftFields,
    handleCraftCommand,
    handleCraftInteraction,
    getRecipe,
    getRecipeVariant,
    buildCraftEmbed,
    buildCraftComponents
};