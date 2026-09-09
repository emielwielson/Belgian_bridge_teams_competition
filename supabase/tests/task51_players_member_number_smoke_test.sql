-- Task 51 smoke: unique member_number constraint (global across federations)

do $$
begin
  insert into public.players (name, member_number, federation)
  values ('Smoke Member A', 'SMOKE-MEMBER-001', 'vbl');
  insert into public.players (name, member_number, federation)
  values ('Smoke Member B', 'SMOKE-MEMBER-001', 'lbf');
  raise exception 'Duplicate member_number should not be allowed across federations';
exception
  when unique_violation then
    null;
end;
$$;

delete from public.players where member_number = 'SMOKE-MEMBER-001';

-- Multiple null member numbers remain allowed
insert into public.players (name, member_number, federation)
values ('Smoke No Number 1', null, 'vbl');
insert into public.players (name, member_number, federation)
values ('Smoke No Number 2', null, 'vbl');

delete from public.players where name in ('Smoke No Number 1', 'Smoke No Number 2');

select 'task51_players_member_number_smoke_test passed' as status;
