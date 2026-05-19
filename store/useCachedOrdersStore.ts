import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { OrderItem, Client, PaymentTerm } from './useOrderStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import SQLiteStore from '../lib/SQLiteStore';

export interface CachedOrder {
  id: string;
  items: OrderItem[];
  client: Client;
  paymentTerm: PaymentTerm;
  timestamp: string;
  subtotal: number;
  total: number;
  discount: number;
  sellerCode?: string;
  userId?: string;
  spinPrize?: {
    type: 'product' | 'no_prize';
    description: string;
    photo?: string;
  };
  email?: string;
  enviado?: boolean;
}

interface CachedOrdersState {
  cachedOrders: CachedOrder[];
  _hasHydrated: boolean;
  addCachedOrder: (order: CachedOrder) => void;
  clearCachedOrders: () => void;
  getOrderById: (id: string) => CachedOrder | undefined;
  removeCachedOrder: (orderId: string) => void;
  updateCachedOrder: (orderId: string, updater: (order: CachedOrder) => CachedOrder) => void;
  setHasHydrated: (state: boolean) => void;
}

// Create a dummy storage for SSR
const createNoopStorage = () => {
  return {
    getItem: () => Promise.resolve(null),
    setItem: () => Promise.resolve(),
    removeItem: () => Promise.resolve(),
  };
};

// Get the appropriate storage mechanism
const getStorage = () => {
  if (Platform.OS === 'web') {
    // Check if we're in a browser environment
    if (typeof window !== 'undefined') {
      return createJSONStorage(() => localStorage);
    }
    // If we're not in a browser (SSR), use noop storage
    return createJSONStorage(() => createNoopStorage());
  }
  // For React Native, use AsyncStorage
  return createJSONStorage(() => AsyncStorage);
};

export const useCachedOrdersStore = create<CachedOrdersState>()(
  persist(
    (set, get) => ({
      cachedOrders: [],
      _hasHydrated: false,
      addCachedOrder: (order) => set((state) => ({
        cachedOrders: [...state.cachedOrders, order],
      })),
      clearCachedOrders: () => {
        set({ cachedOrders: [] });
        void SQLiteStore.clear('cached_orders');
      },
      getOrderById: (id) => get().cachedOrders.find(order => order.id === id),
      removeCachedOrder: (orderId) => set((state) => {
        console.log('Cached orders antes da remoção (' + orderId + '):', state.cachedOrders.length);
        const updatedOrders = state.cachedOrders.filter(order => order.id !== orderId);
        console.log('Cached orders depois da remoção (' + orderId + '):', updatedOrders.length);
        void SQLiteStore.remove('cached_orders', orderId);
        return { cachedOrders: updatedOrders };
      }),
      updateCachedOrder: (orderId, updater) => set((state) => {
        const updatedOrders = state.cachedOrders.map((order) => {
          if (order.id !== orderId) {
            return order;
          }

          return updater(order);
        });

        const updatedOrder = updatedOrders.find((order) => order.id === orderId);
        if (updatedOrder) {
          void SQLiteStore.save('cached_orders', {
            ...updatedOrder,
            _id: updatedOrder.id,
          });
        }

        return { cachedOrders: updatedOrders };
      }),
      setHasHydrated: (state) => {
        set({
          _hasHydrated: state
        });
      },
    }),
    {
      name: 'cached-orders-storage',
      storage: getStorage(),
      onRehydrateStorage: () => {
        return (state, error) => {
          if (error) {
            console.error('cached-orders-storage hydration failed', error);
          } else {
            (state as CachedOrdersState)?.setHasHydrated(true);
          }
        };
      },
    }
  )
);

useCachedOrdersStore.subscribe((state) => {
  if (state.cachedOrders.length === 0) {
    return;
  }

  for (const order of state.cachedOrders) {
    void SQLiteStore.save('cached_orders', {
      ...order,
      _id: order.id,
    });
  }
});