-- ============================================================
-- Delivery areas, store settings, order lifecycle, status history
-- ============================================================

-- --------- 1. Delivery areas ---------
CREATE TABLE IF NOT EXISTS public.delivery_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL,
  name_ar text,
  fee integer NOT NULL DEFAULT 0 CHECK (fee >= 0),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS delivery_areas_public_read ON public.delivery_areas;
CREATE POLICY delivery_areas_public_read
ON public.delivery_areas FOR SELECT
USING (active = true OR EXISTS (
  SELECT 1 FROM public.user_roles r
  WHERE r.user_id = auth.uid() AND r.role IN ('admin', 'staff')
));

DROP POLICY IF EXISTS delivery_areas_staff_write ON public.delivery_areas;
CREATE POLICY delivery_areas_staff_write
ON public.delivery_areas FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.user_roles r
  WHERE r.user_id = auth.uid() AND r.role IN ('admin', 'staff')
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles r
  WHERE r.user_id = auth.uid() AND r.role IN ('admin', 'staff')
));

INSERT INTO public.delivery_areas (name_en, name_ar, fee, sort_order) VALUES
  ('Juba Central', 'وسط جوبا', 3000, 0),
  ('Munuki', 'مونكي', 5000, 1),
  ('Gudele', 'جوديلي', 6000, 2),
  ('Hai Malakia', 'حاي مالاكيا', 4500, 3),
  ('Thongping', 'ثونغ بينج', 6000, 4),
  ('Jebel', 'جبل', 7000, 5)
ON CONFLICT DO NOTHING;

-- --------- 2. Store settings (single row) ---------
CREATE TABLE IF NOT EXISTS public.store_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  store_name_en text NOT NULL DEFAULT 'BBM Household Store',
  store_name_ar text NOT NULL DEFAULT 'مخازن بي بي إم للمنزل',
  address_en text NOT NULL DEFAULT 'Munuki Block B, Juba, South Sudan',
  address_ar text NOT NULL DEFAULT 'مونكي بلوك بي، جوبا، جنوب السودان',
  opening_hours_en text NOT NULL DEFAULT 'Mon–Sat: 8:00 AM – 8:00 PM · Sun: 10:00 AM – 6:00 PM',
  opening_hours_ar text NOT NULL DEFAULT 'السبت-الإثنين: 8 ص – 8 م · الأحد: 10 ص – 6 م',
  phone text NOT NULL DEFAULT '+211 922 000 000',
  whatsapp text NOT NULL DEFAULT '+2119220000000',
  map_lat double precision,
  map_lng double precision,
  map_embed_url text,
  pickup_window_days integer NOT NULL DEFAULT 5,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS store_settings_public_read ON public.store_settings;
CREATE POLICY store_settings_public_read ON public.store_settings FOR SELECT
USING (true);

DROP POLICY IF EXISTS store_settings_admin_write ON public.store_settings;
CREATE POLICY store_settings_admin_write ON public.store_settings FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.user_roles r
  WHERE r.user_id = auth.uid() AND r.role = 'admin'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles r
  WHERE r.user_id = auth.uid() AND r.role = 'admin'
));

INSERT INTO public.store_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- --------- 3. Order status history ---------
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id bigserial PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  reason text,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS order_status_history_order_idx
  ON public.order_status_history(order_id, changed_at DESC);

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
);

-- --------- 4. Orders: add pickup deadline, auto cancel reason ---------
DO $$ BEGIN
  ALTER TABLE public.orders ADD COLUMN pickup_deadline_at timestamptz;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.orders ADD COLUMN auto_cancel_reason text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Upgrade order_status enum variants if missing (adds completed/picked_up etc.)
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'picked_up';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'processing';

-- Default every order with no status to processing (standardize)
UPDATE public.orders SET status = 'processing' WHERE status IS NULL;
