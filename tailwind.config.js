/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta bordô/vinho — identidade visual OnWay Condomínio
        brand: {
          50:  '#FDF2F3',
          100: '#FCE5E8',
          200: '#F9CCD2',
          300: '#F1A0AC',
          400: '#E76A7E',
          500: '#D43A55',
          600: '#B82240',
          700: '#8B1424',   // cor principal
          800: '#741320',
          900: '#5C0F19',
          950: '#330810',
        },
      },
    },
  },
  plugins: [],
}
