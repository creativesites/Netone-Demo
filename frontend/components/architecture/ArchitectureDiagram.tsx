'use client';

import { useCallback, useState } from 'react';
import { ReactFlow, Background, BackgroundVariant, Controls, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ChevronRight, ChevronLeft, MousePointerClick } from 'lucide-react';
import { LEVELS, type LevelId, type EntityData } from './diagramData';
import { EntityNode } from './EntityNode';

const nodeTypes = { entity: EntityNode };

function LegendItem({ swatchClass, label }: { swatchClass: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-[3px] border ${swatchClass}`} />
      {label}
    </span>
  );
}

export function ArchitectureDiagram() {
  const [path, setPath] = useState<LevelId[]>(['context']);
  const [selected, setSelected] = useState<EntityData | null>(null);
  const levelId = path[path.length - 1];
  const level = LEVELS[levelId];

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    const data = node.data as EntityData;
    setSelected(data);
    if (data.target) setPath((p) => [...p, data.target!]);
  }, []);

  function jumpTo(index: number) {
    setPath((p) => p.slice(0, index + 1));
    setSelected(null);
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">Architecture</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-sm">
            {path.map((id, i) => (
              <span key={id} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={12} className="text-ink-300" />}
                <button
                  onClick={() => jumpTo(i)}
                  className={`rounded px-1.5 py-0.5 font-medium transition-colors ${
                    i === path.length - 1 ? 'text-brand-600' : 'text-ink-400 hover:text-ink-700'
                  }`}
                >
                  {LEVELS[id].crumb}
                </button>
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1 text-[11px] text-ink-400 sm:flex">
            <MousePointerClick size={12} /> Click a box to explore
          </span>
          {path.length > 1 && (
            <button
              onClick={() => jumpTo(path.length - 2)}
              className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-600 transition-colors hover:bg-surface-muted"
            >
              <ChevronLeft size={13} /> Back
            </button>
          )}
        </div>
      </div>

      <div className="relative h-[420px] w-full bg-surface-muted">
        <ReactFlow
          key={levelId}
          nodes={level.nodes}
          edges={level.edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          fitView
          fitViewOptions={{ padding: 0.25 }}
          proOptions={{ hideAttribution: true }}
          minZoom={0.4}
          maxZoom={1.5}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#dcdce0" />
          <Controls showInteractive={false} position="bottom-right" />
        </ReactFlow>
      </div>

      <div className="flex flex-col gap-2 border-t border-line bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-ink-400">
          <LegendItem swatchClass="border-dashed border-ink-300 bg-white" label="Person / external system" />
          <LegendItem swatchClass="border-brand-700 bg-brand-500" label="System in focus" />
          <LegendItem swatchClass="border-brand-500/40 bg-white" label="Container / component" />
        </div>
        <p className="max-w-xl text-[12px] leading-relaxed text-ink-600 sm:text-right">
          {selected ? (
            <>
              <span className="font-semibold text-ink-900">{selected.label}: </span>
              {selected.desc}
            </>
          ) : (
            'Click any box for what it does — click a highlighted one to step inside it.'
          )}
        </p>
      </div>
    </div>
  );
}
