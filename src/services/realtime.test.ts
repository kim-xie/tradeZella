import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { realtimeManager, useRealtimeTrades, REALTIME_EVENT_NAME } from './realtime';

describe('Realtime Trade Push Service', () => {
  let mockEventSourceInstances: any[] = [];

  beforeEach(() => {
    mockEventSourceInstances = [];
    localStorage.setItem('token', 'fake-jwt-token');

    // Mock global EventSource
    (global as any).EventSource = vi.fn().mockImplementation(function (url: string) {
      const listeners: Record<string, ((e: any) => void)[]> = {};
      const instance = {
        url,
        readyState: 1, // OPEN
        addEventListener: vi.fn((event: string, cb: (e: any) => void) => {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(cb);
        }),
        removeEventListener: vi.fn(),
        close: vi.fn(),
        // Helper to simulate incoming event in test
        __emit: (event: string, data: any) => {
          if (listeners[event]) {
            listeners[event].forEach(cb => cb({ data: JSON.stringify(data) }));
          }
        },
      };
      mockEventSourceInstances.push(instance);
      // Simulate connected handshake
      setTimeout(() => {
        instance.__emit('connected', { status: 'connected' });
      }, 0);
      return instance;
    });
  });

  afterEach(() => {
    realtimeManager.disconnect();
    vi.restoreAllMocks();
  });

  it('connects to SSE stream with auth token query param', async () => {
    realtimeManager.ensureConnection();

    expect(global.EventSource).toHaveBeenCalledWith(
      expect.stringContaining('/trades/stream?token=fake-jwt-token')
    );
  });

  it('notifies subscribers and dispatches window event when trades:updated event is received', async () => {
    const subscriber = vi.fn();
    const windowEventSpy = vi.fn();
    window.addEventListener(REALTIME_EVENT_NAME, windowEventSpy);

    const unsubscribe = realtimeManager.subscribe(subscriber);

    expect(mockEventSourceInstances.length).toBeGreaterThan(0);
    const es = mockEventSourceInstances[0];

    const mockPayload = {
      event: 'trades:updated' as const,
      action: 'ea_sync' as const,
      count: 3,
      source: 'MQL EA 自动直推',
      timestamp: Date.now(),
      message: 'EA 成功直推同步 3 笔新交易！',
    };

    act(() => {
      es.__emit('trades:updated', mockPayload);
    });

    expect(subscriber).toHaveBeenCalledWith(expect.objectContaining({
      event: 'trades:updated',
      action: 'ea_sync',
      count: 3,
    }));

    expect(windowEventSpy).toHaveBeenCalled();
    const customEvent = windowEventSpy.mock.calls[0][0] as CustomEvent;
    expect(customEvent.detail.count).toBe(3);

    unsubscribe();
    window.removeEventListener(REALTIME_EVENT_NAME, windowEventSpy);
  });

  it('useRealtimeTrades hook triggers callback when realtime updates arrive', async () => {
    const onUpdate = vi.fn();
    const { result } = renderHook(() => useRealtimeTrades(onUpdate));

    expect(mockEventSourceInstances.length).toBeGreaterThan(0);
    const es = mockEventSourceInstances[0];

    const mockPayload = {
      event: 'trades:updated' as const,
      action: 'create' as const,
      count: 1,
      source: '手动记账',
      timestamp: Date.now(),
    };

    act(() => {
      es.__emit('trades:updated', mockPayload);
    });

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      event: 'trades:updated',
      count: 1,
    }));
    expect(result.current.lastEvent?.count).toBe(1);
  });
});
