type RpcAdjustedPriceRow = {
  adjusted_price?: number | string | null;
};

export const toPositiveNumberOrNull = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

export const resolveFinalPrice = (basePrice: number, rpcData: RpcAdjustedPriceRow[] | null | undefined): number => {
  const safeBasePrice = toPositiveNumberOrNull(basePrice) ?? 0;
  const adjusted = toPositiveNumberOrNull(rpcData?.[0]?.adjusted_price);
  return adjusted ?? safeBasePrice;
};

export const fetchAdjustedPrice = async (clientCode: string, basePrice: number): Promise<number> => {
  const safeBasePrice = toPositiveNumberOrNull(basePrice) ?? 0;
  const safeClientCode = String(clientCode || '').trim();

  if (!safeClientCode || safeBasePrice <= 0) {
    return safeBasePrice;
  }

  try {
    const { supabase } = await import('./supabase');
    const { data, error } = await supabase.rpc('get_adjusted_price_for_client', {
      p_client_code: safeClientCode,
      p_base_price: safeBasePrice,
    });

    if (error) {
      throw error;
    }

    return resolveFinalPrice(safeBasePrice, (data as RpcAdjustedPriceRow[] | null) || null);
  } catch (rpcError) {
    console.warn('⚠️ Falha ao buscar preço ajustado no backend. Mantendo preço base.', rpcError);
    return safeBasePrice;
  }
};
