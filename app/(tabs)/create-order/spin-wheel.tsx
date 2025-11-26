import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Image, Alert } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useSpinResultsStore } from '../../../store/useSpinResultsStore';
import { optimizeImage } from '../../../lib/imageUtils';
import { supabase } from '../../../lib/supabase';

const premios = [
  'Fritadeira Inox',
  'Headphone JBL 520BT',
  'JBL Go Essential',
  'Multiprocessador Alimentos 4 em 1',
  'Não foi dessa vez'
];

interface Prize {
  id: string;
  name: string;
  image_url: string;
}

export default function SpinWheelScreen() {
  const [selected, setSelected] = useState(-1);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [selectedPrize, setSelectedPrize] = useState<Prize | null>(null);
  const [loading, setLoading] = useState(false);
  const params = useLocalSearchParams();
  const girosDisponiveis = Number(params.girosDisponiveis) || 0;

  const { addResult } = useSpinResultsStore();

  const isLastGiro = girosDisponiveis === 1;
  const isNoPrize = selected !== -1 && premios[selected] === 'Não foi dessa vez';

  useEffect(() => {
    if (selected !== -1) {
      if (isNoPrize) {
        handleNoPrize();
      } else if (capturedImage) {
        handleConfirmGiro();
      }
    }
  }, [selected, capturedImage]);

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão Negada', 'Precisamos da permissão da câmera para tirar fotos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
        base64: true,
        exif: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const photoUri = result.assets[0].uri;
        if (photoUri) {
          const optimizedUri = await optimizeImage(photoUri, {
            maxWidth: 1200,
            maxHeight: 900,
            quality: 0.8
          });
          setCapturedImage(optimizedUri);
        } else {
          Alert.alert('Erro', 'Não foi possível capturar a foto. Tente novamente.');
        }
      }
    } catch (error) {
      console.error('Erro ao capturar foto:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao capturar a foto. Tente novamente.');
    }
  };

  const handleNoPrize = () => {
    // Add the "no prize" result to the store
    addResult({ prize: 'Não foi dessa vez', photoUri: '' });
    
    // Navigate to email collection
    router.push({
      pathname: '/(tabs)/create-order/collect-email',
      params: { 
        subtotal: params.subtotal,
        itens: params.itens,
        desconto: params.desconto,
        total: params.total,
        prazo: params.prazo,
      }
    });
  };

  const handleConfirmGiro = () => {
    const premioSelecionado = premios[selected];
    
    addResult({ prize: premioSelecionado, photoUri: capturedImage! });

    // Navigate to email collection on last spin or continue spinning
    router.push({
      pathname: isLastGiro ? '/(tabs)/create-order/collect-email' : '/(tabs)/create-order/spin-wheel',
      params: { 
        girosDisponiveis: isLastGiro ? girosDisponiveis : girosDisponiveis - 1,
        subtotal: params.subtotal,
        itens: params.itens,
        desconto: params.desconto,
        total: params.total,
        prazo: params.prazo,
      }
    });
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        alert('Precisamos da permissão para acessar a câmera.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setCapturedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Erro ao tirar foto:', error);
      alert('Erro ao tirar foto. Tente novamente.');
    }
  };

  const handleConfirm = async () => {
    if (!selectedPrize || !capturedImage) {
      alert('Por favor, selecione um prêmio e tire uma foto.');
      return;
    }

    try {
      setLoading(true);

      // Aqui você implementaria a lógica para salvar o prêmio e a foto no banco de dados
      // Por exemplo:
      // const fileName = `${Date.now()}.jpg`;
      // const { data: uploadData, error: uploadError } = await supabase.storage
      //   .from('prizes')
      //   .upload(fileName, {
      //     uri: capturedImage,
      //     type: 'image/jpeg',
      //     name: fileName,
      //   });

      // if (uploadError) throw uploadError;

      router.push('/create-order/complete');
    } catch (error) {
      console.error('Erro ao confirmar prêmio:', error);
      alert('Erro ao confirmar prêmio. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Giro da Sorte</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.instruction}>Marque o Prêmio e tire uma{"\n"}foto de comprovação.</Text>
        <View style={styles.optionsList}>
          {premios.map((premio, idx) => (
            <TouchableOpacity
              key={premio}
              style={[styles.optionRow, selected === idx && styles.optionRowSelected]}
              onPress={() => setSelected(idx)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, selected === idx && styles.checkboxChecked]}>
                {selected === idx && <View style={styles.checkboxInner} />}
              </View>
              <Text style={[styles.optionText, selected === idx && styles.optionTextSelected]}>{premio}</Text>
            </TouchableOpacity>
          ))}
        </View>
        
        {/* Only show photo button if a prize is selected and it's not "Não foi dessa vez" */}
        {selected !== -1 && !isNoPrize && (
          <>
            <TouchableOpacity style={styles.photoButton} onPress={takePhoto}>
              <Image
                source={capturedImage ? { uri: capturedImage } : require('../../../assets/images/EnviarFoto.png')}
                style={styles.photoIcon}
              />
            </TouchableOpacity>
            <Text style={styles.photoLabel}>{capturedImage ? 'Foto Capturada' : 'Enviar Foto'}</Text>
          </>
        )}

        {/* Show confirmation button for "Não foi dessa vez" or when photo is captured */}
        {selected !== -1 && (isNoPrize || capturedImage) && (
          <TouchableOpacity
            style={[styles.confirmButton, isLastGiro ? styles.confirmButtonWhite : styles.confirmButtonPurple]}
            onPress={isNoPrize ? handleNoPrize : handleConfirmGiro}
          >
            <Text style={[styles.confirmButtonText, styles.confirmButtonTextPurple]}>
              {isLastGiro ? 'Finalizar Giros' : 'Próximo Giro'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
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
    marginBottom: 18,
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
  optionsList: {
    width: '100%',
    marginBottom: 18,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  optionRowSelected: {
    borderColor: '#FFB300',
    backgroundColor: '#FFB300',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#1560A8',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    borderColor: '#FFB300',
    backgroundColor: '#FFB300',
  },
  checkboxInner: {
    width: 16,
    height: 16,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  optionText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
  },
  optionTextSelected: {
    color: '#fff',
  },
  photoButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFB300',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  photoIcon: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
  },
  photoLabel: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Montserrat-Medium',
    marginBottom: 18,
  },
  confirmButton: {
    borderRadius: 12,
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 50,
  },
  confirmButtonPurple: {
    backgroundColor: '#941b80',
  },
  confirmButtonWhite: {
    backgroundColor: '#fff',
  },
  confirmButtonText: {
    fontWeight: 'bold',
    fontSize: 17,
  },
  confirmButtonTextPurple: {
    color: '#fff',
  },
});