# DÁMS API — Frontend Integration Documentation

Base URL (local): `http://localhost:3000`
API Prefix: `/api/v1`

---

## Global Conventions

### Authentication
- **Patron Auth:** Supports either an HTTP-only cookie (`dams_session`, 7-day TTL) or `Authorization: Bearer <token>`.
  - Frontend `fetch` calls using cookies must include `credentials: 'include'`.
- **Admin Auth:** Isolated from patron tokens. Uses either `dams_admin_session` cookie or `Authorization: Bearer <admin_token>`.
- **Session Revocation:** Both `POST /auth/logout` and `POST /auth/reset-password` increment `tokenVersion`, immediately invalidating all prior cookies and Bearer tokens.

### Standard Response Envelopes
- **Success:**
  ```json
  { "status": "success", "data": { ... } }
  ```
  Paginated list endpoints also include `meta`:
  ```json
  {
    "status": "success",
    "meta": { "total": 7, "page": 1, "limit": 12, "totalPages": 1 },
    "data": [ ... ]
  }
  ```
- **Validation Error (`400 Bad Request`):**
  ```json
  {
    "status": "error",
    "message": "Validation failed",
    "errors": { "fieldName": ["Error detail"] }
  }
  ```
- **Other Errors (`401`, `402`, `403`, `404`, `409`, `413`, `415`, `429`, `502`):**
  ```json
  { "status": "error", "message": "Human-readable message" }
  ```

### Limits & Rate Limiting
- **Body Size Limit:** `1MB` default; `16MB` on `POST /api/v1/custom-orders` and `POST /api/v1/admin/uploads`.
- **Rate Limits (15-minute window, returns `429` + `Retry-After` header):**
  - Patron `/auth/register`, `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`: `10` requests
  - Admin `/admin/auth/login`: `10` requests
  - `POST /checkout/initialize`: `20` requests
  - `GET /checkout/verify/:reference`: `30` requests
  - `GET /orders/track`, `GET /custom-orders/track/:referenceId`: `20` requests

---

## 1. Health & Service Info

### `GET /`
Returns service status and environment.

### `GET /health`
Returns `200 OK` (`healthy`) or `503 Service Unavailable` (`degraded`) with uptime and MongoDB connection state.

---

## 2. Catalogue & Collections (Public)

### `GET /api/v1/products`
Query parameters (all optional):
- `category`: `men` | `women` | `unisex`
- `collection`: collection slug (e.g. `natural-cork-series`)
- `silhouette`: exact case-insensitive match (e.g. `Derby`, `Cork Slide`)
- `sort`: `featured` (default) | `newest` | `price-asc` | `price-desc`
- `search`: keyword (max 100 chars)
- `page`: integer >= 1 (default `1`)
- `limit`: integer 1–50 (default `12`)

### `GET /api/v1/products/best-sellers`
Query: `?limit=5` (1–50, default `5`).

### `GET /api/v1/products/new-arrivals`
Query: `?limit=8` (1–50, default `8`).

### `GET /api/v1/products/:slug`
Returns full product object (`200 OK`) or `404`.

### `GET /api/v1/products/:slug/stock`
Returns real-time size stock with `Cache-Control: no-store`:
```json
{
  "status": "success",
  "data": {
    "productId": "prod_dams_cork_slide_00",
    "slug": "dams-signature-natural-cork-slide",
    "inStock": true,
    "totalStock": 80,
    "sizes": [
      { "size": 38, "ukSize": 5, "footLengthCm": 24.1, "stock": 14 }
    ]
  }
}
```

### `GET /api/v1/collections`
Returns active collections sorted by `sortOrder`, each with live `productCount`.

### `GET /api/v1/collections/:slug`
Returns a single active collection with `productCount` (`404` if not found).

### `GET /api/v1/categories`
Returns category counts (`men`, `women`, `unisex`) and sorted active `silhouettes` array.

---

## 3. Cart, Shipping, Checkout & Orders

