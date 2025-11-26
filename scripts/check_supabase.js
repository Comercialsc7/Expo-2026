const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function getSupabaseConfig() {
  const appJsonPath = path.join(__dirname, '..', 'app.json');
  let supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  let supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

  try {
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    if (appJson.expo && appJson.expo.extra) {
      supabaseUrl = supabaseUrl || appJson.expo.extra.supabaseUrl || '';
      supabaseAnonKey = supabaseAnonKey || appJson.expo.extra.supabaseAnonKey || '';
    }
  } catch (err) {
    console.warn('Não foi possível ler app.json:', err.message);
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase URL ou Anon Key não encontrados. Verifique app.json ou variáveis de ambiente.');
    process.exit(1);
  }

  return { supabaseUrl, supabaseAnonKey };
}

async function check() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log('Consultando `teams`...');
  const { data: teams, error: teamsError } = await supabase.from('teams').select('*').order('code', { ascending: true }).limit(100);
  if (teamsError) {
    console.error('Erro ao buscar teams:', teamsError.message || teamsError);
  } else {
    console.log(`Teams encontrados: ${teams.length}`);
    console.log(teams.slice(0, 10));
  }

  console.log('\nConsultando `products`...');
  const { data: products, error: productsError } = await supabase.from('products').select('*').order('name', { ascending: true }).limit(100);
  if (productsError) {
    console.error('Erro ao buscar products:', productsError.message || productsError);
  } else {
    console.log(`Products encontrados: ${products.length}`);
    console.log(products.slice(0, 10));
  }
}

check().catch(err => {
  console.error('Erro na verificação:', err);
  process.exit(1);
});
