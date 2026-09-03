-- ============================================================
-- pg_cron task: auto-expire pickup orders when pickup_deadline_at passes
-- and mark them cancelled with a reason, restoring inventory.
-- ============================================================

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
    -- Restock each item through the existing inventory mechanism.
    BEGIN
      PERFORM public.adjust_inventory(
        oi.product_slug,
        oi.qty,
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

    -- Write status history
    INSERT INTO public.order_status_history (order_id, old_status, new_status, reason, changed_by)
    VALUES (r.id, r.status, 'cancelled', 'Automatically cancelled: pickup deadline expired.', NULL);

    RETURN NEXT r;
  END LOOP;

  RETURN;
END;
$$;

-- Schedule the task every 15 minutes if pg_cron is available.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    PERFORM cron.schedule(
      'expire_pickup_orders',
      '*/15 * * * *',
      'SELECT public.expire_pickup_orders();'
    );
  END IF;
END $$;
