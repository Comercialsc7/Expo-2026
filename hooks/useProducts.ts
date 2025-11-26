import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

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
    try {
      setLoading(true);
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
      setProducts(allProducts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar produtos');
      console.error('Erro no catch de fetchProducts:', err);
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
      await fetchProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar produto');
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