-- Diagnostic migration: verify user_roles state and check for mismatches
-- Idempotent: safe to run multiple times.

DO $$
DECLARE
  v_count integer;
  v_role_count integer;
  v_email text;
  v_record record;
BEGIN
  -- 1. Count total admins
  SELECT COUNT(*) INTO v_count FROM public.user_roles WHERE role::text = 'admin';
  RAISE NOTICE 'Total admin users in user_roles: %', v_count;

  -- 2. Count total users in auth.users with email boeristeph
  SELECT COUNT(*) INTO v_count FROM auth.users WHERE email = 'boeristeph@gmail.com';
  RAISE NOTICE 'Auth users with boeristeph@gmail.com: %', v_count;

  -- 3. Show boeristeph user's id and match with user_roles
  FOR v_record IN
    SELECT u.id, u.email, u.created_at,
           (SELECT COUNT(*) FROM public.user_roles r WHERE r.user_id = u.id) AS has_role,
           (SELECT r.role::text FROM public.user_roles r WHERE r.user_id = u.id LIMIT 1) AS role_name
    FROM auth.users u
    WHERE u.email LIKE '%boeristeph%' OR u.email LIKE '%beitna%'
  LOOP
    RAISE NOTICE 'User: id=%, email=%, created=%, has_role_count=%, role=%',
      v_record.id, v_record.email, v_record.created_at, v_record.has_role, v_record.role_name;
  END LOOP;

  -- 4. List ALL rows in user_roles with email join
  FOR v_record IN
    SELECT r.user_id, r.role::text, r.created_at, u.email
    FROM public.user_roles r
    LEFT JOIN auth.users u ON u.id = r.user_id
  LOOP
    RAISE NOTICE 'user_roles row: user_id=%, role=%, email=%, created=%',
      v_record.user_id, v_record.role, v_record.email, v_record.created_at;
  END LOOP;

  -- 5. Check has_role function signatures
  SELECT COUNT(*) INTO v_count FROM pg_proc WHERE proname = 'has_role';
  RAISE NOTICE 'Number of has_role function overloads: %', v_count;
END $$;

-- If there is NO admin user at all, we grant admin to boeristeph@gmail.com.
-- This is safe and idempotent: ON CONFLICT (user_id) DO NOTHING.
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'boeristeph@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = auth.users.id AND r.role::text = 'admin'
  )
ON CONFLICT (user_id) DO NOTHING;
