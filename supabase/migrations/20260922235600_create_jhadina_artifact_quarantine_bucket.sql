insert into storage.buckets(id,name,public,file_size_limit)
values ('jhadina-artifact-quarantine','jhadina-artifact-quarantine',false,262144000)
on conflict(id) do update set public=false,file_size_limit=262144000;
-- No anon/authenticated object policies are admitted. Artifact access is server/service-role only.
