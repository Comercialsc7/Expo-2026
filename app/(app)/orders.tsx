import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, Platform, Dimensions, FlatList } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
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

interface Brand {
  id: string;
  name: string;
  image_url: string;
}

interface Order {
  id: string;
  client_name: string;
  total: number;
  status: string;
  created_at: string;
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
    padding: 12,
    width: 100,
    height: 100,
    justifyContent: 'center',
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
  brandImage: {
    width: 60,
    height: 40,
    resizeMode: 'contain',
    marginBottom: 8,
  },
  brandName: {
    fontSize: 12,
    color: '#003B71',
    fontFamily: 'Montserrat-Medium',
    textAlign: 'center',
  },
  productsSection: {
    marginBottom: 24,
  },
  productsScroll: {
    marginTop: 12,
    paddingHorizontal: 16,
  },
  productsGrid: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    justifyContent: 'space-between',
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
    flex: 1 / 3, // Each item takes 1/3 of the row
    margin: 4, // Add some margin between items
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
  productImage: {
    width: '100%',
    height: 100,
    resizeMode: 'contain',
    marginBottom: 8,
  },
  productInfo: {
    width: '100%',
  },
  productName: {
    fontSize: 14,
    color: '#003B71',
    fontFamily: 'Montserrat-Bold',
    marginBottom: 4,
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
});

export default function OrdersScreen() {
  const { banners } = useBannerStore();
  const [currentBanner, setCurrentBanner] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const fadeAnim = useSharedValue(1);
  const screenWidth = Dimensions.get('window').width;
  const { navigateTo } = useNavigation();
  const { products, loading: productsLoading, error: productsError } = useProducts();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
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
  }, [banners]);

  useEffect(() => {
    const fetchRepresentanteData = async () => {
      try {
        const nomeStr = await AsyncStorage.getItem('representanteNome');
        if (nomeStr) {
          setRepresentanteNome(nomeStr);
          console.log('Representante Nome recuperado:', nomeStr);
        }
      } catch (error) {
        console.error('Erro ao buscar nome do representante:', error);
      }
    };
    fetchRepresentanteData();
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  const handleViewAllBrands = () => {
    navigateTo('/brands' as any);
  };

  const handleOrder = () => {
    navigateTo('/(tabs)/create-order/select-client');
  };

  const handleSyncPress = () => {
    navigateTo('/sync-orders');
  };

  useEffect(() => {
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    const { data, error } = await supabase
      .from('brands')
      .select('id, name, image_url');

    if (error) {
      console.error('Erro ao buscar marcas:', error);
    } else {
      setBrands((data as Brand[]) || []);
    }
  };

  const acceleratorProducts = products.filter(
    product => String(product.is_accelerator) === 'true' || String(product.is_accelerator) === '1'
  );

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
          <Text style={styles.userName}>Vendedor {representanteNome || ''}</Text>
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
              resizeMode="contain"
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
          <SectionHeader 
            title="Marcas" 
            onViewAll={handleViewAllBrands}
          />
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.brandsScroll}
          >
            {brands.map((brand) => (
              <TouchableOpacity 
                key={brand.id}
                style={styles.brandCard}
                onPress={() => navigateTo(`/(tabs)/brands/${brand.id}` as any)}
              >
                <Image 
                  source={brand.image_url ? { uri: brand.image_url } : undefined}
                  style={styles.brandImage}
                />
                <Text style={styles.brandName}>{brand.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.productsSection}>
          <SectionHeader 
            title="Itens Aceleradores" 
            onViewAll={() => navigateTo('/products' as any)}
          />
          <FlatList
            data={acceleratorProducts}
            keyExtractor={(item) => item.id}
            renderItem={({ item: product }) => (
              <TouchableOpacity 
                key={product.id} 
                style={styles.productItemGrid}
                onPress={() => navigateTo('/products' as any)}
              >
                <Image 
                  source={{ uri: product.image_url }} 
                  style={styles.productImage}
                />
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{product.name}</Text>
                  <View style={styles.priceContainer}>
                    <Text style={styles.productPrice}>
                      R$ {product.price.toFixed(2)}
                    </Text>
                  </View>
                  <Text style={styles.productQuantity}>
                    {product.box_size} unidades
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            numColumns={3}
            contentContainerStyle={styles.productsGrid}
          />
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