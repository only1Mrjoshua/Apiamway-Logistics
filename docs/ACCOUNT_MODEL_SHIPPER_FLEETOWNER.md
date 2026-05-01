# Account Model Update: Shipper + Fleet Owner

**Status:** Planning Phase - Awaiting Approval  
**Target Environment:** STAGING (apiamway-96zj69hn)  
**Date:** February 3, 2026

---

## Executive Summary

This document outlines the plan to evolve Apiamway's account model from a single "Partner" concept to a dual-role system where:

1. **Shippers** (default) - Regular customers who request deliveries
2. **Fleet Owners** (optional upgrade) - Users who provide riders/bikes/devices and earn commission

The goal is to enable any user to sign up and request deliveries immediately while optionally upgrading to become a Fleet Owner to earn income from their fleet.

---

## Current System Analysis

### Current Architecture

**Users Table (`users`)**
- Serves as authentication backbone
- Roles: `user`, `admin`, `dispatcher`, `support`
- No distinction between customers and fleet owners
- Links to Manus OAuth via `openId`

**Partner Companies Table (`partnerCompanies`)**
- Represents external companies/individuals who provide fleet
- Fields: name, contact info, commission config, wallet balance
- Status workflow: `pending` → `approved` → `suspended` / `rejected`
- Has optional `userId` field (currently unused for linking to users table)

**Orders Table (`orders`)**
- Stores customer info as inline fields (customerName, customerPhone, customerEmail)
- No `userId` or `customerId` foreign key
- Has `partnerCompanyId` field (currently set by admin, not used for settlement)
- Has `riderId` field (used for settlement in latest fix)

**Riders Table (`riders`)**
- Has `partnerCompanyId` field to indicate fleet ownership
- Settlement resolves partner via: `order.riderId` → `rider.partnerCompanyId`

**Settlement Flow**
- Triggered when order status changes to `delivered`
- Resolves partner via assigned rider's `partnerCompanyId`
- Credits partner wallet and creates earnings ledger entry
- Only runs if payment is confirmed (`paymentStatus = 'paid'`)

### Current Limitations

1. **No user-to-customer linkage**: Orders store customer info as text fields, not linked to authenticated users
2. **No self-service fleet owner onboarding**: Partners are created by admin only
3. **Terminology confusion**: "Partner" doesn't clearly communicate the fleet ownership role
4. **No shipper identity**: Regular customers have no account or order history

---

## Proposed Account Model

### Two User Types

#### 1. Shipper (Default)
- **Who**: Any user who signs up via Manus OAuth
- **Capabilities**:
  - Request deliveries immediately after signup
  - Track orders via tracking number (no login required) OR via account (if logged in)
  - View order history (if logged in)
  - Manage wallet balance for payments
  - Refer other users for rewards
- **Database**: Represented in `users` table with default `role = 'user'`
- **No approval required**: Instant access

#### 2. Fleet Owner (Optional Upgrade)
- **Who**: Shippers who want to provide fleet and earn commission
- **Capabilities**:
  - All Shipper capabilities PLUS:
  - Submit Fleet Owner application
  - Provide riders, bikes, devices
  - Receive dispatch assignments (when approved)
  - Earn commission on completed deliveries
  - View earnings ledger and withdraw funds
- **Database**: 
  - Represented in `users` table (same user account)
  - Linked to `partnerCompanies` table via `userId` field
  - `partnerCompanies.userId` → `users.id` (one-to-one)
- **Approval required**: Admin reviews and approves application

### Key Design Decisions

1. **Reuse Partner System**: Keep `partnerCompanies` table and backend logic unchanged. Only rename in UI labels.
2. **Single User Account**: A user is BOTH a Shipper and Fleet Owner (if approved). No separate login.
3. **Backward Compatible**: Existing partner records (without `userId`) continue to work as "legacy partners"
4. **Settlement Unchanged**: Continue using `order.riderId` → `rider.partnerCompanyId` for settlement

---

## Implementation Plan

### Phase 1: Database Schema Updates

**Goal**: Link users to partner companies without breaking existing data

**Changes**:
1. Ensure `partnerCompanies.userId` field exists (already present)
2. Add index on `partnerCompanies.userId` for efficient lookups
3. Add `userType` or `isFleetOwner` flag to `users` table (optional, can derive from partnerCompanies join)

**Migration Strategy**:
- Non-breaking: Existing partners without `userId` continue to work
- New Fleet Owner applications will populate `userId` field

**SQL**:
```sql
-- Add index for efficient user → partner lookup
CREATE INDEX idx_partnerCompanies_userId ON partnerCompanies(userId);

-- Optional: Add flag to users table for quick checks
ALTER TABLE users ADD COLUMN isFleetOwner BOOLEAN DEFAULT FALSE;
```

**Risk**: Low - additive changes only

---

### Phase 2: Backend API Updates

**Goal**: Add Fleet Owner application endpoints

**New tRPC Procedures**:

1. **`fleetOwner.apply`** (protected)
   - Input: name, contactName, contactPhone, contactEmail, companyType
   - Creates `partnerCompanies` record with `userId = ctx.user.id`
   - Sets `status = 'pending'`
   - Returns: application ID

