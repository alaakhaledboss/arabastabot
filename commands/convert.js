/**
 * %convert — Fix messages typed on the wrong keyboard layout (English ↔ Arabic)
 * Usage: %convert          → converts the sender's most recent message
 *        %convert @user    → converts the mentioned user's most recent message
 *        Reply to a message with %convert → converts that specific message
 */

// ════════════════════════════════════════════════════════════════
//  KEYBOARD MAPS
// ════════════════════════════════════════════════════════════════

const EN_TO_AR = {
    'q': 'ض', 'w': 'ص', 'e': 'ث', 'r': 'ق', 't': 'ف', 'y': 'غ', 'u': 'ع',
    'i': 'ه', 'o': 'خ', 'p': 'ح', '[': 'ج', ']': 'د',
    'a': 'ش', 's': 'س', 'd': 'ي', 'f': 'ب', 'g': 'ل', 'h': 'ا', 'j': 'ت',
    'k': 'ن', 'l': 'م', ';': 'ك', "'": 'ط',
    'z': 'ئ', 'x': 'ء', 'c': 'ؤ', 'v': 'ر', 'b': 'لا', 'n': 'ى', 'm': 'ة',
    ',': 'و', '.': 'ز', '/': 'ظ',
    '`': 'ذ',
    '1': '١', '2': '٢', '3': '٣', '4': '٤', '5': '٥',
    '6': '٦', '7': '٧', '8': '٨', '9': '٩', '0': '٠',
    // Shift variants
    'Q': 'َ', 'W': 'ً', 'E': 'ُ', 'R': 'ٌ', 'T': 'لإ', 'Y': 'إ', 'U': '`',
    'I': '÷', 'O': '×', 'P': '؛', '{': '<', '}': '>',
    'A': 'ِ', 'S': 'ٍ', 'D': ']', 'F': '[', 'G': 'لأ', 'H': 'أ', 'J': 'ـ',
    'K': '،', 'L': '/', ':': ':',
    'Z': '~', 'X': 'ْ', 'C': '}', 'V': '{', 'B': 'لآ', 'N': 'آ', 'M': "'",
    '<': ',', '>': '.', '?': '؟',
};

// Build reverse map (Arabic → English) — single-char Arabic only.
// 'لا' (from 'b') is handled specially in arabicToEnglish.
const AR_TO_EN = {};
for (const [en, ar] of Object.entries(EN_TO_AR)) {
    if (ar.length === 1) AR_TO_EN[ar] = en;
}

// ════════════════════════════════════════════════════════════════
//  GH DETECTION — resolves لا → "gh" vs "b"
// ════════════════════════════════════════════════════════════════

/**
 * Known English words that contain "gh".
 * No duplicates, no suffix/prefix variants.
 */
const GH_WORDS = [
    'eight',
    'light', 'night', 'right', 'fight', 'might', 'tight', 'sight', 'bright',
    'high', 'sigh',
    'through', 'though', 'thought',
    'rough', 'tough', 'enough',
    'laugh', 'cough',
    'weight', 'height',
    'daughter', 'brought', 'bought', 'caught',
    'straight', 'neighbor', 'weigh'
];

/**
 * Build the Arabic keyboard-layout pattern for a word, and record
 * EXACTLY which positions within that pattern come from a 'g'+'h' pair.
 *
 * When 'g' is followed by 'h' in the English word, those two keys map to
 * ل + ا respectively (same characters as 'لا' from 'b'), but come from
 * TWO separate keypresses. We mark those positions so we can later
 * distinguish them from a real 'b' → 'لا'.
 */
function buildGhPattern(word) {
    let arabicPattern = '';
    const ghPositions = new Set();

    for (let i = 0; i < word.length; i++) {
        const ch = word[i];
        if (ch === 'g' && i + 1 < word.length && word[i + 1] === 'h') {
            // 'g' → ل  and  'h' → ا, consumed as a pair
            ghPositions.add(arabicPattern.length);      // index of ل
            ghPositions.add(arabicPattern.length + 1);  // index of ا
            arabicPattern += 'ل';
            arabicPattern += 'ا';
            i++; // skip 'h'
        } else {
            arabicPattern += EN_TO_AR[ch] ?? ch;
        }
    }

    return { arabicPattern, ghPositions };
}

// Precompute all patterns, sorted longest-first (priority rule)
const GH_PATTERNS = GH_WORDS
    .map(buildGhPattern)
    .sort((a, b) => b.arabicPattern.length - a.arabicPattern.length);

/**
 * Scan the Arabic text for all known gh-word patterns.
 * Returns a Set of character indices in the text that should
 * be treated as 'gh' when converting لا back to English.
 */
