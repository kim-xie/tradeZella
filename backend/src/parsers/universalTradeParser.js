import Papa from 'papaparse';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Clean a string into a float, or return null if not valid
 */
export function cleanNumber(val) {
  if (val === undefined || val === null || val === '') return null;
  const cleaned = String(val).replace(/[^0-9.-]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Standardize trade direction into 'long' | 'short'
 */
export function parseDirection(val) {
  if (!val) return 'long';
  const s = String(val).toLowerCase().trim();
  if (s.includes('sell') || s.includes('short') || s.includes('卖') || s === '1') {
    return 'short';
  }
  return 'long';
}

/**
 * Automatically derive market session from entry time (Asia / Europe / US)
 */
export function calculateMarketSession(entryTime) {
  if (!entryTime) return null;
  let hour;
  if (entryTime instanceof Date) {
    hour = entryTime.getHours();
  } else {
    const str = String(entryTime).trim();
    const match = str.match(/[T\s](\d{1,2}):/);
    if (!match) return null;
    hour = parseInt(match[1], 10);
  }
  if (isNaN(hour)) return null;

  if (hour >= 8 && hour < 15) return 'Asia';
  if (hour >= 15 && hour < 21) return 'Europe';
  return 'US';
}

/**
 * Checks if a given year, month (1-12), day, hour falls within US Daylight Saving Time (DST).
 * Standard MT4/MT5 Forex/CFD brokers follow US DST calendar:
 * Starts on the second Sunday of March at 02:00,
 * Ends on the first Sunday of November at 02:00.
 */
export function isUSDST(year, month, day, hour = 0) {
  if (month < 3 || month > 11) return false;
  if (month > 3 && month < 11) return true;

  if (month === 3) {
    const march1DayOfWeek = new Date(Date.UTC(year, 2, 1)).getUTCDay();
    const firstSunday = 1 + ((7 - march1DayOfWeek) % 7);
    const secondSunday = firstSunday + 7;
    if (day < secondSunday) return false;
    if (day > secondSunday) return true;
    return hour >= 2;
  }

  if (month === 11) {
    const nov1DayOfWeek = new Date(Date.UTC(year, 10, 1)).getUTCDay();
    const firstSunday = 1 + ((7 - nov1DayOfWeek) % 7);
    if (day < firstSunday) return true;
    if (day > firstSunday) return false;
    return hour < 2;
  }

  return false;
}

/**
 * Converts a raw date string into Shanghai Time (Asia/Shanghai, UTC+8) in ISO format (YYYY-MM-DDTHH:mm:ss).
 * Supported source timezones:
 * - 'broker' | 'mt' | 'eet': MT4/MT5 Broker Server Time (EET/EEST with US DST: winter UTC+2 -> +6h, summer UTC+3 -> +5h)
 * - 'utc' | 'gmt': UTC (UTC+0 -> +8h)
 * - 'shanghai' | 'beijing' | 'none': Already Shanghai time (+0h)
 * - 'est' | 'us_eastern': US Eastern Time (winter UTC-5 -> +13h, summer UTC-4 -> +12h)
 * - number or numeric string: explicit offset hours to add (e.g. 6 or "+6")
 */
export function convertToShanghaiTime(val, sourceTimezone = 'broker') {
  if (!val) return null;
  const raw = String(val).trim();
  const match = raw.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
  if (!match) {
    try {
      const s = raw.replace(/\./g, '-').replace(/\//g, '-');
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      }
    } catch {}
    return raw;
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const hour = parseInt(match[4], 10);
  const minute = parseInt(match[5], 10);
  const second = match[6] ? parseInt(match[6], 10) : 0;

  let offsetHours = 0;
  const tz = String(sourceTimezone || 'broker').toLowerCase().trim();

  if (tz === 'broker' || tz === 'mt' || tz === 'eet') {
    const inDST = isUSDST(year, month, day, hour);
    offsetHours = inDST ? 5 : 6;
  } else if (tz === 'utc' || tz === 'gmt' || tz === 'z') {
    offsetHours = 8;
  } else if (tz === 'shanghai' || tz === 'beijing' || tz === 'none' || tz === 'cst' || tz === 'utc+8' || tz === 'gmt+8') {
    offsetHours = 0;
  } else if (tz === 'est' || tz === 'us_eastern' || tz === 'edt') {
    const inDST = isUSDST(year, month, day, hour);
    offsetHours = inDST ? 12 : 13;
  } else if (/^[+-]?\d+$/.test(tz)) {
    offsetHours = parseInt(tz, 10);
  } else {
    const inDST = isUSDST(year, month, day, hour);
    offsetHours = inDST ? 5 : 6;
  }

  const d = new Date(Date.UTC(year, month - 1, day, hour + offsetHours, minute, second));
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/**
 * Standardize date string into ISO YYYY-MM-DDTHH:mm:ss format, converting to Shanghai Time by default
 */
export function parseDateISO(val, sourceTimezone = 'broker') {
  if (!val) return null;
  return convertToShanghaiTime(val, sourceTimezone);
}

/**
 * Decodes buffer into string, auto-detecting BOM, HTML meta charset, UTF-8, GBK, Windows-1252
 */
export function decodeBufferToString(buffer) {
  if (!buffer || buffer.length === 0) return '';

  // Check UTF-16 LE BOM (0xFF 0xFE)
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    try {
      return new TextDecoder('utf-16le').decode(buffer);
    } catch {
      // fallback
    }
  }

  // Check UTF-16 BE BOM (0xFE 0xFF)
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    try {
      return new TextDecoder('utf-16be').decode(buffer);
    } catch {
      // fallback
    }
  }

  // Check UTF-8 BOM (0xEF 0xBB 0xBF)
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    try {
      return new TextDecoder('utf-8').decode(buffer.subarray(3));
    } catch {
      // fallback
    }
  }

  // Inspect first 2048 bytes for charset meta
  const sample = buffer.subarray(0, Math.min(2048, buffer.length)).toString('latin1');
  const charsetMatch = sample.match(/charset=["']?([a-zA-Z0-9_-]+)/i);
  if (charsetMatch) {
    const cs = charsetMatch[1].toLowerCase();
    if (cs.includes('gb2312') || cs.includes('gbk') || cs.includes('gb18030')) {
      try {
        return new TextDecoder('gbk').decode(buffer);
      } catch {}
    } else if (cs.includes('windows-1252') || cs.includes('iso-8859-1')) {
      try {
        return new TextDecoder('windows-1252').decode(buffer);
      } catch {}
    } else if (cs.includes('utf-8')) {
      try {
        return new TextDecoder('utf-8').decode(buffer);
      } catch {}
    }
  }

  // Try strict UTF-8 first
  try {
    const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
    return utf8Decoder.decode(buffer);
  } catch {
    // If strict UTF-8 fails, try GBK (common for Chinese MT4/MT5 Windows exports)
    try {
      const gbkDecoder = new TextDecoder('gbk');
      return gbkDecoder.decode(buffer);
    } catch {
      // Fallback to latin1 / windows-1252
      return new TextDecoder('windows-1252').decode(buffer);
    }
  }
}

/**
 * Decode HTML entities like &nbsp;, &amp;, &#39;, etc.
 */
function decodeHTMLEntities(text) {
  if (!text) return '';
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .trim();
}

/**
 * Extracts 2D array of rows from an HTML string
 */
export function extractRowsFromHTML(htmlContent) {
  const rows = [];
  
  // Clean comments and scripts
  const cleanHtml = htmlContent
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  // Extract all table rows <tr>...</tr>
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;

  let inClosedTradesSection = true; // default true for simple reports
  let seenMT4Header = false;
  let seenMT5Header = false;
  let mt5PositionsDone = false;

  while ((trMatch = trRegex.exec(cleanHtml)) !== null) {
    const rowHtml = trMatch[1];
    
    // Extract cells (<td> or <th>)
    const cellRegex = /<(t[dh])([^>]*)>([\s\S]*?)<\/\1>/gi;
    const cellValues = [];
    let cellMatch;

    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      const attrs = cellMatch[2] || '';
      // 过滤 MT5 折叠占位隐藏单元格 (class="hidden")
      if (/\bclass\s*=\s*["'][^"']*\bhidden\b[^"']*["']/i.test(attrs)) {
        continue;
      }
      let cellText = cellMatch[3];
      // strip nested HTML tags like <b>, <span>, <div>, <font>
      cellText = cellText.replace(/<[^>]+>/g, ' ');
      cellText = decodeHTMLEntities(cellText).replace(/\s+/g, ' ').trim();
      cellValues.push(cellText);
    }

    if (cellValues.length === 0 || !cellValues.some(c => c.length > 0)) {
      continue;
    }

    const rowTextLower = cellValues.join(' ').toLowerCase();

    // Check MT4 section headers
    if (rowTextLower.includes('closed transactions:') || rowTextLower.includes('已平仓交易')) {
      inClosedTradesSection = true;
      continue;
    }

    // Check MT5 Positions section headers
    if (
      !mt5PositionsDone &&
      (rowTextLower === '持仓' || rowTextLower === 'positions' || (rowTextLower.includes('持仓') && cellValues.length <= 2)) &&
      !rowTextLower.includes('盈利')
    ) {
      inClosedTradesSection = true;
      continue;
    }

    // Stop at MT4/MT5 non-position sections (Open Trades, Orders, Deals, Summary)
    if (
      rowTextLower.includes('open trades:') ||
      rowTextLower.includes('未平仓交易') ||
      rowTextLower.includes('working orders:') ||
      rowTextLower.includes('挂单交易') ||
      rowTextLower.includes('summary:') ||
      rowTextLower.includes('总结:') ||
      rowTextLower.includes('closed p/l:') ||
      rowTextLower.includes('已结盈亏:') ||
      rowTextLower === '订单' || rowTextLower === 'orders' || (rowTextLower.includes('订单') && cellValues.length <= 2) ||
      rowTextLower === '成交' || rowTextLower === 'deals' || (rowTextLower.includes('成交') && cellValues.length <= 2)
    ) {
      if (seenMT5Header) {
        mt5PositionsDone = true;
        inClosedTradesSection = false;
      } else if (seenMT4Header) {
        inClosedTradesSection = false;
      }
    }

    // Check if this row is an MT5 Positions header (contains '持仓' or 'position' + '价位' or 'price' + '盈利' or 'profit')
    if (
      !mt5PositionsDone &&
      (rowTextLower.includes('持仓') || rowTextLower.includes('position')) &&
      (rowTextLower.includes('价位') || rowTextLower.includes('price'))
    ) {
      seenMT5Header = true;
      inClosedTradesSection = true;
    } else if (
      !mt5PositionsDone && !seenMT5Header &&
      (rowTextLower.includes('ticket') || rowTextLower.includes('订单')) &&
      (rowTextLower.includes('price') || rowTextLower.includes('价格') || rowTextLower.includes('type') || rowTextLower.includes('类型'))
    ) {
      seenMT4Header = true;
      inClosedTradesSection = true;
    }

    if (inClosedTradesSection) {
      rows.push(cellValues);
    }
  }

  return rows;
}

/**
 * Extracts 2D array of rows from MT5 SpreadsheetML XML (<Workbook>...<Worksheet>...<Table>...<Row>)
 */
export function extractRowsFromSpreadsheetML(xmlContent) {
  const rows = [];
  const rowRegex = /<Row[^>]*>([\s\S]*?)<\/Row>/gi;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(xmlContent)) !== null) {
    const rowXml = rowMatch[1];
    const cellRegex = /<Cell[^>]*>([\s\S]*?)<\/Cell>/gi;
    const cells = [];
    let cellMatch;

    while ((cellMatch = cellRegex.exec(rowXml)) !== null) {
      const cellContent = cellMatch[1];
      const dataMatch = cellContent.match(/<Data[^>]*>([\s\S]*?)<\/Data>/i);
      let text = '';
      if (dataMatch) {
        text = dataMatch[1];
      } else {
        text = cellContent.replace(/<[^>]+>/g, '');
      }
      cells.push(decodeHTMLEntities(text).trim());
    }

    if (cells.length > 0 && cells.some(c => c.length > 0)) {
      rows.push(cells);
    }
  }

  return rows;
}

/**
 * Parses XLSX buffer using Python helper
 */
async function parseXLSXBuffer(buffer) {
  const tempPath = path.join(os.tmpdir(), `tradezen_upload_${Date.now()}_${Math.random().toString(36).substring(7)}.xlsx`);
  await fs.promises.writeFile(tempPath, buffer);
  try {
    const scriptPath = path.join(__dirname, '../../scripts/parse_xlsx.py');
    const { stdout, stderr } = await execFileAsync('python', [scriptPath, tempPath], {
      timeout: 15000,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });

    if (stderr && !stdout) {
      throw new Error(`XLSX parser error: ${stderr}`);
    }

    const rows = JSON.parse(stdout || '[]');
    return rows;
  } finally {
    try {
      await fs.promises.unlink(tempPath);
    } catch {}
  }
}

/**
 * Core Normalizer: Converts raw 2D row array into normalized Trade objects
 */
export function normalizeRowsToTrades(rows, detectedFormat = 'UNKNOWN', originalFilename = '', options = {}) {
  if (!rows || rows.length < 2) {
    throw new Error('报表数据为空或行数过少，无法解析。');
  }

  const timezone = options.timezone || 'broker';

  // 1. Locate the header row
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(25, rows.length); i++) {
    const rowStr = rows[i].join(' ').toLowerCase();
    const hasSymbol =
      rowStr.includes('symbol') ||
      rowStr.includes('item') ||
      rowStr.includes('商品交易代码') ||
      rowStr.includes('交易品种') ||
      rowStr.includes('品种') ||
      rowStr.includes('contract') ||
      rowStr.includes('market') ||
      rowStr.includes('pair');

    const hasMetrics =
      rowStr.includes('price') ||
      rowStr.includes('价格') ||
      rowStr.includes('volume') ||
      rowStr.includes('交易量') ||
      rowStr.includes('type') ||
      rowStr.includes('类型') ||
      rowStr.includes('size') ||
      rowStr.includes('手数') ||
      rowStr.includes('lots') ||
      rowStr.includes('qty') ||
      rowStr.includes('amount') ||
      rowStr.includes('side');

    if (hasSymbol && hasMetrics) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error('未在上传的报表文件中检测到有效的交易记录表头（缺少交易品种/类型/价格列）。');
  }

  const rawHeaders = rows[headerRowIndex].map(h => String(h || '').trim());
  const lowerHeaders = rawHeaders.map(h => h.toLowerCase());

  // Determine platform
  let platform = 'CSV';
  const fname = originalFilename.toLowerCase();
  
  const hasMT5Headers = lowerHeaders.some(h => h.includes('position') || h.includes('持仓') || h.includes('deal') || h.includes('成交'));
  const hasMT4Headers = lowerHeaders.some(h => h.includes('taxes') || h.includes('税') || h === 'item' || h.includes('商品交易代码'));

  if (hasMT5Headers || fname.includes('mt5')) {
    platform = 'MT5';
  } else if (hasMT4Headers || fname.includes('mt4') || lowerHeaders.some(h => h.includes('ticket') || h.includes('订单'))) {
    platform = 'MT4';
  } else if (lowerHeaders.some(h => h.includes('manualpnl') || h.includes('manual_pnl'))) {
    platform = 'TradeZen';
  }

  // Find column indices
  const symbolIdx = lowerHeaders.findIndex(h =>
    h.includes('symbol') ||
    h === 'item' ||
    h.includes('商品交易代码') ||
    h.includes('交易品种') ||
    h.includes('品种') ||
    h.includes('contract') ||
    h.includes('market') ||
    h.includes('pair')
  );

  const typeIdx = lowerHeaders.findIndex(h =>
    h.includes('type') ||
    h.includes('类型') ||
    h.includes('direction') ||
    h.includes('action') ||
    h.includes('side')
  );

  const sizeIdx = lowerHeaders.findIndex(h =>
    h.includes('volume') ||
    h.includes('交易量') ||
    h.includes('size') ||
    h.includes('手数') ||
    h.includes('lots') ||
    h.includes('shares') ||
    h.includes('qty') ||
    h.includes('amount') ||
    h.includes('executed')
  );

  let openPriceIdx = -1;
  let closePriceIdx = -1;
  let openTimeIdx = -1;
  let closeTimeIdx = -1;

  lowerHeaders.forEach((h, idx) => {
    // Open Price
    if (
      h.includes('entryprice') ||
      h.includes('openprice') ||
      h.includes('open price') ||
      h.includes('entry price') ||
      h.includes('开仓价') ||
      h.includes('开仓价格') ||
      h.includes('avg entry') ||
      h.includes('order price')
    ) {
      openPriceIdx = idx;
    } else if (
      h.includes('exitprice') ||
      h.includes('closeprice') ||
      h.includes('close price') ||
      h.includes('exit price') ||
      h.includes('平仓价') ||
      h.includes('平仓价格') ||
      h.includes('avg exit') ||
      h.includes('exec price') ||
      h.includes('avgprice')
    ) {
      closePriceIdx = idx;
    } else if (h === 'price' || h === '价格' || h === '价位' || h.includes('价位')) {
      if (openPriceIdx === -1) openPriceIdx = idx;
      else if (closePriceIdx === -1) closePriceIdx = idx;
    }

    // Open Time
    if (
      h.includes('entrytime') ||
      h.includes('opentime') ||
      h.includes('open time') ||
      h.includes('entry time') ||
      h.includes('开仓时间') ||
      h.includes('trade_date') ||
      h.includes('date(utc)') ||
      h.includes('trade time') ||
      h.includes('created time') ||
      h === 'date' ||
      h === '日期'
    ) {
      openTimeIdx = idx;
    } else if (
      h.includes('exittime') ||
      h.includes('closetime') ||
      h.includes('close time') ||
      h.includes('exit time') ||
      h.includes('平仓时间') ||
      h.includes('closed time') ||
      h.includes('updated time')
    ) {
      closeTimeIdx = idx;
    } else if (h === 'time' || h === '时间') {
      if (openTimeIdx === -1) openTimeIdx = idx;
      else if (closeTimeIdx === -1) closeTimeIdx = idx;
    }
  });

  if (openPriceIdx === -1 && closePriceIdx !== -1) {
    openPriceIdx = closePriceIdx;
  }

  // S/L and T/P (handling Chinese MT4 where '获利' appears twice: first is TP, last is Profit)
  const slIdx = lowerHeaders.findIndex(h =>
    h.includes('s / l') ||
    h.includes('s/l') ||
    h.includes('止损') ||
    h.includes('stoploss') ||
    h.includes('stop_loss') ||
    h === 'sl'
  );

  const tpIdx = lowerHeaders.findIndex((h, idx) =>
    (h.includes('t / p') ||
     h.includes('t/p') ||
     h.includes('止盈') ||
     h.includes('takeprofit') ||
     h.includes('take_profit') ||
     (h === '获利' && (slIdx >= 0 && Math.abs(idx - slIdx) <= 2)) || // next to S/L in Chinese MT4
     h === 'tp') &&
    !h.includes('profit factor')
  );

  const profitIdx = lowerHeaders.findLastIndex((h, idx) =>
    idx !== tpIdx && (
      h.includes('profit') ||
      h.includes('利润') ||
      h.includes('pnl') ||
      h.includes('manual_pnl') ||
      h.includes('realized') ||
      h.includes('获利') ||
      h.includes('盈利')
    )
  );

  const swapIdx = lowerHeaders.findIndex(h =>
    h.includes('swap') ||
    h.includes('库存费') ||
    h.includes('隔夜利息') ||
    h.includes('利息')
  );

  const commissionIdx = lowerHeaders.findIndex(h =>
    h.includes('commission') ||
    h.includes('佣金') ||
    h.includes('fee') ||
    h.includes('手续费') ||
    h.includes('fee paid')
  );

  const taxesIdx = lowerHeaders.findIndex(h =>
    h.includes('tax') ||
    h.includes('税')
  );

  const posIdIdx = lowerHeaders.findIndex(h =>
    h.includes('position') ||
    h.includes('ticket') ||
    h.includes('持仓') ||
    h.includes('订单') ||
    h.includes('单号') ||
    h.includes('deal') ||
    h.includes('order id') ||
    h.includes('trade id')
  );

  const commentIdx = lowerHeaders.findIndex(h =>
    h.includes('comment') ||
    h.includes('备注') ||
    h.includes('note') ||
    h.includes('notes')
  );

  if (symbolIdx === -1 || (sizeIdx === -1 && openPriceIdx === -1)) {
    throw new Error('报表缺少必要字段（未识别到 品种、手数 或 价格列）。');
  }

  const trades = [];

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const symbolRaw = row[symbolIdx] ? String(row[symbolIdx]).trim() : '';
    const symbolLower = symbolRaw.toLowerCase();

    // Skip summary / balance / non-trade rows
    if (
      !symbolRaw ||
      symbolLower.includes('total') ||
      symbolLower.includes('summary') ||
      symbolLower.includes('balance') ||
      symbolLower.includes('deposit') ||
      symbolLower.includes('credit') ||
      symbolLower.includes('入金') ||
      symbolLower.includes('出金') ||
      symbolLower.includes('总结') ||
      symbolLower.includes('已结盈亏') ||
      symbolLower.includes('closed p/l') ||
      symbolLower === 'symbol' ||
      symbolLower === '品种' ||
      symbolLower === '交易品种' ||
      /^-?\d+(\.\d+)?$/.test(symbolRaw)
    ) {
      continue;
    }

    const rawType = typeIdx >= 0 ? String(row[typeIdx] || '').trim().toLowerCase() : 'buy';
    
    // Ignore non-executed pending order types
    if (rawType.includes('limit') || rawType.includes('stop') && !rawType.includes('loss')) {
      if (!rawType.includes('buy') && !rawType.includes('sell')) {
        continue;
      }
    }

    const direction = parseDirection(rawType);
    const size = sizeIdx >= 0 ? cleanNumber(row[sizeIdx]) : 1.0;
    const entryPrice = openPriceIdx >= 0 ? cleanNumber(row[openPriceIdx]) : null;
    const exitPrice = closePriceIdx >= 0 ? cleanNumber(row[closePriceIdx]) : (entryPrice || 0);

    if (!symbolRaw || entryPrice === null || !size) {
      continue;
    }

    const rawProfit = profitIdx >= 0 ? cleanNumber(row[profitIdx]) : null;
    const swap = swapIdx >= 0 ? (cleanNumber(row[swapIdx]) || 0) : 0;
    const commission = commissionIdx >= 0 ? (cleanNumber(row[commissionIdx]) || 0) : 0;
    const taxes = taxesIdx >= 0 ? (cleanNumber(row[taxesIdx]) || 0) : 0;

    let manualPnl = null;
    if (rawProfit !== null) {
      manualPnl = Math.round((rawProfit + swap + commission + taxes) * 100) / 100;
    }

    const entryTime = openTimeIdx >= 0 ? convertToShanghaiTime(row[openTimeIdx], timezone) : null;
    const exitTime = closeTimeIdx >= 0 ? convertToShanghaiTime(row[closeTimeIdx], timezone) : (entryTime || null);
    const stopLoss = slIdx >= 0 ? cleanNumber(row[slIdx]) : null;
    const takeProfit = tpIdx >= 0 ? cleanNumber(row[tpIdx]) : null;

    const posId = posIdIdx >= 0 ? String(row[posIdIdx] || '').trim() : '';
    const comment = commentIdx >= 0 ? String(row[commentIdx] || '').trim() : '';
    const notes = [posId ? `Ticket/ID: ${posId}` : '', comment].filter(Boolean).join(' | ');

    let finalTrigger = null;
    if (comment.toLowerCase().includes('[sl') || comment.toLowerCase().includes('stop loss') || comment.includes('止损')) {
      finalTrigger = 'stopLoss';
    } else if (comment.toLowerCase().includes('[tp') || comment.toLowerCase().includes('take profit') || comment.includes('止盈')) {
      finalTrigger = 'takeProfit';
    }

    trades.push({
      ticket: posId || null,
      symbol: symbolRaw.toUpperCase(),
      direction,
      size,
      entryPrice,
      exitPrice,
      entryTime,
      exitTime,
      tradeDate: exitTime || entryTime || new Date().toISOString(),
      manualPnl,
      stopLoss,
      takeProfit,
      notes: notes || `${platform} 导入交易记录`,
      tags: [platform, symbolRaw.toUpperCase()],
      session: calculateMarketSession(entryTime),
      finalTrigger,
    });
  }

  return {
    platform,
    trades,
    totalFound: trades.length,
  };
}

