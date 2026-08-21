// Email HTML can't consume CSS custom properties or Tailwind's oklch
// output — most mail clients strip <style> blocks or don't support modern
// CSS color functions at all, so every color here has to be a literal,
// email-safe value. These are the same "Ledger" brand values defined as
// oklch tokens in packages/ui/src/styles/globals.css, hand-converted to hex
// once for use here. If the brand palette changes, both files need
// updating — there's no automated sync between them, and five colors
// isn't worth building one for.
export const EMAIL_COLORS = {
  navy: '#2E3251',
  sky: '#7AB6F9',
  teal: '#31C195',
  amber: '#D98E3F',
  coral: '#D6483F',
  ink: '#20233A',
  muted: '#6B7280',
  border: '#E5E7EB',
  background: '#F6F7FB',
  white: '#FFFFFF',
} as const;

export const EMAIL_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
