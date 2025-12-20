# Parcel Parse Backend (Courier + Realtime Tracking)
<p align="center">
  <img alt="Parcel Parse" src="https://api.iconify.design/mdi:package-variant.svg?color=%2300a86b" width="96" height="96" />
</p>

<p align="center">
  A production-style courier backend with role-based APIs, route-map data for agents, and realtime parcel location streaming.
</p>

## Highlights
- Role-based access (ADMIN / AGENT / CUSTOMER) with JWT
- Agent route-map API: active parcels + markers + current locations + summary
- Realtime location tracking over WebSocket rooms per parcel
- Prisma + PostgreSQL data model (parcels, assignments, tracking points, status history)
- QR generation + Supabase upload for shareable parcel tracking links

## Quickstart
### Prerequisites
- Node.js (recommended: latest LTS)
- PostgreSQL database

### Install
```bash
npm install
npx prisma generate
```

### Environment variables
Set these in `.env`:
- `DATABASE_URL` (PostgreSQL connection string)
- `ACCESS_TOKEN_SECRET`
- `ACCESS_TOKEN_EXPIRES_IN` (example: `7d`)
- `SENDGRID_API_KEY` (optional, for OTP + notification emails)
- `SENDGRID_EMAIL` (optional, sender email)
- `GOOGLE_MAPS_API_KEY` (optional, geocoding when booking without coordinates)
- `SUPABASE_URL` or `SUPABASE_PROJECT_URL` (optional, QR upload)
- `SUPABASE_SERVICE_KEY` or `SUPABASE_ANON_KEY` (optional, QR upload)
- `SUPABASE_BUCKET` (optional, default: `attachments`)
- `FRONTEND_BASE_URL` (optional, default: `http://localhost:5173`)

### Run
```bash
npm run dev
```

Default base URL:
- HTTP: `http://localhost:5000`
- WebSocket: `ws://localhost:5000/ws`

## Authentication
After login, send your token in the `Authorization` header:
- `Authorization: <accessToken>`

Note: the backend verifies the header value directly as a JWT (it does not parse `Bearer ...`).

## Response envelope
Most endpoints return:
```json
{
  "success": true,
  "message": "....",
  "data": {}
}
```

Some list endpoints return pagination inside `data.meta` (service-level `meta`), not top-level `meta`.

## API Reference (HTTP)
Base path: `/api`

### Auth (`/api/auth`)
#### `POST /register`
Body (`src/app/modules/Auth/auth.validation.ts:4`):
```json
{ "email":"john@acme.com", "password":"secret123", "role":"CUSTOMER", "name":"John" }
```
Response: `{ user, otpSent, otpExpiresAt }` (`src/app/modules/Auth/auth.service.ts:22`)

#### `POST /resend-otp`
Body (`src/app/modules/Auth/auth.validation.ts:31`):
```json
{ "email":"john@acme.com" }
```

#### `POST /verify-otp`
Body (`src/app/modules/Auth/auth.validation.ts:35`):
```json
{ "email":"john@acme.com", "otp":"123456" }
```

#### `POST /login`
Body (`src/app/modules/Auth/auth.validation.ts:11`):
```json
{ "email":"john@acme.com", "password":"secret123" }
```
Response includes `accessToken` (`src/app/modules/Auth/auth.service.ts:127`)

#### `POST /request-reset-password`
Body (`src/app/modules/Auth/auth.validation.ts:21`):
```json
{ "email":"john@acme.com" }
```

#### `POST /reset-password`
Body (`src/app/modules/Auth/auth.validation.ts:25`):
```json
{ "email":"john@acme.com", "otp":"123456", "newPassword":"newsecret123" }
```

#### `POST /change-password` (CUSTOMER/ADMIN)
Headers: `Authorization: <accessToken>`

Body (`src/app/modules/Auth/auth.validation.ts:16`):
```json
{ "oldPassword":"secret123", "newPassword":"newsecret123" }
```

### User (`/api/user`)
#### `GET /me` (CUSTOMER/ADMIN)
Headers: `Authorization: <accessToken>`

Response (`src/app/modules/User/user.service.ts:49`): user profile fields.

