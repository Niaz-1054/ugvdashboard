-- Add foreign key constraint from user_roles.user_id to profiles.id
-- This enables PostgREST to recognize the relationship for JOIN queries

ALTER TABLE public.user_roles
ADD CONSTRAINT user_roles_user_id_profiles_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;