### `POST /api/v1/cart/validate`
Verifies live NGN prices, colourway validity, and aggregated EU size stock.
- **Body:**
  ```json
  {
    "items": [
      { "productId": "prod_dams_cork_slide_00", "size": 42, "colour": "Earth Chocolate", "quantity": 1 }
    ]
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "status": "success",
    "valid": true,
    "items": [
      {
        "productId": "prod_dams_cork_slide_00",
        "size": 42,
        "availableStock": 11,
        "currentPrice": 48000,
        "isAvailable": true
      }
    ]
  }
  ```

### `GET /api/v1/shipping/rates`
Query: `?state=Abuja%20(FCT)&subtotal=96000` (`state` required, `subtotal` defaults to `0`).
- **Response (`200 OK`):**
  ```json
  {
    "status": "success",
    "data": {
      "state": "Abuja (FCT)",
      "shippingFee": 4000,
      "freeShippingThreshold": 150000,
      "isComplimentary": false,
      "estimatedDelivery": "24 hours within Abuja (FCT)"
    }
  }
  ```

### `POST /api/v1/checkout/initialize`
Validates stock, computes prices & shipping server-side, creates a `PENDING` order, and initializes Paystack.
- **Auth:** Optional (`Cookie` or `Bearer` links `userId` to the order for Patron order history).
- **Optional Header:** `Idempotency-Key: <8-100 chars [A-Za-z0-9_-]>` (prevents duplicate orders on double-clicks).
- **Body:**
  ```json
  {
    "customerName": "Amina Bello",
    "customerEmail": "amina@example.com",
    "customerPhone": "+234 803 000 0000",
    "shippingAddress": {
      "street": "14 Adetokunbo Ademola Crescent",
      "city": "Wuse II",
      "state": "Abuja (FCT)"
    },
    "items": [
      { "productId": "prod_dams_cork_slide_00", "size": 42, "colour": "Earth Chocolate", "quantity": 1 }
    ]
  }
  ```
- **Response (`201 Created`):**
  ```json
  {
    "status": "success",
    "data": {
      "orderId": "ORD-A1B2C3D4E5",
      "reference": "DAMS-1795000000000-ABCDEF123456",
      "authorizationUrl": "https://checkout.paystack.com/...",
      "subtotal": 48000,
      "shippingFee": 4000,
      "totalAmount": 52000,
      "status": "PENDING"
    }
  }
  ```
- **Errors:** `400` (bad product/colour/size), `409` (insufficient stock), `502` (Paystack error).

### `GET /api/v1/checkout/verify/:reference`
Verifies Paystack payment by `paymentReference`, atomically transitions `PENDING -> PAID`, and deducts stock.
- **Response (`200 OK`):**
  ```json
  {
    "status": "success",
    "data": {
      "orderId": "ORD-A1B2C3D4E5",
      "reference": "DAMS-1795000000000-ABCDEF123456",
      "status": "PAID",
      "fulfilmentIssue": null,
      "items": [ ... ],
      "subtotal": 48000,
      "shippingFee": 4000,
      "totalAmount": 52000,
      "timeline": [ ... ]
    }
  }
  ```
- **Errors:** `404` (unknown reference), `402` (payment not `success`), `400` (amount/currency mismatch), `502` (Paystack unavailable).

### `POST /api/v1/webhooks/paystack`
Server-to-server webhook called by Paystack (`x-paystack-signature` HMAC SHA-512 verified). Settles `charge.success` idempotently.

### `GET /api/v1/orders` *(Patron Auth Required)*
Returns paginated order history for the authenticated patron (`?page=1&limit=10`).

### `GET /api/v1/orders/track`
Public order tracking lookup. Phone numbers are normalized (e.g. `0803...` and `+234803...` both match).
- **Query:** `?reference=ORD-A1B2C3D4E5&contact=amina@example.com`
- **Response (`200 OK`):**
  ```json
  {
    "status": "success",
    "data": {
      "orderId": "ORD-A1B2C3D4E5",
      "status": "IN_WORKSHOP",
      "timeline": [ ... ],
      "trackingNote": "Dispatched via Abuja Rider — ETA Tomorrow"
    }
  }
  ```

---

## 4. Custom Orders, Enquiries & Newsletter

