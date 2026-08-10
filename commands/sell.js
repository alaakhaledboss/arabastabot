const sellService = require('../services/sellService');

module.exports = async function sellCommand(message, args) {
    return sellService.handleSellCommand(message, args);
};