2. **`fleetOwner.getMyApplication`** (protected)
   - Returns current user's Fleet Owner application (if exists)
   - Includes status, approval date, rejection reason

3. **`fleetOwner.getMyFleet`** (protected, requires approved Fleet Owner)
   - Returns riders, devices assigned to user's partner company
   - Reuses existing `db.getPartnerFleet(partnerCompanyId)`

4. **`fleetOwner.getMyEarnings`** (protected, requires approved Fleet Owner)
   - Returns earnings ledger for user's partner company
   - Reuses existing `db.getPartnerEarnings(partnerCompanyId)`

**Modified Procedures**:

1. **`auth.me`**
   - Add `isFleetOwner` and `fleetOwnerStatus` to response
   - Join with `partnerCompanies` to check if user has application

2. **`orders.create`** (if implementing logged-in orders)
   - Optionally link order to `userId` if user is authenticated
   - Still support anonymous orders (no userId)

**Helper Functions** (`server/db.ts`):
```typescript
// Get partner company by user ID
export async function getPartnerCompanyByUserId(userId: number): Promise<PartnerCompany | null>

// Check if user is approved Fleet Owner
export async function isApprovedFleetOwner(userId: number): Promise<boolean>
```

**Risk**: Low - new endpoints, existing endpoints unchanged

---

### Phase 3: Admin UI Updates

**Goal**: Admin can review and approve Fleet Owner applications

**Changes**:

1. **Rename "Partners" to "Fleet Owners"** in admin sidebar and page titles
   - File: `client/src/components/DashboardLayout.tsx`
   - File: `client/src/pages/admin/Partners.tsx` → rename to `FleetOwners.tsx`
   - Update route in `App.tsx`

2. **Fleet Owner List Page** (existing Partners page)
   - Show applicant name, contact, status, application date
   - Add "View Application" button
   - Keep existing approve/suspend/reject actions

3. **Fleet Owner Detail Page** (existing Partner detail page)
   - Show linked user account (if `userId` exists)
   - Show "Legacy Partner" badge if no `userId`
   - Keep existing tabs: Overview, Fleet, Earnings, Transactions

**Risk**: Low - UI label changes only

---

### Phase 4: Customer/Shipper UI

**Goal**: Enable Fleet Owner application flow for logged-in users

**New Pages**:

1. **`/fleet-owner/apply`** - Fleet Owner Application Form
   - Fields:
     - Company/Individual Name
     - Contact Name
     - Contact Phone
     - Contact Email (optional)
     - Company Type: Individual / Company (radio buttons)
   - Submit button → calls `fleetOwner.apply` mutation
   - Success: Redirect to `/fleet-owner/status`

2. **`/fleet-owner/status`** - Application Status Page
   - Shows current application status: Pending / Approved / Rejected / Suspended
   - If pending: "Your application is under review"
   - If approved: "Welcome! You can now manage your fleet" + link to fleet dashboard
   - If rejected: Show rejection reason (if provided)

3. **`/fleet-owner/dashboard`** - Fleet Owner Dashboard (if approved)
   - Tabs: My Fleet, Earnings, Transactions
   - Reuse existing partner UI components

**Navigation Updates**:

1. **Customer Header** (if user is NOT Fleet Owner)
   - Add "Become a Fleet Owner" button/link in user menu

2. **Customer Header** (if user IS Fleet Owner)
   - Add "Fleet Dashboard" link in user menu
   - Show Fleet Owner badge

**Risk**: Medium - new UI flows, but isolated from existing order flow

---

### Phase 5: Settlement Verification

**Goal**: Ensure settlement correctly credits Fleet Owners (not Shippers)

**Current Flow** (already implemented):
```
Order delivered → onOrderDelivered(orderId)
  → processOrderSettlement(orderId)
    → Get order.riderId
    → Get rider.partnerCompanyId
    → If partnerCompanyId exists:
        → Calculate commission
        → Credit partner wallet
        → Create earnings ledger entry
```

**Verification Steps**:
1. Create test Fleet Owner application
2. Admin approves application
3. Admin assigns rider to Fleet Owner
4. Create order, assign to Fleet Owner's rider
5. Mark order as delivered
6. Verify Fleet Owner wallet is credited
7. Verify earnings appear in Fleet Owner dashboard

**Risk**: Low - settlement logic already uses `rider.partnerCompanyId`

---

### Phase 6: Testing & Rollout

**Testing Checklist**:

- [ ] Shipper can sign up and request delivery immediately
- [ ] Shipper can apply to become Fleet Owner
- [ ] Admin receives Fleet Owner application
- [ ] Admin can approve/reject application
- [ ] Approved Fleet Owner sees fleet dashboard
- [ ] Admin can assign riders to Fleet Owner
- [ ] Order assigned to Fleet Owner's rider credits Fleet Owner wallet
- [ ] Order assigned to Apiamway rider does NOT credit any Fleet Owner
- [ ] Existing partners (without userId) continue to work
- [ ] Settlement debug logs show correct partner resolution

