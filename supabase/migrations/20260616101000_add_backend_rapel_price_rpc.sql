-- Backend-only rapel pricing: returns only final adjusted price.
-- This function hides rapel logic from the frontend.

create or replace function public.get_adjusted_price_for_client(
  p_client_code text,
  p_base_price numeric
)
returns table(adjusted_price numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pct numeric := 0;
  v_client_code text := trim(coalesce(p_client_code, ''));
  v_base numeric := greatest(coalesce(p_base_price, 0), 0);
begin
  select
    case
      when r.precmaxfinan is null then 0
      when r.precmaxfinan between 0 and 1 then r.precmaxfinan * 100
      else r.precmaxfinan
    end
  into v_pct
  from public.rapel r
  where trim(coalesce(r.codecli::text, '')) = v_client_code
  limit 1;

  adjusted_price := round(v_base * (1 + (coalesce(v_pct, 0) / 100.0)), 2);
  return next;
end;
$$;

revoke all on function public.get_adjusted_price_for_client(text, numeric) from public;
grant execute on function public.get_adjusted_price_for_client(text, numeric) to anon, authenticated;

-- Optional hardening (execute only after validating role requirements):
-- revoke all on table public.rapel from anon, authenticated;
