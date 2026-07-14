const moderationService = require('../services/moderationService');

function extractUserId(args = []) {
    const raw = String(args[0] || '').trim();
    if (!raw) return null;

    const userId = raw.replace(/<@!?|>/g, '');
    if (!/^\d+$/.test(userId)) return null;
    return userId;
}

async function warn(message, args) {
    if (!moderationService.isAllowedWarner(message.author.id)) {
        return message.reply('❌ You are not allowed to use this command.');
    }

    if (!message.guild) {
        return message.reply('❌ This command can only be used inside a server.');
    }

    const targetUserId = extractUserId(args);
    if (!targetUserId) {
        return message.reply('Usage: `%warn @user`');
    }

    const member = await message.guild.members.fetch(targetUserId).catch(() => null);
    if (!member) {
        return message.reply('❌ Target user is not in this server.');
    }

    if (member.user?.bot) {
        return message.reply('❌ You cannot warn bots.');
    }

    if (moderationService.isAdminMember(member)) {
        return message.reply('❌ You cannot warn admins.');
    }

    const result = await moderationService.addWarning(targetUserId, message.guild);

    if (result.skippedAdmin) {
        return message.reply('❌ Admins are immune to warnings and blacklisting.');
    }

    if (result.blacklisted) {
        return message.reply(`⚠️ <@${targetUserId}> reached 3 warnings and is now blacklisted for 7 days.`);
    }

    return message.reply(`⚠️ Warning added to <@${targetUserId}>. Current warnings: **${result.warnings}/3**.`);
}

async function removeWarning(message, args) {
    if (!moderationService.isAllowedWarner(message.author.id)) {
        return message.reply('❌ You are not allowed to use this command.');
    }

    if (!message.guild) {
        return message.reply('❌ This command can only be used inside a server.');
    }

    const targetUserId = extractUserId(args);
    if (!targetUserId) {
        return message.reply('Usage: `%removewarning @user`');
    }

    const member = await message.guild.members.fetch(targetUserId).catch(() => null);
    if (!member) {
        return message.reply('❌ Target user is not in this server.');
    }

    if (member.user?.bot) {
        return message.reply('❌ You cannot modify bot warnings.');
    }

    if (moderationService.isAdminMember(member)) {
        return message.reply('❌ Admins do not receive warnings.');
    }

    const result = await moderationService.removeWarning(targetUserId);
    if (!result.removed) {
        return message.reply(`ℹ️ <@${targetUserId}> has no warnings to remove.`);
    }

    return message.reply(`✅ Removed 1 warning from <@${targetUserId}>. Current warnings: **${result.warnings}/3**.`);
}

async function reblacklist(message, args) {
    if (!moderationService.isAllowedWarner(message.author.id)) {
        return message.reply('❌ You are not allowed to use this command.');
    }

    if (!message.guild) {
        return message.reply('❌ This command can only be used inside a server.');
    }

    const targetUserId = extractUserId(args);
    if (!targetUserId) {
        return message.reply('Usage: `%reblacklist @user`');
    }

    const result = await moderationService.removeBlacklistByUserId(targetUserId, message.guild);
    if (!result.ok) {
        return message.reply('❌ Could not process blacklist removal.');
    }

    if (!result.wasBlacklisted) {
        return message.reply(`ℹ️ <@${targetUserId}> is not currently blacklisted.`);
    }

    return message.reply(`✅ Removed blacklist from <@${targetUserId}>.`);
}

module.exports = {
    warn,
    removeWarning,
    reblacklist
};
