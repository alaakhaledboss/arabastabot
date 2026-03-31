# 🏦 Bank Credit Management - Button Interface

**Update Date**: March 28, 2026  
**Status**: ✅ Implemented  
**Change**: Replaced `%axp` command with button-based credit management

---

## 📋 What Changed

### ❌ Removed
- `%axp @user <amount>` command
- Text-based credit input via command

### ✅ Added
- Three new credit management buttons in bank interface
- Modal-based input for credit operations
- Owner-only access with button disabling

---

## 🎮 How to Use

### Step 1: Open Bank
```
%bank  or  %b
```

### Step 2: You'll See Two Rows of Buttons

**Row 1: Gold Management (All Authorized Users)**
- 💰 Balance - View current bank balance
- 💸 Withdraw - Withdraw gold from bank
- ✅ Deposit - Deposit gold to bank

**Row 2: Credit Management (Owner Only)** 🔐
- 💳 Credit Info - View credit details
- ✅ Receive - Add credit to bank
- ❌ Deduct - Remove credit from bank

---

## 🔐 Access Control

### Button Visibility

| Button | Authorized | Owner | Status |
|--------|:----------:|:-----:|--------|
| Balance | ✅ | ✅ | Visible |
| Withdraw | ✅ | ✅ | Visible |
| Deposit | ✅ | ✅ | Visible |
| Credit Info | ❌ | ✅ | Owner Only |
| Receive | ❌ | ✅ | Owner Only |
| Deduct | ❌ | ✅ | Owner Only |

**Owner Only Buttons**: Appear disabled (greyed out) for non-owners

---

## 💳 Credit Operations

### Receive Credit (from ProBot)
1. Click **✅ Receive** button
2. Enter credit amount (e.g., 500000)
3. Submit
4. Confirmation with new bank credit balance

**Example**:
```
Before: Bank credit = 500,000
User enters: 1000000
After: Bank credit = 1,500,000
```

### Deduct Credit (adjustment/correction)
1. Click **❌ Deduct** button
2. Enter credit amount to remove
3. Submit
4. Confirmation with new bank credit balance

**Example**:
```
Before: Bank credit = 1,500,000
User enters: 200000
After: Bank credit = 1,300,000
```

### View Credit Details
1. Click **💳 Credit Info** button
2. See detailed credit information:
   - Total credit balance
   - Convertible amount (÷100 = gold)
   - Minimum conversion requirements

---

## 📊 Modal Interface

### Credit Input Modal

**For Receive Operation:**
```
Title: "استقبال رصيد | Receive Credit"
Field: "الرصيد | Credit Amount"
Placeholder: "مثال: 500000 | Example: 500000"
```

**For Deduct Operation:**
```
Title: "سحب رصيد | Deduct Credit"
Field: "الرصيد | Credit Amount"
Placeholder: "مثال: 500000 | Example: 500000"
```

---

## ✨ Features

### ✅ User-Friendly
- No command syntax to remember
- Clear visual buttons with emojis
- Bilingual interface (Arabic|English)

### ✅ Secure
- Owner-only operations
- Buttons automatically disabled for non-owners
- Permission validation on submission

### ✅ Reliable
- Input validation (must be positive number)
- Error messages for insufficient credit (deduct operation)
- Full transaction logging

### ✅ Consistent
- Same UI pattern as gold deposit/withdraw
- Professional embed design
- Timestamp and footer on all operations

---

## 🔍 Error Handling

### Invalid Amount
```
❌ Error: "أدخل رقمًا صحيحًا أكبر من صفر. | Enter a valid positive number."
```

### Insufficient Credit (Deduct)
```
❌ Error: "الرصيد غير كافٍ لهذه العملية. | Insufficient credit for this operation."
```

### Permission Denied
```
❌ Error: "فقط المالك يستطيع إدارة الرصيد. | Only the owner can manage credit."
```

---

## 📝 Logging

All credit operations are logged with:
- **Action**: `credit_received` or `credit_deducted`
- **Amount**: 0 (amount tracked in extra)
- **Extra**: `+500000 credit` or `-200000 credit`
- **Timestamp**: ISO 8601 format

