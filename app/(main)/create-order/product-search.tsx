import { useState } from 'react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null);
  const { paymentTermId } = useLocalSearchParams();
  const paymentTerms = usePaymentTermsStore(state => state.paymentTerms);
  const selectedPaymentTerm = paymentTerms.find(term => term.id === paymentTermId);
  const { suppliers, getUniqueProductsBySupplier, loading, error } = useProducts();

  const filteredSuppliers = suppliers.filter((supplier) =>
    supplier.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProducts = selectedSupplier === null
    ? []
    : getUniqueProductsBySupplier(selectedSupplier).filter((product: UniqueProductOption) =>
      (product.name && product.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (product.code && product.code.toLowerCase().includes(searchQuery.toLowerCase()))
    );

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

  const handleSelectProduct = (product: UniqueProductOption) => {
    router.push({
      pathname: '/(main)/create-order/product-detail',
      params: {
        cod_for: String(selectedSupplier),
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
            placeholder={selectedSupplier === null ? 'Buscar fornecedor...' : 'Buscar produto...'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {selectedSupplier !== null && (
        <View style={styles.breadcrumbContainer}>
          <TouchableOpacity
            style={styles.breadcrumbButton}
            onPress={() => {
              setSelectedSupplier(null);
              setSearchQuery('');
            }}
          >
            <Text style={styles.breadcrumbButtonText}>Trocar fornecedor</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={selectedSupplier === null ? filteredSuppliers : filteredProducts}
        keyExtractor={(item) =>
          selectedSupplier === null
            ? `${(item as unknown as { codFor: number; fornecedor: string }).codFor}-${(item as unknown as { codFor: number; fornecedor: string }).fornecedor}`
            : `${selectedSupplier}-${(item as UniqueProductOption).code}`
        }
        renderItem={({ item }) => {
          if (selectedSupplier === null) {
            const supplier = item as unknown as { codFor: number; label: string };
            return (
              <TouchableOpacity
                style={styles.productCard}
                onPress={() => {
                  setSelectedSupplier(Number(supplier.codFor));
                  setSearchQuery('');
                }}
              >
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{supplier.label}</Text>
                  <Text style={styles.productCode}>Fornecedor</Text>
                </View>
              </TouchableOpacity>
            );
          }

          const product = item as UniqueProductOption;
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