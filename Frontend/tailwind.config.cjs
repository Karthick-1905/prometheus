/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#fff8f0',
        surface: '#fff8f0',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#fdf3e1',
        'surface-container': '#f7eddb',
        'surface-container-high': '#f1e7d5',
        'surface-container-highest': '#ebe1d0',
        primary: '#745b00',
        'primary-container': '#ffcd11',
        'on-primary-container': '#6f5800',
        'on-primary-fixed-variant': '#574400',
        'on-surface': '#1f1b10',
        'on-surface-variant': '#4e4632',
        outline: '#80765f',
        'outline-variant': '#d1c5ab',
        error: '#ba1a1a',
        'error-container': '#ffdad6',
        'on-error-container': '#93000a',
        tertiary: '#006874',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
