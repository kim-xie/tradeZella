#!/usr/bin/env python3
import sys
import io
import json
import argparse
import datetime
import re
from collections import defaultdict
try:
    import MetaTrader5 as mt5
except ImportError:
    mt5 = None

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

def parse_sl_tp(comment):
    sl = None
    tp = None
    if not comment:
        return sl, tp
    
    sl_match = re.search(r'\[sl\s+([\d\.]+)\]', comment, re.IGNORECASE)
    if sl_match:
        try:
            sl = float(sl_match.group(1))
        except ValueError:
            pass
            
    tp_match = re.search(r'\[tp\s+([\d\.]+)\]', comment, re.IGNORECASE)
    if tp_match:
        try:
            tp = float(tp_match.group(1))
        except ValueError:
            pass
            
    return sl, tp

def is_us_dst(dt):
    """Check if datetime falls within US Daylight Saving Time (DST)"""
    year, month, day, hour = dt.year, dt.month, dt.day, dt.hour
    if month < 3 or month > 11:
        return False
    if month > 3 and month < 11:
        return True
    if month == 3:
        w = datetime.date(year, 3, 1).weekday()  # 0 is Monday, 6 is Sunday
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

def format_iso_time(ts, target_tz='shanghai'):
    if not ts:
        return None
    # MT5 deal.time represents Broker Server Time seconds since 1970-01-01
    dt_broker = datetime.datetime.fromtimestamp(ts, tz=datetime.timezone.utc).replace(tzinfo=None)
    if target_tz == 'shanghai':
        offset_hours = 5 if is_us_dst(dt_broker) else 6
        dt_shanghai = dt_broker + datetime.timedelta(hours=offset_hours)
        return dt_shanghai.strftime('%Y-%m-%dT%H:%M:%S')
    elif target_tz in ('broker', 'raw'):
        return dt_broker.strftime('%Y-%m-%dT%H:%M:%S')
    elif target_tz == 'utc':
        offset_hours = -3 if is_us_dst(dt_broker) else -2
        dt_utc = dt_broker + datetime.timedelta(hours=offset_hours)
        return dt_utc.strftime('%Y-%m-%dT%H:%M:%S')
    else:
        offset_hours = 5 if is_us_dst(dt_broker) else 6
        dt_shanghai = dt_broker + datetime.timedelta(hours=offset_hours)
        return dt_shanghai.strftime('%Y-%m-%dT%H:%M:%S')

