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

        # Get top popular symbols available
        all_symbols = mt5.symbols_get()
        popular_names = []
        if all_symbols:
            # Sort or filter common symbols
            favs = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD', 'ETHUSD', 'US30', 'NAS100', 'SPX500', '纳斯达克100']
            names = [s.name for s in all_symbols]
            for f in favs:
                if f in names:
                    popular_names.append(f)
            # Add other first 20 symbols
            for n in names:
                if n not in popular_names and len(popular_names) < 30:
                    popular_names.append(n)

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

        all_symbol_names = [s.name for s in all_symbols] if all_symbols else []

        return {
            "connected": True,
            "terminal": terminal_data,
            "account": account_data,
            "symbolsTotal": symbols_count,
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
