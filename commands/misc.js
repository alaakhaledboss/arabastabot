module.exports = {
    ping: (message) => {
        try {
            return message.reply('🏓 Pong!');
        } catch (err) {
            console.error('ping error:', err);
            return message.reply('❌ Error executing ping. خطأ في تنفيذ الأمر.').catch(() => {});
        }
    }
};