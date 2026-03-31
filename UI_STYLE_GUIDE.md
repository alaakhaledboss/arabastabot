# 🎨 ArabastaBot UI Style Guide

## Quick Reference for Developers

### Color Scheme
```
COLORS.PRIMARY      = #FFD700  (Gold)        ← Default for shop, bank, profiles
COLORS.SECONDARY    = #00CED1  (Cyan)        ← Access roles, currency exchanges
COLORS.SUCCESS      = #2ECC71  (Green)       ← Successful operations
COLORS.ERROR        = #E74C3C  (Red)         ← Errors and warnings
COLORS.HONOR        = #8B0000  (Dark Red)    ← Honor-related content
```

### Button Styles
```
BUTTON_STYLES.PRIMARY   = Blue      ← Main interactive buttons
BUTTON_STYLES.SUCCESS   = Green     ← Purchase/confirmation buttons
BUTTON_STYLES.SECONDARY = Gray      ← Navigation/info buttons
BUTTON_STYLES.DANGER    = Red       ← Warning/dangerous buttons
```

### Essential Emojis
```
Status Icons:
  ✅  = Success          ❌  = Error         ⚠️  = Warning         ℹ️  = Info

Currency:
  💰  = Gold            💎  = Gems         ⚔️  = Honor           💳  = Credit

Shop/Roles:
  🛍️  = Shop            🎒  = Bag          🎨  = Color           🔑  = Access
  👑  = Role            ⭐  = VIP          🌹  = Rose/Velvet

Bank:
  🏦  = Bank            💸  = Withdraw     💰  = Deposit

General:
  📊  = Level           ✨  = XP           🏆  = Leaderboard      💱  = Exchange
```

---

## Embedding Standard Template

### Basic Embed with All Standards
```javascript
const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)                          // Use constants!
    .setTitle(`${EMOJIS.SUCCESS} **Title | العنوان**`)  // Emoji + Bold + Bilingual
    .setDescription('...')                             // Optional
    .addFields(
        createCurrencyField('Label', value, 'unit'),   // Use helper
        { name: '...', value: '...', inline: true }
    )
    .setFooter({ text: FOOTER_TEXT })                  // Always!
    .setTimestamp();                                   // Always!
```

### Error Message Format
```javascript
// WRONG ❌
return message.reply('Error. خطأ.');

// CORRECT ✅
return message.reply(formatError('خطأ', 'Error.'));

// Output: ❌ خطأ | Error.
```

### Success Message Format
```javascript
// WRONG ❌
return message.reply('✅ Done!');

// CORRECT ✅
return message.reply(formatSuccess('تم بنجاح', 'Done successfully!'));

// Output: ✅ تم بنجاح | Done successfully!
```

### Button Template
```javascript
new ButtonBuilder()
    .setCustomId('...')
    .setLabel(`${EMOJIS.SHOP} اختر | Choose`)    // Emoji + Bilingual
    .setStyle(BUTTON_STYLES.PRIMARY)             // Use constants!
```

---

## Common Patterns

### Currency Field
```javascript
createCurrencyField(`${EMOJIS.GOLD} ذهب | Gold`, 5000, '', true)
// Creates: { name: '💰 ذهب | Gold', value: '**5,000**', inline: true }
```

### Purchase Success
```javascript
const embed = new EmbedBuilder()
    .setColor(COLORS.SUCCESS)
    .setTitle(`${EMOJIS.SUCCESS} **تم الشراء | Purchase Successful**`)
    .addFields(...)
    .setFooter({ text: FOOTER_TEXT })
    .setTimestamp();
```

### Permission Denied
```javascript
return interaction.reply({
    content: formatError('ليس لديك صلاحية.', 'You don\'t have permission.'),
    ephemeral: true
});
```

### Insufficient Resources
```javascript
const missing = ['1000 💰 ذهب', '50 💎 جواهر'];
return interaction.editReply({
    content: formatError('رصيدك غير كافٍ.', 'Insufficient resources.') + 
             `\nتحتاج: ${missing.join(' + ')}`
});
```

---

## File Imports

### In any command or service file:
```javascript
const { 
    COLORS,
    BUTTON_STYLES,
    EMOJIS,
    FOOTER_TEXT,
    formatError,
    formatSuccess,
    createCurrencyField,
    createBaseEmbed
} = require('../utils/uiConstants');
```

---

## Do's and Don'ts

### ✅ DO
- Use emoji prefixes in all button labels
- Always add footer + timestamp to embeds
- Use `formatError()` for all error messages
- Use currency field helper for money displays
- Use COLORS constants instead of hex codes
- Use BUTTON_STYLES instead of ButtonStyle enum
- Use EMOJIS constants instead of hardcoding
- Keep messages bilingual (Arabic | English)

### ❌ DON'T
- Hardcode colors like '#FFD700'
- Mix emoji styles between buttons
- Create embeds without footers
- Write error messages like "Error: ..."
- Use ButtonStyle.Primary (use BUTTON_STYLES.PRIMARY)
- Have English-only or Arabic-only messages
- Use different emojis for the same concept
- Forget to add timestamp to embeds

---

## Maintenance

### Adding a New Emoji
Edit `utils/uiConstants.js`:
```javascript
const EMOJIS = {
    // ... existing
    NEW_EMOJI: '🆕',  // Add here
};
```

### Adding a New Color
Edit `utils/uiConstants.js`:
```javascript
const COLORS = {
    // ... existing
    NEW_COLOR: '#XXXXXX',  // Add here
};
```

### Adding a New Helper Function
Edit `utils/uiConstants.js` and add to exports:
```javascript
function myNewHelper(param1, param2) {
    // implementation
}

module.exports = {
    // ... existing exports
    myNewHelper
};
```

---

## Examples by Feature

### Bank Feature
```
Color: COLORS.BANK (#FFD700 - gold)
Buttons: WITHDRAW (primary), DEPOSIT (success), BALANCE (secondary)
Emojis: 🏦 (header), 💰 (gold), 💳 (credit)
```

### Shop Feature
```
Color: COLORS.SHOP (#FFD700 - gold)
Buttons: SHOP (primary), BAG (primary), EXCHANGE (secondary)
Emojis: 🛍️ (shop), 🎒 (bag), 🎨 (color), 🔑 (access)
```

### Access Roles
```
Color: COLORS.ACCESS (#00CED1 - cyan)
Buttons: Standard options
Emojis: 👑 (role), ⭐ (vip), 🌹 (velvet)
```

### Currency Exchange
```
Color: COLORS.ACCESS (#00CED1 - cyan)
Buttons: CONVERT_GEMS (primary), CONVERT_HONOR (success)
Emojis: 💱 (exchange), 💰→💎, 💎→⚔️
```

---

## Troubleshooting

**Q: Embed has no footer?**
A: Add `.setFooter({ text: FOOTER_TEXT })` before `.setTimestamp()`

**Q: Emoji not showing in button?**
A: Make sure it's in backticks or use EMOJIS constant, e.g., `.setLabel(\`\${EMOJIS.GOLD} Label\`)`

**Q: Color doesn't match?**
A: Use COLORS constant instead of hex. Check that the correct feature color is used.

**Q: Error message format wrong?**
A: Use `formatError(arabicText, englishText)` instead of manual formatting.

**Q: Button style mismatched?**
A: Use BUTTON_STYLES instead of ButtonStyle. PRIMARY for actions, SUCCESS for purchases, SECONDARY for navigation.

---

**Last Updated**: March 28, 2026  
**Version**: 1.0  
**Status**: ✅ Complete
