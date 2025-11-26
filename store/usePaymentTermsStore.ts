import { create } from 'zustand';

interface PaymentTerm {
  id: string;
  days: number;
  description: string;
}

interface PaymentTermsState {
  paymentTerms: PaymentTerm[];
  addPaymentTerm: (term: Omit<PaymentTerm, 'id'>) => void;
  removePaymentTerm: (id: string) => void;
  updatePaymentTerm: (id: string, term: Partial<Omit<PaymentTerm, 'id'>>) => void;
}

const initialPaymentTerms: PaymentTerm[] = [
  { id: '1', days: 7, description: '7 dias' },
  { id: '2', days: 14, description: '14 dias' },
  { id: '3', days: 30, description: '30 dias' },
];

export const usePaymentTermsStore = create<PaymentTermsState>((set) => ({
  paymentTerms: initialPaymentTerms,
  addPaymentTerm: (term) => set((state) => ({
    paymentTerms: [...state.paymentTerms, { ...term, id: Date.now().toString() }],
  })),
  removePaymentTerm: (id) => set((state) => ({
    paymentTerms: state.paymentTerms.filter((term) => term.id !== id),
  })),
  updatePaymentTerm: (id, updatedTerm) => set((state) => ({
    paymentTerms: state.paymentTerms.map((term) =>
      term.id === id ? { ...term, ...updatedTerm } : term
    ),
  })),
})); 