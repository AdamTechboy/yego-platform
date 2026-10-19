// Organisation-level settings. Replace placeholders before launch.

// Official YEGO WhatsApp community/channel. Applicants join it immediately
// after applying; all further instructions are shared there.
export const WHATSAPP_CHANNEL_URL =
  (import.meta.env.VITE_WHATSAPP_CHANNEL_URL as string | undefined)?.trim() ||
  'https://whatsapp.com/channel/YEGO-OFFICIAL'

export const WHATSAPP_CHANNEL_CONFIGURED = !WHATSAPP_CHANNEL_URL.includes('YEGO-OFFICIAL')

export const MIN_AGE = 18
export const MAX_AGE = 35
