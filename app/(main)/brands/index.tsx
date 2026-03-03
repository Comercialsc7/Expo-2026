import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Image, TextInput } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../../lib/supabase';

interface Brand {
  id: string;
  name: string;
  code: string;
  image_url: string | null;
}

export default function BrandsScreen() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    try {
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .order('name');

      if (error) throw error;
      setBrands(data || []);
    } catch (error) {
      console.error('Erro ao buscar marcas:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredBrands = brands.filter(brand =>
    brand.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    brand.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderBrandItem = ({ item }: { item: Brand }) => (
    <TouchableOpacity
      style={styles.brandItem}
      onPress={() => router.push(`/brands/${item.id}`)}
    >
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.brandImage} />
      ) : (
        <View style={styles.brandImagePlaceholder}>
          <Text style={styles.brandInitial}>{item.code}</Text>
        </View>
      )}
      <View style={styles.brandInfo}>
        <Text style={styles.brandName}>{item.name}</Text>
        <Text style={styles.brandCode}>{item.code}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Marcas</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/brands/new')}
        >
          <View style={{ width: 24, height: 24, backgroundColor: '#FFFFFF' }} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <View style={{ width: 24, height: 24, backgroundColor: '#003B71' }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar marcas..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <FlatList
        data={filteredBrands}
        renderItem={renderBrandItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 24,
    color: '#003B71',
    fontFamily: 'Montserrat-Bold',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#0088CC',
    justifyContent: 'center',
    alignItems: 'center',
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
  list: {
    padding: 16,
  },
  brandItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  brandImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F5F5F5',
  },
  brandImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandInitial: {
    fontSize: 24,
    color: '#003B71',
    fontFamily: 'Montserrat-Bold',
  },
  brandInfo: {
    marginLeft: 16,
    flex: 1,
  },
  brandName: {
    fontSize: 18,
    color: '#003B71',
    fontFamily: 'Montserrat-Bold',
  },
  brandCode: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'Montserrat-Regular',
    marginTop: 4,
  },
});