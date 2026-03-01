/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        katsu: {
          bg: '#0f0f0f',
          surface: '#1a1a1a',
          'surface-2': '#242424',
          'surface-3': '#2e2e2e',
          border: '#333333',
          'border-light': '#444444',
          text: '#e5e5e5',
          'text-muted': '#999999',
          'text-dim': '#666666',
          accent: '#FACC15',
          'accent-hover': '#EAB308',
        },
        project: {
          music: '#FACC15',
          web: '#3B82F6',
          art: '#A855F7',
          writing: '#10B981',
          video: '#EF4444',
          performance: '#F59E0B',
          research: '#06B6D4',
          hardware: '#64748B',
          other: '#9CA3AF',
        },
        block: {
          fixed: '#374151',
          break: '#D1D5DB',
          buffer: '#F3F4F6',
        },
      },
    },
  },
  plugins: [],
};
