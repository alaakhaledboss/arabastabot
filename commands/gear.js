const gearService = require('../services/gearService');

module.exports = async function gear(message, args) {
    return gearService.handleGearCommand(message, args || []);
};