**Rollout Plan**:
1. Deploy to STAGING
2. Test all flows with real data
3. Fix any issues
4. User reviews and approves
5. Deploy to PRODUCTION (when ready)

---

## Database Schema Changes Summary

### New Indexes
```sql
CREATE INDEX idx_partnerCompanies_userId ON partnerCompanies(userId);
```

### Optional New Columns
```sql
-- Optional: Add flag to users table for quick Fleet Owner checks
ALTER TABLE users ADD COLUMN isFleetOwner BOOLEAN DEFAULT FALSE;
```

### No Breaking Changes
- Existing `partnerCompanies` records without `userId` continue to work
- Existing `orders` continue to work
- Existing settlement logic continues to work

---

## UI Label Mapping

| Current Label | New Label |
|--------------|-----------|
| Partners | Fleet Owners |
| Partner Company | Fleet Owner |
| Partner Detail | Fleet Owner Detail |
| Partner Fleet | My Fleet |
| Partner Earnings | My Earnings |
| Partner Balance | Wallet Balance |
| Approve Partner | Approve Fleet Owner |

---

## API Endpoints Summary

### New Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `fleetOwner.apply` | Protected | Submit Fleet Owner application |
| `fleetOwner.getMyApplication` | Protected | Get current user's application status |
| `fleetOwner.getMyFleet` | Protected + Approved | Get user's assigned riders/devices |
| `fleetOwner.getMyEarnings` | Protected + Approved | Get user's earnings ledger |

### Modified Endpoints

| Endpoint | Change |
|----------|--------|
| `auth.me` | Add `isFleetOwner` and `fleetOwnerStatus` fields |

### Unchanged Endpoints

All existing admin partner management endpoints remain unchanged:
- `partners.getAll`
- `partners.getById`
- `partners.approve`
- `partners.suspend`
- `partners.assignRider`
- `partners.assignDevice`
- etc.

---

## File Changes Checklist

### Backend Files

- [ ] `drizzle/schema.ts` - Add index, optional isFleetOwner flag
- [ ] `server/db.ts` - Add `getPartnerCompanyByUserId`, `isApprovedFleetOwner`
- [ ] `server/routers.ts` - Add `fleetOwner` router with new procedures
- [ ] `server/routers.ts` - Update `auth.me` to include Fleet Owner status

### Frontend Files

- [ ] `client/src/App.tsx` - Add Fleet Owner routes
- [ ] `client/src/components/DashboardLayout.tsx` - Rename "Partners" to "Fleet Owners"
- [ ] `client/src/pages/admin/Partners.tsx` - Rename to `FleetOwners.tsx`
- [ ] `client/src/pages/fleet-owner/Apply.tsx` - NEW: Application form
- [ ] `client/src/pages/fleet-owner/Status.tsx` - NEW: Application status
- [ ] `client/src/pages/fleet-owner/Dashboard.tsx` - NEW: Fleet Owner dashboard
- [ ] `client/src/components/Header.tsx` - Add "Become Fleet Owner" link

### Documentation Files

- [ ] `docs/ACCOUNT_MODEL_SHIPPER_FLEETOWNER.md` - This document
- [ ] `README.md` - Update with new account model explanation

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Breaking existing partners | HIGH | Keep `partnerCompanies` table unchanged, make `userId` optional |
| Settlement stops working | HIGH | Already fixed to use `rider.partnerCompanyId`, verify with tests |
| UI confusion | MEDIUM | Clear labels, onboarding flow, status indicators |
| Data migration issues | LOW | Additive changes only, no data deletion |
| Performance impact | LOW | Add indexes, no N+1 queries |

---

## Success Criteria

1. ✅ Any user can sign up and request delivery immediately (Shipper)
2. ✅ User can apply to become Fleet Owner via simple form
3. ✅ Admin can review and approve Fleet Owner applications
4. ✅ Approved Fleet Owner can view fleet and earnings
5. ✅ Settlement credits Fleet Owner when their rider completes delivery
6. ✅ Settlement does NOT credit Shippers
7. ✅ Existing partners (legacy) continue to work
8. ✅ No disruption to customer order flow

---

## Next Steps

1. **Review this document** - User approval required before implementation
2. **Confirm scope** - Any additions/changes to requirements?
3. **Approve Phase 1** - Database schema changes
4. **Approve Phase 2** - Backend API implementation
5. **Approve Phase 3** - Admin UI updates
6. **Approve Phase 4** - Customer UI implementation
7. **Approve Phase 5** - Settlement verification
8. **Approve Phase 6** - Testing and rollout

---

## Questions for User

1. Should we add document upload capability in Phase 1, or defer to Phase 2?
2. Should Fleet Owner application require admin approval before ANY fleet assignment, or can they add fleet immediately and wait for approval to receive dispatch?
3. Should Shippers be able to see their order history without login (tracking number only) or require login?
4. Should we add a "Company Type" field (Individual vs Company) to the application form?
5. Should we keep the term "Partner" in database/code and only change UI labels, or rename everything?

---

**Document Status:** Draft - Awaiting User Approval  
**Last Updated:** February 3, 2026
