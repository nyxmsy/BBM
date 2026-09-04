# BBM Spec — Netlify env review + Copy Order Details + Order Access Security

**Repository root:** `/Users/garwechpeter/Downloads/BBM`  
**Authorized admin email:** `boeristeph@gmail.com`  
**Supabase project:** `kwvsvxahejllixzwwxeb` (BBM Beitna — confirmed by user)

---

## 1. Problem, Users, Goals, Non-Goals

### Problem

This spec addresses three separate issues reported by the BBM owner.

**(A) Netlify env var fix review**
After the previous admin-access session, `netlify.toml` received a `[functions]` `environment` block with vars interpolated via `"$SUPABASE_URL"` pattern and also started exporting `SUPABASE_SERVICE_ROLE_KEY` via the build command `VITE_` chain. Per current Netlify docs, neither of those constructs actually forward secrets to Functions at runtime, and placing the service-role key anywhere near the build command `VITE_` chain risks accidentally inlining it into client JS. The server Supabase factory already reads from `process.env`; we only need to ensure the actual env vars configured in Netlify UI are visible to SSR/serverless handlers and that the service-role key is NEVER reachable via a `VITE_` variable.

**(B) WhatsApp fallback: Copy Order Details (admin)**
Orders are sometimes saved to the database (visible in Admin Orders) but the WhatsApp send-flow fails for the customer (OS blocks wa.me, app switch doesn't happen, slow network, etc). Currently the admin has only whatever data is rendered in the order card and must manually compose a WhatsApp message to confirm the order with the customer.

**(C) Order Success / Order Details privacy**
Visiting `/order-success?n=ORD-XXXXX` directly in an incognito or logged-out window currently renders a generic "Thank you" card and reads last-order details from `localStorage.bbm.lastOrder` (which is absent in incognito — so effectively no leak today in that narrow case). However:

- There is **no customer RLS policy** on `public.orders` / `public.order_items` — `authenticated` only has SELECT via the `staff read orders` has_role gate, meaning customer access to their own order data (e.g., future order-detail screens or a malicious JS client calling the Supabase REST API with a valid JWT) **depends entirely on the server functions filtering by user_id manually**, never enforced at the data-access layer.
- `listMyOrders` server function uses the service client with a manual `{ userId }` filter; if that function or any new server code ever forgets the filter, data leaks.
- There is no per-order authorization for direct URL access by number.
- The order-success page accepts the order number as a bare query parameter and only displays stored localStorage data, but any future enhancement that reads real order data for that URL would be exposed without an authorization check.

### Users

1. **BBM staff / admin (`boeristeph@gmail.com`)** — Uses the Admin dashboard on desktop and mobile; needs env vars correctly configured; needs the Copy Order Details button; needs to still see every order.
2. **Authenticated customers (account users)** — Create orders while signed in (`orders.user_id` set to their auth.uid). Must only see their own orders; must never see another customer's data by changing the order number.
3. **Guest customers** — Create orders during checkout without signing in. Immediately after checkout they can see their order details on the order-success page, but only via a short-lived, device-confined mechanism; no one else should be able to re-open their details from that URL later.

### Goals

- **Goal 1:** `netlify.toml` contains no incorrect env-forwarding syntax; server code continues to read `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` only from `process.env`; no `VITE_*` variable ever contains or proxies the service-role key.
- **Goal 2:** Admin orders interface contains a clear "Copy Order Details" fallback button per order; copying produces a WhatsApp-ready message with all required order fields; button gives visible "Copied!" feedback; the feature never resends automatically, never creates a duplicate order, never mutates order status.
- **Goal 3:** Customer order privacy is enforced both at the RLS level **and** in every server/data-access path. The following scenarios must pass:
  - Customer A creates an order → can see their own order details.
  - Customer A changes the order number in the URL to Customer B's order → no private details rendered.
  - A logged-out/incognito user opens any order-success URL → no private order/customer data is shown beyond a generic confirmation skeleton.
  - Customer A's order history returns only Customer A's orders.
  - Admin access to all orders is preserved.
- **Goal 4:** Existing checkout flow, order placement, WhatsApp wa.me link generation, Admin RLS, and overall design remain unchanged.

### Non-Goals (out of scope)

- Re-designing the Admin dashboard UI (adds only one button + one toast-style feedback slot).
- Changing how WhatsApp Business API or wa.me links work.
- Adding email/print/PDF functionality.
- Replacing Supabase authentication or rewriting the order-placement model.
- Rewriting guest checkout into auth-required checkout.
- General-purpose API tokens or customer-facing order-detail URLs beyond the existing /order-success page.
- Changing the existing `orders.user_id` ownership relationship.

---

## 2. Functional Requirements

### FR-A (Netlify env var fix)

- FR-A1: Remove any `[functions]` block that attempts to forward env vars inside `netlify.toml`.
- FR-A2: Remove any `"$OTHER_VAR"` interpolation-style forwarding inside `netlify.toml`. Netlify UI-configured variables should be referenced by their real names at runtime, not aliased via toml.
- FR-A3: The build command MUST continue to set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (inlined by Vite into the client bundle), because the client-side Supabase instance needs them.
- FR-A4: The build command MUST **not** introduce a `VITE_SUPABASE_SERVICE_ROLE_KEY` or otherwise expose the service-role key through any `VITE_` chain.
- FR-A5: All four server factories in `supabase/client.server.ts` (`getAnonServerClient`, `getUserScopedServerClient`, `getServiceRoleClient`, `tryGetServiceRoleClient`) read only `process.env.*` (no `VITE_`) for their **server-only** keys. The only fallback they may check is `import.meta.env` for the inlined `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` as a **build-inlined last resort** for cases where SSR process env is truly missing — but never for the service-role key (it stays strictly `process.env.SUPABASE_SERVICE_ROLE_KEY`).
- FR-A6: Existing `realtime: { enabled: false }` and `autoRefreshToken: false` on server-side clients must remain (removes WebSocket warning in SSR).

### FR-B (Copy Order Details fallback)

- FR-B1: In the Admin Orders dashboard (`_authenticated/admin/` route), every rendered order card has exactly one new action button with the label **Copy Order Details** (and Arabic copy when `lang === "ar"`).
- FR-B2: Clicking the button writes a single plain-text, WhatsApp-ready string to the system clipboard via the Clipboard API (`navigator.clipboard.writeText`).
- FR-B3: Copied message contains: order number; customer name; ordered products with names × quantities × subtotals; overall subtotal; delivery fee; total; payment method (Store Pickup vs Cash on Delivery); delivery area/address if COD; pickup deadline if Store Pickup; customer phone(s); customer notes if present.
- FR-B4: The message format matches or extends the existing `generateBusinessWhatsAppMessage` pattern in `src/lib/whatsapp.ts` (AR/EN bilingual support consistent with the rest of the app).
- FR-B5: After a successful copy, the button briefly changes its visual state to "Copied!" for ~2 seconds, then reverts to "Copy Order Details". Failure to copy (e.g., HTTPS-only restriction, permission denied) shows an error toast — the existing `setToast` infrastructure is reused; a new toast type "error" is not needed but the text must be specific.
- FR-B6: Clicking this button MUST NOT: duplicate an order, change any order status (database write), call `updateOrderStatus`, mark WhatsApp status, mutate localStorage, or redirect. It is clipboard-only.
- FR-B7: The button is hidden for anonymous viewers and only rendered inside the authenticated Admin Orders dashboard (preserves existing admin-only access).
- FR-B8: No change is made to existing status-change buttons, order cards, revenue summaries, filter tabs, cancellation modals, or toasts. Only one new button per card + one transient feedback state.

### FR-C (Order access security)

- FR-C1: Add RLS SELECT policies on `public.orders` so that:
  - Admin/staff (`has_role(auth.uid(),'admin')` or `'staff'`) can read any order.
  - An authenticated customer can read exactly the rows where `orders.user_id = auth.uid()`.
  - Logged-out/anon cannot read any order row.
- FR-C2: Add RLS SELECT policies on `public.order_items` so that:
  - Admin/staff can read all order_items.
  - An authenticated customer can read order_items whose parent `order` has `orders.user_id = auth.uid()` (use `EXISTS (...)` subquery on `orders` via `order_id` FK).
  - Logged-out/anon cannot read any order_items.
- FR-C3: INSERT and UPDATE RLS on orders remains as-is (current: gated on staff role; the server uses service-role writes). Customers do not need direct INSERT/UPDATE against the `orders` table via REST, since placement is wrapped in server functions.
- FR-C4: The `listMyOrders` server function must continue passing an explicit `{ userId }` filter as defense-in-depth (double-checked against the token), even though RLS now also restricts.
- FR-C5: A new server function `getOrderByNumberAuthorized` is introduced that takes `{ orderNumber: string, accessToken?: string }` and returns:
  - Full order + items IF:
    - `accessToken` is present AND its resolved `auth.uid()` equals the order's `orders.user_id`, OR
    - the caller additionally provides a short-lived checkout verification token (see FR-C6) that matches the order's one-time secret persisted at placement time (for the immediate post-checkout unauthenticated UX window).
  - A stripped, non-sensitive summary (`{ orderNumber, created_at: null, items: null, … }`) otherwise, so the UI can still render a generic "thank you / order received" skeleton without leaking private details.
  - Never throws for an unknown order number (treats "not found" the same as "not authorized" to avoid enumeration, returning only a skeleton).
- FR-C6: To support the immediate post-checkout unauthenticated success window without exposing bare order numbers as auth:
  - At order-placement time in `checkout.tsx`, immediately after `placeOrder` returns, generate a 32-byte cryptographically random string (`crypto.getRandomValues` or `crypto.randomUUID`) called `order_access_secret`.
  - Store it in localStorage keyed specifically to that order number, e.g. `bbm.order_access_secret.${orderNumber}`, with a companion `bbm.order_access_expires.${orderNumber}` set to 15 minutes in the future (short-lived, matches the UX time-of-checkout window).
  - Also write it to a transient in-memory structure server-side via a new pair of server functions? No — use a simpler, equivalent approach: the new `getOrderByNumberAuthorized` accepts `{ orderNumber, maybeSecret?: string, accessToken?: string }`; on the server we cannot persist a transient secret without a schema change. So instead, this secret is stored ONLY in localStorage (device-bound, short-lived). The server function's unauthenticated branch then requires the client to pass `maybeSecret` AND the caller must additionally prove that the ORDER NUMBER + SECRET combination was minted at placement time. To avoid needing a DB column, we simply use the same localStorage mechanism for the unauthenticated branch: the order-success component first tries the authorized/session path; if that yields a skeleton, it reads the secret from localStorage and re-submits.
    - Actually simpler equivalent that doesn't require schema changes: **The post-checkout UX already has a short-lived, device-bound data in `bbm.lastOrder` localStorage that contains the actual order items and customer info.** That's device-local, not server-returned. To meet security requirements:
      - The `order-success` page uses `getOrderByNumberAuthorized` with the current access token; if authorized, it displays server-returned data (truth source).
      - If server says unauthorized AND localStorage has a fresh `bbm.lastOrder` whose `orderNumber` === `n` query param, display that localStorage-sourced order data (this covers the unauthenticated post-checkout window — data never left the user's device, so it's not a leak).
      - Else: display only the generic order-received skeleton that shows: `Order Reference: ${n || "—"}` and the "Thanks" copy, with NO item list, NO customer name/phone/address, NO price breakdown.
  - This approach meets "Secure mechanism, does not expose the order to unauthorized users" because the server never hands back private info; localStorage only shows what the same device just submitted during checkout.
- FR-C7: `order-success` page MUST validate `localStorage.bbm.lastOrder.orderNumber === n` (query param) before rendering customer/items data sourced from localStorage. Currently it uses the data unconditionally if localStorage is populated. This FR ensures `/order-success?n=ORD-OTHER` doesn't render my locally-stored details under a different order number reference.
- FR-C8: Same authorization logic applies to `/account` order history — `listMyOrders` already filters by token `userId`, now RLS independently enforces it.

---

## 3. Non-Functional Requirements

- **NFR-1** (Zero design drift): Beyond adding one button per Admin order card and the transient copy confirmation feedback, the visual layout of all pages must remain pixel-identical to the current code. No new fonts, colors, spacing system changes, new components, route navigation, or logos.
- **NFR-2** (Service-role key never in client bundle): After a production build, a `grep -r <service-role-prefix-4-chars> dist/client/` and/or `grep SUPABASE_SERVICE_ROLE_KEY dist/client/assets/*.js` **must yield no hits**. `SUPABASE_SERVICE_ROLE_KEY` is only present in `dist/server/**` or not inlined at all (read from runtime env).
- **NFR-3** (TypeScript strict): All changes compile cleanly with the existing `tsconfig.json`. No new `// @ts-ignore` or `any` without a comment explaining why.
- **NFR-4** (No regression): The existing lint/eslint config must pass on all modified files. No new build warnings introduced by the changes.
- **NFR-5** (RLS correctness): New policies on `orders` and `order_items` must not break admin use. Specifically, `staff read orders`/`staff update orders`/`admins delete orders` policies are preserved alongside the new customer-owner-read policies.
- **NFR-6** (Idempotent SQL): The migration file that introduces RLS policies is rerunnable / idempotent (uses `CREATE POLICY … IF NOT EXISTS` or `DROP POLICY IF EXISTS …; CREATE POLICY …`).
- **NFR-7** (Auditable): All new server functions carry an explicit `accessToken` input or intentionally document the unauthenticated branches.

---

## 4. Constraints, Dependencies, Assumptions, Open Questions

### Constraints
- No Supabase schema additions beyond optional policies (no new tables/columns without user approval). C6 above was designed specifically to avoid schema changes by reusing localStorage for the short-lived device-bound unauthenticated UX window.
- `SUPABASE_SERVICE_ROLE_KEY` must **never** be reachable from `import.meta.env`, `VITE_`, or any client bundle.
- Existing order-placement RPCs (`create_cod_order`, direct inserts) and the `placeOrder` server function cannot be removed; they remain the authoritative write path.
- Existing WhatsApp UI flow (Open WhatsApp → Confirm Sent → Received Thank You) cannot be altered; the new button is purely additive in Admin.
- The Admin Orders dashboard still needs full visibility into all orders; policies must not break that.

### Dependencies
- Current `@tanstack/react-start` `createServerFn` framework (used in `orders.functions.ts` and `admin.functions.ts`).
- Current Clipboard API availability in modern browsers (assumed: Admin uses desktop/mobile browsers with `navigator.clipboard.writeText` in secure contexts; falls back gracefully to a toast on failure).
- Existing migrations framework (`supabase/migrations/*.sql` applied in order; Netlify deploy hook or user applies via `supabase db push`).
- Existing translations object `lib/i18n.tsx` — new button strings may be added as inline ternaries to avoid touching the entire translation keyset; if keys exist in similar style, reuse them.

### Assumptions
1. The user will configure `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` **directly in the Netlify UI under Site configuration → Environment variables**. These are already set per the user's statement: *"My Supabase variables are already configured in the Netlify UI."* The toml fix simply removes incorrect constructs.
2. Netlify Functions runtime does indeed expose UI-configured env vars via `process.env` directly (standard Netlify behavior).
3. For FR-C6 the unauthenticated immediate-success UX window is acceptable to be device-local-only (since it originates from the same user's form input moments earlier). If we later want cross-device access, a schema change (e.g., short-order-secret column on `orders` with expiration) can be introduced as a separate change.

### Open Questions
Resolved in-spec, no open questions requiring user input before implementation.

---

## 5. Acceptance Criteria

All ACs are typed as **rule** (binary yes/no) or **rubric** (evaluative, scored 0–2 with threshold ≥ 1).

| # | ID | Type | Statement / Pass Condition | Evidence Source |
|---|---|---|---|---|
| 1 | AC-A1 | rule | `netlify.toml` contains no `[functions]` block and no `"$SUPABASE_*"` interpolations | Grep `netlify.toml` |
| 2 | AC-A2 | rule | Build command in `netlify.toml` only sets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` via `"$SUPABASE_URL"` / `"$SUPABASE_ANON_KEY"` pattern (values sourced from Netlify UI during build). No `VITE_SUPABASE_SERVICE_ROLE_KEY`. | Read `netlify.toml` `[build].command` |
| 3 | AC-A3 | rule | Server Supabase clients read `SUPABASE_SERVICE_ROLE_KEY` only from `process.env.SUPABASE_SERVICE_ROLE_KEY`; no `import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY` reference exists anywhere. | Grep `SUPABASE_SERVICE_ROLE_KEY` in `supabase/client.server.ts` + all `src/` |
| 4 | AC-A4 | rule | Production build completes successfully. `npm run build` exit code 0. | Build log |
| 5 | AC-A5 | rule | Service-role key is absent from all `dist/client/**` assets. Grep any 8-char prefix of the service key across `dist/client/` → 0 matches. Also grep literal `SUPABASE_SERVICE_ROLE_KEY` in `dist/client/assets/*.js` → 0 matches. | Build artifact scan |
| 6 | AC-B1 | rule | Admin Orders dashboard renders one "Copy Order Details" button per order card. Arabic label shown when `lang === "ar"`. | Snapshot / DOM inspect of `_authenticated/admin/` |
| 7 | AC-B2 | rule | Clicking the button calls `navigator.clipboard.writeText` with a single string that contains all required fields (order number, customer name, products × qty × subtotals, subtotal/delivery/total, payment method, address-or-pickup-deadline, phones, notes if any). | Clipboard inspection / unit string assertion on helper output |
| 8 | AC-B3 | rule | Button visually flips to "Copied!" state for ~1.5–2.5 s then reverts. Clipboard write failure triggers an error toast using existing toast infrastructure. | Manual QA / event simulation |
| 9 | AC-B4 | rule | Clicking Copy Order Details does **not** invoke `updateOrderStatus`, `placeOrder`, `mut.mutate`, or any database write / server function mutation that changes the order. | Code inspection: event handler contains only clipboard code; trace toasts only; no side effects. |
| 10 | AC-B5 | rule | All existing status buttons, filters, counts, modals, toasts remain behaviorally identical and at the same DOM positions. | DOM diff excluding new button |
| 11 | AC-C1 | rule | `orders` table has a customer-read RLS policy: `authenticated` may SELECT rows where `user_id = auth.uid()`, in addition to the existing staff/admin gate. | `pg_policy` / migration SQL inspection |
| 12 | AC-C2 | rule | `order_items` table has a customer-read RLS policy equivalent to: `EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid())`, in addition to the existing staff/admin gate. | `pg_policy` / migration SQL inspection |
| 13 | AC-C3 | rule | New `getOrderByNumberAuthorized` server function returns full order + items only when caller's access token matches `orders.user_id`; otherwise returns a non-sensitive skeleton (no customer info, no items, no addresses, no phones). | Unit-style assertions on server function outputs (mock tokens, two users) |
| 14 | AC-C4 | rule | `order-success` page shows skeleton-only (no item/customer data) when: (a) localStorage has no matching lastOrder for `?n=…`; or (b) localStorage has a lastOrder whose `orderNumber` does not match `?n=…`; or (c) caller is not the owner and no valid token is present. | Manual QA: incognito, wrong `?n=` param, other user signed in |
| 15 | AC-C5 | rule | `order-success` page's localStorage-sourced data only renders when `localStorage.bbm.lastOrder.orderNumber === Route.useSearch().n`. Fixes the current match-omission bug. | DOM snapshot |
| 16 | AC-C6 | rule | Account route `listMyOrders` for Customer A never returns Customer B's rows (both server-application of `userId` filter + RLS enforce). | Manually swap session cookie / use two test accounts |
| 17 | AC-C7 | rule | Admin account `boeristeph@gmail.com` still views all orders in Admin dashboard after the migration; no staff/admin read regression. | Admin dashboard listOrders server function call returns all orders |
| 18 | AC-C8 | rule | Checkout→placeOrder→navigate order-success flow continues to work (functional parity). Customer sees their placed order's items/detail right after checkout from localStorage-matched record, then skeleton after clearing localStorage. | E2E-ish walk |
| 19 | AC-NFR1 | rubric | **Design fidelity (0-2)**. Threshold 1. **0**: layout noticeably changed beyond one button; **1**: only one new button + transient feedback are visible; no colors, fonts, spacing drift; **2**: new button visually matches existing action buttons (rounded-full, text-xs font-semibold, gap consistent); Arabic label doesn't overflow; transient "Copied!" state uses existing toast/toggle-label pattern, no new component system introduced. | Design walkthrough / screenshots |
| 20 | AC-NFR2 | rubric | **Security depth (0-2)**. Threshold 2. **0**: only RLS or only server-filter works; **1**: RLS + server-filter both exist but one has a narrow bypass; **2**: (a) RLS independently restricts SELECT on orders/order_items for customers; (b) server functions independently apply owner filters; (c) order-success refuses to show unmatched localStorage data; (d) unauthorized URL loads show skeleton only. | Code + policy review checklist |
