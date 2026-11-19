import { pool } from '../db.js';

export class CandleService {
  /**
   * Bulk upsert candles into database
   */
  static async saveBulkCandles({ symbol, timeframe, candles }) {
    if (!symbol || !timeframe || !Array.isArray(candles) || candles.length === 0) {
      return { insertedCount: 0 };
    }

    const cleanSymbol = String(symbol).trim().toUpperCase();
    const cleanTf = String(timeframe).trim().toUpperCase();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let insertedCount = 0;
      // Use parameterized multi-row insert or batch
      for (const c of candles) {
        if (!c.time && !c.timestamp) continue;
        
        let candleTime = c.time;
        let ts = c.timestamp;

        if (!ts && candleTime) {
          ts = Math.floor(new Date(candleTime).getTime() / 1000);
        } else if (ts && !candleTime) {
          const d = new Date(ts * 1000);
          const pad = (n) => String(n).padStart(2, '0');
          candleTime = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        }

        const open = parseFloat(c.open) || 0;
        const high = parseFloat(c.high) || 0;
        const low = parseFloat(c.low) || 0;
        const close = parseFloat(c.close) || 0;
        const volume = parseInt(c.volume) || 0;

        await client.query(
          `INSERT INTO market_candles (symbol, timeframe, candle_time, timestamp, open, high, low, close, volume)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (symbol, timeframe, candle_time) 
           DO UPDATE SET 
             open = EXCLUDED.open,
             high = EXCLUDED.high,
             low = EXCLUDED.low,
             close = EXCLUDED.close,
             volume = EXCLUDED.volume`,
          [cleanSymbol, cleanTf, candleTime, ts, open, high, low, close, volume]
        );
        insertedCount++;
      }

      await client.query('COMMIT');
      return { insertedCount };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Retrieve historical candles from database
   */
  static async getCandles({ symbol, timeframe, count = 300, start = null, end = null }) {
    const cleanSymbol = String(symbol).trim().toUpperCase();
    const cleanTf = String(timeframe).trim().toUpperCase();
    const limitNum = Math.min(Math.max(parseInt(count) || 300, 10), 10000);

    let client;
    try {
      client = await pool.connect();
      let queryStr;
      let params;

      if (start && end) {
        queryStr = `
          SELECT TO_CHAR(candle_time, 'YYYY-MM-DD HH24:MI') AS time,
                 timestamp,
                 round(open::numeric, 5)::float AS open,
                 round(high::numeric, 5)::float AS high,
                 round(low::numeric, 5)::float AS low,
                 round(close::numeric, 5)::float AS close,
                 volume
          FROM market_candles
          WHERE symbol = $1 AND timeframe = $2 AND candle_time >= $3 AND candle_time <= $4
          ORDER BY candle_time ASC
          LIMIT $5
        `;
        params = [cleanSymbol, cleanTf, start, end, limitNum];
      } else if (start) {
        queryStr = `
          SELECT TO_CHAR(candle_time, 'YYYY-MM-DD HH24:MI') AS time,
                 timestamp,
                 round(open::numeric, 5)::float AS open,
                 round(high::numeric, 5)::float AS high,
                 round(low::numeric, 5)::float AS low,
                 round(close::numeric, 5)::float AS close,
                 volume
          FROM market_candles
          WHERE symbol = $1 AND timeframe = $2 AND candle_time >= $3
          ORDER BY candle_time ASC
          LIMIT $4
        `;
        params = [cleanSymbol, cleanTf, start, limitNum];
      } else {
        // Fetch the most recent N bars
        queryStr = `
          SELECT * FROM (
            SELECT TO_CHAR(candle_time, 'YYYY-MM-DD HH24:MI') AS time,
                   timestamp,
                   round(open::numeric, 5)::float AS open,
                   round(high::numeric, 5)::float AS high,
                   round(low::numeric, 5)::float AS low,
                   round(close::numeric, 5)::float AS close,
                   volume,
                   candle_time
            FROM market_candles
            WHERE symbol = $1 AND timeframe = $2
            ORDER BY candle_time DESC
            LIMIT $3
          ) sub
          ORDER BY candle_time ASC
        `;
        params = [cleanSymbol, cleanTf, limitNum];
      }

      const res = await client.query(queryStr, params);
      return res.rows;
    } catch (err) {
      // If DB is unreachable or table doesn't exist yet, return empty array gracefully
      return [];
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Get distinct symbols that actually have candle data in the database
   */
  static async getAvailableSymbols() {
    let client;
    try {
      client = await pool.connect();
      const res = await client.query(`
        SELECT DISTINCT symbol 
        FROM market_candles
        WHERE symbol IS NOT NULL
        ORDER BY symbol ASC
      `);
      return res.rows.map(r => r.symbol);
    } catch (err) {
      return [];
    } finally {
      if (client) client.release();
    }
  }
}
