const huntingService = require('../services/huntingService');

module.exports = async function hunt(message, args) {
    return huntingService.handleHuntCommand(message, args || []);
};