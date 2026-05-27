alter table if exists public.pedidos
  add column if not exists tickets_moto integer not null default 0;

comment on column public.pedidos.tickets_moto
  is 'Quantidade de tickets/cupons do pedido para concorrer a moto.';
