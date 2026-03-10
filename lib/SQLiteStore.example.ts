import SQLiteStore from './SQLiteStore';

interface Product {
  id: string;
  name: string;
  price: number;
}

interface Order {
  id: string;
  clientName: string;
  items: any[];
  total: number;
}

export const SQLiteStoreExamples = {
  async saveProduct() {
    const product: Product = {
      id: '123',
      name: 'Produto Teste',
      price: 99.9,
    };

    const saved = await SQLiteStore.save('products', product);
    console.log('Product saved:', saved);
  },

  async getAllProducts() {
    const products = await SQLiteStore.getAll('products');
    console.log('All products:', products);
    return products;
  },

  async removeProduct(id: string) {
    const removed = await SQLiteStore.remove('products', id);
    console.log('Product removed:', removed);
  },

  async clearProducts() {
    const count = await SQLiteStore.clear('products');
    console.log(`Cleared ${count} products`);
  },

  async saveOrder() {
    const order: Order = {
      id: '456',
      clientName: 'João Silva',
      items: [{ product: 'Produto A', qty: 2 }],
      total: 199.8,
    };

    const saved = await SQLiteStore.save('orders', order);
    console.log('Order saved:', saved);
  },

  async searchOrders() {
    const orders = await SQLiteStore.search('orders', (order: Order) => {
      return order.total > 100;
    });
    console.log('Orders with total > 100:', orders);
    return orders;
  },

  async getAllTables() {
    const tables = await SQLiteStore.getAllTables();
    console.log('All tables:', tables);
    return tables;
  },

  async getDatabaseInfo() {
    const info = await SQLiteStore.getInfo();
    console.log('Database info:', info);
    return info;
  },

  async countRecords() {
    const productCount = await SQLiteStore.count('products');
    const orderCount = await SQLiteStore.count('orders');
    console.log(`Products: ${productCount}, Orders: ${orderCount}`);
  },
};

export default SQLiteStoreExamples;

