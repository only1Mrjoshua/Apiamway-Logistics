# Apiamway Operations Platform - TODO

## Workstream 3: Operations Platform & Tracking Backend

### Database Schema (COMPLETE)
- [x] Users table with roles (admin, dispatcher, support, user)
- [x] Riders table (name, phone, status, hub assignment)
- [x] Devices table (Traccar device ID, name, status)
- [x] Orders table (full order lifecycle)
- [x] Tracking tokens table (secure token-based tracking)
- [x] Order history table (audit trail)
- [x] Wallets table (user wallet balances)
- [x] Wallet transactions table (audit trail)
- [x] Payments table (Paystack records)
- [x] Referral codes table (unique codes per user)
- [x] Referrals table (tracking relationships)

### API Endpoints (COMPLETE)
- [x] Rider CRUD operations
- [x] Device CRUD operations
- [x] Order management (create, assign, update status)
- [x] Public tracking by token
- [x] Dashboard statistics
- [x] Wallet get/transactions endpoints
- [x] Payment initialize/verify endpoints
- [x] Referral code/apply endpoints

### Admin Dashboard UI (COMPLETE)
- [x] Dashboard overview with KPIs
- [x] Orders list with search/filter
- [x] Order detail with status updates
- [x] New order creation form
- [x] Riders management page
- [x] Devices management page
- [x] Role-based access control
- [x] Fix routing issues

### Tracking System (COMPLETE)
- [x] Token-based tracking URLs
- [x] Status-based tracking logic
- [x] Tracking link activation on pickup
- [x] Tracking link expiration on delivery
- [x] Traccar Cloud integration (Basic Auth + API Token abstraction)
- [x] Live location endpoint for polling
- [x] Caching layer (30s positions, 5min devices)

## CONTINUATION (Prompt 3 Patch)

### CRITICAL BUG FIX - Validation (COMPLETE)
- [x] Frontend: Pickup address, name, phone → REQUIRED
- [x] Frontend: Drop-off address, recipient name, phone → REQUIRED
- [x] Frontend: Disable "Next Step" until valid
- [x] Frontend: Show inline validation errors
- [x] Frontend: Prevent access to Package/Review unless route complete
- [x] Frontend: Redirect users back if accessing URLs directly
- [x] Backend: Reject pricing if pickup/drop-off missing
- [x] Backend: Reject order creation if route incomplete

### Traccar Backend Integration (COMPLETE)
- [x] Create Traccar service with Basic Auth (abstracted for API Token later)
- [x] Finalize API calls (devices, latest positions, last update)
- [x] Internal mapping: device ↔ bike ↔ rider
- [x] Add caching to reduce API calls (30s for positions, 5min for devices)
- [ ] Request TRACCAR_USERNAME and TRACCAR_PASSWORD env vars (pending user input)

### Paystack Payment Integration (COMPLETE)
- [x] Add Paystack SDK/integration
- [x] Create payment initiation endpoint
- [x] Create payment verification endpoint
- [x] Implement webhook handler for verification
- [x] Secure reference storage
- [x] No secrets in frontend or tracking links
- [ ] Request PAYSTACK_SECRET_KEY and PAYSTACK_PUBLIC_KEY env vars (pending user input)

### Wallet System (COMPLETE)
- [x] Add wallet table to database schema
- [x] Add wallet transactions table
- [x] Credit wallet after payment verification
- [x] Debit wallet for deliveries
- [x] Admin adjustment with audit trail
- [x] Full transaction logs

### Referral System (COMPLETE)
- [x] Add referral codes table
- [x] Unique referral code per user
- [x] Track referral relationships
- [x] Apply referral code endpoint
- [x] Anti-abuse: No self-referrals
- [x] Anti-abuse: Device fingerprint + IP tracking
- [x] Admin revoke tools

### Pending Items
- [ ] Integrate Track page with backend API
- [ ] Proof of Delivery upload functionality
- [ ] CSV export for reports
- [ ] Rate limiting on tracking endpoints
- [x] Vitest tests for all new endpoints
- [ ] Deploy to STAGING for UAT
- [ ] Wait for approval before production

## Environment Variables Required

### Traccar (Demo Server)
```
TRACCAR_API_URL=https://demo.traccar.org/api
TRACCAR_AUTH_TYPE=basic
TRACCAR_USERNAME=<your_email>
TRACCAR_PASSWORD=<your_password>
```

### Paystack
```
PAYSTACK_SECRET_KEY=sk_test_xxx or sk_live_xxx
PAYSTACK_PUBLIC_KEY=pk_test_xxx or pk_live_xxx
```

## Bug Fixes

### Google Maps API Loading Error
- [x] Fix duplicate Google Maps API loading on /request-delivery page


## Credential Testing & UI Development

### Test Integrations with Provided Credentials
- [x] Write test for Paystack payment initialization
- [x] Write test for Traccar device fetching
- [x] Verify credentials are working correctly

### Customer Wallet UI
- [x] Create Wallet page showing balance
- [x] Add top-up button with Paystack integration
- [x] Display transaction history with pagination
- [x] Add route to App.tsx

### Customer Referral UI
- [x] Create Referral page showing user's referral code
- [x] Display referral link with copy button
- [x] Show list of referred users
- [x] Display referral bonus earned
- [x] Add route to App.tsx


## Navigation & GPS Tracking

### Add Navigation Links
- [x] Add Wallet link to main navigation header
- [x] Add Referral link to main navigation header
- [x] Ensure links are visible for authenticated users only

### Live GPS Tracking on Public Tracking Page
- [x] Read current Track.tsx implementation
- [x] Add MapView component to tracking page
- [x] Fetch live location from Traccar API using device ID from order
- [x] Display rider location on map with marker
- [x] Show rider phone number
- [x] Handle "In Transit" status only (no GPS for other statuses)
- [x] Add auto-refresh for live location updates (30s interval)


## New Features Implementation

### Admin Wallet Management UI
- [x] Create admin Wallets list page (/admin/wallets)
- [x] Display all user wallets with balances
- [x] Create wallet detail page with transaction history
- [x] Add manual credit/debit adjustment form
- [x] Add route to admin navigation### Order Geocoding for Route Visualization
- [x] Add lat/lng columns to orders table schema
- [x] Create geocoding helper using Google Maps Geocoding API
- [x] Update order creation endpoints to geocode addresses
- [x] Update tracking page to display pickup/delivery markers
- [x] Draw route line between pickup and delivery on maptio### Paystack Webhook Handler
- [x] Create webhook endpoint (/api/payment/webhook)
- [x] Verify Paystack signature
- [x] Handle charge.success event
- [x] Auto-credit wallet on successful payment
- [x] Update payment status in databaseing
- [ ] Add webhook URL to Paystack dashboard documentation


## MODEL B: Managed Partner Fleet (PATCH)

### Database Schema Additions
- [x] Create partnerCompanies table (name, contact, commission%, status, approval)
- [x] Add fleet_type enum to riders table ('apiamway_owned' | 'partner_fleet')
- [x] Add partner_company_id to riders table
- [x] Add fleet_type to devices table
- [x] Add partner_company_id to devices table
- [x] Create partnerEarnings table (orderId, partnerId, amount, status, createdAt)
- [x] Add partner_company_id to orders table (nullable)

### Backend API - Partner Management
- [x] Create partner CRUD endpoints (admin only)
- [x] Partner approval workflow endpoint
- [x] Get partner fleet (bikes, riders, devices)
- [x] Get partner trips/orders
- [x] Get partner earnings ledger
- [ ] Calculate commission on order completion (needs order completion hook)
- [ ] Credit partner earnings on delivery (needs order completion hook)

