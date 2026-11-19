import sys
import io
import json
try:
    import MetaTrader5 as mt5
except ImportError:
    mt5 = None

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

def get_status():
    if not mt5:
        return {
            "connected": False,
            "error": "MetaTrader5 Python module not available in this environment (available on Windows with MT5 installed)."
        }
    try:
        init_res = mt5.initialize()
        if not init_res:
            error = mt5.last_error()
            return {
                "connected": False,
                "error": f"Failed to initialize MT5: {error}"
            }
        
        terminal = mt5.terminal_info()
        account = mt5.account_info()
        symbols_count = mt5.symbols_total()

        # Get only symbols that actually have K-line candle data available
        all_symbols = mt5.symbols_get()
        symbols_with_candles = []
        popular_names = []

        if all_symbols:
            # 1. Market Watch symbols (selected or visible in the MT5 terminal)
            market_watch = [s for s in all_symbols if s.select or s.visible]
            for s in market_watch:
                try:
                    rates = mt5.copy_rates_from_pos(s.name, mt5.TIMEFRAME_M5, 0, 1)
                    if rates is not None and len(rates) > 0:
                        symbols_with_candles.append(s.name)
                except Exception:
                    pass

            # 2. Check common favs in case any have rates
            favs = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD', 'ETHUSD', 'US30', 'NAS100', 'SPX500', '纳斯达克100']
            for f in favs:
                if f not in symbols_with_candles:
                    try:
                        rates = mt5.copy_rates_from_pos(f, mt5.TIMEFRAME_M5, 0, 1)
                        if rates is not None and len(rates) > 0:
                            symbols_with_candles.append(f)
                    except Exception:
                        pass

            # Fallback to Market Watch list if candle check returned empty
            if not symbols_with_candles and market_watch:
                symbols_with_candles = [s.name for s in market_watch]

            for f in favs:
                if f in symbols_with_candles:
                    popular_names.append(f)

            for name in symbols_with_candles:
                if name not in popular_names and len(popular_names) < 20:
                    popular_names.append(name)

        terminal_data = {
            "name": terminal.name if terminal else "Unknown",
            "company": terminal.company if terminal else "Unknown",
            "connected": terminal.connected if terminal else False,
            "build": terminal.build if terminal else 0,
            "path": terminal.path if terminal else "",
        } if terminal else None

        account_data = {
            "login": account.login if account else 0,
            "server": account.server if account else "",
            "balance": account.balance if account else 0.0,
            "equity": account.equity if account else 0.0,
            "currency": account.currency if account else "USD",
            "leverage": account.leverage if account else 100,
            "name": account.name if account else "",
            "company": account.company if account else ""
        } if account else None

        all_symbol_names = symbols_with_candles

        return {
            "connected": True,
            "terminal": terminal_data,
            "account": account_data,
            "symbolsTotal": len(symbols_with_candles) if symbols_with_candles else symbols_count,
            "popularSymbols": popular_names,
            "allSymbols": all_symbol_names
        }
    except Exception as e:
        return {
            "connected": False,
            "error": str(e)
        }
    finally:
        mt5.shutdown()

if __name__ == '__main__':
    result = get_status()
    print(json.dumps(result, ensure_ascii=False))
