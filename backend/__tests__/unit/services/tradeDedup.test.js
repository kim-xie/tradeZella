import { areTradesFuzzyDuplicate, extractTradeTicket, extractPositionId } from '../../../src/services/trade.service.js';

describe('Trade Deduplication & Position Matching', () => {
  test('extracts deal ticket and MT5 positionId accurately', () => {
    const eaTrade = {
      ticket: '9001',
      positionId: '5067001',
      notes: 'MT5 Position #5067001 | Deal #9001',
    };
    expect(extractTradeTicket(eaTrade)).toBe('9001');
    expect(extractPositionId(eaTrade)).toBe('5067001');

    const reportTrade = {
      ticket: '5067001',
      notes: 'Ticket/ID: 5067001',
    };
    expect(extractTradeTicket(reportTrade)).toBe('5067001');
  });

  test('does NOT treat rapid Forex/Gold split orders with different tickets as duplicates', () => {
    const forexOrder1 = {
      ticket: '10001',
      symbol: 'EURUSD',
      direction: 'long',
      size: 0.1,
      entryPrice: 1.08200,
      exitPrice: 1.08450,
      entryTime: '2026-11-20T14:00:00',
      exitTime: '2026-11-20T14:15:00',
      manualPnl: 25.0,
    };
    const forexOrder2 = {
      ticket: '10002',
      symbol: 'EURUSD',
      direction: 'long',
      size: 0.1,
      entryPrice: 1.08350, // 15 pips higher (previously matched <= 0.5!)
      exitPrice: 1.08480,
      entryTime: '2026-11-20T14:01:00', // 60s later
      exitTime: '2026-11-20T14:15:05',
      manualPnl: 13.0,
    };
    expect(areTradesFuzzyDuplicate(forexOrder1, forexOrder2)).toBe(false);

    // Same-price rapid split orders within the same sync batch
    const samePriceOrder1 = { ...forexOrder1, ticket: '10003' };
    const samePriceOrder2 = { ...forexOrder1, ticket: '10004', entryTime: '2026-11-20T14:00:05' };
    expect(areTradesFuzzyDuplicate(samePriceOrder1, samePriceOrder2, { strictTicket: true })).toBe(false);
  });

  test('does NOT drop equal-size partial closes under the same MT5 Position', () => {
    const partialClose1 = {
      ticket: '9001',
      positionId: '5067001',
      symbol: 'XAUUSD',
      direction: 'long',
      size: 0.5,
      entryPrice: 2650.0,
      exitPrice: 2660.0,
      entryTime: '2026-11-20T10:00:00',
      exitTime: '2026-11-20T10:30:00',
      manualPnl: 500.0,
      notes: 'MT5 Position #5067001 | Deal #9001',
    };
    const partialClose2 = {
      ticket: '9002',
      positionId: '5067001',
      symbol: 'XAUUSD',
      direction: 'long',
      size: 0.5,
      entryPrice: 2650.0,
      exitPrice: 2670.0,
      entryTime: '2026-11-20T10:00:00',
      exitTime: '2026-11-20T11:30:00',
      manualPnl: 1000.0,
      notes: 'MT5 Position #5067001 | Deal #9002',
    };
    expect(areTradesFuzzyDuplicate(partialClose1, partialClose2)).toBe(false);
    expect(areTradesFuzzyDuplicate(partialClose1, partialClose2, { strictTicket: true })).toBe(false);
  });

  test('merges EA single-close deal with MT5 report position sharing same Position ID and size', () => {
    const eaTrade = {
      ticket: '9001',
      positionId: '5067001',
      symbol: 'XAUUSD',
      direction: 'long',
      size: 1.0,
      entryPrice: 2650.0,
      exitPrice: 2660.0,
      entryTime: '2026-11-20T10:00:00',
      exitTime: '2026-11-20T10:30:00',
      manualPnl: 993.0,
      notes: 'MT5 Position #5067001 | Deal #9001',
    };
    const reportTrade = {
      ticket: '5067001',
      symbol: 'XAUUSD',
      direction: 'long',
      size: 1.0,
      entryPrice: 2650.0,
      exitPrice: 2660.0,
      entryTime: '2026-11-20T10:00:00',
      exitTime: '2026-11-20T10:30:00',
      manualPnl: 993.0,
      notes: 'Ticket/ID: 5067001',
    };
    expect(areTradesFuzzyDuplicate(eaTrade, reportTrade)).toBe(true);
  });
});
