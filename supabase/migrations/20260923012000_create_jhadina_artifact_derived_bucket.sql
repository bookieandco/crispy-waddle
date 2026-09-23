insert into storage.buckets(id,name,public,file_size_limit)
values ('jhadina-artifact-derived','jhadina-artifact-derived',false,10485760)
on conflict(id) do update set public=false,file_size_limit=10485760;

-- No anon/authenticated storage.objects policies are admitted.
-- Extracted derivatives are server/service-role only and inherit the source artifact's owner boundary.
