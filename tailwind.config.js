/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta índigo profissional — identidade visual OnWay Condomínio
        // Padrão de mercado pra SaaS de gestão (Linear, Vercel, Notion).
        brand: {
          50:  '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',   // cor principal
          800: '#3730A3',
          900: '#312E81',
          950: '#1E1B4B',
        },
      },
    },
  },
  plugins: [],
}
