import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useOrderStore } from '../../../store/useOrderStore';
import { Product } from '../../../hooks/useProducts';

interface PackagingOption {
  type: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  minPrice: number;
  maxPrice: number;
}

export default function ProductDetail() {
  const params = useLocalSearchParams();
  const { addItem } = useOrderStore();

  const product: Product & { packaging?: PackagingOption[] } = {
    id: params.id as string,
    name: params.name as string,
    code: params.code as string,
    price: parseFloat(params.price as string || '0'),
    box_size: parseInt(params.box_size as string || '0'),
    is_accelerator: params.is_accelerator === 'true',
    image_url: params.image_url as string || '',
    created_at: new Date().toISOString(),
    packaging: [
      {
        type: 'CJ',
        quantity: 6,
        unitPrice: 6.65,
        totalPrice: 39.87,
        minPrice: 37.88,
        maxPrice: 43.86,
      },
      {
        type: 'CT',
        quantity: 1,
        unitPrice: 6.65,
        totalPrice: 6.65,
        minPrice: 6.32,
        maxPrice: 7.32,
      },
      {
        type: 'CX',
        quantity: 72,
        unitPrice: 6.65,
        totalPrice: 478.81,
        minPrice: 454.87,
        maxPrice: 526.69,
      },
    ],
  };

  const [selectedPackaging, setSelectedPackaging] = useState<string>('CT');
  const [quantity, setQuantity] = useState<string>('1');
  const [price, setPrice] = useState<string>(product.price.toFixed(2));

  const handleQuantityChange = (text: string) => {
    setQuantity(text);
  };

  const handlePriceChange = (text: string) => {
    setPrice(text);
  };

  const handleAddToOrder = () => {
    const selectedPkg = product.packaging?.find(p => p.type === selectedPackaging);
    const finalQuantity = parseInt(quantity) || 1;
    const finalPrice = parseFloat(price.replace(',', '.')) || product.price;

    addItem({
      id: product.id,
      code: product.code,
      name: product.name,
      box: `${selectedPackaging} - QT: ${selectedPkg?.quantity || 1}`,
      price: finalPrice,
      discount: 0,
      image: product.image_url,
      quantity: finalQuantity,
      isAccelerator: product.is_accelerator,
    });

    router.back();
  };

  return (
    <View style={styles.container}>
      {/* Product Info Bar */}
      <View style={styles.productInfoBar}>
        <View style={styles.productInfoContent}>
          <Text style={styles.productCode}>[{product.code}] - {product.name}</Text>
          <View style={styles.productDetailsRow}>
            <Text style={styles.productDetailsText}>Quant. Stock: 10.304</Text>
            <Text style={styles.productDetailsText}>Un.: {product.box_size}</Text>
            <Text style={styles.productDetailsText}>Preço R$ {product.price.toFixed(2)}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {/* Packaging Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TIPOS DE EMBALAGEM</Text>
          {product.packaging?.map((pkg) => (
            <Pressable
              key={pkg.type}
              style={styles.packagingOption}
              onPress={() => setSelectedPackaging(pkg.type)}
            >
              <View style={[
                styles.radio,
                selectedPackaging === pkg.type && styles.radioSelected,
              ]}>
                {selectedPackaging === pkg.type && (
                  <View style={styles.radioDot} />
                )}
              </View>
              <View style={styles.packagingInfo}>
                <Text style={styles.packagingLabel}>
                  {pkg.type} <Text style={styles.packagingDetails}>
                    QT: {pkg.quantity} PRC: {pkg.totalPrice.toFixed(2)} PUN: {pkg.unitPrice.toFixed(2)} ({pkg.minPrice.toFixed(2)} a {pkg.maxPrice.toFixed(2)})
                  </Text>
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Quantity and Price Controls */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{product.name}</Text>

          {/* Quantity Control */}
          <View style={styles.controlGroup}>
            <Text style={styles.controlLabel}>Quantidade</Text>
            <View style={styles.quantityInput}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => {
                  const current = parseInt(quantity) || 0;
                  setQuantity(Math.max(0, current - 1).toString());
                }}
              >
                <Text style={styles.quantityButtonText}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.quantityField}
                value={quantity}
                onChangeText={handleQuantityChange}
                keyboardType="number-pad"
                placeholder="0"
              />
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => {
                  const current = parseInt(quantity) || 0;
                  setQuantity((current + 1).toString());
                }}
              >
                <Text style={styles.quantityButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Price Control */}
          <View style={styles.controlGroup}>
            <Text style={styles.controlLabel}>Preço (R$)</Text>
            <TextInput
              style={styles.priceInput}
              value={price}
              onChangeText={handlePriceChange}
              keyboardType="decimal-pad"
              placeholder="0,00"
            />
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addButton} onPress={handleAddToOrder}>
          <Text style={styles.addButtonText}>Adicionar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  productInfoBar: {
    backgroundColor: '#E8E8E8',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#D0D0D0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  productInfoContent: {
    flex: 1,
  },
  productCode: {
    fontSize: 12,
    fontWeight: '700',
    color: '#003B71',
    marginBottom: 4,
  },
  productDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  productDetailsText: {
    fontSize: 10,
    color: '#666666',
    fontWeight: '600',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666666',
  },
  content: {
    flex: 1,
    padding: 12,
  },
  section: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#003B71',
    marginBottom: 12,
  },
  packagingOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#0088CC',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: '#0088CC',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0088CC',
  },
  packagingInfo: {
    flex: 1,
  },
  packagingLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333333',
  },
  packagingDetails: {
    fontWeight: '400',
    fontSize: 12,
    color: '#666666',
  },
  controlGroup: {
    marginBottom: 16,
  },
  controlLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#003B71',
    marginBottom: 8,
  },
  quantityInput: {
    flexDirection: 'row',
    borderWidth: 2,
    borderColor: '#333333',
    borderRadius: 8,
    overflow: 'hidden',
    height: 44,
  },
  quantityButton: {
    width: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#333333',
  },
  quantityButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  quantityField: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    color: '#333333',
  },
  priceInput: {
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    backgroundColor: '#FFFFFF',
  },
  actionBar: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#D0D0D0',
  },
  cancelButton: {
    flex: 1,
    height: 44,
    backgroundColor: '#CCCCCC',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333333',
  },
  addButton: {
    flex: 1,
    height: 44,
    backgroundColor: '#0088CC',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
