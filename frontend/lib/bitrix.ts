/** Deep link into the real Bitrix24 portal for a synced lead, if configured. */
export function bitrixLeadUrl(leadId: string | number): string | null {
  const portal = process.env.NEXT_PUBLIC_BITRIX24_PORTAL_URL;
  if (!portal) return null;
  return `${portal.replace(/\/+$/, '')}/crm/lead/details/${leadId}/`;
}
