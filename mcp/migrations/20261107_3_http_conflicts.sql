begin;
-- A business conflict is HTTP 409, not a PostgreSQL serialization failure.
-- Keep it out of automatic transaction-retry paths in API/pooling layers.
do $migration$
declare signature regprocedure; definition text;
begin
  foreach signature in array array[
    'public.save_deck_atomic(uuid,uuid,text,jsonb,jsonb,boolean)'::regprocedure,
    'public.delete_deck_atomic(uuid,uuid,text)'::regprocedure
  ] loop
    definition := pg_get_functiondef(signature);
    execute replace(definition, 'errcode=''40001''', 'errcode=''PT409''');
  end loop;
end;
$migration$;
notify pgrst,'reload schema';
commit;
