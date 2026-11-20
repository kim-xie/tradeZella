import { useEffect, useState, useRef, useCallback } from 'react';
import { API_BASE_URL } from './api';

export interface RealtimeTradeEvent {
  event: 'trades:updated';
  action?: 'create' | 'update' | 'delete' | 'delete_all' | 'upload' | 'ea_sync' | 'mt5_sync' | 'bulk_create';
  source?: string;
  platform?: string;
  count?: number;
  skippedCount?: number;
  message?: string;
  timestamp: number;
  trades?: any[];
  tradeId?: string | number;
}

export const REALTIME_EVENT_NAME = 'tradezen:trades-updated';

class RealtimeManager {
  private eventSource: EventSource | null = null;
  private reconnectTimer: any = null;
  private isConnecting: boolean = false;
  private subscribers: Set<(data: RealtimeTradeEvent) => void> = new Set();
  private statusListeners: Set<(connected: boolean) => void> = new Set();
  private connected: boolean = false;

  public isConnected(): boolean {
    return this.connected;
  }

  public subscribeStatus(listener: (connected: boolean) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.connected);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private setConnected(status: boolean) {
    if (this.connected !== status) {
      this.connected = status;
      this.statusListeners.forEach(fn => fn(status));
    }
  }

  public subscribe(callback: (data: RealtimeTradeEvent) => void): () => void {
    this.subscribers.add(callback);
    this.ensureConnection();
    return () => {
      this.subscribers.delete(callback);
      if (this.subscribers.size === 0) {
        // Optional: Keep connection active or disconnect after delay
      }
    };
  }

  public ensureConnection() {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('token');
    if (!token) {
      this.disconnect();
      return;
    }

    if (this.eventSource && this.eventSource.readyState === EventSource.OPEN) {
      return;
    }

    if (this.isConnecting) return;
    this.connect(token);
  }

  private connect(token: string) {
    if (typeof window === 'undefined') return;
    this.disconnect();

    this.isConnecting = true;
    const url = `${API_BASE_URL}/trades/stream?token=${encodeURIComponent(token)}`;

    try {
      const es = new EventSource(url);
      this.eventSource = es;

      es.addEventListener('connected', () => {
        this.isConnecting = false;
        this.setConnected(true);
      });

      es.addEventListener('trades:updated', (e: MessageEvent) => {
        try {
          const data: RealtimeTradeEvent = JSON.parse(e.data);
          this.notifySubscribers(data);
        } catch (err) {
          console.warn('Failed to parse realtime trade SSE payload:', err);
        }
      });

      es.onerror = () => {
        this.isConnecting = false;
        this.setConnected(false);
        this.disconnect();
        // Exponential/staggered reconnect attempt
        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.ensureConnection();
          }, 3000);
        }
      };
    } catch (err) {
      this.isConnecting = false;
      this.setConnected(false);
    }
  }

  public disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch {}
      this.eventSource = null;
    }
    this.isConnecting = false;
    this.setConnected(false);
  }

  private notifySubscribers(data: RealtimeTradeEvent) {
    // 1. Dispatch custom window event so any non-React code or separate tabs can listen
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(REALTIME_EVENT_NAME, { detail: data }));
    }

    // 2. Call registered listeners
    this.subscribers.forEach(cb => {
      try {
        cb(data);
      } catch (err) {
        console.error('Error in realtime subscriber callback:', err);
      }
    });
  }
}

export const realtimeManager = new RealtimeManager();

/**
 * React Hook for listening to live trade updates
 * Automatically connects when logged in and invokes onUpdate callback when server pushes an order change
 */
export function useRealtimeTrades(onUpdate?: (event: RealtimeTradeEvent) => void) {
  const [isConnected, setIsConnected] = useState<boolean>(realtimeManager.isConnected());
  const [lastEvent, setLastEvent] = useState<RealtimeTradeEvent | null>(null);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    // Status listener
    const unsubStatus = realtimeManager.subscribeStatus(setIsConnected);

    // Event listener
    const unsubEvents = realtimeManager.subscribe((event) => {
      setLastEvent(event);
      if (onUpdateRef.current) {
        onUpdateRef.current(event);
      }
    });

    // Also reconnect when window refocuses or network recovers
    const handleFocus = () => {
      realtimeManager.ensureConnection();
    };
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleFocus);
    window.addEventListener('auth-change', handleFocus);

    return () => {
      unsubStatus();
      unsubEvents();
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleFocus);
      window.removeEventListener('auth-change', handleFocus);
    };
  }, []);

  const triggerManualRefresh = useCallback(() => {
    realtimeManager.ensureConnection();
  }, []);

  return {
    isConnected,
    lastEvent,
    triggerManualRefresh,
  };
}
