import { create } from 'zustand';

export interface Banner {
  id: number;
  title: string;
  subtitle: string;
  backgroundColor: string;
  image: string;
  order: number;
}

interface BannerStore {
  banners: Banner[];
  setBanners: (banners: Banner[]) => void;
  addBanner: (banner: Banner) => void;
  updateBanner: (id: number, banner: Partial<Banner>) => void;
  deleteBanner: (id: number) => void;
  reorderBanners: (fromIndex: number, toIndex: number) => void;
}

export const useBannerStore = create<BannerStore>((set) => ({
  banners: [
    {
      id: 1,
      title: "Promoção Especial",
      subtitle: "Até 30% de desconto em bebidas",
      backgroundColor: "#FF6B6B",
      image: 'https://wuappvtbbjzdtgrcenwk.supabase.co/storage/v1/object/public/Comprapremiada/girosorte.gif',
      order: 0
    },
    {
      id: 2,
      title: "Novos Produtos",
      subtitle: "Confira os lançamentos",
      backgroundColor: "#4ECDC4",
      image: 'https://wuappvtbbjzdtgrcenwk.supabase.co/storage/v1/object/public/Comprapremiada/arte_roleta_sorte.jpg',
      order: 1
    },
  ],
  setBanners: (banners) => set({ banners }),
  addBanner: (banner) => set((state) => {
    const maxOrder = Math.max(...state.banners.map(b => b.order), -1);
    return { 
      banners: [...state.banners, { ...banner, order: maxOrder + 1 }]
    };
  }),
  updateBanner: (id, updatedBanner) => set((state) => ({
    banners: state.banners.map((banner) =>
      banner.id === id ? { ...banner, ...updatedBanner } : banner
    ),
  })),
  deleteBanner: (id) => set((state) => {
    const deletedBanner = state.banners.find(b => b.id === id);
    if (!deletedBanner) return state;

    const updatedBanners = state.banners
      .filter(banner => banner.id !== id)
      .map(banner => ({
        ...banner,
        order: banner.order > deletedBanner.order 
          ? banner.order - 1 
          : banner.order
      }));

    return { banners: updatedBanners };
  }),
  reorderBanners: (fromIndex: number, toIndex: number) => set((state) => {
    const newBanners = [...state.banners];
    const [movedBanner] = newBanners.splice(fromIndex, 1);
    newBanners.splice(toIndex, 0, movedBanner);

    return {
      banners: newBanners.map((banner, index) => ({
        ...banner,
        order: index
      }))
    };
  }),
}));