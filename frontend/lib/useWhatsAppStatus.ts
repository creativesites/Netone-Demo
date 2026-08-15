'use client';

import { useCallback, useEffect, useState } from 'react';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4702';

export interface WaStatus {
  status: 'connected' | 'connecting' | 'disconnected' | string;
  hasQr?: boolean;
  pairingCode?: string | null;
  pairingError?: string | null;
  pairingElapsedMs?: number | null;
  method?: 'qr' | 'code';
  user?: string | null;
}

export function displayWaNumber(user?: string | null): string | null {
  if (!user) return null;
  const digits = user.split(':')[0]?.replace(/\D/g, '') ?? '';
  if (digits.length < 7) return null;
  return `+${digits}`;
}

/** Polls the live WhatsApp connection status — shared by the connect widget and the Help page. */
export function useWhatsAppStatus(intervalMs = 3000) {
  const [status, setStatus] = useState<WaStatus>({ status: 'disconnected' });

  const poll = useCallback(async () => {
    try {
      const r = await fetch(`${BACKEND}/api/whatsapp/status`, { cache: 'no-store' });
      if (r.ok) setStatus(await r.json());
    } catch {
      setStatus({ status: 'disconnected' });
    }
  }, []);

  useEffect(() => {
    poll();
    const iv = setInterval(poll, intervalMs);
    return () => clearInterval(iv);
  }, [poll, intervalMs]);

  return { status, refresh: poll };
}
