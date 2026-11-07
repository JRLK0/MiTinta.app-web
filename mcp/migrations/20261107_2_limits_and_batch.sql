begin;
-- Bound direct PostgREST inserts as well as writes through the atomic RPC.
alter table public.deck_operations add constraint deck_operation_size check (
  jsonb_typeof(request_data)='object' and jsonb_typeof(response)='object'
  and octet_length(request_data::text)<=65536 and octet_length(response::text)<=524288
);
create or replace function public.limit_deck_operations()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.user_id is distinct from (select auth.uid()) then raise exception 'Operation owner mismatch' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text,0));
  new.created_at := now();
  delete from public.deck_operations where user_id=new.user_id and created_at<now()-interval '30 days';
  if (select count(*) from public.deck_operations where user_id=new.user_id)>=1000 then
    raise exception 'Deck operation storage limit reached' using errcode='54000';
  end if;
  return new;
end;
$$;
create trigger limit_deck_operations before insert on public.deck_operations for each row execute function public.limit_deck_operations();
alter function public.get_own_deck_snapshot(uuid) stable;
create or replace function public.get_own_deck_snapshots(target_deck_ids uuid[])
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
  if target_deck_ids is null or cardinality(target_deck_ids)<1 or cardinality(target_deck_ids)>100
     or cardinality(target_deck_ids)<>(select count(distinct id) from unnest(target_deck_ids) id) then
    raise exception 'Invalid deck IDs' using errcode='22023';
  end if;
  select jsonb_agg(public.get_own_deck_snapshot(id) order by position) into result
  from unnest(target_deck_ids) with ordinality as chosen(id,position);
  return result;
end;
$$;
revoke all on function public.limit_deck_operations(),public.get_own_deck_snapshots(uuid[]) from public,anon;
grant execute on function public.get_own_deck_snapshots(uuid[]) to authenticated;
notify pgrst,'reload schema';
commit;
