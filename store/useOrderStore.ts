import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Platform } from 'react-native';

export interface OrderItem {
  id: string;
  code: string;
  name: string;
  box: string;
  price: number;
  discount: number;
  image: string;
  quantity: number;
  isAccelerator: boolean;
  paymentTerm?: PaymentTerm;
}

export interface ClientPaymentTerm {
  id: string;
  prazo_id: number;
  is_default: boolean;
  prazo: PaymentTerm;
}

export interface Client {
  id: string;
  name: string;
  code: string;
  cnpj: string;
  equipe?: number;
  repre?: string;
  address?: string;
  payment_terms?: ClientPaymentTerm[];
}

export interface PaymentTerm {
  id: string;
  description: string;
  prazo_dias?: number;
}

interface OrderState {
  items: OrderItem[];
  client?: Client;
  paymentTerm?: PaymentTerm;
  addItem: (item: OrderItem) => void;
  removeItem: (index: number) => void;
  updateItemQuantity: (index: number, quantity: number) => void;
  clearOrder: () => void;
  setClient: (client: Client) => void;
  setPaymentTerm: (term: PaymentTerm) => void;
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
  return createJSONStorage(() => createNoopStorage()); // No persistence on native for this store
};

export const useOrderStore = create<OrderState>()(
  persist(
    (set) => ({
      items: [],
      client: undefined,
      paymentTerm: undefined,
      addItem: (item) => set((state) => ({ items: [...state.items, item] })),
      removeItem: (index) => set((state) => ({ 
        items: state.items.filter((_, i) => i !== index) 
      })),
      updateItemQuantity: (index, quantity) => set((state) => ({
        items: state.items.map((item, i) => 
          i === index ? { ...item, quantity } : item
        )
      })),
      clearOrder: () => set({ items: [], client: undefined, paymentTerm: undefined }),
      setClient: (client) => set({ client }),
      setPaymentTerm: (term) => set({ paymentTerm: term }),
    }),
    {
      name: 'order-storage',
      storage: getStorage(),
    }
  )
);