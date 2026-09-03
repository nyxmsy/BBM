-- Add business email to store_settings so Contact page + Settings share one source of truth.
DO $$ BEGIN
  ALTER TABLE public.store_settings
    ADD COLUMN email text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

UPDATE public.store_settings SET email = 'hello@bbm.ss' WHERE id = 1 AND email IS NULL;
