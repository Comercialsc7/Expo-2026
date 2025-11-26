import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import SmartRequest from '../lib/SmartRequest';

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

/**
 * Hook para gerenciar produtos com suporte offline
 *
 * Usa SmartRequest para funcionar tanto online quanto offline
 */
export const useProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      // SmartRequest decide automaticamente: Supabase (online) ou PouchDB (offline)
      const data = await SmartRequest.select('products', {
        order: { column: 'name', ascending: true }
      });

      setProducts(data);
      console.log(`✅ ${data.length} produtos carregados`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar produtos';
      setError(errorMessage);
      console.error('Erro ao buscar produtos:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Alterna status de acelerador de um produto
   * Funciona online e offline
   */
  const toggleAccelerator = async (productId: string, isAccelerator: boolean) => {
    try {
      await SmartRequest.update('products', productId, {
        is_accelerator: isAccelerator,
        updated_at: new Date().toISOString()
      });

      // Atualiza localmente também
      setProducts(prev =>
        prev.map(p =>
          p.id === productId ? { ...p, is_accelerator: isAccelerator } : p
        )
      );

      console.log(`✅ Produto ${productId} atualizado`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar produto';
      setError(errorMessage);
      console.error('Erro ao atualizar produto:', err);
    }
  };

  /**
   * Busca produtos por categoria (se aplicável)
   */
  const searchByCategory = async (category: string) => {
    try {
      setLoading(true);
      const data = await SmartRequest.select('products', {
        eq: { column: 'category', value: category },
        order: { column: 'name', ascending: true }
      });
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar produtos');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Busca produtos aceleradores
   */
  const getAccelerators = async () => {
    try {
      setLoading(true);
      const data = await SmartRequest.select('products', {
        eq: { column: 'is_accelerator', value: true },
        order: { column: 'name', ascending: true }
      });
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar aceleradores');
    } finally {
      setLoading(false);
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
    toggleAccelerator,
    searchByCategory,
    getAccelerators,
  };
};
