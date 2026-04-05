const progressionService = require('../services/progressionService');

async function specialty(message, args) {
    return progressionService.sendSpecialtySelectionEmbed(message, args || []);
}

async function prestige(message, args) {
    return progressionService.sendPrestigeSelectionEmbed(message, args || []);
}

async function rebirth(message, args) {
    return progressionService.sendRebirthSelectionEmbed(message, args || []);
}

module.exports = {
    specialty,
    prestige,
    rebirth
};