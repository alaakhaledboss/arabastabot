const payService = require('../services/payService');

async function pay(message, args, OWNER_ID) {
    const result = await payService.createPayRequest(message, args || [], OWNER_ID);
    if (!result.ok) {
        return message.reply(result.reply);
    }
    return null;
}

module.exports = {
    pay
};
