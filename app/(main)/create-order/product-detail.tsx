import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput } from 'react-native';
import RNPickerSelect from 'react-native-picker-select';
import { router, useLocalSearchParams } from 'expo-router';
import { useOrderStore } from '../../../store/useOrderStore';
import { useProducts } from '../../../hooks/useProducts';

interface TierPrice {
  emb: string;
  qtde: number;
  price: number;
}

const mockTierPrices: TierPrice[] = [
  { emb: 'CX', qtde: 10, price: 21.34 },
  { emb: 'CX', qtde: 15, price: 20.45 },
  { emb: 'CX', qtde: 35, price: 19.99 },
];

export default function ProductDetail() {
  const params = useLocalSearchParams();
  const { addItem } = useOrderStore();
  const { getProductVariants, suppliers, loading } = useProducts();

  const codFor = Number(params.cod_for);
  const code = String(params.code || '');

  const variants = useMemo(() => {
    if (Number.isNaN(codFor) || !code) {
      return [];
    }
    return getProductVariants(codFor, code);
  }, [codFor, code, getProductVariants]);

  const supplierLabel = useMemo(() => {
    const supplier = suppliers.find((item) => item.codFor === codFor);
    return supplier ? supplier.label : '';
  }, [suppliers, codFor]);

  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  const [price, setPrice] = useState<string>('0,00');

  useEffect(() => {
    if (variants.length > 0 && !selectedVariantId) {
      setSelectedVariantId(variants[0].id);
      setPrice(Number(variants[0].price || 0).toFixed(2).replace('.', ','));
    }
  }, [variants, selectedVariantId]);

  const selectedVariant = useMemo(() => {
    return variants.find((variant) => variant.id === selectedVariantId) || variants[0];
  }, [variants, selectedVariantId]);

  const selectedProductName = selectedVariant?.name || String(params.name || 'Produto');

  const handleVariantChange = (variantId: string) => {
    setSelectedVariantId(variantId);
    const variant = variants.find((item) => item.id === variantId);
    if (variant) {
      setPrice(Number(variant.price || 0).toFixed(2).replace('.', ','));
    }
  };

  const handleAddToOrder = () => {
    if (!selectedVariant) {
      return;
    }

    const finalQuantity = Math.max(1, parseInt(quantity, 10) || 1);
    const finalPrice = parseFloat(price.replace(',', '.')) || Number(selectedVariant.price || 0);

    addItem({
      id: selectedVariant.id,
      code: selectedVariant.code,
      name: selectedVariant.name,
      box: `${selectedVariant.emb} - QTDE EMB: ${selectedVariant.qtde}`,
      price: finalPrice,
      discount: 0,
      image: selectedVariant.image_url || '',
      quantity: finalQuantity,
      isAccelerator: String(selectedVariant.is_acelerator) === 'true' || String(selectedVariant.is_acelerator) === '1',
    });

    router.push('/(main)/create-order');
  };

  if (loading) {
    return (
      <View style={styles.containerCenter}>
        <Text style={styles.infoText}>Carregando produto...</Text>
      </View>
    );
  }

  if (!selectedVariant) {
    return (
      <View style={styles.containerCenter}>
        <Text style={styles.infoText}>Produto sem embalagens cadastradas.</Text>
        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalhes do Produto</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.productInfoBar}>
        <Text style={styles.productCode}>[{selectedVariant.code}] - {selectedProductName}</Text>
        <Text style={styles.productSupplier}>{supplierLabel}</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Embalagem</Text>
          <View style={styles.selectContainer}>
            <RNPickerSelect
              value={selectedVariant.id}
              onValueChange={handleVariantChange}
              items={variants.map((variant) => ({
                label: `${variant.emb} - QTDE ${variant.qtde} - R$ ${Number(variant.price || 0).toFixed(2).replace('.', ',')}`,
                value: variant.id,
              }))}
              style={{
                inputIOS: styles.selectInput,
                inputAndroid: styles.selectInput,
                inputWeb: styles.selectInput,
                placeholder: styles.selectPlaceholder,
              }}
              useNativeAndroidPickerStyle={false}
              placeholder={{ label: 'Selecione embalagem', value: null }}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Escalonadas</Text>
          {mockTierPrices.map((tier, index) => (
            <View key={`${tier.emb}-${tier.qtde}-${index}`} style={styles.tierItem}>
              <Text style={styles.tierText}>{tier.emb} qtde {tier.qtde}</Text>
              <Text style={styles.tierPrice}>R$ {tier.price.toFixed(2).replace('.', ',')}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.controlLabel}>Quantidade</Text>
          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="number-pad"
            placeholder="Digite a quantidade"
          />

          <Text style={[styles.controlLabel, { marginTop: 12 }]}>Preço</Text>
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholder="0,00"
          />
        </View>
      </ScrollView>

      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addButton} onPress={handleAddToOrder}>
          <Text style={styles.addButtonText}>Salvar</Text>
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
  containerCenter: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  infoText: {
    fontSize: 16,
    color: '#003B71',
    fontFamily: 'Montserrat-Medium',
    textAlign: 'center',
    marginBottom: 16,
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    paddingTop: 44,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    color: '#003B71',
    fontFamily: 'Montserrat-Bold',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 22,
    color: '#666666',
  },
  productInfoBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  productCode: {
    fontSize: 13,
    color: '#003B71',
    fontFamily: 'Montserrat-Bold',
    marginBottom: 4,
  },
  productSupplier: {
    fontSize: 12,
    color: '#666666',
    fontFamily: 'Montserrat-Medium',
  },
  content: {
    flex: 1,
    padding: 12,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    color: '#003B71',
    fontFamily: 'Montserrat-Bold',
    marginBottom: 10,
  },
  selectContainer: {
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  selectInput: {
    fontSize: 15,
    color: '#333333',
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontFamily: 'Montserrat-Medium',
    minHeight: 44,
  },
  selectPlaceholder: {
    color: '#999999',
    fontFamily: 'Montserrat-Regular',
  },
  tierItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tierText: {
    fontSize: 14,
    color: '#333333',
    fontFamily: 'Montserrat-Medium',
  },
  tierPrice: {
    fontSize: 14,
    color: '#003B71',
    fontFamily: 'Montserrat-SemiBold',
  },
  controlLabel: {
    fontSize: 13,
    color: '#003B71',
    fontFamily: 'Montserrat-SemiBold',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    color: '#333333',
    fontSize: 16,
    fontFamily: 'Montserrat-Medium',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actionBar: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
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
    color: '#333333',
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
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
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
  },
});
