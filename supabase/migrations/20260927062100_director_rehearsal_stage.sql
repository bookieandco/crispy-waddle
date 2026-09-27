-- Make rehearsal a first-class Director creative stage between previs and generation.
alter table public.director_creative_stages
  drop constraint if exists director_creative_stages_kind_check;

alter table public.director_creative_stages
  add constraint director_creative_stages_kind_check
  check (kind in ('vision','treatment','storyboard','shotlist','previs','rehearsal','generation','edit','review','final'));
