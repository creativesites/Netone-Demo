import type { Node, Edge } from '@xyflow/react';
import {
  User,
  Users,
  MessageCircle,
  Cpu,
  Brain,
  Scale,
  Bot,
  Database,
  Link2,
  LayoutDashboard,
  Sparkles,
  Gauge,
  SlidersHorizontal,
  Target,
  type LucideIcon,
} from 'lucide-react';

export type NodeKind = 'actor' | 'external' | 'focus' | 'container' | 'component';

export interface EntityData extends Record<string, unknown> {
  label: string;
  sub?: string;
  desc: string;
  kind: NodeKind;
  Icon: LucideIcon;
  live?: boolean;
  target?: LevelId; // drill-down destination
}

export type LevelId = 'context' | 'container' | 'ai' | 'rules';

export interface Level {
  id: LevelId;
  title: string;
  crumb: string;
  parent?: LevelId;
  nodes: Node<EntityData>[];
  edges: Edge[];
}

const edgeBase = {
  type: 'smoothstep' as const,
  style: { stroke: '#c9c9cd', strokeWidth: 1.5 },
  labelStyle: { fill: '#6e6e73', fontSize: 11, fontWeight: 600 },
  labelBgStyle: { fill: '#f5f5f7', fillOpacity: 0.9 },
};
const flowEdge = { ...edgeBase, style: { stroke: '#a6242e', strokeWidth: 1.75 }, animated: true };
const ghostEdge = { ...edgeBase, style: { stroke: '#c9c9cd', strokeWidth: 1.25, strokeDasharray: '4 4' } };

