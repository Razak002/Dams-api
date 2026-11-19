# DÁMS Admin Dashboard API Documentation

Base URL (local): `http://localhost:3000`
API Prefix: `/api/v1/admin`

---

## Global Conventions

### Authentication & Role Guard
- **Unified Auth Flow:** Uses the same `/api/v1/auth/*` endpoints (`POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`) as the storefront.
- **Auth Mechanism:** HTTP-only cookie (`dams_session`, 7-day TTL) or `Authorization: Bearer <token>`.
  - Browser `fetch` calls using cookies must include `credentials: 'include'`.
- **Roles:** `CUSTOMER` (storefront only, blocked with `403` on `/api/v1/admin/*`), `SUPER_ADMIN`, `WORKSHOP_MANAGER`, `CONCIERGE`.
  - Users with an admin role can access **both** the storefront UI and the Admin Dashboard.
- **Session Revocation:** `POST /api/v1/auth/logout` and `POST /api/v1/auth/reset-password` increment `tokenVersion`, immediately invalidating all prior cookies and Bearer tokens.
- **Body Size Limit:** `1MB` default; `16MB` on `POST /api/v1/admin/uploads`.
- **Rate Limit:** `POST /api/v1/auth/login` is limited to `10` requests per 15 minutes per IP (`429` + `Retry-After`).

### Standard Error Responses
- `400` — Validation failed (`errors` map) or invalid transition/size
- `401` — Missing, invalid, or revoked admin session
- `403` — Insufficient role permissions
- `404` — Resource not found
- `409` — Conflict (duplicate email/slug, invalid order status transition, or insufficient stock)

---

## 1. Auth & Staff Management

Admin login, logout, and profile use the unified auth endpoints:
- `POST /api/v1/auth/login` — Body: `{ email, password }` → `{ token, user: { ..., role, permissions } }`
- `POST /api/v1/auth/logout` — Revokes active session & clears `dams_session` cookie
- `GET /api/v1/auth/me` — Current user profile, `role`, and `permissions`

### `GET /api/v1/admin/users` *(`SUPER_ADMIN`)*
Lists all users (customers and staff) with pagination.
- **Query:** `?role=CUSTOMER|SUPER_ADMIN|WORKSHOP_MANAGER|CONCIERGE&isActive=true|false&search=&page=1&limit=20`

### `GET /api/v1/admin/staff` *(`SUPER_ADMIN`)*
Lists all staff accounts (`SUPER_ADMIN`, `WORKSHOP_MANAGER`, `CONCIERGE`) sorted newest first.

### `POST /api/v1/admin/staff` *(`SUPER_ADMIN`)*
- **Body:** `{ firstName, lastName, email, phone?, password, role }` (`role`: `SUPER_ADMIN` | `WORKSHOP_MANAGER` | `CONCIERGE`).
- **Response (`201 Created`):** Created staff profile + `permissions`.

---

## 2. Footwear, Collections, Stock & Media
*Access: `SUPER_ADMIN`, `WORKSHOP_MANAGER`*

### `GET /api/v1/admin/products`
Query: `?status=published|draft|archived&outOfStock=true|false&search=&page=1&limit=20`.

### `POST /api/v1/admin/products`
- **Body:**
  ```json
  {
    "slug": "abuja-oxford-01",
    "name": "Abuja Executive Oxford",
    "subtitle": "Full-Grain Sokoto Calfskin",
    "description": "...",
    "price": 140000,
    "compareAtPrice": 160000,
    "category": "men",
    "collectionSlug": "abuja-executive-line",
    "silhouette": "Oxford",
    "images": [{ "url": "/images/oxford.webp", "alt": "Oxford", "angle": "Side" }],
    "colourways": [{ "name": "Espresso", "hex": "#2B1B14" }],
    "sizes": [{ "size": 42, "ukSize": 9, "footLengthCm": 26.7, "stock": 10 }],
    "materials": { "upper": "...", "lining": "...", "sole": "...", "construction": "..." },
    "origin": "100% Locally Made in Abuja, Nigeria",
    "featured": true,
    "isBestSeller": false,
    "isNewArrival": true,
    "isPublished": true,
    "careInstructions": ["..."]
  }
  ```

### `GET /api/v1/admin/products/:id`
Accepts product `id` (`prod_...`) or `slug`. Returns full admin product view + `salesCount` + `stockHistory`.

### `PATCH /api/v1/admin/products/:id`
Updates any subset of product fields (`price`, `compareAtPrice`, `collectionSlug`, `featured`, `isBestSeller`, `isNewArrival`, `isPublished`, etc.).

### `PATCH /api/v1/admin/products/:id/stock`
Atomically adjusts stock per EU size and logs each change in `stockHistory`.
- **Body:**
  ```json
  {
    "sizes": [{ "size": 42, "stock": 15 }],
    "reason": "Workshop restock"
  }
  ```

### `DELETE /api/v1/admin/products/:id`
Archives product (`status: "archived"`, `isActive: false`) by default; pass `?hard=true` to permanently delete.

### Collections
- `GET /api/v1/admin/collections` — List all collections (including inactive) with `productCount`.
- `POST /api/v1/admin/collections` — Body: `{ slug, title, subtitle?, description?, coverImage?, sortOrder?, isActive? }`
- `PATCH /api/v1/admin/collections/:id` — Update collection details, `sortOrder`, or `isActive`.
- `DELETE /api/v1/admin/collections/:id` — Delete collection.

### `POST /api/v1/admin/uploads`
- **Content-Type:** `multipart/form-data`
- **Field:** `file` (WebP, PNG, JPG, or `.glb` 3D model, max `15MB`).
- **Response (`201 Created`):** `{ status: "success", data: { fileName, mimeType, sizeBytes, url } }`.

