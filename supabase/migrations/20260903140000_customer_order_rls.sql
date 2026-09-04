-- Customer order-read RLS policies + anon deny + defense in depth.
-- Idempotent: drop if exists + (re)create. Safe to rerun.

-- =========================================================
-- 1. ORDERS: authenticated customer reads ONLY rows where user_id = auth.uid().
--    Staff/admin continue to read all orders via existing staff read orders policy
--    from migration 20260903131000_unify_has_role_and_rls.sql (Postgres ORs multiple policies).
-- =========================================================
DROP POLICY IF EXISTS "customer read own orders" ON public.orders;
CREATE POLICY "customer read own orders" ON public.orders FOR SELECT TO authenticated
USING (user_id IS NOT NULL AND user_id = auth.uid());

-- =========================================================
-- 2. ORDER_ITEMS: customer reads ONLY items whose parent order is theirs.
--    Staff/admin keep full access via the OR-branch has_role checks in this same policy.
--    (Postgres evaluates each policy with OR, so this policy's staff branch is
--     redundant but explicit and does not interfere with the separate
--     "staff read order items" policy that already exists.)
-- =========================================================
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

-- =========================================================
-- 3. ANON: never allow any read access to orders or order_items.
--    Without explicit deny, the absence of a policy for role=anon means
--    default-deny, but we add explicit policies anyway for audibility.
-- =========================================================
DROP POLICY IF EXISTS "anon cannot read orders" ON public.orders;
CREATE POLICY "anon cannot read orders" ON public.orders FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS "anon cannot read order items" ON public.order_items;
CREATE POLICY "anon cannot read order items" ON public.order_items FOR SELECT TO anon USING (false);
