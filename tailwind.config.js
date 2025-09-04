module.exports = {
  theme: {
    extend: {
      colors: {
        teal: { 100: '#E6FFFA', 600: '#319795', 700: '#2C7A7B' },
        purple: { 50: '#FAF5FF', 100: '#F3E8FF', 600: '#805AD5', 700: '#6B46C1' },
        cyan: { 400: '#22d3ee' },
      },
    },
  },
  // Include app directory for Tailwind class scanning (v3 compat)
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
};
