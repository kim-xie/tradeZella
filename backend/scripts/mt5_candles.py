#!/usr/bin/env python3
"""
MT5 Candles / Market Data Fetcher & Replay Generator:
- When MT5 is available (local Windows with MT5 installed), fetches real historical candles and converts to Shanghai time.
- When MT5 or dependencies are unavailable (e.g. Linux, Render, cloud servers), generates high-fidelity synthetic market candles in pure Python without requiring pandas, numpy, or MetaTrader5.
"""
import sys
import io
import json
import argparse
import datetime
import math
import random

try:
    import MetaTrader5 as mt5
except ImportError:
    mt5 = None

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

TIMEFRAME_MAP = {
    'M1': getattr(mt5, 'TIMEFRAME_M1', 1),
    '1M': getattr(mt5, 'TIMEFRAME_M1', 1),
    'M5': getattr(mt5, 'TIMEFRAME_M5', 5),
    '5M': getattr(mt5, 'TIMEFRAME_M5', 5),
    'M15': getattr(mt5, 'TIMEFRAME_M15', 15),
    '15M': getattr(mt5, 'TIMEFRAME_M15', 15),
    'M30': getattr(mt5, 'TIMEFRAME_M30', 30),
    '30M': getattr(mt5, 'TIMEFRAME_M30', 30),
    'H1': getattr(mt5, 'TIMEFRAME_H1', 16385),
    '1H': getattr(mt5, 'TIMEFRAME_H1', 16385),
    'H4': getattr(mt5, 'TIMEFRAME_H4', 16388),
    '4H': getattr(mt5, 'TIMEFRAME_H4', 16388),
    'D1': getattr(mt5, 'TIMEFRAME_D1', 16408),
    '1D': getattr(mt5, 'TIMEFRAME_D1', 16408),
} if mt5 else {}

