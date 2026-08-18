-- Realtime on designs so the generating screen updates the moment n8n calls
-- back. The app also polls as a fallback for flaky in-home Wi-Fi.
alter publication supabase_realtime add table public.designs;
