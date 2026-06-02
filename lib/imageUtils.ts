import * as ImageManipulator from 'expo-image-manipulator';

interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png';
}

interface RemoteImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number;
}

export const optimizeImage = async (
  uri: string,
  options: ImageOptimizationOptions = {}
): Promise<string> => {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.8,
    format = 'jpeg'
  } = options;
  const saveFormat = format === 'png'
    ? ImageManipulator.SaveFormat.PNG
    : ImageManipulator.SaveFormat.JPEG;

  try {
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [
        {
          resize: {
            width: maxWidth,
            height: maxHeight
          }
        }
      ],
      {
        compress: quality,
        format: saveFormat,
      }
    );

    return manipResult.uri;
  } catch (error) {
    console.error('Erro ao otimizar imagem:', error);
    return uri; // Retorna a URI original em caso de erro
  }
};

export const getOptimizedRemoteImageUrl = (
  uri: string | null | undefined,
  options: RemoteImageOptimizationOptions = {}
): string => {
  const original = String(uri || '').trim();
  if (!original) {
    return '';
  }

  const { width = 220, height, quality = 45 } = options;

  try {
    const url = new URL(original);
    const isSupabasePublicObject = url.pathname.includes('/storage/v1/object/public/');

    if (!isSupabasePublicObject) {
      return original;
    }

    url.pathname = url.pathname.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
    url.searchParams.set('width', String(width));
    if (height && height > 0) {
      url.searchParams.set('height', String(height));
    }
    url.searchParams.set('quality', String(Math.max(20, Math.min(quality, 80))));

    return url.toString();
  } catch {
    return original;
  }
};