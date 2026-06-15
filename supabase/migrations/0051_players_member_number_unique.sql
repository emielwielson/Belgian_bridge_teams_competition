-- One member number per player (nullable; multiple players may have no number)

create unique index players_member_number_unique
  on public.players (member_number)
  where member_number is not null;
