-- ========== BOB: send a test notification now ==========
-- Run in Supabase → SQL Editor whenever you like. Changes nothing in the database.
-- Every connected device of BOTH accounts gets "Bob says hi", also in quiet hours.
-- The secret is read from the timer job, so there is nothing to fill in (and no secret in this file).
do $$
declare
  secret text;
begin
  select substring(command from $r$x-cron-secret["']\s*[,:]\s*["']([^"']+)["']$r$) into secret
  from cron.job where jobname = 'bob-nudges';
  if secret is null then
    raise exception 'The secret was not found in the timer job "bob-nudges". Nothing was sent.';
  end if;
  perform net.http_post(
    url := 'https://wsxfxhwhwplarmvmtsdj.supabase.co/functions/v1/send-nudges',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', secret),
    body := '{"test": true}'::jsonb
  );
end $$;

select 'Asked Bob to send it. Look at your phones.' as result;

-- Nothing arrived? Wait 10 seconds, then run only this line:
-- select status_code, content::text, error_msg from net._http_response order by id desc limit 1;
