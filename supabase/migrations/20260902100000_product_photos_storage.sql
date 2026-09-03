-- 1. Add image_url directly on the products table so we don't need product_images
--    for a single primary photo. Keep image_url nullable (we'll only allow NOT NULL
--    save on client side; backfilling happens by admin action).
DO $$ BEGIN
  ALTER TABLE public.products ADD COLUMN image_url text;
EXCEPTION WHEN duplicate_column THEN
  NULL;
END $$;

-- 2. Backfill products.image_url from existing product_images (old single-photo scheme)
UPDATE public.products p
SET image_url = (
  SELECT pi.image_url
  FROM public.product_images pi
  WHERE pi.product_id = p.id AND pi.is_primary IS TRUE
  ORDER BY pi.sort_order ASC, pi.id ASC
  LIMIT 1
)
WHERE p.image_url IS NULL;

-- 3. Storage bucket for product photos + RLS (admins/staff can write, anyone can read)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-photos',
  'product-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS product_photos_allow_read ON storage.objects;
CREATE POLICY product_photos_allow_read
ON storage.objects
FOR SELECT
USING (bucket_id = 'product-photos');

DROP POLICY IF EXISTS product_photos_admin_write ON storage.objects;
CREATE POLICY product_photos_admin_write
ON storage.objects
FOR ALL
USING (
  bucket_id = 'product-photos'
  AND EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = auth.uid()
    AND r.role IN ('admin', 'staff')
  )
)
WITH CHECK (
  bucket_id = 'product-photos'
  AND EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = auth.uid()
    AND r.role IN ('admin', 'staff')
  )
);
