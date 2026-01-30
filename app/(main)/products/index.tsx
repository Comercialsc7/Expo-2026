import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Image } from 'react-native';
import { router } from 'expo-router';
import { useProducts } from '../../../hooks/useProducts';

interface Product {
  id: string;
  name: string;
  code: string;
  image_url: string | null;
  price: number;
  box_size: number;
  is_accelerator: boolean;
}

export default function ProductsScreen() {
  const { products, loading, error } = useProducts();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  console.log('Total de produtos carregados:', products.length);
  console.log('Total de produtos exibidos (após filtro):', filteredProducts.length);

  const renderProductItem = ({ item }: { item: Product }) => (
    <TouchableOpacity 
      style={styles.productCard}
      onPress={() => console.log('Produto clicado: ', item.id)}
    >
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.productImage} />
      ) : (
        <View style={styles.productImagePlaceholder}>
          <View style={{ width: 24, height: 24, backgroundColor: '#003B71' }} />
        </View>
      )}
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.productCode}>Código: {item.code}</Text>
        <Text style={styles.productPrice}>R$ {item.price.toFixed(2)}</Text>
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
          <Text style={styles.headerTitle}>Produtos</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Image source={require('../../../assets/images/buscar.png')} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar produtos..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Carregando produtos...</Text>
        </View>
      ) : filteredProducts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {searchQuery
              ? 'Nenhum produto encontrado para esta busca.'
              : 'Nenhum produto cadastrado.'}
          </Text>
        </View>
      ) : (
      <FlatList
          data={filteredProducts}
          renderItem={renderProductItem}
          keyExtractor={(item) => item.id}
        contentContainerStyle={styles.productList}
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
  productPrice: {
    fontSize: 16,
    color: '#0088CC',
    fontFamily: 'Montserrat-Bold',
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