import { create } from 'zustand';

interface SpinResult {
  prize: string;
  photoUri: string;
}

interface SpinResultsState {
  results: SpinResult[];
  addResult: (result: SpinResult) => void;
  clearResults: () => void;
}

export const useSpinResultsStore = create<SpinResultsState>((set) => ({
  results: [],
  addResult: (result) => set((state) => ({ results: [...state.results, result] })),
  clearResults: () => set({ results: [] }),
})); 