-- Add social media links to store_settings so admins can manage them
-- from Admin -> Settings without code changes. Nullable: the customer-facing
-- UI only renders a social link when the admin has configured a URL.
-- Idempotent. Safe to re-run.

ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS facebook_url text;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS tiktok_url text;
