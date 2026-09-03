-- Refresh create_cod_order() so it also populates order_items.product_name
-- (the column is now nullable; we still write it for data consistency).
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
      order_id, product_id, product_name, product_slug, name_en, name_ar,
      quantity, unit_price, total_price
    )
    SELECT v_order_id, id, COALESCE(name_en, name_ar), slug, name_en, name_ar,
           v_quantity, v_unit_price, v_item_total
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
