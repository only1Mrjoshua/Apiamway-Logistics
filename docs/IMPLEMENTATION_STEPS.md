# Implementation Steps: Shipper + Fleet Owner Account Model

**Status:** Planning Phase - Awaiting Approval  
**Reference:** See `ACCOUNT_MODEL_SHIPPER_FLEETOWNER.md` for detailed design

---

## Phase 1: Database Schema Updates

### Step 1.1: Add Index for User-Partner Lookup
```bash
# Run SQL migration
pnpm db:push
```

**SQL to add manually (if needed)**:
```sql
CREATE INDEX idx_partnerCompanies_userId ON partnerCompanies(userId);
```

**Verification**:
```sql
SHOW INDEX FROM partnerCompanies WHERE Key_name = 'idx_partnerCompanies_userId';
```

### Step 1.2: Optional - Add isFleetOwner Flag to Users Table
```sql
ALTER TABLE users ADD COLUMN isFleetOwner BOOLEAN DEFAULT FALSE;
```

**Note**: This is optional. We can derive Fleet Owner status by joining with `partnerCompanies` table.

**Checkpoint**: Database schema updated, no breaking changes

---

## Phase 2: Backend API Implementation

### Step 2.1: Add Database Helper Functions

**File**: `server/db.ts`

Add these functions:
```typescript
/**
 * Get partner company by user ID
 */
export async function getPartnerCompanyByUserId(userId: number) {
  const database = await getDb();
  if (!database) return null;
  
  const [partner] = await database
    .select()
    .from(partnerCompanies)
    .where(eq(partnerCompanies.userId, userId))
    .limit(1);
  
  return partner || null;
}

/**
 * Check if user is an approved Fleet Owner
 */
export async function isApprovedFleetOwner(userId: number): Promise<boolean> {
  const partner = await getPartnerCompanyByUserId(userId);
  return partner?.status === 'approved';
}

/**
 * Create Fleet Owner application (links user to partner company)
 */
export async function createFleetOwnerApplication(data: {
  userId: number;
  name: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
}) {
  const database = await getDb();
  if (!database) throw new Error('Database not available');
  
  const [partner] = await database
    .insert(partnerCompanies)
    .values({
      userId: data.userId,
      name: data.name,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
      status: 'pending',
      commissionType: 'percentage',
      commissionValue: '70.00', // Default commission
    })
    .$returningId();
  
  return partner.id;
}
```

**Checkpoint**: Database helpers added

### Step 2.2: Add Fleet Owner Router

**File**: `server/routers.ts`

Add new router after `partners` router:
```typescript
// ==================== FLEET OWNER (CUSTOMER-FACING) ====================
fleetOwner: router({
  // Apply to become Fleet Owner
  apply: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      contactName: z.string().min(1),
      contactPhone: z.string().min(1),
      contactEmail: z.string().email().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if user already has an application
      const existing = await db.getPartnerCompanyByUserId(ctx.user.id);
      if (existing) {
        throw new TRPCError({ 
          code: 'BAD_REQUEST', 
          message: 'You already have a Fleet Owner application' 
        });
      }
      
      const partnerId = await db.createFleetOwnerApplication({
        userId: ctx.user.id,
        ...input,
      });
      
      return { success: true, partnerId };
    }),
  
  // Get my Fleet Owner application status
  getMyApplication: protectedProcedure
    .query(async ({ ctx }) => {
      const partner = await db.getPartnerCompanyByUserId(ctx.user.id);
      return partner;
    }),
  
  // Get my fleet (riders + devices)
  getMyFleet: protectedProcedure
    .query(async ({ ctx }) => {
      const partner = await db.getPartnerCompanyByUserId(ctx.user.id);
      if (!partner) {
        throw new TRPCError({ 
          code: 'NOT_FOUND', 
          message: 'Fleet Owner application not found' 
        });
      }
      
      if (partner.status !== 'approved') {
        throw new TRPCError({ 
          code: 'FORBIDDEN', 
          message: 'Fleet Owner application not approved yet' 
        });
      }
      
      return await db.getPartnerFleet(partner.id);
    }),
  
  // Get my earnings
  getMyEarnings: protectedProcedure
    .query(async ({ ctx }) => {
      const partner = await db.getPartnerCompanyByUserId(ctx.user.id);
      if (!partner) {
        throw new TRPCError({ 
          code: 'NOT_FOUND', 
          message: 'Fleet Owner application not found' 
        });
      }
      
      if (partner.status !== 'approved') {
        throw new TRPCError({ 
          code: 'FORBIDDEN', 
          message: 'Fleet Owner application not approved yet' 
        });
      }
      
      return await db.getPartnerEarnings(partner.id);
    }),
}),
```

