//+------------------------------------------------------------------+
//|                                             TradeZen_Sync_EA.mq4 |
//|                                     TradeZen Master Sync Bridge  |
//|                          Copyright 2026, TradeZen Platform Master |
//|                                    https://your-domain.com       |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, TradeZen Platform Master"
#property link      "https://your-domain.com"
#property version   "1.20"
#property strict
#property description "自动将 MT4 历史与实时平仓订单、历史全量与实时增量K线流直推同步到远程 TradeZen 服务端"

//--- 订单同步范围枚举
enum ENUM_ORDER_SYNC_MODE
{
   ORDER_SYNC_THIS_WEEK   = 0, // 本周平仓订单 (本周一至今)
   ORDER_SYNC_THIS_MONTH  = 1, // 本月平仓订单 (当月1号至今)
   ORDER_SYNC_THIS_YEAR   = 2, // 今年平仓订单 (当年1月1日至今)
   ORDER_SYNC_ALL_HISTORY = 3, // 全部历史订单 (All Deals)
   ORDER_SYNC_RECENT_DAYS = 4  // 固定天数 (InpSyncHistoryDays)
};

//--- 同步模式枚举
enum ENUM_CANDLE_SYNC_MODE
{
   CANDLE_SYNC_RECENT_BARS  = 0, // 按固定根数 (最近 N 根)
   CANDLE_SYNC_CUSTOM_RANGE = 1, // 自定义时间范围 (指定开始和结束日期)
   CANDLE_SYNC_ALL_HISTORY  = 2  // 全量历史
};

//--- 输入参数
input string InpServerUrl          = "http://localhost:3000/api"; // 远程服务 API 地址 (勿以斜杠结尾)
input string InpApiToken           = "";                          // 平台专属同步密钥 (仅限本人使用！请勿转给他人，以防账单数据混淆)
input bool   InpSyncOrders         = true;                        // 启用订单自动同步
input bool   InpLiveOrderSync      = true;                        // 开启实时增量同步 (默认开启，设为false则仅同步历史订单)
input ENUM_ORDER_SYNC_MODE InpOrderSyncMode = ORDER_SYNC_THIS_MONTH; // 首次加载同步范围 (本周/本月/今年/全部)
input int    InpSyncHistoryDays    = 30;                          // 固定天数模式下的历史天数
input int    InpSyncIntervalSec    = 30;                          // 周期轮询检查间隔(秒)

input bool   InpSyncCandles        = true;                        // 启用K线自动同步
//--- K线周期固定为 1M (原子基准周期，用户不可更改；云端将自动向上聚合 M5/M15/H1/H4/D1 等所有更高周期)
const int    InpCandleTf           = PERIOD_M1;
input ENUM_CANDLE_SYNC_MODE InpCandleSyncMode = CANDLE_SYNC_RECENT_BARS; // 初始K线同步模式
input datetime InpCandleStartTime  = D'2026.01.01 00:00:00';       // 自定义起始时间 (自定义模式生效)
input datetime InpCandleStopTime   = 0;                           // 自定义结束时间 (0表示当前最新时间)
input int    InpCandleBars         = 1500;                        // 固定根数模式根数 (默认 1500 根 1M K线，约覆盖 25 小时)
input int    InpCandleSyncInterval = 120;                         // 初始全量同步重试/更新间隔(秒)
input bool   InpClearOldM5         = true;                        // 首次同步前清空云端该品种旧M5数据 (确保1M全新纯净)

input bool   InpLiveCandleSync     = true;                        // 历史同步完成后，保持实时增量同步最新K线
input int    InpLiveSyncInterval   = 15;                          // 实时增量同步心跳间隔(秒，默认15秒更新当前跳动柱)
input bool   InpSyncOnNewBar       = true;                        // 每次新K线生成/上一根收盘时立即触发同步

//--- 全局变量
datetime g_last_order_sync_time     = 0;
datetime g_last_candle_sync_time    = 0;
datetime g_last_live_candle_time    = 0;
datetime g_last_bar_time            = 0;
bool     g_initial_candle_sync_done = false;
int      g_synced_tickets[];

//+------------------------------------------------------------------+
//| 辅助函数: 判断 Ticket 是否已同步过                                    |
//+------------------------------------------------------------------+
bool IsTicketSynced(int ticket)
{
   int total = ArraySize(g_synced_tickets);
   for(int i = 0; i < total; i++)
   {
      if(g_synced_tickets[i] == ticket) return true;
   }
   return false;
}

