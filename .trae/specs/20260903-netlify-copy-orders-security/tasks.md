# BBM Tasks — Netlify env review + Copy Order Details + Order Access Security

Spec path: `.trae/specs/20260903-netlify-copy-orders-security/spec.md`

All tasks reference the Acceptance Criteria in `spec.md` using their `AC-*` IDs. Each task has Test Requirements (TRs) exclusively typed `rule` or `rubric`.

---

## Task 1: Netlify env var fix

**Summary:** Review and correct `netlify.toml` and the server Supabase factory `supabase/client.server.ts`. Remove invalid `[functions] environment` block that tries to forward vars via `"$SUPABASE_*"` interpolation (Netlify does not support variable interpolation inside toml, and env declared under `[functions] environment` in toml doesn't reach Functions runtime at runtime — UI-configured env is the single source of truth and is available as `process.env.*` directly). Ensure `SUPABASE_SERVICE_ROLE_KEY` never leaks through any `VITE_` chain.

**Parent AC coverage:** AC-A1, AC-A2, AC-A3

**Files to change:**
- `netlify.toml`
- `supabase/client.server.ts`

### Actions
1. In `netlify.toml` `[build]`:
   - Remove the `[functions]` section entirely.
   - Keep `[build] command` setting `VITE_SUPABASE_URL="$SUPABASE_URL"` and `VITE_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"` during build (these ARE used — they get baked into client bundle). Keep NODE_VERSION `[build.environment]` as is.
   - Remove any `SUPABASE_SERVICE_ROLE_KEY` export from the build command and any `VITE_SUPABASE_SERVICE_ROLE_KEY`.
   - Keep `node_bundler`? No, it was under the removed `[functions]`. Do NOT add back a functions section. The default esbuild behavior in newer Netlify runtime is correct; if needed, Netlify will auto-detect it.
2. In `supabase/client.server.ts`:
   - Confirm `getSupabaseServiceRoleKey()` ONLY reads `process.env.SUPABASE_SERVICE_ROLE_KEY`.
   - No `import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY` anywhere.
   - `getSupabaseUrl()` / `getSupabaseAnonKey()` continue to check both `process.env.SUPABASE_*` first, then as a last-resort fall back to `import.meta.env.VITE_SUPABASE_*` for SSR environments where UI env is not available but the build-inlined value is.
3. Do NOT touch `supabase/client.ts` (browser client). Continue to use `VITE_` there as before.

### Status: pending

### Test Requirements

| # | ID | Type | Pass Condition | Evidence |
|---|---|---|---|---|
| 1.1 | TR-A1 | rule | `grep '\[functions\]' netlify.toml` returns empty | Grep |
| 1.2 | TR-A2 | rule | `grep -F '"$SUPABASE_SERVICE_ROLE_KEY"' netlify.toml` returns empty; `grep -F 'VITE_SUPABASE_SERVICE_ROLE_KEY' netlify.toml` returns empty; `grep -F 'VITE_SUPABASE_SERVICE_ROLE_KEY' supabase/client.server.ts` returns empty | Grep |
| 1.3 | TR-A3 | rule | Build command contains only VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (no other VITE_* Supabase vars). Confirmed by reading toml build section. | Read |
| 1.4 | TR-A4 | rule | `getSupabaseServiceRoleKey` body references only `process.env.SUPABASE_SERVICE_ROLE_KEY` string literal. | Code inspect |

---

## Task 2: Copy Order Details fallback button (Admin Orders)

**Summary:** Add one button per order card in `_authenticated/admin/` that copies the WhatsApp-ready order summary to the clipboard. Use existing toast + transient feedback. No DB writes.

**Parent AC coverage:** AC-B1…AC-B5, AC-NFR1

**Files to change:**
- `src/lib/whatsapp.ts` (add a new function for admin/admin-view orders: input is an `Order` from `orders.functions.ts`, output is the same `generateBusinessWhatsAppMessage` style string but with bilingual product names mapped from `o.order_items[*].name_en/name_ar`).
- `src/routes/_authenticated/admin.index.tsx` (add one button per card + transient feedback).

### Actions
1. In `lib/whatsapp.ts` add export:
   ```ts
   export function generateAdminOrderCopyMessage(
     order: { /* Pick<Order, order_number, customer_name, phone, phone2,
                           payment_method, subtotal, delivery_fee, total,
                           address, area, city, notes, pickup_deadline_at>
              plus order_items: Array<{name_en, name_ar, qty, unit_price, line_total}> */ },
     lang?: 'en' | 'ar',
   ): string
   ```
   - Internally reuse the same formatting pattern from `generateBusinessWhatsAppMessage` but source fields from the `Order` structure directly.
   - For items, choose the correct name per lang: `lang === 'ar' && it.name_ar ? it.name_ar : it.name_en`.
   - For pickup orders: compute pickup deadline text; for COD orders: include address/area/city; include phone2 if provided; include notes.
2. In `_authenticated/admin.index.tsx`:
   - Add a `copyState: Record<string, boolean>` useState — maps orderId → whether "Copied!" is showing.
   - At the right of each order card's itemized section OR next to the History toggle (preferably: in the same row as the status-change buttons, to avoid pushing other content down), insert a single new button:
     - When `copyState[o.id] !== true`: label "Copy Order Details" (or ar "نسخ تفاصيل الطلب"). Icon: `Copy` from lucide-react (`Copy` imported).
     - When true: label "Copied!" or ar "تم النسخ ✓". Icon: `CheckCircle2` smaller style.
     - `onClick`: call `generateAdminOrderCopyMessage(o, lang)`, write to clipboard, set copyState[o.id]=true, setTimeout(2000) → unset. On write failure (catch), use existing `setToast({ type:'error', text: isAr ? 'تعذّر النسخ' : 'Failed to copy' })`.
   - Must not call any server function mutation, must not call `setStatus`, must not change `orders` cache.
3. Ensure imports are valid (lucide-react `Copy`).
4. Use existing `btn-tap rounded-full px-3 py-1.5 text-xs font-semibold` pattern and `bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground` / while copied: `bg-emerald-500/15 text-emerald-700` so it visually matches existing buttons (see status buttons for style reference).

### Status: pending

### Test Requirements

| # | ID | Type | Pass Condition | Evidence |
|---|---|---|---|---|
| 2.1 | TR-B1 | rule | `generateAdminOrderCopyMessage` returns a string containing: order_number, customer_name, phone, each item's `(name_en or name_ar) × qty`, subtotal, delivery_fee, total, payment_method label, phones, notes/address when present. | Construct a sample Order object, run the function, assert substring presence |
| 2.2 | TR-B2 | rule | Admin orders list renders, one new button per card; button text language matches current lang. | DOM snapshot |
| 2.3 | TR-B3 | rule | After clicking the button for order X, for ~2 s the same button's label is "Copied!" / ar copy state; after reverting it goes back to default label. | Click handler trace |
| 2.4 | TR-B4 | rule | Event handler does NOT contain any call to `mut.mutate`, `setStatus`, `updateOrderStatus`, `fetchOrders.refetch`, `qc.set`/`invalidate`, or localStorage mutation. | Static inspect of onClick |
| 2.5 | TR-B5 | rule | Button classes exactly reuse the rounded-full / text-xs / font-semibold / bg-secondary pattern used by status buttons. No new custom spacing / palette introduced. | Class inspect |
| 2.6 | TR-B6 | rubric | Design fidelity score 0-2. Threshold ≥ 1. Per AC-NFR1 rubric anchors. | Walkthrough |

---

## Task 3: Order security / RLS hardening + order-success authorization

**Summary:**
- Add customer RLS SELECT policies on `orders` and `order_items`.
- Add server function `getOrderByNumberAuthorized` that returns full order+items only for the owner (by access token) or a skeleton otherwise.
- Harden `order-success` page: match `localStorage.bbm.lastOrder.orderNumber` to `?n=` query param before rendering. Prefer server-authorized data when signed in.

**Parent AC coverage:** AC-C1…AC-C8, AC-NFR2

**Files to change:**
- `supabase/migrations/20260903140000_customer_order_rls.sql` (new file)
- `src/lib/orders.functions.ts` (add new server fn + defense-in-depth comment/assertion in listMyOrders)
- `src/routes/order-success.tsx` (auth-aware server fetch + localStorage match check)

### Actions

#### 3a. Supabase RLS migration
Create `supabase/migrations/20260903140000_customer_order_rls.sql`:

```sql
-- Rerunnable (idempotent): Drop + recreate customer read policies for orders & order_items.
-- Staff/admin policies are preserved from migration 20260903131000_unify_has_role_and_rls.
-- We only ADD customer owner-read policies here. If they already exist, drop then recreate.

-- ---------------- Orders: customer reads their own ----------------
DROP POLICY IF EXISTS "customer read own orders" ON public.orders;
CREATE POLICY "customer read own orders" ON public.orders FOR SELECT TO authenticated
USING (user_id IS NOT NULL AND user_id = auth.uid());

-- ---------------- Order items: reads restricted by parent order owner ----------------
DROP POLICY IF EXISTS "customer read own order items" ON public.order_items;
CREATE POLICY "customer read own order items" ON public.order_items FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'staff')
  OR EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id AND o.user_id = auth.uid()
  )
);

-- ---------------- Ensure anon cannot read ----------------
DROP POLICY IF EXISTS "anon cannot read orders" ON public.orders;
CREATE POLICY "anon cannot read orders" ON public.orders FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS "anon cannot read order items" ON public.order_items;
CREATE POLICY "anon cannot read order items" ON public.order_items FOR SELECT TO anon USING (false);
```

Wait — the current `staff read orders` policy (from migration 20260903131000) applies for ALL authenticated users with staff role. It works alongside the new owner policy (Postgres ORs multiple policies). Good.

Apply this migration with the Supabase integration.

#### 3b. Add getOrderByNumberAuthorized server function (orders.functions.ts)

```ts
const getOrderByNumberSchema = z.object({
  orderNumber: z.string().min(3).max(64),
  accessToken: z.string().min(1).optional(),
});

export type OrderAuthorizedView =
  | ({ authorized: true } & Order)
  | { authorized: false; order_number: string; created_at: null; customer_name: null; status: OrderStatus; order_items: []; subtotal: 0; delivery_fee: 0; total: 0 };

export const getOrderByNumberAuthorized = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => parseWithDataOrDirect(getOrderByNumberSchema, d))
  .handler(async ({ data }): Promise<OrderAuthorizedView> => {
    const skeleton: OrderAuthorizedView = {
      authorized: false,
      order_number: data.orderNumber,
      created_at: null,
      customer_name: null,
      status: "new", // not sensitive; shows generic placeholder
      order_items: [],
      subtotal: 0,
      delivery_fee: 0,
      total: 0,
    };
    try {
      // Case A: caller provides an access token
      if (data.accessToken) {
        const uid = await userIdFromToken(data.accessToken);
        if (uid) {
          const privileged = tryGetServiceRoleClient();
          const client = privileged ?? getUserScopedServerClient(data.accessToken);
          const { data: row } = await client
            .from("orders")
            .select("*, order_items(*, products(name_en, name_ar, slug)), order_status_history(*)")
            .eq("order_number", data.orderNumber)
            .maybeSingle();
          if (row) {
            const order = mapOrder(row as Record<string, unknown>);
            if (order.user_id && order.user_id === uid) {
              return { authorized: true, ...order } as OrderAuthorizedView;
            }
            const privilegedCaller = privileged ?? client;
            // staff/admin case: check has_role
            const roles = await fetchUserRoles(privilegedCaller, uid);
            if (roles.includes("admin") || roles.includes("staff")) {
              return { authorized: true, ...order } as OrderAuthorizedView;
            }
          }
        }
      }
      return skeleton;
    } catch (e) {
      console.warn("[getOrderByNumberAuthorized]:", e);
      return skeleton;
    }
  });

// small helper
async function fetchUserRoles(client: SupabaseClient, uid: string): Promise<string[]> {
  const { data } = await client.from("user_roles").select("role").eq("user_id", uid);
  return Array.isArray(data) ? data.map((r) => String((r as { role: unknown }).role)) : [];
}
```

Defense-in-depth: `listMyOrders` already applies `userId` filter; add a code comment that it intentionally double-filters despite RLS.

#### 3c. order-success authorization + localStorage match

In `routes/order-success.tsx`:

1. Import `getOrderByNumberAuthorized`, `auth`, `useServerFn`, `useQuery`, `useEffect`, `useState` (all already present with the exception of `getOrderByNumberAuthorized`).
2. Call server function with token from `auth.getSession()`. Use `useQuery({ queryKey: ['order', n], queryFn: ..., enabled: Boolean(n) })`.
3. Rendering branch:
   - Let `authorizedOrder` = `data?.authorized === true ? data : null`.
   - Let `localOrder` = localStorage-parsed `bbm.lastOrder` only if it exists AND its `orderNumber === n` (exact match).
   - Priority for showing items/customer/price: authorizedOrder (if truthy) → else if localOrder → use localOrder.
   - If neither → show skeleton (unsent state already shown; but when `status !== unsent` and no data, still only show Order Reference box and generic thank-you copy WITHOUT item list, name, phone, address, totals).
4. The `waUrl` generation should use the same priority: authorizedOrder → localOrder. If neither → fall back to plain `https://wa.me/<store_whatsapp>` without custom message.
5. Existing unsent / opened / confirmed state machine remains and continues to depend on the orderStatus localStorage tracker. Nothing else changes in the WhatsApp send UX.

### Status: pending

### Test Requirements

| # | ID | Type | Pass Condition | Evidence |
|---|---|---|---|---|
| 3.1 | TR-C1 | rule | Migration runs without error on the connected BB Supabase. SQL inspect confirms 2 new policies for authenticated customer owner-read, 2 deny policies for anon read. | Migration apply log + SQL inspect |
| 3.2 | TR-C2 | rule | `getOrderByNumberAuthorized` returning full order only when uid matches `orders.user_id` (or user is staff/admin). Returns skeleton otherwise. | Two simulated calls (owner vs stranger vs no token) |
| 3.3 | TR-C3 | rule | `order-success` page's local order details only populate when `bbm.lastOrder.orderNumber === n`. If lastOrder is ORD-A but URL is ORD-B, localDetails not used. | Code inspect of conditional |
| 3.4 | TR-C4 | rule | `order-success` with a logged-in user returns full details only when they are the owner; for a wrong-owner or no-user URL, page shows skeleton (no customer info, no item list, no address/phone). Code path: server skeleton returned → used. | Manual QA of 3 scenarios |
| 3.5 | TR-C5 | rule | Admin account `boeristeph@gmail.com` still lists all orders in `admin/` after migration + new policies. Admin-authorized order fetch via server fn returns full order for any order number. | listOrders return count unchanged |
| 3.6 | TR-C6 | rule | Checkout flow still produces a valid placed order + localStorage `bbm.lastOrder` with matching orderNumber, user lands on /order-success?n=XXX and sees the full items/name/address/detail from matched localStorage or authorized fetch. | E2E local checkout walkthrough |
| 3.7 | TR-NFR2 | rubric | Security depth score 0-2 (per AC-NFR2 rubric). Threshold ≥ 2. | Code + policy checklist |

---

## Task 4: Production build + service-role key leak verification

**Parent AC:** AC-A4, AC-A5

**Files to change:** None. Pure verification.

**Actions:**
1. Run `npm run build` from `/Users/garwechpeter/Downloads/BBM`.
2. Capture output; exit code must be 0.
3. After build, run scans:
   - `grep -rE "SUPABASE_SERVICE_ROLE_KEY|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3dnN2eGFoZWpsbGl4end3eGViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSJ9" dist/client/ 2>/dev/null || echo NO_HIT` — must return NO_HIT or empty / no matches.
   - Specifically, capture the actual 8-char-initial of the real service role key from env and grep. But since we cannot know the secret, rely on `SUPABASE_SERVICE_ROLE_KEY` literal not appearing in client bundle.
   - Also grep any `VITE_SUPABASE_SERVICE_ROLE_KEY` → must be empty.
4. Save the grep output for reference.

### Status: pending

### Test Requirements

| # | ID | Type | Pass Condition | Evidence |
|---|---|---|---|---|
| 4.1 | TR-A4 | rule | `npm run build` exit 0 | Build log tail |
| 4.2 | TR-A5 | rule | `grep -R SUPABASE_SERVICE_ROLE_KEY dist/client` → 0 matches. `grep -R VITE_SUPABASE_SERVICE_ROLE_KEY dist/client` → 0 matches. `grep -R "service_role" dist/client/assets/*.js` only hits strings from SDK (not project env). | Grep output |
| 4.3 | TR-X | rule | Lint of modified files passes with 0 errors. | ESLint output |

---

## Task 5: Independent Review

**Parent AC:** All AC 1–20.

**Actions:**
1. Create `.trae/specs/20260903-netlify-copy-orders-security/review.md`.
2. Run each AC rule check and provide pass evidence.
3. Score AC-NFR1 (design fidelity) and AC-NFR2 (security depth) rubrics.
4. If any actionable issue exists → fail review and create a pending remediation task in `tasks.md` with the exact file/line + fix.
5. Repeat until pass.

### Status: pending
