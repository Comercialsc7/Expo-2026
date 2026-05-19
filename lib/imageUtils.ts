import * as ImageManipulator from 'expo-image-manipulator';

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