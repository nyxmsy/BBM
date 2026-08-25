# BBM Household Store — Juba, South Sudan

Online storefront and staff administration dashboard for BBM Household.

## Features

- **Storefront**: High-performance e-commerce catalog, categories, product details, search, cart, and wishlist with English & Arabic localization.
- **Checkout**: Guest checkout supporting Cash on Delivery (COD), M-Pesa, and Store Pickup.
- **Staff Admin Dashboard**: Orders management (status tracking, customer details) and product catalog management (create, update, stock toggle, image uploads).

## Tech Stack

- **Framework**: TanStack Start (SSR + Server Functions)
- **Routing**: TanStack Router
- **State & Data**: TanStack Query
- **Styling**: Tailwind CSS + Radix UI Primitives
- **Language**: TypeScript + React 19

## Development

```sh
npm install
npm run dev
```

The application will start on `http://localhost:8080`.

## Staff & admin access

The public store does not show a staff login in the mobile menu. Store owners and staff should use one of these paths:

1. **Direct URL (recommended):** go to `/auth` to sign in. After a successful session, the app sends you to `/admin`.
2. **Dashboard URL:** go to `/admin`. Unauthenticated visitors are redirected to `/auth`.
3. **Subtle footer link:** the storefront footer includes a low-contrast **Staff** link that opens `/auth`. It is intentionally easy to miss for shoppers.

Only accounts with an `admin` or `staff` role in the database can use the dashboard. The first authenticated user can claim the initial admin role if none exists yet.
