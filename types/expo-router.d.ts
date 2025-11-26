declare module 'expo-router' {
  import { ComponentType } from 'react';
  import { Router as ExpoRouter } from 'expo-router/build/types';

  export const useRouter: () => ExpoRouter;
  export const router: ExpoRouter;
  export const useLocalSearchParams: () => Record<string, string>;
  export const Stack: ComponentType<any> & {
    Screen: ComponentType<any>;
  };
  export const Tabs: ComponentType<any> & {
    Screen: ComponentType<any>;
  };
  export const Link: ComponentType<any>;
} 