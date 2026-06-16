type RpcAdjustedPriceRow = {
  adjusted_price?: number | string | null;
};

type RpcAdjustedEscalonadaRow = {
  cod?: string | number | null;
  faixa?: string | number | null;
  preco?: string | number | null;
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

export const fetchClientPriceMultiplier = async (clientCode: string): Promise<number> => {
  const safeClientCode = String(clientCode || '').trim();
  if (!safeClientCode) {
    return 1;
  }

  try {
    const adjusted = await fetchAdjustedPrice(safeClientCode, 100);
    if (!Number.isFinite(adjusted) || adjusted <= 0) {
      return 1;
    }
    return adjusted / 100;
  } catch {
    return 1;
  }
};

export const fetchAdjustedEscalonadaRows = async (
  clientCode: string,
  productCode: string
): Promise<Array<{ cod: string | number; faixa: string | number; preco: string | number }>> => {
  const safeClientCode = String(clientCode || '').trim();
  const safeProductCode = String(productCode || '').trim();

  if (!safeClientCode || !safeProductCode) {
    return [];
  }

  try {
    const { supabase } = await import('./supabase');
    const { data, error } = await supabase.rpc('get_adjusted_escalonada_for_client', {
      p_client_code: safeClientCode,
      p_product_code: safeProductCode,
    });

    if (error) {
      throw error;
    }

    const rows = ((data as RpcAdjustedEscalonadaRow[] | null) || [])
      .map((row) => ({
        cod: String(row?.cod ?? '').trim(),
        faixa: row?.faixa ?? '',
        preco: row?.preco ?? '',
      }))
      .filter((row) => String(row.cod).length > 0 && String(row.faixa).length > 0 && String(row.preco).length > 0);

    return rows;
  } catch (rpcError) {
    console.warn('⚠️ Falha ao buscar escalonadas ajustadas no backend.', rpcError);
    return [];
  }
};
