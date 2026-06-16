import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import TableStore from '../lib/TableStore';
import OfflineSQLiteService from '../lib/OfflineSQLiteService';
import OfflineMutationQueue from '../lib/OfflineMutationQueue';
import { debugLog } from '../lib/logger';

export interface Product {
  id: string;
  name: string;
  code: string;
  price: number;
  emb: string;
  qtde: number;
  is_acelerator: boolean | number;
  image_url: string | null;
  fornecedor: string;
  cod_for: number;
  created_at: string;
}

export interface SupplierOption {
  codFor: number;
  fornecedor: string;
  label: string;
}

export interface UniqueProductOption {
  code: string;
  name: string;
  image_url: string | null;
  is_acelerator: boolean | number;
}

export const useProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const PRODUCTS_SELECT_COLUMNS = 'id, name, code, price, emb, qtde, is_acelerator, image_url, fornecedor, cod_for, created_at';

  const suppliers = useMemo(() => {
    const supplierMap = new Map<string, SupplierOption>();

    products.forEach((product) => {
      const codFor = Number(product.cod_for);
      const fornecedor = String(product.fornecedor || '').trim();

      if (!fornecedor || Number.isNaN(codFor)) {
        return;
      }

      const key = `${codFor}::${fornecedor}`;
      if (!supplierMap.has(key)) {
        supplierMap.set(key, {
          codFor,
          fornecedor,
          label: `${codFor} - ${fornecedor}`,
        });
      }
    });

    return Array.from(supplierMap.values()).sort((a, b) =>
      a.label.localeCompare(b.label, 'pt-BR')
    );
  }, [products]);

  const getUniqueProductsBySupplier = (codFor: number): UniqueProductOption[] => {
    const productMap = new Map<string, UniqueProductOption>();

    products
      .filter((product) => Number(product.cod_for) === Number(codFor))
      .forEach((product) => {
        if (!productMap.has(product.code)) {
          productMap.set(product.code, {
            code: product.code,
            name: product.name,
            image_url: product.image_url,
            is_acelerator: product.is_acelerator,
          });
        }
      });

    return Array.from(productMap.values()).sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR')
    );
  };

  const getProductVariants = (codFor: number, code: string): Product[] => {
    return products
      .filter(
        (product) =>
          Number(product.cod_for) === Number(codFor) &&
          String(product.code) === String(code)
      )
      .sort((a, b) => {
        const embComparison = String(a.emb || '').localeCompare(String(b.emb || ''), 'pt-BR');
        if (embComparison !== 0) {
          return embComparison;
        }
        return Number(a.qtde || 0) - Number(b.qtde || 0);
      });
  };

  const fetchProducts = async () => {
    let hasCachedProducts = false;
    let loadingReleasedByCache = false;

    try {
      setLoading(true);
      setError(null);

      // Cache-first: sempre tenta renderizar o cache antes da rede
      try {
        const sqliteProducts = await OfflineSQLiteService.getAll('products');
        if (sqliteProducts && sqliteProducts.length > 0) {
          const sortedSQLiteProducts = [...sqliteProducts].sort((a: any, b: any) =>
            String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR')
          );
          setProducts(sortedSQLiteProducts as Product[]);
          hasCachedProducts = true;
          if (!loadingReleasedByCache) {
            setLoading(false);
            loadingReleasedByCache = true;
          }
        }

        const cachedProducts = await TableStore.get('products');
        if (cachedProducts && cachedProducts.length > 0) {
          const sortedCachedProducts = [...cachedProducts].sort((a, b) =>
            String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR')
          );
          setProducts(sortedCachedProducts as Product[]);
          hasCachedProducts = true;
          if (!loadingReleasedByCache) {
            setLoading(false);
            loadingReleasedByCache = true;
          }
        }
      } catch (cacheReadError) {
        console.warn('⚠️ Falha ao ler produtos do cache local:', cacheReadError);
      }

      // Buscar TODOS os produtos em lotes para evitar timeouts
      let allProducts: Product[] = [];
      const batchSize = 500;
      let offset = 0;
      let hasMore = true;

      // Verificar quantos produtos existem no total
      const { count, error: countError } = await supabase
        .from('products')
        .select(PRODUCTS_SELECT_COLUMNS, { count: 'exact', head: true });
      if (countError) {
        console.warn('Erro ao contar produtos:', countError);
      }
      debugLog(`Total esperado de produtos no banco: ${count}`);

      while (hasMore) {
        debugLog(`🔄 Buscando lote ${Math.floor(offset / batchSize) + 1} (produtos ${offset + 1} a ${offset + batchSize})...`);
        const { data, error } = await supabase
          .from('products')
          .select(PRODUCTS_SELECT_COLUMNS)
          .order('name', { ascending: true })
          .range(offset, offset + batchSize - 1);
        if (error) {
          console.error('Erro ao buscar produtos no Supabase:', error);
          throw error;
        }
        if (data && data.length > 0) {
          allProducts.push(...(data as Product[]));
          debugLog(`✅ Lote carregado: ${data.length} produtos (Total acumulado: ${allProducts.length})`);
          if (data.length < batchSize) {
            hasMore = false;
          } else {
            offset += batchSize;
          }
        } else {
          hasMore = false;
        }
      }
      if (count && allProducts.length < count) {
        console.warn(`⚠️ ATENÇÃO: Esperávamos ${count} produtos, mas recebemos apenas ${allProducts.length}`);
      }

      if (allProducts.length > 0) {
        try {
          await TableStore.set('products', allProducts);
          await OfflineSQLiteService.replaceTable('products', allProducts);
        } catch (cacheError) {
          console.warn('⚠️ Falha ao atualizar cache local de produtos:', cacheError);
        }
      }

      setProducts(allProducts);
    } catch (err) {
      console.warn('⚠️ Erro ao carregar produtos online. Usando cache local...', err);

      try {
        const sqliteProducts = await OfflineSQLiteService.getAll('products');
        if (sqliteProducts && sqliteProducts.length > 0) {
          const sortedSQLiteProducts = [...sqliteProducts].sort((a: any, b: any) =>
            String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR')
          );
          setProducts(sortedSQLiteProducts as Product[]);
          setError(null);
          return;
        }

        const cachedProducts = await TableStore.get('products');

        if (cachedProducts && cachedProducts.length > 0) {
          const sortedCachedProducts = [...cachedProducts].sort((a, b) =>
            String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR')
          );
          setProducts(sortedCachedProducts as Product[]);
          setError(null);
        } else {
          if (hasCachedProducts || products.length > 0) {
            setError(null);
          } else {
            setError('Sem conexão e sem produtos em cache.');
          }
        }
      } catch (cacheErr) {
        if (!hasCachedProducts && products.length === 0) {
          setError('Erro ao carregar produtos (online e offline).');
        }
        console.error('Erro no fallback de produtos em cache:', cacheErr);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleAccelerator = async (productId: string, isAccelerator: boolean) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_acelerator: isAccelerator })
        .eq('id', productId);

      if (error) throw error;

      const updatedProducts = products.map((product) =>
        product.id === productId
          ? { ...product, is_acelerator: isAccelerator }
          : product
      );

      setProducts(updatedProducts);

      try {
        await TableStore.set('products', updatedProducts);
        await OfflineSQLiteService.replaceTable('products', updatedProducts);
      } catch (cacheError) {
        console.warn('⚠️ Falha ao persistir atualização local de produtos:', cacheError);
      }

      await fetchProducts();
    } catch (err) {
      const updatedProducts = products.map((product) =>
        product.id === productId
          ? { ...product, is_acelerator: isAccelerator }
          : product
      );

      setProducts(updatedProducts);

      try {
        await TableStore.set('products', updatedProducts);
        await OfflineSQLiteService.replaceTable('products', updatedProducts);
        await OfflineMutationQueue.enqueue(
          'products',
          'update',
          {
            values: {
              is_acelerator: isAccelerator,
              updated_at: new Date().toISOString(),
            },
            filters: { id: productId },
          },
          `products:update:id:${productId}:accelerator:${isAccelerator ? 1 : 0}`
        );
      } catch (cacheError) {
        console.warn('⚠️ Falha ao salvar alteração local offline:', cacheError);
      }

      setError(err instanceof Error ? err.message : 'Erro ao atualizar produto (alteração salva localmente).');
    }
  };

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    products,
    loading,
    error,
    suppliers,
    getUniqueProductsBySupplier,
    getProductVariants,
    fetchProducts,
    toggleAccelerator
  };
}; 