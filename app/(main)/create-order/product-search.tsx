import { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, Image, FlatList, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { usePaymentTermsStore } from '../../../store/usePaymentTermsStore';
import { useProducts, UniqueProductOption } from '../../../hooks/useProducts';

const Diamond = require('../../../assets/images/diamond.png');

/*
interface Product {
  id: string;
  name: string;
  code: string;
  price: number;
  image_url: string | null;
}
*/

export default function ProductSearch() {
  type SearchableProduct = UniqueProductOption & { codFor: number; fornecedor: string };

  const [searchQuery, setSearchQuery] = useState('');
  const { paymentTermId } = useLocalSearchParams();
  const paymentTerms = usePaymentTermsStore(state => state.paymentTerms);
  const selectedPaymentTerm = paymentTerms.find(term => term.id === paymentTermId);
  const { suppliers, getUniqueProductsBySupplier, loading, error } = useProducts();

  const searchableProducts = useMemo<SearchableProduct[]>(() => {
    return suppliers.flatMap((supplier) =>
      getUniqueProductsBySupplier(supplier.codFor).map((product) => ({
        ...product,
        codFor: supplier.codFor,
        fornecedor: supplier.fornecedor,
      }))
    );
  }, [suppliers, getUniqueProductsBySupplier]);

  const filteredProducts = searchableProducts.filter((product) => {
    const term = searchQuery.toLowerCase();
    return (
      String(product.name || '').toLowerCase().includes(term) ||
      String(product.code || '').toLowerCase().includes(term)
    );
  });

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#003B71" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const handleSelectProduct = (product: SearchableProduct) => {
    router.push({
      pathname: '/(main)/create-order/product-detail',
      params: {
        cod_for: String(product.codFor),
        name: product.name,
        code: product.code,
        image_url: product.image_url,
        paymentTermId: paymentTermId ? String(paymentTermId) : '',
      }
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Image source={require('../../../assets/images/voltar.png')} style={styles.headerIconImage} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Selecionar Produtos</Text>
      </View>

      {selectedPaymentTerm && (
        <View style={styles.paymentTermContainer}>
          <View style={{ width: 20, height: 20, backgroundColor: '#003B71' }} />
          <Text style={styles.paymentTermText}>
            Prazo de Pagamento: {selectedPaymentTerm.days} dias
          </Text>
        </View>
      )}

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Image source={require('../../../assets/images/buscar.png')} style={styles.searchInnerIconImage} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar produto ou codigo..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <FlatList<SearchableProduct>
        data={filteredProducts}
        keyExtractor={(item) => `${item.codFor}-${item.code}`}
        renderItem={({ item }) => {
          const product = item;
          const isAccelerator =
            product.is_acelerator === true ||
            Number(product.is_acelerator) === 1;

          return (
            <TouchableOpacity
              style={styles.productCard}
              onPress={() => handleSelectProduct(product)}
            >
              <View style={styles.productInfo}>
                <View style={styles.productHeaderNew}>
                  <Text style={styles.productCode}>{product.code}</Text>
                  {isAccelerator ? (
                    <Image source={Diamond} style={styles.productAcceleratorIcon} />
                  ) : (
                    <Text style={{ width: 30 }}></Text>
                  )}
                </View>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.productCode}>{product.fornecedor}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.content}
        initialNumToRender={16}
        maxToRenderPerBatch={16}
        updateCellsBatchingPeriod={60}
        windowSize={8}
        removeClippedSubviews
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 16,
    fontFamily: 'Montserrat-Regular',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    paddingTop: Platform.OS === 'web' ? 16 : 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    marginRight: 16,
  },
  headerIconImage: {
    width: 40,
    height: 40,
  },
  headerTitle: {
    fontSize: 20,
    color: '#003B71',
    fontFamily: 'Montserrat-Bold',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#003B71',
    fontFamily: 'Montserrat-Regular',
  },
  searchInnerIconImage: {
    width: 40,
    height: 40,
  },
  breadcrumbContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  breadcrumbButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F0FE',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  breadcrumbButtonText: {
    fontSize: 12,
    color: '#003B71',
    fontFamily: 'Montserrat-SemiBold',
  },
  content: {
    padding: 16,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      }
    }),
  },
  productInfo: {
    padding: 8,
  },
  productHeaderNew: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  productCode: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'Montserrat-Regular',
  },
  rightSection: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  productAcceleratorIcon: {
    width: 30,
    height: 30,
  },
  productName: {
    fontSize: 16,
    color: '#003B71',
    fontFamily: 'Montserrat-Bold',
    marginBottom: 2,
  },
  boxSize: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'Montserrat-Regular',
    marginBottom: 4,
  },
  boxAndPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  price: {
    fontSize: 16,
    color: '#333333',
    fontFamily: 'Montserrat-SemiBold',
  },
  discountBadge: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  discountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
  },
  paymentTermContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F0FE',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  paymentTermText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#003B71',
    fontFamily: 'Montserrat-Medium',
  },
});