-- ============================================================
-- Fixes discrepancies between code expectations and actual DB:
-- 1. order_items: add product_slug, name_en, name_ar cols
-- 2. orders.payment_method allow "cod"/"pickup" text values (safe cast)
-- 3. orders.status extend enum with processing/completed/picked_up
-- 4. inventory_movements.reason: make text+reason/movement_type columns robust
-- ============================================================

-- ------------------------------------------------------------
-- STEP 1: order_items — align with code (persistOrderDirect + mapOrderItem)
-- ------------------------------------------------------------
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS product_slug text;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS name_ar text;

-- Backfill if rows exist with product_id only (safe if empty)
UPDATE public.order_items
SET product_slug = p.slug,
    name_en    = p.name_en,
    name_ar    = p.name_ar
FROM public.products p
WHERE order_items.product_slug IS NULL
  AND order_items.product_id = p.id;

-- ------------------------------------------------------------
-- STEP 2: orders status — extend enum to include all statuses used by code
-- (Postgres enums can only gain values via ALTER TYPE; cannot drop safely)
-- ------------------------------------------------------------
DO $$
BEGIN
  -- 'processing'
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
                 WHERE t.typname = 'order_status' AND e.enumlabel = 'processing') THEN
    ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'processing';
  END IF;
  -- 'completed'
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
                 WHERE t.typname = 'order_status' AND e.enumlabel = 'completed') THEN
    ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'completed';
  END IF;
  -- 'picked_up'
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
                 WHERE t.typname = 'order_status' AND e.enumlabel = 'picked_up') THEN
    ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'picked_up';
  END IF;
END $$;

-- ------------------------------------------------------------
-- STEP 3: payment_method — current default is 'cash_on_delivery'
-- but code & create_cod_order pass 'cod' / 'pickup'.
-- Change the column to plain text (idempotent via cast).
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='orders' AND column_name='payment_method'
      AND data_type = 'USER-DEFINED'
  ) THEN
    ALTER TABLE public.orders ALTER COLUMN payment_method TYPE text
      USING payment_method::text;
  END IF;
END $$;

ALTER TABLE public.orders ALTER COLUMN payment_method SET DEFAULT 'cod';

-- ------------------------------------------------------------
-- STEP 4: inventory_movements.reason — the column is currently
-- an ENUM (inventory_reason) but code uses text via
-- `movement_type` column. Ensure existing rows stay intact and
-- `reason` can hold free-form text (reason column stores notes).
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='inventory_movements' AND column_name='reason'
      AND data_type = 'USER-DEFINED'
  ) THEN
    ALTER TABLE public.inventory_movements ALTER COLUMN reason TYPE text
      USING reason::text;
  END IF;
END $$;