void RecordSyncedTicket(int ticket)
{
   int size = ArraySize(g_synced_tickets);
   ArrayResize(g_synced_tickets, size + 1);
   g_synced_tickets[size] = ticket;
}

//+------------------------------------------------------------------+
//| 辅助函数: 发送 HTTP POST JSON 请求                                |
//+------------------------------------------------------------------+
bool SendJsonRequest(string endpoint, string jsonBody, string &responseOut)
{
   if(StringLen(InpServerUrl) == 0) return false;

   string url = InpServerUrl + endpoint;
   string headers = "Content-Type: application/json\r\n";
   if(StringLen(InpApiToken) > 0)
   {
      headers += "Authorization: Bearer " + InpApiToken + "\r\n";
   }

   char postData[];
   char resultData[];
   string resultHeaders;

   StringToCharArray(jsonBody, postData, 0, WHOLE_ARRAY, CP_UTF8);
   int postDataSize = ArraySize(postData);
   if(postDataSize > 0 && postData[postDataSize - 1] == 0)
   {
      ArrayResize(postData, postDataSize - 1);
   }

   int timeoutMs = 30000;
   int maxRetries = 2;
   int httpCode = -1;
   int err = 0;

   for(int attempt = 0; attempt <= maxRetries; attempt++)
   {
      ResetLastError();
      httpCode = WebRequest("POST", url, headers, timeoutMs, postData, resultData, resultHeaders);
      err = GetLastError();

      if(httpCode == 200 || httpCode == 201)
      {
         responseOut = CharArrayToString(resultData, 0, WHOLE_ARRAY, CP_UTF8);
         return true;
      }

      if(err == 4060)
      {
         PrintFormat("[TradeZen EA MT4] 错误: WebRequest 被禁止! 请在 MT4 菜单 '工具' -> '选项' -> 'EA交易' 中勾选 '允许 WebRequest' 并添加 URL: %s", InpServerUrl);
         return false;
      }

      if((httpCode == 502 || httpCode == 503 || httpCode == 504 || httpCode == -1) && attempt < maxRetries)
      {
         Sleep(2000);
         continue;
      }

      break;
   }

   string errBody = CharArrayToString(resultData, 0, WHOLE_ARRAY, CP_UTF8);
   string cleanErr = errBody;
   if(StringFind(cleanErr, "<html") >= 0 || StringFind(cleanErr, "<HTML") >= 0 || StringFind(cleanErr, "<!DOCTYPE") >= 0)
   {
      cleanErr = "云端服务返回了 HTML 错误页 (可能是服务冷启动唤醒中或反向代理超时，HTTP " + IntegerToString(httpCode) + ")，稍后将自动重试";
   }
   else if(StringLen(cleanErr) > 250)
   {
      cleanErr = StringSubstr(cleanErr, 0, 250) + "...";
   }

   PrintFormat("[TradeZen EA MT4] 请求失败! 目标: %s | HTTP状态码: %d | 错误码: %d | 响应: %s", url, httpCode, err, cleanErr);
   return false;
}