---

## 3. Order & Dispatch Management

### `GET /api/v1/admin/orders`
*Access: `SUPER_ADMIN`, `WORKSHOP_MANAGER`, `CONCIERGE`*
Query:
- `status`: `PENDING` | `PAID` | `IN_WORKSHOP` | `DISPATCHED` | `DELIVERED` | `FAILED` | `CANCELLED`
- `paymentMethod`: `paystack` | `whatsapp` | `walk-in`
- `fulfilmentIssue`: `STOCK_CONFLICT` | `AMOUNT_MISMATCH` | `PAID_AFTER_CANCEL` | `REFUND_REQUIRED`
- `state`, `from` (ISO date), `to` (ISO date), `search` (`orderId`, `paymentReference`, `customerEmail`, `customerName`), `page`, `limit`.

### `GET /api/v1/admin/orders/:id`
*Access: `SUPER_ADMIN`, `WORKSHOP_MANAGER`, `CONCIERGE`*
Accepts `orderId` (`ORD-...`) or `paymentReference`. Returns full order, `shippingAddress`, `items`, `dispatch`, `timeline`, and `paymentLog`.

### `PATCH /api/v1/admin/orders/:id/status`
*Access: `SUPER_ADMIN`, `WORKSHOP_MANAGER`*
- **Body:**
  ```json
  {
    "status": "DISPATCHED",
    "trackingNote": "Dispatched via Abuja Rider — ETA Tomorrow",
    "riderName": "Musa Ibrahim",
    "riderPhone": "+2348030000000",
    "waybillNumber": "WB-2026-001"
  }
  ```
- **Allowed Transitions:**
  - `PENDING` → `CANCELLED`
  - `PAID` → `IN_WORKSHOP` | `CANCELLED`
  - `IN_WORKSHOP` → `DISPATCHED` | `CANCELLED`
  - `DISPATCHED` → `DELIVERED`
  - *(Cancelling a paid order atomically restores stock and sets `fulfilmentIssue: "REFUND_REQUIRED"`.)*

### `POST /api/v1/admin/orders/manual`
*Access: `SUPER_ADMIN`, `WORKSHOP_MANAGER`*
Logs a `whatsapp` or `walk-in` sale and atomically deducts stock in a transaction.
- **Body:**
  ```json
  {
    "customerName": "Chidi Okafor",
    "customerEmail": "chidi@example.com",
    "customerPhone": "08030000000",
    "paymentMethod": "walk-in",
    "shippingAddress": { "state": "Abuja (FCT)", "city": "Wuse II", "street": "" },
    "items": [{ "productId": "prod_dams_cork_slide_00", "size": 42, "colour": "Earth Chocolate", "quantity": 1 }],
    "status": "PAID",
    "trackingNote": "Picked up at Abuja showroom"
  }
  ```

---

## 4. Bespoke / Custom Shoe Commissions
*Access: `SUPER_ADMIN`, `WORKSHOP_MANAGER`, `CONCIERGE`*

- `GET /api/v1/admin/custom-orders` — Query: `?status=NEW|REVIEWING|QUOTED|IN_PRODUCTION|READY_FOR_DISPATCH|DELIVERED|DECLINED&search=&page=1&limit=20`
- `GET /api/v1/admin/custom-orders/:id` — Lookup by `referenceId` (`BESPOKE-...`)
- `PATCH /api/v1/admin/custom-orders/:id` — Body: `{ commissionStatus?, workshopNotes?, quotedPriceNGN?, depositAmountNGN?, generateDepositLink? }`
  - When `generateDepositLink: true`, requires `quotedPriceNGN > 0`, initializes a Paystack transaction for `depositAmountNGN` (defaults to 50% of `quotedPriceNGN`), and stores `depositPaymentUrl` + `depositReference`. Paystack `charge.success` webhook marks `depositPaid: true` and advances `QUOTED → IN_PRODUCTION`.

---

## 5. Enquiries, Newsletter, Shipping Settings & Analytics

### Enquiries *(`SUPER_ADMIN`, `CONCIERGE`)*
- `GET /api/v1/admin/enquiries` — Query: `?subject=&status=OPEN|IN_PROGRESS|RESOLVED&search=&page=1&limit=20`
- `PATCH /api/v1/admin/enquiries/:id` — Lookup by `ticketId` (`ENQ-...`). Body: `{ status?, conciergeNotes? }`

### Newsletter *(`SUPER_ADMIN`)*
- `GET /api/v1/admin/newsletter` — Query: `?format=json|csv&activeOnly=true|false&page=1&limit=100`
  - `format=csv` returns `text/csv` attachment (`dams-newsletter-subscribers.csv`).

### Shipping Settings *(`SUPER_ADMIN`)*
- `GET /api/v1/admin/settings/shipping` — Returns `freeShippingThreshold`, `defaultNationwideFee`, `defaultNationwideEta`, and `stateRates`.
- `PATCH /api/v1/admin/settings/shipping` — Updates any of the above fields (immediately reflected in `GET /api/v1/shipping/rates` and checkout).

### Analytics *(`SUPER_ADMIN`)*
- `GET /api/v1/admin/analytics/overview` — Returns:
  - `totalRevenueNGN`, `paidOrdersCount`, `ordersCount`, `ordersByStatus`
  - `pendingCustomCommissions`
  - `lowStockAlerts` (sizes with stock <= 3)
  - `topSilhouettes` (top 5 by units sold)
  - `salesByState` (orders & revenue per state)
