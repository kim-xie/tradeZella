#!/usr/bin/env python3
import sys
import io
import json
import argparse
import datetime
import pandas as pd
import numpy as np
import MetaTrader5 as mt5

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

TIMEFRAME_MAP = {
    'M1': mt5.TIMEFRAME_M1,
    '1M': mt5.TIMEFRAME_M1,
    'M5': mt5.TIMEFRAME_M5,
    '5M': mt5.TIMEFRAME_M5,
    'M15': mt5.TIMEFRAME_M15,
    '15M': mt5.TIMEFRAME_M15,
    'M30': mt5.TIMEFRAME_M30,
    '30M': mt5.TIMEFRAME_M30,
    'H1': mt5.TIMEFRAME_H1,
    '1H': mt5.TIMEFRAME_H1,
    'H4': mt5.TIMEFRAME_H4,
    '4H': mt5.TIMEFRAME_H4,
    'D1': mt5.TIMEFRAME_D1,
    '1D': mt5.TIMEFRAME_D1,
}

FREQ_MAP = {
    'M1': '1min',
    '1M': '1min',
    'M5': '5min',
    '5M': '5min',
    'M15': '15min',
    '15M': '15min',
    'M30': '30min',
    '30M': '30min',
    'H1': '1h',
    '1H': '1h',
    'H4': '4h',
    '4H': '4h',
    'D1': '1D',
    '1D': '1D',
}

def is_us_dst(dt):
    """Check if datetime falls within US Daylight Saving Time (DST)"""
    year, month, day, hour = dt.year, dt.month, dt.day, dt.hour
    if month < 3 or month > 11:
        return False
    if month > 3 and month < 11:
        return True
    if month == 3:
        w = datetime.date(year, 3, 1).weekday()
        first_sun = 1 + ((6 - w) % 7)
        second_sun = first_sun + 7
        if day < second_sun:
            return False
        if day > second_sun:
            return True
        return hour >= 2
    if month == 11:
        w = datetime.date(year, 11, 1).weekday()
        first_sun = 1 + ((6 - w) % 7)
        if day < first_sun:
            return True
        if day > first_sun:
            return False
        return hour < 2
    return False

def generate_synthetic_candles(start_dt, count=300, base_price=1.1000, freq='5min'):
    dates = pd.date_range(start=start_dt, periods=count, freq=freq)
    returns = np.random.normal(0.0001, 0.002, count)
    prices = base_price * np.exp(np.cumsum(returns))
    
    rows = []
    for i in range(count):
        close_p = prices[i]
        high_p = close_p * (1 + abs(np.random.normal(0, 0.0015)))
        low_p = close_p * (1 - abs(np.random.normal(0, 0.0015)))
        open_p = (high_p + low_p) / 2.0
        rows.append({
            "time": dates[i].strftime('%Y-%m-%d %H:%M'),
            "timestamp": int(dates[i].timestamp()),
            "open": round(float(open_p), 5),
            "high": round(float(max(high_p, open_p, close_p)), 5),
            "low": round(float(min(low_p, open_p, close_p)), 5),
            "close": round(float(close_p), 5),
            "volume": int(np.random.randint(100, 2000))
        })
    return rows

def get_candles(symbol="EURUSD", timeframe_str="H1", count=300, start_date=None, end_date=None):
    tf = TIMEFRAME_MAP.get(timeframe_str.upper(), mt5.TIMEFRAME_H1)
    connected = mt5.initialize()
    candles = []
    data_source = "MT5 Direct Terminal"
    contract_size = 100000.0

    if connected:
        try:
            sym_info = mt5.symbol_info(symbol)
            if sym_info:
                contract_size = sym_info.trade_contract_size or 1.0
            else:
                contract_size = 100000.0 if any(cur in symbol for cur in ['EUR', 'GBP', 'AUD', 'USD', 'JPY']) else 1.0

            if start_date:
                try:
                    s_dt = datetime.datetime.fromisoformat(start_date.replace('Z', ''))
                    e_dt = datetime.datetime.fromisoformat(end_date.replace('Z', '')) if end_date else datetime.datetime.now()
                    rates = mt5.copy_rates_range(symbol, tf, s_dt, e_dt)
                    if rates is None or len(rates) == 0:
                        rates = mt5.copy_rates_from_pos(symbol, tf, 0, count)
                except Exception:
                    rates = mt5.copy_rates_from_pos(symbol, tf, 0, count)
            else:
                rates = mt5.copy_rates_from_pos(symbol, tf, 0, count)

            if rates is not None and len(rates) > 0:
                for r in rates:
                    dt_broker = datetime.datetime.fromtimestamp(r['time'], tz=datetime.timezone.utc).replace(tzinfo=None)
                    offset_hours = 5 if is_us_dst(dt_broker) else 6
                    dt_shanghai = dt_broker + datetime.timedelta(hours=offset_hours)
                    candles.append({
                        "time": dt_shanghai.strftime('%Y-%m-%d %H:%M'),
                        "timestamp": int(dt_shanghai.replace(tzinfo=datetime.timezone.utc).timestamp()),
                        "open": round(float(r['open']), 5),
                        "high": round(float(r['high']), 5),
                        "low": round(float(r['low']), 5),
                        "close": round(float(r['close']), 5),
                        "volume": int(r['tick_volume'])
                    })
        except Exception as e:
            candles = []
        finally:
            mt5.shutdown()

    if not candles:
        data_source = "Synthetic Replay Data"
        contract_size = 100.0
        s_dt = datetime.datetime.now() - datetime.timedelta(days=15)
        freq = FREQ_MAP.get(timeframe_str.upper(), '5min')
        candles = generate_synthetic_candles(s_dt, count=count, freq=freq)

    return {
        "success": True,
        "symbol": symbol,
        "timeframe": timeframe_str,
        "contractSize": contract_size,
        "dataSource": data_source,
        "count": len(candles),
        "candles": candles
    }

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument("--symbol", type=str, default="EURUSD")
    parser.add_argument("--timeframe", type=str, default="M5")
    parser.add_argument("--count", type=int, default=300)
    parser.add_argument("--start", type=str, default=None)
    parser.add_argument("--end", type=str, default=None)
    args = parser.parse_args()

    result = get_candles(symbol=args.symbol, timeframe_str=args.timeframe, count=args.count, start_date=args.start, end_date=args.end)
    print(json.dumps(result, ensure_ascii=False))