//+------------------------------------------------------------------+
//| 核心功能: 收集 MT4 平仓订单并推送                                   |
//+------------------------------------------------------------------+
void SyncOrders()
{
   if(!InpSyncOrders) return;
   if(g_last_order_sync_time > 0 && !InpLiveOrderSync) return;

   datetime now = TimeCurrent();
   datetime threshold = 0;

   if(g_last_order_sync_time > 0)
   {
      threshold = g_last_order_sync_time - 300;
   }
   else
   {
      MqlDateTime dt;
      TimeToStruct(now, dt);
      switch(InpOrderSyncMode)
      {
         case ORDER_SYNC_THIS_WEEK:
         {
            int daysFromMonday = (dt.day_of_week == 0) ? 6 : (dt.day_of_week - 1);
            datetime todayZero = now - (dt.hour * 3600 + dt.min * 60 + dt.sec);
            threshold = todayZero - daysFromMonday * 86400;
            break;
         }
         case ORDER_SYNC_THIS_MONTH:
         {
            datetime todayZero = now - (dt.hour * 3600 + dt.min * 60 + dt.sec);
            threshold = todayZero - (dt.day - 1) * 86400;
            break;
         }
         case ORDER_SYNC_THIS_YEAR:
         {
            dt.mon = 1;
            dt.day = 1;
            dt.hour = 0;
            dt.min = 0;
            dt.sec = 0;
            threshold = StructToTime(dt);
            break;
         }
         case ORDER_SYNC_ALL_HISTORY:
         {
            threshold = 0;
            break;
         }
         case ORDER_SYNC_RECENT_DAYS:
         default:
         {
            threshold = now - InpSyncHistoryDays * 86400;
            break;
         }
      }
   }

   int totalHistory = OrdersHistoryTotal();
   if(totalHistory == 0) return;

   string jsonItems = "";
   int validCount = 0;

   for(int i = 0; i < totalHistory; i++)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_HISTORY)) continue;

      int type = OrderType();
      if(type != OP_BUY && type != OP_SELL) continue;

      datetime closeTime = OrderCloseTime();
      if(closeTime < threshold) continue;

      int ticket = OrderTicket();
      if(IsTicketSynced(ticket)) continue;

      string symbol = OrderSymbol();
      double lots = OrderLots();
      double openPrice = OrderOpenPrice();
      double closePrice = OrderClosePrice();
      datetime openTime = OrderOpenTime();
      double profit = OrderProfit();
      double commission = OrderCommission();
      double swap = OrderSwap();
      string comment = OrderComment();
      string direction = (type == OP_BUY) ? "long" : "short";
      double netPnl = profit + commission + swap;

      if(validCount > 0) jsonItems += ",";
      jsonItems += StringFormat(
         "{\"ticket\":\"%d\",\"symbol\":\"%s\",\"direction\":\"%s\",\"size\":%.2f,\"entryPrice\":%.5f,\"exitPrice\":%.5f,\"entryTime\":\"%s\",\"exitTime\":\"%s\",\"manualPnl\":%.2f,\"profit\":%.2f,\"commission\":%.2f,\"swap\":%.2f,\"notes\":\"%s\"}",
         ticket,
         symbol,
         direction,
         lots,
         openPrice,
         closePrice,
         TimeToStr(openTime, TIME_DATE | TIME_SECONDS),
         TimeToStr(closeTime, TIME_DATE | TIME_SECONDS),
         netPnl,
         profit,
         commission,
         swap,
         comment
      );

      RecordSyncedTicket(ticket);
      validCount++;
   }

   if(validCount > 0)
   {
      string payload = StringFormat("{\"platform\":\"MT4 EA Direct\",\"trades\":[%s]}", jsonItems);
      string resp;
      if(SendJsonRequest("/trades/sync", payload, resp))
      {
         g_last_order_sync_time = now;
         PrintFormat("[TradeZen EA] 成功直推同步 %d 笔 MT4 交易订单到远程服务器!", validCount);
      }
   }
}

//+------------------------------------------------------------------+
//| 周期转字符串                                                      |
//+------------------------------------------------------------------+
string TimeframeToStr(int tf)
{
   switch(tf)
   {
      case PERIOD_M1:  return "M1";
      case PERIOD_M5:  return "M5";
      case PERIOD_M15: return "M15";
      case PERIOD_M30: return "M30";
      case PERIOD_H1:  return "H1";
      case PERIOD_H4:  return "H4";
      case PERIOD_D1:  return "D1";
      default:         return "M5";
   }
}

