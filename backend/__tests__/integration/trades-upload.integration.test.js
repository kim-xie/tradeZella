import request from 'supertest';
import app from '../../src/index.js';
import { pool } from '../../src/db.js';
import { createTestUser, clearTestData, generateTestToken } from '../../test-utils/helpers.js';

describe('Trades API - Universal Report Upload', () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
    await clearTestData();
    testUser = await createTestUser({
      email: 'universal-trader@example.com',
      password: 'CsvTraderPass123!',
      name: 'Universal Trader',
    });
    authToken = generateTestToken(testUser);
  });

  afterAll(async () => {
    await clearTestData();
    await pool.end();
  });

  it('should upload a valid CSV and create trades', async () => {
    const csvContent = `Symbol,Direction,Size,Entry Price
AAPL,buy,10,150.25
GOOG,sell,5,2800.50
TSLA,buy,20,700.00`;

    const res = await request(app)
      .post('/api/trades/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', Buffer.from(csvContent), 'trades.csv')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(3);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data[0].symbol).toBe('AAPL');

    // Verify in database
    const { rows } = await pool.query('SELECT * FROM trades WHERE userId = $1', [testUser.id]);
    expect(rows).toHaveLength(3);
    expect(rows.find(t => t.symbol === 'AAPL').size).toBe(10);
    expect(rows.find(t => t.symbol === 'GOOG').direction).toBe('sell');
  });

  it('should upload and parse an MT4 HTML report statement', async () => {
    const mt4Html = `
<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">
<html>
<head><title>Statement: 123456</title></head>
<body>
<table>
  <tr>
    <th>Ticket</th><th>Open Time</th><th>Type</th><th>Size</th><th>Item</th><th>Price</th><th>S / L</th><th>T / P</th><th>Close Time</th><th>Price</th><th>Commission</th><th>Taxes</th><th>Swap</th><th>Profit</th>
  </tr>
  <tr>
    <td>2001</td><td>2026.11.13 14:00:00</td><td>buy</td><td>1.00</td><td>EURUSD</td><td>1.08500</td><td>1.08000</td><td>1.09000</td><td>2026.11.13 16:00:00</td><td>1.08900</td><td>-3.00</td><td>0.00</td><td>0.00</td><td>400.00</td>
  </tr>
  <tr>
    <td colspan=12>Closed P/L:</td><td colspan=2>400.00</td>
  </tr>
</table>
</body>
</html>`;

    const res = await request(app)
      .post('/api/trades/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', Buffer.from(mt4Html), 'Statement_123456.htm')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.platform).toBe('MT4');
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].symbol).toBe('EURUSD');
    expect(res.body.data[0].ticket).toBe('2001');
  });

  it('should upload and parse an MT5 XML (SpreadsheetML) report', async () => {
    const mt5Xml = `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Positions">
  <Table>
   <Row>
    <Cell><Data ss:Type="String">Position</Data></Cell>
    <Cell><Data ss:Type="String">Time</Data></Cell>
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
    <Cell><Data ss:Type="Number">3001</Data></Cell>
    <Cell><Data ss:Type="String">2026.11.14 02:00:00</Data></Cell>
    <Cell><Data ss:Type="String">XAUUSD</Data></Cell>
    <Cell><Data ss:Type="String">buy</Data></Cell>
    <Cell><Data ss:Type="Number">0.50</Data></Cell>
    <Cell><Data ss:Type="Number">3850.0</Data></Cell>
    <Cell><Data ss:Type="Number">3840.0</Data></Cell>
    <Cell><Data ss:Type="Number">3870.0</Data></Cell>
    <Cell><Data ss:Type="String">2026.11.14 04:00:00</Data></Cell>
    <Cell><Data ss:Type="Number">3865.0</Data></Cell>
    <Cell><Data ss:Type="Number">-2.50</Data></Cell>
    <Cell><Data ss:Type="Number">0.00</Data></Cell>
    <Cell><Data ss:Type="Number">750.0</Data></Cell>
   </Row>
  </Table>
 </Worksheet>
</Workbook>`;

    const res = await request(app)
      .post('/api/trades/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', Buffer.from(mt5Xml), 'mt5_statement.xml')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.platform).toBe('MT5');
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].symbol).toBe('XAUUSD');
    expect(res.body.data[0].ticket).toBe('3001');
  });

  it('should return 400 if no file is uploaded', async () => {
    await request(app)
      .post('/api/trades/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400, {
        success: false,
        message: 'No file uploaded.',
      });
  });

  it('should return 400 for a file with missing headers', async () => {
    const csvContent = `Symbol,Direction,Count
AAPL,buy,10`;

    const res = await request(app)
      .post('/api/trades/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', Buffer.from(csvContent), 'bad.csv')
      .expect(400);

    expect(res.body.success).toBe(false);
  });
});
