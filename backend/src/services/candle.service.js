import { pool } from '../db.js';
import { convertToShanghaiTime } from '../parsers/universalTradeParser.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getSymbolAliases(sym) {
  const raw = String(sym || '').trim();
  const upper = raw.toUpperCase();
  const set = new Set([raw, upper]);
  
  // Chinese name and standard ticker mappings
  if (/原油|USOIL|WTI|XTI|CRUDE|OIL/i.test(raw)) {
    ['USOIL', 'WTI', 'XTIUSD', 'USOUSD', 'CRUDE', 'OIL', '美国原油 - 现货.', '美国原油', '原油'].forEach(s => set.add(s));
  }
  if (/布伦特|UKOIL|BRENT|XBR/i.test(raw)) {
    ['UKOIL', 'BRENT', 'XBRUSD', 'BRENTCRUDE', '英国原油 - 现货.', '英国原油', '布伦特原油'].forEach(s => set.add(s));
  }
  if (/纳斯达克|NAS100|US100|USTEC|NDX|NASDAQ/i.test(raw)) {
    ['NAS100', 'US100', 'USTEC', 'NDX', 'NASDAQ', '纳斯达克100', '纳斯达克'].forEach(s => set.add(s));
  }
  if (/道琼斯|US30|DJ30|WS30|WALLSTREET/i.test(raw)) {
    ['US30', 'DJ30', 'WS30', 'WALLSTREET', '道琼斯指数', '道琼斯'].forEach(s => set.add(s));
  }
  if (/标普|US500|SPX|SP500/i.test(raw)) {
    ['US500', 'SPX500', 'SP500', 'SPX', '标普500', '标普'].forEach(s => set.add(s));
  }
  if (/黄金|XAU|GOLD/i.test(raw)) {
    ['XAUUSD', 'GOLD', '现货黄金', '黄金'].forEach(s => set.add(s));
  }
  if (/白银|XAG|SILVER/i.test(raw)) {
    ['XAGUSD', 'SILVER', '现货白银', '白银'].forEach(s => set.add(s));
  }
  if (/比特币|BTC/i.test(raw)) {
    ['BTCUSD', 'BTCUSDT', 'BTC', '比特币'].forEach(s => set.add(s));
  }
  if (/以太坊|ETH/i.test(raw)) {
    ['ETHUSD', 'ETHUSDT', 'ETH', '以太坊'].forEach(s => set.add(s));
  }
  if (/德指|DAX|GER40|GER30/i.test(raw)) {
    ['GER40', 'DAX', 'GER30', 'DAX40', '德国40', '德指'].forEach(s => set.add(s));
  }
  if (/日经|JP225|N225/i.test(raw)) {
    ['JP225', 'N225', '日经225', '日经'].forEach(s => set.add(s));
  }
  if (/恒生|HK50|HSI/i.test(raw)) {
    ['HK50', 'HSI', '恒生指数', '恒生'].forEach(s => set.add(s));
  }

  // Strip broker suffixes (.m, .raw, .ecn, .pro, _i, .cash, trailing dot)
  const stripped = upper.replace(/\.(CASH|RAW|ECN|PRO|M|STD|I)$/i, '').replace(/[_.-]$/, '');
  if (stripped) set.add(stripped);

  return Array.from(set);
}

export class CandleService {
  /**
   * Helper to query rows from market_candles
   */
  static async queryRows(client, aliases, cleanTf, limitNum, start = null, end = null) {
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
    return res.rows || [];
  }

