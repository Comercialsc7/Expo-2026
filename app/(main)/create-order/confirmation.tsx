import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { CircleCheck } from 'lucide-react-native';
import { useSpinResultsStore } from '../../../store/useSpinResultsStore';

export default function OrderConfirmation() {
  const params = useLocalSearchParams();
  const { results } = useSpinResultsStore();
  
  const subtotal = Number(params.subtotal) || 0;
  const itens = Number(params.itens) || 0;
  const desconto = Number(params.desconto) || 0;
  const total = Number(params.total) || 0;
  const prazo = params.prazo as string;
  const email = params.email as string;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.successSection}>
          <CircleCheck size={64} color="#4CAF50" />
          <Text style={styles.successTitle}>Pedido Enviado!</Text>
          <Text style={styles.successMessage}>
            Seu pedido foi enviado para análise. Em breve você receberá um e-mail em{' '}
            <Text style={styles.emailHighlight}>{email}</Text> com os detalhes desta negociação.
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Resumo do Pedido</Text>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>R$ {subtotal.toFixed(2)}</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Itens</Text>
            <Text style={styles.summaryValue}>{itens}</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Desconto</Text>
            <Text style={[styles.summaryValue, styles.discountValue]}>
              R$ {desconto.toFixed(2)}
            </Text>
          </View>

          <View style={styles.divider} />
          
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>R$ {total.toFixed(2)}</Text>
          </View>

          <View style={styles.paymentTermRow}>
            <Text style={styles.paymentTermLabel}>Prazo de pagamento</Text>
            <Text style={styles.paymentTermValue}>{prazo}</Text>
          </View>
        </View>

        {results.length > 0 && (
          <View style={styles.prizesCard}>
            <Text style={styles.prizesTitle}>Prêmios Conquistados</Text>
            {results.map((result, index) => (
              <Text key={index} style={styles.prizeItem}>
                • {result.prize}
              </Text>
            ))}
          </View>
        )}

        <TouchableOpacity 
          style={styles.button}
          onPress={() => router.replace('/(app)/orders')}
        >
          <Text style={styles.buttonText}>Voltar ao Início</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  successSection: {
    alignItems: 'center',
    padding: 24,
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    color: '#4CAF50',
    fontFamily: 'Montserrat-Bold',
    marginTop: 16,
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: 'Montserrat-Regular',
  },
  emailHighlight: {
    color: '#003B71',
    fontFamily: 'Montserrat-Bold',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
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
  summaryTitle: {
    fontSize: 18,
    color: '#003B71',
    fontFamily: 'Montserrat-Bold',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#666666',
    fontFamily: 'Montserrat-Regular',
  },
  summaryValue: {
    fontSize: 16,
    color: '#333333',
    fontFamily: 'Montserrat-Medium',
  },
  discountValue: {
    color: '#FF3B30',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 18,
    color: '#003B71',
    fontFamily: 'Montserrat-Bold',
  },
  totalValue: {
    fontSize: 18,
    color: '#003B71',
    fontFamily: 'Montserrat-Bold',
  },
  paymentTermRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  paymentTermLabel: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'Montserrat-Regular',
  },
  paymentTermValue: {
    fontSize: 14,
    color: '#003B71',
    fontFamily: 'Montserrat-Bold',
  },
  prizesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
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
  prizesTitle: {
    fontSize: 18,
    color: '#003B71',
    fontFamily: 'Montserrat-Bold',
    marginBottom: 12,
  },
  prizeItem: {
    fontSize: 16,
    color: '#333333',
    fontFamily: 'Montserrat-Regular',
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#003B71',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
  },
});