#### `GET /all-users` (ADMIN)
Headers: `Authorization: <accessToken>`

Query (pagination + search): `page`, `limit`, `sortBy`, `searchTerm` (`src/app/modules/User/user.service.ts:8`)

### Customer (`/api/customer`)
#### `POST /parcels/book` (CUSTOMER)
Headers: `Authorization: <accessToken>`

Body (`src/app/modules/Customer/customer.validation.ts:4`):
```json
{
  "pickupAddress": "House 11, Road 2, Dhaka",
  "deliveryAddress": "Dhanmondi 32, Dhaka",
  "parcelType": "DOCUMENT",
  "parcelSize": "SMALL",
  "paymentType": "COD",
  "codAmount": 120
}
```
Notes:
- If you omit `pickupLat/pickupLng` or `deliveryLat/deliveryLng`, the service attempts Google Geocoding (`src/app/modules/Customer/customer.service.ts:1`).

#### `GET /parcels` (CUSTOMER)
Headers: `Authorization: <accessToken>`

Query:
- Pagination: `page`, `limit`, `sortBy`
- Filters: `status`, `paymentType`, `paymentStatus`
- Search: `searchTerm` (matches tracking number + addresses) (`src/app/modules/Customer/customer.service.ts:121`)

#### `GET /parcels/:id` (CUSTOMER)
Headers: `Authorization: <accessToken>`

Returns parcel details + assignment + status history (`src/app/modules/Customer/customer.service.ts:219`)

#### `GET /parcels/:id/track` (CUSTOMER)
Headers: `Authorization: <accessToken>`

Returns last 100 tracking points (`src/app/modules/Customer/customer.service.ts:257`)

#### `GET /parcels/:id/track/current` (CUSTOMER)
Headers: `Authorization: <accessToken>`

Returns latest tracking point (`src/app/modules/Customer/customer.service.ts:293`)

#### `GET /dashboard/metrics` (CUSTOMER)
Headers: `Authorization: <accessToken>`

Returns dashboard cards + trend data (`src/app/modules/Customer/customer.service.ts:314`)

### Agent (`/api/agent`)
#### `GET /parcels` (AGENT)
Headers: `Authorization: <accessToken>`

Returns assigned parcels with pagination (`src/app/modules/Agent/agent.service.ts:16`)

#### `GET /parcels/active` (AGENT) — Route Map API
Headers: `Authorization: <accessToken>`

Query:
- Pagination: `page` (default `1`), `limit` (default `100`)
- Sorting: `sortBy` (default `updatedAt`)
- Search: `searchTerm` (matches tracking/reference/addresses) (`src/app/modules/Agent/agent.service.ts:80`)

What it returns (`src/app/modules/Agent/agent.service.ts:80`):
- `data`: active parcels only (`BOOKED`, `PICKED_UP`, `IN_TRANSIT`) plus `currentLocation`
- `summary`: count breakdown by status
- `markers`: map-ready markers for pickup/delivery/current points
- `meta`: pagination metadata

Example response `data` shape:
```json
{
  "data": [
    {
      "id": "uuid",
      "trackingNumber": "PP-...",
      "pickupLat": 23.7,
      "pickupLng": 90.4,
      "deliveryLat": 23.8,
      "deliveryLng": 90.5,
      "status": "IN_TRANSIT",
      "currentLocation": {
        "parcelId": "uuid",
        "latitude": 23.75,
        "longitude": 90.45,
        "speedKph": 22,
        "heading": 180,
        "recordedAt": "2025-12-20T10:00:00.000Z"
      }
    }
  ],
  "summary": { "count": 1, "booked": 0, "pickedUp": 0, "inTransit": 1 },
  "markers": [
    { "type": "pickup", "parcelId": "uuid", "latitude": 23.7, "longitude": 90.4 },
    { "type": "delivery", "parcelId": "uuid", "latitude": 23.8, "longitude": 90.5 },
    { "type": "current", "parcelId": "uuid", "latitude": 23.75, "longitude": 90.45 }
  ],
  "meta": { "page": 1, "limit": 100, "total": 1, "totalPages": 1 }
}
```

