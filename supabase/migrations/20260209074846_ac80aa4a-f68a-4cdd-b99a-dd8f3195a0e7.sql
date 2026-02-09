-- Add explicit authentication requirement for profiles table
-- This provides defense-in-depth by explicitly rejecting unauthenticated queries
-- All profiles queries must be authenticated

CREATE POLICY "Require authentication for profiles"
ON public.profiles
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);