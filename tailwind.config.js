/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("nativewind/preset")],
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    // Adicione outros diretórios que contenham arquivos com classes Tailwind
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  // Adicione outras configurações do Tailwind conforme necessário
}; 