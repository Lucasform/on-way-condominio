/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Neutros (slate) via CSS vars: o tema claro inverte a rampa
        // (slate-950 vira quase branco, slate-100 vira quase preto), o que
        // converte o app — autorado em dark — pra um claro com bom contraste.
        slate: {
          50:  'rgb(var(--s-50)  / <alpha-value>)',
          100: 'rgb(var(--s-100) / <alpha-value>)',
          200: 'rgb(var(--s-200) / <alpha-value>)',
          300: 'rgb(var(--s-300) / <alpha-value>)',
          400: 'rgb(var(--s-400) / <alpha-value>)',
          500: 'rgb(var(--s-500) / <alpha-value>)',
          600: 'rgb(var(--s-600) / <alpha-value>)',
          700: 'rgb(var(--s-700) / <alpha-value>)',
          800: 'rgb(var(--s-800) / <alpha-value>)',
          900: 'rgb(var(--s-900) / <alpha-value>)',
          950: 'rgb(var(--s-950) / <alpha-value>)',
        },
        // Paleta brand consumida via CSS vars `--brand-<n>` em formato
        // "R G B" (sem rgb()). Fallback default é o azul corporativo OnWay.
        // TenantProvider sobrescreve as vars quando o condomino tem
        // cor_primaria propria.
        brand: {
          50:  'rgb(var(--brand-50,  239 246 255) / <alpha-value>)',
          100: 'rgb(var(--brand-100, 219 234 254) / <alpha-value>)',
          200: 'rgb(var(--brand-200, 191 219 254) / <alpha-value>)',
          300: 'rgb(var(--brand-300, 147 197 253) / <alpha-value>)',
          400: 'rgb(var(--brand-400,  96 165 250) / <alpha-value>)',
          500: 'rgb(var(--brand-500,  59 130 246) / <alpha-value>)',
          600: 'rgb(var(--brand-600,  37  99 235) / <alpha-value>)',
          700: 'rgb(var(--brand-700,  29  78 216) / <alpha-value>)',
          800: 'rgb(var(--brand-800,  30  64 175) / <alpha-value>)',
          900: 'rgb(var(--brand-900,  30  58 138) / <alpha-value>)',
          950: 'rgb(var(--brand-950,  23  37  84) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
}