  /**
   * Mathematically aggregate base candles (e.g. M5) into higher timeframe candles (e.g. M15, H1, H4, D1)
   */
  static aggregateCandles(candles, targetMins) {
    if (!Array.isArray(candles) || candles.length === 0) return [];
    const stepSec = targetMins * 60;
    const groups = new Map();

    for (const c of candles) {
      const ts = typeof c.timestamp === 'number' && !isNaN(c.timestamp)
        ? c.timestamp
        : Math.floor(new Date(c.time).getTime() / 1000);
      
      const bucketTs = Math.floor(ts / stepSec) * stepSec;
      if (!groups.has(bucketTs)) {
        groups.set(bucketTs, []);
      }
      groups.get(bucketTs).push({ ...c, ts });
    }

    const pad = (n) => String(n).padStart(2, '0');
    const aggregated = [];

    for (const [bucketTs, barList] of groups.entries()) {
      barList.sort((a, b) => a.ts - b.ts);
      const open = barList[0].open;
      const close = barList[barList.length - 1].close;
      const high = Math.max(...barList.map(b => b.high));
      const low = Math.min(...barList.map(b => b.low));
      const volume = barList.reduce((sum, b) => sum + (parseInt(b.volume) || 0), 0);

      const d = new Date(bucketTs * 1000);
      const timeStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

      aggregated.push({
        time: timeStr,
        timestamp: bucketTs,
        open: parseFloat(open.toFixed(5)),
        high: parseFloat(high.toFixed(5)),
        low: parseFloat(low.toFixed(5)),
        close: parseFloat(close.toFixed(5)),
        volume,
      });
    }

    aggregated.sort((a, b) => a.timestamp - b.timestamp);
    return aggregated;
  }

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

    // Prepare and sanitize candle records
    const preparedCandles = [];
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

