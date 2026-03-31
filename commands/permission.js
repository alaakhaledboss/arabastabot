const db = require('../db');
const { formatError, formatSuccess } = require('../utils/uiConstants');

async function handlePermission(message, cmd, args, OWNER_ID) {
    if (message.author.id !== OWNER_ID) {
        return message.reply(formatError('فقط المالك يستطيع إدارة الصلاحيات.', 'Only the owner can manage permissions.'));
    }

    const userId = args[0]?.replace(/<@!?|>/g, '');
    if (!userId || !/^\d+$/.test(userId)) {
        return message.reply(formatError('يرجى منشن مستخدم صحيح.', 'Please mention a valid user.'));
    }

    if (cmd === 'a') {
        await db.setBankAccess(userId, true);
        return message.reply(formatSuccess(`تم منح <@${userId}> صلاحية البنك.`, `<@${userId}> has been granted bank access.`));
    }

    if (cmd === 'da') {
        await db.setBankAccess(userId, false);
        return message.reply(formatSuccess(`تم إزالة صلاحية البنك من <@${userId}>.`, `<@${userId}> bank access has been removed.`));
    }
}

module.exports = { handlePermission };