#### `POST /update-parcel-status` (AGENT)
Headers: `Authorization: <accessToken>`

Body (`src/app/modules/Agent/agent.validation.ts:3`):
```json
{ "parcelId":"uuid", "status":"IN_TRANSIT", "remarks":"Picked up from sender" }
```
Allowed status values: `PICKED_UP`, `IN_TRANSIT`, `DELIVERED`, `FAILED`

#### `POST /location` (AGENT)
Headers: `Authorization: <accessToken>`

Body (`src/app/modules/Agent/agent.validation.ts:16`):
```json
{ "parcelId":"uuid", "latitude":23.75, "longitude":90.45, "speedKph":24, "heading":180 }
```
This persists a tracking point and broadcasts to WebSocket subscribers (`src/app/modules/Agent/agent.service.ts:269`).

#### `GET /dashboard/metrics` (AGENT)
Headers: `Authorization: <accessToken>`

Returns agent dashboard cards + delivered trend (`src/app/modules/Agent/agent.service.ts:313`)

### Admin (`/api/admin`)
All admin endpoints require:
- Headers: `Authorization: <accessToken>`

#### `GET /dashboard/metrics` (ADMIN)
Returns totals (`src/app/modules/Admin/admin.service.ts:9`)

#### `GET /parcels` (ADMIN)
Query:
- Pagination: `page`, `limit`, `sortBy`
- Search: `searchTerm` (tracking/reference/addresses)

Returns parcels + assignment info (`src/app/modules/Admin/admin.service.ts:45`)

#### `GET /users` (ADMIN)
Query: pagination + `searchTerm` (`src/app/modules/Admin/admin.service.ts:328`)

#### `GET /assignments` (ADMIN)
Query:
- `page`, `limit`, `sortBy` (default `assignedAt`)
- Optional: `agentId`, `parcelId`, `searchTerm` (`src/app/modules/Admin/admin.service.ts:359`)

Returns `{ data, meta, summaryByAgent }`.

#### `POST /assign-agent` (ADMIN)
Body (`src/app/modules/Admin/admin.validation.ts:3`):
```json
{ "parcelId":"uuid", "agentId":"uuid" }
```

#### `POST /update-parcel-status` (ADMIN)
Body (`src/app/modules/Admin/admin.validation.ts:8`):
```json
{ "parcelId":"uuid", "status":"DELIVERED", "remarks":"Delivered successfully" }
```

#### Exports (ADMIN)
- `GET /export/parcels/csv`
- `GET /export/parcels/pdf`
- `GET /export/parcel/csv?parcelId=<uuid>` (or `trackingNumber=PP-...`)
- `GET /export/parcel/pdf?parcelId=<uuid>` (or `trackingNumber=PP-...`)
- `GET /export/users/csv`
- `GET /export/users/pdf`

## Realtime Location Tracking (WebSocket)
Endpoint:
- `ws://localhost:5000/ws`

Protocol (`src/server.ts:49`):
1. Authenticate
```json
{ "type":"auth", "token":"<accessToken>" }
```
Server replies:
```json
{ "type":"auth_ok" }
```

2. Join a parcel room (CUSTOMER can join own parcels, AGENT can join assigned parcels, ADMIN can join any)
```json
{ "type":"join", "parcelId":"<parcel-uuid>" }
```
Server replies:
```json
{ "type":"join_ok", "parcelId":"<parcel-uuid>" }
```

3. Agent publishes updates (AGENT only)
```json
{ "type":"agent_location_update", "parcelId":"<parcel-uuid>", "latitude":23.75, "longitude":90.45, "speedKph":24, "heading":180 }
```
Server replies:
```json
{ "type":"ack", "action":"agent_location_update", "parcelId":"<parcel-uuid>" }
```

4. Everyone in the parcel room receives broadcasts
```json
{ "type":"parcel_location", "parcelId":"<parcel-uuid>", "latitude":23.75, "longitude":90.45, "speedKph":24, "heading":180, "recordedAt":"2025-12-20T10:00:00.000Z" }
```

## Build
```bash
npm run build
```

