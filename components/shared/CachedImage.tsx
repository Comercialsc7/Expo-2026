/**
 * CachedImage
 *
 * Componente de imagem com cache persistente em disco via ImageCacheService.
 * - Enquanto o arquivo local não existe, exibe a URL remota (sem piscar).
 * - Quando o cache local fica pronto, atualiza para o caminho em disco.
 * - onError faz fallback automático para URL remota original.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Image, View, StyleSheet, Platform } from 'react-native';
import ImageCacheService from '../../lib/ImageCacheService';
import { getOptimizedRemoteImageUrl } from '../../lib/imageUtils';

interface CachedImageProps {
  uri: string | null | undefined;
  style: any;
  width?: number;
  quality?: number;
  progressive?: boolean;
  placeholder?: React.ReactNode;
}

export default function CachedImage({
  uri,
  style,
  width = 220,
  quality = 45,
  progressive = false,
  placeholder,
}: CachedImageProps) {
  const remoteUrl = useMemo(() => String(uri || '').trim(), [uri]);

  // No web usa URL otimizada; em native usa arquivo local via cache.
  const optimizedRemote = useMemo(
    () =>
      Platform.OS === 'web'
        ? getOptimizedRemoteImageUrl(remoteUrl, { width, quality })
        : remoteUrl,
    [remoteUrl, width, quality]
  );

  const [displayUri, setDisplayUri] = useState(optimizedRemote || remoteUrl);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (!remoteUrl) return;

    // Atualiza imediatamente com URL remota para não mostrar placeholder desnecessário.
    setDisplayUri(optimizedRemote || remoteUrl);

    if (Platform.OS === 'web') return; // web não precisa de cache de arquivo

    let active = true;
    ImageCacheService.resolveUri(remoteUrl)
      .then((localUri) => {
        if (!active) return;
        if (localUri && localUri !== remoteUrl) {
          setDisplayUri(localUri);
        }
      })
      .catch(() => { /* ignora — usa URL remota */ });

    return () => { active = false; };
  }, [remoteUrl, optimizedRemote]);

  const handleError = useCallback(() => {
    if (displayUri !== remoteUrl) {
      setDisplayUri(remoteUrl);
      return;
    }
    setFailed(true);
  }, [displayUri, remoteUrl]);

  if (!remoteUrl || failed) {
    return placeholder
      ? <>{placeholder}</>
      : <View style={[style, styles.placeholder]} />;
  }

  return (
    <Image
      source={{ uri: displayUri }}
      style={style}
      progressiveRenderingEnabled={progressive && Platform.OS === 'android'}
      fadeDuration={0}
      onError={handleError}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#E5E5E5',
  },
});
