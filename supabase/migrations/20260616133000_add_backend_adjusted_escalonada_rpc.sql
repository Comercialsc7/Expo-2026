-- Returns escalonada prices already adjusted by client rapel.
-- Keeps rapel rule fully in backend.

create or replace function public.get_adjusted_escalonada_for_client(
  p_client_code text,
  p_product_code text
)
returns table(cod text, faixa numeric, preco numeric)
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_pct numeric := 0;
  v_client_code text := trim(coalesce(p_client_code, ''));
  v_product_code text := trim(coalesce(p_product_code, ''));
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

  return query
  select
    trim(coalesce(e.cod::text, '')) as cod,
    e.faixa::numeric as faixa,
    round((e.preco::numeric) * (1 + (coalesce(v_pct, 0) / 100.0)), 2) as preco
  from public.escalonada e
  where trim(coalesce(e.cod::text, '')) = v_product_code
     or ltrim(trim(coalesce(e.cod::text, '')), '0') = ltrim(v_product_code, '0')
  order by e.faixa::numeric asc;
end;
$func$;

revoke all on function public.get_adjusted_escalonada_for_client(text, text) from public;
grant execute on function public.get_adjusted_escalonada_for_client(text, text) to anon, authenticated;
