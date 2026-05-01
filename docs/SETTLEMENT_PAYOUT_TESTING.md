# Settlement & Weekly Payout Testing Guide

**Environment:** STAGING (apiamway-96zj69hn)  
**Date:** February 3, 2026

---

## Changes Summary

### 1. Settlement Logic Update
**Business Model Clarification:**
- Fleet Owners earn the **FULL trip revenue**
- Apiamway deducts a **commission** for fleet management/dispatch/tracking/payments
- **Fleet Owner Payout = Order Amount - Apiamway Commission**

**Technical Changes:**
- Updated `settlement.ts` to use `fleetOwnerPayout` instead of `partnerEarnings`
- Earnings are now marked as `pending` (not `credited` immediately)
- Wallet is NOT credited immediately - earnings accumulate until Friday payout
- All 62 tests passing

### 2. Weekly Payout System
**New Module:** `server/weeklyPayout.ts`

**Features:**
- Aggregates all `pending` earnings per Fleet Owner
- Credits Fleet Owner wallet balance
- Marks earnings as `credited`
- Creates payout batch record for auditing
- Idempotent: won't double-process earnings

**New API Endpoints:**
- `partners.processWeeklyPayouts` - Manual trigger for weekly payout
- `partners.getPayoutHistory` - Get payout history for a Fleet Owner
- `partners.getPendingEarnings` - Get pending earnings for a Fleet Owner

### 3. UI Label Updates
**PartnerDetail.tsx:**
- "Partner Commission" → "Fleet Owner Share" / "Apiamway Commission"
- "Total Earnings" → "Fleet Owner Earnings"
- Added "Payouts every Friday" indicator
- Added "Earnings accumulate in wallet. Payouts processed every Friday" to earnings ledger
- Shows Apiamway's commission percentage/amount alongside Fleet Owner share

---

## Testing Steps

### Test 1: Verify Settlement Calculation

**Scenario:** Create an order, assign to Fleet Owner's rider, mark as delivered

