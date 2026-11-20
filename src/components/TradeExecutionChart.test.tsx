import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TradeExecutionChart from './TradeExecutionChart';
import * as api from '../services/api';

vi.mock('../services/api');

// Mock lightweight-charts
vi.mock('lightweight-charts', () => {
  const mockSeries = {
    setData: vi.fn(),
    createPriceLine: vi.fn().mockReturnValue({ applyOptions: vi.fn() }),
    removePriceLine: vi.fn(),
  };

  const mockTimeScale = {
    fitContent: vi.fn(),
    setVisibleLogicalRange: vi.fn(),
  };

  const mockChart = {
    addSeries: vi.fn().mockReturnValue(mockSeries),
    remove: vi.fn(),
    applyOptions: vi.fn(),
    timeScale: vi.fn().mockReturnValue(mockTimeScale),
  };

  return {
    createChart: vi.fn().mockReturnValue(mockChart),
    CandlestickSeries: {},
    createSeriesMarkers: vi.fn().mockReturnValue({ setMarkers: vi.fn() }),
    ColorType: { Solid: 'solid' },
    LineStyle: { Solid: 0, Dotted: 1, Dashed: 2, LargeDashed: 3, SparseDotted: 4 },
  };
});

describe('TradeExecutionChart - Replay & Timeframe', () => {
  const mockCandles = [
    { time: '2026-03-01 10:00', open: 1.08, high: 1.085, low: 1.078, close: 1.083, volume: 500 },
    { time: '2026-03-01 10:05', open: 1.083, high: 1.088, low: 1.081, close: 1.086, volume: 600 },
  ];

  beforeEach(() => {
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;
    vi.clearAllMocks();
    vi.spyOn(api, 'fetchCandles').mockResolvedValue({
      success: true,
      symbol: 'EURUSD',
      timeframe: 'M5',
      contractSize: 100000,
      dataSource: 'Synthetic',
      count: mockCandles.length,
      candles: mockCandles,
    });
  });

  it('defaults to 5m (M5) timeframe for K-line trade replay', async () => {
    const fetchSpy = vi.spyOn(api, 'fetchCandles');

    render(
      <TradeExecutionChart
        symbol="EURUSD"
        direction="long"
        entryPrice={1.081}
        exitPrice={1.085}
        entryTime="2026-03-01T10:00:00Z"
        exitTime="2026-03-01T10:05:00Z"
      />
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'EURUSD',
          timeframe: 'M5',
        })
      );
    });

    // Check M5 button is rendered and has active styling
    const m5Button = screen.getByRole('button', { name: 'M5' });
    expect(m5Button).toBeInTheDocument();
    expect(m5Button.className).toContain('bg-gray-900');
  });

  it('allows switching timeframe to other intervals', async () => {
    const fetchSpy = vi.spyOn(api, 'fetchCandles');

    render(
      <TradeExecutionChart
        symbol="EURUSD"
        direction="long"
        entryPrice={1.081}
        exitPrice={1.085}
      />
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          timeframe: 'M5',
        })
      );
    });

    const h1Button = screen.getByRole('button', { name: 'H1' });
    fireEvent.click(h1Button);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          timeframe: 'H1',
        })
      );
    });

    // Check M1 (1-minute) button exists and allows switching to M1
    const m1Button = screen.getByRole('button', { name: 'M1' });
    expect(m1Button).toBeInTheDocument();
    fireEvent.click(m1Button);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          timeframe: 'M1',
        })
      );
    });
  });

  it('calculates generous pre-entry candle window (at least 120 bars before entry)', async () => {
    const fetchSpy = vi.spyOn(api, 'fetchCandles');

    render(
      <TradeExecutionChart
        symbol="EURUSD"
        direction="long"
        entryPrice={1.081}
        exitPrice={1.085}
        entryTime="2026-11-20T10:00:00"
        exitTime="2026-11-20T10:30:00"
        initialTimeframe="M1"
      />
    );

    // For M1 (1-minute): 120 bars = 120 minutes = 2 hours before 10:00:00 -> 08:00:00
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          timeframe: 'M1',
          start: expect.stringMatching(/2026-11-20 08:00/),
        })
      );
    });
  });

  it('respects custom initialTimeframe prop when provided', async () => {
    const fetchSpy = vi.spyOn(api, 'fetchCandles');

    render(
      <TradeExecutionChart
        symbol="EURUSD"
        direction="long"
        entryPrice={1.081}
        exitPrice={1.085}
        initialTimeframe="M15"
      />
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          timeframe: 'M15',
        })
      );
    });

    const m15Button = screen.getByRole('button', { name: 'M15' });
    expect(m15Button.className).toContain('bg-gray-900');
  });

  it('safely renders without throwing when direction or symbol is undefined or non-standard', async () => {
    // Should render gracefully without unhandled TypeError
    render(
      <TradeExecutionChart
        symbol={undefined as any}
        direction={undefined as any}
        entryPrice={0}
        exitPrice={undefined}
        entryTime="invalid-date"
        exitTime="invalid-date"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('EURUSD')).toBeInTheDocument();
    });
  });

  it('normalizes localized symbols and centers time window around trade entry/exit', async () => {
    const fetchSpy = vi.spyOn(api, 'fetchCandles');

    render(
      <TradeExecutionChart
        symbol="美国原油 - 现货."
        direction="sell"
        entryPrice={69.5}
        exitPrice={68.8}
        entryTime="2026-11-17 18:48:00"
        exitTime="2026-11-18 01:13:00"
      />
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'USOIL',
          timeframe: 'M5',
          price: 69.5,
          start: expect.stringContaining('2026-11-17'),
          end: expect.stringContaining('2026-11-18'),
        })
      );
    });
  });
});
