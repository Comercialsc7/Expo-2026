import { createIconSetFromIcoMoon } from '@expo/vector-icons';

export const Icons = {
  Menu: 'menu',
  Home: 'home',
  Users: 'users',
  Package: 'package',
  Settings: 'settings',
  LogOut: 'log-out',
  Share2: 'share-2',
} as const;

export type IconName = keyof typeof Icons; 