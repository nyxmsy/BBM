-- ============================================================
-- Fix missing: delivery_area_id column, expire_pickup_orders(),
-- adjust_inventory() RPC, and missing RLS for status history write.
-- ============================================================

-- ---------- 1. orders.delivery_area_id ----------
DO $$ BEGIN
  ALTER TABLE public.orders
    ADD COLUMN delivery_area_id uuid REFERENCES public.delivery_areas(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ---------- 2. adjust_inventory RPC (used by expire_pickup_orders) ----------
CREATE OR REPLACE FUNCTION public.adjust_inventory(
  p_product_slug text,
  p_qty integer,
  p_movement_type text DEFAULT 'adjustment',
  p_reason text DEFAULT 'Manual adjustment'
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_product_id uuid;
  v_current_stock integer;
  v_delta integer;
  v_new_stock integer;
BEGIN
  IF p_qty IS NULL OR p_qty = 0 THEN
    RETURN false;
  END IF;

  SELECT id, stock INTO v_product_id, v_current_stock
  FROM public.products
  WHERE slug = p_product_slug
  LIMIT 1;

  IF v_product_id IS NULL THEN
    RETURN false;
  END IF;

  v_delta := ABS(p_qty);
  IF p_movement_type IN ('pickup_expired', 'cancellation', 'restock') THEN
    v_new_stock := COALESCE(v_current_stock, 0) + v_delta;
  ELSE
    v_delta := -v_delta;
    v_new_stock := GREATEST(0, COALESCE(v_current_stock, 0) + v_delta);
  END IF;

  UPDATE public.products
  SET stock = v_new_stock, updated_at = now()
  WHERE id = v_product_id;

  INSERT INTO public.inventory_movements
    (product_id, quantity_change, movement_type, previous_stock, new_stock, reason)
  VALUES
    (v_product_id, v_delta, p_movement_type, COALESCE(v_current_stock, 0), v_new_stock, p_reason);

  RETURN true;
END;
$$;

-- ---------- 3. expire_pickup_orders() function ----------
CREATE OR REPLACE FUNCTION public.expire_pickup_orders()
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r public.orders%ROWTYPE;
  restock_ok boolean;
BEGIN
  FOR r IN
    SELECT o.*
    FROM public.orders o
    WHERE o.payment_method = 'pickup'
      AND o.status = 'processing'
      AND o.pickup_deadline_at IS NOT NULL
      AND o.pickup_deadline_at <= now()
    FOR UPDATE OF o SKIP LOCKED
  LOOP
    BEGIN
      PERFORM public.adjust_inventory(
        oi.product_slug,
        oi.quantity,
        'pickup_expired',
        'Pickup order expired: auto-cancelled and restocked'
      )
      FROM public.order_items oi
      WHERE oi.order_id = r.id;
      restock_ok := true;
    EXCEPTION WHEN OTHERS THEN
      restock_ok := false;
    END;

    UPDATE public.orders o SET
      status = 'cancelled',
      auto_cancel_reason = CASE
        WHEN restock_ok THEN 'Pickup order expired: customer did not collect within the pickup window. Inventory restored.'
        ELSE 'Pickup order expired: customer did not collect within the pickup window.'
      END,
      updated_at = now()
    WHERE o.id = r.id;

    INSERT INTO public.order_status_history (order_id, old_status, new_status, reason, changed_by)
    VALUES (r.id, r.status, 'cancelled', 'Automatically cancelled: pickup deadline expired.', NULL);

    RETURN NEXT r;
  END LOOP;
  RETURN;
END;
$$;

-- ---------- 4. pg_cron schedule (if extension available) ----------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('expire_pickup_orders');
    PERFORM cron.schedule(
      'expire_pickup_orders',
      '*/15 * * * *',
      'SELECT public.expire_pickup_orders();'
    );
  END IF;
END $$;

-- ---------- 5. RLS for order_status_history: allow insert via system ----------
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_status_history_read ON public.order_status_history;
CREATE POLICY order_status_history_read
ON public.order_status_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_status_history.order_id
      AND (o.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.user_roles r
        WHERE r.user_id = auth.uid() AND r.role IN ('admin', 'staff')
      ))
  )
);

DROP POLICY IF EXISTS order_status_history_write ON public.order_status_history;
CREATE POLICY order_status_history_write
ON public.order_status_history FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = auth.uid() AND r.role IN ('admin', 'staff')
  )
  OR changed_by IS NULL
);

-- ---------- 6. Ensure store_settings default pickup_window_days = 5 ----------
UPDATE public.store_settings
SET pickup_window_days = 5
WHERE id = 1 AND pickup_window_days < 5;
