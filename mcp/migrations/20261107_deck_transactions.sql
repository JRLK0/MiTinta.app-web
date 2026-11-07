-- Additive migration. No collection data or existing deck contents are changed.
begin;
create table if not exists public.deck_operations (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  request_hash text not null,
  request_data jsonb not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
alter table public.deck_operations enable row level security;
revoke all on public.deck_operations from public, anon, authenticated;
grant select, insert, delete on public.deck_operations to authenticated;
create policy "Owners read deck operations" on public.deck_operations for select to authenticated using (user_id = (select auth.uid()));
create policy "Owners insert deck operations" on public.deck_operations for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Owners prune deck operations" on public.deck_operations for delete to authenticated using (user_id = (select auth.uid()));

create or replace function public.get_own_deck_snapshot(target_deck_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare payload jsonb;
begin
  select jsonb_build_object('deck', to_jsonb(d), 'entries', coalesce((
    select jsonb_agg(to_jsonb(e) order by e.card_id) from public.deck_entries e where e.deck_id=d.id
  ), '[]'::jsonb)) into payload from public.decks d
  where d.id=target_deck_id and d.user_id=(select auth.uid());
  if payload is null then raise exception 'Deck not found' using errcode='P0002'; end if;
  return payload || jsonb_build_object('revision', pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(payload::text,'UTF8')),'hex'));
end;
$$;

create or replace function public.save_deck_atomic(
  request_id uuid, target_deck_id uuid, expected_revision text,
  metadata jsonb, entries jsonb, replace_entries boolean
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := (select auth.uid());
  actual_id uuid := target_deck_id;
  fingerprint text;
  prior public.deck_operations%rowtype;
  snapshot jsonb;
  operation_data jsonb;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if request_id is null or replace_entries is null or metadata is null or jsonb_typeof(metadata)<>'object'
     or entries is null or jsonb_typeof(entries)<>'array' or jsonb_array_length(entries)>200 or octet_length(entries::text)>1048576
     or exists(select 1 from jsonb_object_keys(metadata) k where k not in ('name','description','format','is_public')) then
    raise exception 'Invalid deck request' using errcode='22023';
  end if;
  -- Always take owner before deck locks, consistently with the quota triggers.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text,0));
  operation_data := jsonb_build_object('kind','save','deck_id',target_deck_id,'expected_revision',expected_revision,'metadata',metadata,
    'entries',coalesce((select jsonb_agg(jsonb_build_object('card_id',e->>'card_id','quantity',e->'quantity') order by e->>'card_id') from jsonb_array_elements(entries) e),'[]'::jsonb),'replace_entries',replace_entries);
  fingerprint := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(operation_data::text,'UTF8')),'hex');
  select * into prior from public.deck_operations o where o.user_id=owner_id and o.request_id=save_deck_atomic.request_id;
  if found then
    if prior.request_hash<>fingerprint then raise exception 'Operation ID already used with different input' using errcode='22023'; end if;
    return prior.response;
  end if;
  if actual_id is null then
    if expected_revision is not null or not (metadata ? 'name') or coalesce(metadata->>'format','') not in ('core','infinity') then
      raise exception 'Name and Core or Infinity format required' using errcode='22023';
    end if;
    insert into public.decks(user_id,name,description,is_public,format) values(
      owner_id,metadata->>'name',coalesce(metadata->>'description',''),coalesce((metadata->>'is_public')::boolean,false),metadata->>'format'
    ) returning id into actual_id;
  else
    perform 1 from public.decks where id=actual_id and user_id=owner_id for update;
    if not found then raise exception 'Deck not found' using errcode='P0002'; end if;
    snapshot := public.get_own_deck_snapshot(actual_id);
    if expected_revision is null or expected_revision<>snapshot->>'revision' then
      raise exception 'Deck changed; reload before saving' using errcode='PT409';
    end if;
    update public.decks set
      name=case when metadata ? 'name' then metadata->>'name' else name end,
      description=case when metadata ? 'description' then metadata->>'description' else description end,
      is_public=case when metadata ? 'is_public' then (metadata->>'is_public')::boolean else is_public end,
      format=case when metadata ? 'format' then metadata->>'format' else format end
    where id=actual_id and user_id=owner_id;
  end if;
  if exists(select 1 from jsonb_array_elements(entries) e where jsonb_typeof(e)<>'object'
    or coalesce(e->>'card_id','')='' or jsonb_typeof(e->'quantity')<>'number'
    or (e->>'quantity')::numeric<>trunc((e->>'quantity')::numeric)
    or (e->>'quantity')::numeric<0 or (e->>'quantity')::numeric>99)
    or (select count(*) from jsonb_array_elements(entries))<>(select count(distinct e->>'card_id') from jsonb_array_elements(entries) e) then
    raise exception 'Invalid or duplicate deck entries' using errcode='22023';
  end if;
  if replace_entries then delete from public.deck_entries where deck_id=actual_id;
  else delete from public.deck_entries where deck_id=actual_id and card_id in (select e->>'card_id' from jsonb_array_elements(entries) e); end if;
  insert into public.deck_entries(deck_id,card_id,quantity,card_name,card_version,set_code,collector_number,image_url,ink,card_type,cost,normal_price_eur,foil_price_eur)
  select actual_id,e->>'card_id',(e->>'quantity')::integer,e->>'card_name',coalesce(e->>'card_version',''),coalesce(e->>'set_code',''),
    coalesce(e->>'collector_number',''),nullif(e->>'image_url',''),nullif(e->>'ink',''),coalesce(e->>'card_type',''),
    nullif(e->>'cost','')::integer,nullif(e->>'normal_price_eur','')::numeric,nullif(e->>'foil_price_eur','')::numeric
  from jsonb_array_elements(entries) e where (e->>'quantity')::integer>0;
  snapshot := public.get_own_deck_snapshot(actual_id);
  delete from public.deck_operations where user_id=owner_id and created_at<now()-interval '30 days';
  insert into public.deck_operations(user_id,request_id,request_hash,request_data,response) values(owner_id,request_id,fingerprint,operation_data,snapshot);
  return snapshot;
