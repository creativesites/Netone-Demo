'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ChevronRight } from 'lucide-react';
import type { EntityData } from './diagramData';

const KIND_STYLE: Record<EntityData['kind'], string> = {
  actor: 'border-ink-300 border-dashed bg-white text-ink-700',
  external: 'border-ink-300 border-dashed bg-surface-muted text-ink-500',
  focus: 'border-brand-700 bg-brand-500 text-white shadow-md',
  container: 'border-brand-500/40 bg-white text-ink-800',
  component: 'border-line bg-white text-ink-700',
};

const KIND_ICON_STYLE: Record<EntityData['kind'], string> = {
  actor: 'bg-ink-100 text-ink-500',
  external: 'bg-white text-ink-400',
  focus: 'bg-white/15 text-white',
  container: 'bg-brand-50 text-brand-600',
  component: 'bg-surface-muted text-ink-500',
};

export function EntityNode({ data, selected }: NodeProps & { data: EntityData }) {
  const expandable = !!data.target;
  return (
    <div
      className={`w-[210px] rounded-xl border-2 px-3 py-2.5 text-left transition-shadow ${KIND_STYLE[data.kind]} ${
        expandable ? 'cursor-pointer hover:shadow-lg' : 'cursor-default'
      } ${selected ? 'ring-2 ring-brand-500 ring-offset-2' : ''}`}
    >
      <Handle type="target" position={Position.Left} className="!border-none !bg-ink-300" />
      <Handle type="source" position={Position.Right} className="!border-none !bg-ink-300" />
      <div className="flex items-start gap-2">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${KIND_ICON_STYLE[data.kind]}`}>
          <data.Icon size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <div className={`text-[12.5px] font-semibold leading-tight ${data.kind === 'focus' ? 'text-white' : 'text-ink-900'}`}>
            {data.label}
          </div>
          {data.sub && (
            <div className={`mt-0.5 text-[10px] leading-tight ${data.kind === 'focus' ? 'text-white/70' : 'text-ink-400'}`}>
              {data.sub}
            </div>
          )}
        </div>
        {expandable && <ChevronRight size={14} className={data.kind === 'focus' ? 'text-white/70' : 'text-brand-500'} />}
      </div>
      {data.live !== undefined && (
        <span
          className={`mt-2 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
            data.live ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-ink-400'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${data.live ? 'bg-emerald-500' : 'bg-ink-300'}`} />
          {data.live ? 'Live' : 'Roadmap'}
        </span>
      )}
    </div>
  );
}
