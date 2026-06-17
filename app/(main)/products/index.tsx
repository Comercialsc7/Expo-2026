import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Image } from 'react-native';
import { router } from 'expo-router';
import { useProducts, SupplierOption, UniqueProductOption } from '../../../hooks/useProducts';
import CachedImage from '../../../components/shared/CachedImage';

export default function ProductsScreen() {
  const { suppliers, getUniqueProductsBySupplier, loading } = useProducts();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierOption | null>(null);

  const filteredSuppliers = suppliers.filter((supplier) =>
    supplier.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProducts = selectedSupplier === null
    ? []
    : getUniqueProductsBySupplier(selectedSupplier.codFor).filter((product) =>
      String(product.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(product.code || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

  const handleSelectProduct = (product: UniqueProductOption) => {
    if (!selectedSupplier) {
      return;
    }

    router.push({
      pathname: '/(main)/create-order/product-detail',
      params: {
        cod_for: String(selectedSupplier.codFor),
        code: product.code,
        name: product.name,
        image_url: product.image_url || '',
      },
    });
  };

  const renderSupplierItem = ({ item }: { item: SupplierOption }) => (
    <TouchableOpacity
      style={styles.productCard}
      onPress={() => {
        setSelectedSupplier(item);
        setSearchQuery('');
      }}
    >
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{item.label}</Text>
        <Text style={styles.productCode}>Fornecedor</Text>
      </View>
    </TouchableOpacity>
  );

  const renderProductItem = ({ item }: { item: UniqueProductOption }) => (
    <TouchableOpacity
      style={styles.productCard}
      onPress={() => handleSelectProduct(item)}
    >
      {item.image_url ? (
          <CachedImage
            uri={item.image_url}
            style={styles.productImage}
            width={180}
            quality={40}
          />
      ) : (
        <View style={styles.productImagePlaceholder}>
          <View style={{ width: 24, height: 24, backgroundColor: '#003B71' }} />
        </View>
      )}
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.productCode}>Código: {item.code}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Image source={require('../../../assets/images/voltar.png')} style={styles.backIcon} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>{selectedSupplier ? 'Produtos' : 'Fornecedores'}</Text>
        </View>
        {selectedSupplier ? (
          <TouchableOpacity
            onPress={() => {
              setSelectedSupplier(null);
              setSearchQuery('');
            }}
            style={styles.switchLevelButton}
          >
            <Text style={styles.switchLevelText}>Trocar</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 64 }} />
        )}
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Image source={require('../../../assets/images/buscar.png')} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={selectedSupplier ? 'Buscar produtos...' : 'Buscar fornecedor...'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {selectedSupplier && (
        <View style={styles.selectedSupplierContainer}>
          <Text style={styles.selectedSupplierText}>{selectedSupplier.label}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Carregando produtos...</Text>
        </View>
      ) : (selectedSupplier ? filteredProducts.length : filteredSuppliers.length) === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {searchQuery
              ? 'Nenhum resultado para esta busca.'
              : selectedSupplier ? 'Nenhum produto cadastrado para este fornecedor.' : 'Nenhum fornecedor cadastrado.'}
          </Text>
        </View>
      ) : (
      <FlatList
          data={selectedSupplier ? filteredProducts : filteredSuppliers}
          renderItem={selectedSupplier ? renderProductItem : renderSupplierItem}
          keyExtractor={(item) => selectedSupplier ? `${selectedSupplier.codFor}-${(item as UniqueProductOption).code}` : `${(item as SupplierOption).codFor}-${(item as SupplierOption).fornecedor}`}
          contentContainerStyle={styles.productList}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          updateCellsBatchingPeriod={60}
          windowSize={8}
          removeClippedSubviews
      />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 24,
    color: '#003B71',
    fontFamily: 'Montserrat-Bold',
    textAlign: 'center',
    flex: 1,
  },
  backButton: {
    padding: 8,
  },
  backIcon: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  switchLevelButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#E8F0FE',
    borderRadius: 8,
  },
  switchLevelText: {
    color: '#003B71',
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    marginLeft: 8,
    fontSize: 16,
    color: '#333333',
    fontFamily: 'Montserrat-Regular',
  },
  selectedSupplierContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  selectedSupplierText: {
    fontSize: 13,
    color: '#003B71',
    fontFamily: 'Montserrat-SemiBold',
  },
  productList: {
    padding: 16,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  productImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 16,
    color: '#003B71',
    fontFamily: 'Montserrat-Bold',
    marginBottom: 4,
  },
  productCode: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'Montserrat-Regular',
    marginBottom: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
    fontFamily: 'Montserrat-Regular',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    fontFamily: 'Montserrat-Regular',
    textAlign: 'center',
  },
});