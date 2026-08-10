const craftService = require('../services/craftService');

module.exports = async function craftCommand(message) {
    return craftService.handleCraftCommand(message);
};