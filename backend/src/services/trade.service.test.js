import { TradeService } from './trade.service.js';
import { pool } from '../db.js';
import { UserModel } from '../models/user.model.js';

describe('TradeService', () => {
  let user;
  let client;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
  });

  beforeEach(async () => {
    client = await pool.connect();
    
    // Clear existing data
    await client.query('DELETE FROM trades');
    await client.query('DELETE FROM users');
    
    // Manually insert user
    const userResult = await client.query(
      "INSERT INTO users (email, name, password) VALUES ($1, $2, $3) RETURNING *", 
      ['test@example.com', 'Test User', 'hashed_password']
    );
    user = userResult.rows[0];
    
    client.release();
  });

  afterAll(async () => {
    // Clean up the pool
    await pool.end();
  });

  it('should create a new trade', async () => {
    const tradeData = {
      userId: user.id,
      symbol: 'AAPL',
      direction: 'buy',
      size: 10,
      entryPrice: 150.0,
      notes: 'Test trade'
    };
    
    const trade = await TradeService.createTrade(tradeData);
    
    expect(trade).toHaveProperty('id');
    expect(trade.symbol).toBe('AAPL');

    // Check in database
    const dbClient = await pool.connect();
    try {
      const dbTradeResult = await dbClient.query('SELECT * FROM trades WHERE id = $1', [trade.id]);
      const dbTrade = dbTradeResult.rows[0];
      expect(dbTrade).toBeDefined();
      expect(dbTrade.symbol).toBe('AAPL');
    } finally {
      dbClient.release();
    }
  });

  it('should get all trades for a user', async () => {
    const dbClient = await pool.connect();
    try {
      await dbClient.query('INSERT INTO trades (userId, symbol, direction, size, entryPrice) VALUES ($1, $2, $3, $4, $5)', 
        [user.id, 'AAPL', 'buy', 10, 150.0]);
      await dbClient.query('INSERT INTO trades (userId, symbol, direction, size, entryPrice) VALUES ($1, $2, $3, $4, $5)', 
        [user.id, 'GOOG', 'sell', 5, 2800.0]);
    } finally {
      dbClient.release();
    }

    const trades = await TradeService.getTradesByUserId(user.id);
    expect(trades).toHaveLength(2);
  });

  it('should get a trade by id', async () => {
    const dbClient = await pool.connect();
    try {
      const newTradeResult = await dbClient.query(
        'INSERT INTO trades (userId, symbol, direction, size, entryPrice) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [user.id, 'AAPL', 'buy', 10, 150.0]
      );
      const newTrade = newTradeResult.rows[0];
      
      const foundTrade = await TradeService.getTradeById(newTrade.id, user.id);
      expect(foundTrade).toBeDefined();
      expect(foundTrade.id).toBe(newTrade.id);
    } finally {
      dbClient.release();
    }
  });

  it('should not get a trade belonging to another user', async () => {
    const dbClient = await pool.connect();
    try {
      const newTradeResult = await dbClient.query(
        'INSERT INTO trades (userId, symbol, direction, size, entryPrice) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [user.id, 'AAPL', 'buy', 10, 150.0]
      );
      const newTrade = newTradeResult.rows[0];
      
      const foundTrade = await TradeService.getTradeById(newTrade.id, user.id + 1);
      expect(foundTrade).toBeUndefined();
    } finally {
      dbClient.release();
    }
  });

  it('should update a trade with partial data', async () => {
    const dbClient = await pool.connect();
    try {
      const newTradeResult = await dbClient.query(
        'INSERT INTO trades (userId, symbol, direction, size, entryPrice, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [user.id, 'AAPL', 'buy', 10, 150.0, 'Original note']
      );
      const newTrade = newTradeResult.rows[0];
      
      const updatedData = { symbol: 'MSFT', notes: 'Updated note' };
      const updatedTrade = await TradeService.updateTrade(newTrade.id, user.id, updatedData);

      expect(updatedTrade).toBeDefined();
      expect(updatedTrade.symbol).toBe('MSFT');
      expect(updatedTrade.notes).toBe('Updated note');
      expect(updatedTrade.direction).toBe('buy'); // Should remain unchanged
      expect(updatedTrade.entryprice).toBe(150.0); // Should remain unchanged
      expect(updatedTrade.size).toBe(10); // Should remain unchanged
    } finally {
      dbClient.release();
    }
  });

  it('should delete a trade', async () => {
    const dbClient = await pool.connect();
    try {
      const newTradeResult = await dbClient.query(
        'INSERT INTO trades (userId, symbol, direction, size, entryPrice) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [user.id, 'AAPL', 'buy', 10, 150.0]
      );
      const newTrade = newTradeResult.rows[0];
      
      const success = await TradeService.deleteTrade(newTrade.id, user.id);
      expect(success).toBe(true);

      const foundTradeResult = await dbClient.query('SELECT * FROM trades WHERE id = $1', [newTrade.id]);
      const foundTrade = foundTradeResult.rows[0];
      expect(foundTrade).toBeUndefined();
    } finally {
      dbClient.release();
    }
  });

  describe('Deduplication & Smart Enrichment', () => {
    it('should prevent inserting duplicate and enrich existing trade when second sync brings SL/TP', async () => {
      // Trade 1: Rough import or manual entry (4m duration, no SL/TP, pnl 3.72)
      const trade1 = {
        userId: user.id,
        symbol: 'XAUUSD',
        direction: 'short',
        size: 1,
        entryPrice: 2650.50,
        exitPrice: 2646.78,
        entryTime: '2026-11-20T23:56:00',
        exitTime: '2026-11-21T00:00:00',
        manualPnl: 3.72,
        notes: 'Manual or rough statement'
      };

      const res1 = await TradeService.createBulkTrades([trade1]);
      expect(res1).toHaveLength(1);

      // Trade 2: EA sync (5m duration, has SL/TP, ticket, pnl 3.72)
      const trade2 = {
        userId: user.id,
        ticket: '98765432',
        symbol: 'XAUUSD',
        direction: 'short',
        size: 1,
        entryPrice: 2650.50,
        exitPrice: 2646.78,
        entryTime: '2026-11-20T23:56:15',
        exitTime: '2026-11-21T00:01:10',
        stopLoss: 2660.00,
        takeProfit: 2630.00,
        finalTrigger: 'takeProfit',
        manualPnl: 3.72,
        notes: 'Ticket/ID: 98765432 | EA Auto Sync'
      };

      const res2 = await TradeService.createBulkTrades([trade2]);
      // Should NOT insert a new row
      expect(res2).toHaveLength(0);
      expect(res2.skippedCount).toBe(1);
      expect(res2.enrichedCount).toBe(1);

      // Verify that database still only has 1 trade, but it has been enriched with SL/TP and Ticket!
      const allTrades = await TradeService.getTradesByUserId(user.id);
      expect(allTrades).toHaveLength(1);
      const enriched = allTrades[0];
      expect(enriched.ticket).toBe('98765432');
      expect(Number(enriched.stop_loss)).toBe(2660.00);
      expect(Number(enriched.take_profit)).toBe(2630.00);
      expect(enriched.final_trigger).toBe('takeProfit');
    });

    it('should successfully cleanup existing duplicates in DB, keeping the richest record', async () => {
      const dbClient = await pool.connect();
      try {
        // Manually insert two duplicates (like the user experienced)
        // Duplicate 1: 4m, no SL/TP, no ticket
        await dbClient.query(`
          INSERT INTO trades (
            userId, symbol, direction, size, entryPrice, exitPrice,
            entry_time, exit_time, manual_pnl, notes, createdat, updatedat
          ) VALUES (
            $1, 'XAUUSD', 'short', 1, 2650.5, 2646.78,
            '2026-11-20 23:56:00', '2026-11-21 00:00:00', 3.72, '手动平仓',
            NOW(), NOW()
          )
        `, [user.id]);

        // Duplicate 2: 5m, has SL/TP, ticket, final_trigger
        await dbClient.query(`
          INSERT INTO trades (
            userId, ticket, symbol, direction, size, entryPrice, exitPrice,
            entry_time, exit_time, stop_loss, take_profit, final_trigger, manual_pnl, notes, createdat, updatedat
          ) VALUES (
            $1, '98765432', 'XAUUSD', 'short', 1, 2650.5, 2646.78,
            '2026-11-20 23:56:15', '2026-11-21 00:01:10', 2660, 2630, 'takeProfit', 3.72, 'EA Auto Sync',
            NOW(), NOW()
          )
        `, [user.id]);
      } finally {
        dbClient.release();
      }

      // Check initially 2 trades exist
      const beforeCleanup = await TradeService.getTradesByUserId(user.id);
      expect(beforeCleanup).toHaveLength(2);

      // Run cleanupDuplicateTrades
      const cleanupRes = await TradeService.cleanupDuplicateTrades(user.id);
      expect(cleanupRes.cleanedCount).toBe(1);
      expect(cleanupRes.remainingCount).toBe(1);

      // Verify only 1 trade remains, and it's the rich record with SL/TP and 3.4R
      const afterCleanup = await TradeService.getTradesByUserId(user.id);
      expect(afterCleanup).toHaveLength(1);
      const remaining = afterCleanup[0];
      expect(remaining.ticket).toBe('98765432');
      expect(Number(remaining.stop_loss)).toBe(2660);
      expect(Number(remaining.take_profit)).toBe(2630);
      expect(remaining.final_trigger).toBe('takeProfit');
    });
  });
});