-- 1. One-time backfill: copy any orphan legacy primary photo URL from product_images
--    over to products.image_url, ONLY when products.image_url is still NULL.
--    After this runs, we no longer need the client-side fallback that was
--    resurrecting deleted photos (because products.image_url is the new SOT).
UPDATE public.products p
SET image_url = sub.image_url
FROM (
  SELECT DISTINCT ON (pi.product_id) pi.product_id, pi.image_url
  FROM public.product_images pi
  ORDER BY pi.product_id, pi.is_primary DESC, pi.sort_order ASC, pi.id ASC
) sub
WHERE p.id = sub.product_id
AND p.image_url IS NULL;

-- 2. Explicitly wipe ceramic-dinner-set-24 photo references.
UPDATE public.products
SET image_url = NULL
WHERE slug = 'ceramic-dinner-set-24';

DELETE FROM public.product_images
USING public.products p
WHERE product_images.product_id = p.id
  AND p.slug = 'ceramic-dinner-set-24';