//+------------------------------------------------------------------+
//| 核心功能: 收集 MT4 K线并推送 (支持自定义时间范围与分批)               |
//+------------------------------------------------------------------+
void SyncCandles()
{
   if(!InpSyncCandles) return;

   datetime now = TimeCurrent();
   if(g_last_candle_sync_time > 0 && (now - g_last_candle_sync_time < InpCandleSyncInterval))
   {
      return;
   }

   int totalAvailable = iBars(_Symbol, InpCandleTf);
   if(totalAvailable <= 0) return;

   int startBar = 0; // 最旧的那根 K 线 (下标大)
   int endBar = 0;   // 最新的那根 K 线 (下标小，0 为当前K线)

   if(InpCandleSyncMode == CANDLE_SYNC_CUSTOM_RANGE)
   {
      datetime stopTime = (InpCandleStopTime == 0) ? now : InpCandleStopTime;
      startBar = iBarShift(_Symbol, InpCandleTf, InpCandleStartTime, false);
      endBar = iBarShift(_Symbol, InpCandleTf, stopTime, false);
      if(startBar < endBar)
      {
         int tmp = startBar; startBar = endBar; endBar = tmp;
      }
      PrintFormat("[TradeZen EA MT4] [自定义范围] %s (%s): %s 至 %s | 跨越 %d 根K线",
         _Symbol, TimeframeToStr(InpCandleTf),
         TimeToStr(InpCandleStartTime, TIME_DATE | TIME_MINUTES),
         TimeToStr(stopTime, TIME_DATE | TIME_MINUTES),
         (startBar - endBar + 1));
   }
   else if(InpCandleSyncMode == CANDLE_SYNC_ALL_HISTORY)
   {
      startBar = totalAvailable - 1;
      endBar = 0;
   }
   else // CANDLE_SYNC_RECENT_BARS
   {
      startBar = MathMin(InpCandleBars - 1, totalAvailable - 1);
      endBar = 0;
   }

   int totalBars = startBar - endBar + 1;
   if(totalBars <= 0) return;

   // 首次全量同步前，自动清理云端此品种的旧 M5 数据
   if(!g_initial_candle_sync_done && InpClearOldM5)
   {
      string clearPayload = StringFormat("{\"symbol\":\"%s\",\"timeframe\":\"M5\"}", _Symbol);
      string clearResp;
      PrintFormat("[TradeZen EA MT4] 正在清空云端品种 %s 原有 M5 K线数据...", _Symbol);
      SendJsonRequest("/backtesting/candles/clear", clearPayload, clearResp);
   }

   string tfStr = TimeframeToStr(InpCandleTf);
   int batchSize = 300;
   int currentFrom = startBar;
   int totalSynced = 0;

   while(currentFrom >= endBar)
   {
      int currentTo = MathMax(endBar, currentFrom - batchSize + 1);
      string candlesJson = "";

      // 从旧到新构建 JSON (下标从大到小)
      for(int i = currentFrom; i >= currentTo; i--)
      {
         datetime barTime = iTime(_Symbol, InpCandleTf, i);
         double o = iOpen(_Symbol, InpCandleTf, i);
         double h = iHigh(_Symbol, InpCandleTf, i);
         double l = iLow(_Symbol, InpCandleTf, i);
         double c = iClose(_Symbol, InpCandleTf, i);
         long vol = iVolume(_Symbol, InpCandleTf, i);

         if(StringLen(candlesJson) > 0) candlesJson += ",";
         candlesJson += StringFormat(
            "{\"time\":\"%s\",\"timestamp\":%d,\"open\":%.5f,\"high\":%.5f,\"low\":%.5f,\"close\":%.5f,\"volume\":%d}",
            TimeToStr(barTime, TIME_DATE | TIME_MINUTES),
            (long)barTime,
            o, h, l, c, vol
         );
      }

      string payload = StringFormat(
         "{\"symbol\":\"%s\",\"timeframe\":\"%s\",\"candles\":[%s]}",
         _Symbol,
         tfStr,
         candlesJson
      );

      string resp;
      if(SendJsonRequest("/backtesting/candles/sync", payload, resp))
      {
         totalSynced += (currentFrom - currentTo + 1);
      }
      else
      {
         PrintFormat("[TradeZen EA MT4] 批量K线推送失败，终止后续批次");
         break;
      }

      currentFrom = currentTo - 1;
   }

   if(totalSynced > 0)
   {
      g_last_candle_sync_time = now;
      g_initial_candle_sync_done = true;
      g_last_bar_time = iTime(_Symbol, InpCandleTf, 0);
      PrintFormat("[TradeZen EA MT4] 成功同步品种 %s (%s) 共 %d 根K线到远程服务器! 已自动进入实时增量流模式", _Symbol, tfStr, totalSynced);
   }
}

