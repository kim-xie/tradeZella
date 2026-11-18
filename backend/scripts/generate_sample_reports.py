import zipfile
import os

def create_sample_xlsx():
    sheet_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="inlineStr"><is><t>Position</t></is></c>
      <c r="B1" t="inlineStr"><is><t>Time</t></is></c>
      <c r="C1" t="inlineStr"><is><t>Symbol</t></is></c>
      <c r="D1" t="inlineStr"><is><t>Type</t></is></c>
      <c r="E1" t="inlineStr"><is><t>Volume</t></is></c>
      <c r="F1" t="inlineStr"><is><t>Price</t></is></c>
      <c r="G1" t="inlineStr"><is><t>S / L</t></is></c>
      <c r="H1" t="inlineStr"><is><t>T / P</t></is></c>
      <c r="I1" t="inlineStr"><is><t>Time</t></is></c>
      <c r="J1" t="inlineStr"><is><t>Price</t></is></c>
      <c r="K1" t="inlineStr"><is><t>Commission</t></is></c>
      <c r="L1" t="inlineStr"><is><t>Swap</t></is></c>
      <c r="M1" t="inlineStr"><is><t>Profit</t></is></c>
    </row>
    <row r="2">
      <c r="A2"><v>99887766</v></c>
      <c r="B2" t="inlineStr"><is><t>2026.11.15 08:30:00</t></is></c>
      <c r="C2" t="inlineStr"><is><t>BTCUSD</t></is></c>
      <c r="D2" t="inlineStr"><is><t>buy</t></is></c>
      <c r="E2"><v>0.5</v></c>
      <c r="F2"><v>91000.0</v></c>
      <c r="G2"><v>90000.0</v></c>
      <c r="H2"><v>93000.0</v></c>
      <c r="I2" t="inlineStr"><is><t>2026.11.15 12:45:00</t></is></c>
      <c r="J2"><v>92500.0</v></c>
      <c r="K2"><v>-10.0</v></c>
      <c r="L2"><v>0.0</v></c>
      <c r="M2"><v>750.0</v></c>
    </row>
  </sheetData>
</worksheet>"""

    os.makedirs('backend/test-utils/sample_reports', exist_ok=True)
    xlsx_path = 'backend/test-utils/sample_reports/sample_mt5.xlsx'
    with zipfile.ZipFile(xlsx_path, 'w') as z:
        z.writestr('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>')
        z.writestr('xl/worksheets/sheet1.xml', sheet_xml)

    print('Generated sample_mt5.xlsx')

    # Generate real GBK HTML file
    gbk_html = """<html>
<head><meta http-equiv="Content-Type" content="text/html; charset=gb2312"></head>
<body>
<table>
  <tr>
    <th>持仓</th><th>时间</th><th>交易品种</th><th>类型</th><th>交易量</th><th>价格</th><th>止损</th><th>止盈</th><th>时间</th><th>价格</th><th>佣金</th><th>库存费</th><th>利润</th>
  </tr>
  <tr>
    <td>77665544</td><td>2026.11.14 05:00:00</td><td>USDJPY</td><td>buy</td><td>0.30</td><td>155.10</td><td>0.0</td><td>0.0</td><td>2026.11.14 09:00:00</td><td>155.60</td><td>0.00</td><td>0.00</td><td>150.00</td>
  </tr>
</table>
</body>
</html>"""
    with open('backend/test-utils/sample_reports/sample_mt5_gbk.html', 'wb') as f:
        f.write(gbk_html.encode('gbk'))
    print('Generated sample_mt5_gbk.html in real GBK bytes')

if __name__ == '__main__':
    create_sample_xlsx()
