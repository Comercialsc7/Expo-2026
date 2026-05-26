import React from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, Image } from 'react-native';
import { CachedOrder } from '../../store/useCachedOrdersStore';
import { styles } from '../styles/_sync-orders.styles';

const closeIcon = require('../../assets/images/x.png');
const lixeiraIcon = require('../../assets/images/lixeira.png');

interface OrderDetailsModalProps {
  order: CachedOrder | null;
  onClose: () => void;
  onDelete: (orderId: string) => void;
  visible: boolean;
}

const getDisplayOrderNumber = (order: CachedOrder) => {
  if (order.shortOrderNumber) {
    return order.shortOrderNumber;
  }

  return String(order.id || '').slice(-8);
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = React.memo(({ 
  order, 
  onClose, 
  onDelete,
  visible
}) => {
  if (!order) return null;

  const prizesToShow = order.spinPrizes && order.spinPrizes.length > 0
    ? order.spinPrizes
    : (order.spinPrize ? [order.spinPrize] : []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Detalhes do Pedido</Text>
            <View style={styles.modalHeaderButtons}>
              <TouchableOpacity 
                style={styles.deleteButton}
                onPress={() => onDelete(order.id)}
              >
                <Image source={lixeiraIcon} style={{ width: 24, height: 24 }} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={onClose}
              >
                <Image source={closeIcon} style={{ width: 24, height: 24 }} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.modalBody}>
            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Informações do Cliente</Text>
              <Text style={styles.detailText}>Pedido: {getDisplayOrderNumber(order)}</Text>
              {order.sellerCode && (
                <Text style={styles.detailText}>Vendedor: {order.sellerCode}</Text>
              )}
              <Text style={styles.detailText}>Código: {order.client.code}</Text>
              <Text style={styles.detailText}>Nome: {order.client.name}</Text>
              <Text style={styles.detailText}>CNPJ: {order.client.cnpj}</Text>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Condição de Pagamento</Text>
              <Text style={styles.detailText}>
                {order.paymentTerm.description} ({order.paymentTerm.prazo_dias} dias)
              </Text>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Produtos</Text>
              {order.items.map((item, index) => (
                <View key={index} style={styles.productItem}>
                  <Text style={styles.productName}>{item.name}</Text>
                  <Text style={styles.productDetails}>
                    {item.quantity}x {formatCurrency(item.price)}
                  </Text>
                  <Text style={styles.productTotal}>
                    {formatCurrency(item.price * item.quantity)}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Valores</Text>
              <View style={styles.valueRow}>
                <Text style={styles.valueLabel}>Subtotal:</Text>
                <Text style={styles.valueAmount}>{formatCurrency(order.subtotal)}</Text>
              </View>
              {order.discount > 0 && (
                <View style={styles.valueRow}>
                  <Text style={styles.valueLabel}>Desconto:</Text>
                  <Text style={styles.valueAmount}>{formatCurrency(order.discount)}</Text>
                </View>
              )}
              <View style={styles.valueRow}>
                <Text style={styles.valueLabel}>Total:</Text>
                <Text style={styles.valueAmount}>{formatCurrency(order.total)}</Text>
              </View>
            </View>

            {prizesToShow.length > 0 && (
              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Prêmios da Roleta</Text>
                {prizesToShow.map((prize, index) => (
                  <View key={`${prize.description}-${index}`} style={{ marginBottom: 12 }}>
                    <Text style={styles.detailText}>Tipo: {prize.type}</Text>
                    <Text style={styles.detailText}>Descrição: {prize.description}</Text>
                    {prize.photo && (
                      <Image
                        source={{ uri: prize.photo }}
                        style={{ width: '100%', height: 200, marginTop: 8, borderRadius: 8 }}
                        resizeMode="contain"
                      />
                    )}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});

export default OrderDetailsModal;