### `POST /api/v1/custom-orders`
Accepts `multipart/form-data` (when attaching `sampleImage`) or `application/json`.
- **Fields:**
  - `description` (string, min 10 chars)
  - `preferredMaterial` (string)
  - `size` (integer 37–46)
  - `budgetNGN` (number >= 20000)
  - `locationState`, `locationCity` (strings)
  - `fullName`, `email`, `phone` (strings)
  - `sampleImageName` (string, optional)
  - `sampleImage` (File, optional: PNG/JPG/WebP, max 5MB)
- **Response (`201 Created`):**
  ```json
  {
    "status": "success",
    "referenceId": "BESPOKE-M4K9X2",
    "message": "Your custom shoe request has been logged with our Abuja workshop..."
  }
  ```

### `GET /api/v1/custom-orders/track/:referenceId`
Query: `?contact=email_or_phone`. Returns `commissionStatus`, `quotedPriceNGN`, `workshopNotes`, `sampleImageUrl`, and specs (`404` if mismatch).

### `POST /api/v1/enquiries`
- **Body:** `{ fullName, email, phone, subject, message }`
  - `subject`: `"sizing"` | `"bespoke"` | `"order-status"` | `"wholesale"` | `"general"`
- **Response (`201 Created`):** `{ "status": "success", "ticketId": "ENQ-8F29A1", "message": "..." }`

### `POST /api/v1/newsletter/subscribe`
- **Body:** `{ "email": "patron@example.com", "source": "footer" }` (`source` optional, defaults to `"footer"`).
- **Response (`201 Created` on new / `200 OK` on existing):** `{ "status": "success", "message": "..." }`

---

## 5. Patron Authentication & Wishlist (`/api/v1/auth`, `/api/v1/wishlist`)

### `POST /api/v1/auth/register`
Body: `{ firstName, lastName, email, phone, password }` (password min 8 chars). Sets `dams_session` cookie and returns `201`:
```json
{
  "status": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "usr_...",
      "firstName": "Amina",
      "lastName": "Bello",
      "email": "amina@example.com",
      "phone": "+2348030000000",
      "preferredEuSize": null,
      "defaultAddress": "",
      "city": "",
      "state": ""
    }
  }
}
```

### `POST /api/v1/auth/login`
Body: `{ email, password }`. Sets `dams_session` cookie and returns `{ status: "success", data: { token, user } }`.

### `POST /api/v1/auth/logout`
Revokes active session (`tokenVersion` increment) and clears `dams_session` cookie.

### `GET /api/v1/auth/me` *(Patron Auth Required)*
Returns `{ status: "success", data: { token, user } }`.

### `PATCH /api/v1/auth/me` *(Patron Auth Required)*
Body (at least one field): `{ firstName?, lastName?, phone?, defaultAddress?, city?, state?, preferredEuSize? }`. Returns `{ status: "success", data: { user } }`.

### `POST /api/v1/auth/forgot-password`
Body: `{ email }`. Always returns `200 OK` to prevent email enumeration.

### `POST /api/v1/auth/reset-password`
Body: `{ token, newPassword }`. Resets password and revokes all existing sessions.

### `GET /api/v1/wishlist` *(Patron Auth Required)*
Returns `{ status: "success", data: Product[] }`.

### `POST /api/v1/wishlist` *(Patron Auth Required)*
Body: `{ productId }`. Returns `201` with updated `Product[]`.

### `DELETE /api/v1/wishlist/:productId` *(Patron Auth Required)*
Returns `200` with updated `Product[]`.

---

## 6. Admin Dashboard API (`/api/v1/admin/*`)

All routes below except `login` and `logout` require Admin Auth (`dams_admin_session` cookie or `Authorization: Bearer <admin_token>`). Roles: `SUPER_ADMIN`, `WORKSHOP_MANAGER`, `CONCIERGE`.

### Auth & Staff
- `POST /api/v1/admin/auth/login` — Body: `{ email, password }` → `{ token, user: { ..., permissions } }`
- `POST /api/v1/admin/auth/logout` — Revokes admin session & clears cookie
- `GET /api/v1/admin/auth/me` — Current staff profile & `permissions`
- `GET /api/v1/admin/staff` *(`SUPER_ADMIN`)* — List all staff
- `POST /api/v1/admin/staff` *(`SUPER_ADMIN`)* — Body: `{ firstName, lastName, email, password, role }`

