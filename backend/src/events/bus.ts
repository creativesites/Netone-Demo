/**
 * In-process pub/sub for Server-Sent Events. The dashboard subscribes once and
 * receives every pipeline step, lead snapshot, and integration-status change in
 * real time. Kept intentionally simple (single-process) — perfect for the demo.
 */
import { EventEmitter } from 'node:events';

export type SsePayload =
  | { type: 'hello'; data: unknown }
  | { type: 'pipeline'; data: unknown }
  | { type: 'lead'; data: unknown }
  | { type: 'status'; data: unknown }
  | { type: 'metrics'; data: unknown };

class EventBus extends EventEmitter {
  publish(payload: SsePayload) {
    this.emit('sse', payload);
  }
  subscribe(listener: (payload: SsePayload) => void) {
    this.on('sse', listener);
    return () => this.off('sse', listener);
  }
}

export const bus = new EventBus();
bus.setMaxListeners(100);
