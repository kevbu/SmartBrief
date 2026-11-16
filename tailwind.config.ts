import type { Config } from 'tailwindcss'

// Semantic colour tokens resolve to CSS variables (see globals.css), so light and
// dark themes swap automatically and components rarely need `dark:` variants.
// Dark mode keys off <html data-theme="dark">, set by the theme script in layout.tsx.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`

const config: Config = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'Cambria', 'serif'],
      },
      colors: {
        paper: token('paper'),
        card: token('card'),
        raised: token('raised'),
        well: {
          DEFAULT: token('well'),
          strong: token('well-strong'),
        },
        line: {
          DEFAULT: token('line'),
          strong: token('line-strong'),
        },
        ink: {
          DEFAULT: token('ink'),
          soft: token('ink-soft'),
          muted: token('ink-muted'),
          faint: token('ink-faint'),
        },
        accent: {
          DEFAULT: token('accent'),
          soft: token('accent-soft'),
          ink: token('accent-ink'),
        },
        'on-accent': token('on-accent'),
        positive: {
          DEFAULT: token('positive'),
          soft: token('positive-soft'),
          ink: token('positive-ink'),
        },
        negative: {
          DEFAULT: token('negative'),
          soft: token('negative-soft'),
          ink: token('negative-ink'),
        },
      },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.04), 0 1px 1px rgb(0 0 0 / 0.02)',
        lift: '0 8px 24px -8px rgb(0 0 0 / 0.18), 0 2px 6px -2px rgb(0 0 0 / 0.08)',
      },
      animation: {
        'spin-slow': 'spin 1.5s linear infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'sheet-in': 'sheetIn 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        sheetIn: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
