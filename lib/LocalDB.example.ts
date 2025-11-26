import LocalDB from './LocalDB';

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

export const LocalDBExamples = {
  async saveProduct() {
    const product: Product = {
      id: '123',
      name: 'Produto Teste',
      price: 99.9,
    };

    const saved = await LocalDB.save('products', product);
    console.log('Product saved:', saved);
  },

  async getAllProducts() {
    const products = await LocalDB.getAll('products');
    console.log('All products:', products);
    return products;
  },

  async removeProduct(id: string) {
    const removed = await LocalDB.remove('products', id);
    console.log('Product removed:', removed);
  },

  async clearProducts() {
    const count = await LocalDB.clear('products');
    console.log(`Cleared ${count} products`);
  },

  async saveOrder() {
    const order: Order = {
      id: '456',
      clientName: 'João Silva',
      items: [{ product: 'Produto A', qty: 2 }],
      total: 199.8,
    };

    const saved = await LocalDB.save('orders', order);
    console.log('Order saved:', saved);
  },

  async searchOrders() {
    const orders = await LocalDB.search('orders', (order: Order) => {
      return order.total > 100;
    });
    console.log('Orders with total > 100:', orders);
    return orders;
  },

  async getAllTables() {
    const tables = await LocalDB.getAllTables();
    console.log('All tables:', tables);
    return tables;
  },

  async getDatabaseInfo() {
    const info = await LocalDB.getInfo();
    console.log('Database info:', info);
    return info;
  },

  async countRecords() {
    const productCount = await LocalDB.count('products');
    const orderCount = await LocalDB.count('orders');
    console.log(`Products: ${productCount}, Orders: ${orderCount}`);
  },
};

export default LocalDBExamples;
