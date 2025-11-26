import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, Image, Alert } from 'react-native';
import { router } from 'expo-router';
import RNPickerSelect from 'react-native-picker-select';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TableStore from '../../lib/TableStore';
import OfflineCache from '../../lib/OfflineCache';

const logoDmuller = require('../../assets/images/logoDmuller.png');

interface Team {
  id: string;
  code: number;
  name: string;
}

export default function Login() {
  const [code, setCode] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<number | undefined>(undefined);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isOffline, setIsOffline] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(true);

  const codeInputRef = useRef<TextInput>(null);

  useEffect(() => {
    fetchTeams();
    if (Platform.OS === 'web' && codeInputRef.current) {
      codeInputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (teams.length > 0 && selectedTeam === undefined) {
      console.log('Definindo equipe padrão:', teams[0].code);
      setSelectedTeam(teams[0].code);
    }
  }, [teams, selectedTeam]);

  const fetchTeams = async (forceRefresh = false) => {
    try {
      setLoadingTeams(true);
      console.log('🔄 Iniciando busca de equipes...', forceRefresh ? '(forçando atualização)' : '');

      // Verifica se está online
      const online = Platform.OS === 'web' ? navigator.onLine : true;
      setIsOffline(!online);

      if (online) {
        // Online: busca do Supabase
        // Primeiro, conta quantas equipes existem
        const { count, error: countError } = await supabase
          .from('teams')
          .select('*', { count: 'exact', head: true });
        
        if (countError) {
          console.warn('⚠️ Erro ao contar equipes:', countError);
        } else {
          console.log(`📊 Total de equipes no banco: ${count}`);
        }

        // Busca todas as equipes
        // Primeiro tenta sem count para ver se retorna todas
        let query = supabase
          .from('teams')
          .select('*')
          .order('code', { ascending: true });

        const { data, error, count: returnedCount } = await query;

        if (error) {
          console.error('❌ Erro ao buscar equipes:', error);
          console.error('Detalhes do erro:', JSON.stringify(error, null, 2));
          // Tenta buscar do cache
          const cachedTeams = await TableStore.get('teams');
          if (cachedTeams && cachedTeams.length > 0) {
            console.log('📦 Usando equipes do cache (fallback)');
            setTeams(cachedTeams);
            setIsOffline(true);
          } else {
            Alert.alert('Erro', `Não foi possível carregar as equipes: ${error.message}`);
          }
          return;
        }

        console.log(`✅ Equipes carregadas do Supabase: ${data?.length || 0} equipes`);
        console.log(`📊 Contagem esperada: ${count || 'desconhecida'}`);
        console.log(`📊 Contagem retornada na query: ${returnedCount || 'não disponível'}`);
        
        if (count && data && data.length < count) {
          console.warn(`⚠️ ATENÇÃO: Esperávamos ${count} equipes, mas recebemos apenas ${data.length}`);
          console.warn('⚠️ Possíveis causas: RLS (Row Level Security) ou limite do Supabase');
        }
        
        if (data && data.length > 0) {
          console.log('📋 Lista de equipes retornadas:');
          data.forEach((team, index) => {
            console.log(`  ${index + 1}. Código: ${team.code}, Nome: ${team.name}, ID: ${team.id}`);
          });
        } else {
          console.warn('⚠️ Nenhuma equipe foi retornada do Supabase!');
        }
        
        setTeams(data || []);

        // Salva no cache para uso offline (sempre atualiza o cache)
        if (data && data.length > 0) {
          await TableStore.set('teams', data);
          console.log(`💾 ${data.length} equipes salvas no cache`);
        } else {
          console.warn('⚠️ Nenhuma equipe retornada do Supabase');
        }
      } else {
        // Offline: busca do cache
        console.log('⚠️ Sem conexão - buscando do cache');
        const cachedTeams = await TableStore.get('teams');

        if (cachedTeams && cachedTeams.length > 0) {
          console.log('📦 Equipes carregadas do cache:', cachedTeams);
          setTeams(cachedTeams);
        } else {
          console.warn('❌ Nenhuma equipe no cache');
          Alert.alert(
            'Modo Offline',
            'Você está sem conexão e não há dados em cache. Conecte-se à internet para fazer login pela primeira vez.'
          );
        }
      }
    } catch (error) {
      console.error('Erro ao buscar equipes:', error);

      // Fallback final: tenta cache
      const cachedTeams = await TableStore.get('teams');
      if (cachedTeams && cachedTeams.length > 0) {
        console.log('📦 Usando cache como fallback');
        setTeams(cachedTeams);
        setIsOffline(true);
        } else {
          Alert.alert('Erro', 'Ocorreu um erro ao carregar as equipes. Verifique sua conexão.');
      }
    } finally {
      setLoadingTeams(false);
    }
  };

  const handleLogin = async () => {
    console.log('Selected Team:', selectedTeam);
    console.log('Code:', code);

    if (!selectedTeam) {
      Alert.alert('Erro', 'Por favor, selecione uma equipe.');
      return;
    }

    if (!code) {
      Alert.alert('Erro', 'Por favor, insira o código do representante.');
      return;
    }

    try {
      const online = Platform.OS === 'web' ? navigator.onLine : true;

      if (online) {
        // LOGIN ONLINE
        // 1. Obter o ID real da equipe na tabela 'teams' usando o código da equipe selecionado
        const { data: teamData, error: teamError } = await supabase
          .from('teams')
          .select('id')
          .eq('code', selectedTeam)
          .single();

        if (teamError) {
          console.error('Erro ao buscar ID da equipe:', teamError);
          Alert.alert('Erro', 'Ocorreu um erro ao buscar informações da equipe. Tente novamente.');
          return;
        }

        if (!teamData) {
          Alert.alert('Erro', 'Equipe selecionada inválida.');
          return;
        }

        // 2. Verificar o código do representante e o ID da equipe real na tabela 'users'
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, user_id, team_id, name')
          .eq('user_id', code)
          .eq('team_id', selectedTeam);

        if (userError) {
          console.error('Erro ao buscar usuário:', userError);
          Alert.alert('Erro', 'Ocorreu um erro ao verificar suas credenciais. Tente novamente.');
          return;
        }

        if (!userData || userData.length === 0) {
          Alert.alert('Erro', 'Código de representante ou equipe inválidos.');
          return;
        }

        const foundUser = userData[0];
        const representativeCodeToStore = foundUser.user_id;
        const representativeNameToStore = foundUser.name;

        // 3. Salvar credenciais no AsyncStorage
        await AsyncStorage.setItem('selectedTeamCode', String(selectedTeam));

        const codigosSalvosStr = await AsyncStorage.getItem('codigosRepresentante');
        let codigosArray = codigosSalvosStr ? JSON.parse(codigosSalvosStr) : [];

        if (!codigosArray.includes(representativeCodeToStore)) {
          codigosArray.push(representativeCodeToStore);
          await AsyncStorage.setItem('codigosRepresentante', JSON.stringify(codigosArray));
        }

        await AsyncStorage.setItem('representativeCodeToStore', representativeCodeToStore);
        await AsyncStorage.setItem('representanteNome', representativeNameToStore);

        // 4. Cachear dados do usuário para uso offline
        await TableStore.set('users', userData);
        console.log('💾 Dados do usuário salvos no cache');

        console.log('✅ Login online bem-sucedido');
        console.log('Código do representante:', representativeCodeToStore);
        console.log('Nome do representante:', representativeNameToStore);

        // 5. Preparar app para modo offline (em background)
        console.log('🔄 Preparando app para modo offline...');
        OfflineCache.prepare([
          'teams',
          'products',
          'clients',
          'brands'
        ]).then(result => {
          if (result.success) {
            console.log('✅ App preparado para modo offline!');
          } else {
            console.warn('⚠️ Preparação offline concluída com erros:', result.errors);
          }
        }).catch(err => {
          console.error('❌ Erro ao preparar modo offline:', err);
        });

        router.push('/(app)/orders');
      } else {
        // LOGIN OFFLINE
        console.log('🔴 Tentando login offline...');

        // Busca usuários do cache
        const cachedUsers = await TableStore.get('users');

        if (!cachedUsers || cachedUsers.length === 0) {
          Alert.alert(
            'Modo Offline',
            'Você está sem conexão e não há dados em cache. Conecte-se à internet para fazer login pela primeira vez.'
          );
          return;
        }

        // Verifica se o usuário existe no cache
        const foundUser = cachedUsers.find(
          (u: any) => u.user_id === code && u.team_id === selectedTeam
        );

        if (!foundUser) {
          Alert.alert('Erro', 'Código de representante ou equipe inválidos.');
          return;
        }

        // Salvar credenciais no AsyncStorage
        await AsyncStorage.setItem('selectedTeamCode', String(selectedTeam));
        await AsyncStorage.setItem('representativeCodeToStore', foundUser.user_id);
        await AsyncStorage.setItem('representanteNome', foundUser.name);

        console.log('✅ Login offline bem-sucedido');
        console.log('Código do representante:', foundUser.user_id);
        console.log('Nome do representante:', foundUser.name);

        router.push('/(app)/orders');
      }
    } catch (error) {
      console.error('Erro ao tentar login ou salvar código:', error);

      // Fallback offline em caso de erro
      try {
        console.log('🔄 Tentando fallback offline...');
        const cachedUsers = await TableStore.get('users');

        if (cachedUsers && cachedUsers.length > 0) {
          const foundUser = cachedUsers.find(
            (u: any) => u.user_id === code && u.team_id === selectedTeam
          );

          if (foundUser) {
            await AsyncStorage.setItem('selectedTeamCode', String(selectedTeam));
            await AsyncStorage.setItem('representativeCodeToStore', foundUser.user_id);
            await AsyncStorage.setItem('representanteNome', foundUser.name);

            console.log('✅ Login offline (fallback) bem-sucedido');
            router.push('/(app)/orders');
            return;
          }
        }
      } catch (fallbackError) {
        console.error('Erro no fallback offline:', fallbackError);
      }

      Alert.alert('Erro', 'Ocorreu um erro inesperado ao fazer login. Tente novamente.');
    }
  };

  return (
    <View style={styles.container}>
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>🔴 Modo Offline</Text>
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Image source={logoDmuller} style={styles.logo} resizeMode="contain" />
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputsContainer}>
            <View style={styles.labelContainer}>
              <Text style={styles.label}>Equipe:</Text>
              {teams.length > 0 && (
                <Text style={styles.teamCount}>({teams.length} equipe{teams.length !== 1 ? 's' : ''})</Text>
              )}
              <TouchableOpacity 
                onPress={() => fetchTeams(true)} 
                style={styles.refreshButton}
                disabled={loadingTeams}
              >
                <Text style={styles.refreshButtonText}>
                  {loadingTeams ? '🔄' : '↻'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.pickerContainer}>
              {loadingTeams ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Carregando equipes...</Text>
                </View>
              ) : (
                <RNPickerSelect
                  onValueChange={(value) => {
                    console.log('RNPickerSelect value changed:', value);
                    setSelectedTeam(value || undefined);
                  }}
                  value={selectedTeam}
                  items={teams.map(team => ({
                    label: `${team.code} - ${team.name}`,
                    value: team.code
                  }))}
                  style={{
                    inputIOS: styles.picker,
                    inputAndroid: styles.picker,
                    inputWeb: styles.picker,
                  }}
                  placeholder={{
                    label: teams.length > 0 ? 'Selecione uma equipe' : 'Nenhuma equipe disponível',
                    value: undefined,
                  }}
                  disabled={teams.length === 0}
                />
              )}
            </View>

            <Text style={styles.label}>Representante:</Text>
            <TextInput
              ref={codeInputRef}
              style={styles.input}
              placeholder="Código do Vendedor"
              placeholderTextColor="#8A8A8A"
              keyboardType="numeric"
              value={code}
              onChangeText={setCode}
            />
          </View>

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            <Text style={styles.loginButtonText}>Entrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#003B71',
  },
  offlineBanner: {
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    ...Platform.select({
      web: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
      }
    }),
  },
  offlineText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 320,
    height: 110,
  },
  formContainer: {
    flex: 1,
    maxHeight: 300,
    justifyContent: 'space-between',
  },
  inputsContainer: {
    width: '100%',
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  teamCount: {
    color: '#FFFFFF',
    fontSize: 12,
    opacity: 0.8,
  },
  refreshButton: {
    marginLeft: 'auto',
    padding: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 20,
    minHeight: 50,
    justifyContent: 'center',
  },
  loadingContainer: {
    padding: 15,
    alignItems: 'center',
  },
  loadingText: {
    color: '#666',
    fontSize: 14,
  },
  picker: {
    fontSize: 16,
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderWidth: 0,
    borderRadius: 8,
    color: '#000000',
    backgroundColor: '#FFFFFF',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    fontSize: 16,
  },
  loginButton: {
    alignSelf: 'stretch',
    backgroundColor: '#FCB32B',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#FCB32B',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 12,
      },
      web: {
        boxShadow: '0 6px 20px rgba(252, 179, 43, 0.3)',
      }
    }),
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    textTransform: 'uppercase',
  },
});