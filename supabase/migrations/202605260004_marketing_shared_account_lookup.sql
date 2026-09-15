create index if not exists marketing_account_mappings_account_lookup
  on public.marketing_account_mappings (platform, dashboard_account_id);

comment on index public.marketing_account_mappings_account_lookup is
  'Allows a KHOD account assignment saved under one license to be read by another licensed device for the same stable KHOD account identity.';
