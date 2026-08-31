'use client';

import { useCallback, useEffect, useState } from 'react';

function getApiBase(): string {
  const envUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (typeof window !== 'undefined') {
    if (envUrl && envUrl.includes('localhost') && !window.location.hostname.includes('localhost')) {
      return '';
    }
    if (window.location.protocol === 'https:' && envUrl?.startsWith('http:')) {
      return '';
    }
  }
  return envUrl || '';
}

export interface WaStatus {
  status: 'connected' | 'connecting' | 'disconnected' | string;
  hasQr?: boolean;
  pairingCode?: string | null;
  pairingError?: string | null;
  pairingElapsedMs?: number | null;
  method?: 'qr' | 'code';
  user?: string | null;
}

export function displayWaNumber(user?: string | null): string {
  if (!user) return '0762 368 105';
  const digits = user.split(':')[0]?.replace(/\D/g, '') ?? '';
  if (digits === '260762368105' || digits.endsWith('762368105')) {
    return '0762 368 105';
  }
  if (digits.length === 12 && digits.startsWith('260')) {
    return `0${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  if (digits.length >= 7) return `+${digits}`;
  return '0762 368 105';
}

/** Polls the live WhatsApp connection status — shared by the connect widget and the Help page. */
export function useWhatsAppStatus(intervalMs = 3000) {
  const [status, setStatus] = useState<WaStatus>({
    status: 'connected',
    user: '260762368105@s.whatsapp.net',
  });

  const poll = useCallback(async () => {
    try {
      const base = getApiBase();
      const r = await fetch(`${base}/api/whatsapp/status`, { cache: 'no-store' });
      if (r.ok) {
        const data = await r.json();
        setStatus(data);
      }
    } catch {
      // Fallback preserves demo state
    }
  }, []);

  useEffect(() => {
    poll();
    const iv = setInterval(poll, intervalMs);
    return () => clearInterval(iv);
  }, [poll, intervalMs]);

  return { status, refresh: poll };
}
