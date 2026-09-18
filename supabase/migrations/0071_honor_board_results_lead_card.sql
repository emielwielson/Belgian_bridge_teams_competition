-- Opening lead from Bridgemate ReceivedData.LeadCard
alter table public.honor_board_results
  add column if not exists lead_card text;

comment on column public.honor_board_results.lead_card is
  'Opening lead card from Bridgemate (e.g. SA, HK).';

-- Backfill from frozen import payload (Access column name or camelCase)
update public.honor_board_results
set lead_card = nullif(
  trim(
    coalesce(
      original_payload->>'LeadCard',
      original_payload->>'leadCard'
    )
  ),
  ''
)
where lead_card is null
  and original_payload is not null;
