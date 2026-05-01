/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-2': 'var(--color-surface-2)',
        border: 'var(--color-border)',
        'border-strong': 'var(--color-border-strong)',
        fg: 'var(--color-fg)',
        'fg-muted': 'var(--color-fg-muted)',
        'fg-subtle': 'var(--color-fg-subtle)',
        accent: 'var(--color-accent)',
        'accent-fg': 'var(--color-accent-fg)',
        danger: 'var(--color-danger)',
        warn: 'var(--color-warn)',
        success: 'var(--color-success)',
        info: 'var(--color-info)'
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      fontSize: {
        '2xs': ['11px', '14px']
      },
      borderRadius: {
        sm: '3px',
        md: '5px'
      },
      maxWidth: {
        'wide': '1600px'
      }
    }
  },
  plugins: []
};
