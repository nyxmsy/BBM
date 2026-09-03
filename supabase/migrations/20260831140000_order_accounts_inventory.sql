-- ============================================================================
-- CONSOLIDATED MIGRATION: Orders, Inventory, Deferred Stock Deduction
-- Safe to re-run (idempotent). Replaces the two conflicting drafts.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1: Normalize `orders` column names (fixes the 42601 syntax error).
-- Postgres only allows ONE column per RENAME COLUMN statement, and each
-- rename below is guarded so it only runs if the old name exists and the
-- new name doesn't -- safe to run multiple times.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='phone')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='customer_phone') THEN
    ALTER TABLE public.orders RENAME COLUMN phone TO customer_phone;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='phone2')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='customer_alt_phone') THEN
    ALTER TABLE public.orders RENAME COLUMN phone2 TO customer_alt_phone;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='notes')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='delivery_notes') THEN
    ALTER TABLE public.orders RENAME COLUMN notes TO delivery_notes;
  END IF;
END $$;

-- Add any columns that are still missing after the renames above.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_alt_phone text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_notes text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS inventory_deducted boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS orders_user_id_idx ON public.orders (user_id);

-- ----------------------------------------------------------------------------
-- STEP 2: Normalize `order_items` column names (same one-rename-per-statement fix).
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='order_items' AND column_name='qty')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='order_items' AND column_name='quantity') THEN
    ALTER TABLE public.order_items RENAME COLUMN qty TO quantity;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='order_items' AND column_name='line_total')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='order_items' AND column_name='total_price') THEN
    ALTER TABLE public.order_items RENAME COLUMN line_total TO total_price;
  END IF;
END $$;

ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE CASCADE;

-- ----------------------------------------------------------------------------
-- STEP 2.5: has_role -- this was missing entirely. Reads your existing
-- user_roles table (user_id, role, created_at). Compares role::text so it
-- doesn't matter what your role enum type is actually named.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- STEP 3: Supporting tables (from your second draft -- these were fine as-is).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_images TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT ALL ON public.product_images TO service_role;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public can view product images" ON public.product_images;
CREATE POLICY "public can view product images" ON public.product_images
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "staff manage product images" ON public.product_images;
CREATE POLICY "staff manage product images" ON public.product_images FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('sale', 'cancellation', 'adjustment', 'restock')),
  quantity_change integer NOT NULL,
  previous_stock integer NOT NULL,
  new_stock integer NOT NULL,
  reason text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- If inventory_movements already existed with a different shape (e.g. it has
-- `notes` instead of the columns below, or `reason` is a custom enum type
-- rather than text), the CREATE TABLE IF NOT EXISTS above was a no-op and
-- left the old structure in place. Reconcile it here rather than assuming
-- a fresh table.
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS movement_type text;
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS previous_stock integer NOT NULL DEFAULT 0;
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS new_stock integer NOT NULL DEFAULT 0;
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS notes text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_movements_movement_type_check'
  ) THEN
    ALTER TABLE public.inventory_movements
      ADD CONSTRAINT inventory_movements_movement_type_check
      CHECK (movement_type IN ('sale', 'cancellation', 'adjustment', 'restock'));
  END IF;
END $$;

GRANT SELECT ON public.inventory_movements TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.inventory_movements TO authenticated;
GRANT ALL ON public.inventory_movements TO service_role;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read inventory movements" ON public.inventory_movements;
CREATE POLICY "staff read inventory movements" ON public.inventory_movements FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

DROP POLICY IF EXISTS "staff create inventory movements" ON public.inventory_movements;
CREATE POLICY "staff create inventory movements" ON public.inventory_movements FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