function findGhPositions(arabicText) {
    const ghTextPositions = new Set();

    for (const { arabicPattern, ghPositions } of GH_PATTERNS) {
        let searchStart = 0;
        while (true) {
            const idx = arabicText.indexOf(arabicPattern, searchStart);
            if (idx === -1) break;
            // Map each gh-specific position in the pattern to its absolute text index
            for (const pos of ghPositions) {
                ghTextPositions.add(idx + pos);
            }
            searchStart = idx + 1; // allow overlapping matches
        }
    }

    return ghTextPositions;
}

// ════════════════════════════════════════════════════════════════
//  CONVERTERS
// ════════════════════════════════════════════════════════════════

function englishToArabic(text) {
    let result = '';
    for (const ch of text) result += EN_TO_AR[ch] ?? ch;
    return result;
}

/**
 * Convert Arabic-layout text to English.
 * لا is resolved to:
 *   "gh"  — if its two positions are flagged by findGhPositions()
 *   "b"   — default (all other occurrences)
 */
function arabicToEnglish(text) {
    const ghPos = findGhPositions(text);
    let result = '';
    let i = 0;

    while (i < text.length) {
        // Detect two-character sequence ل + ا
        if (i + 1 < text.length && text[i] === 'ل' && text[i + 1] === 'ا') {
            if (ghPos.has(i) && ghPos.has(i + 1)) {
                result += 'gh'; // came from g+h keypresses
            } else {
                result += 'b';  // came from a single b keypress (default)
            }
            i += 2;
        } else {
            result += AR_TO_EN[text[i]] ?? text[i];
            i++;
        }
    }

    return result;
}

// ════════════════════════════════════════════════════════════════
//  LANGUAGE DETECTION
// ════════════════════════════════════════════════════════════════

function detectLanguage(text) {
    let arabicCount = 0, latinCount = 0;
    for (const ch of text) {
        if (/[\u0600-\u06FF]/.test(ch)) arabicCount++;
        else if (/[a-zA-Z]/.test(ch)) latinCount++;
    }
    return arabicCount >= latinCount ? 'arabic' : 'english';
}

function convertText(text) {
    const lang = detectLanguage(text);
    if (lang === 'english') {
        return { converted: englishToArabic(text), direction: 'English → Arabic' };
    } else {
        return { converted: arabicToEnglish(text), direction: 'Arabic → English' };
    }
}

// ════════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════════

function isSticker(msg) {
    return msg.stickers && msg.stickers.size > 0;
}

function hasConvertibleText(msg) {
    return msg.content && msg.content.trim().length > 0;
}

// ════════════════════════════════════════════════════════════════
//  COMMAND HANDLER
// ════════════════════════════════════════════════════════════════

module.exports = async function handleConvert(message, args) {
    try {
        const { EmbedBuilder } = require('discord.js');
        const channel = message.channel;

        let targetMsg  = null;
        let targetUser = null;

        // Priority 1: command sent as a reply
        if (message.reference && message.reference.messageId) {
            try {
                const referenced = await channel.messages.fetch(message.reference.messageId);
                if (isSticker(referenced)) return message.reply('❌ That message is a sticker — nothing to convert.');
                if (!hasConvertibleText(referenced)) return message.reply('❌ That message has no text to convert.');
                targetMsg  = referenced;
                targetUser = referenced.author;
            } catch {
                return message.reply('❌ Couldn\'t fetch the replied-to message.');
            }

        // Priority 2: scan history for target user's last message
        } else {
            const mentionedUser = message.mentions.users.first();
            targetUser = mentionedUser || message.author;

            const fetched = await channel.messages.fetch({ limit: 50 });
            const candidates = fetched
                .filter(m => m.author.id === targetUser.id && m.id !== message.id && !isSticker(m) && hasConvertibleText(m))
                .sort((a, b) => b.createdTimestamp - a.createdTimestamp);

            if (candidates.size === 0) {
                const isSelf = targetUser.id === message.author.id;
                return message.reply(`❌ Couldn't find a recent text message from ${isSelf ? 'you' : targetUser.username}.`);
            }

            targetMsg = candidates.first();
        }

        const originalText = targetMsg.content;
        const { converted, direction } = convertText(originalText);
        const isSelf = targetUser.id === message.author.id;

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('⌨️ **Keyboard Layout Converter | محوّل لوحة المفاتيح**')
            .addFields(
                {
                    name: `📥 Original | النص الأصلي (${isSelf ? 'You | أنت' : targetUser.username})`,
                    value: `\`\`\`${originalText.slice(0, 1000)}\`\`\``,
                    inline: false
                },
                {
                    name: `📤 Converted | النص المحوّل  •  ${direction}`,
                    value: `\`\`\`${converted.slice(0, 1000)}\`\`\``,
                    inline: false
                }
            )
            .setFooter({ text: 'Conversion is positional (keyboard mapping), not translation. | تحويل موضعي وليس ترجمة.' })
            .setTimestamp();

        return message.reply({ embeds: [embed] });

    } catch (err) {
        console.error('convert command error:', err);
        return message.reply('❌ Error running the convert command. | خطأ في تنفيذ أمر التحويل.').catch(() => {});
    }
};
