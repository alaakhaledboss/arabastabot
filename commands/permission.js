const db = require('../db');

async function handlePermission(message, cmd, args, OWNER_ID) {
    if (message.author.id !== OWNER_ID) {
        return message.reply('Only the owner can manage permissions. فقط المالك يستطيع إدارة الصلاحيات.');
    }

    const userId = args[0]?.replace(/<@!?|>/g, '');
    if (!userId || !/^\d+$/.test(userId)) {
        return message.reply('Please mention a valid user. يرجى منشن مستخدم صحيح.');
    }

    if (cmd === 'a') {
        await db.setBankAccess(userId, true);
        return message.reply(`✅ <@${userId}> has been granted bank access. تم منح الصلاحية.`);
    }

    if (cmd === 'da') {
        await db.setBankAccess(userId, false);
        return message.reply(`❌ <@${userId}> bank access has been removed. تم إزالة الصلاحية.`);
    }
}

module.exports = { handlePermission };