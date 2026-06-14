/** @type {import('tailwindcss').Config} */

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,vue}'],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        'weave-deep': '#0f0f1a',
        'weave-primary': '#1a1a2e',
        'weave-secondary': '#16213e',
        'weave-card': '#1e2a45',
        'weave-hover': '#253354',
        'weave-gold': '#e8b84b',
        'weave-gold-dim': '#c49a3a',
        'weave-text': '#f5f0e8',
        'weave-text-sec': '#a8a4b8',
        'weave-muted': '#6b687a',
        'weave-error': '#c0392b',
        'weave-warning': '#e67e22',
        'weave-success': '#27ae60',
        'weave-border': '#2a3a5c',
        'weave-border-accent': '#3a4a6c',
      },
      fontFamily: {
        serif: ['Noto Serif SC', 'serif'],
        sans: ['Noto Sans SC', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
