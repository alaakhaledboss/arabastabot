# 🎨 ArabastaBot UI Style Guide

## Color Palette

```
Primary:   #FFD700 (Gold)      ████████████ - Main brand color (shop, bank, profile)
Secondary: #00CED1 (Cyan)      ████████████ - Access roles, exchange menus
Success:   #2ECC71 (Green)     ████████████ - Purchases, successful operations
Error:     #E74C3C (Red)       ████████████ - Errors, warnings
Info:      #3498DB (Blue)      ████████████ - Information messages
Honor:     #8B0000 (Dark Red)  ████████████ - Honor-related embeds
```

## Emoji Dictionary

### Currency
```
💰  GOLD    - Gold coins (primary currency)
💎  GEMS    - Gems (rare currency)
⚔️  HONOR   - Honor (prestige currency)
💳  CREDIT  - Credit (ProBot currency)
```

### Shop & Roles
```
🛍️  SHOP      - Shop/shopping
🎒  BAG       - Inventory/bag
🎨  COLOR     - Role colors
🔑  ACCESS    - Role access/permissions
👑  ROLE      - Roles/ranks
🌟  VIP       - VIP status
```

### Bank Operations
```
🏦  BANK      - Bank
💸  WITHDRAW  - Withdrawing money
💰  DEPOSIT   - Depositing money
```

### Status & Indicators
```
✅  SUCCESS   - Success/completed
❌  ERROR     - Error/failed
⚠️  WARNING   - Warning/caution
ℹ️  INFO      - Information
```

### General
```
📊  LEVEL     - Level/experience level
✨  XP        - Experience points
🏆  TROPHY    - Leaderboard/ranking
💱  EXCHANGE  - Currency exchange
🔄  CONVERT   - Conversion/transfer
```

## Message Formats

### Error Messages
```
❌ ليس لديك إذن. | You don't have permission.
```

### Success Messages
```
✅ تم الشراء بنجاح! | Purchase successful!
```

### Warning Messages
```
⚠️ رصيدك غير كافٍ. | Insufficient funds.
```

### Field Names
```
💰 ذهب | Gold
💎 جواهر | Gems
⚔️ شرف | Honor
💳 رصيد | Credit
📊 المستوى | Level
✨ XP | Experience
```

## Embed Structure

### Basic Embed
```
Title:  [Emoji] **[Arabic] | [English]**
Color:  Use appropriate COLORS constant
Fields: 
  - Name: [Emoji] **[Arabic] | [English]**
    Value: **[amount]** [unit]
    Inline: true/false
Footer: "ArabastaBot | وزارة المالية • مملكة أراباستا"
Time:   Current timestamp
```

### Example: Purchase Success
```javascript
{
  color: COLORS.SUCCESS,
  title: '✅ **تم الشراء بنجاح! | Purchase Successful!**',
  fields: [
    { name: '🎨 اللون | Color', value: '<@&roleId> (Name)', inline: true },
    { name: '💰 السعر | Price', value: '**2,000** ذهب', inline: true },
    { name: '💰 رصيدك | Balance', value: '**8,000** ذهب', inline: true }
  ],
  footer: { text: 'ArabastaBot | وزارة المالية • مملكة أراباستا' },
  timestamp: new Date()
}
```

## Button Styles

### Primary
```
Style: PRIMARY
Uses: Main actions, main menu options
Color: Blue
Example: "🎒 حقيبتي | My Bag"
```

### Success
```
Style: SUCCESS
Uses: Positive actions, confirmations
Color: Green
Example: "🛍️ قائمة المتجر | Shop Menu"
```

### Secondary
```
Style: SECONDARY
Uses: Navigation, info, alternatives
Color: Gray
Example: "💱 تحويل عملات | Currency Exchange"
```

### Danger
```
Style: DANGER
Uses: Warnings, risky operations
Color: Red
Example: Not commonly used
```

## Field Formatting Examples

### Currency Fields
```javascript
createCurrencyField('💰 ذهب | Gold', 1000, 'ذهب', true)
// Output: { name: '💰 ذهب | Gold', value: '**1,000** ذهب', inline: true }
```

### Simple Fields
```javascript
{ 
  name: '🔑 الرتبة | Role', 
  value: '👑 **برجوازي**', 
  inline: true 
}
```

### Status Fields
```javascript
{ 
  name: '📅 استخدمت هذا الشهر', 
  value: '**5/10** جواهر', 
  inline: true 
}
```

## Typography Rules

### Bold Usage
```
**Important values**: **1,000** gold
**Section headers**: **معدلات التحويل | Exchange Rates:**
**Status indicators**: **لديك** (you have), **متبقٍ** (remaining)
```

### Bilingual Pattern
```
**[Arabic] | [English]**

Examples:
- ذهب | Gold
- جواهر | Gems
- شرف | Honor
- تحويل ناجح | Conversion Successful
```

### Number Formatting
```
toLocaleString()  // Converts 1000 to "1,000"
Used for all amounts over 100
```

---

## 🔧 When Adding New Features

1. **Color**: Use `COLORS.[TYPE]` from constants
2. **Emoji**: Use `EMOJIS.[NAME]` from constants
3. **Error Messages**: Use `formatError('Arabic', 'English')`
4. **Success Messages**: Use `formatSuccess('Arabic', 'English')`
5. **Currency Fields**: Use `createCurrencyField(label, amount, unit, inline)`
6. **Footer**: Always add `.setFooter({ text: FOOTER_TEXT }).setTimestamp()`
7. **Formatting**: Follow the bilingual `[Arabic] | [English]` pattern

---

## ✨ Quick Reference

### Most Used Colors
- **Shop/Bank**: `COLORS.SHOP` or `COLORS.BANK` → `#FFD700`
- **Roles**: `COLORS.ACCESS` → `#00CED1`
- **Success**: `COLORS.SUCCESS` → `#2ECC71`
- **Errors**: `COLORS.ERROR` → `#E74C3C`

### Most Used Emojis
- **Gold**: `EMOJIS.GOLD` → `💰`
- **Gems**: `EMOJIS.GEMS` → `💎`
- **Error**: `EMOJIS.ERROR` → `❌`
- **Success**: `EMOJIS.SUCCESS` → `✅`

### Most Used Messages
- **Permission Denied**: `formatError('ليس لديك إذن.', 'You don\'t have permission.')`
- **Insufficient Funds**: `formatError('رصيدك غير كافٍ.', 'Insufficient funds.')`
- **Something Wrong**: `formatError('حدث خطأ!', 'Something went wrong!')`

---

*Last Updated: March 28, 2026*
