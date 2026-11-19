#!/usr/bin/env python3
import sys
import io
import json
import argparse
import datetime
import math
try:
    import numpy as np
    import pandas as pd
except ImportError:
    np = None
    pd = None

try:
    import MetaTrader5 as mt5
except ImportError:
    mt5 = None

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

TIMEFRAME_MAP = {
    'M1': getattr(mt5, 'TIMEFRAME_M1', 1),
    'M5': getattr(mt5, 'TIMEFRAME_M5', 5),
    'M15': getattr(mt5, 'TIMEFRAME_M15', 15),
    'M30': getattr(mt5, 'TIMEFRAME_M30', 30),
    'H1': getattr(mt5, 'TIMEFRAME_H1', 16385),
    'H4': getattr(mt5, 'TIMEFRAME_H4', 16388),
    'D1': getattr(mt5, 'TIMEFRAME_D1', 16408),
} if mt5 else {}

def calculate_rsi(series, period=14):
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / (loss + 1e-9)
    rsi = 100 - (100 / (1 + rs))
    return rsi

def calculate_bollinger_bands(series, period=20, std_dev=2):
    sma = series.rolling(window=period).mean()
    rstd = series.rolling(window=period).std()
    upper = sma + (rstd * std_dev)
    lower = sma - (rstd * std_dev)
    return sma, upper, lower

def calculate_macd(series, fast=12, slow=26, signal=9):
    fast_ema = series.ewm(span=fast, adjust=False).mean()
    slow_ema = series.ewm(span=slow, adjust=False).mean()
    macd_line = fast_ema - slow_ema
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram

def generate_synthetic_candles(start_dt, end_dt, base_price=100.0, count=500):
    """Generate realistic price series if MT5 is offline or symbol not found"""
    dates = pd.date_range(start=start_dt, end=end_dt, periods=count)
    returns = np.random.normal(0.0002, 0.008, count)
    price_series = base_price * np.exp(np.cumsum(returns))
    
    rows = []
    for i in range(count):
        close_p = price_series[i]
        high_p = close_p * (1 + abs(np.random.normal(0, 0.003)))
        low_p = close_p * (1 - abs(np.random.normal(0, 0.003)))
        open_p = (high_p + low_p) / 2.0
        rows.append({
            'time': dates[i],
            'open': round(open_p, 4),
            'high': round(max(high_p, open_p, close_p), 4),
            'low': round(min(low_p, open_p, close_p), 4),
            'close': round(close_p, 4),
            'tick_volume': int(np.random.randint(100, 3000))
        })
    return pd.DataFrame(rows)

def fetch_data(symbol, timeframe_str, start_str, end_str):
    timeframe = TIMEFRAME_MAP.get(timeframe_str.upper(), mt5.TIMEFRAME_H1)
    
    # Parse dates
    try:
        start_dt = datetime.datetime.fromisoformat(start_str.replace('Z', ''))
    except Exception:
        start_dt = datetime.datetime.now() - datetime.timedelta(days=180)
        
    try:
        end_dt = datetime.datetime.fromisoformat(end_str.replace('Z', ''))
    except Exception:
        end_dt = datetime.datetime.now()

    is_mt5_connected = mt5.initialize()
    df = None
    data_source = "MT5 Direct Terminal"
    contract_size = 1.0

    if is_mt5_connected:
        try:
            sym_info = mt5.symbol_info(symbol)
            if sym_info:
                contract_size = sym_info.trade_contract_size or 1.0
            else:
                contract_size = 100000.0 if any(cur in symbol for cur in ['EUR', 'GBP', 'AUD', 'NZD', 'USD', 'JPY']) else 1.0

            rates = mt5.copy_rates_range(symbol, timeframe, start_dt, end_dt)
            if rates is None or len(rates) < 30:
                rates = mt5.copy_rates_from_pos(symbol, timeframe, 0, 1000)
            
            if rates is not None and len(rates) >= 30:
                df = pd.DataFrame(rates)
                df['time'] = pd.to_datetime(df['time'], unit='s')
        except Exception as e:
            df = None
        finally:
            mt5.shutdown()

    if df is None or len(df) < 30:
        data_source = "Simulated / Synthetic Data"
        contract_size = 100.0
        df = generate_synthetic_candles(start_dt, end_dt, base_price=100.0, count=600)

    return df, data_source, contract_size

