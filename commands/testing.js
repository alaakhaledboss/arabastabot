const db = require('../db');

async function setLevel(message, args) {
    // Expect: %setlevel @user <value>
    const mentionedMember = message.mentions?.members?.first();
    let targetId = mentionedMember ? mentionedMember.id : null;

    // If no mention, allow raw id in args[0]
    if (!targetId) {
        const possibleId = String(args?.[0] || '').replace(/[<@!>]/g, '').trim();
        if (possibleId && /^[0-9]{6,}$/.test(possibleId)) {
            targetId = possibleId;
        }
    }

    const rawLevel = String(args?.[1] || '').trim();
    const level = Number(rawLevel);

    if (!targetId || !rawLevel || !Number.isInteger(level) || level < 1) {
        return message.reply('Usage: `%setlevel @user <positive integer>`');
    }

    const user = await db.getUser(targetId);
    user.level = level;
    user.xp = 0;
    await db.saveUser(user);

    return message.reply(`✅ Level set to **${level}** and XP reset to **0** for <@${targetId}>.`);
}

module.exports = {
    setLevel
};