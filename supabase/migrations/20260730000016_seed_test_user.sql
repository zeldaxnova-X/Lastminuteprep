-- Migration: Create test user in auth.users for dev/testing FK constraints

INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'testuser@lastmileprep.com',
    '$2a$10$abcdefghijklmnopqrstuv',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    'authenticated',
    'authenticated'
)
ON CONFLICT (id) DO NOTHING;