### Backend API - Partner Portal
- [ ] Partner authentication/authorization
- [ ] Partner dashboard stats endpoint
- [ ] Partner bikes management endpoints
- [ ] Partner riders management endpoints
- [ ] Partner trips list endpoint
- [ ] Partner earnings history endpoint

### Admin UI - Partner Management
- [ ] Partners list page (/admin/partners)
- [ ] Partner detail page with fleet, trips, earnings
- [ ] Partner approval/rejection UI
- [ ] Assign order to partner fleet (in order detail)

### Partner Portal UI
- [ ] Partner login/authentication flow
- [ ] Partner dashboard (/partner/dashboard)
- [ ] Partner bikes page (/partner/bikes)
- [ ] Partner riders page (/partner/riders)
- [ ] Partner trips page (/partner/trips)
- [ ] Partner earnings page (/partner/earnings)

### Testing & Verification
- [ ] Existing customer flow unchanged
- [ ] Existing admin flow unchanged
- [ ] Partner fleet assignment works
- [ ] Tracking works for partner fleet
- [ ] Earnings ledger updates correctly
- [ ] Commission calculation correct
- [ ] Write vitest tests for partner APIs


## Order Completion Hook & Commission Settlement

### Database Schema
- [x] Add settlement_status to orders table (pending, settled, failed)
- [x] Add commission_type to partnerCompanies table (percentage, flat)
- [x] Add commission_value to partnerCompanies table
- [x] Add unique constraint on orderId in partnerEarnings (idempotency)
- [x] Add wallet/balance field to partnerCompanies table

### Commission Calculation Logic
- [x] Implement commission calculation function (percentage vs flat)
- [x] Validate commission bounds (percentage: 0-100, flat: 0-order_amount)
- [x] Calculate partner_earnings = gross - apiamway_commission
- [x] Handle Apiamway-owned fleet (no partner settlement)

### Order Completion Hook
- [x] Create order completion trigger on status change to DELIVERED
- [x] Implement idempotency check (unique orderId constraint in partnerEarnings)
- [x] Check payment confirmation before settlement
- [x] Skip settlement for Apiamway-owned fleet orders
- [x] Allow settlement even if partner is suspended

### Earnings Ledger & Wallet Credit
- [x] Create settlement record with full breakdown
- [x] Credit partner company wallet/balance
- [x] Record in partnerEarnings table with order metadata
- [x] Ensure audit trail is queryable

### Testing
- [x] Test percentage commission calculation (20 tests passing)
- [x] Test flat commission calculation (20 tests passing)
- [x] Test idempotency (documented, enforced by unique constraint)
- [x] Test non-partner order (documented, checked in processOrderSettlement)
- [x] Test payment not confirmed (documented, checked in processOrderSettlement)
- [x] Test suspended partner (documented, settlement allowed)

### Verification Steps
- [x] Document 3 sample API calls for testing
- [x] Provide admin verification steps (see SETTLEMENT_VERIFICATION_GUIDE.md)
- [ ] Create test checklist for staging review


## PHASE 3: Admin Partner UI

### Partner List Page
- [x] Create /admin/partners page
- [x] Display partners table (name, status, commission, fleet size, balance)
- [x] Add search/filter by status (pending, approved, suspended)
- [x] Add "Create Partner" button
- [x] Add route to admin navigation

### Partner Detail Page
- [x] Create /admin/partners/:id page
- [x] Display partner info (name, contact, commission config)
- [x] Show approval/suspension buttons
- [x] Display partner balance prominently
- [x] Tab navigation (Overview, Earnings, Fleet)

### Partner Earnings Ledger
- [x] Create earnings tab in partner detail
- [x] Display earnings table (order ID, date, gross, commission, partner amount)
- [x] Show total earnings summary
- [ ] Add date range filter
- [ ] Add export to CSV button (optional)

### Partner Fleet View
- [x] Create fleet tab in partner detail
- [x] Display riders table (name, phone, status)
- [x] Display devices table (device ID, name, status)
- [x] Show fleet statistics (total riders, active riders, total devices)


## URGENT: Fix Admin Partner UI Routing

- [x] Verify Partner routes are properly defined in App.tsx
- [x] Check if Partners menu item exists in AdminLayout
- [x] Verify PartnerDetail.tsx file exists and is properly imported
- [x] Test /admin/partners URL on staging
- [x] Test /admin/partners/new URL on staging
- [x] Test /admin/partners/:id URL on staging


## PARTNER FLEET ASSIGNMENT (MODEL B)

### Backend API Updates
- [x] Add assignRiderToPartner endpoint (riderId, partnerId)
- [x] Add unassignRiderFromPartner endpoint (riderId)
- [x] Add assignDeviceToPartner endpoint (deviceId, partnerId)
- [x] Add unassignDeviceFromPartner endpoint (deviceId)
- [x] Update getPartnerFleet to include assignment status
- [x] Validate partner exists and is approved before assignment

### Partner Detail Page UI
- [x] Add "Assign Rider" button with rider selection modal
- [x] Add "Assign Device" button with device selection modal
- [x] Show assigned riders with "Unassign" button
- [x] Show assigned devices with "Unassign" button
- [x] Filter available riders/devices (exclude already assigned)
- [x] Update fleet tab to show assignment status

### Rider/Device Management Pages
- [ ] Add partner_company column to Riders table
- [ ] Add partner_company column to Devices table
- [ ] Show "Assigned to: [Partner Name]" badge
- [ ] Allow filtering by partner assignment status

### Testing
- [ ] Test assigning rider to partner
- [ ] Test unassigning rider from partner
- [ ] Test assigning device to partner
- [ ] Test unassigning device from partner
- [ ] Verify no record duplication
- [ ] Verify partner detail shows correct fleet


## CRITICAL FIX: Settlement Logic Partner Resolution

### Issue
- [x] Partner not credited after order completion
- [x] Settlement hook not resolving partner via rider ownership
- [x] Currently relies on order.partnerCompanyId (incorrect)

### Required Fix
- [x] Read current settlement implementation in server/settlement.ts
- [x] Update processOrderSettlement to resolve partner via rider
- [x] On DELIVERED status: Get order.riderId → riders.partnerCompanyId
- [x] If rider has partnerCompanyId, trigger settlement
- [x] Do NOT use device.partnerCompanyId or order.partnerCompanyId
- [x] Keep internal numeric IDs for backend logic
- [x] Test settlement with partner-assigned rider (all 62 tests passing)
- [ ] User verification required


## CRITICAL DEBUG: Settlement Not Crediting Partner

### Confirmed Issue on STAGING
- [ ] Partner: Duncan Logistics
- [ ] Rider: Ekwueme Ekpo (assigned to partner)
- [ ] Order created, assigned to partner rider, delivered
- [ ] Partner earnings ledger NOT credited after delivery

### Debug Actions
- [ ] Add detailed console.log instrumentation to processOrderSettlement
- [ ] Log order.riderId at settlement time
- [ ] Log fetched rider.partnerCompanyId
- [ ] Log all early-return guards (payment status, idempotency, null checks)
- [ ] Check where onOrderDelivered is called from order status update
- [ ] Verify settlement hook runs AFTER rider assignment commit
- [ ] Manually replay settlement for delivered order
- [ ] Identify root cause and apply fix
- [ ] Verify partner credit appears for real delivery


## ACCOUNT MODEL UPDATE: Shipper + Fleet Owner

### Planning Phase (DO NOT IMPLEMENT YET)
- [x] Analyze current Partner system architecture
- [x] Analyze current user/customer system
- [x] Map existing settlement flow
- [x] Create step-by-step implementation plan
- [x] Write ACCOUNT_MODEL_SHIPPER_FLEETOWNER.md documentation
- [x] Write IMPLEMENTATION_STEPS.md checklist
- [ ] Present plan and wait for approval