      preparedCandles.push({
        symbol: cleanSymbol,
        timeframe: cleanTf,
        candleTime,
        ts,
        open,
        high,
        low,
        close,
        volume,
      });
    }

    if (preparedCandles.length === 0) {
      return { insertedCount: 0 };
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let insertedCount = 0;
      // Process in chunks of 100 to minimize DB roundtrips while staying well within parameter limits
      const chunkSize = 100;
      for (let i = 0; i < preparedCandles.length; i += chunkSize) {
        const chunk = preparedCandles.slice(i, i + chunkSize);
        const valueClauses = [];
        const params = [];

        chunk.forEach((c, idx) => {
          const offset = idx * 9;
          valueClauses.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`);
          params.push(c.symbol, c.timeframe, c.candleTime, c.ts, c.open, c.high, c.low, c.close, c.volume);
        });

        const queryStr = `
          INSERT INTO market_candles (symbol, timeframe, candle_time, timestamp, open, high, low, close, volume)
          VALUES ${valueClauses.join(', ')}
          ON CONFLICT (symbol, timeframe, candle_time) 
          DO UPDATE SET 
            open = EXCLUDED.open,
            high = EXCLUDED.high,
            low = EXCLUDED.low,
            close = EXCLUDED.close,
            volume = EXCLUDED.volume,
            timestamp = EXCLUDED.timestamp
        `;

        await client.query(queryStr, params);
        insertedCount += chunk.length;
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
   * Clear candles from database, optionally filtered by symbol and/or timeframe.
   */
  static async clearCandles({ symbol, timeframe } = {}) {
    let client;
    try {
      client = await pool.connect();
      let queryStr = 'DELETE FROM market_candles';
      const params = [];
      const whereClauses = [];

      if (symbol) {
        const aliases = getSymbolAliases(symbol);
        params.push(aliases);
        whereClauses.push(`symbol = ANY($${params.length})`);
      }
      if (timeframe) {
        params.push(String(timeframe).trim().toUpperCase());
        whereClauses.push(`timeframe = $${params.length}`);
      }
      if (whereClauses.length > 0) {
        queryStr += ' WHERE ' + whereClauses.join(' AND ');
      }

      const res = await client.query(queryStr, params);
      return { deletedCount: res.rowCount || 0 };
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Retrieve historical candles from database.
   * Supports symbol alias lookup, exact start/end window retrieval,
   * and multi-timeframe aggregation from synchronized base candles.
   */
  static async getCandles({ symbol, timeframe, count = 300, start = null, end = null }) {
    const aliases = getSymbolAliases(symbol);
    const cleanTf = String(timeframe).trim().toUpperCase();
    const limitNum = Math.min(Math.max(parseInt(count) || 300, 10), 10000);

    let client;
    try {
      client = await pool.connect();

      // 1. First attempt: Direct query for exact timeframe
      let rows = await this.queryRows(client, aliases, cleanTf, limitNum, start, end);

      // If start && end yielded 0 rows, try without strict date bounds in case of slight offset
      if (rows.length === 0 && start && end) {
        rows = await this.queryRows(client, aliases, cleanTf, limitNum, null, null);
      }

      if (rows.length > 0) {
        return rows;
      }

      // 2. If exact timeframe has no synced candles, check if a base timeframe (M5 or M1) is available to aggregate
      const tfMinutesMap = { 'M1': 1, 'M5': 5, 'M15': 15, 'M30': 30, 'H1': 60, 'H4': 240, 'D1': 1440 };
      const targetMins = tfMinutesMap[cleanTf] || 5;

      const baseCandidates = ['M5', 'M1', 'M15', 'H1'];
      for (const baseTf of baseCandidates) {
        if (baseTf === cleanTf) continue;
        const baseMins = tfMinutesMap[baseTf] || 5;
        if (targetMins > baseMins) {
          const mult = Math.ceil(targetMins / baseMins);
          const baseLimit = Math.min(limitNum * mult, 10000);
          let baseRows = await this.queryRows(client, aliases, baseTf, baseLimit, start, end);
          if (baseRows.length === 0 && start && end) {
            baseRows = await this.queryRows(client, aliases, baseTf, baseLimit, null, null);
          }
          if (baseRows.length > 0) {
            return this.aggregateCandles(baseRows, targetMins);
          }
        }
      }

      return [];
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

  /**
   * Fetch subsequent M5 candles for a trade, from DB market_candles or fallback to MT5 script
   */
  static async fetchCandlesForTrade(trade) {
    const symbol = trade.symbol;
    const exitTime = trade.exit_time || trade.exitTime;
    const entryPrice = trade.entryprice || trade.entryPrice;

    if (!symbol || !exitTime) return [];

    let candles = await this.getCandles({
      symbol,
      timeframe: 'M5',
      count: 288,
      start: exitTime,
    });

    if (candles && candles.length > 0) {
      return candles;
    }

    try {
      const scriptPath = path.join(__dirname, '../../scripts/mt5_candles.py');
      const args = [scriptPath, '--symbol', symbol, '--timeframe', 'M5', '--count', '288', '--start', exitTime];
      if (entryPrice) args.push('--price', String(entryPrice));
      const { stdout } = await execFileAsync('python', args, {
        timeout: 10000,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      });
      const data = JSON.parse(stdout);
      if (data && Array.isArray(data.candles)) {
        return data.candles;
      }
    } catch (err) {
      // Fallback failed or python not configured
    }

    return [];
  }

  /**
   * Evaluate whether post-exit candles hit Take Profit or Stop Loss first
   */
  static evaluateFinalTriggerFromCandles({ direction, stopLoss, takeProfit, exitTime, candles }) {
    if (!candles || candles.length === 0) return null;
    const sl = parseFloat(stopLoss);
    const tp = parseFloat(takeProfit);
    if (isNaN(sl) || isNaN(tp)) return null;

    const isLong = String(direction || '').toLowerCase() === 'long' || String(direction || '').toLowerCase() === 'buy';

    let exitTs = 0;
    if (exitTime) {
      const normalized = String(exitTime).replace(' ', 'T');
      const d = new Date(normalized);
      if (!isNaN(d.getTime())) {
        exitTs = d.getTime();
      }
    }

    for (const c of candles) {
      const candleTs = typeof c.timestamp === 'number' && c.timestamp > 0
        ? (c.timestamp < 1e11 ? c.timestamp * 1000 : c.timestamp)
        : new Date(String(c.time).replace(' ', 'T')).getTime();

      // Only inspect candles after exitTime
      if (exitTs > 0 && !isNaN(candleTs) && candleTs < exitTs - 60000) {
        continue;
      }

      const high = Number(c.high);
      const low = Number(c.low);
      const open = c.open !== undefined ? Number(c.open) : low;
      const close = c.close !== undefined ? Number(c.close) : high;

      if (isNaN(high) || isNaN(low)) continue;

      if (isLong) {
        const hitTP = high >= tp;
        const hitSL = low <= sl;
        if (hitTP && !hitSL) return 'takeProfit';
        if (hitSL && !hitTP) return 'stopLoss';
        if (hitTP && hitSL) {
          return close >= open ? 'stopLoss' : 'takeProfit';
        }
      } else {
        const hitTP = low <= tp;
        const hitSL = high >= sl;
        if (hitTP && !hitSL) return 'takeProfit';
        if (hitSL && !hitTP) return 'stopLoss';
        if (hitTP && hitSL) {
          return close <= open ? 'stopLoss' : 'takeProfit';
        }
      }
    }

    return null;
  }
}
