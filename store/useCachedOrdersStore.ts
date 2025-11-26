import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { OrderItem, Client, PaymentTerm } from './useOrderStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

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
      clearCachedOrders: () => set({ cachedOrders: [] }),
      getOrderById: (id) => get().cachedOrders.find(order => order.id === id),
      removeCachedOrder: (orderId) => set((state) => {
        console.log('Cached orders antes da remoção (' + orderId + '):', state.cachedOrders.length);
        const updatedOrders = state.cachedOrders.filter(order => order.id !== orderId);
        console.log('Cached orders depois da remoção (' + orderId + '):', updatedOrders.length);
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