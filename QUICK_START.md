# 🚀 ArabastaBot - Quick Start Guide

## Installation & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Create .env File
```env
DISCORD_TOKEN=your_discord_bot_token
OWNER_ID=your_discord_user_id
```

### 3. Run the Bot
```bash
node main.js
```

### 4. Expected Output
```
✅ ArabastaBot#4566 is online!
```

---

## Commands Quick Reference

### Everyone Can Use
```
%ping          - Check if bot is responsive
%profile       - View your stats (or @user for others)
%leaderboard   - View top 10 players
%lb            - Shortcut for leaderboard
%shop          - Open shop menu
```

### Owner Only
```
%bank          - Access bank management
%a @user       - Grant user bank access
%da @user      - Revoke user bank access
%addproduct    - Add new shop products
```

---

## Features

### 💰 Bank System
- View balance
- Withdraw gold
- Deposit gold
- Manage authorized users

### 🛍️ Shop System
- Browse products
- Purchase items
- View inventory
- Check prices

### ⭐ Progression
- Earn 7.5 gold per minute
- Earn 15 XP per minute
- Level up automatically
- Daily gold cap: 350

### 🏆 Rankings
- Gold leaderboard
- XP leaderboard
- Gems leaderboard
- Honor leaderboard

### 👤 User Profiles
- View stats
- Check XP progress
- See level
- Display avatar

---

## Gold System

### Internal vs Display Gold
```
Internal Units = Display Gold × 10
Example: 750 internal units = 75 display gold
```

### Gold Earning
- Base reward: 75 internal units (7.5 display) per minute
- Daily cap: 3500 internal units (350 display)
- Cooldown: 60 seconds between rewards
- Resets every 24 hours

### Gold Usage
- Buy products from shop
- Deposit in bank
- Withdraw from bank

---

## Level System

### XP Requirements
```
XP per Level = 100 × Current Level
Level 1→2: 100 XP
Level 2→3: 200 XP
Level 3→4: 300 XP
etc.
```

### Level Progression
- Earn 15 XP per minute
- Levels increase automatically
- No message spam on level-up
- Progress visible in profile

---

## Permission System

### Bank Access
- Owner has automatic access
- Use `%a @user` to grant access
- Use `%da @user` to revoke access
- Database persists changes

### Command Permissions
- Owner-only commands are protected
- Permission errors are clear and helpful
- No silent failures

---

## Common Issues & Solutions

### "You don't have permission to access the bank"
**Solution:** Only owner or authorized users can use bank.
```
Ask the owner to run: %a @you
```

### "No products available"
**Solution:** Owner needs to add products first.
```
Owner runs: %addproduct
Then fills in product details
```

### "Insufficient gold to buy the product"
**Solution:** Earn more gold by sending messages.
```
Gold earning: 7.5 per minute
Daily cap: 350 gold
```

### Bot not responding
**Solution:** Check if bot is online.
```bash
node main.js
# Look for: ✅ ArabastaBot#4566 is online!
```

---

## File Structure

```
ArabastaBot/
├── main.js                          # Bot entry point
├── db.js                            # Database management
├── package.json                     # Dependencies
├── .env                             # Configuration (create this)
│
├── commands/
│   ├── commandHandler.js            # Command router
│   ├── bank.js                      # Bank command
│   ├── shop.js                      # Shop command
│   ├── product.js                   # Product management
│   ├── profile.js                   # User profile
│   ├── leaderboard.js               # Rankings
│   ├── permission.js                # Access control
│   └── misc.js                      # Utility commands
│
├── services/
│   ├── bankService.js               # Bank operations
│   ├── shopservice.js               # Shop operations
│   └── rewardService.js             # Reward system
│
├── interactions/
│   ├── buttons.js                   # Button handlers
│   └── modals.js                    # Modal handlers
│
└── data/
    ├── users.json                   # User data
    ├── bank.json                    # Bank data
    └── products.json                # Product data
```

---

## Database Structure

### users.json
```json
{
  "users": [
    {
      "user_id": "123456789",
      "gold": 1000,
      "xp": 250,
      "level": 5,
      "gems": 10,
      "honor": 0,
      "last_reward_time": 1709856000000,
      "daily_gold_earned": 350,
      "last_daily_reset": 1709856000000,
      "bank_access": true
    }
  ]
}
```

### bank.json
```json
{
  "balance": 1000000
}
```

### products.json
```json
[
  {
    "name": "Sword",
    "price": 1000,
    "description": "A sharp sword",
    "id": 1709856000000
  }
]
```

---

## Advanced Features

### Leaderboard Fields
```bash
%leaderboard xp        # XP rankings (includes level bonus)
%leaderboard gold      # Gold rankings
%leaderboard gems      # Gems rankings
%leaderboard honor     # Honor rankings
```

### Profile Lookup
```bash
%profile               # Your profile
%profile @user         # Someone else's profile
```

### User Mention Handling
```bash
%a @user               # Works with mentions
%da @user              # Works with mentions
%profile @user         # Works with mentions
```

---

## Troubleshooting

### Enable Debug Logging
Check console for detailed error messages:
```bash
# All errors are logged to console
# Look for patterns like:
# Command error: [error details]
# Database error: [error details]
# Interaction error: [error details]
```

### Data Corruption Recovery
- Automatic backup created as `.tmp` files
- Corrupted files are auto-recovered
- No data loss should occur

### Performance Tips
- Reward cooldown is 60 seconds (prevents spam)
- Daily cap prevents exploitation
- Levelup system is silent (no spam)

---

## Support Commands

### Get Help
```bash
%ping              # Test bot responsiveness
```

### View Your Stats
```bash
%profile           # View your detailed stats
%leaderboard       # See where you rank
```

### Check Shop
```bash
%shop              # Open shop menu
```

---

**Status:** ✅ All Systems Operational  
**Version:** 1.0.0  
**Last Updated:** 2026-03-23

For more information, see:
- COMPLETE_SUMMARY.md - Full change documentation
- QUALITY_CHECKLIST.md - Quality assurance checklist
- FIX_REPORT.md - Detailed fix report
