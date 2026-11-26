import { jest } from '@jest/globals';

const mockCreateBulkTrades = jest.fn(async (trades) => {
  const res = [...trades];
  res.skippedCount = 0;
  res.enrichedCount = 0;
  res.insertedCount = trades.length;
  res.totalReceived = trades.length;
  return res;
});

const mockBroadcastTradeUpdate = jest.fn();

const mockSaveUserBrokerTimezone = jest.fn(async (_uid, tz) => tz);
const mockGetUserBrokerTimezone = jest.fn(async () => 'utc');
const mockGetTradesByUserId = jest.fn(async () => []);
const mockAutoEvaluateTriggers = jest.fn(async () => []);

await jest.unstable_mockModule('../../../src/services/trade.service.js', () => ({
  TradeService: {
    createBulkTrades: mockCreateBulkTrades,
    saveUserBrokerTimezone: mockSaveUserBrokerTimezone,
    getUserBrokerTimezone: mockGetUserBrokerTimezone,
    getTradesByUserId: mockGetTradesByUserId,
    autoEvaluateTriggers: mockAutoEvaluateTriggers,
  },
}));

await jest.unstable_mockModule('../../../src/services/realtime.service.js', () => ({
  RealtimeService: {
    broadcastTradeUpdate: mockBroadcastTradeUpdate,
  },
}));

const { TradeController } = await import('../../../src/controllers/trade.controller.js');
const { parseUniversalTradeFile } = await import('../../../src/parsers/universalTradeParser.js');

const createMockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
};

describe('HTML Import vs EA Direct Sync Parity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('produces identical core position fields between MT5 HTML import and Position-level EA sync', async () => {
    const htmlReport = `<!DOCTYPE html><html><body><table>
      <tr><th colspan="14">Positions</th></tr>
      <tr>
        <th>Time</th><th>Position</th><th>Symbol</th><th>Type</th><th>Volume</th><th>Price</th><th>S / L</th><th>T / P</th><th>Time</th><th>Price</th><th>Commission</th><th>Fee</th><th>Swap</th><th>Profit</th>
      </tr>
      <tr>
        <td>2026.11.20 10:15:30</td><td>50671100</td><td>XAUUSD</td><td>buy</td><td>1.00</td><td>2650.00</td><td>2640.00</td><td>2680.00</td><td>2026.11.20 14:45:10</td><td>2662.50</td><td>-7.00</td><td>-1.20</td><td>-2.30</td><td>1250.00</td>
      </tr>
    </table></body></html>`;

    const uploadReq = {
      user: { id: 42 },
      file: {
        originalname: 'mt5_report.html',
        buffer: Buffer.from(htmlReport, 'utf8'),
      },
      body: { timezone: 'broker' },
    };
    const uploadRes = createMockRes();
    await TradeController.uploadTrades(uploadReq, uploadRes, jest.fn());

    expect(uploadRes.statusCode).toBe(200);
    const htmlTrade = mockCreateBulkTrades.mock.calls[0][0][0];

    mockCreateBulkTrades.mockClear();

    const eaReq = {
      user: { id: 42 },
      body: {
        platform: 'MT5 EA Direct',
        timezone: 'broker',
        gmtOffsetSec: 7200,
        trades: [
          {
            ticket: '50671100',
            positionId: '50671100',
            symbol: 'XAUUSD',
            direction: 'long',
            size: 1.0,
            entryPrice: 2650.0,
            exitPrice: 2662.5,
            stopLoss: 2640.0,
            takeProfit: 2680.0,
            entryTime: '2026.11.20 10:15:30',
            exitTime: '2026.11.20 14:45:10',
            profit: 1250.0,
            commission: -7.0,
            fee: -1.2,
            swap: -2.3,
            manualPnl: 1239.5,
          },
        ],
      },
    };
    const eaRes = createMockRes();
    await TradeController.syncEATrades(eaReq, eaRes, jest.fn());

    expect(eaRes.statusCode).toBe(200);
    const eaTrade = mockCreateBulkTrades.mock.calls[0][0][0];

    expect(eaTrade.ticket).toBe(htmlTrade.ticket);
    expect(eaTrade.symbol).toBe(htmlTrade.symbol);
    expect(eaTrade.direction).toBe(htmlTrade.direction);
    expect(eaTrade.size).toBe(htmlTrade.size);
    expect(eaTrade.entryPrice).toBe(htmlTrade.entryPrice);
    expect(eaTrade.exitPrice).toBe(htmlTrade.exitPrice);
    expect(eaTrade.stopLoss).toBe(htmlTrade.stopLoss);
    expect(eaTrade.takeProfit).toBe(htmlTrade.takeProfit);
    expect(eaTrade.entryTime).toBe(htmlTrade.entryTime);
    expect(eaTrade.exitTime).toBe(htmlTrade.exitTime);
    expect(eaTrade.tradeDate).toBe(htmlTrade.tradeDate);
    expect(eaTrade.manualPnl).toBe(htmlTrade.manualPnl);
    expect(eaTrade.session).toBe(htmlTrade.session);
    expect(eaTrade.notes).toBe('MT5 Position #50671100');
  });

  test('computes manualPnl including fee and dynamic offset timezone in syncEATrades', async () => {
    const eaReq = {
      user: { id: 7 },
      body: {
        platform: 'MT5 EA Direct',
        timezone: 'offset',
        gmtOffsetSec: 0, // UTC+0 broker (+8h -> Beijing)
        trades: [
          {
            ticket: '9001',
            positionId: '5067001',
            symbol: 'EURUSD',
            direction: 'short',
            size: 0.25,
            entryPrice: 1.09,
            exitPrice: 1.085,
            entryTime: '2026.11.20 10:00:00',
            exitTime: '2026.11.20 12:00:00',
            profit: 125.0,
            commission: -2.5,
            fee: -0.75,
            swap: 0.25,
          },
        ],
      },
    };
    const eaRes = createMockRes();
    await TradeController.syncEATrades(eaReq, eaRes, jest.fn());

    expect(eaRes.statusCode).toBe(200);
    const eaTrade = mockCreateBulkTrades.mock.calls[0][0][0];
    expect(eaTrade.entryTime).toBe('2026-11-20T18:00:00');
    expect(eaTrade.exitTime).toBe('2026-11-20T20:00:00');
    expect(eaTrade.manualPnl).toBe(122.0);
    expect(eaTrade.session).toBe('Europe');
    expect(eaTrade.notes).toBe('MT5 Position #5067001 | Deal #9001');
    expect(mockSaveUserBrokerTimezone).toHaveBeenCalledWith(7, 'utc');
    expect(eaRes.body.brokerTimezone).toBe('utc');

    // Verify getTrades returns persisted brokerTimezone in meta
    const getRes = createMockRes();
    await TradeController.getTrades({ user: { id: 7 }, query: {} }, getRes, jest.fn());
    expect(getRes.statusCode).toBe(200);
    expect(getRes.body.meta).toEqual({ brokerTimezone: 'utc' });
    expect(mockAutoEvaluateTriggers).toHaveBeenCalledWith(7);
  });
});