**View Logs:**
```
%showbanklog
```

---

## 🎯 Comparison: Old vs New

| Feature | Old (%axp) | New (Buttons) |
|---------|-----------|---------------|
| Command | `%axp @user 500000` | Click button → Modal |
| Target | User account | Bank account |
| Syntax | Complex | Intuitive |
| GUI | Text-based | Visual buttons |
| Discovery | Hard to find | Obvious in bank |
| Permissions | Manual check | Auto-disabled |

---

## 💡 Use Cases

### Scenario 1: Owner Receives ProBot Credit
```
1. External user sends 1,000,000 credit to bot owner
2. Owner: %bank
3. Owner: Clicks "✅ Receive"
4. Owner: Enters 1000000
5. Result: Bank credit increases by 1,000,000
6. Users can now convert gold → credit
```

### Scenario 2: Correction/Adjustment
```
1. Mistake: Received 500,000 extra credit
2. Owner: %bank
3. Owner: Clicks "❌ Deduct"
4. Owner: Enters 500000
5. Result: Bank credit corrected
```

### Scenario 3: Regular User (Authorized)
```
1. User: %bank
2. User sees: 3 buttons (Balance, Withdraw, Deposit)
3. User doesn't see: Credit buttons (disabled/hidden)
4. User can manage gold only
```

---

## 🚀 Benefits

✅ **Eliminated command**: No more `%axp` to remember  
✅ **Improved UX**: Visual interface easier to use  
✅ **More secure**: Buttons automatically restricted  
✅ **Better discovery**: Buttons visible in bank menu  
✅ **Consistent**: Same pattern as gold operations  
✅ **Future-proof**: Easy to add more operations  

---

## 🔄 Migration Guide

**If you were using `%axp @bot 500000`:**

**Old way:**
```
%axp @bot 500000
```

**New way:**
1. Run: `%bank`
2. Click: **✅ Receive** button
3. Enter: `500000`
4. Submit

Same result, better interface!

---

## ⚙️ Technical Details

### New Functions Added
- `createCreditModal(action, userId)` - Creates modal for credit input
- `handleCreditModal(interaction, action, userId, OWNER_ID)` - Processes credit modal

### Button IDs
- `bank:credit_show:0:{userId}` - View credit info
- `bank:credit_add:0:{userId}` - Receive credit
- `bank:credit_remove:0:{userId}` - Deduct credit

### Modal IDs
- `bank:credit_add:{userId}` - Receive credit modal
- `bank:credit_remove:{userId}` - Deduct credit modal

---

## 🧪 Testing

Test the following:
- [x] Owner can see all 6 buttons
- [x] Authorized user sees only 3 buttons (credit disabled)
- [x] Regular user cannot access bank
- [x] Receive credit increases bank.credit
- [x] Deduct credit decreases bank.credit
- [x] Insufficient credit error shows correctly
- [x] Transactions logged properly
- [x] Invalid input rejected

---

## 📞 FAQ

**Q: Can I still give credit to users?**  
A: Yes, but it's different now. Credit buttons manage bank.credit (not user.credit). Users can still convert gold → credit via `%shop`.

**Q: Why are the credit buttons greyed out?**  
A: Only the owner can manage bank credit. Authorized users can see the bank but can't manage credit.

**Q: What if I enter a negative number?**  
A: Error message: "Enter a valid positive number."

**Q: Can regular users press the buttons?**  
A: Regular users can't access the bank at all. They need `%a @user` permission first.

---

## 📁 Modified Files

- `commands/bank.js` - Added credit buttons to UI
- `services/bankService.js` - Added credit modal and handler functions
- `interactions/buttons.js` - Added button handlers for credit
- `interactions/modals.js` - Added modal router for credit
- `commands/commandHandler.js` - Removed `%axp` command & help text

---

## ✅ Summary

The credit management system has been upgraded from text-based commands to an intuitive button interface. This provides:

- **Better UX**: Visual buttons instead of command syntax
- **Stronger Security**: Permission automatically enforced
- **Easier Discovery**: Functions visible in bank interface
- **Consistent Style**: Matches existing gold operations

**Status**: Ready to use ✅

