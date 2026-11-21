/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    screens: {
      'xs': '480px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1.5rem',
        lg: '2rem',
      },
      screens: {
        '2xl': '1440px',
      },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        // Refined Executive SaaS Palette (mapped cleanly to existing tokens)
        forest: {
          DEFAULT: '#0B3B2E',
          deep: '#07281F',
          hover: '#104D3C',
          light: '#175E4B',
          muted: '#134A3B',
        },
        ivory: {
          DEFAULT: '#F5F7F6', // Crisp Alabaster Slate Canvas
          surface: '#FFFFFF', // Pure Crisp White Card Surface
          muted: '#EDF1EF',
          hover: '#F0F4F2',
        },
        sage: {
          DEFAULT: '#84B89B',
          pale: '#E9F3EE',
          hover: '#72A88A',
          dark: '#356E55',
          light: '#BCE0CD',
        },
        copper: {
          DEFAULT: '#C25E1A',
          pale: '#FDF1E8',
          hover: '#A84E12',
          dark: '#92400E',
        },
        ink: {
          primary: '#111F1A',
          secondary: '#4E5F58',
          muted: '#7B8B84',
        },
        divider: '#E2E8E5',
        'status-success': '#15803D',
        'status-warning': '#B45309',
        'status-danger': '#DC2626',
        'status-error': '#DC2626',

        // Standard shadcn semantic tokens mapped to theme
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        xl: '0.875rem',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        'warm-xs': '0 1px 2px 0 rgba(11, 59, 46, 0.04)',
        'warm-sm': '0 1px 3px 0 rgba(11, 59, 46, 0.05), 0 1px 2px -1px rgba(11, 59, 46, 0.04)',
        'warm-md': '0 4px 12px -2px rgba(11, 59, 46, 0.07), 0 2px 4px -2px rgba(11, 59, 46, 0.04)',
        'warm-lg': '0 12px 24px -4px rgba(11, 59, 46, 0.09), 0 4px 8px -4px rgba(11, 59, 46, 0.04)',
        'warm-xl': '0 20px 32px -6px rgba(11, 59, 46, 0.12), 0 8px 12px -6px rgba(11, 59, 46, 0.05)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
