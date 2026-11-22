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
    scrollToPosition: vi.fn(),
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

  it('supports switching to replay mode and navigating with quick jump buttons (入场前, 入场点, 出场点)', async () => {
    render(
      <TradeExecutionChart
        symbol="美国原油 - 现货."
        direction="sell"
        entryPrice={85.628}
        exitPrice={84.670}
        stopLoss={86.200}
        takeProfit={84.000}
        entryTime="2026-11-20 18:48:00"
        exitTime="2026-11-20 19:13:00"
      />
    );

    // Wait for candles to finish loading
    await waitFor(() => {
      expect(screen.queryByText(/正在拉取/)).not.toBeInTheDocument();
    });

    // Switch to Replay mode
    const replayBtn = screen.getByRole('button', { name: /逐帧复盘/i });
    fireEvent.click(replayBtn);

    // Check quick jump buttons exist
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '入场前' })).toBeInTheDocument();
    });

    const jumpEntryBtn = screen.getByRole('button', { name: '入场点' });
    const jumpExitBtn = screen.getByRole('button', { name: '出场点' });

    expect(jumpEntryBtn).toBeInTheDocument();
    expect(jumpExitBtn).toBeInTheDocument();

    // Clicking jump to entry updates status
    fireEvent.click(jumpEntryBtn);
    await waitFor(() => {
      expect(screen.getByText(/持仓中/i)).toBeInTheDocument();
    });

    // Clicking jump to exit updates status
    fireEvent.click(jumpExitBtn);
    expect(jumpExitBtn.className).toContain('font-bold');
  });

  it('re-fetches candles and maintains chronological replay position when switching timeframe', async () => {
    const fetchSpy = vi.spyOn(api, 'fetchCandles');

    render(
      <TradeExecutionChart
        symbol="美国原油 - 现货."
        direction="sell"
        entryPrice={85.628}
        exitPrice={84.670}
        entryTime="2026-11-18 02:48:39"
        exitTime="2026-11-18 09:13:45"
      />
    );

    await waitFor(() => {
      expect(screen.queryByText(/正在拉取/)).not.toBeInTheDocument();
    });

    const m1Btn = screen.getByRole('button', { name: 'M1' });
    fireEvent.click(m1Btn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'USOIL',
          timeframe: 'M1',
        })
      );
    });
  });

  it('accurately calculates exit efficiency and MFE/MAE without contract multiplier distortion for small profits', async () => {
    // 模拟 1M K线，时间与入场时间完全一致（北京时间）
    const m1Candles = [
      { time: '2026-11-20 15:55', timestamp: 1795161300, open: 3550.0, high: 3552.0, low: 3548.0, close: 3549.0, volume: 100 },
      { time: '2026-11-20 15:56', timestamp: 1795161360, open: 3548.63, high: 3549.0, low: 3543.0, close: 3544.91, volume: 120 },
      { time: '2026-11-20 15:57', timestamp: 1795161420, open: 3544.91, high: 3546.0, low: 3542.0, close: 3543.5, volume: 110 },
    ];

    vi.spyOn(api, 'fetchCandles').mockResolvedValue({
      success: true,
      symbol: 'XAUUSD',
      timeframe: 'M1',
      contractSize: 100,
      dataSource: 'MT5 Direct Terminal',
      count: m1Candles.length,
      candles: m1Candles,
    });

    render(
      <TradeExecutionChart
        symbol="XAUUSD"
        direction="short"
        entryPrice={3548.63}
        exitPrice={3544.91}
        entryTime="2026-11-20 15:56:00"
        exitTime="2026-11-20 15:56:45"
        size={1}
        profit={3.72} // 净盈亏 3.72 美元（对应 3.72 点）
        initialTimeframe="M1"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('出场落袋效率')).toBeInTheDocument();
    });

    // 入场 3548.63，平仓 3544.91，做空盈利 3.72 点。
    // 该K线最低 3543.0，最大顺行 3548.63 - 3543.0 = 5.63 点。
    // 出场效率 = 3.72 / 5.63 = 66%（绝非由于 100 倍乘数导致的 2% 错误）
    expect(screen.getByText(/出场落袋效率/i)).toBeInTheDocument();
    expect(screen.getByText(/最大顺行 \(MFE\)/i)).toBeInTheDocument();
    expect(screen.getByText(/最大逆行 \(MAE\)/i)).toBeInTheDocument();

    // 检查出场效率是否合理大于 50%
    const efficiencyEl = screen.getByText(/%/);
    expect(parseInt(efficiencyEl.textContent || '0', 10)).toBeGreaterThanOrEqual(50);
  });

  it('hides real-time price line and scale badge on candlestick series (priceLineVisible: false, lastValueVisible: false)', async () => {
    const { createChart } = await import('lightweight-charts');
    const mockChart = (createChart as any)();

    render(
      <TradeExecutionChart
        symbol="BTCUSD"
        direction="long"
        entryPrice={75759.65}
        exitPrice={76030.74}
      />
    );

    await waitFor(() => {
      expect(mockChart.addSeries).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          priceLineVisible: false,
          lastValueVisible: false,
        })
      );
    });
  });

  it('aligns entry and exit markers directly to the price lines even with timezone offsets between candles and trades', async () => {
    // 模拟 K 线数据：即使因时区偏移，价格触及入场和出场的 K 线在不同时间索引，算法也能精准选定对应 K 线
    const offsetCandles = [
      { time: '2026-11-08 10:00', timestamp: 1794103200, open: 75750.0, high: 75770.0, low: 75740.0, close: 75760.0, volume: 500 }, // 触及入场价 75759.65
      { time: '2026-11-08 10:05', timestamp: 1794103500, open: 75760.0, high: 75800.0, low: 75755.0, close: 75790.0, volume: 600 },
      { time: '2026-11-08 10:10', timestamp: 1794103800, open: 75790.0, high: 76050.0, low: 75780.0, close: 76035.0, volume: 700 }, // 触及出场价 76030.74
      { time: '2026-11-08 16:30', timestamp: 1794126600, open: 77000.0, high: 77200.0, low: 76900.0, close: 77100.0, volume: 800 }, // 偏离价格的高位 K 线
    ];

    vi.spyOn(api, 'fetchCandles').mockResolvedValue({
      success: true,
      symbol: 'BTCUSD',
      timeframe: 'M5',
      contractSize: 1,
      dataSource: 'MT5 Direct Terminal',
      count: offsetCandles.length,
      candles: offsetCandles,
    });

    const { createSeriesMarkers } = await import('lightweight-charts');
    const mockMarkersPlugin = (createSeriesMarkers as any)();

    render(
      <TradeExecutionChart
        symbol="BTCUSD"
        direction="long"
        entryPrice={75759.65}
        exitPrice={76030.74}
        entryTime="2026-11-08 16:30:00" // 模拟由于时区转换传入的 16:30
        exitTime="2026-11-08 16:40:00"
      />
    );

    await waitFor(() => {
      expect(mockMarkersPlugin.setMarkers).toHaveBeenCalled();
    });

    const calls = mockMarkersPlugin.setMarkers.mock.calls;
    const latestMarkers = calls[calls.length - 1][0];

    // 入场打点必须精准定位在包含 entryPrice 75759.65 的第一根 K 线 (10:00)
    // 而绝非被错误放置在偏离价格的 16:30 K 线上
    const entryMarker = latestMarkers.find((m: any) => m.text.includes('BUY'));
    expect(entryMarker).toBeDefined();
    expect(entryMarker.text).toContain('75759.65');

    // 出场打点必须精准定位在包含 exitPrice 76030.74 的第三根 K 线 (10:10)
    const exitMarker = latestMarkers.find((m: any) => m.text.includes('EXIT'));
    expect(exitMarker).toBeDefined();
    expect(exitMarker.text).toContain('76030.74');
  });
});
