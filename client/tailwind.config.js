/** @type {import('tailwindcss').Config} */
// Colors are RGB channel variables so opacity modifiers (bg-muted/60) work and themes can swap them.
const c = (name) => `rgb(var(--${name}) / <alpha-value>)`
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: c('bg'),
        sub: c('sub-bg'),
        accent: c('accent'),
        muted: c('muted'),
        text: c('text'),
        error: c('error'),
        success: c('success'),
      },
      fontFamily: { mono: ['var(--font)'] },
    },
  },
  plugins: [],
}