### Footwear, Collections, Stock & Media *(`SUPER_ADMIN`, `WORKSHOP_MANAGER`)*
- `GET /api/v1/admin/products` — Query: `?status=published|draft|archived&outOfStock=true&search=&page=1&limit=20`
- `POST /api/v1/admin/products` — Create product (`sizes` matrix, `images`, `colourways`, `materials`, `isPublished`)
- `GET /api/v1/admin/products/:id` — Full product + `salesCount` + `stockHistory`
- `PATCH /api/v1/admin/products/:id` — Update product fields or `isPublished`
- `PATCH /api/v1/admin/products/:id/stock` — Body: `{ sizes: [{ size: 42, stock: 15 }], reason? }` (atomic update + `stockHistory`)
- `DELETE /api/v1/admin/products/:id` — Archives by default; `?hard=true` permanently deletes
- `GET /api/v1/admin/collections` — List all collections (including inactive)
- `POST /api/v1/admin/collections` — Create collection
- `PATCH /api/v1/admin/collections/:id` — Update collection
- `DELETE /api/v1/admin/collections/:id` — Delete collection
- `POST /api/v1/admin/uploads` — `multipart/form-data` (`file`: WebP/PNG/JPG or `.glb`, max 15MB)

### Orders & Dispatch
- `GET /api/v1/admin/orders` *(`SUPER_ADMIN`, `WORKSHOP_MANAGER`, `CONCIERGE`)* — Query: `?status=&paymentMethod=paystack|whatsapp|walk-in&fulfilmentIssue=&state=&from=&to=&search=&page=1&limit=20`
- `GET /api/v1/admin/orders/:id` *(`SUPER_ADMIN`, `WORKSHOP_MANAGER`, `CONCIERGE`)* — Full order details, `dispatch`, `paymentLog`
- `PATCH /api/v1/admin/orders/:id/status` *(`SUPER_ADMIN`, `WORKSHOP_MANAGER`)* — Body: `{ status: 'IN_WORKSHOP' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED', trackingNote?, riderName?, riderPhone?, waybillNumber? }` (enforces valid transitions; cancelling a paid order restores stock & flags `REFUND_REQUIRED`)
- `POST /api/v1/admin/orders/manual` *(`SUPER_ADMIN`, `WORKSHOP_MANAGER`)* — Log `whatsapp` or `walk-in` sale & atomically deduct stock

### Bespoke Commissions *(`SUPER_ADMIN`, `WORKSHOP_MANAGER`, `CONCIERGE`)*
- `GET /api/v1/admin/custom-orders` — Query: `?status=NEW|REVIEWING|QUOTED|IN_PRODUCTION|READY_FOR_DISPATCH|DELIVERED|DECLINED&search=&page=1&limit=20`
- `GET /api/v1/admin/custom-orders/:id` — Full commission details
- `PATCH /api/v1/admin/custom-orders/:id` — Body: `{ commissionStatus?, workshopNotes?, quotedPriceNGN?, generateDepositLink? }`

### Enquiries, Newsletter, Shipping Settings & Analytics
- `GET /api/v1/admin/enquiries` *(`SUPER_ADMIN`, `CONCIERGE`)* — Query: `?subject=&status=OPEN|IN_PROGRESS|RESOLVED&search=&page=1&limit=20`
- `PATCH /api/v1/admin/enquiries/:id` *(`SUPER_ADMIN`, `CONCIERGE`)* — Body: `{ status?, conciergeNotes? }`
- `GET /api/v1/admin/newsletter` *(`SUPER_ADMIN`)* — Query: `?format=json|csv&activeOnly=true|false&page=1&limit=100`
- `GET /api/v1/admin/settings/shipping` *(`SUPER_ADMIN`)* — View `freeShippingThreshold`, `defaultNationwideFee`, `stateRates`
- `PATCH /api/v1/admin/settings/shipping` *(`SUPER_ADMIN`)* — Update shipping rates & threshold
- `GET /api/v1/admin/analytics/overview` *(`SUPER_ADMIN`)* — Returns `totalRevenueNGN`, `paidOrdersCount`, `ordersCount`, `ordersByStatus`, `pendingCustomCommissions`, `lowStockAlerts`, `topSilhouettes`, `salesByState`
