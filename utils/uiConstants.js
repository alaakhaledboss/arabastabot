/**
 * uiConstants.js
 * Centralized UI styling constants for ArabastaBot
 * 
 * This file ensures visual consistency across all bot commands,
 * embeds, buttons, and interactive components.
 */

const { ButtonStyle } = require('discord.js');

// ════════════════════════════════════════════════════════════════
//  COLORS (Hex Codes)
// ════════════════════════════════════════════════════════════════

const COLORS = {
    // Unified embed border color (yellow -> slight orange)
    PRIMARY:      '#FFB84D',   // warm yellow-orange
    SECONDARY:    '#FFB84D',
    SUCCESS:      '#FFB84D',
    ERROR:        '#FFB84D',
    INFO:         '#FFB84D',
    SHOP:         '#FFB84D',
    BANK:         '#FFB84D',
    PROFILE:      '#FFB84D',
    ACCESS:       '#FFB84D',
    HONOR:        '#FFB84D'
};

// ════════════════════════════════════════════════════════════════
//  BUTTON STYLES
// ════════════════════════════════════════════════════════════════

const BUTTON_STYLES = {
    PRIMARY:      ButtonStyle.Primary,      // Main actions
    SUCCESS:      ButtonStyle.Success,      // Purchase/positive actions
    SECONDARY:    ButtonStyle.Secondary,    // Navigation/info
    DANGER:       ButtonStyle.Danger        // Warnings/dangerous actions
};

// ════════════════════════════════════════════════════════════════
//  EMOJIS
// ════════════════════════════════════════════════════════════════

const EMOJIS = {
    // Status
    SUCCESS:      '✅',
    ERROR:        '❌',
    WARNING:      '⚠️',
    INFO:         'ℹ️',
    
    // Currency
    GOLD:         '💰',
    GEMS:         '💎',
    HONOR:        '⚔️',
    CREDIT:       '💳',
    
    // Shop/Roles
    SHOP:         '🛍️',
    BAG:          '🎒',
    COLOR:        '🎨',
    ACCESS:       '🔑',
    ROLE:         '👑',
    VIP:          '⭐',
    
    // Bank
    BANK:         '🏦',
    WITHDRAW:     '💸',
    DEPOSIT:      '💰',
    
    // General
    LEVEL:        '📊',
    XP:           '✨',
    PROFILE:      '👤',
    LEADERBOARD:  '🏆',
    TROPHY:       '🏆',
    
    // Exchange
    EXCHANGE:     '💱',
    CONVERT:      '🔄',
    TRANSFER:     '↔️'
};

// ════════════════════════════════════════════════════════════════
//  FOOTER TEXT
// ════════════════════════════════════════════════════════════════

const FOOTER_TEXT = 'ArabastaBot | وزارة المالية • مملكة أراباستا';
const FOOTER_TEXT_SHORT = 'ArabastaBot • Arabasta';

// ════════════════════════════════════════════════════════════════
//  MESSAGE FORMATS
// ════════════════════════════════════════════════════════════════

/**
 * Format an error message with consistent styling
 * @param {string} arabicText - Arabic error message
 * @param {string} englishText - English error message (optional)
 * @returns {string} Formatted error message
 */
function formatError(arabicText, englishText = '') {
    const base = `${EMOJIS.ERROR} ${arabicText}`;
    return englishText ? `${base} | ${englishText}` : base;
}

/**
 * Format a success message with consistent styling
 * @param {string} arabicText - Arabic success message
 * @param {string} englishText - English success message (optional)
 * @returns {string} Formatted success message
 */
function formatSuccess(arabicText, englishText = '') {
    const base = `${EMOJIS.SUCCESS} ${arabicText}`;
    return englishText ? `${base} | ${englishText}` : base;
}

/**
 * Format a warning message with consistent styling
 * @param {string} arabicText - Arabic warning message
 * @param {string} englishText - English warning message (optional)
 * @returns {string} Formatted warning message
 */
function formatWarning(arabicText, englishText = '') {
    const base = `${EMOJIS.WARNING} ${arabicText}`;
    return englishText ? `${base} | ${englishText}` : base;
}

/**
 * Create a formatted currency field for embeds
 * @param {string} label - Field label with emoji
 * @param {number|string} amount - Currency amount
 * @param {string} currency - Currency type (e.g., 'ذهب', 'جواهر', 'شرف')
 * @param {boolean} inline - Whether field should be inline
 * @returns {object} Embed field object
 */
function createCurrencyField(label, amount, currency = '', inline = true) {
    const formattedAmount = typeof amount === 'number' ? amount.toLocaleString() : amount;
    const value = currency ? `**${formattedAmount}** ${currency}` : `**${formattedAmount}**`;
    return { name: label, value, inline };
}

/**
 * Get consistent embed object with footer
 * @param {string} title - Embed title
 * @param {string} color - Embed color (use COLORS constant)
 * @param {string} description - Embed description (optional)
 * @returns {object} Partial embed configuration
 */
function createBaseEmbed(title, color, description = '') {
    return {
        color,
        title,
        ...(description && { description }),
        footer: { text: FOOTER_TEXT },
        timestamp: new Date()
    };
}

// ════════════════════════════════════════════════════════════════
//  ERROR MESSAGES
// ════════════════════════════════════════════════════════════════

const ERROR_MESSAGES = {
    PERMISSION_DENIED: {
        ar: 'ليس لديك إذن للوصول إلى هذا.',
        en: 'You don\'t have permission to access this.'
    },
    INSUFFICIENT_FUNDS: {
        ar: 'رصيدك غير كافٍ.',
        en: 'Insufficient funds.'
    },
    INVALID_INPUT: {
        ar: 'أدخل قيمة صحيحة.',
        en: 'Enter a valid value.'
    },
    SOMETHING_WENT_WRONG: {
        ar: 'حدث خطأ ما!',
        en: 'Something went wrong!'
    },
    BANK_BROKE: {
        ar: 'البنك مفلس 💀',
        en: 'Bank is broke 💀'
    },
    USER_BROKE: {
        ar: 'أنت مفلس 💀',
        en: 'You are broke 💀'
    }
};

// ════════════════════════════════════════════════════════════════
//  SUCCESS MESSAGES
// ════════════════════════════════════════════════════════════════

const SUCCESS_MESSAGES = {
    PURCHASE_SUCCESSFUL: {
        ar: 'تم الشراء بنجاح!',
        en: 'Purchase Successful!'
    },
    WITHDRAWAL_SUCCESSFUL: {
        ar: 'سحب ناجح',
        en: 'Withdrawal Successful'
    },
    DEPOSIT_SUCCESSFUL: {
        ar: 'إيداع ناجح',
        en: 'Deposit Successful'
    },
    CONVERSION_SUCCESSFUL: {
        ar: 'تحويل ناجح',
        en: 'Conversion Successful'
    },
    PERMISSION_GRANTED: {
        ar: 'تم منح الصلاحية.',
        en: 'Permission granted.'
    },
    PERMISSION_REMOVED: {
        ar: 'تم إزالة الصلاحية.',
        en: 'Permission removed.'
    }
};

// ════════════════════════════════════════════════════════════════
//  EXPORTS
// ════════════════════════════════════════════════════════════════

module.exports = {
    COLORS,
    BUTTON_STYLES,
    EMOJIS,
    FOOTER_TEXT,
    FOOTER_TEXT_SHORT,
    ERROR_MESSAGES,
    SUCCESS_MESSAGES,
    formatError,
    formatSuccess,
    formatWarning,
    createCurrencyField,
    createBaseEmbed
};
