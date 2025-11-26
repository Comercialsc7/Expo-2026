import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useOrderStore } from '../../../store/useOrderStore';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  image?: string;
  isAccelerator: boolean;
  box: number;
  discount: number;
}

export default function OrderSummary() {
  console.log('OrderSummary component carregado e atualizado!');
  const { items, client, paymentTerm, removeItem, updateItemQuantity, clearOrder } = useOrderStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Optionally clear order when component mounts for a new order flow
    // or load existing order if continuing from a previous session
    // For now, we assume a new order is being created or continued from product selection.
  }, []);

  const handleGoBack = () => {
    router.back();
  };

  const handleAddItem = () => {
    router.push('/create-order/product-search');
  };

  const handleRemoveItem = (index: number) => {
    removeItem(index);
  };

  const handleQuantityChange = (index: number, change: number) => {
    const currentQuantity = items[index].quantity;
    const newQuantity = Math.max(1, currentQuantity + change);
    updateItemQuantity(index, newQuantity);
  };

  const handleQuantityInputChange = (index: number, text: string) => {
    const parsedQuantity = parseInt(text, 10);
    if (!isNaN(parsedQuantity) && parsedQuantity >= 0) {
      updateItemQuantity(index, parsedQuantity);
    } else if (text === '') {
      updateItemQuantity(index, 0); // Allow clearing input
    }
  };

  const calculateSubtotal = () => {
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const calculateAcceleratorItems = () => {
    return items.filter(item => item.isAccelerator).length;
  };

  const calculateDiscount = () => {
    // This is a simplified discount calculation.
    // In a real scenario, you might have complex discount rules.
    return items.reduce((total, item) => total + (item.discount * item.quantity), 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() - calculateDiscount();
  };

  const handleFinalizeOrder = () => {
    if (items.length === 0) {
      alert('Adicione pelo menos um item ao pedido');
      return;
    }

    const subtotal = calculateSubtotal();
    const itens = items.length;
    const desconto = calculateDiscount();
    const total = calculateTotal();
    const prazo = paymentTerm?.prazo_dias || 0;

    console.log('Preparando para navegar para order-summary-v2 com parâmetros:', {
      subtotal: subtotal.toFixed(2),
      itens: itens.toString(),
      desconto: desconto.toFixed(2),
      total: total.toFixed(2),
      prazo: prazo.toString(),
    });

    router.push('/create-order/order-summary', {
      subtotal: subtotal.toFixed(2),
      itens: itens.toString(),
      desconto: desconto.toFixed(2),
      total: total.toFixed(2),
      prazo: prazo.toString(),
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.headerActionButton}>
          <Image source={require('../../../assets/images/voltar.png')} style={styles.iconButton} />
        </TouchableOpacity>
        <Text style={styles.title}>Pedido</Text>
        <TouchableOpacity onPress={handleAddItem} style={styles.headerActionButton}>
          <Image source={require('../../../assets/images/adicionar.png')} style={styles.iconButton} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              Nenhum item adicionado ao pedido
            </Text>
          </View>
        ) : (
          <View style={styles.itemsList}>
            {items.map((item, index) => (
              <View key={item.id + index} style={styles.itemCard}>
                <Image source={{ uri: item.image || 'https://via.placeholder.com/60' }} style={styles.itemImage} />
                <View style={styles.itemInfo}>
                  <View style={styles.itemNameContainer}>
                    <Text style={styles.itemName} numberOfLines={2} ellipsizeMode="tail">{item.name}</Text>
                    {item.isAccelerator ? (
                      <Image source={require('../../../assets/images/diamond.png')} style={styles.acceleratorIconImage} />
                    ) : (
                      <Text style={{width: 30}}></Text>
                    )}
                  </View>
                  <Text style={styles.itemDescription}>{item.box ? item.box : ''}</Text>
                  <View style={styles.priceContainer}>
                    <Text style={styles.itemPrice}>R$ {item.price.toFixed(2)}</Text>
                    {item.discount > 0 && (
                      <Text style={styles.itemDiscount}>-{((item.discount / item.price) * 100).toFixed(0)}%</Text>
                    )}
                  </View>
                </View>
                <View style={styles.itemActions}>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => handleQuantityChange(index, -1)}
                  >
                    <Text>-</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.quantityInput}
                    keyboardType="numeric"
                    value={String(item.quantity)}
                    onChangeText={(text) => handleQuantityInputChange(index, text)}
                  />
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => handleQuantityChange(index, 1)}
                  >
                    <Text>+</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleRemoveItem(index)}
                >
                  <Image source={require('../../../assets/images/lixeira.png')} style={styles.deleteIcon} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {items.length > 0 && (
        <View style={styles.summaryContainer}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>R$ {calculateSubtotal().toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Itens Aceleradores</Text>
            <Text style={styles.summaryValueWithIcon}>
              <Image source={require('../../../assets/images/diamond.png')} style={styles.summaryIconImage} /> {calculateAcceleratorItems()}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Desconto</Text>
            <Text style={styles.summaryValue}>R$ {calculateDiscount().toFixed(2)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryTotalLabel}>Total</Text>
            <Text style={styles.summaryTotalValue}>R$ {calculateTotal().toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Prazo de pagamento</Text>
            <Text style={styles.summaryValue}>{paymentTerm?.description || 'Não selecionado'}</Text>
          </View>
          
          {/* Adicionando a caixa "Faltam" */}
          {/* <View style={styles.missingBox}>
            <Text style={styles.missingAmount}>Faltam</Text>
            <Text style={styles.missingValue}>R$ 1.736,30</Text>
            <Text style={styles.missingDescription}>para você concorrer a uma moto 0km</Text>
          </View> */}

          <TouchableOpacity
            style={styles.finalizeButton}
            onPress={handleFinalizeOrder}
          >
            <Text style={styles.finalizeButtonText}>Visualizar Pedido</Text>
          </TouchableOpacity>
        </View>
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
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerActionButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    color: '#003B71',
    fontFamily: 'Montserrat-Bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#666666',
    textAlign: 'center',
  },
  itemsList: {
    gap: 12,
    marginBottom: 16,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  itemNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 12,
    color: '#003B71',
    fontFamily: 'Montserrat-Bold',
    marginRight: 4,
  },
  acceleratorIconImage: {
    width: 30,
    height: 30,
    marginLeft: 4,
  },
  itemDescription: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'Montserrat-Regular',
    marginTop: 2,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  itemPrice: {
    fontSize: 16,
    color: '#003B71',
    fontFamily: 'Montserrat-Bold',
  },
  itemDiscount: {
    fontSize: 14,
    color: '#FF3B30',
    fontFamily: 'Montserrat-Regular',
    marginLeft: 8,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  quantityInput: {
    fontSize: 16,
    color: '#003B71',
    fontFamily: 'Montserrat-Bold',
    marginHorizontal: 8,
    width: 40,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    paddingVertical: 4,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  deleteIcon: {
    width: 18,
    height: 18,
  },
  summaryContainer: {
    backgroundColor: '#003B71',
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'Montserrat-Regular',
  },
  summaryValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'Montserrat-Bold',
  },
  summaryValueWithIcon: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'Montserrat-Bold',
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryIconImage: {
    width: 30,
    height: 30,
    marginRight: 4,
  },
  divider: {
    borderBottomColor: '#FFFFFF',
    borderBottomWidth: 1,
    opacity: 0.3,
    marginVertical: 8,
  },
  summaryTotalLabel: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: 'Montserrat-Bold',
  },
  summaryTotalValue: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: 'Montserrat-Bold',
  },
  finalizeButton: {
    backgroundColor: '#0088CC',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  finalizeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
  },
  iconButton: {
    width: 40,
    height: 40,
  },
  /* missingBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  missingAmount: {
    fontSize: 20,
    color: '#FF0000',
    fontFamily: 'Montserrat-Bold',
  },
  missingValue: {
    fontSize: 24,
    color: '#FF0000',
    fontFamily: 'Montserrat-Bold',
    marginTop: 4,
  },
  missingDescription: {
    fontSize: 16,
    color: '#666666',
    fontFamily: 'Montserrat-Regular',
    textAlign: 'center',
    marginTop: 4,
  }, */
});