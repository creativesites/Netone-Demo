'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  ActiveEvent,
  IntegrationStatus,
  Lead,
  LeadEvent,
  Metrics,
  PipelineStep,
} from './types';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4702';

interface StreamState {
  connected: boolean;
  status: IntegrationStatus | null;
  metrics: Metrics | null;
  recent: Lead[];
  active: ActiveEvent | null;
  currentLead: Lead | null;
  currentEvents: LeadEvent[];
}

const initialState: StreamState = {
  connected: false,
  status: null,
  metrics: null,
  recent: [],
  active: null,
  currentLead: null,
  currentEvents: [],
};

export function useLeadStream() {
  const [state, setState] = useState<StreamState>(initialState);
  const esRef = useRef<EventSource | null>(null);

  const handle = useCallback((payload: { type: string; data: any }) => {
    setState((prev) => {
      switch (payload.type) {
        case 'hello':
          return {
            ...prev,
            connected: true,
            status: payload.data.status,
            metrics: payload.data.metrics,
            recent: payload.data.recent ?? [],
          };
        case 'status':
          return { ...prev, status: payload.data };
        case 'metrics':
          return {
            ...prev,
            metrics: payload.data.metrics,
            recent: payload.data.recent ?? prev.recent,
          };
        case 'pipeline': {
          const d = payload.data;
          const step: PipelineStep = d.step;
          // A brand-new incoming event (has contact + message) starts a fresh card.
          if (d.contact && d.message) {
            const active: ActiveEvent = {
              correlationId: d.correlationId,
              channel: d.channel,
              contact: d.contact,
              message: d.message,
              receivedAt: d.receivedAt,
              steps: [step],
            };
            return { ...prev, active };
          }
          // Otherwise append the step to the active card (by correlationId).
          if (prev.active && prev.active.correlationId === d.correlationId) {
            const steps = [...prev.active.steps.filter((s) => s.key !== step.key), step];
            return { ...prev, active: { ...prev.active, steps } };
          }
          return prev;
        }
        case 'lead':
          return {
            ...prev,
            currentLead: payload.data.lead ?? prev.currentLead,
            currentEvents: payload.data.events ?? prev.currentEvents,
          };
        default:
          return prev;
      }
    });
  }, []);

  useEffect(() => {
    const es = new EventSource(`${BACKEND}/api/stream`);
    esRef.current = es;
    es.onmessage = (e) => {
      try {
        handle(JSON.parse(e.data));
      } catch {
        /* ignore heartbeats / malformed frames */
      }
    };
    es.onerror = () => setState((p) => ({ ...p, connected: false }));
    es.onopen = () => setState((p) => ({ ...p, connected: true }));
    return () => es.close();
  }, [handle]);

  return state;
}
