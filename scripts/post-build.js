const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, '../dist');
const publicPath = path.join(__dirname, '../public');

// Criar pasta dist se não existir
if (!fs.existsSync(distPath)) {
  fs.mkdirSync(distPath, { recursive: true });
}

// Copiar manifest.json
const manifestSource = path.join(publicPath, 'manifest.json');
const manifestDest = path.join(distPath, 'manifest.json');
if (fs.existsSync(manifestSource)) {
  fs.copyFileSync(manifestSource, manifestDest);
  console.log('✓ manifest.json copiado para dist/');
}

// Copiar service-worker.js
const swSource = path.join(publicPath, 'service-worker.js');
const swDest = path.join(distPath, 'service-worker.js');
if (fs.existsSync(swSource)) {
  fs.copyFileSync(swSource, swDest);
  console.log('✓ service-worker.js copiado para dist/');
}

// Copiar offline.html
const offlineSource = path.join(publicPath, 'offline.html');
const offlineDest = path.join(distPath, 'offline.html');
if (fs.existsSync(offlineSource)) {
  fs.copyFileSync(offlineSource, offlineDest);
  console.log('✓ offline.html copiado para dist/');
}

// Copiar ícones para assets/images
const assetsImagesPath = path.join(distPath, 'assets', 'images');
if (!fs.existsSync(assetsImagesPath)) {
  fs.mkdirSync(assetsImagesPath, { recursive: true });
}

const iconSource = path.join(__dirname, '../assets/images/icon.png');
const iconDest = path.join(assetsImagesPath, 'icon.png');
if (fs.existsSync(iconSource)) {
  fs.copyFileSync(iconSource, iconDest);
  console.log('✓ icon.png copiado para dist/assets/images/');
}

// Injetar tags PWA no index.html se existir
const indexPath = path.join(distPath, 'index.html');
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');

  // Verificar se já tem as tags PWA
  if (!html.includes('manifest.json')) {
    const pwaMetaTags = `
  <!-- PWA Meta Tags -->
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Expo2025" />
  <meta name="application-name" content="Sistema Expo2025" />
  <meta name="theme-color" content="#003B71" />
  <meta name="description" content="Sistema de vendas Expo2025" />

  <!-- Manifest -->
  <link rel="manifest" href="/manifest.json" />

  <!-- Icons -->
  <link rel="icon" type="image/png" sizes="196x196" href="/assets/images/icon.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/images/icon.png" />
`;

    const swScript = `
  <!-- Service Worker Registration -->
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/service-worker.js')
          .then(registration => {
            console.log('Service Worker registrado:', registration.scope);
          })
          .catch(error => {
            console.error('Erro ao registrar Service Worker:', error);
          });
      });
    }
  </script>
`;

    // Injetar no <head>
    html = html.replace('</head>', pwaMetaTags + '</head>');

    // Injetar antes do </body>
    html = html.replace('</body>', swScript + '</body>');

    fs.writeFileSync(indexPath, html, 'utf8');
    console.log('✓ Tags PWA injetadas no index.html');
  }
}

console.log('\n✅ Arquivos PWA configurados com sucesso!\n');
