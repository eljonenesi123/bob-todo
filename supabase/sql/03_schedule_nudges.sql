-- ========== BOB: run the nudge function every 5 minutes ==========
-- Replace YOUR_CRON_SECRET with the same random text you saved as the CRON_SECRET secret.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'bob-nudges',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://wsxfxhwhwplarmvmtsdj.supabase.co/functions/v1/send-nudges',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'YOUR_CRON_SECRET'),
    body := '{}'::jsonb
  );
  $$
);

-- Test right now (sends "Bob says hi" to every subscribed device):
-- select net.http_post(
--   url := 'https://wsxfxhwhwplarmvmtsdj.supabase.co/functions/v1/send-nudges',
--   headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'YOUR_CRON_SECRET'),
--   body := '{"test": true}'::jsonb
-- );
