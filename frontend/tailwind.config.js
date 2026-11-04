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
      colors: {
        // Core Approved Theme Tokens
        forest: {
          DEFAULT: '#0B3B2E',
          deep: '#082D24',
          hover: '#0E4839',
          light: '#1B5B49',
          muted: '#144637',
        },
        ivory: {
          DEFAULT: '#F7F3EA',
          surface: '#FFFEFA',
          muted: '#EFECE2',
        },
        sage: {
          DEFAULT: '#A9BE98',
          pale: '#E8EEDD',
          hover: '#98AE87',
          dark: '#5D734C',
        },
        copper: {
          DEFAULT: '#B85C1E',
          pale: '#F8E8D5',
          hover: '#A34F18',
          dark: '#8C3F0F',
        },
        ink: {
          primary: '#182820',
          secondary: '#5E6B61',
          muted: '#7A887E',
        },
        divider: '#DEDCCF',
        'status-success': '#2F7D4A',
        'status-warning': '#A85A12',
        'status-danger': '#B42318',

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
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        'warm-sm': '0 1px 2px 0 rgba(24, 40, 32, 0.05)',
        'warm-md': '0 4px 6px -1px rgba(24, 40, 32, 0.07), 0 2px 4px -2px rgba(24, 40, 32, 0.05)',
        'warm-lg': '0 10px 15px -3px rgba(24, 40, 32, 0.08), 0 4px 6px -4px rgba(24, 40, 32, 0.04)',
        'warm-xl': '0 20px 25px -5px rgba(24, 40, 32, 0.1), 0 8px 10px -6px rgba(24, 40, 32, 0.05)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
