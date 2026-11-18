import { CandleService } from '../services/candle.service.js';

describe('Candle Service and EA Sync Contract', () => {
  test('should handle empty candle array gracefully', async () => {
    const res = await CandleService.saveBulkCandles({
      symbol: 'EURUSD',
      timeframe: 'M5',
      candles: [],
    });
    expect(res.insertedCount).toBe(0);
  });

  test('should format input parameters correctly for query', async () => {
    const candles = await CandleService.getCandles({
      symbol: 'EURUSD',
      timeframe: 'M5',
      count: 100,
    });
    expect(Array.isArray(candles)).toBe(true);
  });
});
