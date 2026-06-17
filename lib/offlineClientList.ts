import type { Client } from '../store/useOrderStore';

const clientCompositeKey = (client: Partial<Client>): string => {
  return `${String(client?.code || '')}:${String((client as any)?.equipe || '')}:${String((client as any)?.repre || '')}:${String(client?.id || '')}`;
};

export const mergeClientLists = (existing: Client[], incoming: Client[]): Client[] => {
  const map = new Map<string, Client>();

  for (const client of existing || []) {
    const key = clientCompositeKey(client);
    if (key) {
      map.set(key, client);
    }
  }

  for (const client of incoming || []) {
    const key = clientCompositeKey(client);
    if (key) {
      map.set(key, client);
    }
  }

  return Array.from(map.values());
};
