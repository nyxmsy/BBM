-- Fix has_role function overload ambiguity and storage RLS policy enum casts.
-- Idempotent. Safe to re-run.

-- Drop ALL has_role overloads first, then recreate a single text-based implementation.
-- This removes ambiguity caused by mixing signatures (uuid, text) vs (uuid, app_role) vs (uuid, user_role).
-- CASCADE because RLS policies reference has_role and we will recreate them afterwards below.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'has_role'
  LOOP
    EXECUTE format('DROP FUNCTION %s CASCADE', r.sig);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.has_role(p_user_id uuid, p_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id AND role::text = p_role
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO anon, authenticated;

-- 2) Drop & re-create storage bucket RLS policies using the text-based has_role signature
--    (the old ones cast strings to app_role which is missing/renamed).
DROP POLICY IF EXISTS "staff read product images" ON storage.objects;
CREATE POLICY "staff read product images" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'product-images' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')));

DROP POLICY IF EXISTS "staff upload product images" ON storage.objects;
CREATE POLICY "staff upload product images" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-images' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')));

DROP POLICY IF EXISTS "staff update product images" ON storage.objects;
CREATE POLICY "staff update product images" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'product-images' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')));

DROP POLICY IF EXISTS "staff delete product images" ON storage.objects;
CREATE POLICY "staff delete product images" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-images' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')));

-- 3) Refresh all other has_role RLS on tables to ensure they use the text signature.
--    (these already do, but reaffirm to be safe: policies in 20260816164751 migration used public.has_role(auth.uid(),'admin'::app_role).
--    -> Migrations 20260831140000_order_accounts_inventory.sql already recreated these with text-based calls.
--    Just ensure 20260816164751 migration products policy uses app_role casts — recreate to be safe.

DROP POLICY IF EXISTS "admins manage products" ON public.products;
CREATE POLICY "admins manage products" ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

DROP POLICY IF EXISTS "staff read orders" ON public.orders;
CREATE POLICY "staff read orders" ON public.orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

DROP POLICY IF EXISTS "staff update orders" ON public.orders;
CREATE POLICY "staff update orders" ON public.orders FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

DROP POLICY IF EXISTS "admins delete orders" ON public.orders;
CREATE POLICY "admins delete orders" ON public.orders FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "staff read order items" ON public.order_items;
CREATE POLICY "staff read order items" ON public.order_items FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

-- Re-create cascade-dropped inventory_movements policies.
GRANT SELECT ON public.inventory_movements TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.inventory_movements TO authenticated;
DROP POLICY IF EXISTS "staff read inventory movements" ON public.inventory_movements;
CREATE POLICY "staff read inventory movements" ON public.inventory_movements FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

DROP POLICY IF EXISTS "staff create inventory movements" ON public.inventory_movements;
CREATE POLICY "staff create inventory movements" ON public.inventory_movements FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

-- Re-create cascade-dropped product_images policies.
GRANT SELECT ON public.product_images TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
DROP POLICY IF EXISTS "public can view product images" ON public.product_images;
CREATE POLICY "public can view product images" ON public.product_images
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "staff manage product images" ON public.product_images;
CREATE POLICY "staff manage product images" ON public.product_images FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

-- Re-create cascade-dropped order_status_history policies (from 20260902150000_fix_missing_schema.sql).
DROP POLICY IF EXISTS order_status_history_read ON public.order_status_history;
CREATE POLICY order_status_history_read
ON public.order_status_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_status_history.order_id
      AND (o.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.user_roles r
        WHERE r.user_id = auth.uid() AND r.role::text IN ('admin', 'staff')
      ))
  )
);

DROP POLICY IF EXISTS order_status_history_write ON public.order_status_history;
CREATE POLICY order_status_history_write
ON public.order_status_history FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = auth.uid() AND r.role::text IN ('admin', 'staff')
  )
  OR changed_by IS NULL
);
