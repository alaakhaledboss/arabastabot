const { EMOJIS } = require('../utils/uiConstants');

module.exports = {
    ping: (message) => {
        try {
            return message.reply(`${EMOJIS.INFO} Pong!`);
        } catch (err) {
            console.error('ping error:', err);
            return message.reply(`${EMOJIS.ERROR} خطأ في تنفيذ الأمر. | Error executing ping.`).catch(() => {});
        }
    }
};