import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Voice Intelligence App - Yellow-Black Theme
        primary: '#FFD700',      // Gold/Yellow - Buttons, highlights, active states
        secondary: '#1A1A1A',    // Deep Black - Backgrounds, cards
        accent: '#FFA500',       // Orange - CTAs, important actions
        background: '#0F0F0F',   // Near-black - Page backgrounds
        surface: '#1A1A1A',      // Card/panel backgrounds
        text: '#FFFFFF',         // White - All text on dark backgrounds
        'text-muted': '#A0A0A0', // Muted text
        success: '#00FF00',      // Bright green - Success messages
        error: '#FF4444',        // Red - Error messages
        warning: '#FFA500',      // Orange - Warnings
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
