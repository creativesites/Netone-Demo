'use client';

/**
 * Realtime data layer.
 *
 * Primary: Firestore onSnapshot listeners (instant, push-based).
 * Fallback: REST polling against the backend — so the UI still works if the
 * Cloud Firestore API isn't enabled yet. Whichever source has data wins; when
 * Firestore starts delivering snapshots it takes over automatically.
 */
import { useEffect, useRef, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  limit as fsLimit,
} from 'firebase/firestore';
import { getDb, firebaseEnabled } from './firebase';
import { apiBase as getApiBase } from './apiBase';

async function restGet<T>(path: string): Promise<T | null> {
  try {
    const base = getApiBase();
    const res = await fetch(`${base}${path}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Subscribe to a single Firestore doc with a REST fallback. */
export function useRealtimeDoc<T>(
  docPath: string,
  restPath: string,
  mapRest: (r: any) => T | null,
  pollMs = 5000
): T | null {
  const [data, setData] = useState<T | null>(null);
  const gotSnapshot = useRef(false);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    const db = getDb();
    if (firebaseEnabled && db) {
      const [col, id] = docPath.split('/');
      unsub = onSnapshot(
        doc(db, col, id),
        (snap) => {
          if (snap.exists()) {
            gotSnapshot.current = true;
            setData(snap.data() as T);
          }
        },
        () => {
          /* Firestore unavailable — REST polling below carries the UI */
        }
      );
    }
    return () => unsub?.();
  }, [docPath]);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (gotSnapshot.current) return; // Firestore is driving; skip REST
      const r = await restGet<any>(restPath);
      if (alive && r) setData(mapRest(r));
    };
    tick();
    const iv = setInterval(tick, pollMs);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [restPath, pollMs]);

  return data;
}

/** Subscribe to a Firestore collection with a REST fallback. */
export function useRealtimeCollection<T>(
  colPath: string,
  orderField: string,
  restPath: string,
  mapRest: (r: any) => T[],
  pollMs = 4000,
  max = 100
): T[] {
  const [items, setItems] = useState<T[]>([]);
  const gotSnapshot = useRef(false);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    const db = getDb();
    if (firebaseEnabled && db) {
      unsub = onSnapshot(
        query(collection(db, colPath), orderBy(orderField, 'desc'), fsLimit(max)),
        (snap) => {
          // Only let Firestore take over once it actually has data. An EMPTY
          // snapshot (collection absent, or the backend isn't mirroring
          // because its service-account file is missing) previously latched
          // gotSnapshot=true and permanently disabled the REST fallback —
          // blanking the inbox/leads list even though the API was healthy.
          if (snap.empty) return;
          gotSnapshot.current = true;
          setItems(snap.docs.map((d) => d.data() as T));
        },
        () => {
          /* Firestore unavailable — REST polling carries the UI */
        }
      );
    }
    return () => unsub?.();
  }, [colPath, orderField, max]);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (gotSnapshot.current) return;
      const r = await restGet<any>(restPath);
      if (alive && r) setItems(mapRest(r));
    };
    tick();
    const iv = setInterval(tick, pollMs);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [restPath, pollMs]);

  return items;
}

/** Messages for one conversation (subcollection) with REST fallback. */
export function useRealtimeMessages(conversationId: number | null): any[] {
  const [items, setItems] = useState<any[]>([]);
  const gotSnapshot = useRef(false);

  useEffect(() => {
    setItems([]);
    gotSnapshot.current = false;
    if (conversationId == null) return;
    let unsub: (() => void) | undefined;
    const db = getDb();
    if (firebaseEnabled && db) {
      unsub = onSnapshot(
        query(
          collection(db, 'conversations', String(conversationId), 'messages'),
          orderBy('created_at', 'asc'),
          fsLimit(300)
        ),
        (snap) => {
          // Same guard as useRealtimeCollection: an empty mirror must not
          // lock out the REST fallback, or a conversation opens blank.
          if (snap.empty) return;
          gotSnapshot.current = true;
          setItems(snap.docs.map((d) => d.data()));
        },
        () => {}
      );
    }
    return () => unsub?.();
  }, [conversationId]);

  useEffect(() => {
    if (conversationId == null) return;
    let alive = true;
    const tick = async () => {
      if (gotSnapshot.current) return;
      const r = await restGet<{ messages: any[] }>(`/api/conversations/${conversationId}`);
      if (alive && r?.messages) setItems(r.messages);
    };
    tick();
    const iv = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [conversationId]);

  return items;
}

export async function apiPut(path: string, body: unknown) {
  const base = getApiBase();
  return fetch(`${base}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function apiPost(path: string, body: unknown) {
  const base = getApiBase();
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function apiGet(path: string) {
  const base = getApiBase();
  return fetch(`${base}${path}`, { cache: 'no-store' });
}

export async function apiDelete(path: string) {
  const base = getApiBase();
  return fetch(`${base}${path}`, { method: 'DELETE' });
}
