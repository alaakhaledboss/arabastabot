const db = require('../db');
const { EmbedBuilder } = require('discord.js');
const { COLORS, EMOJIS, FOOTER_TEXT, formatError, createCurrencyField } = require('../utils/uiConstants');
const levelUpAnnounceService = require('./levelUpAnnounceService');
const progressionService = require('./progressionService');

const DEFAULT_DAILY_GOLD_CAP_DISPLAY = 350;
const CLAN_DAILY_GOLD_CAP_DISPLAY = 450;
const MESSAGE_TARGET = 100;
const MESSAGE_BONUS_GOLD_INTERNAL = 50 * 10;
const VOICE_TARGET_SECONDS = 10 * 60;
const VOICE_BONUS_GOLD_INTERNAL = 50 * 10;
const VOICE_BONUS_XP = 100;

function getTodayKeyLocal() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`; // YYYY-MM-DD (local/server timezone)
}

function ensureTaskStructure(user) {
    if (user.task_daily_date === undefined) user.task_daily_date = '';
    if (user.task_daily_messages === undefined) user.task_daily_messages = 0;
    if (user.task_daily_message_bonus_claimed === undefined) user.task_daily_message_bonus_claimed = false;
    if (user.task_daily_voice_seconds === undefined) user.task_daily_voice_seconds = 0;
    if (user.task_daily_voice_bonus_claimed === undefined) user.task_daily_voice_bonus_claimed = false;

    // Future slots: weekly/monthly tasks
    if (!user.task_weekly || typeof user.task_weekly !== 'object') user.task_weekly = { slots: {} };
    if (!user.task_monthly || typeof user.task_monthly !== 'object') user.task_monthly = { slots: {} };
}

function resetDailyTasksIfNeeded(user) {
    const today = getTodayKeyLocal();
    if (user.task_daily_date !== today) {
        user.task_daily_date = today;
        user.task_daily_messages = 0;
        user.task_daily_message_bonus_claimed = false;
        user.task_daily_voice_seconds = 0;
        user.task_daily_voice_bonus_claimed = false;
        return true;
    }
    return false;
}

function applyLevelUps(user) {
    const oldLevel = Number(user.level || 1);
    
    // Calculate required XP for current level
    const xpNeeded = 100 * oldLevel;

    if (user.xp >= xpNeeded) {
        user.xp -= xpNeeded;
        user.level += 1;
    }

    return {
        oldLevel,
        newLevel: Number(user.level || oldLevel)
    };
}

async function handleMessageTask(message) {
    try {
        const user = await db.getUser(message.author.id);
        ensureTaskStructure(user);
        resetDailyTasksIfNeeded(user);

        if (user.task_daily_messages < MESSAGE_TARGET) {
            user.task_daily_messages += 1;
        }

        if (!user.task_daily_message_bonus_claimed && user.task_daily_messages >= MESSAGE_TARGET) {
            user.gold += MESSAGE_BONUS_GOLD_INTERNAL;
            user.task_daily_message_bonus_claimed = true;
            await db.logTransaction({
                userId: message.author.id,
                action: 'daily_message_bonus',
                goldAmount: MESSAGE_BONUS_GOLD_INTERNAL / 10,
                reason: 'Daily task bonus: 100 messages',
                details: 'outside daily 350 cap'
            });
        }

        await db.saveUser(user);
    } catch (err) {
        console.error('taskService.handleMessageTask error:', err);
    }
}

async function addVoiceSeconds(memberOrUserId, seconds) {
    try {
        const member = typeof memberOrUserId === 'object' && memberOrUserId?.id ? memberOrUserId : null;
        const userId = member?.id || String(memberOrUserId || '');
        if (!userId) return;

        const addSeconds = Math.floor(Number(seconds) || 0);
        if (addSeconds <= 0) return;

        const user = await db.getUser(userId);
        ensureTaskStructure(user);
        resetDailyTasksIfNeeded(user);

        user.task_daily_voice_seconds = (user.task_daily_voice_seconds || 0) + addSeconds;

        if (!user.task_daily_voice_bonus_claimed && user.task_daily_voice_seconds >= VOICE_TARGET_SECONDS) {
            user.task_daily_voice_bonus_claimed = true;
            user.xp += VOICE_BONUS_XP;
            user.gold += VOICE_BONUS_GOLD_INTERNAL;
            await db.logTransaction({
                userId,
                action: 'daily_voice_bonus',
                goldAmount: VOICE_BONUS_GOLD_INTERNAL / 10,
                reason: 'Daily task bonus: 10 minutes voice',
                details: `xp:+${VOICE_BONUS_XP}`
            });
            const { oldLevel, newLevel } = applyLevelUps(user);

            if (newLevel > oldLevel && member?.guild) {
                await levelUpAnnounceService.announceLevelUps({
                    guild: member.guild,
                    member,
                    userId,
                    oldLevel,
                    newLevel
                });
            }
        }

        await db.saveUser(user);
    } catch (err) {
        console.error('taskService.addVoiceSeconds error:', err);
    }
}

function resolveTargetUser(message, args = []) {
    const mentioned = message.mentions?.users?.first?.();
    if (mentioned) return mentioned;

    const raw = String(args?.[0] || '').trim();
    if (!raw) return message.author;

    // Fallback: raw user id
    const idOnly = raw.replace(/[<@!>]/g, '');
    if (/^\d{16,20}$/.test(idOnly)) {
        return { id: idOnly, username: idOnly, displayName: idOnly };
    }

    return message.author;
}

async function resolveDailyGoldCapDisplay(message, targetUserId) {
    if (!message?.guild || !targetUserId) return DEFAULT_DAILY_GOLD_CAP_DISPLAY;

    const member = message.guild.members.cache.get(targetUserId)
        || await message.guild.members.fetch(targetUserId).catch(() => null);

    const routeInfo = progressionService.getRouteLevelInfo(member);
    return routeInfo.route === 'merchant' ? CLAN_DAILY_GOLD_CAP_DISPLAY : DEFAULT_DAILY_GOLD_CAP_DISPLAY;
}

async function showTaskProgress(message, args = []) {
    try {
        const targetUser = resolveTargetUser(message, args);
        const user = await db.getUser(targetUser.id);
        ensureTaskStructure(user);
        resetDailyTasksIfNeeded(user);
        await db.saveUser(user);

        const dailyGoldEarnedDisplay = Math.floor((user.daily_gold_earned || 0) / 10);
    const dailyGoldCapDisplay = await resolveDailyGoldCapDisplay(message, targetUser.id);

        const msgProgress = Math.min(user.task_daily_messages || 0, MESSAGE_TARGET);
        const voiceSeconds = Math.min(user.task_daily_voice_seconds || 0, VOICE_TARGET_SECONDS);
        const voiceMinutes = (voiceSeconds / 60).toFixed(1);

        const embed = new EmbedBuilder()
            .setColor(COLORS.INFO)
            .setTitle(`${EMOJIS.INFO} **المهام اليومية | Daily Tasks Progress**`)
            .setDescription(`> 👤 ${targetUser.id === message.author.id ? 'Your progress' : `Progress for <@${targetUser.id}>`}\n> Weekly/Monthly task slots are ready and will be activated later.`)
            .addFields(
                createCurrencyField('💰 الذهب المكتسب اليوم | Daily gold gained', `${dailyGoldEarnedDisplay}/${dailyGoldCapDisplay}`, '', false),
                createCurrencyField('📝 رسائل اليوم | Messages today', `${msgProgress}/${MESSAGE_TARGET}`, '', false),
                createCurrencyField('🎁 مكافأة الرسائل | Message bonus', user.task_daily_message_bonus_claimed ? 'Claimed ✅ (+50 gold)' : 'Not yet', '', false),
                createCurrencyField('🎙️ وقت المكالمة اليوم | Voice time today', `${voiceMinutes}/10.0 minutes`, '', false),
                createCurrencyField('🎁 مكافأة المكالمة | Voice bonus', user.task_daily_voice_bonus_claimed ? 'Claimed ✅ (+100 XP, +50 gold)' : 'Not yet', '', false)
            )
            .setFooter({ text: FOOTER_TEXT })
            .setTimestamp();

        return message.reply({ embeds: [embed] });
    } catch (err) {
        console.error('taskService.showTaskProgress error:', err);
        return message.reply(formatError('خطأ في عرض تقدم المهام.', 'Failed to show task progress.')).catch(() => {});
    }
}

module.exports = {
    handleMessageTask,
    addVoiceSeconds,
    showTaskProgress,

    // exported constants for future weekly/monthly extension
    MESSAGE_TARGET,
    VOICE_TARGET_SECONDS
};
