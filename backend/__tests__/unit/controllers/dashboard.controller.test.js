import { DashboardController, calculatePerformanceMetrics, getTradeExitMethod } from '../../../src/controllers/dashboard.controller.js';

describe('DashboardController', () => {
  describe('calculatePerformanceMetrics', () => {
    it('should calculate metrics correctly for mixed trades including exit methods and duration', () => {
      const trades = [
        {
          id: 1,
          userId: 1,
          symbol: 'AAPL',
          direction: 'buy',
          size: 100,
          entryPrice: 150.00,
          exitPrice: 155.00, // Profit: $500
          take_profit: 155.00,
          entry_time: '2023-01-01T10:00:00Z',
          exit_time: '2023-01-01T11:00:00Z', // 60 mins
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        },
        {
          id: 2,
          userId: 1,
          symbol: 'GOOGL',
          direction: 'buy',
          size: 50,
          entryPrice: 2500.00,
          exitPrice: 2450.00, // Loss: $2500
          stop_loss: 2450.00,
          entry_time: '2023-01-02T10:00:00Z',
          exit_time: '2023-01-02T10:30:00Z', // 30 mins
          createdAt: '2023-01-02T00:00:00Z',
          updatedAt: '2023-01-02T00:00:00Z'
        },
        {
          id: 3,
          userId: 1,
          symbol: 'MSFT',
          direction: 'buy',
          size: 200,
          entryPrice: 300.00,
          exitPrice: 310.00, // Profit: $2000 (manual close win)
          entry_time: '2023-01-03T10:00:00Z',
          exit_time: '2023-01-03T12:00:00Z', // 120 mins
          createdAt: '2023-01-03T00:00:00Z',
          updatedAt: '2023-01-03T00:00:00Z'
        },
        {
          id: 4,
          userId: 1,
          symbol: 'TSLA',
          direction: 'buy',
          size: 10,
          entryPrice: 200.00,
          exitPrice: 190.00, // Loss: $100 (manual close loss)
          entry_time: '2023-01-04T10:00:00Z',
          exit_time: '2023-01-04T10:45:00Z', // 45 mins
          createdAt: '2023-01-04T00:00:00Z',
          updatedAt: '2023-01-04T00:00:00Z'
        }
      ];

      const metrics = calculatePerformanceMetrics(trades);

      expect(metrics.totalTrades).toBe(4);
      expect(metrics.completedTrades).toBe(4);
      expect(metrics.winningTrades).toBe(2);
      expect(metrics.losingTrades).toBe(2);

      // Exit methods
      expect(metrics.takeProfitTrades).toBe(1);
      expect(metrics.stopLossTrades).toBe(1);
      expect(metrics.manualCloseTrades).toBe(2);
      expect(metrics.manualCloseWins).toBe(1);
      expect(metrics.manualCloseLosses).toBe(1);

      // Average durations
      // Win durations: 60, 120 -> avg = 90
      // Loss durations: 30, 45 -> avg = 37.5
      expect(metrics.avgWinDuration).toBe(90);
      expect(metrics.avgLossDuration).toBe(37.5);
    });

    it('should handle empty trades array', () => {
      const trades = [];
      const metrics = calculatePerformanceMetrics(trades);
      expect(metrics.totalTrades).toBe(0);
      expect(metrics.takeProfitTrades).toBe(0);
      expect(metrics.stopLossTrades).toBe(0);
      expect(metrics.manualCloseTrades).toBe(0);
      expect(metrics.manualCloseWins).toBe(0);
      expect(metrics.manualCloseLosses).toBe(0);
      expect(metrics.avgWinDuration).toBe(0);
      expect(metrics.avgLossDuration).toBe(0);
    });

    it('should handle trades with no exit price (open trades)', () => {
      const trades = [
        {
          id: 1,
          userId: 1,
          symbol: 'AAPL',
          direction: 'buy',
          size: 100,
          entryPrice: 150.00,
          exitPrice: null, // Open trade
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        }
      ];
      
      const metrics = calculatePerformanceMetrics(trades);
      expect(metrics.totalTrades).toBe(1);
      expect(metrics.completedTrades).toBe(0);
    });
  });
});
