-- Task 51 smoke: unique member_number constraint

do $$
begin
  insert into public.players (name, member_number) values ('Smoke Member A', 'SMOKE-MEMBER-001');
  insert into public.players (name, member_number) values ('Smoke Member B', 'SMOKE-MEMBER-001');
  raise exception 'Duplicate member_number should not be allowed';
exception
  when unique_violation then
    null;
end;
$$;

delete from public.players where member_number = 'SMOKE-MEMBER-001';

-- Multiple null member numbers remain allowed
insert into public.players (name, member_number) values ('Smoke No Number 1', null);
insert into public.players (name, member_number) values ('Smoke No Number 2', null);

delete from public.players where name in ('Smoke No Number 1', 'Smoke No Number 2');

select 'task51_players_member_number_smoke_test passed' as status;
