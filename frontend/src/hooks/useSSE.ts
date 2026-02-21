import { useEffect, useRef, useState, useCallback } from 'react';
import type { EventData } from '../lib/api';

const MAX_EVENTS = 100;

export function useSSE(url: string) {
  const [events, setEvents] = useState<EventData[]>([]);
  const [connected, setConnected] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.close();
    }

    const source = new EventSource(url);
    sourceRef.current = source;

    source.onopen = () => setConnected(true);

    source.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'heartbeat') return;
        setEvents((prev) => [data, ...prev].slice(0, MAX_EVENTS));
      } catch {
        // ignore parse errors
      }
    };

    source.onerror = () => {
      setConnected(false);
      source.close();
      setTimeout(connect, 3000);
    };
  }, [url]);

  useEffect(() => {
    connect();
    return () => {
      sourceRef.current?.close();
    };
  }, [connect]);

  return { events, connected };
}
