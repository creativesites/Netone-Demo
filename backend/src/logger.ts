import pino from 'pino';

// Plain structured logger (no worker-thread transport) — reliable under tsx/Docker.
export const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
