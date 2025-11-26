import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

export default function CollectEmailScreen() {
  const [email, setEmail] = useState('');
  const params = useLocalSearchParams();

  const handleSubmit = () => {
    if (!email) {
      alert('Por favor, insira um e-mail válido');
      return;
    }

    // Validação básica de e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert('Por favor, insira um e-mail válido');
      return;
    }

    router.push({
      pathname: '/(tabs)/create-order/order-summary',
      params: { 
        ...params,
        email: email
      }
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Finalizar Pedido</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.instruction}>Digite seu e-mail para receber o resumo do pedido</Text>
        <TextInput
          style={styles.input}
          placeholder="Seu e-mail"
          placeholderTextColor="#999"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity 
          style={styles.submitButton}
          onPress={handleSubmit}
        >
          <Text style={styles.submitButtonText}>Enviar E-mail</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1560A8',
    borderRadius: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'web' ? 16 : 48,
  },
  headerTitle: {
    fontSize: 22,
    color: '#fff',
    fontFamily: 'Montserrat-Bold',
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
  },
  instruction: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: 'Montserrat-Regular',
    marginBottom: 24,
  },
  submitButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#FFB300',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
  },
});