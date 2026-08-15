import type { IntegrationStatus } from '@/lib/types';
import { StatusPill } from './StatusPill';
import { WhatsAppConnect } from './WhatsAppConnect';

export function Header({
  status,
  connected,
}: {
  status: IntegrationStatus | null;
  connected: boolean;
}) {
  const bitrix = status?.bitrix.status === 'connected';
  const aiReal = status?.ai.status === 'connected';

  return (
    <header className="flex flex-col gap-4 pb-6 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">NetOne Lead Intelligence &amp; Marketing Automation</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          Connects every digital channel to Bitrix24 — capture, understand, qualify, assign.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <WhatsAppConnect />
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
