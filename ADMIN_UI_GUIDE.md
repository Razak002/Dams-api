# DÁMS Admin Dashboard — UI Architecture & Implementation Guide

A practical blueprint for building the DÁMS Admin interfaces against `/api/v1/admin/*` (see [ADMIN_API_DOCS.md](file:///c:/Users/AbdulRazak/Desktop/dams-api/ADMIN_API_DOCS.md)).

---

## 1. Auth, Session & Role-Based Navigation

### Login & Session Bootstrapping
- **Single Unified Login (`/login`):**
  - Form: `email`, `password` → `POST /api/v1/auth/login` with `credentials: 'include'`.
  - Sets `dams_session` cookie and returns `{ token, user }` including `user.role` and `user.permissions`:
    - If `user.role === 'CUSTOMER'`, redirect to `/account` (or `/`); block access to `/admin/*`.
    - If `user.role` is `'SUPER_ADMIN' | 'WORKSHOP_MANAGER' | 'CONCIERGE'`, redirect to `/admin` (or allow switching between `/` Storefront UI and `/admin` Dashboard).
- **Storefront ↔ Admin Switcher:**
  - In the storefront header/account menu, show a **"Admin Dashboard"** link only when `user?.role && user.role !== 'CUSTOMER'`.
  - In the admin sidebar footer, include a **"View Storefront"** link to `/` using the same `dams_session` cookie.
- **App Shell Guard (`/admin/layout.tsx`):**
  - On mount, call `GET /api/v1/auth/me`. On `401`, redirect to `/login`.
  - If `user.role === 'CUSTOMER'`, redirect to `/` (or show `403`).
  - On `403` from any page request, show an inline "Insufficient permissions" state rather than logging the user out.
- **Logout:**
  - Call `POST /api/v1/auth/logout`, clear client state, and redirect to `/login`.

### Role-Based Sidebar Visibility
Use `user.role` (or `user.permissions`) to hide/disable routes the staff member cannot access:

| Section | Route | `SUPER_ADMIN` | `WORKSHOP_MANAGER` | `CONCIERGE` |
|---|---|---|---|---|
| Overview & Analytics | `/admin` | Yes | — | — |
| Orders & Dispatch | `/admin/orders` | Full (Read + Write) | Full (Read + Write) | Read-only |
| Bespoke Commissions | `/admin/custom-orders` | Full | Full | Full |
| Footwear & Stock | `/admin/products` | Full | Full | — |
| Collections | `/admin/collections` | Full | Full | — |
| Concierge Enquiries | `/admin/enquiries` | Full | — | Full |
| Newsletter Ledger | `/admin/newsletter` | Full | — | — |
| Shipping Settings | `/admin/settings/shipping` | Full | — | — |
| Users & Patrons | `/admin/users` | Full | — | — |
| Staff Management | `/admin/staff` | Full | — | — |

---

## 2. Screen-by-Screen Specifications

### A. Overview & Analytics (`/admin`)
**Endpoint:** `GET /api/v1/admin/analytics/overview`
- **KPI Cards (Top Row):**
  - **Total Revenue (NGN):** `totalRevenueNGN` (formatted as `₦X,XXX,XXX`)
  - **Paid Orders:** `paidOrdersCount` (with `ordersCount` total subtitle)
  - **Pending Custom Commissions:** `pendingCustomCommissions` (link to `/admin/custom-orders?status=NEW`)
  - **Low-Stock Alerts:** `lowStockAlerts.length`
- **Actionable Widgets:**
  - **Low-Stock Table:** Lists `name`, `slug`, and badges for each `lowSizes` entry (`EU 42: 2 left`), linking directly to the product's stock editor.
  - **Orders by Status Breakdown:** Pills/bar for `PENDING`, `PAID`, `IN_WORKSHOP`, `DISPATCHED`, `DELIVERED`, `CANCELLED`, `FAILED`.
  - **Top Silhouettes & Sales by State:** Two clean summary tables (`unitsSold` / `revenueNGN`, `state` / `ordersCount` / `revenueNGN`).

---

### B. Orders & Dispatch (`/admin/orders` & `/admin/orders/[id]`)
**Endpoints:** `GET /admin/orders`, `GET /admin/orders/:id`, `PATCH /admin/orders/:id/status`, `POST /admin/orders/manual`

- **List View (`/admin/orders`):**
  - **Filters:** `status`, `paymentMethod` (`paystack` | `whatsapp` | `walk-in`), `fulfilmentIssue`, `state`, date range (`from` / `to`), and `search` (`ORD-...`, reference, email, name).
  - **Priority Alert Filter / Badges:** Highlight rows where `fulfilmentIssue` is non-null:
    - `STOCK_CONFLICT` (Red) — Paid order could not deduct stock; needs restock or refund.
    - `REFUND_REQUIRED` (Amber) — Paid order was cancelled; needs Paystack refund.
    - `AMOUNT_MISMATCH` / `PAID_AFTER_CANCEL` (Red) — Payment anomaly recorded in `paymentLog`.
- **Order Detail Drawer / Page (`/admin/orders/[id]`):**
  - **Header:** `orderId`, `paymentMethod` badge, `status` badge, `fulfilmentIssue` banner (if present).
  - **Customer & Delivery:** `customerName`, `customerEmail`, `customerPhone`, `shippingAddress` (`street`, `city`, `state`).
  - **Line Items & Totals:** `items` (name, EU size, colour, qty, `priceAtPurchase`), `subtotal`, `shippingFee`, `totalAmount`.
  - **Timeline & Payment Log:** Chronological `timeline` + `paymentLog` audit trail.
  - **Status Transition Controls (`SUPER_ADMIN` / `WORKSHOP_MANAGER` only):**
    Only render valid next-step buttons matching the backend state machine:
    - `PENDING` → `Cancel Order` (`CANCELLED`)
    - `PAID` → `Move to Workshop` (`IN_WORKSHOP`) | `Cancel Order` (`CANCELLED`)
    - `IN_WORKSHOP` → `Mark Dispatched` (`DISPATCHED`) | `Cancel Order` (`CANCELLED`)
    - `DISPATCHED` → `Mark Delivered` (`DELIVERED`)
    - When moving to `DISPATCHED`, show a modal/form for `riderName`, `riderPhone`, `waybillNumber`, and `trackingNote`.
    - When cancelling a paid order, show a confirmation warning that stock will be restored and the order flagged `REFUND_REQUIRED`.
- **Log Manual Sale Modal (`POST /admin/orders/manual`):**
  - For Abuja walk-ins or WhatsApp orders: select `paymentMethod` (`whatsapp` | `walk-in`), customer details, `shippingAddress.state` (auto-0 shipping for `walk-in`), product + EU size + colourway + quantity, and initial `status` (`PAID` | `IN_WORKSHOP` | `DELIVERED`).

---

### C. Footwear Catalogue & Stock (`/admin/products`, `/admin/products/new`, `/admin/products/[id]`)
**Endpoints:** `GET/POST /admin/products`, `GET/PATCH/DELETE /admin/products/:id`, `PATCH /admin/products/:id/stock`, `POST /admin/uploads`

- **Product List (`/admin/products`):**
  - Tabs: `All`, `Published` (`status=published`), `Draft` (`status=draft`), `Archived` (`status=archived`), `Out of Stock` (`outOfStock=true`).
  - Quick Stock Modal per row: opens the EU size matrix (`sizes: [{ size, stock }]`) + `reason` input and calls `PATCH /admin/products/:id/stock`.
- **Product Form (Create / Edit):**
  - **Basic Info:** `name`, `slug` (auto-slugify on create, locked on edit), `subtitle`, `description`, `category` (`men` | `women` | `unisex`), `collectionSlug` (dropdown from `GET /admin/collections`), `silhouette`, `origin`.
  - **Pricing & Flags:** `price` (NGN), `compareAtPrice` (optional), toggles for `isPublished`, `featured`, `isBestSeller`, `isNewArrival`.
  - **Media Uploader:** Upload WebP/PNG/JPG studio images via `POST /admin/uploads` (`multipart/form-data` with `file`), then attach `{ url, alt, angle }` to `images`.
  - **Colourways & Materials:** Dynamic `{ name, hex }` picker list + `materials` (`upper`, `lining`, `sole`, `construction`) + `careInstructions` list.
  - **EU/UK Size Matrix:** Editable table of `{ size, ukSize, footLengthCm, stock }`.
- **Product Detail (`/admin/products/[id]`):**
  - Shows `salesCount` badge and an audit table of `stockHistory` (`size`, `previousStock -> newStock`, `changedBy`, `reason`, `changedAt`).
  - Archive button (`DELETE /admin/products/:id`) with an optional "Permanently Delete" (`?hard=true`) danger action.

---

### D. Collections (`/admin/collections`)
**Endpoints:** `GET/POST /admin/collections`, `PATCH/DELETE /admin/collections/:id`
- Table/cards showing `title`, `slug`, `productCount`, `sortOrder`, and `isActive` toggle.
- Create/Edit modal for `slug`, `title`, `subtitle`, `description`, `coverImage` (via `/admin/uploads`), `sortOrder`, `isActive`.

---

### E. Bespoke / Custom Shoe Commissions (`/admin/custom-orders`)
**Endpoints:** `GET /admin/custom-orders`, `GET /admin/custom-orders/:id`, `PATCH /admin/custom-orders/:id`
- **Status Tabs / Kanban:** `NEW`, `REVIEWING`, `QUOTED`, `IN_PRODUCTION`, `READY_FOR_DISPATCH`, `DELIVERED`, `DECLINED`.
- **Detail View (`BESPOKE-...`):**
  - Patron contact (`fullName`, `email`, `phone`, `locationCity`, `locationState`).
  - Specs (`description`, `preferredMaterial`, `size` EU, `budgetNGN`) + `sampleImageUrl` preview.
  - Workshop form: `commissionStatus`, `quotedPriceNGN`, optional `depositAmountNGN` (defaults to 50% of `quotedPriceNGN`), `workshopNotes`, and `generateDepositLink` toggle (displays `depositPaymentUrl` + `depositPaid` status once generated).

---

### F. Concierge Enquiries (`/admin/enquiries`)
**Endpoints:** `GET /admin/enquiries`, `PATCH /admin/enquiries/:id`
- Filter by `subject` (`sizing` | `bespoke` | `order-status` | `wholesale` | `general`), `status` (`OPEN` | `IN_PROGRESS` | `RESOLVED`), and `search`.
- Clicking a ticket (`ENQ-...`) opens the message body, patron contact (`fullName`, `email`, `phone`), `status` selector, and `conciergeNotes` textarea.

---

### G. Newsletter Ledger (`/admin/newsletter`) — *`SUPER_ADMIN`*
**Endpoint:** `GET /api/v1/admin/newsletter`
- Paginated table of subscribers (`email`, `source`, `isActive`, `createdAt`).
- **"Export CSV" button:** Triggers download of `GET /api/v1/admin/newsletter?format=csv` (returns `dams-newsletter-subscribers.csv`).

---

### H. Shipping Settings (`/admin/settings/shipping`) — *`SUPER_ADMIN`*
**Endpoints:** `GET /admin/settings/shipping`, `PATCH /admin/settings/shipping`
- Form fields:
  - `freeShippingThreshold` (NGN, default `150000`)
  - `defaultNationwideFee` (NGN, default `7500`)
  - `defaultNationwideEta` (string)
  - `stateRates` repeatable rows (`state`, `fee`, `estimatedDelivery`) — e.g. `Abuja (FCT)` at `4000` / `24 hours within Abuja (FCT)`.

---

### I. Users & Patrons (`/admin/users`) — *`SUPER_ADMIN`*
**Endpoint:** `GET /api/v1/admin/users`
- Filterable by `role` (`CUSTOMER` | `SUPER_ADMIN` | `WORKSHOP_MANAGER` | `CONCIERGE`), `isActive` (`true` | `false`), and `search` (`firstName`, `lastName`, `email`, `phone`).
- Paginated table (`firstName`, `lastName`, `email`, `phone`, `role` badge, `authProvider` `local`/`google`, `isActive`, `lastLoginAt`).

### J. Staff Management (`/admin/staff`) — *`SUPER_ADMIN`*
**Endpoints:** `GET /api/v1/admin/staff`, `POST /api/v1/admin/staff`
- Table of staff (`firstName`, `lastName`, `email`, `phone`, `role`, `isActive`, `lastLoginAt`).
- "Add Staff" modal (`firstName`, `lastName`, `email`, `phone?`, `password` min 8 chars, `role`).

---

## 3. UI Implementation Tips
- **Currency Formatting:** All prices are stored in whole Naira (`NGN`), not Kobo. Format with `new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 })`.
- **Error Handling:** Always surface `data.message` (and `data.errors` field map on `400`) in form feedback/toasts.
- **No Optimistic Stock Edits:** Wait for `PATCH /admin/products/:id/stock` response before updating the UI matrix so concurrent online sales are reflected accurately.
