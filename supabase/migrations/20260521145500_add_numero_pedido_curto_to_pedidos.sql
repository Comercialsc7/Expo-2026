alter table if exists public.pedidos
  add column if not exists numero_pedido_curto varchar(8);

create index if not exists idx_pedidos_numero_pedido_curto
  on public.pedidos (numero_pedido_curto);

comment on column public.pedidos.numero_pedido_curto
  is 'Numero curto de exibicao do pedido: vendedor(4) + sequencia(3) + dia(1).';
