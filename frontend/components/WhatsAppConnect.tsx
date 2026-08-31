'use client';

import { useEffect, useRef, useState } from 'react';
import { X, QrCode, Smartphone, Copy, Check, RefreshCw, LogOut, AlertTriangle } from 'lucide-react';
import { useWhatsAppStatus, displayWaNumber as displayNumber, type WaStatus } from '@/lib/useWhatsAppStatus';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4702';

function tone(status?: string) {
  if (status === 'connected') return { dot: 'bg-emerald-500', text: 'text-emerald-600', label: 'Connected', pulse: true };
  if (status === 'connecting') return { dot: 'bg-amber-500', text: 'text-amber-600', label: 'Connecting…', pulse: true };
  return { dot: 'bg-rose-500', text: 'text-rose-600', label: 'Disconnected', pulse: false };
}

export function WhatsAppConnect() {
  const { status, refresh: poll } = useWhatsAppStatus();
  const [open, setOpen] = useState(false);

  // Auto-close the modal once linked.
  useEffect(() => {
    if (status.status === 'connected' && open) {
      const t = setTimeout(() => setOpen(false), 1500);
      return () => clearTimeout(t);
    }
  }, [status.status, open]);

  const t = tone(status.status);
  const number = displayNumber(status.user);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={number ? `Text this number to run the live demo: ${number}` : undefined}
        className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-3 py-2 transition-colors hover:bg-surface-muted"
      >
        {/* <span className="relative flex h-2.5 w-2.5">
          {t.pulse && <span className={`absolute inline-flex h-full w-full rounded-full ${t.dot} opacity-50 animate-pulse-ring`} />}
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${t.dot}`} />
        </span> */}
        <span className="relative flex h-2.5 w-2.5">
          {t.pulse && <span className={`absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-50 animate-pulse-ring`} />}
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500`} />
        </span>
        <div className="text-left leading-tight">
          <div className="text-[10px] uppercase tracking-wide text-ink-400">WhatsApp</div>
          <div className={`text-xs font-semibold text-emerald-600`}>
            {/* {status.status === 'connected' && number ? number : t.label} */}
            {/* {number} */}
            0762 368 105
          </div>
        </div>
        {/* {status.status !== 'connected' && (
          <span className="ml-1 rounded-lg bg-brand-500 px-2 py-0.5 text-[11px] font-semibold text-white">Connect</span>
        )} */}
        
        
      </button>

      {open && <ConnectModal status={status} onClose={() => setOpen(false)} onChanged={poll} />}
    </>
  );
}

function ConnectModal({
  status,
  onClose,
  onChanged,
}: {
  status: WaStatus;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<'qr' | 'code'>('qr');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [qrBust, setQrBust] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  const startedQr = useRef(false);

  // const connected = status.status === 'connected';
  const connected = true;

  // Kick off a QR session when the QR tab opens (once).
  useEffect(() => {
    if (tab === 'qr' && !connected && !startedQr.current) {
      startedQr.current = true;
      fetch(`${BACKEND}/api/whatsapp/connect/qr`, { method: 'POST' }).then(onChanged).catch(() => {});
    }
  }, [tab, connected, onChanged]);

  // Refresh the QR image periodically while on the QR tab.
  useEffect(() => {
    if (tab !== 'qr' || connected) return;
    const iv = setInterval(() => setQrBust(Date.now()), 4000);
    return () => clearInterval(iv);
  }, [tab, connected]);

  const [requestedPhone, setRequestedPhone] = useState('');
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function disconnect() {
    setLoggingOut(true);
    try {
      await fetch(`${BACKEND}/api/whatsapp/logout`, { method: 'POST' });
      setConfirmingLogout(false);
      onChanged();
    } finally {
      setLoggingOut(false);
    }
  }

  async function requestCode() {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7) return;
    setBusy(true);
    try {
      await fetch(`${BACKEND}/api/whatsapp/connect/code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: digits }),
      });
      setRequestedPhone(digits);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  function tryAgain() {
    setRequestedPhone('');
  }

  function copyCode() {
    if (!status.pairingCode) return;
    navigator.clipboard?.writeText(status.pairingCode.replace('-', ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md overflow-hidden rounded-3xl border border-line bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Smartphone size={16} />
            </span>
            <div>
              <div className="text-sm font-semibold text-ink-900">Connect WhatsApp</div>
              <div className="text-[11px] text-ink-500">Link the demo phone to go live</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-ink-400 hover:bg-surface-muted">
            <X size={18} />
          </button>
        </div>

        {connected ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Check size={28} />
            </span>
            <div className="text-base font-semibold text-ink-900">WhatsApp linked</div>
            {/* <div className="text-sm text-ink-500">{displayNumber(status.user) ?? 'Device connected'}</div> */}
             <div className="text-sm text-ink-500">0762 368 105</div>
            {!confirmingLogout ? (
              <button
                onClick={() => setConfirmingLogout(true)}
                className="mt-3 flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-xs font-medium text-ink-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
              >
                <LogOut size={13} /> Disconnect this number
              </button>
            ) : (
              <div className="mt-3 w-full rounded-xl border border-rose-200 bg-rose-50 p-3 text-left">
                <div className="flex items-start gap-2 text-[12px] text-rose-700">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>
                    This unlinks the current number and clears the session. Anyone with this dashboard can
                    then connect their own WhatsApp to run the demo.
                  </span>
                </div>
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    onClick={() => setConfirmingLogout(false)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-500 hover:bg-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={disconnect}
                    disabled={loggingOut}
                    className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                  >
                    {loggingOut ? 'Disconnecting…' : 'Yes, disconnect'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex gap-1 px-6 pt-4">
              {(['qr', 'code'] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    tab === k ? 'bg-surface-muted text-ink-900' : 'text-ink-500 hover:bg-surface-muted/60'
                  }`}
                >
                  {k === 'qr' ? <QrCode size={15} /> : <Smartphone size={15} />}
                  {k === 'qr' ? 'Scan QR' : 'Link with code'}
                </button>
              ))}
            </div>

            {tab === 'qr' ? (
              <div className="flex flex-col items-center gap-3 px-4 py-6 sm:px-6">
                <div className="rounded-2xl border border-line bg-white p-2.5 sm:p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`${BACKEND}/api/whatsapp/qr?t=${qrBust}`}
                    alt="WhatsApp QR"
                    width={240}
                    height={240}
                    className="h-48 w-48 sm:h-60 sm:w-60"
                  />
                </div>
                <ol className="w-full space-y-1 text-[13px] text-ink-500">
                  <li>1. Open WhatsApp on the demo phone</li>
                  <li>2. Tap <span className="font-medium text-ink-900">Linked devices → Link a device</span></li>
                  <li>3. Scan this code</li>
                </ol>
                <button
                  onClick={() => setQrBust(Date.now())}
                  className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-500"
                >
                  <RefreshCw size={12} /> Refresh QR
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 px-4 py-6 sm:px-6">
                {status.pairingCode ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="text-[13px] text-ink-500">Enter this code on your phone</div>
                    <button
                      onClick={copyCode}
                      className="group flex items-center gap-3 rounded-2xl border border-line bg-surface-muted px-6 py-4"
                    >
                      <span className="font-mono text-3xl font-semibold tracking-[0.2em] text-ink-900">
                        {status.pairingCode}
                      </span>
                      <span className="text-ink-400 group-hover:text-ink-700">
                        {copied ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                      </span>
                    </button>
                    <ol className="w-full space-y-1 text-[13px] text-ink-500">
                      <li>1. Open WhatsApp → <span className="font-medium text-ink-900">Linked devices</span></li>
                      <li>2. Tap <span className="font-medium text-ink-900">Link with phone number instead</span></li>
                      <li>3. Enter the code above</li>
                    </ol>
                    <div className="flex items-center gap-1.5 text-[11px] text-ink-400">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                      Waiting for confirmation on your phone
                      {typeof status.pairingElapsedMs === 'number' && status.pairingElapsedMs > 0
                        ? ` · ${Math.round(status.pairingElapsedMs / 1000)}s`
                        : ''}
                    </div>
                    {status.pairingError && (
                      <div className="w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
                        Code request failed: {status.pairingError}. Retrying automatically — or{' '}
                        <button onClick={tryAgain} className="font-semibold underline">
                          start over
                        </button>
                        .
                      </div>
                    )}
                  </div>
                ) : requestedPhone ? (
                  <div className="flex flex-col items-center gap-3 py-4 text-center">
                    <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                    <div className="text-[13px] text-ink-500">Generating pairing code…</div>
                    {status.pairingError && (
                      <div className="w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
                        {status.pairingError} —{' '}
                        <button onClick={tryAgain} className="font-semibold underline">
                          try again
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <label className="text-[13px] font-medium text-ink-700">Phone number (with country code)</label>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+260 97 000 0000"
                      className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-500"
                    />
                    <button
                      onClick={requestCode}
                      disabled={busy || phone.replace(/\D/g, '').length < 7}
                      className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-40"
                    >
                      {busy ? 'Requesting…' : 'Get pairing code'}
                    </button>
                    <p className="text-[11px] text-ink-400">
                      We&apos;ll generate an 8-character code to enter on the phone — no QR scan needed.
                    </p>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
