alter table public.marketing_account_mappings
  add column if not exists source_currency text;

create unique index if not exists marketing_account_mappings_one_owner_per_source
  on public.marketing_account_mappings (license_key_hash, platform, source_account_id);

comment on column public.marketing_account_mappings.source_currency is
  'Configured spend currency for the source account, such as SAR, USD, or EGP.';
