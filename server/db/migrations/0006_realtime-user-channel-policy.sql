create policy "users join their own channel"
on realtime.messages
for select
to authenticated
using (realtime.topic() = 'user:' || (select auth.jwt() ->> 'sub'));
