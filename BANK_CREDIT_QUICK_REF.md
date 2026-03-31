# 💳 Bank Credit System - Quick Reference

## ⚡ At a Glance

| Aspect | Details |
|--------|---------|
| **Bank Balance** | 1,000,000 gold, 10,000 gems, 1,000 honor |
| **Initial Credit** | 0 (received externally) |
| **Conversion Rate** | 1 gold = 100 credit |
| **Minimum Conversion** | 1,000 gold |
| **Who Can Access** | Owner + Users with `%a` permission |
| **Who Sees Credit** | Only owner & authorized users |

---

## 🎮 User Commands

### View Bank Balance
```
%bank or %b
```
Shows current bank balance (restricted to owner + authorized users)

### Convert Gold to Credit
```
%shop → 💱 Currency Exchange → Enter amount (in gold)
```
**Converts user's gold to ProBot credit**
- Minimum: 1,000 gold
- Each 1,000 gold = 100,000 credit
- Deducts credit from bank pool

---

## 👑 Owner Commands

### Grant Bank Access
```
%a @user
```
Allows user to see bank balance and credit amount

### Revoke Bank Access
```
%da @user
```
Removes user's ability to access bank

### View Bank Log
```
%showbanklog
```
Shows last 20 bank transactions (owner only)

### Add Credit to Bank
```
%axp @user <amount>
```
Adds ProBot credit to bank (from external source)

---

## 📊 Transaction Examples

### Example 1: User Converts 5,000 Gold
```
Before:
  User:   50,000 gold, 0 credit
  Bank:   1,000,000 gold, 500,000 credit

User converts 5,000 gold:
  5,000 gold × 100 = 500,000 credit

After:
  User:   45,000 gold, 500,000 credit
  Bank:   1,000,000 gold, 0 credit ⚠️ LOW!
```

### Example 2: Owner Receives Credit
```
Before:
  Bank: 0 credit

Owner receives 1,000,000 credit externally
Owner runs: %axp @owner 1000000

After:
  Bank: 1,000,000 credit ✓
```

---

## ⚠️ Common Issues

### "Bank credit insufficient for conversion"
**Problem**: Bank doesn't have enough credit  
**Solution**: Owner must receive credit from external source

### "You do not have permission to access bank"
**Problem**: User not authorized  
**Solution**: Owner runs: `%a @user`

### "Minimum is **1,000 gold**"
**Problem**: User trying to convert less than 1,000 gold  
**Solution**: User must have at least 1,000 gold to convert

---

## 🔍 Checking System Status

### View All Data
1. Owner runs: `%showbanklog` → See recent transactions
2. Owner runs: `%bank` → See current balances
3. Check `/data/bank.json` → Exact numbers

### Verify User Access
Check in `/data/users.json` → Look for `"bank_access": true`

---

## 💡 Best Practices

1. **Monitor Credit Level**: Regularly check bank balance
2. **Receive Credit**: Update bank proactively before it runs out
3. **Grant Access Carefully**: Only authorize trusted users
4. **Log Monitoring**: Check bank log weekly for anomalies
5. **Backup**: Keep copies of bank.json regularly

---

## 🎯 Conversion Reference

| Gold | Credit |
|------|--------|
| 1,000 | 100,000 |
| 5,000 | 500,000 |
| 10,000 | 1,000,000 |
| 50,000 | 5,000,000 |
| 100,000 | 10,000,000 |

---

## 📁 Related Files

- `BANK_CREDIT_SYSTEM.md` - Full documentation
- `services/bankService.js` - Bank functions
- `services/shopService.js` - Currency conversion
- `data/bank.json` - Bank data
- `data/bank_log.json` - Transaction log