/**
 * Universal Trade File Parser:
 * Accepts buffer & filename, auto-detects format (HTML, XML SpreadsheetML, XLSX, CSV, TSV),
 * decodes and normalizes into trade objects. Supports timezone conversion to Shanghai time.
 */
export async function parseUniversalTradeFile(buffer, originalFilename = '', options = {}) {
  if (!buffer || buffer.length === 0) {
    throw new Error('上传的文件为空。');
  }

  const fname = originalFilename.toLowerCase();

  // 1. Check if binary XLSX (magic bytes PK\x03\x04 or .xlsx extension)
  const isZipMagic = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  if (isZipMagic || fname.endsWith('.xlsx')) {
    const rows = await parseXLSXBuffer(buffer);
    return normalizeRowsToTrades(rows, 'MT5/Excel (XLSX)', originalFilename, options);
  }

  // 2. Decode text buffer
  const textContent = decodeBufferToString(buffer);
  const textLower = textContent.toLowerCase();

  // 3. Check if XML / SpreadsheetML (<Workbook> or <?xml)
  if (
    (textContent.includes('<?xml') && (textContent.includes('<Workbook') || textContent.includes('<Worksheet'))) ||
    fname.endsWith('.xml')
  ) {
    const rows = extractRowsFromSpreadsheetML(textContent);
    return normalizeRowsToTrades(rows, 'MT5 XML (SpreadsheetML)', originalFilename, options);
  }

  // 4. Check if HTML (<html, <!DOCTYPE, <table, Statement:, Report)
  if (
    textLower.includes('<html') ||
    textLower.includes('<!doctype') ||
    textLower.includes('<table') ||
    textLower.includes('statement:') ||
    textLower.includes('report') ||
    fname.endsWith('.html') ||
    fname.endsWith('.htm')
  ) {
    const rows = extractRowsFromHTML(textContent);
    return normalizeRowsToTrades(rows, 'MT4/MT5 HTML', originalFilename, options);
  }

  // 5. Delimited text (CSV, TSV, TXT)
  const parsed = Papa.parse(textContent, {
    header: false,
    skipEmptyLines: true,
  });

  return normalizeRowsToTrades(parsed.data, 'CSV/TSV', originalFilename, options);
}
