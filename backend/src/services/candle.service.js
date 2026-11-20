import { pool } from '../db.js';
import { convertToShanghaiTime } from '../parsers/universalTradeParser.js';

export function getSymbolAliases(sym) {
  const raw = String(sym || '').trim();
  const upper = raw.toUpperCase();
  const set = new Set([upper]);
  
  // Chinese name and standard ticker mappings
  if (/原油|USOIL|WTI|XTI/i.test(raw)) { set.add('USOIL'); set.add('WTI'); set.add('XTIUSD'); }
  if (/布伦特|UKOIL|BRENT|XBR/i.test(raw)) { set.add('UKOIL'); set.add('BRENT'); set.add('XBRUSD'); }
  if (/纳斯达克|NAS100|US100|USTEC|NDX/i.test(raw)) { set.add('NAS100'); set.add('US100'); set.add('USTEC'); }
  if (/道琼斯|US30|DJ30|WS30/i.test(raw)) { set.add('US30'); set.add('DJ30'); }
  if (/标普|US500|SPX|SP500/i.test(raw)) { set.add('US500'); set.add('SPX500'); }
  if (/黄金|XAU|GOLD/i.test(raw)) { set.add('XAUUSD'); set.add('GOLD'); }
  if (/白银|XAG|SILVER/i.test(raw)) { set.add('XAGUSD'); set.add('SILVER'); }
  if (/比特币|BTC/i.test(raw)) { set.add('BTCUSD'); set.add('BTCUSDT'); }
  if (/以太坊|ETH/i.test(raw)) { set.add('ETHUSD'); set.add('ETHUSDT'); }
  if (/德指|DAX|GER40|GER30/i.test(raw)) { set.add('GER40'); set.add('DAX'); set.add('GER30'); }
  if (/日经|JP225|N225/i.test(raw)) { set.add('JP225'); set.add('N225'); }
  if (/恒生|HK50|HSI/i.test(raw)) { set.add('HK50'); set.add('HSI'); }

  // Strip broker suffixes (.m, .raw, .ecn, .pro, _i, .cash, trailing dot)
  const stripped = upper.replace(/\.(CASH|RAW|ECN|PRO|M|STD|I)$/i, '').replace(/[_.-]$/, '');
  if (stripped) set.add(stripped);

  return Array.from(set);
}

export class CandleService {
  /**
   * Bulk upsert candles into database.
   * Auto-converts broker timestamps to Shanghai Time (UTC+8) to match trade records.
   */
  static async saveBulkCandles({ symbol, timeframe, candles, timezone = 'broker' }) {
    if (!symbol || !timeframe || !Array.isArray(candles) || candles.length === 0) {
      return { insertedCount: 0 };
    }

    const cleanSymbol = String(symbol).trim().toUpperCase();
    const cleanTf = String(timeframe).trim().toUpperCase();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let insertedCount = 0;
      for (const c of candles) {
        if (!c.time && !c.timestamp) continue;
        
        let candleTime = c.time;
        if (candleTime) {
          candleTime = convertToShanghaiTime(candleTime, timezone);
        } else if (c.timestamp) {
          const d = new Date(c.timestamp * 1000);
          const pad = (n) => String(n).padStart(2, '0');
          const rawBrokerTime = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
          candleTime = convertToShanghaiTime(rawBrokerTime, timezone);
        }

        const dParsed = new Date(String(candleTime).replace(' ', 'T').replace(/\./g, '-'));
        const ts = !isNaN(dParsed.getTime()) ? Math.floor(dParsed.getTime() / 1000) : (c.timestamp || 0);

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
             volume = EXCLUDED.volume,
             timestamp = EXCLUDED.timestamp`,
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
   * Retrieve historical candles from database.
   * Supports symbol alias lookup and exact start/end window retrieval.
   */
  static async getCandles({ symbol, timeframe, count = 300, start = null, end = null }) {
    const aliases = getSymbolAliases(symbol);
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
          WHERE symbol = ANY($1) AND timeframe = $2 AND candle_time >= $3 AND candle_time <= $4
          ORDER BY candle_time ASC
          LIMIT $5
        `;
        params = [aliases, cleanTf, start, end, limitNum];
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
          WHERE symbol = ANY($1) AND timeframe = $2 AND candle_time >= $3
          ORDER BY candle_time ASC
          LIMIT $4
        `;
        params = [aliases, cleanTf, start, limitNum];
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
            WHERE symbol = ANY($1) AND timeframe = $2
            ORDER BY candle_time DESC
            LIMIT $3
          ) sub
          ORDER BY candle_time ASC
        `;
        params = [aliases, cleanTf, limitNum];
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
        ORDER BY symbol ASC
      `);
      return res.rows.map(r => r.symbol);
    } catch {
      return [];
    } finally {
      if (client) client.release();
    }
  }
}