//+------------------------------------------------------------------+
//| 核心功能: MT4 实时增量推送最新蜡烛 (当前柱与上一收盘柱)             |
//+------------------------------------------------------------------+
void SyncLiveCandles(int barsCount = 2)
{
   if(!InpSyncCandles || !InpLiveCandleSync) return;

   int totalAvailable = iBars(_Symbol, InpCandleTf);
   if(totalAvailable <= 0) return;

   int count = MathMin(barsCount, totalAvailable);
   string tfStr = TimeframeToStr(InpCandleTf);
   string candlesJson = "";

   // 从旧到新构建 JSON (下标大的是旧的，下标 0 是当前跳动柱)
   for(int i = count - 1; i >= 0; i--)
   {
      datetime barTime = iTime(_Symbol, InpCandleTf, i);
      double barOpen = iOpen(_Symbol, InpCandleTf, i);
      double barHigh = iHigh(_Symbol, InpCandleTf, i);
      double barLow = iLow(_Symbol, InpCandleTf, i);
      double barClose = iClose(_Symbol, InpCandleTf, i);
      long barVol = iVolume(_Symbol, InpCandleTf, i);

      if(StringLen(candlesJson) > 0) candlesJson += ",";
      candlesJson += StringFormat(
         "{\"time\":\"%s\",\"timestamp\":%d,\"open\":%.5f,\"high\":%.5f,\"low\":%.5f,\"close\":%.5f,\"volume\":%d}",
         TimeToStr(barTime, TIME_DATE | TIME_MINUTES),
         (long)barTime,
         barOpen,
         barHigh,
         barLow,
         barClose,
         barVol
      );
   }

   string payload = StringFormat(
      "{\"symbol\":\"%s\",\"timeframe\":\"%s\",\"candles\":[%s]}",
      _Symbol,
      tfStr,
      candlesJson
   );

   string resp;
   if(SendJsonRequest("/backtesting/candles/sync", payload, resp))
   {
      g_last_live_candle_time = TimeCurrent();
   }
}

//+------------------------------------------------------------------+
//| 初始化                                                            |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("==================================================");
   Print("[TradeZen EA MT4] 正在启动 (v1.20 实时增量流同步版)...");
   Print("[TradeZen EA MT4] [安全提示] 当前使用的 API Token 为个人专属密钥，请勿转给他人使用以防账单数据被污染。");
   PrintFormat("[TradeZen EA MT4] 远程目标: %s", InpServerUrl);
   PrintFormat("[TradeZen EA MT4] 品种: %s | 周期: %s (已锁定为 1M 基础原子周期，服务端自动向上聚合多周期)", _Symbol, TimeframeToStr(InpCandleTf));
   if(InpLiveCandleSync)
   {
      PrintFormat("[TradeZen EA MT4] 实时增量流同步已开启 (心跳: %d秒 | 新K线事件: %s)",
         InpLiveSyncInterval, (InpSyncOnNewBar ? "已启用" : "已关闭"));
   }
   Print("==================================================");

   int timerSec = MathMax(2, MathMin(InpLiveSyncInterval, InpSyncIntervalSec));
   EventSetTimer(timerSec);

   SyncOrders();
   SyncCandles();
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("[TradeZen EA MT4] 已卸载。");
}

//+------------------------------------------------------------------+
//| 实时行情 Tick 变动监听                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   // 1. 实时监听是否有新成交单
   SyncOrders();

   // 2. 监听新K线生成
   if(InpSyncCandles && InpLiveCandleSync && InpSyncOnNewBar && g_initial_candle_sync_done)
   {
      datetime currentBarTime = iTime(_Symbol, InpCandleTf, 0);
      if(currentBarTime != 0 && currentBarTime != g_last_bar_time)
      {
         g_last_bar_time = currentBarTime;
         SyncLiveCandles(2);
      }
   }
}

//+------------------------------------------------------------------+
//| 定时器触发                                                        |
//+------------------------------------------------------------------+
void OnTimer()
{
   datetime now = TimeCurrent();

   // 1. 检查订单同步
   if(InpSyncOrders)
   {
      if(g_last_order_sync_time == 0 || (now - g_last_order_sync_time >= InpSyncIntervalSec))
      {
         SyncOrders();
      }
   }

   // 2. K线同步逻辑
   if(InpSyncCandles)
   {
      if(!g_initial_candle_sync_done)
      {
         if(g_last_candle_sync_time == 0 || (now - g_last_candle_sync_time >= InpCandleSyncInterval))
         {
            SyncCandles();
         }
      }
      else if(InpLiveCandleSync)
      {
         if(g_last_live_candle_time == 0 || (now - g_last_live_candle_time >= InpLiveSyncInterval))
         {
            SyncLiveCandles(2);
         }
      }
   }
}
