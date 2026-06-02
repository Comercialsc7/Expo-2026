import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { MovingBorderButton } from '../../components/ui/moving-border';
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
  withSequence,
  withDelay
} from 'react-native-reanimated';
import { useBannerStore } from '../../store/useBannerStore';
import { Sidebar, MenuItem } from '../../components/shared/Sidebar';
import { useNavigation } from '../../hooks/useNavigation';
import { supabase } from '../../lib/supabase';
import SectionHeader from '../../components/shared/SectionHeader';
import { useProducts } from '../../hooks/useProducts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TableStore from '../../lib/TableStore';
import OfflineSQLiteService from '../../lib/OfflineSQLiteService';

const Diamond = require('../../assets/images/diamond.png');

interface Brand {
  id: string;
  name: string;
  image_url: string | null;
  created_at?: string;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContentContainer: {
    paddingBottom: 100, // Ajuste este valor conforme a altura do botão e o espaçamento desejado
  },
  menuButton: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 16 : 48,
    left: 16,
    zIndex: 1,
    width: 40,
    height: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#003B71',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 4px 14px rgba(0, 59, 113, 0.2)',
      }
    }),
  },
  header: {
    paddingTop: Platform.OS === 'web' ? 16 : 48,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeContainer: {
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 16,
    color: '#666666',
    fontFamily: 'Montserrat-Regular',
  },
  userName: {
    fontSize: 24,
    color: '#003B71',
    fontFamily: 'Montserrat-Bold',
  },
  bannerContainer: {
    width: '100%',
    borderRadius: 40,
    overflow: 'hidden',
    aspectRatio: 3.3,
    alignSelf: 'center',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  bannerIndicators: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
    gap: 8,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  brandsSection: {
    marginBottom: 24,
  },
  brandsScroll: {
    marginTop: 12,
    paddingHorizontal: 16,
  },
  brandCard: {
    marginRight: 16,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
    width: 108,
    height: 108,
    justifyContent: 'space-between',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      }
    }),
  },
  brandImageContainer: {
    width: '100%',
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  brandImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 6,
  },
  brandImagePlaceholderText: {
    fontSize: 10,
    color: '#999999',
    fontFamily: 'Montserrat-Regular',
  },
  brandName: {
    fontSize: 12,
    color: '#003B71',
    fontFamily: 'Montserrat-Medium',
    textAlign: 'center',
    lineHeight: 14,
    width: '100%',
  },
  productsSection: {
    marginBottom: 24,
  },
  productsScroll: {
    marginTop: 12,
    paddingHorizontal: 16,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 12,
    justifyContent: 'flex-start',
  },
  productItem: {
    marginRight: 16,
    width: 150,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      }
    }),
  },
  productItemGrid: {
    position: 'relative',
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      }
    }),
  },
  productImage: {
    width: '100%',
    height: 100,
    resizeMode: 'contain',
    marginBottom: 8,
  },
  productImagePlaceholder: {
    width: '100%',
    height: 100,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 6,
  },
  productImagePlaceholderText: {
    fontSize: 10,
    color: '#999999',
    fontFamily: 'Montserrat-Regular',
  },
  productDiamondBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    resizeMode: 'contain',
    zIndex: 2,
  },
  productInfo: {
    width: '100%',
  },
  productName: {
    fontSize: 14,
    color: '#003B71',
    fontFamily: 'Montserrat-Bold',
    marginBottom: 4,
    lineHeight: 18,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 16,
    color: '#0088CC',
    fontFamily: 'Montserrat-Bold',
  },
  productQuantity: {
    fontSize: 12,
    color: '#666666',
    fontFamily: 'Montserrat-Regular',
    lineHeight: 16,
  },
  orderButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  orderButton: {
    width: '100%',
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  orderButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
  },
  menuButtonText: {
    fontSize: 24,
    color: '#003B71',
    paddingHorizontal: 16,
  },
  shareButtonText: {
    fontSize: 14,
    color: '#003B71',
    marginRight: 16,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderInfo: {
    flex: 1,
  },
  orderClient: {
    fontSize: 16,
    color: '#003B71',
    fontFamily: 'Montserrat-Bold',
    marginBottom: 4,
  },
  orderTotal: {
    fontSize: 16,
    color: '#003B71',
    fontFamily: 'Montserrat-Medium',
  },
  orderStatus: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'Montserrat-Regular',
    marginTop: 4,
  },
  orderDate: {
    fontSize: 12,
    color: '#999999',
    fontFamily: 'Montserrat-Regular',
    marginTop: 4,
  },
  sectionStateText: {
    marginTop: 12,
    paddingHorizontal: 16,
    fontSize: 13,
    color: '#666666',
    fontFamily: 'Montserrat-Regular',
  },
  sectionErrorText: {
    marginTop: 12,
    paddingHorizontal: 16,
    fontSize: 13,
    color: '#C62828',
    fontFamily: 'Montserrat-Regular',
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitleText: {
    fontSize: 16,
    color: '#003B71',
    fontFamily: 'Montserrat-Bold',
  },
});

