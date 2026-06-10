import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Image, Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useOrderStore, Client, PaymentTerm } from '../../../store/useOrderStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TableStore from '../../../lib/TableStore';
import OfflineSQLiteService from '../../../lib/OfflineSQLiteService';
import SQLiteStore from '../../../lib/SQLiteStore';

const CASH_ONLY_PAYMENT_TERM: PaymentTerm = {
  id: 'cash-only',
  description: 'À Vista',
  prazo_dias: 0,
};

const mergeByKey = (
  existing: any[],
  incoming: any[],
  keyOrResolver: string | ((item: any) => string)
) => {
  const map = new Map<string, any>();
  const resolveKey = (item: any) => {
    if (typeof keyOrResolver === 'function') {
      return keyOrResolver(item);
    }
    return String(item?.[keyOrResolver] ?? item?.id ?? '');
  };

  for (const item of existing || []) {
    const k = resolveKey(item);
    if (k) map.set(k, item);
  }

  for (const item of incoming || []) {
    const k = resolveKey(item);
    if (k) map.set(k, item);
  }

  return Array.from(map.values());
};

export default function SelectClient() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [codigoEquipeFiltro, setCodigoEquipeFiltro] = useState<number | null>(null);
  const [codigoRepresentanteFiltro, setCodigoRepresentanteFiltro] = useState<string | null>(null);

  const { setClient } = useOrderStore();

  const readTableWithFallbacks = useCallback(async (tableName: string): Promise<any[]> => {
    const sqliteRows = await OfflineSQLiteService.getAll(tableName);
    if (sqliteRows.length > 0) {
      return sqliteRows;
    }

    const localDbRows = await SQLiteStore.getAll(tableName);
    const localDbPayloads = localDbRows
      .map((row) => row?.payload)
      .filter(Boolean);
    if (localDbPayloads.length > 0) {
      return localDbPayloads;
    }

    return TableStore.get(tableName);
  }, []);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigoEquipeFiltro, codigoRepresentanteFiltro]);

  const getPaymentTermsWithFallback = useCallback(async (clientCode: string): Promise<PaymentTerm[]> => {
    try {
      const { data: relacaoPrazo, error: errorRelacao } = await supabase
        .from('relacao_prazo')
        .select('id, codcli, diamax')
        .eq('codcli', clientCode);

      if (errorRelacao) throw errorRelacao;

      if (relacaoPrazo && relacaoPrazo.length > 0) {
        try {
          const existingRelacaoPrazo = await TableStore.get('relacao_prazo');
          const mergedRelacaoPrazo = mergeByKey(existingRelacaoPrazo, relacaoPrazo, 'id');
          await TableStore.set('relacao_prazo', mergedRelacaoPrazo);
          await OfflineSQLiteService.upsertMany('relacao_prazo', relacaoPrazo);
          await SQLiteStore.upsertMany('relacao_prazo', relacaoPrazo);
        } catch (cacheError) {
          console.warn('⚠️ Falha ao persistir relacao_prazo no cache local:', cacheError);
        }
      }

      const diamax = relacaoPrazo && relacaoPrazo.length > 0
        ? Math.max(...relacaoPrazo.map((r: any) => Number(r.diamax)))
        : null;

      if (diamax === undefined || diamax === null) {
        return [CASH_ONLY_PAYMENT_TERM];
      }

      const { data: prazos, error: errorPrazos } = await supabase
        .from('prazos')
        .select('id, prazo, dias')
        .lte('dias', diamax);

      if (errorPrazos) throw errorPrazos;

      if (prazos && prazos.length > 0) {
        try {
          const existingPrazos = await TableStore.get('prazos');
          const mergedPrazos = mergeByKey(existingPrazos, prazos, 'id');
          await TableStore.set('prazos', mergedPrazos);
          await OfflineSQLiteService.upsertMany('prazos', prazos);
          await SQLiteStore.upsertMany('prazos', prazos);
        } catch (cacheError) {
          console.warn('⚠️ Falha ao persistir prazos no cache local:', cacheError);
        }
      }

      const mappedTerms = (prazos || []).map((prazo: any) => ({
        id: prazo.id,
        description: prazo.prazo,
        prazo_dias: prazo.dias,
      }));

      return mappedTerms.length > 0 ? mappedTerms : [CASH_ONLY_PAYMENT_TERM];
    } catch (error) {
      console.warn('⚠️ Falha ao buscar prazos online. Usando cache local...', error);

      const relacaoPrazoFallback = await readTableWithFallbacks('relacao_prazo');
      const prazosFallback = await readTableWithFallbacks('prazos');

      const relacoesCliente = relacaoPrazoFallback.filter(
        (item: any) => String(item.codcli) === String(clientCode)
      );

      const diamax = relacoesCliente.length > 0
        ? Math.max(...relacoesCliente.map((r: any) => Number(r.diamax)))
        : null;

      if (diamax === undefined || diamax === null) {
        return [CASH_ONLY_PAYMENT_TERM];
      }

      const mappedTerms = prazosFallback
        .filter((prazo: any) => Number(prazo.dias) <= diamax)
        .map((prazo: any) => ({
          id: prazo.id,
          description: prazo.prazo,
          prazo_dias: prazo.dias,
        }));

      return mappedTerms.length > 0 ? mappedTerms : [CASH_ONLY_PAYMENT_TERM];
    }
  }, [readTableWithFallbacks]);

  const fetchClients = async () => {
    if (codigoEquipeFiltro === null || codigoRepresentanteFiltro === null) {
      return;
    }

    const readCachedClients = async (): Promise<Client[]> => {
      // Filtra diretamente via SQL (json_extract) — não carrega 20k registros em memória.
      const sqliteClients = await OfflineSQLiteService.getAllWhere('clients', {
        equipe: codigoEquipeFiltro!,
        repre: codigoRepresentanteFiltro!,
      });

      if (sqliteClients.length > 0) {
        return sqliteClients as Client[];
      }

      // Fallback para TableStore (cache em memória) com filtro JS.
      const cachedClients = await TableStore.get('clients');
      return cachedClients.filter(
        (client: any) =>
          Number(client.equipe) === Number(codigoEquipeFiltro) &&
          String(client.repre) === String(codigoRepresentanteFiltro)
      ) as Client[];
    };

    try {
      const cached = await readCachedClients();
      if (cached.length > 0) {
        setClients(cached);
      }
    } catch (cacheError) {
      console.warn('⚠️ Falha ao carregar clientes do cache antes da rede:', cacheError);
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
          max_giros,
          equipe,
          repre
        `)
        .eq('equipe', codigoEquipeFiltro)
        .eq('repre', codigoRepresentanteFiltro);

      if (error) throw error;

      const fetchedClients = (data as Client[] || []);
      setClients(fetchedClients);

      if (fetchedClients.length > 0) {
        try {
          const existingClients = await TableStore.get('clients');
          // O mesmo cliente pode aparecer para vendedores/equipes diferentes.
          // Usa chave composta para evitar sobrescrever registros no cache local.
          const mergedClients = mergeByKey(
            existingClients,
            fetchedClients,
            (client: any) => `${String(client?.code || '')}:${String(client?.equipe || '')}:${String(client?.repre || '')}:${String(client?.id || '')}`
          );
          await TableStore.set('clients', mergedClients);
          await OfflineSQLiteService.upsertMany('clients', fetchedClients);
        } catch (cacheError) {
          console.warn('⚠️ Falha ao persistir clientes no cache local:', cacheError);
        }
      }
    } catch (error) {
      console.warn('⚠️ Falha ao buscar clientes online. Usando cache local...', error);

      try {
        const cached = await readCachedClients();
        setClients(cached);
      } catch (cacheError) {
        console.error('Erro ao buscar clientes no cache local:', cacheError);
      }
    } finally {
    }
  };

  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedQuery(text), 300);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const filteredClients = useMemo(() =>
    clients.filter(client =>
      client.name.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      client.code.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      client.cnpj.toLowerCase().includes(debouncedQuery.toLowerCase())
    ),
    [clients, debouncedQuery]
  );

  const handleSelectClient = useCallback(async (client: Client) => {
    try {
      const paymentTerms = await getPaymentTermsWithFallback(client.code);
      const safePaymentTerms = paymentTerms.length > 0 ? paymentTerms : [CASH_ONLY_PAYMENT_TERM];

      // Passar o cliente com os prazos permitidos para o store
      setClient({ ...client, payment_terms: safePaymentTerms as any });
      router.push('/create-order/payment-method');
    } catch (error) {
      console.error('Erro ao buscar condições de pagamento do cliente:', error);
      alert('Erro ao buscar condições de pagamento do cliente.');
    }
  }, [getPaymentTermsWithFallback, setClient]);

  const renderClientItem = useCallback(({ item }: { item: Client }) => (
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
  ), [handleSelectClient]);

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
            onChangeText={handleSearch}
          />
        </View>
        <Text style={styles.resultCount}>{filteredClients.length} cliente(s)</Text>
      </View>

      <FlatList
        data={filteredClients}
        renderItem={renderClientItem}
        keyExtractor={(item, index) => `${item.id ?? 'no-id'}:${item.code ?? 'no-code'}:${String(item.equipe ?? '')}:${String(item.repre ?? '')}:${index}`}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        updateCellsBatchingPeriod={50}
        windowSize={10}
        removeClippedSubviews={Platform.OS !== 'web'}
        keyboardShouldPersistTaps="handled"
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
  resultCount: {
    marginTop: 8,
    marginLeft: 4,
    fontSize: 12,
    color: '#666666',
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