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
      console.log('Buscando produtos do Supabase...');
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar produtos no Supabase:', error);
        throw error;
      }
      console.log('Produtos recebidos do Supabase:', data ? data.length : 0);
      data?.forEach(product => {
        console.log(`DEBUG useProducts: Produto ${product.name}, is_accelerator: ${product.is_accelerator} (tipo: ${typeof product.is_accelerator})`);
      });
      setProducts(data || []);
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