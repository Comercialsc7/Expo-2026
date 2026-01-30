import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { router } from 'expo-router';
import { useOrderStore, ClientPaymentTerm, PaymentTerm } from '../../../store/useOrderStore';

export default function PaymentMethodScreen() {
  const { client, setPaymentTerm: setOrderPaymentTerm } = useOrderStore();
  const [selectedTerm, setSelectedTerm] = useState<PaymentTerm | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (client?.payment_terms && client.payment_terms.length > 0) {
      const paymentTerms = client.payment_terms as unknown as PaymentTerm[];
      setSelectedTerm(paymentTerms[0]);
      setOrderPaymentTerm(paymentTerms[0]);
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [client?.payment_terms]);

  const handleSelectTerm = (term: PaymentTerm) => {
    setSelectedTerm(term);
    setOrderPaymentTerm(term);
  };

  const handleContinue = () => {
    if (!selectedTerm) {
      alert('Selecione uma condição de pagamento');
      return;
    }
    router.push('/create-order');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Image source={require('../../../assets/images/voltar.png')} style={{ width: 40, height: 40 }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Condição de Pagamento</Text>
      </View>

      <ScrollView style={styles.content}>
        {client && (
          <View style={styles.clientInfo}>
            <Text style={styles.clientName}>Cliente: {client.name}</Text>
            {selectedTerm && (
              <Text style={styles.clientDefaultTerm}>
                Prazo Padrão: {selectedTerm.description}
              </Text>
            )}
          </View>
        )}

        <View style={styles.paymentTerms}>
          <Text style={styles.sectionTitle}>Selecione a condição de pagamento</Text>
          {loading ? (
            <Text style={styles.loadingText}>Carregando prazos...</Text>
          ) : !client?.payment_terms || client.payment_terms.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma condição de pagamento disponível para este cliente.</Text>
          ) : (
            (client.payment_terms as unknown as PaymentTerm[]).map(term => (
              <TouchableOpacity
                key={term.id}
                style={[
                  styles.termCard,
                  selectedTerm?.id === term.id && styles.selectedTermCard
                ]}
                onPress={() => handleSelectTerm(term)}
              >
                <View style={styles.termInfo}>
                  <Text style={styles.termDescription}>{term.description}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueButton, !selectedTerm && styles.continueButtonDisabled]}
          onPress={handleContinue}
          disabled={!selectedTerm}
        >
          <Text style={styles.continueButtonText}>Continuar</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 24,
    color: '#003B71',
    fontFamily: 'Montserrat-Bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  clientInfo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  clientName: {
    fontSize: 18,
    color: '#003B71',
    fontFamily: 'Montserrat-Bold',
    marginBottom: 4,
  },
  clientDefaultTerm: {
    fontSize: 16,
    color: '#666666',
    fontFamily: 'Montserrat-Regular',
  },
  paymentTerms: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    color: '#003B71',
    fontFamily: 'Montserrat-Bold',
    marginBottom: 8,
  },
  termCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedTermCard: {
    backgroundColor: '#E6F3FF',
    borderWidth: 1,
    borderColor: '#0088CC',
  },
  termInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  termDescription: {
    fontSize: 16,
    color: '#003B71',
    fontFamily: 'Montserrat-Bold',
  },
  footer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  continueButton: {
    backgroundColor: '#0088CC',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    color: '#666666',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    color: '#666666',
  },
  defaultBadge: {
    backgroundColor: '#E6F3FF',
    color: '#0088CC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
  },
}); 