**Checkpoint**: Fleet Owner API endpoints added

### Step 2.3: Update auth.me Endpoint

**File**: `server/routers.ts`

Modify `auth.me` procedure to include Fleet Owner status:
```typescript
me: publicProcedure.query(async ({ ctx }) => {
  if (!ctx.user) return null;
  
  // Check if user is a Fleet Owner
  const partner = await db.getPartnerCompanyByUserId(ctx.user.id);
  
  return {
    ...ctx.user,
    isFleetOwner: !!partner,
    fleetOwnerStatus: partner?.status || null,
    fleetOwnerBalance: partner?.balance || null,
  };
}),
```

**Checkpoint**: Auth endpoint updated

### Step 2.4: Write Tests

**File**: `server/fleet-owner.test.ts` (new file)

Add tests for:
- [ ] Fleet Owner application creation
- [ ] Duplicate application prevention
- [ ] Application status retrieval
- [ ] Fleet access (approved only)
- [ ] Earnings access (approved only)

**Checkpoint**: Backend implementation complete

---

## Phase 3: Admin UI Updates

### Step 3.1: Rename "Partners" to "Fleet Owners" in Sidebar

**File**: `client/src/components/DashboardLayout.tsx`

Find the sidebar navigation and update:
```typescript
// OLD
{ name: "Partners", href: "/admin/partners", icon: Users }

// NEW
{ name: "Fleet Owners", href: "/admin/fleet-owners", icon: Users }
```

**Checkpoint**: Sidebar updated

### Step 3.2: Rename Partners Page File

```bash
# Rename file
mv client/src/pages/admin/Partners.tsx client/src/pages/admin/FleetOwners.tsx
```

**File**: `client/src/pages/admin/FleetOwners.tsx`

Update page title and labels:
```typescript
// Update all instances of "Partner" to "Fleet Owner"
// Search and replace:
// - "Partner" → "Fleet Owner"
// - "partner" → "fleet owner"
// - "Partners" → "Fleet Owners"
```

**Checkpoint**: Admin page renamed

### Step 3.3: Update Routes

**File**: `client/src/App.tsx`

Update route:
```typescript
// OLD
<Route path="/admin/partners" component={Partners} />
<Route path="/admin/partners/:id" component={PartnerDetail} />

// NEW
<Route path="/admin/fleet-owners" component={FleetOwners} />
<Route path="/admin/fleet-owners/:id" component={FleetOwnerDetail} />
```

**Checkpoint**: Routes updated

### Step 3.4: Update Fleet Owner Detail Page

**File**: `client/src/pages/admin/FleetOwnerDetail.tsx` (renamed from PartnerDetail.tsx)

Add indicator for user-linked Fleet Owners:
```typescript
// In the Overview tab, add:
{partner.userId && (
  <div className="flex items-center gap-2">
    <Badge variant="outline">Linked to User Account</Badge>
    <span className="text-sm text-muted-foreground">
      User ID: {partner.userId}
    </span>
  </div>
)}

{!partner.userId && (
  <Badge variant="secondary">Legacy Partner</Badge>
)}
```

**Checkpoint**: Admin UI complete

---

## Phase 4: Customer/Shipper UI Implementation

### Step 4.1: Create Fleet Owner Application Page

**File**: `client/src/pages/fleet-owner/Apply.tsx` (new file)

Create form with fields:
- Company/Individual Name
- Contact Name
- Contact Phone
- Contact Email (optional)

Use `trpc.fleetOwner.apply.useMutation()` to submit.

**Checkpoint**: Application form created

### Step 4.2: Create Application Status Page

**File**: `client/src/pages/fleet-owner/Status.tsx` (new file)

Use `trpc.fleetOwner.getMyApplication.useQuery()` to fetch status.

Show different UI based on status:
- `pending`: "Your application is under review"
- `approved`: "Welcome! You can now manage your fleet"
- `rejected`: "Your application was not approved"
- `suspended`: "Your account has been suspended"

**Checkpoint**: Status page created

### Step 4.3: Create Fleet Owner Dashboard

**File**: `client/src/pages/fleet-owner/Dashboard.tsx` (new file)

Tabs:
1. **My Fleet** - Use `trpc.fleetOwner.getMyFleet.useQuery()`
2. **Earnings** - Use `trpc.fleetOwner.getMyEarnings.useQuery()`
3. **Wallet** - Show balance from `useAuth().user.fleetOwnerBalance`

**Checkpoint**: Dashboard created

### Step 4.4: Add Navigation Links

**File**: `client/src/components/Header.tsx` (or wherever user menu is)

