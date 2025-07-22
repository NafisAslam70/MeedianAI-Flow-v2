module.exports = {
  theme: {
    extend: {
      colors: {
        teal: { 100: '#E6FFFA', 600: '#319795', 700: '#2C7A7B' },
        purple: { 50: '#FAF5FF', 100: '#F3E8FF', 600: '#805AD5', 700: '#6B46C1' },
      },
    },
  },
  content: ['./pages/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
};