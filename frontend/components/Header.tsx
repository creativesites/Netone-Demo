import type { IntegrationStatus } from '@/lib/types';
import { StatusPill } from './StatusPill';

function waTone(s?: string) {
  if (s === 'connected') return { tone: 'green' as const, value: 'Connected', pulse: true };
  if (s === 'connecting') return { tone: 'amber' as const, value: 'Connecting…', pulse: true };
  return { tone: 'red' as const, value: 'Disconnected', pulse: false };
}

export function Header({
  status,
  connected,
}: {
  status: IntegrationStatus | null;
  connected: boolean;
}) {
  const wa = waTone(status?.whatsapp.status);
  const bitrix = status?.bitrix.status === 'connected';
  const aiReal = status?.ai.status === 'connected';

  return (
    <header className="flex flex-col gap-4 border-b border-white/5 pb-6 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-emerald-500 text-lg font-black text-white shadow-lg shadow-brand-500/20">
          N1
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white">
            NetOne <span className="text-slate-400 font-medium">Lead Automation</span>
          </h1>
          <p className="text-xs text-slate-500">
            Omnichannel Marketing-to-CRM Lead Intelligence · Live Demo
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatusPill label="WhatsApp" value={wa.value} tone={wa.tone} pulse={wa.pulse} />
        <StatusPill
          label="Lead Engine"
          value={connected ? 'Online' : 'Reconnecting'}
          tone={connected ? 'green' : 'amber'}
          pulse={connected}
        />
        <StatusPill
          label="Bitrix24"
          value={bitrix ? 'Connected' : 'Not set'}
          tone={bitrix ? 'green' : 'slate'}
          pulse={bitrix}
        />
        <StatusPill
          label="AI Engine"
          value={aiReal ? (status?.ai.provider ?? 'Online') : 'Fallback'}
          tone={aiReal ? 'green' : 'amber'}
        />
      </div>
    </header>
  );
}
