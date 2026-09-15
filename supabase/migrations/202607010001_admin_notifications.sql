create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  kind text not null default 'info' check (kind in ('info', 'warn', 'success')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists admin_notifications_one_active_idx
  on public.admin_notifications ((active))
  where active = true;

alter table public.admin_notifications enable row level security;
revoke all on table public.admin_notifications from anon, authenticated;

create or replace function public.khod_get_active_admin_notification(
  p_license_key text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_row public.admin_notifications%rowtype;
begin
  if not exists (
    select 1
    from public.licenses
    where license_key = upper(trim(p_license_key))
      and revoked = false
      and (expires_at is null or expires_at >= now())
  ) then
    return null;
  end if;

  select * into notification_row
  from public.admin_notifications
  where active = true
  order by created_at desc
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', notification_row.id,
    'title', notification_row.title,
    'message', notification_row.message,
    'kind', notification_row.kind,
    'created_at', notification_row.created_at
  );
end;
$$;

grant execute on function public.khod_get_active_admin_notification(text) to anon, authenticated;
