import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Image } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useOrderStore, Client, ClientPaymentTerm, PaymentTerm } from '../../../store/useOrderStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SelectClient() {
  const [searchQuery, setSearchQuery] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [codigoEquipeFiltro, setCodigoEquipeFiltro] = useState<number | null>(null);
  const [codigoRepresentanteFiltro, setCodigoRepresentanteFiltro] = useState<string | null>(null);

  const { setClient } = useOrderStore();

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const equipe = await AsyncStorage.getItem('selectedTeamCode');
        const representante = await AsyncStorage.getItem('representativeCodeToStore');
        
        if (equipe) {
          setCodigoEquipeFiltro(Number(equipe));
        }
        if (representante) {
          setCodigoRepresentanteFiltro(representante);
        }
      } catch (e) {
        console.error('Failed to load filters from AsyncStorage', e);
      }
    };

    loadFilters();
  }, []);

  useEffect(() => {
    if (codigoEquipeFiltro !== null && codigoRepresentanteFiltro !== null) {
      console.log('Filtros de cliente carregados:', { equipe: codigoEquipeFiltro, repre: codigoRepresentanteFiltro });
      fetchClients();
    }
  }, [codigoEquipeFiltro, codigoRepresentanteFiltro]);

  const fetchClients = async () => {
    if (codigoEquipeFiltro === null || codigoRepresentanteFiltro === null) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          id, 
          name, 
          code, 
          cnpj, 
          address,
          equipe,
          repre
        `)
        .eq('equipe', codigoEquipeFiltro)
        .eq('repre', codigoRepresentanteFiltro);

      if (error) throw error;

      setClients(data as Client[] || []);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.cnpj.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectClient = async (client: Client) => {
    try {
      // 1. Buscar o diamax na tabela relacao_prazo
      const { data: relacaoPrazo, error: errorRelacao } = await supabase
        .from('relacao_prazo')
        .select('diamax')
        .eq('codcli', client.code);

      if (errorRelacao) throw errorRelacao;
      const diamax = relacaoPrazo && relacaoPrazo.length > 0
        ? Math.max(...relacaoPrazo.map((r: any) => Number(r.diamax)))
        : null;

      // 2. Buscar os prazos permitidos na tabela prazos
      let payment_terms: PaymentTerm[] = [];
      if (diamax !== undefined && diamax !== null) {
        const { data: prazos, error: errorPrazos } = await supabase
          .from('prazos')
          .select('id, prazo, dias')
          .lte('dias', diamax);
        if (errorPrazos) throw errorPrazos;
        payment_terms = (prazos || []).map((prazo: any) => ({
          id: prazo.id,
          description: prazo.prazo,
          prazo_dias: prazo.dias,
        }));
      }

      // 3. Passar o cliente com os prazos permitidos para o store
      setClient({ ...client, payment_terms: payment_terms as any });
      router.push('/create-order/payment-method');
    } catch (error) {
      console.error('Erro ao buscar condições de pagamento do cliente:', error);
      alert('Erro ao buscar condições de pagamento do cliente.');
    }
  };

  const renderClientItem = ({ item }: { item: Client }) => (
    <TouchableOpacity
      style={styles.clientItem}
      onPress={() => handleSelectClient(item)}
    >
      <View style={styles.clientInfo}>
        <View style={styles.firstLine}>
          <Text style={styles.clientCode}>{item.code}</Text>
        </View>
        <Text style={styles.clientName}>{item.name}</Text>
        <Text style={styles.clientCnpj}>CNPJ: {item.cnpj}</Text>
        {item.address && <Text style={styles.clientCnpj}>Endereço: {item.address}</Text>}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Image source={require('../../../assets/images/voltar.png')} style={{ width: 40, height: 40 }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Selecionar Cliente</Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Image source={require('../../../assets/images/buscar.png')} style={{ width: 30, height: 30 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar clientes..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        </View>
      </View>

      <FlatList
        data={filteredClients}
        renderItem={renderClientItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
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
  searchContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#003B71',
    fontFamily: 'Montserrat-Regular',
  },
  list: {
    padding: 16,
  },
  clientItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  clientInfo: {
    gap: 4,
  },
  firstLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clientCode: {
    fontSize: 14,
    color: '#003B71',
    fontFamily: 'Montserrat-Bold',
  },
  clientName: {
    fontSize: 16,
    color: '#003B71',
    fontFamily: 'Montserrat-Bold',
    marginBottom: 4,
  },
  clientCnpj: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'Montserrat-Regular',
  },
  clientDocument: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'Montserrat-Regular',
  },
  clientEmail: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'Montserrat-Regular',
  },
});