def sync_trades(days=30, limit=None, all_history=False, from_date=None, to_date=None, target_tz='shanghai'):
    if not mt5:
        return {
            "success": False,
            "error": "MetaTrader5 Python module not available in this environment (available on Windows with MT5 installed)."
        }
    if not mt5.initialize():
        return {
            "success": False,
            "error": f"Failed to initialize MT5: {mt5.last_error()}"
        }

    try:
        now = datetime.datetime.now()
        
        # Determine to_dt
        if to_date:
            try:
                if len(to_date) == 10:
                    to_dt = datetime.datetime.strptime(to_date, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
                else:
                    to_dt = datetime.datetime.fromisoformat(to_date.replace('Z', ''))
            except Exception:
                to_dt = now
        else:
            to_dt = now

        # Determine from_dt
        if all_history:
            from_dt = datetime.datetime(2010, 1, 1)
        elif from_date:
            try:
                if len(from_date) == 10:
                    from_dt = datetime.datetime.strptime(from_date, '%Y-%m-%d').replace(hour=0, minute=0, second=0)
                else:
                    from_dt = datetime.datetime.fromisoformat(from_date.replace('Z', ''))
            except Exception:
                from_dt = to_dt - datetime.timedelta(days=days or 30)
        else:
            from_dt = to_dt - datetime.timedelta(days=days or 30)

        deals = mt5.history_deals_get(from_dt, to_dt)
        if deals is None:
            return {
                "success": True,
                "count": 0,
                "trades": []
            }

        # Group deals by position_id
        pos_map = defaultdict(list)
        for deal in deals:
            if deal.symbol and deal.position_id > 0:
                pos_map[deal.position_id].append(deal)

        trades = []
        for pos_id, deal_list in pos_map.items():
            in_deals = [d for d in deal_list if d.entry == 0]
            out_deals = [d for d in deal_list if d.entry in (1, 2, 3)]

            # Only process closed or partially closed trades
            if not in_deals or not out_deals:
                continue

            first_in = in_deals[0]
            last_out = out_deals[-1]

            total_in_vol = sum(d.volume for d in in_deals)
            total_out_vol = sum(d.volume for d in out_deals)
            if total_in_vol <= 0 or total_out_vol <= 0:
                continue

            entry_price = sum(d.volume * d.price for d in in_deals) / total_in_vol
            exit_price = sum(d.volume * d.price for d in out_deals) / total_out_vol

            # 0: DEAL_TYPE_BUY, 1: DEAL_TYPE_SELL
            direction = 'long' if first_in.type == 0 else 'short'
            
            # Net profit = profit + swap + commission + fee
            total_profit = sum(d.profit + d.swap + d.commission + getattr(d, 'fee', 0.0) for d in deal_list)
            
            # SL / TP parsing
            all_comments = " ".join(filter(None, [d.comment for d in deal_list]))
            sl, tp = parse_sl_tp(all_comments)

            final_trigger = None
            if '[sl' in all_comments.lower() or any(d.reason == 4 for d in out_deals):
                final_trigger = 'stopLoss'
            elif '[tp' in all_comments.lower() or any(d.reason == 5 for d in out_deals):
                final_trigger = 'takeProfit'

            entry_iso = format_iso_time(first_in.time, target_tz=target_tz)
            exit_iso = format_iso_time(last_out.time, target_tz=target_tz)

            # Automatically derive market session from entry time hour (UTC+8)
            session = None
            if entry_iso:
                try:
                    hour_str = entry_iso[11:13]
                    if hour_str.isdigit():
                        hour = int(hour_str)
                        if 8 <= hour < 15:
                            session = 'Asia'
                        elif 15 <= hour < 21:
                            session = 'Europe'
                        else:
                            session = 'US'
                except Exception:
                    pass

            trade = {
                "ticket": str(pos_id),
                "positionId": str(pos_id),
                "symbol": first_in.symbol,
                "direction": direction,
                "size": round(min(total_in_vol, total_out_vol), 4),
                "entryPrice": round(entry_price, 5),
                "exitPrice": round(exit_price, 5),
                "entryTime": entry_iso,
                "exitTime": exit_iso,
                "tradeDate": exit_iso or entry_iso,
                "manualPnl": round(total_profit, 2),
                "stopLoss": round(sl, 5) if sl else None,
                "takeProfit": round(tp, 5) if tp else None,
                "notes": f"MT5 Position #{pos_id}{(' | ' + all_comments.strip()) if all_comments.strip() else ''}",
                "tags": ["MT5", first_in.symbol],
                "session": session,
                "finalTrigger": final_trigger
            }
            trades.append(trade)

        # Sort by exit time descending (most recent first)
        trades.sort(key=lambda x: x["exitTime"] or "", reverse=True)

        if limit and limit > 0:
            trades = trades[:limit]

        return {
            "success": True,
            "count": len(trades),
            "trades": trades
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
    finally:
        mt5.shutdown()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Sync closed trades from MT5")
    parser.add_argument("--days", type=int, default=30, help="Days of history to fetch")
    parser.add_argument("--all", action="store_true", help="Fetch all history")
    parser.add_argument("--from-date", type=str, default=None, help="Start date (YYYY-MM-DD or ISO)")
    parser.add_argument("--to-date", type=str, default=None, help="End date (YYYY-MM-DD or ISO)")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of trades")
    parser.add_argument("--csv", type=str, default=None, help="Export to CSV file path")
    parser.add_argument("--json", action="store_true", help="Output JSON to stdout")
    parser.add_argument("--timezone", type=str, default="shanghai", help="Target timezone (default: shanghai)")

    args = parser.parse_args()

    result = sync_trades(days=args.days, limit=args.limit, all_history=args.all, from_date=args.from_date, to_date=args.to_date, target_tz=args.timezone)

    if args.csv and result.get("success") and result.get("trades"):
        import csv
        with open(args.csv, 'w', newline='', encoding='utf-8-sig') as f:
            fieldnames = ["symbol", "direction", "size", "entryPrice", "exitPrice", "entryTime", "exitTime", "manualPnl", "stopLoss", "takeProfit", "notes", "tags", "finalTrigger"]
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for t in result["trades"]:
                writer.writerow({
                    "symbol": t["symbol"],
                    "direction": t["direction"],
                    "size": t["size"],
                    "entryPrice": t["entryPrice"],
                    "exitPrice": t["exitPrice"],
                    "entryTime": t["entryTime"],
                    "exitTime": t["exitTime"],
                    "manualPnl": t["manualPnl"],
                    "stopLoss": t["stopLoss"] or "",
                    "takeProfit": t["takeProfit"] or "",
                    "notes": t["notes"],
                    "tags": ",".join(t["tags"]),
                    "finalTrigger": t["finalTrigger"] or ""
                })
        print(f"Exported {len(result['trades'])} trades to {args.csv}")

    if args.json or not args.csv:
        print(json.dumps(result, ensure_ascii=False))
