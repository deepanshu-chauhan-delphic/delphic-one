/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef4ff',
          100: '#dbe6fe',
          200: '#bdd0fe',
          300: '#8fb0fd',
          400: '#5a87fa',
          500: '#3763f4',
          600: '#2545e8',
          700: '#1f36d1',
          800: '#202faa',
          900: '#202c85',
        },
        tertiary: {
          50: '#f4f6f8',
          100: '#e4e8ec',
          200: '#cbd3db',
          300: '#a6b3c1',
          400: '#7b8ba0',
          500: '#5c6f86',
          600: '#48586e',
          700: '#3b485a',
          800: '#333e4c',
          900: '#2d3541',
        },
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
        info: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        heading: ['var(--font-heading)'],
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        sm: 'var(--radius-sm)',
        lg: 'var(--radius-lg)',
        xl: '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        soft: '0 4px 24px -4px rgb(15 23 42 / 0.08)',
        drawer: '0 0 40px -8px rgb(15 23 42 / 0.18)',
      },
      transitionTimingFunction: {
        soft: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