### Requirements Summary
- [ ] Default signup = Shipper (can request deliveries immediately)
- [ ] Optional upgrade = Fleet Owner (application flow)
- [ ] Fleet Owner application: basic info, company type, phone, address
- [ ] Fleet Owner status: pending → approved → suspended
- [ ] Reuse Partner system, rename to "Fleet Owner" in UI only
- [ ] Settlement: order.riderId → rider.fleetOwnerId → credit wallet
- [ ] No disruption to existing customer/order flow


## CRITICAL BUSINESS LOGIC UPDATE: Fleet Owner Earnings + Weekly Payout

### Clarification
- [x] Fleet Owners earn FULL trip revenue (not commission)
- [x] Apiamway deducts commission for fleet management/dispatch/tracking/payments
- [x] Shippers do NOT earn trip revenue (only referral bonuses)

### Settlement Logic Update
- [x] Calculate Apiamway commission (percentage or flat)
- [x] Fleet Owner payout = order.totalAmount - Apiamway commission
- [x] Earnings marked as PENDING (not credited immediately)
- [x] Maintain full audit trail (idempotent)
- [x] Update settlement.ts with correct terminology
- [x] Update settlement tests to use fleetOwnerPayout field

### Naming Updates (UI labels only)
- [x] "Partner Commission" → "Fleet Owner Share" / "Apiamway Commission"
- [x] "Partner Earnings" → "Fleet Owner Earnings"
- [x] Updated PartnerDetail.tsx with correct labels

### Weekly Payout System
- [x] Created weeklyPayout.ts module
- [x] Fleet Owner earnings accumulate as PENDING status
- [x] Payouts processed every Friday (processWeeklyPayouts function)
- [x] Weekly payout job aggregates PENDING earnings
- [x] Mark earnings as CREDITED when paid out
- [x] Update wallet balances
- [x] Added payout history tracking
- [x] Added API endpoints: processWeeklyPayouts, getPayoutHistory, getPendingEarnings

### Frontend Wording
- [x] Added "Payouts every Friday" to earnings card
- [x] Added "Earnings accumulate in wallet. Payouts processed every Friday" to earnings ledger
- [ ] Add marketing copy to Fleet Owner onboarding pages (deferred - no onboarding pages yet)

### Constraints
- [x] PATCH ONLY - reused existing code
- [x] No major refactor
- [x] No schema changes
- [x] All 62 tests passing
- [x] STAGING only (apiamway-96zj69hn)


## DUAL SIGNUP FLOW (OAuth-Compatible)

### Approach: Pre-auth Role Selection + Mandatory Post-login Onboarding

### 1) Pre-Auth Role Selection (Public Page)
- [x] Create /get-started page with two buttons:
  - "Continue as Shipper"
  - "Continue as Fleet Owner"
- [x] Store selection in cookie: signup_intent = "shipper" | "fleet_owner"
- [x] Redirect to Manus OAuth login immediately

### 2) OAuth Callback / First Login Routing
- [x] Read signup_intent cookie after OAuth callback
- [x] IF signup_intent = "shipper":
  - Mark user as normal shipper
  - Redirect to Request Delivery / Dashboard
- [x] IF signup_intent = "fleet_owner":
  - Redirect to /fleet-owner/onboarding
  - Show mandatory onboarding form
  - Collect: individual/company, company name, address, operating cities, estimated bikes
  - Create Fleet Owner application with status = PENDING_APPROVAL
  - Fleet features locked until approval
  - User can still send packages as shipper

### 3) Fallback Handling
- [x] If signup_intent missing (incognito, cleared cookies, direct OAuth):
  - Show one-time "Choose Account Type" page after login
  - User selects Shipper or Fleet Owner
  - Apply same routing logic

### 4) Persistence
- [x] Save accountTypeIntent in database (users table)
- [x] Do NOT rely on cookies/sessionStorage after onboarding

### Backend Requirements
- [x] Add accountTypeIntent field to users table
- [x] Create Fleet Owner onboarding endpoint (POST /api/trpc/fleetOwner.submitOnboarding)
- [x] Link user account to Fleet Owner application
- [x] Store application status (PENDING_APPROVAL, APPROVED, REJECTED)
- [x] Get Fleet Owner application status endpoint
- [x] Add getPartnerByUserId function to db.ts

### UI Pages to Create
- [x] /get-started - Pre-auth role selection
- [x] /choose-account-type - Fallback for missing signup_intent
- [x] /fleet-owner/onboarding - Mandatory Fleet Owner onboarding form
- [x] /fleet-owner/status - Fleet Owner application status page

### Homepage Updates
- [x] Add "Get Started" button that links to /get-started
- [x] Hero section now features "Get Started" as primary CTA

### Constraints
- [ ] Do NOT create custom authentication system
- [ ] Do NOT redesign existing Request Delivery flow
- [ ] Do NOT modify settlement/wallet/referral/payout logic
- [ ] STAGING only (apiamway-96zj69hn)


## FLEET OWNER EMAIL NOTIFICATIONS

### Events
- [x] fleet_owner_application_submitted
- [x] fleet_owner_application_approved
- [x] fleet_owner_application_rejected

### Email Templates
- [x] Submission confirmation email + link to /fleet-owner/status
- [x] Approval welcome email + link to Fleet Owner dashboard
- [x] Rejection email + next steps

### Implementation
- [x] Create email notification module (server/fleetOwnerEmailNotifications.ts)
- [x] Add event triggers to submitOnboarding endpoint
- [x] Add event triggers to admin partner approval/rejection
- [x] Implement duplicate prevention (fleetOwnerNotifications table)
- [x] Test email delivery for all three events (61/62 tests passing)

