# DÁMS Storefront & Patron API Documentation

Base URL (local): `http://localhost:3000`
API Prefix: `/api/v1`

---

## Global Conventions

### Authentication
- **Patron Auth:** Supports either an HTTP-only cookie (`dams_session`, 7-day TTL) or `Authorization: Bearer <token>`.
  - Browser `fetch` calls using cookies must include `credentials: 'include'`.
- **Session Revocation:** `POST /api/v1/auth/logout` and `POST /api/v1/auth/reset-password` increment `tokenVersion`, immediately invalidating all prior cookies and Bearer tokens.

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
- **Other Errors (`401`, `402`, `404`, `409`, `413`, `415`, `429`, `502`):**
  ```json
  { "status": "error", "message": "Human-readable message" }
  ```

### Limits & Rate Limiting
- **Body Size Limit:** `1MB` default; `16MB` on `POST /api/v1/custom-orders`.
- **Rate Limits (15-minute window, returns `429` + `Retry-After` header):**
  - `/auth/register`, `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`: `10` requests
  - `POST /checkout/initialize`: `20` requests
  - `GET /checkout/verify/:reference`: `30` requests
  - `GET /orders/track`, `GET /custom-orders/track/:referenceId`: `20` requests

---

## 1. Health & Service Info

- `GET /` — Returns `{ service: "dams-api", status: "ok", environment }`
- `GET /health` — Returns `200 OK` (`healthy`) or `503` (`degraded`) with `uptimeSeconds` and MongoDB state.

---

## 2. Catalogue & Collections

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
Returns `{ categories: [{ value, label, count }], silhouettes: string[] }`.

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
Server-to-server Paystack webhook (`x-paystack-signature` HMAC SHA-512 verified). Settles `charge.success` idempotently.

### `GET /api/v1/orders` *(Patron Auth Required)*
Returns paginated order history for the logged-in patron (`?page=1&limit=10`).

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
Query: `?contact=email_or_phone`. Returns `commissionStatus`, `quotedPriceNGN`, `workshopNotes`, `sampleImageUrl`, `depositAmountNGN`, `depositPaymentUrl`, `depositPaid`, and specs (`404` if mismatch).

### `POST /api/v1/enquiries`
- **Body:** `{ fullName, email, phone, subject, message }`
  - `subject`: `"sizing"` | `"bespoke"` | `"order-status"` | `"wholesale"` | `"general"`
- **Response (`201 Created`):** `{ "status": "success", "ticketId": "ENQ-8F29A1", "message": "..." }`

### `POST /api/v1/newsletter/subscribe`
- **Body:** `{ "email": "patron@example.com", "source": "footer" }` (`source` optional, defaults to `"footer"`).
- **Response (`201 Created` on new / `200 OK` on existing):** `{ "status": "success", "message": "..." }`

---

## 5. Patron Authentication & Wishlist

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
      "role": "CUSTOMER",
      "permissions": [],
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

### `POST /api/v1/auth/google`
Continue with Google using a Google Identity Services ID token (`idToken`).
- **Body:** `{ "idToken": "eyJhbGciOiJSUzI1NiIs..." }`
- **Behavior:** Verifies the Google token against `GOOGLE_CLIENT_ID`, creates a `CUSTOMER` account if new (or links/logs in an existing user while preserving their `role`), sets `dams_session` cookie, and returns `{ status: "success", data: { token, user } }`.

### `POST /api/v1/auth/logout`
Revokes active session (`tokenVersion` increment) and clears `dams_session` cookie.

### `GET /api/v1/auth/me` *(Patron Auth Required)*
Returns `{ status: "success", data: { token, user } }`.

### `PATCH /api/v1/auth/me` *(Patron Auth Required)*
Body (at least one field): `{ firstName?, lastName?, phone?, defaultAddress?, city?, state?, preferredEuSize? }`. Returns `{ status: "success", data: { user } }`.

### `POST /api/v1/auth/forgot-password`
Body: `{ email }`. Always returns `200 OK`.

### `POST /api/v1/auth/reset-password`
Body: `{ token, newPassword }`. Resets password and revokes all existing sessions.

### `GET /api/v1/wishlist` *(Patron Auth Required)*
Returns `{ status: "success", data: Product[] }`.

### `POST /api/v1/wishlist` *(Patron Auth Required)*
Body: `{ productId }`. Returns `201` with updated `Product[]`.

### `DELETE /api/v1/wishlist/:productId` *(Patron Auth Required)*
Returns `200` with updated `Product[]`.
