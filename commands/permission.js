const db = require('../db');
const { formatError, formatSuccess } = require('../utils/uiConstants');

async function handlePermission(message, cmd, args, OWNER_ID) {
    if (message.author.id !== OWNER_ID) {
        return message.reply(formatError('Only the owner can manage permissions.', 'فقط المالك يستطيع إدارة الصلاحيات.'));
    }

    // `%a` without a mention: list current authorized users
    if (cmd === 'a' && (!args?.[0] || !String(args[0]).trim())) {
        const authorized = Array.from(await db.getAuthorizedUsers());
        if (!authorized.length) {
            return message.reply(formatError('There are currently no authorized users.', 'لا يوجد أي مستخدمين لديهم صلاحية حالياً.'));
        }

        const mentions = authorized.map((id) => `<@${id}>`).join(', ');
        return message.reply(formatSuccess(`Users with access:\n${mentions}`, `المستخدمون المصرح لهم حالياً:\n${mentions}`));
    }

    const userId = args[0]?.replace(/<@!?|>/g, '');
    if (!userId || !/^\d+$/.test(userId)) {
        return message.reply(formatError('Please mention a valid user.', 'يرجى منشن مستخدم صحيح.'));
    }

    if (cmd === 'a') {
        await db.setBankAccess(userId, true);
        return message.reply(formatSuccess(`<@${userId}> has been granted special authorization.`, `تم منح الصلاحية الخاصة للمستخدم <@${userId}>.`));
    }

    if (cmd === 'da') {
        await db.setBankAccess(userId, false);
        return message.reply(formatSuccess(`Special authorization for <@${userId}> has been removed.`, `تم إزالة الصلاحية الخاصة من <@${userId}>.`));
    }
}

module.exports = { handlePermission };