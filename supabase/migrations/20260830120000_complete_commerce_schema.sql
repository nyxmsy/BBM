-- ============================================================================
-- MILESTONE 1 & 2: Complete Commerce Schema & Security Functions
-- ============================================================================

-- Fix existing orders table schema to match what the code expects
ALTER TABLE public.orders 
  RENAME COLUMN customer_name TO customer_name,
  RENAME COLUMN phone TO customer_phone,
  RENAME COLUMN phone2 TO customer_alt_phone,
  RENAME COLUMN address TO address,
  RENAME COLUMN area TO area,
  RENAME COLUMN city TO city,
  RENAME COLUMN notes TO delivery_notes;

-- Add missing columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_phone') THEN
    ALTER TABLE public.orders RENAME COLUMN phone TO customer_phone;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_alt_phone') THEN
    ALTER TABLE public.orders ADD COLUMN customer_alt_phone text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'delivery_notes') THEN
    ALTER TABLE public.orders ADD COLUMN delivery_notes text;
  END IF;
END $$;

-- Fix order_items table to match code expectations
ALTER TABLE public.order_items 
  RENAME COLUMN product_slug TO product_slug,
  RENAME COLUMN name_en TO name_en,
  RENAME COLUMN name_ar TO name_ar,
  RENAME COLUMN qty TO quantity,
  RENAME COLUMN unit_price TO unit_price,
  RENAME COLUMN line_total TO total_price;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'quantity') THEN
    ALTER TABLE public.order_items RENAME COLUMN qty TO quantity;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'total_price') THEN
    ALTER TABLE public.order_items RENAME COLUMN line_total TO total_price;
  END IF;
  
  -- Add product_id column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'product_id') THEN
    ALTER TABLE public.order_items ADD COLUMN product_id uuid REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add product_id column for proper foreign key relationship
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'product_id') THEN
    ALTER TABLE public.order_items ADD COLUMN product_id uuid REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- product_images table (referenced in code but missing from schema)
-- ============================================================================
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

CREATE POLICY "public can view product images" ON public.product_images FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "staff manage product images" ON public.product_images FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

-- ============================================================================
-- inventory_movements table for tracking stock changes
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('sale', 'cancellation', 'adjustment', 'restock')),
  quantity_change integer NOT NULL, -- negative for sales, positive for restocks
  previous_stock integer NOT NULL,
  new_stock integer NOT NULL,
  reason text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.inventory_movements TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.inventory_movements TO authenticated;
GRANT ALL ON public.inventory_movements TO service_role;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read inventory movements" ON public.inventory_movements FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "staff create inventory movements" ON public.inventory_movements FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

-- ============================================================================
-- Security Functions for Commerce Flow
-- ============================================================================