Add conditional links based on `useAuth()`:
```typescript
const { user } = useAuth();

// If NOT Fleet Owner, show "Become a Fleet Owner" link
{!user?.isFleetOwner && (
  <Link href="/fleet-owner/apply">
    <Button variant="outline">Become a Fleet Owner</Button>
  </Link>
)}

// If Fleet Owner (pending), show "Application Status" link
{user?.isFleetOwner && user?.fleetOwnerStatus === 'pending' && (
  <Link href="/fleet-owner/status">
    <Badge variant="outline">Application Pending</Badge>
  </Link>
)}

// If Fleet Owner (approved), show "Fleet Dashboard" link
{user?.isFleetOwner && user?.fleetOwnerStatus === 'approved' && (
  <Link href="/fleet-owner/dashboard">
    Fleet Dashboard
  </Link>
)}
```

**Checkpoint**: Navigation complete

### Step 4.5: Add Routes

**File**: `client/src/App.tsx`

Add routes:
```typescript
<Route path="/fleet-owner/apply" component={FleetOwnerApply} />
<Route path="/fleet-owner/status" component={FleetOwnerStatus} />
<Route path="/fleet-owner/dashboard" component={FleetOwnerDashboard} />
```

**Checkpoint**: Customer UI complete

---

## Phase 5: Settlement Verification

### Step 5.1: Verify Settlement Logic

**File**: `server/settlement.ts`

Confirm settlement uses `rider.partnerCompanyId` (already implemented):
```typescript
// This should already be in place from previous fix
const rider = await db.getRiderById(order.riderId);
if (rider.partnerCompanyId) {
  // Credit partner wallet
  await db.creditPartnerBalance(rider.partnerCompanyId, calculation.partnerEarnings);
}
```

**Checkpoint**: Settlement logic verified

### Step 5.2: Test Settlement Flow

**Test Scenario**:
1. Create Fleet Owner application (as user)
2. Admin approves application
3. Admin assigns rider to Fleet Owner
4. Create order, assign to Fleet Owner's rider
5. Mark order as delivered
6. Verify Fleet Owner wallet is credited
7. Check debug logs for settlement execution

**Expected Result**:
- Fleet Owner wallet balance increases
- Earnings ledger entry created
- Debug logs show: `[Settlement DEBUG] Rider X belongs to partner Y`

**Checkpoint**: Settlement verified

---

## Phase 6: Testing & Rollout

### Step 6.1: Manual Testing Checklist

- [ ] Shipper can sign up via Manus OAuth
- [ ] Shipper can request delivery (existing flow)
- [ ] Shipper can apply to become Fleet Owner
- [ ] Application appears in admin Fleet Owners list
- [ ] Admin can approve Fleet Owner application
- [ ] Approved Fleet Owner sees dashboard
- [ ] Fleet Owner can view assigned fleet
- [ ] Fleet Owner can view earnings ledger
- [ ] Settlement credits Fleet Owner when their rider completes delivery
- [ ] Settlement does NOT credit Shippers
- [ ] Existing legacy partners (without userId) continue to work

### Step 6.2: Automated Testing

Run existing test suite:
```bash
pnpm test
```

Add new tests:
- [ ] `server/fleet-owner.test.ts` - Fleet Owner API tests
- [ ] Update `server/settlement.test.ts` - Verify settlement with user-linked partners

### Step 6.3: Save Checkpoint

```bash
# After all changes are complete and tested
pnpm test
```

Create checkpoint with description:
> "Account Model Update: Shipper + Fleet Owner implementation complete. Users can now apply to become Fleet Owners and earn commission on deliveries. Admin UI renamed Partners to Fleet Owners. Settlement verified to credit Fleet Owners via rider ownership."

**Checkpoint**: Implementation complete

---

## Rollback Plan

If issues arise, rollback steps:

1. **Database**: No rollback needed (additive changes only)
2. **Backend**: Remove `fleetOwner` router from `server/routers.ts`
3. **Frontend**: Remove Fleet Owner pages and routes
4. **Admin UI**: Revert "Fleet Owners" back to "Partners"

**Note**: Existing data is safe. New `partnerCompanies` records with `userId` will remain but won't affect system operation.

---

## Post-Implementation Tasks

After successful rollout:

1. [ ] Update README.md with new account model explanation
2. [ ] Create user-facing documentation for Fleet Owner application
3. [ ] Add email notifications for application status changes
4. [ ] Add document upload capability (Phase 2)
5. [ ] Add Fleet Owner analytics dashboard
6. [ ] Consider adding Fleet Owner referral program

---

**Document Status:** Draft - Awaiting User Approval  
**Last Updated:** February 3, 2026