-- ----------------------------------------------------------------------------
-- STEP 4: RLS for customers reading their own orders.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "customers read own orders" ON public.orders;
CREATE POLICY "customers read own orders" ON public.orders
  FOR SELECT TO authenticated
  USING (user_id IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "customers read own order items" ON public.order_items;
CREATE POLICY "customers read own order items" ON public.order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "public place orders" ON public.orders;
CREATE POLICY "public place orders" ON public.orders
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "public place order items" ON public.order_items;
CREATE POLICY "public place order items" ON public.order_items
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

GRANT INSERT ON public.orders TO anon, authenticated;
GRANT INSERT ON public.order_items TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- STEP 5: create_cod_order -- validates stock/items, generates ORD-XXXXX,
-- inserts order + items, links user_id if authenticated.
-- NOTE: this version does NOT deduct stock at order time -- deduction is
-- deferred to update_order_status, per your spec.
--
-- Drop EVERY existing overload of this function first, whatever its
-- signature -- this is what the hardcoded DROP FUNCTION lines were missing,
-- which is why the GRANT below kept erroring as ambiguous.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'create_cod_order'
  LOOP
    EXECUTE format('DROP FUNCTION %s', r.sig);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.create_cod_order(
  p_customer_name text,
  p_customer_phone text,
  p_customer_alt_phone text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_area text DEFAULT NULL,
  p_city text DEFAULT 'Juba',
  p_delivery_notes text DEFAULT NULL,
  p_payment_method text DEFAULT 'cod',
  p_items jsonb DEFAULT '[]'::jsonb,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_order_number text;
  v_subtotal integer := 0;
  v_delivery_fee integer;
  v_total integer;
  v_item_record jsonb;
  v_product_id uuid;
  v_product_slug text;
  v_quantity integer;
  v_unit_price integer;
  v_item_total integer;
  v_current_stock integer;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one item';
  END IF;

  v_delivery_fee := CASE WHEN p_payment_method = 'pickup' THEN 0 ELSE 3000 END;

  -- Validate items and lock rows so stock can't be oversold across
  -- concurrent checkouts, even though we don't deduct yet.
  FOR v_item_record IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_slug := v_item_record->>'slug';
    v_quantity := (v_item_record->>'qty')::integer;

    SELECT id, price, stock INTO v_product_id, v_unit_price, v_current_stock
    FROM public.products
    WHERE slug = v_product_slug AND is_active = true
    FOR UPDATE;

    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'Product not found or inactive: %', v_product_slug;
    END IF;

    IF v_current_stock < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for % (available: %, requested: %)',
        v_product_slug, v_current_stock, v_quantity;
    END IF;

    v_subtotal := v_subtotal + (v_unit_price * v_quantity);
  END LOOP;

  v_total := v_subtotal + v_delivery_fee;
  v_order_number := 'ORD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));

  INSERT INTO public.orders (
    order_number, customer_name, customer_phone, customer_alt_phone,
    address, area, city, delivery_notes, payment_method,
    subtotal, delivery_fee, total, status, user_id, inventory_deducted
  ) VALUES (
    v_order_number, p_customer_name, p_customer_phone, p_customer_alt_phone,
    p_address, p_area, COALESCE(p_city, 'Juba'), p_delivery_notes, p_payment_method,
    v_subtotal, v_delivery_fee, v_total, 'new', p_user_id, false
  ) RETURNING id INTO v_order_id;

  FOR v_item_record IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_slug := v_item_record->>'slug';
    v_quantity := (v_item_record->>'qty')::integer;

    SELECT id, price INTO v_product_id, v_unit_price
    FROM public.products WHERE slug = v_product_slug;

    v_item_total := v_unit_price * v_quantity;

    INSERT INTO public.order_items (
      order_id, product_id, product_slug, name_en, name_ar, quantity, unit_price, total_price
    )
    SELECT v_order_id, id, slug, name_en, name_ar, v_quantity, v_unit_price, v_item_total
    FROM public.products WHERE id = v_product_id;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal', v_subtotal,
    'delivery_fee', v_delivery_fee,
    'total', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_cod_order(
  text, text, text, text, text, text, text, text, jsonb, uuid
) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- STEP 6: update_order_status -- admin/staff only. Deducts stock exactly
-- once when an order first reaches a sold state, and restores it exactly
-- once if a previously-deducted order is cancelled. Guarded by
-- inventory_deducted so it's safe against repeated status changes.
--
-- Same overload-cleanup treatment as STEP 5, for the same reason.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'update_order_status'
  LOOP
    EXECUTE format('DROP FUNCTION %s', r.sig);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id uuid,
  p_new_status text,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status text;
  v_order_number text;
  v_deducted boolean;
  v_item_record record;
  v_product_id uuid;
  v_quantity integer;
  v_current_stock integer;
  v_sold boolean;
BEGIN
  IF NOT (public.has_role(p_user_id, 'admin') OR public.has_role(p_user_id, 'staff')) THEN
    RAISE EXCEPTION 'Unauthorized: Only admin or staff can update order status';
  END IF;

  IF p_new_status NOT IN (
    'new', 'processing', 'completed', 'picked_up', 'delivered', 'cancelled',
    'confirmed', 'out_for_delivery'
  ) THEN
    RAISE EXCEPTION 'Invalid order status: %', p_new_status;
  END IF;

  SELECT status, order_number, COALESCE(inventory_deducted, false)
    INTO v_current_status, v_order_number, v_deducted
  FROM public.orders
  WHERE id = p_order_id;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  v_sold := p_new_status IN ('completed', 'picked_up', 'delivered');

  IF v_sold AND NOT v_deducted THEN
    FOR v_item_record IN
      SELECT product_id, quantity FROM public.order_items WHERE order_id = p_order_id
    LOOP
      v_product_id := v_item_record.product_id;
      v_quantity := v_item_record.quantity;
      IF v_product_id IS NULL OR v_quantity IS NULL THEN CONTINUE; END IF;

      SELECT stock INTO v_current_stock FROM public.products WHERE id = v_product_id FOR UPDATE;
      UPDATE public.products SET stock = GREATEST(0, stock - v_quantity) WHERE id = v_product_id;

      INSERT INTO public.inventory_movements (
        product_id, order_id, movement_type, quantity_change, previous_stock, new_stock, notes, created_by
      ) VALUES (
        v_product_id, p_order_id, 'sale', -v_quantity, v_current_stock, GREATEST(0, v_current_stock - v_quantity),
        'Order ' || v_order_number, p_user_id
      );
    END LOOP;
    UPDATE public.orders SET inventory_deducted = true WHERE id = p_order_id;
  END IF;

  IF p_new_status = 'cancelled' AND v_deducted AND v_current_status <> 'cancelled' THEN
    FOR v_item_record IN
      SELECT product_id, quantity FROM public.order_items WHERE order_id = p_order_id
    LOOP
      v_product_id := v_item_record.product_id;
      v_quantity := v_item_record.quantity;
      IF v_product_id IS NULL OR v_quantity IS NULL THEN CONTINUE; END IF;

      SELECT stock INTO v_current_stock FROM public.products WHERE id = v_product_id FOR UPDATE;
      UPDATE public.products SET stock = stock + v_quantity WHERE id = v_product_id;

      INSERT INTO public.inventory_movements (
        product_id, order_id, movement_type, quantity_change, previous_stock, new_stock, notes, created_by
      ) VALUES (
        v_product_id, p_order_id, 'cancellation', v_quantity, v_current_stock, v_current_stock + v_quantity,
        'Order cancellation: ' || v_order_number, p_user_id
      );
    END LOOP;
    UPDATE public.orders SET inventory_deducted = false WHERE id = p_order_id;
  END IF;

  UPDATE public.orders SET status = p_new_status, updated_at = now() WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'order_number', v_order_number,
    'old_status', v_current_status,
    'new_status', p_new_status
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_order_status(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_order_status(uuid, text, uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- STEP 7: Manual inventory adjustment (admin/staff only).
-- Same overload-cleanup treatment.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'adjust_inventory'
  LOOP
    EXECUTE format('DROP FUNCTION %s', r.sig);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.adjust_inventory(
  p_product_id uuid,
  p_quantity_change integer,
  p_reason text DEFAULT 'Manual adjustment',
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_stock integer;
  v_new_stock integer;
  v_product_slug text;
BEGIN
  IF NOT (public.has_role(p_user_id, 'admin') OR public.has_role(p_user_id, 'staff')) THEN
    RAISE EXCEPTION 'Unauthorized: Only admin or staff can adjust inventory';
  END IF;

  SELECT stock, slug INTO v_current_stock, v_product_slug
  FROM public.products WHERE id = p_product_id FOR UPDATE;

  IF v_current_stock IS NULL THEN
    RAISE EXCEPTION 'Product not found: %', p_product_id;
  END IF;

  v_new_stock := v_current_stock + p_quantity_change;

  IF v_new_stock < 0 THEN
    RAISE EXCEPTION 'Stock cannot be negative (current: %, change: %)', v_current_stock, p_quantity_change;
  END IF;

  UPDATE public.products SET stock = v_new_stock WHERE id = p_product_id;

  INSERT INTO public.inventory_movements (
    product_id, movement_type, quantity_change, previous_stock, new_stock, reason, created_by
  ) VALUES (
    p_product_id, 'adjustment', p_quantity_change, v_current_stock, v_new_stock, p_reason, p_user_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'product_id', p_product_id,
    'product_slug', v_product_slug,
    'previous_stock', v_current_stock,
    'new_stock', v_new_stock,
    'quantity_change', p_quantity_change
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.adjust_inventory(uuid, integer, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_inventory(uuid, integer, text, uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- STEP 8: Admin/staff inventory dashboard view.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.inventory_dashboard AS
SELECT
  p.id, p.slug, p.name_en, p.name_ar, p.stock, p.price, p.category, p.is_active,
  COALESCE(SUM(CASE WHEN im.movement_type = 'sale' THEN im.quantity_change ELSE 0 END), 0) AS total_sold,
  COALESCE(SUM(CASE WHEN im.movement_type = 'cancellation' THEN im.quantity_change ELSE 0 END), 0) AS total_restored,
  COUNT(DISTINCT CASE WHEN im.movement_type = 'sale' THEN im.order_id END) AS order_count
FROM public.products p
LEFT JOIN public.inventory_movements im ON p.id = im.product_id
GROUP BY p.id, p.slug, p.name_en, p.name_ar, p.stock, p.price, p.category, p.is_active;

GRANT SELECT ON public.inventory_dashboard TO authenticated;
REVOKE ALL ON public.inventory_dashboard FROM anon;
ALTER VIEW public.inventory_dashboard SET (security_barrier = on);
