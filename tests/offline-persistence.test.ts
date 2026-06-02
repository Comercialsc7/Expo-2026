import { beforeEach, describe, expect, it } from 'vitest';

import SQLiteStore from '../lib/SQLiteStore';
import TableStore from '../lib/TableStore';

describe('Offline persistence across app tables', () => {
  beforeEach(async () => {
    await SQLiteStore.clearAll();
  });

  it('persiste produtos, clientes e marcas ao mesmo tempo (não só produtos)', async () => {
    await TableStore.set('products', [
      { id: 'p1', code: '001', name: 'Produto 1' },
      { id: 'p2', code: '002', name: 'Produto 2' },
    ]);

    await TableStore.set('clients', [
      { id: 'c1', code: '100', name: 'Cliente 1' },
    ]);

    await TableStore.set('brands', [
      { id: 'b1', code: '200', name: 'Marca 1' },
    ]);

    const products = await TableStore.get('products');
    const clients = await TableStore.get('clients');
    const brands = await TableStore.get('brands');

    expect(products).toHaveLength(2);
    expect(clients).toHaveLength(1);
    expect(brands).toHaveLength(1);

    expect(products.map((item) => item.name)).toEqual(['Produto 1', 'Produto 2']);
    expect(clients[0].name).toBe('Cliente 1');
    expect(brands[0].name).toBe('Marca 1');
  });

  it('atualizar uma tabela não remove dados das outras', async () => {
    await TableStore.set('products', [{ id: 'p1', name: 'Produto inicial' }]);
    await TableStore.set('clients', [{ id: 'c1', name: 'Cliente persistente' }]);

    await TableStore.set('products', [{ id: 'p2', name: 'Produto novo' }]);

    const products = await TableStore.get('products');
    const clients = await TableStore.get('clients');

    expect(products).toHaveLength(1);
    expect(products[0].name).toBe('Produto novo');

    expect(clients).toHaveLength(1);
    expect(clients[0].name).toBe('Cliente persistente');
  });
});