end;
$$;

create or replace function public.delete_deck_atomic(request_id uuid,target_deck_id uuid,expected_revision text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid := (select auth.uid()); fingerprint text; prior public.deck_operations%rowtype; snapshot jsonb; operation_data jsonb;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if request_id is null or target_deck_id is null then raise exception 'Invalid deck request' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text,0));
  operation_data := jsonb_build_object('kind','delete','deck_id',target_deck_id,'expected_revision',expected_revision);
  fingerprint := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(operation_data::text,'UTF8')),'hex');
  select * into prior from public.deck_operations o where o.user_id=owner_id and o.request_id=delete_deck_atomic.request_id;
  if found then
    if prior.request_hash<>fingerprint then raise exception 'Operation ID already used with different input' using errcode='22023'; end if;
    return prior.response;
  end if;
  perform 1 from public.decks where id=target_deck_id and user_id=owner_id for update;
  if not found then raise exception 'Deck not found' using errcode='P0002'; end if;
  snapshot := public.get_own_deck_snapshot(target_deck_id);
  if expected_revision is null or expected_revision<>snapshot->>'revision' then raise exception 'Deck changed; reload before deleting' using errcode='PT409'; end if;
  delete from public.decks where id=target_deck_id and user_id=owner_id;
  snapshot := jsonb_build_object('id',target_deck_id,'deleted',true);
  delete from public.deck_operations where user_id=owner_id and created_at<now()-interval '30 days';
  insert into public.deck_operations(user_id,request_id,request_hash,request_data,response) values(owner_id,request_id,fingerprint,operation_data,snapshot);
  return snapshot;
end;
$$;
revoke all on function public.get_own_deck_snapshot(uuid), public.save_deck_atomic(uuid,uuid,text,jsonb,jsonb,boolean), public.delete_deck_atomic(uuid,uuid,text) from public, anon;
grant execute on function public.get_own_deck_snapshot(uuid), public.save_deck_atomic(uuid,uuid,text,jsonb,jsonb,boolean), public.delete_deck_atomic(uuid,uuid,text) to authenticated;
notify pgrst, 'reload schema';
commit;