-- Function to create COD order with proper stock validation and decrement
CREATE OR REPLACE FUNCTION public.create_cod_order(
  p_customer_name text,
  p_customer_phone text,
  p_customer_alt_phone text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_area text DEFAULT NULL,
  p_city text DEFAULT 'Juba',
  p_delivery_notes text DEFAULT NULL,
  p_payment_method text DEFAULT 'cod',
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_order_number text;
  v_subtotal integer;
  v_delivery_fee integer;
  v_total integer;
  v_item_record jsonb;
  v_product_id uuid;
  v_product_slug text;
  v_quantity integer;
  v_unit_price integer;
  v_current_stock integer;
  v_item_total integer;
BEGIN
  -- Validate items
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one item';
  END IF;

  -- Calculate delivery fee
  v_delivery_fee := CASE WHEN p_payment_method = 'pickup' THEN 0 ELSE 3000 END;

  -- Calculate subtotal and validate stock
  v_subtotal := 0;
  FOR v_item_record IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_slug := v_item_record->>'slug';
    v_quantity := (v_item_record->>'qty')::integer;
    
    -- Get product info and lock for update
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
    
    v_item_total := v_unit_price * v_quantity;
    v_subtotal := v_subtotal + v_item_total;
  END LOOP;

  v_total := v_subtotal + v_delivery_fee;

  -- Generate order number
  v_order_number := 'BBM-' || 
    to_char(now(), 'YYMMDD') || '-' || 
    upper(substr(encode(gen_random_bytes(4), 'base64'), 1, 6));

  -- Create order
  INSERT INTO public.orders (
    order_number,
    customer_name,
    customer_phone,
    customer_alt_phone,
    address,
    area,
    city,
    delivery_notes,
    payment_method,
    subtotal,
    delivery_fee,
    total,
    status
  ) VALUES (
    v_order_number,
    p_customer_name,
    p_customer_phone,
    p_customer_alt_phone,
    p_address,
    p_area,
    p_city,
    p_delivery_notes,
    p_payment_method,
    v_subtotal,
    v_delivery_fee,
    v_total,
    'new'
  ) RETURNING id INTO v_order_id;

  -- Process items and update inventory
  FOR v_item_record IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_slug := v_item_record->>'slug';
    v_quantity := (v_item_record->>'qty')::integer;
    
    -- Get product info
    SELECT id, price, stock INTO v_product_id, v_unit_price, v_current_stock
    FROM public.products
    WHERE slug = v_product_slug AND is_active = true;
    
    v_item_total := v_unit_price * v_quantity;
    
    -- Create order item
    INSERT INTO public.order_items (
      order_id,
      product_id,
      product_slug,
      name_en,
      name_ar,
      quantity,
      unit_price,
      total_price
    ) SELECT
      v_order_id,
      v_product_id,
      slug,
      name_en,
      name_ar,
      v_quantity,
      v_unit_price,
      v_item_total
    FROM public.products
    WHERE id = v_product_id;
    
    -- Update product stock
    UPDATE public.products
    SET stock = stock - v_quantity
    WHERE id = v_product_id;
    
    -- Record inventory movement
    INSERT INTO public.inventory_movements (
      product_id,
      order_id,
      movement_type,
      quantity_change,
      previous_stock,
      new_stock,
      reason
    ) VALUES (
      v_product_id,
      v_order_id,
      'sale',
      -v_quantity,
      v_current_stock,
      v_current_stock - v_quantity,
      'Order ' || v_order_number
    );
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

-- Grant execute permission
REVOKE EXECUTE ON FUNCTION public.create_cod_order FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_cod_order TO anon;

-- Function to update order status with inventory restoration for cancellations
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
  v_item_record record;
  v_product_id uuid;
  v_quantity integer;
  v_current_stock integer;
BEGIN
  -- Check authorization
  IF NOT (public.has_role(p_user_id, 'admin'::app_role) OR public.has_role(p_user_id, 'staff'::app_role)) THEN
    RAISE EXCEPTION 'Unauthorized: Only admin or staff can update order status';
  END IF;

  -- Get current order status
  SELECT status, order_number INTO v_current_status, v_order_number
  FROM public.orders
  WHERE id = p_order_id;
  
  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  -- Validate status transition
  IF p_new_status NOT IN ('new', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid order status: %', p_new_status;
  END IF;

  -- Handle cancellation - restore inventory
  IF p_new_status = 'cancelled' AND v_current_status != 'cancelled' THEN
    FOR v_item_record IN 
      SELECT product_id, quantity 
      FROM public.order_items 
      WHERE order_id = p_order_id
    LOOP
      v_product_id := v_item_record.product_id;
      v_quantity := v_item_record.quantity;
      
      -- Get current stock
      SELECT stock INTO v_current_stock
      FROM public.products
      WHERE id = v_product_id
      FOR UPDATE;
      
      -- Restore stock
      UPDATE public.products
      SET stock = stock + v_quantity
      WHERE id = v_product_id;
      
      -- Record inventory movement
      INSERT INTO public.inventory_movements (
        product_id,
        order_id,
        movement_type,
        quantity_change,
        previous_stock,
        new_stock,
        reason,
        created_by
      ) VALUES (
        v_product_id,
        p_order_id,
        'cancellation',
        v_quantity,
        v_current_stock,
        v_current_stock + v_quantity,
        'Order cancellation: ' || v_order_number,
        p_user_id
      );
    END LOOP;
  END IF;

  -- Update order status
  UPDATE public.orders
  SET status = p_new_status, updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'order_number', v_order_number,
    'old_status', v_current_status,
    'new_status', p_new_status
  );
END;
$$;

-- Grant execute permission
REVOKE EXECUTE ON FUNCTION public.update_order_status FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_order_status TO authenticated;

-- Function to adjust inventory manually (admin/staff only)
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
  -- Check authorization
  IF NOT (public.has_role(p_user_id, 'admin'::app_role) OR public.has_role(p_user_id, 'staff'::app_role)) THEN
    RAISE EXCEPTION 'Unauthorized: Only admin or staff can adjust inventory';
  END IF;

  -- Get current stock
  SELECT stock, slug INTO v_current_stock, v_product_slug
  FROM public.products
  WHERE id = p_product_id;
  
  IF v_current_stock IS NULL THEN
    RAISE EXCEPTION 'Product not found: %', p_product_id;
  END IF;

  -- Calculate new stock
  v_new_stock := v_current_stock + p_quantity_change;
  
  IF v_new_stock < 0 THEN
    RAISE EXCEPTION 'Stock cannot be negative (current: %, change: %)', v_current_stock, p_quantity_change;
  END IF;

  -- Update stock
  UPDATE public.products
  SET stock = v_new_stock
  WHERE id = p_product_id;

  -- Record inventory movement
  INSERT INTO public.inventory_movements (
    product_id,
    movement_type,
    quantity_change,
    previous_stock,
    new_stock,
    reason,
    created_by
  ) VALUES (
    p_product_id,
    'adjustment',
    p_quantity_change,
    v_current_stock,
    v_new_stock,
    p_reason,
    p_user_id
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

-- Grant execute permission
REVOKE EXECUTE ON FUNCTION public.adjust_inventory FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_inventory TO authenticated;

-- ============================================================================
-- View for inventory dashboard (admin/staff only)
-- ============================================================================
CREATE OR REPLACE VIEW public.inventory_dashboard AS
SELECT 
  p.id,
  p.slug,
  p.name_en,
  p.name_ar,
  p.stock,
  p.price,
  p.category,
  p.is_active,
  COALESCE(SUM(CASE WHEN im.movement_type = 'sale' THEN im.quantity_change ELSE 0 END), 0) as total_sold,
  COALESCE(SUM(CASE WHEN im.movement_type = 'cancellation' THEN im.quantity_change ELSE 0 END), 0) as total_restored,
  COUNT(DISTINCT CASE WHEN im.movement_type = 'sale' THEN im.order_id END) as order_count
FROM public.products p
LEFT JOIN public.inventory_movements im ON p.id = im.product_id
GROUP BY p.id, p.slug, p.name_en, p.name_ar, p.stock, p.price, p.category, p.is_active;

-- Grant permissions on view
GRANT SELECT ON public.inventory_dashboard TO authenticated;
REVOKE ALL ON public.inventory_dashboard FROM anon;

-- Create policy for view access
ALTER VIEW public.inventory_dashboard SET (security_barrier = on);