export default function OrdersScreen() {
  const { banners } = useBannerStore();
  const [currentBanner, setCurrentBanner] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const fadeAnim = useSharedValue(1);
  const { width: screenWidth } = useWindowDimensions();
  const gridHorizontalPadding = 32;
  const gridColumnGap = 12;
  const gridRowGap = 12;
  const productCardWidth = Math.max(
    86,
    Math.floor((screenWidth - gridHorizontalPadding - gridColumnGap * 2) / 3)
  );
  const productImageHeight = Math.max(60, Math.min(90, productCardWidth - 16));
  const { navigateTo } = useNavigation();
  const { products, loading: productsLoading, error: productsError } = useProducts();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [representanteNome, setRepresentanteNome] = useState<string | null>(null);

  const menuItems: MenuItem[] = [
    {
      title: 'Página Inicial',
      route: '/(app)/orders',
    },
    {
      title: 'Clientes',
      route: '/create-order/select-client',
    },
    {
      title: 'Produtos',
      route: '/products',
    },
    {
      title: 'Sair',
      route: '/(auth)/login',
      color: '#FF3B30',
    },
  ];

  const handleNavigation = (route: string) => {
    router.push(route as any);
    setIsOpen(false);
  };

  useEffect(() => {
    if (!banners || banners.length === 0) return;

    const interval = setInterval(() => {
      fadeAnim.value = withSequence(
        withTiming(0, { duration: 500 }),
        withDelay(100, withTiming(1, { duration: 500 }))
      );
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 18000);

    return () => clearInterval(interval);
  }, [banners, fadeAnim]);

  useEffect(() => {
    let isMounted = true;

    const fetchRepresentanteData = async () => {
      try {
        const nomeStr = await AsyncStorage.getItem('representanteNome');
        if (isMounted && nomeStr) {
          setRepresentanteNome(nomeStr);
          console.log('Representante Nome recuperado:', nomeStr);
        }
      } catch (error) {
        console.error('Erro ao buscar nome do representante:', error);
      }
    };

    fetchRepresentanteData();

    return () => {
      isMounted = false;
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  const handleOrder = () => {
    navigateTo('/(main)/create-order/select-client');
  };

  const handleSyncPress = () => {
    navigateTo('/sync-orders');
  };

  useEffect(() => {
    let isMounted = true;

    const fetchBrands = async () => {
      let hasCachedBrands = false;

      try {
        const sqliteBrands = await OfflineSQLiteService.getAll<Brand>('brands');
        if (sqliteBrands.length > 0 && isMounted) {
          const sortedSQLiteBrands = [...sqliteBrands].sort((a, b) =>
            String(a.created_at || '').localeCompare(String(b.created_at || ''))
          );
          setBrands(sortedSQLiteBrands);
          hasCachedBrands = true;
        }

        const tableStoreBrands = await TableStore.get('brands');
        if (tableStoreBrands.length > 0 && isMounted) {
          const sortedTableStoreBrands = [...tableStoreBrands].sort((a: Brand, b: Brand) =>
            String(a.created_at || '').localeCompare(String(b.created_at || ''))
          );
          setBrands(sortedTableStoreBrands as Brand[]);
          hasCachedBrands = true;
        }
      } catch (cacheError) {
        console.warn('Falha ao carregar marcas do cache local:', cacheError);
      }

      try {
        const { data, error } = await supabase
          .from('brands')
          .select('id, name, image_url, created_at')
          .order('created_at', { ascending: true });

        if (error) {
          throw error;
        }

        const onlineBrands = (data as Brand[]) || [];
        if (isMounted) {
          setBrands(onlineBrands);
        }

        if (onlineBrands.length > 0) {
          await TableStore.set('brands', onlineBrands);
          await OfflineSQLiteService.replaceTable('brands', onlineBrands);
        }
      } catch (onlineError) {
        if (isMounted && !hasCachedBrands) {
          console.error('Erro ao buscar marcas:', onlineError);
          setBrands([]);
        }
      }
    };

    fetchBrands();

    return () => {
      isMounted = false;
    };
  }, []);

  const acceleratorProducts = useMemo(() => {
    const onlyAccelerators = products.filter(
      (product) => String(product.is_acelerator) === 'true' || String(product.is_acelerator) === '1'
    );

    const uniqueByCode = new Map<string, (typeof onlyAccelerators)[number]>();

    for (const product of onlyAccelerators) {
      const code = String(product.code || '').trim();
      if (!code) continue;

      const existing = uniqueByCode.get(code);
      if (!existing) {
        uniqueByCode.set(code, product);
        continue;
      }

      const currentQtde = Number(product.qtde || 0);
      const existingQtde = Number(existing.qtde || 0);
      if (currentQtde < existingQtde) {
        uniqueByCode.set(code, product);
      }
    }

    return Array.from(uniqueByCode.values()).sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR')
    );
  }, [products]);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.menuButton}
        onPress={() => setIsOpen(true)}
      >
        <Text style={styles.menuButtonText}>☰</Text>
      </TouchableOpacity>

      <Sidebar
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onNavigate={handleNavigation}
        menuItems={menuItems}
      />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.shareButton} onPress={handleSyncPress}>
            <Image source={require('../../assets/images/integrar.png')} style={{ width: 60, height: 60 }} />
          </TouchableOpacity>
        </View>
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeText}>Bem-vindo</Text>
          <Text style={styles.userName}>Vendedor(a): {representanteNome || ''}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContentContainer}
      >
        {banners && banners.length > 0 && banners[currentBanner] && (
          <Animated.View style={[styles.bannerContainer, { width: screenWidth }, animatedStyle]}>
            <Image
              source={typeof banners[currentBanner].image === 'string' ? { uri: banners[currentBanner].image } : banners[currentBanner].image}
              style={[styles.bannerImage, { width: screenWidth }]}
              resizeMode="cover"
            />
            <View style={styles.bannerIndicators}>
              {banners.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.indicator,
                    { backgroundColor: index === currentBanner ? '#000000' : 'rgba(0, 0, 0, 0.3)' }
                  ]}
                />
              ))}
            </View>
          </Animated.View>
        )}

        <View style={styles.brandsSection}>
          <SectionHeader title="Marcas" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.brandsScroll}
          >
            {brands.map((brand) => (
              <View
                key={brand.id}
                style={styles.brandCard}
              >
                <View style={styles.brandImageContainer}>
                  {brand.image_url ? (
                    <Image
                      source={{ uri: brand.image_url }}
                      style={styles.brandImage}
                    />
                  ) : (
                    <View style={styles.brandImagePlaceholder}>
                      <Text style={styles.brandImagePlaceholderText}>Sem imagem</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.brandName} numberOfLines={2}>{brand.name}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.productsSection}>
          <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitleText}>Itens Aceleradores</Text>
            <TouchableOpacity
              style={{ marginLeft: 'auto' }}
              onPress={() => navigateTo('/create-order' as any)}
            >
              <Text style={{ fontSize: 13, color: '#0088CC', fontFamily: 'Montserrat-Medium' }}>Ver todos</Text>
            </TouchableOpacity>
          </View>
          {productsLoading ? (
            <Text style={styles.sectionStateText}>Carregando itens aceleradores...</Text>
          ) : productsError ? (
            <Text style={styles.sectionErrorText}>Erro ao carregar itens aceleradores.</Text>
          ) : acceleratorProducts.length === 0 ? (
            <Text style={styles.sectionStateText}>Nenhum item acelerador disponível.</Text>
          ) : (
            <View style={styles.productsGrid}>
              {acceleratorProducts.map((product, index) => (
                <TouchableOpacity
                  key={product.id}
                  style={[
                    styles.productItemGrid,
                    {
                      width: productCardWidth,
                      marginRight: (index + 1) % 3 === 0 ? 0 : gridColumnGap,
                      marginBottom: gridRowGap,
                    },
                  ]}
                  onPress={() => navigateTo('/create-order' as any)}
                >
                  <Image
                    source={Diamond}
                    style={styles.productDiamondBadge}
                  />
                  {product.image_url ? (
                    <Image
                      source={{ uri: product.image_url }}
                      style={[styles.productImage, { height: productImageHeight }]}
                    />
                  ) : (
                    <View style={[styles.productImagePlaceholder, { height: productImageHeight }]}>
                      <Text style={styles.productImagePlaceholderText}>Sem imagem</Text>
                    </View>
                  )}
                  <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                    <View style={styles.priceContainer}>
                      <Text style={styles.productPrice}>
                        R$ {Number(product.price || 0).toFixed(2)}
                      </Text>
                    </View>
                    <Text style={styles.productQuantity} numberOfLines={1}>
                      {product.emb} - {product.qtde}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Botão Fazer Pedido flutuante */}
      <View style={styles.orderButtonContainer}>
        <MovingBorderButton
          onPress={handleOrder}
          style={styles.orderButton}
        >
          <Text style={styles.orderButtonText}>Fazer Pedido</Text>
        </MovingBorderButton>
      </View>

    </View>
  );
} 