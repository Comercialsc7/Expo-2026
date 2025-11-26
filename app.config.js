const fs = require('fs');
const path = require('path');
require('dotenv').config();

const appJsonPath = path.join(__dirname, 'app.json');
let base = {};
try {
  base = require(appJsonPath);
} catch (err) {
  console.warn('Não foi possível ler app.json, gerando config mínima:', err.message);
  base = { expo: {} };
}

const extraFromJson = (base.expo && base.expo.extra) ? base.expo.extra : {};

const extra = {
  ...extraFromJson,
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || extraFromJson.supabaseUrl || '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || extraFromJson.supabaseAnonKey || '',
};

module.exports = () => ({
  expo: {
    ...base.expo,
    extra,
  },
});
