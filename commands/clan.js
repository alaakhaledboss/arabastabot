const clanService = require('../services/clanService');

module.exports = async function clan(message, args) {
    return clanService.handleClanCommand(message, args || []);
};