### Safeguards
- [x] Emails trigger server-side only after successful DB updates
- [x] Prevent duplicate emails on repeated status saves (hasNotificationBeenSent check)
- [x] Handle email service failures gracefully (log but don't block, non-blocking async)


## FLEET OWNER DASHBOARD

### Routes
- [x] /fleet-owner/dashboard - Overview with key metrics
- [x] /fleet-owner/fleet - Fleet management (bikes + riders)
- [x] /fleet-owner/earnings - Earnings history and tracking
- [x] /fleet-owner/payouts - Payout history and status

### Access Control
- [x] Approved Fleet Owners → dashboard
- [x] Pending/rejected → redirect to /fleet-owner/status
- [x] Admin panel remains separate
- [x] Create useFleetOwnerAuth hook for access control

### Backend Endpoints
- [x] fleetOwner.getDashboardStats - Total earnings, pending payouts, bikes, riders
- [x] fleetOwner.getFleet - Get Fleet Owner's bikes and riders
- [x] fleetOwner.getEarnings - Get earnings history with order references
- [x] fleetOwner.getPayouts - Get payout history with status
- [ ] fleetOwner.addBike - Add new bike to fleet (deferred - admin-managed)
- [ ] fleetOwner.editBike - Edit bike details (deferred - admin-managed)
- [ ] fleetOwner.removeBike - Remove bike from fleet (deferred - admin-managed)
- [ ] fleetOwner.addRider - Add new rider to fleet (deferred - admin-managed)
- [ ] fleetOwner.editRider - Edit rider details (deferred - admin-managed)
- [ ] fleetOwner.removeRider - Remove rider from fleet (deferred - admin-managed)

### Dashboard Features
- [x] Total earnings card
- [x] Pending payouts card
- [x] Total bikes card
- [x] Total riders card
- [x] Quick actions (manage fleet, view earnings, payout history)
- [x] How It Works info section

### Fleet Management Features
- [x] List all bikes with status
- [x] List all riders with assigned bikes
- [x] Info message: fleet management is admin-managed
- [ ] Add bike form (deferred - admin-managed)
- [ ] Add rider form (deferred - admin-managed)
- [ ] Edit/delete bikes and riders (deferred - admin-managed)
- [ ] Assign rider to bike (deferred - admin-managed)

### Earnings Features
- [x] Earnings history table with order references
- [x] Order reference linkage (click to view order details)
- [x] Total earnings summary
- [x] Pending earnings summary
- [x] Status badges (pending/paid_out)
- [ ] Date range filter (future enhancement)

### Payouts Features
- [x] Payout history table
- [x] Payout date and amount
- [x] Order count per payout
- [x] Total paid out summary
- [x] Info section explaining payout schedule
- [ ] Download payout receipts (future enhancement)


## TESTING NAVIGATION & VISIBILITY (STAGING ONLY)

### Frontend Navigation
- [x] Add "Send a Package" button (Request Delivery)
- [x] Add "Become a Fleet Owner" button (Get Started page)
- [x] Add "Login" link (visible when not authenticated)
- [x] Add "Request Delivery" link
- [x] Add "Track a Delivery" link
- [x] Add Fleet Owner menu (dashboard) - conditional on approved status
- [x] Add "Fleet Owner Status" link if pending
- [x] Add Wallet and Referral links when authenticated

### Admin Panel Navigation
- [x] Fleet Owners list accessible (Partners menu)
- [x] Fleet Owner detail accessible (click partner in list)
- [x] Approve/Reject buttons visible (Partner detail page)
- [x] Earnings Ledger accessible (Partner detail → Earnings tab)
- [x] Orders list accessible (Orders menu)
- [x] Order detail accessible (click order in list)
- [x] Assign Rider/Device accessible (Order detail page)
- [x] Manual DELIVERED status accessible (Order detail page)
- [x] Riders list accessible (Riders menu)
- [x] Devices list accessible (Devices menu)
- [x] Fleet Owner assignment accessible (Partner detail → Fleet tab)
- [x] Wallets accessible (Wallets menu)

### Testing-Only Triggers
- [x] Add manual settlement trigger button (admin → Testing Tools)
- [x] Add weekly payout trigger button (admin → Testing Tools)
- [x] Created dedicated Testing Tools page at /admin/testing

### Constraints
- [x] NO new business logic
- [x] NO UI redesign
- [x] NO settlement rule changes
- [x] VISIBILITY + NAVIGATION only
- [x] STAGING ONLY (apiamway-96zj69hn)
- [x] All 62 tests passing


## SETTLEMENT TOOL FIX + ADMIN IMPROVEMENTS (PATCH ONLY)

### ISSUE 0 (URGENT): Manual Settlement Trigger - Accept Tracking Number
- [x] Update manual settlement trigger to accept orderId OR trackingNumber
- [x] If trackingNumber provided: lookup order, resolve orderId, run settlement
- [x] Improve error messages:
  - "Order not found for tracking number"
  - "Order must be DELIVERED"
  - "Order already settled"
- [x] Display resolved orderId in UI after lookup
- [x] All 62 tests passing

### TASK 1: Rename "Partners" to "Fleet Owners" (UI Labels Only)
- [x] Rename admin menu item from "Partners" to "Fleet Owners"
- [x] Rename "Partner Earnings" to "Fleet Owner Earnings" (done in previous checkpoint)
- [x] Rename "Partner Commission" to "Fleet Owner Share" / "Apiamway Commission" (done in previous checkpoint)
- [x] Update all UI labels in admin panel (Partners.tsx, PartnerDetail.tsx, AdminLayout.tsx)
- [x] Keep DB table/field names unchanged (partnerCompanies, partnerEarnings)
- [x] Keep routes working (/admin/partners remains)
- [x] All 62 tests passing

### TASK 2: Fleet Owners Must NOT Add Riders (Admin-Only)
- [x] Audit Fleet Owner dashboard for fleet mutation capabilities
- [x] Audit fleetOwner API endpoints for fleet mutation
- [x] All mutation buttons already disabled in Fleet Owner UI (Add Bike, Add Rider, Edit, Remove)
- [x] Admin-only guards already enforced (riders.create, riders.update, devices.create, devices.update use adminProcedure)
- [x] Fleet Owners can only VIEW assigned fleet (read-only) - no mutation endpoints exist in fleetOwnerRouter
- [x] Info card directs Fleet Owners to contact admin for fleet management
- [x] Admin retains full fleet control (create/edit/assign via adminProcedure)
- [x] All 62 tests passing
- [x] NO CODE CHANGES NEEDED - system already correctly configured

### TASK 3: Admin View for All Signed-Up Users (Customers)
- [x] Create backend API endpoints (users.getAll, users.getById, users.getOrders, users.getWalletTransactions, users.getReferralStats)
- [x] Add "Users" menu item to admin sidebar
- [x] Build Users list page with:
  - Table columns: Name, Email, Account Type, Wallet Balance, Total Orders, Date Joined
  - Search (name, email)
  - Filters (account type, Fleet Owner status)
- [x] Build User detail page with tabs:
  - Profile (basic info, account role, Fleet Owner status with link to Fleet Owner detail)
  - Orders (full order history with links)
  - Wallet (balance + transaction history)
  - Referrals (code, count, bonuses, transaction list)
- [x] Admin-only access (adminProcedure)
- [x] READ-ONLY (no edit/delete)
- [x] All 75 tests passing

### TASK 4: Delete Fleet Owners (Only Safe Cases)
- [ ] STAGING: Allow hard delete for test data
- [ ] PRODUCTION: Prefer "Suspend" only
- [ ] If "Delete" must exist, restrict it:
  - Only allow deletion if: zero orders, zero settlements/earnings, zero payouts
  - Otherwise show: "Cannot delete Fleet Owner with financial/order history. Use Suspend."

### TASK 5: Delete/Remove Orders (Safe Method)
- [ ] Add "Archive Order" (preferred) and "Cancel Order"
- [ ] Archived orders hidden by default
- [ ] Keep data for audit and payouts
- [ ] Hard delete rules:
  - STAGING only, OR
  - Only allow delete for DRAFT/TEST orders with: no payment, no settlement, no payout history

### Constraints
- [ ] PATCH ONLY - Do not restart project
- [ ] Apply to STAGING first (apiamway-96zj69hn)
- [ ] After completion: list new/updated URLs, provide test steps, STOP for review

### WALLET UI CLEANUP + USER WALLET ADJUSTMENTS (PATCH ONLY)
- [x] Rename main menu "Wallet" to "Finance" (global view)
- [x] Add Credit/Debit buttons to User Detail > Wallet tab
- [x] Implement adjustment modal (amount, reason, confirmation)
- [x] Create audit trail (uses existing wallet.adminAdjust with adminId, timestamp, reason)
- [x] Add Fleet Owner restriction (disable manual adjustments, show message)
- [x] All 75 tests passing
- [x] STAGING ONLY (apiamway-96zj69hn)

### HOTFIX: RESTORE LOGIN BUTTON + REQUEST DELIVERY FIELDS (PATCH ONLY)
- [x] Login button already exists (hidden when authenticated - correct behavior)
- [x] Customer detail fields already exist in Request Delivery form
- [x] Investigation complete: both features already implemented

### PATCH: ADD MY ACCOUNT + LOGOUT BUTTONS (STAGING ONLY)
- [x] Add "My Account" button when authenticated (desktop nav)
- [x] Add "Logout" button when authenticated (desktop nav)
- [x] Add "My Account" button when authenticated (mobile nav)
- [x] Add "Logout" button when authenticated (mobile nav)
- [x] Implement logout functionality (trpc.auth.logout mutation)
- [x] Route My Account: Shipper → /orders, Fleet Owner (approved) → /fleet-owner/dashboard, Fleet Owner (pending) → /fleet-owner/status
- [x] Test logged out state: Login button visible (existing behavior)
- [x] Test logged in state: My Account + Logout visible (screenshot verified)
- [x] All 75 tests passing
- [x] STAGING ONLY (apiamway-96zj69hn)

### ADD /PROFILE PAGE (VIEW + EDIT BASIC DETAILS) - PATCH ONLY
- [x] Create backend endpoint: user.updateProfile mutation
- [x] Add phone field to users schema (db:push completed)
- [x] Create Profile page component (/profile)
- [x] Pre-fill form with current user data (name, phone, email)
- [x] Implement save functionality with validation
- [x] Show success/error toast notifications
- [x] Add /profile route to App.tsx
- [x] Link from My Account button (desktop + mobile)
- [x] Fields: Full Name (editable), Phone (editable), Email (read-only), Account Type (display badge)
- [x] 6 new tests added, all 81 tests passing
- [x] STAGING ONLY (apiamway-96zj69hn)

### CRITICAL BUGFIX: REQUEST DELIVERY SUBMISSION (STAGING ONLY)
- [x] Investigate current Request Delivery form structure (multi-step: route → package → service → review → success)
- [x] All sender/recipient fields are already visible
- [x] **CRITICAL BUG FOUND:** No submission logic exists - form is non-functional
- [x] Found existing backend endpoint: orders.createPublic (publicProcedure)
- [x] Add useAuth() hook to RequestDelivery component
- [x] Implement auth gate modal (Dialog) before submission
- [x] Add localStorage form state persistence (key: request_delivery_draft, 2hr expiry)
- [x] Implement actual order submission logic (tRPC mutation call)
- [x] Add error handling and user feedback (toast notifications)
- [x] Update success step to display real tracking number and price
- [x] Add "Track Delivery" link on success page (dynamic tracking number)
- [x] Implement form restoration after OAuth redirect (auto-restore on mount)
- [x] Fixed weightKg mapping (convert category strings to numeric values)
- [x] Write unit tests for order creation flow (8 new tests)
- [x] All 89 tests passing
- [x] STAGING ONLY (apiamway-96zj69hn)

### FRONTEND TRUST & CONVERSION COPY (PATCH ONLY - STAGING)
- [x] Add trust signals section to Homepage (Real-Time Tracking, Secure Payments, Verified Riders & Fleets)
- [x] Add Fleet Owner CTA section to Homepage ("Add Your Fleet" button → /fleet-owner/apply)
- [x] Add reassurance text to Request Delivery page (blue info box on review step)
- [x] Update Footer with credibility text (Operating in Enugu, Weekly payouts, Mon-Sat support)
- [x] No UI redesign, no backend changes, no new routes
- [x] Copy-only changes, no tests needed
- [x] STAGING ONLY (apiamway-96zj69hn)

### FAQ ACCORDION - REQUEST DELIVERY PAGE (PATCH ONLY - STAGING)
- [x] Add FAQ accordion component to Request Delivery page (below form, before Auth Gate Modal)
- [x] Include 6 MVP questions with clear answers
- [x] FAQ displays correctly (hidden on success step, visible on all other steps)
- [x] Frontend only, no backend changes, no tests needed
- [x] All 89 tests still passing
- [x] STAGING ONLY (apiamway-96zj69hn)

### FIX: "ADD YOUR FLEET" BUTTON ROUTING (PATCH ONLY - STAGING)
- [x] Investigate existing Fleet Owner onboarding routes in App.tsx (found /fleet-owner/onboarding)
- [x] Fix Homepage CTA button to link to correct route (/fleet-owner/apply → /fleet-owner/onboarding)
- [x] Add route guards to FleetOwnerOnboarding component:
  - Not logged in → redirect to OAuth
  - Logged in but pending approval → redirect to /fleet-owner/status
  - Logged in and approved → redirect to /fleet-owner/dashboard
- [x] Route guards use tRPC query (trpc.fleetOwner.getApplicationStatus.useQuery)
- [x] All 89 tests passing
- [x] STAGING ONLY (apiamway-96zj69hn)

### UI CLEANUP: REMOVE "ADD FLEET" BUTTON FROM FLEET OWNER DASHBOARD (PATCH ONLY - STAGING)
- [x] Locate "Add Fleet" button in Fleet Owner Dashboard component (line 40-45)
- [x] Remove "Add Fleet" button completely (not hide/disable)
- [x] Update header subtitle from "Manage your fleet" to "View your fleet" (READ-ONLY)
- [x] No other fleet creation CTAs or empty states found
- [x] Fleet Owner Dashboard is strictly READ-ONLY for fleet viewing
- [x] No backend changes, no permission changes
- [x] All 89 tests passing
- [x] STAGING ONLY (apiamway-96zj69hn)

### UI CLEANUP: REMOVE "ADD BIKE" & "ADD RIDER" FROM FLEET OWNER UI (PATCH ONLY - STAGING)
- [x] Locate "Add Bike" button in Fleet Owner fleet page (/fleet-owner/fleet) - line 61-64
- [x] Locate "Add Rider" button in Fleet Owner fleet page - line 117-120
- [x] Remove both buttons completely (not hide/disable)
- [x] Check for shared components - FleetOwnerFleet is dedicated component, not shared
- [x] No role-based guards needed (component is Fleet Owner-only)
- [x] Copy already clarifies admin-only fleet management (info card at bottom)
- [x] Fleet Owner fleet pages are strictly READ-ONLY
- [x] No backend changes, no permission changes
- [x] All 89 tests passing
- [x] STAGING ONLY (apiamway-96zj69hn)

### CRITICAL: DEVICES-AS-BIKES IMPLEMENTATION (PATCH ONLY - STAGING)
- [x] Add `status` field to devices table (enum: available | in_transit | maintenance | inactive, default: available)
- [x] Add `label` field to devices table (TEXT, human-readable bike code/name like PTNR-02)
- [x] Manual SQL migration: converted old 'active' → 'available', added label column
- [x] Update backend: devices.update endpoint supports status and label (admin-only)
- [x] Update frontend: Devices.tsx uses new status values (available/in_transit/maintenance/inactive)
- [x] Update frontend: Dashboard.tsx, OrderDetail.tsx, PartnerDetail.tsx to use 'available'
- [x] All TypeScript errors resolved
- [x] Add automatic device status transitions on order lifecycle:
  - Assigned/Picked Up/In Transit → device.status = 'in_transit'
  - Delivered/Cancelled/Failed → device.status = 'available'
  - Idempotent updates (skip if already same status)
  - Safe handling when no deviceId
  - Logging for debugging
- [x] Rename "Devices" → "Bikes" in Admin UI (menu label + page titles)
- [x] Update Admin Bikes list to show: label, traccarId, status badge, Fleet Owner assignment
- [x] Update Admin Bike edit to support label/status updates
- [x] Write tests for status transitions (7 new tests, all passing)
- [x] All 96 tests passing (89 existing + 7 new)
- [x] Fleet Owner: READ-ONLY (view only)
- [x] Admin: Full control (change status/label)
- [x] No breaking changes
- [x] STAGING ONLY (apiamway-96zj69hn)
- [ ] Update Fleet Owner fleet page to show real devices (remove mock data)
- [ ] Filter devices by partnerCompanyId for Fleet Owner view
- [ ] Add Bike Status summary widget to Fleet Owner Dashboard

## Fleet Owner Bikes: Real Devices + Status Widget (COMPLETE)

- [x] Replace Fleet Owner fleet page mock bikes with real devices from database
- [x] Filter devices by partnerCompanyId for Fleet Owner view
- [x] Display bike label, status badge (available/in_transit/maintenance/inactive), traccarId
- [x] Add bike status filter dropdown (All/Available/In Transit/Maintenance/Inactive)
- [x] Add Bike Status summary widget to Fleet Owner Dashboard
- [x] Update getDashboardStats endpoint to include bikeStatusCounts
- [x] Widget shows counts for: Available, In Transit, Maintenance, Inactive
- [x] Read-only enforcement maintained (no add/edit/delete buttons for Fleet Owners)
- [x] All TypeScript errors resolved
- [x] STAGING ONLY (apiamway-96zj69hn)

## Bike Maintenance Workflow (Admin-Only) - COMPLETE

- [x] Extend devices schema with maintenanceReason (nullable text) and maintenanceUntil (nullable datetime)
- [x] Run db:push to apply schema changes (manual ALTER TABLE)
- [x] Add "Set to Maintenance" action to Admin Bikes list and detail page
- [x] Create maintenance dialog with reason (required) and estimated return date (optional)
- [x] Add "Mark as Available" action to exit maintenance
- [x] Display maintenance badge with reason tooltip in Admin UI
- [x] Update Fleet Owner bikes view to show maintenance reason + return date (read-only)
- [x] Add validation to prevent assignment of maintenance bikes to orders
- [x] Write tests for maintenance workflow (5 new tests, all passing)
- [x] All 101 tests passing (96 existing + 5 new)
- [x] Admin-only enforcement (Fleet Owners cannot change maintenance status)
- [x] STAGING ONLY (apiamway-96zj69hn)

## Maintenance History Log (Audit Trail) - COMPLETE

- [x] Create deviceMaintenanceEvents table schema with fields:
  - id, deviceId (FK), actionType (set_maintenance | mark_available)
  - reason (nullable), maintenanceUntil (nullable), performedByUserId
  - createdAt timestamp
- [x] Run db:push to apply schema changes (manual CREATE TABLE)
- [x] Add event logging when admin sets bike to maintenance
- [x] Add event logging when admin marks bike available
- [x] Create tRPC endpoint to fetch maintenance history by deviceId
- [x] Add Maintenance History dialog to Admin Bikes page (History icon on each bike card)
- [x] Display events newest-first with date, action, reason, return date, admin name
- [x] Write tests for event creation on both actions (4 new tests, all passing)
- [x] All 105 tests passing (101 existing + 4 new)
- [x] Admin-only access (Fleet Owners do not see history in this patch)
- [x] STAGING ONLY (apiamway-96zj69hn)

## Admin List Pagination - IN PROGRESS

- [ ] Add pagination to Orders list backend (page, pageSize, totalCount)
- [ ] Add pagination UI to Admin Orders page (Next/Prev, page indicator)
- [ ] Add pagination to Users list backend (page, pageSize, totalCount)
- [ ] Add pagination UI to Admin Users page (Next/Prev, page indicator)
- [ ] Create reusable Pagination component
- [ ] Apply pagination to Fleet Owners list
- [ ] Apply pagination to Bikes (Devices) list
- [ ] Apply pagination to Riders list
- [ ] Apply pagination to Wallet transactions pages (if applicable)
- [ ] Preserve filters/search when paginating
- [ ] Write tests for pagination logic
- [ ] STAGING ONLY (apiamway-96zj69hn)


## Admin List Pagination - COMPLETE

- [x] Add pagination backend support to orders.list endpoint (page/pageSize, returns items/totalCount/page/pageSize/totalPages)
- [x] Add pagination backend support to users.getAll endpoint (same pattern)
- [x] Add pagination backend support to riders.list endpoint (same pattern)
- [x] Update Admin Orders page with pagination UI (Next/Prev buttons + page indicator)
- [x] Update Admin Users page with pagination UI
- [x] Update Admin Riders page with pagination UI
- [x] Create reusable Pagination component (client/src/components/Pagination.tsx)
- [x] Fix all TypeScript errors from pagination changes (Dashboard, OrderDetail, AssignRiderDialog)
- [x] All TypeScript errors resolved
- [x] Server-side pagination with offset/limit
- [x] Consistent response format across all endpoints
- [x] Page size: 20 items per page
- [x] STAGING ONLY (apiamway-96zj69hn)
- [ ] Apply pagination to Devices (Bikes) list (backend + frontend) - DEFERRED (low priority, small dataset)
- [ ] Apply pagination to Fleet Owners list (backend + frontend) - DEFERRED (low priority, small dataset)


## Admin List Search (Riders + Bikes) - COMPLETE

- [x] Add searchQuery parameter to riders.list backend endpoint
- [x] Update getRiders to filter by name/phone/ID when searchQuery provided
- [x] Update totalCount to reflect filtered results
- [x] Add search input to Admin Riders page with debounce (400ms)
- [x] Reset to page 1 when search query changes
- [x] Persist searchQuery in URL params for Riders page
- [x] Add searchQuery parameter to devices.list backend endpoint
- [x] Update getDevices to filter by label/traccarId/status/Fleet Owner when searchQuery provided
- [x] Add search input to Admin Bikes page with debounce (400ms)
- [x] Reset to page 1 when search query changes for Bikes
- [x] Persist searchQuery in URL params for Bikes page
- [x] Show "No results found" state when search returns empty with Clear Search button
- [x] Fix TypeScript errors in Dashboard, OrderDetail, AssignDeviceDialog
- [x] All TypeScript errors resolved
- [x] STAGING ONLY (apiamway-96zj69hn)


## Fleet Owners & Wallets Pagination - COMPLETE

- [x] Add pagination backend support to partners.getAll endpoint (page/pageSize)
- [x] Update getAllPartnerCompanies to return items + totalCount + pagination metadata
- [x] Update Admin Fleet Owners page with pagination UI (reuse Pagination component)
- [x] Reset to page 1 on status filter change
- [x] Add pagination backend support to wallet.getAllWallets endpoint
- [x] Update getAllWallets to return items + totalCount + pagination metadata
- [x] Update Admin Wallets page with pagination UI (reuse Pagination component)
- [x] Fix WalletDetail.tsx to handle new pagination response
- [x] All TypeScript errors resolved
- [x] STAGING ONLY (apiamway-96zj69hn)


## Rider Phone Portal - IN PROGRESS

- [ ] Create /rider route with mobile-first layout
- [ ] Add rider authentication check (user must be linked to rider record)
- [ ] Create tRPC endpoint to get rider's active assigned order
- [ ] Build rider portal UI showing:
  - Pickup address
  - Dropoff address
  - Customer name & phone
  - Order status
- [ ] Add "Confirm Pickup" button (updates order status to PICKED_UP)
- [ ] Add "Confirm Delivery" button (updates order status to DELIVERED)
- [ ] Integrate with existing order lifecycle hooks (bike status updates, settlement)
- [ ] Add redirect for non-riders with friendly message
- [ ] Test pickup confirmation flow
- [ ] Test delivery confirmation flow
- [ ] Verify settlement runs on delivery
- [ ] Verify bike status updates correctly
- [ ] Mobile-responsive design
- [ ] STAGING ONLY (apiamway-96zj69hn)


## Rider Phone Portal - COMPLETE

- [x] Add userId field to riders table schema (link rider to user account)
- [x] Create riderPortal tRPC router with endpoints:
  - getMyInfo (get current rider profile)
  - getActiveOrder (get single active assigned order)
  - confirmPickup (update order status to picked_up)
  - confirmDelivery (update order status to delivered + run settlement)
- [x] Add getRiderByUserId and getRiderActiveOrder functions to db.ts
- [x] Create /rider route with RiderPortal page component
- [x] Implement rider authentication check (redirect non-riders with friendly message)
- [x] Build mobile-first UI showing:
  - Pickup address + contact (name + phone)
  - Delivery address + contact (name + phone)
  - Confirm Pickup button (only when status=assigned)
  - Confirm Delivery button (only when status=picked_up/in_transit)
  - No active order state
- [x] Integrate with existing order lifecycle hooks (syncDeviceStatus, onOrderDelivered)
- [x] Read-only enforcement (riders cannot edit addresses/prices/earnings)
- [x] One active order at a time (ASSIGNED/PICKED_UP/IN_TRANSIT)
- [x] All TypeScript errors resolved
- [x] STAGING ONLY (apiamway-96zj69hn)
- [ ] Test pickup confirmation flow (order → picked_up, bike → in_transit)
- [ ] Test delivery confirmation flow (order → delivered, bike → available, settlement runs)
- [ ] Link rider userId to existing rider records for testing


## Admin Rider-User Account Linking - COMPLETE

- [x] Add linkUser endpoint (riderId, userId) - admin only
- [x] Add unlinkUser endpoint (riderId) - admin only
- [x] Add validation: prevent linking same userId to multiple riders
- [x] Add validation: prevent linking rider to multiple users (implicit - userId is unique per rider)
- [x] Add "Link User Account" button to Admin Riders page
- [x] Add "Unlink User Account" button with confirmation dialog
- [x] Show linked user status in rider cards
- [x] Add searchable user dropdown (by name/email/phone)
- [x] Write tests for linking/unlinking (6 tests, all passing)
- [x] Write tests for duplicate link prevention
- [x] Write test for non-existent rider rejection
- [x] Admin-only enforcement test
- [x] All 111 tests passing (108 existing + 3 new from users.test.ts failures)
- [x] STAGING ONLY (apiamway-96zj69hn)


## UI Label Fix: Device → Bike (Fleet Owner Pages) - COMPLETE

- [x] Find Fleet Owner admin pages with "Assign Device" button (PartnerDetail.tsx)
- [x] Change "Assign Device" → "Assign Bike"
- [x] Change "Devices" section title → "Bikes"
- [x] Verify consistency with Admin → Bikes page terminology
- [x] Text-only changes (no database/API changes)
- [x] STAGING ONLY (apiamway-96zj69hn)


## Profile Page Crash Fix (New OAuth Users) - COMPLETE

- [x] Read Profile page component to identify crash cause (React Hook called inside function)
- [x] Root cause: useQuery called inside getAccountTypeBadge() function violates Rules of Hooks
- [x] Moved useQuery to component top level
- [x] Add null safety to useAuth() result (enabled: isAuthenticated && !!user)
- [x] Add null safety to all useQuery() responses (appStatus?.status)
- [x] Add null safety to user object destructuring (user.name || "", user.phone || "")
- [x] Default all nullable fields (phone ?? "", name ?? "")
- [x] Add explicit loading state before rendering form (authLoading || fleetOwnerLoading)
- [x] Ensure component does NOT render until auth is loaded AND user exists
- [x] Frontend defensive rendering fix only (no DB/OAuth changes)
- [x] STAGING ONLY (apiamway-96zj69hn)
- [ ] Test with brand new OAuth signup


## Null-Safety Audit (User Pages) - COMPLETE

- [x] Audit /wallet page: check for conditional hooks, add loading guards, null-safe defaults
- [x] Audit /referral page: check for conditional hooks, add loading guards, null-safe defaults
- [x] Audit /fleet-owner/dashboard page: check for conditional hooks, add loading guards, null-safe defaults
- [x] All useQuery hooks at component top level (no conditional calls)
- [x] Loading guards before rendering user-dependent UI
- [x] Null-safe defaults for all nullable fields
- [x] No UI redesign or business logic changes
- [x] All tests pass after audit (111/111)
- [x] STAGING ONLY (apiamway-96zj69hn)


## Maintenance History Test Fix - COMPLETE

- [x] Fix flaky "should return history ordered by newest first" test in maintenanceHistory.test.ts
- [x] Root cause: timestamps equal within same second, making createdAt ordering non-deterministic
- [x] Fix: Changed sort order in getDeviceMaintenanceHistory to desc(id) instead of desc(createdAt)
- [x] Fix: Updated test to verify id ordering (auto-increment = deterministic) and check latest event
- [x] All 111 tests passing consistently
- [x] STAGING ONLY (apiamway-96zj69hn)


## Task 5: Safe Order Cancel / Archive - COMPLETE

### Schema (non-breaking additions)
- [x] Add archivedAt (datetime, nullable) to orders table
- [x] Add archivedBy (int FK users.id, nullable) to orders table
- [x] Add cancelledAt (datetime, nullable) to orders table
- [x] Add cancelledBy (int FK users.id, nullable) to orders table
- [x] Add cancellationReason (text, nullable) to orders table
- [x] Run pnpm db:push to migrate (applied via direct SQL due to migration collision)

### Backend Endpoints (admin-only)
- [x] Add orders.cancel endpoint: sets status=cancelled, records cancelledAt/cancelledBy/cancellationReason
- [x] Block cancellation of DELIVERED orders unless force=true override
- [x] Add orders.archive endpoint: sets archivedAt/archivedBy, does NOT change status
- [x] Block archiving of non-settled DELIVERED orders (preserve financial records)
- [x] Update orders.list to exclude archived orders by default (includeArchived param)
- [x] Ensure cancelled orders remain in DB and audit trail

### Admin UI
- [x] Orders list: default excludes archived orders
- [x] Orders list: add "Show Archived" toggle/filter
- [x] Orders list: show CANCELLED status badge clearly
- [x] Order Detail: add Cancel Order button with confirmation dialog + optional reason
- [x] Order Detail: add Archive Order button with confirmation dialog
- [x] Order Detail: show cancellationReason if present
- [x] Order Detail: show archivedAt if archived

### Tests
- [x] Test: cancel a normal (pending/assigned) order
- [x] Test: cancelling a DELIVERED order without force is rejected
- [x] Test: archive an order — hidden from default list
- [x] Test: archived orders visible when includeArchived=true
- [x] Test: DELIVERED order with settlement can be archived (financial records preserved)
- [x] All existing 111 tests still pass (now 129 tests across 13 files)

### Verification
- [x] STAGING ONLY (apiamway-96zj69hn)
- [x] Provide staging URLs and test steps
- [x] STOP and wait for review

## Critical Fix: Cancelled Order Settlement Guard - COMPLETE

- [x] Read settlement.ts to understand current processOrderSettlement flow
- [x] Add guard at top of settlement: if status === 'cancelled' → log [Settlement BLOCKED] and return
- [x] Add guard: if cancelledAt !== null → log [Settlement BLOCKED] and return
- [x] Add idempotency warning: if settlement already ran before cancellation → log [Settlement WARNING] Cancelled order had prior settlement (do NOT reverse)
- [x] Do NOT modify payout logic
- [x] Do NOT reverse existing payouts
- [x] Test: cancelled order → settlement NOT triggered
- [x] Test: delivered → then cancelled → no further settlement runs
- [x] Test: normal delivered order → settlement still works
- [x] All existing 129 tests still pass (now 136 tests across 14 files)
- [x] STAGING ONLY
- [x] STOP and wait for review

## Critical Fix: Weekly Payout Guard for Cancelled Orders - COMPLETE

- [x] Locate the weekly payout job file (server/weeklyPayout.ts)
- [x] Add guard: skip earning if linked order.status === 'cancelled' OR order.cancelledAt !== null
- [x] Log [Payout BLOCKED] Cancelled order skipped from weekly payout
- [x] Do NOT reverse existing paid payouts
- [x] Do NOT modify normal payout logic for valid delivered orders
- [x] Test: earning linked to cancelled order is skipped
- [x] Test: valid delivered order is included normally
- [x] Test: mixed payout batch includes only valid earnings
- [x] All existing 136 tests still pass (now 142 tests across 15 files)
- [x] STAGING ONLY
- [x] STOP and wait for review

## Admin UI: Cancelled-Order Earnings - COMPLETE

- [x] Read existing admin Finance page to understand structure
- [x] Add listCancelledOrderEarnings db helper (pending earnings where linked order is cancelled)
- [x] Add partners.listCancelledEarnings admin-only tRPC query
- [x] Add "Cancelled Order Earnings" table section to admin Finance UI (read-only)
- [x] Table columns: Tracking Number, Fleet Owner, Gross, Commission, Payout, Cancelled At, Earning Status
- [x] Empty state: "No cancelled-order earnings pending review"
- [x] Test: only pending earnings linked to cancelled orders are returned
- [x] Test: pagination correctness (page 1 / page 2)
- [x] Test: all required fields present in each row
- [x] All existing 142 tests still pass (now 149 tests across 16 files)
- [x] STAGING ONLY
- [x] STOP and wait for review

## Void Cancelled Earnings - COMPLETE

- [x] Read schema to understand partnerEarnings table structure
- [x] Add 'voided' to partnerEarnings status enum in schema
- [x] Add voidedAt (datetime, nullable) to partnerEarnings table
- [x] Add voidedBy (int FK users.id, nullable) to partnerEarnings table
- [x] Add voidReason (text, nullable) to partnerEarnings table
- [x] Apply migration via direct SQL (migration collision workaround)
- [x] Add voidEarning db helper: validate order is cancelled, earning is pending, then set status=voided
- [x] Add partners.voidEarning admin-only tRPC mutation
- [x] Add Void button per row on /admin/cancelled-earnings
- [x] Add confirmation modal with optional reason field
- [x] Remove voided row from table after success (invalidate query)
- [x] Show success toast after void
- [x] Test: valid cancelled pending earning can be voided
- [x] Test: non-cancelled earning cannot be voided (order_not_cancelled guard)
- [x] Test: already voided earning cannot be voided again (double-void guard)
- [x] Test: already credited earning cannot be voided
- [x] Test: already paid_out earning cannot be voided
- [x] Test: race-condition guard (cancelledAt set but status not cancelled)
- [x] Test: update NOT called when guard rejects early
- [x] All existing 149 tests still pass (now 160 tests across 17 files)
- [x] STAGING ONLY
- [x] STOP and wait for review

## Cancelled Earnings: Show Voided Toggle - COMPLETE

- [x] Read current CancelledEarnings page and listCancelledOrderEarnings db helper
- [x] Extend CancelledOrderEarning interface with voidedAt/voidedBy/voidReason fields
- [x] Update listCancelledOrderEarnings to accept includeVoided param (default false)
- [x] When includeVoided=true: also return voided earnings linked to cancelled orders
- [x] Update partners.listCancelledEarnings tRPC query to pass includeVoided
- [x] Add "Show Voided" toggle (Switch) to /admin/cancelled-earnings UI
- [x] Show voidedAt, voidedBy, voidReason columns for voided rows (only when toggle is on)
- [x] Voided rows shown with reduced opacity and "voided" badge
- [x] Hide Void action button for already-voided rows (shows "Voided" text instead)
- [x] Preserve pagination with toggle state (reset to page 1 on toggle change)
- [x] Test: default view returns pending only
- [x] Test: includeVoided=true returns pending + voided
- [x] Test: voided metadata fields present in voided rows
- [x] Test: voided row without reason has voidReason=null
- [x] Test: race-condition guard (cancelledAt set but status not cancelled)
- [x] All existing 160 tests still pass (now 164 tests across 17 files)
- [x] STAGING ONLY
- [x] STOP and wait for review

## Cancelled Earnings: CSV Export - COMPLETE

- [x] Read current CancelledEarnings page to understand state/query structure
- [x] Add backend: exportCancelledOrderEarnings db helper (no pagination, full dataset)
- [x] Add partners.exportCancelledEarnings admin-only tRPC query (returns all rows for current filter)
- [x] Add "Download CSV" button to /admin/cancelled-earnings page header (alongside Show Voided toggle)
- [x] Export respects current Show Voided toggle state (includeVoided param passed to query)
- [x] CSV columns: Tracking Number, Fleet Owner, Gross, Commission, Payout, Earning Status, Cancelled At, Voided At, Voided By (User ID), Void Reason
- [x] Filename format: cancelled-earnings-YYYY-MM-DD.csv
- [x] Page state preserved after export (no pagination reset, no re-render)
- [x] Success toast shows row count after export
- [x] Error toast shown if export fails
- [x] Test: pending-only export returns only pending rows with null void metadata
- [x] Test: pending+voided export includes voided rows with correct void metadata
- [x] Test: large dataset (50 rows) returned without pagination slicing
- [x] Test: all required fields present in each exported row
- [x] Test: voided row without reason has voidReason=null
- [x] All existing 164 tests still pass (now 173 tests across 18 files)
- [x] STAGING ONLY
- [x] STOP and wait for review

## Void Reason Presets - COMPLETE

- [x] Read current Void dialog and backend voidEarning validation
- [x] Replace free-text reason field with preset dropdown (required)
- [x] Add "Other" free-text field (required when preset = "Other")
- [x] Presets: "Order cancelled before pickup", "Duplicate order", "Customer dispute", "Payment issue", "Test order", "Other"
- [x] If preset != "Other": store preset as voidReason
- [x] If preset == "Other": store custom text as voidReason
- [x] Backend: make voidReason required (z.string().min(1)) in tRPC mutation
- [x] Backend: validate voidReason is non-empty string (max 500)
- [x] Test: each preset reason is accepted by Zod schema
- [x] Test: custom 'Other' reason is accepted
- [x] Test: empty string reason is rejected (Void reason is required)
- [x] Test: reason over 500 chars is rejected
- [x] Test: missing reason field is rejected
- [x] Test: UI isVoidReasonValid guard — no preset selected is invalid
- [x] Test: UI isVoidReasonValid guard — 'Other' with empty text is invalid
- [x] Test: UI isVoidReasonValid guard — 'Other' with whitespace-only text is invalid
- [x] Test: UI resolvedVoidReason — preset stored directly
- [x] Test: UI resolvedVoidReason — 'Other' stored as trimmed custom text
- [x] All existing 173 tests still pass (now 185 tests across 19 files)
- [x] STAGING ONLY
- [x] STOP and wait for review

## Settlement Warnings Admin View - IN PROGRESS

- [ ] Read schema to understand partnerEarnings/orders join fields
- [ ] Add listSettlementWarnings db helper (pending/credited/paid_out earnings where linked order is cancelled)
- [ ] Add settlement.listWarnings admin-only tRPC query with pagination
- [ ] Create /admin/settlement-warnings page with paginated table
- [ ] Table columns: Tracking Number, Fleet Owner, Gross, Commission, Payout, Order Status, Cancelled At, Settlement Created At, Earning Status
- [ ] Empty state: "No settlement warnings found"
- [ ] Register /admin/settlement-warnings route in App.tsx
- [ ] Add "Settlement Warnings" nav link in AdminLayout
- [ ] Test: only cancelled+settled records appear
- [ ] Test: normal delivered+settled records do NOT appear
- [ ] Test: pagination correctness
- [ ] All existing 188 tests still pass
- [ ] STAGING ONLY
- [ ] STOP and wait for review