STEP_SECONDS_MAP = {
    'M1': 60,
    '1M': 60,
    'M5': 300,
    '5M': 300,
    'M15': 900,
    '15M': 900,
    'M30': 1800,
    '30M': 1800,
    'H1': 3600,
    '1H': 3600,
    'H4': 14400,
    '4H': 14400,
    'D1': 86400,
    '1D': 86400,
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

def get_base_price(symbol):
    sym = (symbol or 'EURUSD').upper()
    if '原油' in sym or 'USOIL' in sym or 'WTI' in sym or 'XTI' in sym:
        return 70.0
    if '布伦特' in sym or 'UKOIL' in sym or 'BRENT' in sym:
        return 75.0
    if 'JPY' in sym:
        return 155.0
    if 'XAU' in sym or '黄金' in sym or 'GOLD' in sym:
        return 2650.0
    if 'XAG' in sym or '白银' in sym or 'SILVER' in sym:
        return 31.0
    if 'BTC' in sym or '比特币' in sym:
        return 90000.0
    if 'ETH' in sym or '以太坊' in sym:
        return 3200.0
    if 'NAS' in sym or 'US100' in sym or '纳斯达克' in sym:
        return 20500.0
    if 'US30' in sym or '道琼斯' in sym:
        return 43500.0
    if 'US500' in sym or 'SPX' in sym or '标普' in sym:
        return 5900.0
    if 'GER' in sym or 'DAX' in sym or '德指' in sym:
        return 19200.0
    if 'JP225' in sym or '日经' in sym:
        return 38500.0
    if 'HK50' in sym or '恒生' in sym:
        return 19500.0
    if 'GBP' in sym:
        return 1.2850
    if 'AUD' in sym:
        return 0.6550
    return 1.1000

def generate_synthetic_candles(start_dt, count=300, base_price=1.1000, timeframe_str='M5'):
    """Generate high-fidelity candle data in pure Python without pandas or numpy"""
    step_sec = STEP_SECONDS_MAP.get(str(timeframe_str).upper(), 300)
    current_time = start_dt
    current_close = base_price
    digits = 2 if base_price >= 500 else (3 if base_price >= 10 else 5)
    tz_shanghai = datetime.timezone(datetime.timedelta(hours=8))

    rows = []
    for _ in range(count):
        change_pct = (random.random() - 0.495) * 0.003
        open_p = current_close
        close_p = open_p * (1.0 + change_pct)
        high_p = max(open_p, close_p) * (1.0 + random.random() * 0.0015)
        low_p = min(open_p, close_p) * (1.0 - random.random() * 0.0015)
        current_close = close_p

        time_str = current_time.strftime('%Y-%m-%d %H:%M')
        ts = int(current_time.replace(tzinfo=tz_shanghai).timestamp())

        rows.append({
            "time": time_str,
            "timestamp": ts,
            "open": round(open_p, digits),
            "high": round(high_p, digits),
            "low": round(low_p, digits),
            "close": round(close_p, digits),
            "volume": random.randint(100, 2000)
        })
        current_time += datetime.timedelta(seconds=step_sec)

    return rows

def get_candles(symbol="EURUSD", timeframe_str="H1", count=300, start_date=None, end_date=None, price=None):
    candles = []
    data_source = "Synthetic Replay Data"
    contract_size = 100000.0 if not any(c in symbol for c in ['JPY', 'XAU', '黄金', 'BTC', 'USOIL', '原油', 'NAS', '纳斯达克']) else 1.0

    if mt5 is not None:
        try:
            connected = mt5.initialize()
            if connected:
                tf = TIMEFRAME_MAP.get(timeframe_str.upper(), getattr(mt5, 'TIMEFRAME_H1', 16385))
                sym_info = mt5.symbol_info(symbol)
                if sym_info:
                    contract_size = sym_info.trade_contract_size or 1.0
                else:
                    contract_size = 100000.0 if any(cur in symbol for cur in ['EUR', 'GBP', 'AUD', 'USD']) else 1.0

                if start_date:
                    try:
                        s_dt = datetime.datetime.fromisoformat(start_date.replace('Z', ''))
                        e_dt = datetime.datetime.fromisoformat(end_date.replace('Z', '')) if end_date else datetime.datetime.now()
                        offset_h = 5 if is_us_dst(s_dt) else 6
                        s_dt_broker = s_dt - datetime.timedelta(hours=offset_h)
                        e_dt_broker = e_dt - datetime.timedelta(hours=offset_h)
                        rates = mt5.copy_rates_range(symbol, tf, s_dt_broker, e_dt_broker)
                        if rates is None or len(rates) == 0:
                            rates = mt5.copy_rates_range(symbol, tf, s_dt, e_dt)
                        if rates is None or len(rates) == 0:
                            rates = mt5.copy_rates_from_pos(symbol, tf, 0, count)
                    except Exception:
                        rates = mt5.copy_rates_from_pos(symbol, tf, 0, count)
                else:
                    rates = mt5.copy_rates_from_pos(symbol, tf, 0, count)

                if rates is not None and len(rates) > 0:
                    data_source = "MT5 Direct Terminal"
                    tz_shanghai = datetime.timezone(datetime.timedelta(hours=8))
                    for r in rates:
                        dt_broker = datetime.datetime.fromtimestamp(r['time'], tz=datetime.timezone.utc).replace(tzinfo=None)
                        offset_hours = 5 if is_us_dst(dt_broker) else 6
                        dt_shanghai = dt_broker + datetime.timedelta(hours=offset_hours)
                        dt_shanghai_tz = dt_shanghai.replace(tzinfo=tz_shanghai)
                        candles.append({
                            "time": dt_shanghai.strftime('%Y-%m-%d %H:%M'),
                            "timestamp": int(dt_shanghai_tz.timestamp()),
                            "open": round(float(r['open']), 5),
                            "high": round(float(r['high']), 5),
                            "low": round(float(r['low']), 5),
                            "close": round(float(r['close']), 5),
                            "volume": int(r['tick_volume'])
                        })
                mt5.shutdown()
        except Exception:
            candles = []

    if not candles:
        data_source = "Synthetic Replay Data"
        base_price = float(price) if price else get_base_price(symbol)
        step_sec = STEP_SECONDS_MAP.get(str(timeframe_str).upper(), 300)
        if start_date:
            try:
                s_dt = datetime.datetime.fromisoformat(start_date.replace('Z', ''))
            except Exception:
                s_dt = datetime.datetime.now() - datetime.timedelta(seconds=step_sec * count)
        else:
            s_dt = datetime.datetime.now() - datetime.timedelta(seconds=step_sec * count)
        candles = generate_synthetic_candles(s_dt, count=count, base_price=base_price, timeframe_str=timeframe_str)

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
    parser.add_argument("--price", type=float, default=None)
    args = parser.parse_args()

    result = get_candles(symbol=args.symbol, timeframe_str=args.timeframe, count=args.count, start_date=args.start, end_date=args.end, price=args.price)
    print(json.dumps(result, ensure_ascii=False))
