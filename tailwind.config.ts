import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			mandarine: {
  				'50': '#FFF8F1',
  				'100': '#FEEDE0',
  				'200': '#FDD6BF',
  				'300': '#FBB594',
  				'400': '#F98858',
  				'500': '#FF4D00',
  				'600': '#DC520F',
  				'700': '#B43C0C',
  				'800': '#8F3010',
  				'900': '#742A10',
  				DEFAULT: 'hsl(var(--mandarine))',
  				foreground: 'hsl(var(--mandarine-foreground))'
  			},
  			forest: {
  				'50': '#F2F7F4',
  				'100': '#E1EDE6',
  				'200': '#C3DCCE',
  				'300': '#9BC2AD',
  				'400': '#6BA187',
  				'500': '#468267',
  				'600': '#31654E',
  				'700': '#264F3D',
  				'800': '#1D3D30',
  				'900': '#152E24',
  				'950': '#0C1B15',
  				DEFAULT: 'hsl(var(--forest))',
  				foreground: 'hsl(var(--forest-foreground))'
  			},
  			crest: {
  				'50': '#FEFDF0',
  				'100': '#FEFAD9',
  				'200': '#FDF2A9',
  				'300': '#FCE672',
  				'400': '#FAD53D',
  				'500': '#F4BF16',
  				'600': '#D69E09',
  				'700': '#AA7409',
  				'800': '#8B5A10',
  				'900': '#734912',
  				DEFAULT: 'hsl(var(--crest))',
  				foreground: 'hsl(var(--crest-foreground))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
				border: 'hsl(var(--sidebar-border))',
				ring: 'hsl(var(--sidebar-ring))'
			}
  		},
  		fontFamily: {
  			sans: [
  				'var(--font-sans)',
  				'sans-serif'
  			],
  			display: [
  				'var(--font-display)',
  				'sans-serif'
  			],
  			mono: [
  				'var(--font-mono)',
  				'monospace'
  			]
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [tailwindcssAnimate],
};
export default config;