def run_backtest(config):
    symbol = config.get('symbol', 'EURUSD')
    timeframe = config.get('timeframe', 'H1')
    start_date = config.get('startDate', '2023-01-01')
    end_date = config.get('endDate', '2024-01-01')
    initial_capital = float(config.get('initialCapital', 10000))
    strategy = config.get('strategy', 'ma_crossover')
    params = config.get('parameters', {})

    stop_loss_pct = float(params.get('stopLossPct', 1.5)) / 100.0
    take_profit_pct = float(params.get('takeProfitPct', 3.0)) / 100.0
    risk_per_trade = float(params.get('riskPerTradePct', 2.0)) / 100.0
    fixed_size = float(params.get('size', 1.0))

    df, data_source, contract_size = fetch_data(symbol, timeframe, start_date, end_date)
    df = df.sort_values('time').reset_index(drop=True)

    # Calculate indicators based on strategy
    strategy_name = strategy
    if strategy in ['ma_crossover', 'Moving Average Crossover']:
        fast_p = int(params.get('fastPeriod', 10))
        slow_p = int(params.get('slowPeriod', 30))
        df['fast_ma'] = df['close'].rolling(window=fast_p).mean()
        df['slow_ma'] = df['close'].rolling(window=slow_p).mean()
        df['signal'] = 0
        df.loc[(df['fast_ma'] > df['slow_ma']) & (df['fast_ma'].shift(1) <= df['slow_ma'].shift(1)), 'signal'] = 1
        df.loc[(df['fast_ma'] < df['slow_ma']) & (df['fast_ma'].shift(1) >= df['slow_ma'].shift(1)), 'signal'] = -1
        strategy_name = f"MA Crossover ({fast_p}/{slow_p})"

    elif strategy in ['rsi', 'rsi_mean_reversion', 'RSI Mean Reversion']:
        rsi_p = int(params.get('rsiPeriod', 14))
        oversold = float(params.get('rsiOversold', 30))
        overbought = float(params.get('rsiOverbought', 70))
        df['rsi'] = calculate_rsi(df['close'], period=rsi_p)
        df['signal'] = 0
        df.loc[(df['rsi'] < oversold) & (df['rsi'].shift(1) >= oversold), 'signal'] = 1
        df.loc[(df['rsi'] > overbought) & (df['rsi'].shift(1) <= overbought), 'signal'] = -1
        strategy_name = f"RSI ({rsi_p}, {oversold}/{overbought})"

    elif strategy in ['bollinger', 'bollinger_bands', 'Bollinger Bands']:
        bb_p = int(params.get('bbPeriod', 20))
        bb_std = float(params.get('bbStd', 2))
        sma, upper, lower = calculate_bollinger_bands(df['close'], bb_p, bb_std)
        df['bb_mid'] = sma
        df['bb_up'] = upper
        df['bb_low'] = lower
        df['signal'] = 0
        # Buy when price crosses above lower band, sell when crosses below upper band
        df.loc[(df['close'] > df['bb_low']) & (df['close'].shift(1) <= df['bb_low'].shift(1)), 'signal'] = 1
        df.loc[(df['close'] < df['bb_up']) & (df['close'].shift(1) >= df['bb_up'].shift(1)), 'signal'] = -1
        strategy_name = f"Bollinger Bands ({bb_p}, {bb_std})"

    elif strategy in ['macd', 'MACD Momentum']:
        fast = int(params.get('macdFast', 12))
        slow = int(params.get('macdSlow', 26))
        signal = int(params.get('macdSignal', 9))
        macd_line, sig_line, _ = calculate_macd(df['close'], fast, slow, signal)
        df['macd'] = macd_line
        df['macd_signal'] = sig_line
        df['signal'] = 0
        df.loc[(df['macd'] > df['macd_signal']) & (df['macd'].shift(1) <= df['macd_signal'].shift(1)), 'signal'] = 1
        df.loc[(df['macd'] < df['macd_signal']) & (df['macd'].shift(1) >= df['macd_signal'].shift(1)), 'signal'] = -1
        strategy_name = f"MACD ({fast}/{slow}/{signal})"

    else:
        # Default Breakout
        lookback = int(params.get('lookback', 20))
        df['high_n'] = df['high'].rolling(lookback).max().shift(1)
        df['low_n'] = df['low'].rolling(lookback).min().shift(1)
        df['signal'] = 0
        df.loc[df['close'] > df['high_n'], 'signal'] = 1
        df.loc[df['close'] < df['low_n'], 'signal'] = -1
        strategy_name = f"Breakout ({lookback})"

    # Simulation variables
    capital = initial_capital
    peak_capital = initial_capital
    max_drawdown_amount = 0.0
    max_drawdown_pct = 0.0

    current_trade = None
    trades = []
    equity_curve = []

    # Run bar-by-bar
    start_bar = 35 # Skip initial lookback bars
    for i in range(start_bar, len(df)):
        row = df.iloc[i]
        curr_time = row['time'].strftime('%Y-%m-%d %H:%M:%S')
        curr_price = float(row['close'])
        curr_high = float(row['high'])
        curr_low = float(row['low'])
        sig = int(row['signal'])

        # Check existing position for SL/TP exit
        if current_trade is not None:
            direction = current_trade['direction']
            entry_price = current_trade['entryPrice']
            size = current_trade['size']
            sl = current_trade['stopLoss']
            tp = current_trade['takeProfit']
            exit_price = None
            exit_reason = None

            if direction == 'Buy':
                # Long position: SL is below, TP is above
                if sl and curr_low <= sl:
                    exit_price = sl
                    exit_reason = 'Stop Loss'
                elif tp and curr_high >= tp:
                    exit_price = tp
                    exit_reason = 'Take Profit'
                elif sig == -1: # Reverse signal
                    exit_price = curr_price
                    exit_reason = 'Signal'

                if exit_price is not None:
                    profit = (exit_price - entry_price) * size * contract_size
                    commission = max(0.5, round(size * 2.0, 2))
                    net_profit = profit - commission
                    capital += net_profit
                    pnl_pct = ((exit_price - entry_price) / entry_price) * 100

                    completed_trade = {
                        "id": len(trades) + 1,
                        "date": curr_time.split(' ')[0],
                        "entryTime": current_trade['entryTime'],
                        "exitTime": curr_time,
                        "symbol": symbol,
                        "direction": direction,
                        "size": round(size, 2),
                        "entryPrice": round(entry_price, 5),
                        "exitPrice": round(exit_price, 5),
                        "stopLoss": round(sl, 5) if sl else None,
                        "takeProfit": round(tp, 5) if tp else None,
                        "profit": round(net_profit, 2),
                        "commission": commission,
                        "pnlPercent": round(pnl_pct, 2),
                        "exitReason": exit_reason
                    }
                    trades.append(completed_trade)
                    current_trade = None

            elif direction == 'Sell':
                # Short position: SL is above, TP is below
                if sl and curr_high >= sl:
                    exit_price = sl
                    exit_reason = 'Stop Loss'
                elif tp and curr_low <= tp:
                    exit_price = tp
                    exit_reason = 'Take Profit'
                elif sig == 1: # Reverse signal
                    exit_price = curr_price
                    exit_reason = 'Signal'

                if exit_price is not None:
                    profit = (entry_price - exit_price) * size * contract_size
                    commission = max(0.5, round(size * 2.0, 2))
                    net_profit = profit - commission
                    capital += net_profit
                    pnl_pct = ((entry_price - exit_price) / entry_price) * 100

                    completed_trade = {
                        "id": len(trades) + 1,
                        "date": curr_time.split(' ')[0],
                        "entryTime": current_trade['entryTime'],
                        "exitTime": curr_time,
                        "symbol": symbol,
                        "direction": direction,
                        "size": round(size, 2),
                        "entryPrice": round(entry_price, 5),
                        "exitPrice": round(exit_price, 5),
                        "stopLoss": round(sl, 5) if sl else None,
                        "takeProfit": round(tp, 5) if tp else None,
                        "profit": round(net_profit, 2),
                        "commission": commission,
                        "pnlPercent": round(pnl_pct, 2),
                        "exitReason": exit_reason
                    }
                    trades.append(completed_trade)
                    current_trade = None

        # Check for new entry if flat
        if current_trade is None and sig != 0 and capital > 100:
            direction = 'Buy' if sig == 1 else 'Sell'
            entry_price = curr_price
            
            # Position sizing: risk % of capital divided by stop distance
            stop_distance = entry_price * stop_loss_pct
            risk_dollars = capital * risk_per_trade
            calculated_size = risk_dollars / max(stop_distance, 1e-4)
            size = max(0.1, min(calculated_size, (capital * 5) / entry_price)) # Leverage cap
            if fixed_size > 0:
                size = fixed_size

            sl = entry_price * (1 - stop_loss_pct) if direction == 'Buy' else entry_price * (1 + stop_loss_pct)
            tp = entry_price * (1 + take_profit_pct) if direction == 'Buy' else entry_price * (1 - take_profit_pct)

            current_trade = {
                "entryTime": curr_time,
                "entryPrice": entry_price,
                "direction": direction,
                "size": size,
                "stopLoss": sl,
                "takeProfit": tp
            }

        # Track Drawdown and Equity
        peak_capital = max(peak_capital, capital)
        dd_amount = peak_capital - capital
        dd_pct = (dd_amount / peak_capital) * 100.0 if peak_capital > 0 else 0.0
        if dd_pct > max_drawdown_pct:
            max_drawdown_pct = dd_pct
            max_drawdown_amount = dd_amount

        # Record equity curve points (sample every few bars to keep response lean)
        if i % max(1, len(df) // 100) == 0 or i == len(df) - 1:
            equity_curve.append({
                "time": curr_time,
                "capital": round(capital, 2),
                "drawdown": round(dd_pct, 2)
            })

    # Close open trade at end of backtest if still open
    if current_trade is not None:
        row = df.iloc[-1]
        exit_price = float(row['close'])
        curr_time = row['time'].strftime('%Y-%m-%d %H:%M:%S')
        direction = current_trade['direction']
        size = current_trade['size']
        entry_price = current_trade['entryPrice']
        
        profit = (exit_price - entry_price) * size * contract_size if direction == 'Buy' else (entry_price - exit_price) * size * contract_size
        commission = max(0.5, round(size * 2.0, 2))
        net_profit = profit - commission
        capital += net_profit
        pnl_pct = ((exit_price - entry_price) / entry_price) * 100 if direction == 'Buy' else ((entry_price - exit_price) / entry_price) * 100

        trades.append({
            "id": len(trades) + 1,
            "date": curr_time.split(' ')[0],
            "entryTime": current_trade['entryTime'],
            "exitTime": curr_time,
            "symbol": symbol,
            "direction": direction,
            "size": round(size, 2),
            "entryPrice": round(entry_price, 5),
            "exitPrice": round(exit_price, 5),
            "stopLoss": round(current_trade['stopLoss'], 5) if current_trade['stopLoss'] else None,
            "takeProfit": round(current_trade['takeProfit'], 5) if current_trade['takeProfit'] else None,
            "profit": round(net_profit, 2),
            "commission": commission,
            "pnlPercent": round(pnl_pct, 2),
            "exitReason": 'End of Period'
        })

    # Aggregate performance statistics
    total_trades = len(trades)
    winning_trades = sum(1 for t in trades if t['profit'] > 0)
    losing_trades = sum(1 for t in trades if t['profit'] < 0)
    win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0.0

    gross_profit = sum(t['profit'] for t in trades if t['profit'] > 0)
    gross_loss = abs(sum(t['profit'] for t in trades if t['profit'] < 0))
    profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else (99.0 if gross_profit > 0 else 0.0)

    # Sharpe ratio
    returns = [t['profit'] / initial_capital for t in trades]
    if len(returns) > 1 and np.std(returns) > 0:
        sharpe = (np.mean(returns) / np.std(returns)) * math.sqrt(252)
    else:
        sharpe = 0.0

    actual_start = df.iloc[0]['time'].strftime('%Y-%m-%d')
    actual_end = df.iloc[-1]['time'].strftime('%Y-%m-%d')

    return {
        "success": True,
        "name": f"{strategy_name} on {symbol} ({timeframe})",
        "strategy": strategy_name,
        "symbol": symbol,
        "timeframe": timeframe,
        "dataSource": data_source,
        "startDate": actual_start,
        "endDate": actual_end,
        "initialCapital": round(initial_capital, 2),
        "finalCapital": round(capital, 2),
        "netProfit": round(capital - initial_capital, 2),
        "returnPct": round(((capital - initial_capital) / initial_capital) * 100, 2),
        "totalTrades": total_trades,
        "winningTrades": winning_trades,
        "losingTrades": losing_trades,
        "winRate": round(win_rate, 2),
        "profitFactor": round(profit_factor, 2),
        "maxDrawdown": round(max_drawdown_pct, 2),
        "sharpeRatio": round(sharpe, 2),
        "equityCurve": equity_curve,
        "trades": trades,
        "totalBars": len(df)
    }

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="MT5 Strategy Backtest Engine")
    parser.add_argument("--config", type=str, help="JSON configuration string or path to JSON file")
    parser.add_argument("--stdin", action="store_true", help="Read config JSON from stdin")
    args = parser.parse_args()

    config = {}
    if args.config:
        try:
            if args.config.endswith('.json'):
                with open(args.config, 'r', encoding='utf-8') as f:
                    config = json.load(f)
            else:
                config = json.loads(args.config)
        except Exception as e:
            pass
    elif args.stdin:
        try:
            raw = sys.stdin.read()
            if raw.strip():
                config = json.loads(raw)
        except Exception:
            pass

    # Fallback default test config
    if not config:
        config = {
            "symbol": "EURUSD",
            "timeframe": "H1",
            "startDate": (datetime.datetime.now() - datetime.timedelta(days=90)).strftime('%Y-%m-%d'),
            "endDate": datetime.datetime.now().strftime('%Y-%m-%d'),
            "initialCapital": 10000,
            "strategy": "ma_crossover",
            "parameters": { "fastPeriod": 9, "slowPeriod": 21 }
        }

    res = run_backtest(config)
    print(json.dumps(res, ensure_ascii=False))
