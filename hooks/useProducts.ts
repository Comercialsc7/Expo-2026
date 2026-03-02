import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import TableStore from '../lib/TableStore';

export interface Product {
  id: string;
  name: string;
  code: string;
  price: number;
  box_size: number;
  is_accelerator: boolean;
  image_url: string;
  created_at: string;
}

export const useProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = async () => {
    let hasCachedProducts = false;

    try {
      setLoading(true);
      setError(null);

      // Cache-first: sempre tenta renderizar o cache antes da rede
      try {
        const cachedProducts = await TableStore.get('products');
        if (cachedProducts && cachedProducts.length > 0) {
          const sortedCachedProducts = [...cachedProducts].sort((a, b) =>
            String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR')
          );
          setProducts(sortedCachedProducts as Product[]);
          hasCachedProducts = true;
        }
      } catch (cacheReadError) {
        console.warn('⚠️ Falha ao ler produtos do cache local:', cacheReadError);
      }

      // Buscar TODOS os produtos em lotes para evitar timeouts
      let allProducts: Product[] = [];
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;

      // Verificar quantos produtos existem no total
      const { count, error: countError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });
      if (countError) {
        console.warn('Erro ao contar produtos:', countError);
      }
      console.log(`Total esperado de produtos no banco: ${count}`);

      while (hasMore) {
        console.log(`🔄 Buscando lote ${Math.floor(offset / batchSize) + 1} (produtos ${offset + 1} a ${offset + batchSize})...`);
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('name', { ascending: true })
          .range(offset, offset + batchSize - 1);
        if (error) {
          console.error('Erro ao buscar produtos no Supabase:', error);
          throw error;
        }
        if (data && data.length > 0) {
          allProducts = [...allProducts, ...data];
          console.log(`✅ Lote carregado: ${data.length} produtos (Total acumulado: ${allProducts.length})`);
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
        } catch (cacheError) {
          console.warn('⚠️ Falha ao atualizar cache local de produtos:', cacheError);
        }
      }

      setProducts(allProducts);
    } catch (err) {
      console.warn('⚠️ Erro ao carregar produtos online. Usando cache local...', err);

      try {
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
        .update({ is_accelerator: isAccelerator })
        .eq('id', productId);

      if (error) throw error;

      const updatedProducts = products.map((product) =>
        product.id === productId
          ? { ...product, is_accelerator: isAccelerator }
          : product
      );

      setProducts(updatedProducts);

      try {
        await TableStore.set('products', updatedProducts);
      } catch (cacheError) {
        console.warn('⚠️ Falha ao persistir atualização local de produtos:', cacheError);
      }

      await fetchProducts();
    } catch (err) {
      const updatedProducts = products.map((product) =>
        product.id === productId
          ? { ...product, is_accelerator: isAccelerator }
          : product
      );

      setProducts(updatedProducts);

      try {
        await TableStore.set('products', updatedProducts);
      } catch (cacheError) {
        console.warn('⚠️ Falha ao salvar alteração local offline:', cacheError);
      }

      setError(err instanceof Error ? err.message : 'Erro ao atualizar produto (alteração salva localmente).');
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  return {
    products,
    loading,
    error,
    fetchProducts,
    toggleAccelerator
  };
}; 