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
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        heading: ['var(--font-heading)'],
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
      },
    },
  },
  plugins: [],
};
