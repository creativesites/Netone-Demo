// Channel-agnostic pipeline: WhatsApp is the only channel actually wired up
// today, but every conversation/lead already carries a real `channel` field
// (whatsapp | facebook | instagram | tiktok | web) — display it dynamically
// rather than hardcoding "WhatsApp" so the UI doesn't lie once a second
// channel is connected.
const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  web: 'Website',
};

export function channelLabel(channel: string): string {
  return CHANNEL_LABEL[channel] ?? channel;
}
