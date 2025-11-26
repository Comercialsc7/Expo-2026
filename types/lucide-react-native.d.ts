declare module 'lucide-react-native' {
  import { ComponentType } from 'react';
  import { SvgProps } from 'react-native-svg';

  export interface IconProps extends SvgProps {
    size?: number;
    color?: string;
    strokeWidth?: number;
  }

  export const MoreVertical: ComponentType<IconProps>;
  // Adicione outros ícones conforme necessário
} 