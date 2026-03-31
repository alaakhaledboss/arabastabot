# 🏦 Bank Credit System Configuration

## Overview
The bank credit system allows ProBot currency (credit) to be managed by the bot owner while maintaining separation from regular user gold/gems/honor transactions.

---

## 📊 Bank Initial Configuration

### Current Bank Status
```json
{
  "balance": 10000000,    // 1,000,000 display gold (internal units × 10)
  "gems": 10000,          // 10,000 gems
  "honor": 1000,          // 1,000 honor
  "credit": 0             // 0 ProBot credit (can be received from other users)
}
```

### Key Points
- **1,000,000 gold** (10,000,000 internal units) - Initial bank gold balance
- **10,000 gems** - Initial bank gem balance
- **1,000 honor** - Initial bank honor balance
- **0 credit** - Initial ProBot credit balance (will accumulate over time)

---

## 💳 Credit Handling

### Receiving Credit (Owner Only)
Users cannot directly transfer credit to the bot through the bot. Instead:

1. **External Transfer**: Owner receives credit from another user outside Discord (via ProBot)
2. **Manual Update**: Use command: `%axp @user 1000000` (or use the receiveCredit function)
   - This command adds ProBot credit directly to bank

### Credit Usage: Gold → Credit Conversion
When a user converts gold to credit:

**Process:**
```
User: 1,000 gold → 100,000 credit
Bank: Loses 100,000 credit, gains 1,000 gold

Check: bank.credit >= creditAmount (must have enough credit)
```

**Formula:**
- 1 gold = 100 credit (conversion ratio)
- Minimum: 1,000 gold = 100,000 credit

**Example Transaction:**
```
User wants: 5,000 gold
Required credit: 5,000 × 100 = 500,000 credit
Bank check: credit >= 500,000 ✓
Result: user.credit += 500,000, bank.credit -= 500,000
```

---

## 🔐 Access Control

### Bank Access Levels

| User Type | Can See Credit | Can View Bank | Can Deposit/Withdraw |
|-----------|---|---|---|
| Regular User | ❌ No | ❌ No | ❌ No |
| Authorized User (`%a @user`) | ✅ Yes | ✅ Yes | ✅ Yes |
| Owner | ✅ Yes | ✅ Yes | ✅ Yes |

### Granting Access
```
%a @user                    // Grant bank access to user
%da @user                   // Revoke bank access from user
```

### Viewing Bank Balance
```
%bank or %b                 // View bank balance (restricted access)
```

**For Owner/Authorized Users:**
```
💰 Bank Balance
├─ 💛 Gold: 1,000,000
├─ 💎 Gems: 10,000
├─ ⚔️  Honor: 1,000
└─ 💳 Credit: [hidden from unauthorized users]
```

---

## 📋 Functions Reference

### bankService.js

#### `showBalance(interaction, OWNER_ID)`
Displays bank balance with conditional credit visibility
- **Owner/Authorized**: Sees credit field
- **Others**: Credit field hidden

#### `handleModal(interaction, action, userId, OWNER_ID)`
- **Parameters**: action = 'deposit' or 'withdraw', userId, OWNER_ID
- **Restrictions**: Only owner + authorized users can perform actions
- **Operations**: Deposit user gold → bank, Withdraw bank gold → user

#### `receiveCredit(creditAmount, sourceUserId)`
Adds credit to bank from external source
- **Returns**: true on success, false on error
- **Logs**: Bank action with credit received details

#### `showCreditDetails(interaction, OWNER_ID)`
Displays detailed credit information (owner only)
- Shows total credit balance
- Shows convertible credit (credit ÷ 100 = gold equivalent)
- Shows minimum conversion threshold

### shopService.js

#### `processGoldCredit(interaction, userId)` [UPDATED]
Updated to deduct from `bank.credit` instead of adding to `bank.balance`

**New Logic:**
```javascript
// Check: User has enough gold
if (user.gold < goldInternal) → Error

// Check: Bank has enough credit
if (bank.credit < creditAmount) → Error

// Execute:
user.gold -= goldInternal
user.credit += creditAmount
bank.credit -= creditAmount
```

**Minimum:** 1,000 gold = 100,000 credit

---

## 🔄 Transaction Flow

### Gold → Credit Conversion Flow
```
User: %shop → 💱 Currency Exchange → Enter amount

↓

[Validation]
├─ Amount >= 1,000 gold ✓
├─ user.gold sufficient ✓
└─ bank.credit sufficient ✓

↓

[Execution]
├─ user.gold -= amount (user loses gold)
├─ user.credit += (amount × 100) (user gains credit)
├─ bank.credit -= (amount × 100) (bank loses credit)
└─ Log transaction

↓

[Success]
Display: Gold Used, Credit Added, Gold Left, Total Credit
```

---

## 📝 Database Structure

### bank.json
```json
{
  "balance": 10000000,
  "gems": 10000,
  "honor": 1000,
  "credit": 0
}
```

### user record (credit field)
```json
{
  "user_id": "123456789",
  "gold": 50000,
  "credit": 250000,
  "gems": 5000,
  "honor": 500,
  "bank_access": false
}
```

---

## 🎯 Use Cases

### Scenario 1: Owner Receives ProBot Credit
1. External user sends ProBot credit to bot owner
2. Owner notes amount received
3. Owner uses code/command to add credit to bank
4. Bank credit increases
5. Regular users can now convert gold → credit from this pool

### Scenario 2: User Converts Gold to Credit
1. User has 5,000 gold
2. Uses `%shop` → Currency Exchange → Converts 5,000 gold
3. System checks: bank has 500,000 credit available ✓
4. Transaction completes:
   - User: -5,000 gold, +500,000 credit
   - Bank: -500,000 credit
5. User can now use 500,000 credit in ProBot

### Scenario 3: Bank Runs Low on Credit
1. Bank credit drops to 50,000
2. User tries to convert 1,000 gold (needs 100,000 credit)
3. Error: "Bank credit insufficient for conversion"
4. Owner must receive more credit before conversions can continue

---

## ⚠️ Important Notes

### Credit vs Gold
- **Gold**: User-owned in-game currency, can deposit/withdraw from bank
- **Credit**: ProBot external currency, only owner can manage flow
- **Conversion**: Gold → Credit (one-way using conversion process)

### Restrictions
- ✅ Owner can see all credit details
- ✅ Authorized users can see credit in bank balance
- ❌ Regular users cannot see credit amount
- ❌ Regular users cannot deposit/withdraw without authorization
- ❌ Regular users cannot directly modify credit (only through gold conversion)

### Monitoring
- All transactions logged in bank log (`%showbanklog`)
- Actions tracked with: user, action type, amount, timestamp
- Credit transactions show: amount, source/destination

---

## 🚀 Future Enhancements

Potential features:
- Credit → Gold conversion (reverse flow)
- Daily credit interest
- Credit marketplace
- Credit tiered rewards

---

## 📞 Support

For issues or questions about the bank credit system:
1. Check bank log: `%showbanklog`
2. Verify user permissions: `%a @user` status
3. View current bank balance: `%bank` (authorized users only)
