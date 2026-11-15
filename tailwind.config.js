/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'navy': {
          950: '#070a13',
          900: '#0b0f19',
          850: '#0f1422',
          800: '#151c2e',
          700: '#1e293b',
          600: '#334155'
        },
        'cyber': {
          emerald: '#10B981',
          cyan: '#06B6D4',
          purple: '#8B5CF6',
          rose: '#F43F5E',
          amber: '#F59E0B'
        }
      },
      boxShadow: {
        'xs': '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'tech-glow': 'radial-gradient(ellipse at top, rgba(139, 92, 246, 0.15), transparent 70%)',
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