export const LEVELS: Record<LevelId, Level> = {
  context: {
    id: 'context',
    title: 'System Context',
    crumb: 'System Context',
    nodes: [
      {
        id: 'customer',
        type: 'entity',
        position: { x: 0, y: 140 },
        data: {
          label: 'Customer',
          sub: 'Person',
          desc: 'Sees a NetOne ad or has a question, and reaches out on a channel they already use — no new app to install.',
          kind: 'actor',
          Icon: User,
        },
      },
      {
        id: 'platform',
        type: 'entity',
        position: { x: 300, y: 110 },
        data: {
          label: 'NetOne Lead Intelligence Platform',
          sub: 'Software System — in focus',
          desc: 'Reads, qualifies and routes every enquiry automatically. Click to see what’s inside.',
          kind: 'focus',
          Icon: Sparkles,
          target: 'container',
        },
      },
      {
        id: 'bitrix',
        type: 'entity',
        position: { x: 660, y: 0 },
        data: {
          label: 'Bitrix24 CRM',
          sub: 'External System',
          desc: 'NetOne’s existing system of record for leads and pipeline. This platform doesn’t replace it — it feeds it better, pre-qualified data.',
          kind: 'external',
          Icon: Database,
        },
      },
      {
        id: 'sales',
        type: 'entity',
        position: { x: 660, y: 260 },
        data: {
          label: 'Sales & Management',
          sub: 'Person',
          desc: 'Reps get a ready-to-call lead with full context already captured; management gets live visibility into enquiries and outcomes.',
          kind: 'actor',
          Icon: Users,
        },
      },
    ],
    edges: [
      { id: 'e-cust-platform', source: 'customer', target: 'platform', label: 'WhatsApp message', ...flowEdge },
      { id: 'e-platform-bitrix', source: 'platform', target: 'bitrix', label: 'creates / enriches lead', ...flowEdge },
      { id: 'e-platform-sales', source: 'platform', target: 'sales', label: 'live dashboard', ...flowEdge },
      { id: 'e-bitrix-sales', source: 'bitrix', target: 'sales', label: 'assigned lead (existing workflow)', ...ghostEdge },
    ],
  },

  container: {
    id: 'container',
    title: 'Platform Internals',
    crumb: 'Platform Internals',
    parent: 'context',
    nodes: [
      {
        id: 'channels',
        type: 'entity',
        position: { x: 0, y: 160 },
        data: {
          label: 'Channel Adapters',
          sub: 'Container',
          desc: 'Normalizes every channel into one lead format. WhatsApp is live; Facebook, Instagram & Website adapters follow the same contract — no new business logic needed.',
          kind: 'container',
          Icon: MessageCircle,
          live: true,
        },
      },
      {
        id: 'engine',
        type: 'entity',
        position: { x: 280, y: 160 },
        data: {
          label: 'Lead Engine',
          sub: 'Container — Fastify',
          desc: 'Orchestrates the pipeline: dedupes messages, persists state, publishes real-time events to the dashboard.',
          kind: 'container',
          Icon: Cpu,
          live: true,
        },
      },
      {
        id: 'ai',
        type: 'entity',
        position: { x: 560, y: 20 },
        data: {
          label: 'AI Qualification Engine',
          sub: 'Container',
          desc: 'Reads the conversation and extracts intent, product, financing and urgency. Click to see the model cascade.',
          kind: 'container',
          Icon: Brain,
          live: true,
          target: 'ai',
        },
      },
      {
        id: 'rules',
        type: 'entity',
        position: { x: 860, y: 20 },
        data: {
          label: 'Rules & Scoring Engine',
          sub: 'Container',
          desc: 'Deterministic and configurable — the AI describes, this decides. Click to see how the score is built.',
          kind: 'container',
          Icon: Scale,
          live: true,
          target: 'rules',
        },
      },
      {
        id: 'agent',
        type: 'entity',
        position: { x: 280, y: 320 },
        data: {
          label: 'Conversational Agent "Nia"',
          sub: 'Container',
          desc: 'Collects any missing profile fields over WhatsApp, one question at a time, until the lead is complete.',
          kind: 'container',
          Icon: Bot,
          live: true,
        },
      },
      {
        id: 'db',
        type: 'entity',
        position: { x: 560, y: 320 },
        data: {
          label: 'Postgres',
          sub: 'Container — Database',
          desc: 'Source of truth: leads, conversations, events, and the configurable qualification rules.',
          kind: 'container',
          Icon: Database,
          live: true,
        },
      },
      {
        id: 'sync',
        type: 'entity',
        position: { x: 860, y: 320 },
        data: {
          label: 'Bitrix24 Sync',
          sub: 'Container',
          desc: 'REST webhook integration with retry + backoff. Creates the lead on first contact, enriches it once the profile is complete.',
          kind: 'container',
          Icon: Link2,
          live: true,
        },
      },
      {
        id: 'dashboard',
        type: 'entity',
        position: { x: 0, y: 320 },
        data: {
          label: 'Real-time Dashboard',
          sub: 'Container — Next.js',
          desc: 'Firestore-mirrored live view for management and sales — activity, scores and CRM status as they happen.',
          kind: 'container',
          Icon: LayoutDashboard,
          live: true,
        },
      },
      {
        id: 'bitrix-ext',
        type: 'entity',
        position: { x: 1140, y: 320 },
        data: {
          label: 'Bitrix24 CRM',
          sub: 'External System',
          desc: 'NetOne’s existing system of record — this platform writes to it, not around it.',
          kind: 'external',
          Icon: Database,
        },
      },
    ],
    edges: [
      { id: 'e-ch-en', source: 'channels', target: 'engine', ...flowEdge },
      { id: 'e-en-ai', source: 'engine', target: 'ai', ...flowEdge },
      { id: 'e-ai-rules', source: 'ai', target: 'rules', ...flowEdge },
      { id: 'e-rules-db', source: 'rules', target: 'db', ...flowEdge },
      { id: 'e-rules-sync', source: 'rules', target: 'sync', ...flowEdge },
      { id: 'e-sync-bitrix', source: 'sync', target: 'bitrix-ext', label: 'crm.lead.add', ...flowEdge },
      { id: 'e-en-agent', source: 'engine', target: 'agent', ...flowEdge },
      { id: 'e-agent-ch', source: 'agent', target: 'channels', label: 'reply', ...ghostEdge },
      { id: 'e-db-dash', source: 'db', target: 'dashboard', ...ghostEdge },
    ],
  },

  ai: {
    id: 'ai',
    title: 'AI Qualification Engine',
    crumb: 'AI Qualification Engine',
    parent: 'container',
    nodes: [
      {
        id: 'deepseek',
        type: 'entity',
        position: { x: 0, y: 80 },
        data: {
          label: 'DeepSeek',
          sub: 'Component — primary model',
          desc: 'Fast, cost-effective classification and conversation generation. Tried first on every message.',
          kind: 'component',
          Icon: Sparkles,
          live: true,
        },
      },
      {
        id: 'gemini',
        type: 'entity',
        position: { x: 280, y: 80 },
        data: {
          label: 'Gemini',
          sub: 'Component — automatic fallback',
          desc: 'Used automatically if DeepSeek errors or times out — the customer never sees the failure.',
          kind: 'component',
          Icon: Brain,
          live: true,
        },
      },
      {
        id: 'deterministic',
        type: 'entity',
        position: { x: 560, y: 80 },
        data: {
          label: 'Deterministic Rules',
          sub: 'Component — last resort',
          desc: 'Keyword-based classifier with zero external dependency. The pipeline never goes down because an AI vendor does.',
          kind: 'component',
          Icon: Scale,
          live: true,
        },
      },
      {
        id: 'output',
        type: 'entity',
        position: { x: 280, y: 260 },
        data: {
          label: 'Structured Lead Analysis',
          sub: 'Output — validated JSON',
          desc: 'intent, product, financing interest, purchase intent, one-line reasoning — schema-validated before use, then handed to the Rules & Scoring Engine.',
          kind: 'component',
          Icon: Target,
        },
      },
    ],
    edges: [
      { id: 'e-ds-gm', source: 'deepseek', target: 'gemini', label: 'on failure', ...ghostEdge },
      { id: 'e-gm-dt', source: 'gemini', target: 'deterministic', label: 'on failure', ...ghostEdge },
      { id: 'e-ds-out', source: 'deepseek', target: 'output', ...flowEdge },
      { id: 'e-gm-out', source: 'gemini', target: 'output', ...flowEdge },
      { id: 'e-dt-out', source: 'deterministic', target: 'output', ...flowEdge },
    ],
  },

  rules: {
    id: 'rules',
    title: 'Rules & Scoring Engine',
    crumb: 'Rules & Scoring Engine',
    parent: 'container',
    nodes: [
      {
        id: 'criteria',
        type: 'entity',
        position: { x: 0, y: 80 },
        data: {
          label: 'Weighted Criteria',
          sub: 'Component',
          desc: 'Purchase intent, product, financing, location, contact info, employment, budget — each with a configurable weight.',
          kind: 'component',
          Icon: SlidersHorizontal,
          live: true,
        },
      },
      {
        id: 'score',
        type: 'entity',
        position: { x: 280, y: 80 },
        data: {
          label: '0–100 Score',
          sub: 'Component',
          desc: 'Normalized against total configured weight. Recomputed after every conversational turn, so it visibly climbs as details are collected.',
          kind: 'component',
          Icon: Gauge,
          live: true,
        },
      },
      {
        id: 'thresholds',
        type: 'entity',
        position: { x: 560, y: 80 },
        data: {
          label: 'Configurable Thresholds',
          sub: 'Component',
          desc: 'Qualified / Needs follow-up / Unqualified cutoffs — tuned to NetOne’s own process, not hard-coded in application logic.',
          kind: 'component',
          Icon: Scale,
          live: true,
        },
      },
      {
        id: 'tier',
        type: 'entity',
        position: { x: 840, y: 80 },
        data: {
          label: 'Tier + Routing',
          sub: 'Output',
          desc: 'Drives the Bitrix24 lead status, team assignment (Financing Desk / Customer Care / Sales) and the recommended next action.',
          kind: 'component',
          Icon: Target,
        },
      },
    ],
    edges: [
      { id: 'e-crit-score', source: 'criteria', target: 'score', ...flowEdge },
      { id: 'e-score-thr', source: 'score', target: 'thresholds', ...flowEdge },
      { id: 'e-thr-tier', source: 'thresholds', target: 'tier', ...flowEdge },
    ],
  },
};
