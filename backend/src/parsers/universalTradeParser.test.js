import {
  parseUniversalTradeFile,
  extractRowsFromHTML,
  extractRowsFromSpreadsheetML,
  decodeBufferToString,
} from './universalTradeParser.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Universal Trade Parser', () => {
  // Test 1: MT4 English HTML Statement
  test('should parse MT4 English HTML statement', async () => {
    const mt4Html = `
<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">
<html>
<head><title>Statement: 108239 - Trader Joe</title></head>
<body>
<table cellspacing=1 cellpadding=2 border=0 width=800>
  <tr bgcolor="#C0C0C0" align="right">
    <th>Ticket</th><th>Open Time</th><th>Type</th><th>Size</th><th>Item</th><th>Price</th><th>S / L</th><th>T / P</th><th>Close Time</th><th>Price</th><th>Commission</th><th>Taxes</th><th>Swap</th><th>Profit</th>
  </tr>
  <tr bgcolor="#FFFFFF" align="right">
    <td>10823901</td><td>2026.11.13 14:20:00</td><td>buy</td><td>0.50</td><td>EURUSD</td><td>1.08500</td><td>1.08200</td><td>1.09100</td><td>2026.11.13 18:35:10</td><td>1.08950</td><td>-3.50</td><td>0.00</td><td>0.00</td><td>225.00</td>
  </tr>
  <tr bgcolor="#FFFFFF" align="right">
    <td>10824055</td><td>2026.11.14 09:15:30</td><td>sell</td><td>1.00</td><td>GBPUSD</td><td>1.26800</td><td>1.27200</td><td>1.26200</td><td>2026.11.14 11:40:00</td><td>1.26420</td><td>-7.00</td><td>0.00</td><td>-1.20</td><td>380.00</td>
  </tr>
  <tr bgcolor="#C0C0C0" align="right">
    <td colspan=12><b>Closed P/L:</b></td><td colspan=2><b>605.00</b></td>
  </tr>
  <tr bgcolor="#C0C0C0" align="center">
    <th colspan=14><b>Open Trades:</b></th>
  </tr>
  <tr bgcolor="#FFFFFF" align="right">
    <td>10825000</td><td>2026.11.15 10:00:00</td><td>buy</td><td>0.10</td><td>USDJPY</td><td>154.20</td><td>0.00</td><td>0.00</td><td></td><td></td><td>0.00</td><td>0.00</td><td>0.00</td><td>10.00</td>
  </tr>
</table>
</body>
</html>
    `;

    const res = await parseUniversalTradeFile(Buffer.from(mt4Html, 'utf8'), 'Statement_108239.htm');
    expect(res.platform).toBe('MT4');
    expect(res.trades).toHaveLength(2); // Only closed trades, open trades skipped!

    const trade1 = res.trades[0];
    expect(trade1.ticket).toBe('10823901');
    expect(trade1.symbol).toBe('EURUSD');
    expect(trade1.direction).toBe('long');
    expect(trade1.size).toBe(0.5);
    expect(trade1.entryPrice).toBe(1.085);
    expect(trade1.exitPrice).toBe(1.0895);
    expect(trade1.entryTime).toBe('2026-11-13T14:20:00');
    expect(trade1.exitTime).toBe('2026-11-13T18:35:10');
    expect(trade1.manualPnl).toBe(221.5); // 225.00 - 3.50 commission
    expect(trade1.stopLoss).toBe(1.082);
    expect(trade1.takeProfit).toBe(1.091);

    const trade2 = res.trades[1];
    expect(trade2.ticket).toBe('10824055');
    expect(trade2.symbol).toBe('GBPUSD');
    expect(trade2.direction).toBe('short');
    expect(trade2.manualPnl).toBe(371.8); // 380 - 7 - 1.2
  });

  // Test 2: MT4 Chinese HTML Statement
  test('should parse MT4 Chinese HTML statement', async () => {
    const mt4CnHtml = `
<html>
<body>
<table>
  <tr>
    <th>订单</th><th>开仓时间</th><th>类型</th><th>手数</th><th>商品交易代码</th><th>价格</th><th>止损</th><th>获利</th><th>平仓时间</th><th>价格</th><th>佣金</th><th>税</th><th>利息</th><th>获利</th>
  </tr>
  <tr>
    <td>88776655</td><td>2026.11.10 10:00:00</td><td>buy</td><td>0.20</td><td>XAUUSD</td><td>3850.00</td><td>3840.00</td><td>3870.00</td><td>2026.11.10 14:00:00</td><td>3865.00</td><td>-2.00</td><td>0.00</td><td>0.00</td><td>300.00</td>
  </tr>
  <tr>
    <td colspan=12>已结盈亏:</td><td colspan=2>300.00</td>
  </tr>
</table>
</body>
</html>
    `;

    const res = await parseUniversalTradeFile(Buffer.from(mt4CnHtml, 'utf8'), 'mt4_report_cn.html');
    expect(res.platform).toBe('MT4');
    expect(res.trades).toHaveLength(1);
    expect(res.trades[0].symbol).toBe('XAUUSD');
    expect(res.trades[0].ticket).toBe('88776655');
    expect(res.trades[0].entryPrice).toBe(3850.0);
    expect(res.trades[0].exitPrice).toBe(3865.0);
    expect(res.trades[0].manualPnl).toBe(298.0);
  });

  // Test 3: MT5 English HTML Report
  test('should parse MT5 English HTML report', async () => {
    const mt5Html = `
<!DOCTYPE html>
<html>
<head><title>Report: 500123</title></head>
<body>
<div class="header">Positions</div>
<table>
  <tr>
    <th>Time</th><th>Position</th><th>Symbol</th><th>Type</th><th>Volume</th><th>Price</th><th>S / L</th><th>T / P</th><th>Time</th><th>Price</th><th>Commission</th><th>Swap</th><th>Profit</th>
  </tr>
  <tr>
    <td>2026.11.14 03:34:56</td><td>50671100</td><td>NAS100</td><td>sell</td><td>0.10</td><td>27828.9</td><td>28005.0</td><td>0.0</td><td>2026.11.14 06:51:12</td><td>28005.1</td><td>0.00</td><td>0.00</td><td>-17.62</td>
  </tr>
  <tr>
    <td>2026.11.14 03:22:42</td><td>50670977</td><td>XAUUSD</td><td>buy</td><td>1.00</td><td>3880.91</td><td>0.0</td><td>0.0</td><td>2026.11.14 03:35:59</td><td>3882.82</td><td>-5.00</td><td>0.00</td><td>191.00</td>
  </tr>
</table>
</body>
</html>
    `;

    const res = await parseUniversalTradeFile(Buffer.from(mt5Html, 'utf8'), 'MT5_Report.html');
    expect(res.platform).toBe('MT5');
    expect(res.trades).toHaveLength(2);
    expect(res.trades[0].ticket).toBe('50671100');
    expect(res.trades[0].symbol).toBe('NAS100');
    expect(res.trades[0].direction).toBe('short');
    expect(res.trades[0].entryTime).toBe('2026-11-14T03:34:56');
    expect(res.trades[0].exitTime).toBe('2026-11-14T06:51:12');
    expect(res.trades[0].entryPrice).toBe(27828.9);
    expect(res.trades[0].exitPrice).toBe(28005.1);

    expect(res.trades[1].ticket).toBe('50670977');
    expect(res.trades[1].symbol).toBe('XAUUSD');
    expect(res.trades[1].manualPnl).toBe(186.0); // 191 - 5
  });

  // Test 4: MT5 XML (SpreadsheetML) Report
  test('should parse MT5 XML (SpreadsheetML) report', async () => {
    const mt5Xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Positions">
  <Table>
   <Row>
    <Cell><Data ss:Type="String">Time</Data></Cell>
    <Cell><Data ss:Type="String">Position</Data></Cell>
    <Cell><Data ss:Type="String">Symbol</Data></Cell>
    <Cell><Data ss:Type="String">Type</Data></Cell>
    <Cell><Data ss:Type="String">Volume</Data></Cell>
    <Cell><Data ss:Type="String">Price</Data></Cell>
    <Cell><Data ss:Type="String">S / L</Data></Cell>
    <Cell><Data ss:Type="String">T / P</Data></Cell>
    <Cell><Data ss:Type="String">Time</Data></Cell>
    <Cell><Data ss:Type="String">Price</Data></Cell>
    <Cell><Data ss:Type="String">Commission</Data></Cell>
    <Cell><Data ss:Type="String">Swap</Data></Cell>
    <Cell><Data ss:Type="String">Profit</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">2026.11.14 03:34:56</Data></Cell>
    <Cell><Data ss:Type="Number">50671100</Data></Cell>
    <Cell><Data ss:Type="String">NAS100</Data></Cell>
    <Cell><Data ss:Type="String">sell</Data></Cell>
    <Cell><Data ss:Type="Number">0.10</Data></Cell>
    <Cell><Data ss:Type="Number">27828.9</Data></Cell>
    <Cell><Data ss:Type="Number">0.0</Data></Cell>
    <Cell><Data ss:Type="Number">0.0</Data></Cell>
    <Cell><Data ss:Type="String">2026.11.14 06:51:12</Data></Cell>
    <Cell><Data ss:Type="Number">28005.1</Data></Cell>
    <Cell><Data ss:Type="Number">0.00</Data></Cell>
    <Cell><Data ss:Type="Number">0.00</Data></Cell>
    <Cell><Data ss:Type="Number">-17.62</Data></Cell>
   </Row>
  </Table>
 </Worksheet>
</Workbook>`;

    const res = await parseUniversalTradeFile(Buffer.from(mt5Xml, 'utf8'), 'MT5_Export.xml');
    expect(res.platform).toBe('MT5');
    expect(res.trades).toHaveLength(1);
    expect(res.trades[0].ticket).toBe('50671100');
    expect(res.trades[0].symbol).toBe('NAS100');
    expect(res.trades[0].entryPrice).toBe(27828.9);
    expect(res.trades[0].exitPrice).toBe(28005.1);
    expect(res.trades[0].manualPnl).toBe(-17.62);
  });

  // Test 5: MT5 Tab-separated CSV / TSV
  test('should parse MT5 Tab-delimited report', async () => {
    const tsvContent = "Position\tTime\tSymbol\tType\tVolume\tPrice\tS / L\tT / P\tTime\tPrice\tCommission\tSwap\tProfit\n" +
      "50671100\t2026.11.14 03:34:56\tNAS100\tsell\t0.10\t27828.9\t0.0\t0.0\t2026.11.14 06:51:12\t28005.1\t0.00\t0.00\t-17.62\n" +
      "50670977\t2026.11.14 03:22:42\tXAUUSD\tbuy\t1.00\t3880.91\t0.0\t0.0\t2026.11.14 03:35:59\t3882.82\t0.00\t0.00\t191.00";

    const res = await parseUniversalTradeFile(Buffer.from(tsvContent, 'utf8'), 'mt5_history.csv');
    expect(res.platform).toBe('MT5');
    expect(res.trades).toHaveLength(2);
    expect(res.trades[0].symbol).toBe('NAS100');
    expect(res.trades[1].symbol).toBe('XAUUSD');
  });

  // Test 6: UTF-16 LE with BOM (common in MT5 and Excel exports)
  test('should parse UTF-16LE with BOM correctly', async () => {
    const tsvContent = "Position\tTime\tSymbol\tType\tVolume\tPrice\tS / L\tT / P\tTime\tPrice\tCommission\tSwap\tProfit\n" +
      "12345678\t2026.11.14 01:00:00\tEURUSD\tbuy\t1.00\t1.08000\t0.0\t0.0\t2026.11.14 02:00:00\t1.08500\t0.00\t0.00\t500.00";
    
    // Encode to UTF-16LE with BOM
    const strBuf = Buffer.from(tsvContent, 'utf16le');
    const bomBuf = Buffer.from([0xff, 0xfe]);
    const fullBuf = Buffer.concat([bomBuf, strBuf]);

    const res = await parseUniversalTradeFile(fullBuf, 'mt5_utf16.csv');
    expect(res.trades).toHaveLength(1);
    expect(res.trades[0].symbol).toBe('EURUSD');
    expect(res.trades[0].manualPnl).toBe(500);
  });

  // Test 7: Binary OpenXML (.xlsx)
  test('should parse binary .xlsx report', async () => {
    const xlsxPath = path.resolve(__dirname, '../../test-utils/sample_reports/sample_mt5.xlsx');
    const buf = fs.readFileSync(xlsxPath);

    const res = await parseUniversalTradeFile(buf, 'sample_mt5.xlsx');
    expect(res.trades).toHaveLength(1);
    expect(res.trades[0].symbol).toBe('BTCUSD');
    expect(res.trades[0].ticket).toBe('99887766');
    expect(res.trades[0].size).toBe(0.5);
    expect(res.trades[0].entryPrice).toBe(91000.0);
    expect(res.trades[0].exitPrice).toBe(92500.0);
    expect(res.trades[0].manualPnl).toBe(740.0); // 750 profit - 10 commission
  });

  // Test 8: Chinese GBK HTML Report with meta charset
  test('should decode and parse real GBK HTML report', async () => {
    const gbkPath = path.resolve(__dirname, '../../test-utils/sample_reports/sample_mt5_gbk.html');
    const buf = fs.readFileSync(gbkPath);

    const res = await parseUniversalTradeFile(buf, 'sample_mt5_gbk.html');
    expect(res.platform).toBe('MT5');
    expect(res.trades).toHaveLength(1);
    expect(res.trades[0].symbol).toBe('USDJPY');
    expect(res.trades[0].ticket).toBe('77665544');
    expect(res.trades[0].manualPnl).toBe(150.0);
  });

  // Test 9: Chinese MT5 HTML Report with UTF-16LE, hidden cells and '价位'/'盈利' headers
  test('should parse Chinese MT5 HTML report with UTF-16LE and hidden cells', async () => {
    const mt5CnHtml = `<!DOCTYPE html>
<html>
<head><title>交易历史报告</title></head>
<body>
<table>
  <tr><th colspan="13"><div style="font: 10pt Tahoma"><b>持仓</b></div></th></tr>
  <tr bgcolor="#E5F0FC">
    <td nowrap><b>时间</b></td>
    <td nowrap><b>持仓</b></td>
    <td nowrap><b>交易品种</b></td>
    <td nowrap><b>类型</b></td>
    <td nowrap><b>交易量</b></td>
    <td nowrap><b>价位</b></td>
    <td nowrap><b>止损</b></td>
    <td nowrap><b>止盈</b></td>
    <td nowrap><b>时间</b></td>
    <td nowrap><b>价位</b></td>
    <td nowrap><b>手续费</b></td>
    <td nowrap><b>库存费</b></td>
    <td nowrap><b>盈利</b></td>
  </tr>
  <tr>
    <td>2026.11.13 19:06:56</td>
    <td>50670614</td>
    <td>美国原油 - 现货.</td>
    <td>sell</td>
    <td class="hidden" colspan="8"></td>
    <td>0.1</td>
    <td>87.673</td>
    <td>87.657</td>
    <td>85.843</td>
    <td>2026.11.16 13:54:24</td>
    <td>86.888</td>
    <td>0.00</td>
    <td>0.00</td>
    <td>7.85</td>
  </tr>
  <tr><th colspan="13"><div style="font: 10pt Tahoma"><b>订单</b></div></th></tr>
  <tr><td>2026.11.13 19:06:56</td><td>50670614</td><td>美国原油 - 现货.</td><td>sell</td></tr>
</table>
</body>
</html>`;
    const strBuf = Buffer.from(mt5CnHtml, 'utf16le');
    const bomBuf = Buffer.from([0xff, 0xfe]);
    const fullBuf = Buffer.concat([bomBuf, strBuf]);

    const res = await parseUniversalTradeFile(fullBuf, 'ReportHistory-24979526.html');
    expect(res.platform).toBe('MT5');
    expect(res.trades).toHaveLength(1);
    const trade = res.trades[0];
    expect(trade.ticket).toBe('50670614');
    expect(trade.symbol).toBe('美国原油 - 现货.');
    expect(trade.direction).toBe('short');
    expect(trade.size).toBe(0.1);
    expect(trade.entryPrice).toBe(87.673);
    expect(trade.exitPrice).toBe(86.888);
    expect(trade.manualPnl).toBe(7.85);
  });
});