**Steps:**
1. Go to Admin → Partners
2. Select a Fleet Owner (e.g., "Duncan Logistics")
3. Note the current wallet balance
4. Go to Admin → Riders
5. Verify the rider is assigned to the Fleet Owner
6. Go to Admin → Orders
7. Create a new order with price ₦10,000
8. Assign the order to the Fleet Owner's rider
9. Mark order status: Assigned → Picked Up → In Transit → Delivered
10. **Important:** Mark payment status as "Paid" (settlement won't run if not paid)

**Expected Result:**
- Server logs show: `[Settlement DEBUG] Fleet Owner X will receive Y on Friday payout`
- Earnings ledger shows new entry with status = `pending`
- Fleet Owner wallet balance **DOES NOT change** (earnings are pending)
- Order settlement status = `settled`

**Verification:**
```javascript
// In browser console on Partner Detail page
trpc.partners.getPendingEarnings.query({ partnerCompanyId: PARTNER_ID })
// Should show the pending earning
```

---

### Test 2: Manual Weekly Payout Trigger

**Scenario:** Trigger weekly payout manually to credit Fleet Owner wallet

**Steps:**
1. Ensure Test 1 is complete (at least one pending earning exists)
2. Open browser console on Admin → Partners page
3. Run:
   ```javascript
   trpc.partners.processWeeklyPayouts.mutate()
   ```
4. Wait for response (should show payout summary)
5. Refresh Partner Detail page

**Expected Result:**
- Response shows:
  ```json
  {
    "success": true,
    "batchDate": "2026-02-03T...",
    "payoutsSummary": [
      {
        "fleetOwnerId": X,
        "fleetOwnerName": "Duncan Logistics",
        "totalEarnings": Y,
        "orderCount": Z,
        "earningIds": [...]
      }
    ],
    "totalAmount": Y,
    "totalOrders": Z,
    "errors": []
  }
  ```
- Fleet Owner wallet balance **increases** by the payout amount
- Earnings ledger shows entries with status = `credited` and `creditedAt` timestamp
- Server logs show: `[Weekly Payout] ✅ Credited ₦X to Fleet Owner's wallet`

---

### Test 3: Verify Idempotency

**Scenario:** Ensure weekly payout doesn't double-credit

**Steps:**
1. Note the current wallet balance after Test 2
2. Run weekly payout again:
   ```javascript
   trpc.partners.processWeeklyPayouts.mutate()
   ```
3. Check response and wallet balance

**Expected Result:**
- Response shows:
  ```json
  {
    "success": true,
    "payoutsSummary": [],
    "totalAmount": 0,
    "totalOrders": 0,
    "errors": []
  }
  ```
- Server logs show: `[Weekly Payout] ✅ No pending earnings to process`
- Fleet Owner wallet balance **DOES NOT change**

---

### Test 4: Verify Settlement with Multiple Orders

**Scenario:** Create multiple orders, verify they all accumulate as pending

**Steps:**
1. Create 3 orders (₦5,000, ₦8,000, ₦12,000)
2. Assign all to the same Fleet Owner's rider
3. Mark all as delivered + paid
4. Check pending earnings:
   ```javascript
   trpc.partners.getPendingEarnings.query({ partnerCompanyId: PARTNER_ID })
   ```
5. Trigger weekly payout
6. Verify wallet is credited with total of all 3 orders

**Expected Result:**
- Pending earnings shows 3 entries
- Total pending = (5000 + 8000 + 12000) * Fleet Owner's share percentage
- After payout, all 3 earnings are marked as `credited`
- Wallet balance increases by total pending amount

---

### Test 5: Verify UI Labels

**Scenario:** Check that UI shows correct terminology

**Steps:**
1. Go to Admin → Partners → Select any Fleet Owner
2. Check Overview tab
3. Check Earnings tab

**Expected UI Text:**
- Overview tab:
  - "Fleet Owner Share: 70%" (if percentage)
  - "Apiamway: 30%" (calculated)
  - "Fleet Owner Earnings: ₦X"
  - "Payouts every Friday"
- Earnings tab:
  - "Fleet Owner Earnings Ledger"
  - "Earnings accumulate in wallet. Payouts processed every Friday."
  - Table columns: "Date", "Order ID", "Order Price", "Apiamway", "Fleet Owner", "Status"

---

### Test 6: Verify Settlement Debug Logs

**Scenario:** Use manual settlement trigger to see detailed logs

**Steps:**
1. Create a delivered order (as in Test 1)
2. Open browser console
3. Run:
   ```javascript
   trpc.partners.triggerSettlement.mutate({ orderId: ORDER_ID })
   ```
4. Check server logs (`.manus-logs/devserver.log`)

**Expected Logs:**
```
[Settlement DEBUG] Starting settlement for order X
[Settlement DEBUG] Order X data: { status: 'delivered', paymentStatus: 'paid', ... }
[Settlement DEBUG] Order X has riderId: Y
[Settlement DEBUG] Rider Y data: { partnerCompanyId: Z, ... }
[Settlement DEBUG] Rider Y belongs to partner Z
[Settlement DEBUG] Partner Z data: { commissionType: 'percentage', commissionValue: '70.00', ... }
[Settlement DEBUG] Calculating commission: orderAmount=10000, type=percentage, value=70
[Settlement DEBUG] Commission calculated: { fleetOwnerPayout: 7000, apiamwayCommission: 3000 }
[Settlement DEBUG] Creating Fleet Owner earning record...
[Settlement DEBUG] Fleet Owner earning record created with status=pending
[Settlement DEBUG] Fleet Owner Z will receive 7000 on Friday payout
[Settlement DEBUG] ✅ Settlement completed successfully for order X
```

---

## Common Issues & Troubleshooting

### Issue: Settlement not running
**Symptoms:** No settlement logs, no earnings created

**Possible Causes:**
1. Order status is not "delivered"
2. Payment status is not "paid"
3. Rider is not assigned to order
4. Rider does not belong to a Fleet Owner (partnerCompanyId is null)

**Solution:**
- Check order details: status, paymentStatus, riderId
- Check rider details: partnerCompanyId
- Use manual settlement trigger to see detailed logs

---

### Issue: Wallet not credited after settlement
**Symptoms:** Earnings created but wallet balance unchanged

**Expected Behavior:** This is CORRECT. Earnings are marked as `pending` and wallet is only credited during Friday payout.

**Solution:**
- Run `partners.processWeeklyPayouts.mutate()` to trigger payout manually
- Verify earnings status changes from `pending` to `credited`

---

### Issue: Double settlement
**Symptoms:** Same order creates multiple earning records

**Prevention:** Settlement logic has idempotency checks:
1. Checks `order.settlementStatus` (won't run if already `settled`)
2. Checks for existing earning record with same `orderId` (unique constraint)

**Solution:**
- If double settlement occurs, check database for duplicate earnings
- Delete duplicate manually and investigate why idempotency failed

---

## Manual Database Queries (for debugging)

### Check pending earnings for a Fleet Owner
```sql
SELECT * FROM partnerEarnings 
WHERE partnerCompanyId = X AND status = 'pending'
ORDER BY createdAt DESC;
```

### Check credited earnings (payout history)
```sql
SELECT * FROM partnerEarnings 
WHERE partnerCompanyId = X AND status = 'credited'
ORDER BY creditedAt DESC;
```

### Check Fleet Owner wallet balance
```sql
SELECT id, name, balance FROM partnerCompanies WHERE id = X;
```

### Check order settlement status
```sql
SELECT id, trackingNumber, status, paymentStatus, settlementStatus, riderId 
FROM orders 
WHERE id = X;
```

---

## Production Deployment Notes

### Scheduled Job Setup
To run weekly payouts automatically every Friday, set up a cron job or scheduled task:

**Cron Expression:** `0 0 12 * * 5` (Every Friday at 12:00 PM)

**Command:**
```bash
curl -X POST https://apiamway-96zj69hn.manus.space/api/trpc/partners.processWeeklyPayouts \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

**Alternative:** Use Manus scheduled tasks feature (if available)

---

## Success Criteria

- [x] Settlement calculates Fleet Owner payout correctly (Order Amount - Apiamway Commission)
- [x] Earnings are marked as `pending` (not credited immediately)
- [x] Wallet is NOT credited until Friday payout
- [x] Weekly payout aggregates all pending earnings
- [x] Weekly payout credits Fleet Owner wallet
- [x] Weekly payout marks earnings as `credited`
- [x] Idempotency: No double-crediting
- [x] UI shows correct labels ("Fleet Owner Earnings", "Payouts every Friday")
- [x] All 62 tests passing
- [ ] User verifies on STAGING with real data

---

**Document Status:** Ready for User Review  
**Last Updated:** February 3, 2026
