import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png';
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
        format: ImageManipulator.SaveFormat[format.toUpperCase()],
      }
    );

    return manipResult.uri;
  } catch (error) {
    console.error('Erro ao otimizar imagem:', error);
    return uri; // Retorna a URI original em caso de erro
  }
};

export const getImageDimensions = async (uri: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.width,
        height: img.height
      });
    };
    img.onerror = reject;
    img.src = uri;
  });
};

export const calculateAspectRatioFit = (
  srcWidth: number,
  srcHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } => {
  const ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
  return {
    width: srcWidth * ratio,
    height: srcHeight * ratio
  };
}; 