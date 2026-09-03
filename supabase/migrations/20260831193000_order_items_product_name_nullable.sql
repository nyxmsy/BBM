-- Fix order_items insert failures:
-- 1. make product_name nullable (code uses name_en/name_ar primarily)
-- 2. code path (persistOrderDirect) does not populate it; schema must tolerate this.
--    The column was left NOT NULL from the original schema, and the fallback RPC
--    create_cod_order explicitly writes it.  Direct insert did not.

ALTER TABLE public.order_items ALTER COLUMN product_name DROP NOT NULL;
