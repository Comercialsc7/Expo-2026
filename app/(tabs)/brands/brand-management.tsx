import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, Image, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../../lib/supabase';
import { optimizeImage } from '../../../lib/imageUtils';

export default function BrandManagement() {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImagePick = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('Precisamos da permissão para acessar a galeria.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const photoUri = result.assets[0].uri;
        if (photoUri) {
          const optimizedUri = await optimizeImage(photoUri, {
            maxWidth: 800,
            maxHeight: 800,
            quality: 0.8
          });
          setImage(optimizedUri);
        }
      }
    } catch (error) {
      console.error('Erro ao selecionar imagem:', error);
      alert('Erro ao selecionar imagem. Tente novamente.');
    }
  };

  const handleSubmit = async () => {
    if (!name || !code) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let imageUrl = null;
      if (image) {
        const fileName = `${Date.now()}.jpg`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('brands')
          .upload(fileName, {
            uri: image,
            type: 'image/jpeg',
            name: fileName,
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('brands')
          .getPublicUrl(fileName);

        imageUrl = publicUrl;
      }

      const { error: insertError } = await supabase
        .from('brands')
        .insert([
          {
            name,
            code,
            image_url: imageUrl,
          },
        ]);

      if (insertError) throw insertError;

      router.back();
    } catch (err) {
      console.error('Erro ao salvar marca:', err);
      setError(err instanceof Error ? err.message : 'Erro ao salvar marca');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <View style={{ width: 24, height: 24, backgroundColor: '#003B71' }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nova Marca</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nome da Marca</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Digite o nome da marca"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Código</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              placeholder="Digite o código da marca"
            />
          </View>

          <View style={styles.imageSection}>
            <Text style={styles.label}>Logo da Marca</Text>
            <TouchableOpacity
              style={styles.imageUploadButton}
              onPress={handleImagePick}
            >
              {image ? (
                <Image source={{ uri: image }} style={styles.uploadedImage} />
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <View style={{ width: 24, height: 24, backgroundColor: '#003B71' }} />
                  <Text style={styles.uploadText}>Adicionar Logo</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Salvar Marca</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    paddingTop: Platform.OS === 'web' ? 16 : 48,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    flexDirection: 'row',
    alignItems: 'center',
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
    padding: 16,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    color: '#003B71',
    fontFamily: 'Montserrat-Medium',
  },
  input: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  imageSection: {
    width: '100%',
    height: 240,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 24,
    overflow: 'hidden',
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      }
    }),
  },
  imageUploadButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  uploadPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  uploadText: {
    marginTop: 12,
    color: '#003B71',
    fontSize: 16,
    fontFamily: 'Montserrat-Medium',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F8F9FA',
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    fontFamily: 'Montserrat-Medium',
  },
  submitButton: {
    backgroundColor: '#0088CC',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#E5E5E5',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
  },
});