import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { CachedOrder } from '../../store/useCachedOrdersStore';
import { styles } from '../styles/_sync-orders.styles';

interface OrderItemProps {
  item: CachedOrder;
  onPress: (order: CachedOrder) => void;
  enviado?: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

export const OrderItem: React.FC<OrderItemProps> = React.memo(({ item, onPress, enviado }) => (
  <TouchableOpacity 
    style={styles.cachedOrderItem}
    onPress={() => onPress(item)}
  >
    <View style={styles.orderHeader}>
      <Text style={styles.cachedOrderId}>Pedido #{item.id}</Text>
      <Text style={styles.cachedOrderDate}>
        {new Date(item.timestamp).toLocaleDateString('pt-BR')}
      </Text>
      {enviado && (
        <Image source={require('../../assets/images/check.png')} style={{ width: 24, height: 24, marginLeft: 8 }} />
      )}
    </View>
    <Text style={styles.cachedOrderClient}>
      Cliente: {item.client.name} ({item.client.code})
    </Text>
    <View style={styles.orderValues}>
      <Text style={styles.orderValue}>
        Total: {formatCurrency(item.total)}
      </Text>
      {item.discount > 0 && (
        <Text style={styles.orderDiscount}>
          Desconto: {formatCurrency(item.discount)}
        </Text>
      )}
    </View>
  </TouchableOpacity>
));

export default OrderItem; 