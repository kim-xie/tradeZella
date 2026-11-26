//+------------------------------------------------------------------+
//|                                             TradeZen_Sync_EA.mq5 |
//|                                     TradeZen Master Sync Bridge  |
//|                          Copyright 2026, TradeZen Platform Master |
//|                                    https://your-domain.com       |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, TradeZen Platform Master"
#property link      "https://your-domain.com"
#property version   "1.30"
#property description "自动将 MT5 历史与实时已平仓持仓(Position级，口径与HTML报表一致)、历史全量与实时增量K线流直推同步到远程 TradeZen 服务端"

//--- 订单同步范围枚举
enum ENUM_ORDER_SYNC_MODE
{
   ORDER_SYNC_THIS_WEEK   = 0, // 本周平仓订单 (本周一至今)
   ORDER_SYNC_THIS_MONTH  = 1, // 本月平仓订单 (当月1号至今)
   ORDER_SYNC_THIS_YEAR   = 2, // 今年平仓订单 (当年1月1日至今)
   ORDER_SYNC_ALL_HISTORY = 3, // 全部历史订单 (All Deals)
   ORDER_SYNC_RECENT_DAYS = 4  // 固定天数 (InpSyncHistoryDays)
};

//--- K线同步模式枚举
enum ENUM_CANDLE_SYNC_MODE
{
   CANDLE_SYNC_RECENT_BARS  = 0, // 按固定根数 (最近 N 根)
   CANDLE_SYNC_CUSTOM_RANGE = 1, // 自定义时间范围 (指定开始和结束日期)
   CANDLE_SYNC_ALL_HISTORY  = 2  // 全量历史 (同步当前品种所有可用K线)
};

//--- 券商服务器时区枚举
enum ENUM_BROKER_TIMEZONE
{
   BROKER_TZ_AUTO      = 0, // 自动检测服务器时区 (推荐)
   BROKER_TZ_EET_USDST = 1, // 标准 EET/EEST 美式夏令时 (冬UTC+2 / 夏UTC+3)
   BROKER_TZ_UTC0      = 2, // UTC+0 零时区 (如部分外汇/加密券商)
   BROKER_TZ_UTC3      = 3, // UTC+3 固定时区 (无夏令时)
   BROKER_TZ_UTC2      = 4, // UTC+2 固定时区 (无夏令时)
   BROKER_TZ_SHANGHAI  = 5  // UTC+8 北京/上海时间
};

//--- 输入参数
input group "=== 远程服务连接设置 ==="
input string InpServerUrl          = "http://localhost:3000/api"; // 远程服务 API 地址 (勿以斜杠结尾)
input string InpApiToken           = "";                          // 平台专属同步密钥 (仅限本人使用！请勿转给他人，以防账单数据混淆)
input ENUM_BROKER_TIMEZONE InpBrokerTimezone = BROKER_TZ_AUTO;    // 券商服务器时区 (用于精确换算北京时间)

input group "=== 订单同步配置 ==="
input bool   InpSyncOrders         = true;                        // 启用订单自动同步
input bool   InpLiveOrderSync      = true;                        // 开启实时增量同步 (默认开启，设为false则仅同步历史订单)
input ENUM_ORDER_SYNC_MODE InpOrderSyncMode = ORDER_SYNC_ALL_HISTORY; // 首次加载同步范围 (默认全部历史，与HTML报表一致)
input int    InpSyncHistoryDays    = 30;                          // 固定天数模式下的历史天数
input int    InpSyncIntervalSec    = 30;                          // 周期轮询检查间隔(秒)

input group "=== K线数据同步配置 (历史回溯与自定义时间范围) ==="
input bool   InpSyncCandles        = true;                        // 启用K线自动同步
//--- K线周期固定为 1M (原子基准周期，用户不可更改；云端将自动向上聚合 M5/M15/H1/H4/D1 等所有更高周期)
const ENUM_TIMEFRAMES InpCandleTf  = PERIOD_M1;
input ENUM_CANDLE_SYNC_MODE InpCandleSyncMode = CANDLE_SYNC_RECENT_BARS; // 初始K线同步模式
input datetime InpCandleStartTime  = D'2026.01.01 00:00:00';       // 自定义起始时间 (自定义范围模式生效)
input datetime InpCandleStopTime   = 0;                           // 自定义结束时间 (0表示当前最新时间)
input int    InpCandleBars         = 1500;                        // 固定根数模式根数 (默认 1500 根 1M K线，约覆盖 25 小时)
input int    InpCandleSyncInterval = 120;                         // 初始全量同步重试/更新间隔(秒)
input bool   InpClearOldM5         = true;                        // 首次同步前清空云端该品种旧M5数据 (确保1M全新纯净)

input group "=== 实时增量K线流同步配置 ==="
input bool   InpLiveCandleSync     = true;                        // 历史同步完成后，保持实时增量同步最新K线
input int    InpLiveSyncInterval   = 15;                          // 实时增量同步心跳间隔(秒，默认15秒更新当前跳动柱)
input bool   InpSyncOnNewBar       = true;                        // 每次新K线生成/上一根收盘时立即触发同步

//--- 全局变量
datetime g_last_order_sync_time     = 0;
datetime g_last_candle_sync_time    = 0;
datetime g_last_live_candle_time    = 0;
datetime g_last_bar_time            = 0;
bool     g_initial_candle_sync_done = false;
long     g_synced_positions[];

//+------------------------------------------------------------------+
//| 辅助函数: JSON 字符串转义                                           |
//+------------------------------------------------------------------+
string EscapeJsonString(const string src)
{
   string out = src;
   StringReplace(out, "\\", "\\\\");
   StringReplace(out, "\"", "\\\"");
   StringReplace(out, "\r", " ");
   StringReplace(out, "\n", " ");
   StringReplace(out, "\t", " ");
   return out;
}

//+------------------------------------------------------------------+
//| 辅助函数: 判断是否处于美式夏令时 (EET/EEST 切换参照)                  |
//+------------------------------------------------------------------+
bool IsUSDST(const datetime dt)
{
   MqlDateTime m;
   TimeToStruct(dt, m);
   if(m.mon < 3 || m.mon > 11) return false;
   if(m.mon > 3 && m.mon < 11) return true;

   MqlDateTime firstDay = m;
   firstDay.day = 1;
   firstDay.hour = 0;
   firstDay.min = 0;
   firstDay.sec = 0;
   MqlDateTime firstDayResolved;
   TimeToStruct(StructToTime(firstDay), firstDayResolved);
   int firstSunday = 1 + ((7 - firstDayResolved.day_of_week) % 7);

   if(m.mon == 3)
   {
      int secondSunday = firstSunday + 7;
      if(m.day < secondSunday) return false;
      if(m.day > secondSunday) return true;
      return m.hour >= 2;
   }
   if(m.mon == 11)
   {
      if(m.day < firstSunday) return true;
      if(m.day > firstSunday) return false;
      return m.hour < 2;
   }
   return false;
}

//+------------------------------------------------------------------+
//| 辅助函数: 构建时区参数字符串用于精确换算北京时间                        |
//+------------------------------------------------------------------+
void ResolveBrokerTimezonePayload(string &tzOut, long &gmtOffsetSecOut)
{
   gmtOffsetSecOut = 0;
   if(InpBrokerTimezone == BROKER_TZ_EET_USDST)
   {
      tzOut = "broker";
      return;
   }
   if(InpBrokerTimezone == BROKER_TZ_UTC0)
   {
      tzOut = "utc";
      gmtOffsetSecOut = 0;
      return;
   }
   if(InpBrokerTimezone == BROKER_TZ_UTC3)
   {
      tzOut = "offset";
      gmtOffsetSecOut = 10800;
      return;
   }
   if(InpBrokerTimezone == BROKER_TZ_UTC2)
   {
      tzOut = "offset";
      gmtOffsetSecOut = 7200;
      return;
   }
   if(InpBrokerTimezone == BROKER_TZ_SHANGHAI)
   {
      tzOut = "shanghai";
      gmtOffsetSecOut = 28800;
      return;
   }

   // BROKER_TZ_AUTO: 使用 TimeTradeServer() - TimeGMT() 检测当前服务器偏移
   if(MQLInfoInteger(MQL_TESTER))
   {
      tzOut = "broker";
      return;
   }

   datetime srvTime = TimeTradeServer();
   datetime gmtTime = TimeGMT();
   if(srvTime <= 0 || gmtTime <= 0)
   {
      tzOut = "broker";
      return;
   }
   long rawDiff = (long)srvTime - (long)gmtTime;
   long roundedOffset = (long)MathRound((double)rawDiff / 1800.0) * 1800;
   if(MathAbs(roundedOffset) > 50400)
   {
      tzOut = "broker";
      return;
   }

   // 若与当前美式夏令时 EET(+2h)/EEST(+3h) 一致，采用按订单成交日期判定夏令时的 broker 模式，历史跨季订单更准确
   long expectedEet = IsUSDST(srvTime) ? 10800 : 7200;
   if(roundedOffset == expectedEet)
   {
      tzOut = "broker";
      gmtOffsetSecOut = roundedOffset;
   }
   else
   {
      tzOut = "offset";
      gmtOffsetSecOut = roundedOffset;
   }
}

//+------------------------------------------------------------------+
//| 辅助函数: 判断 Position ID 是否已同步过                             |
//+------------------------------------------------------------------+
bool IsPositionSynced(const long posId)
{
   int total = ArraySize(g_synced_positions);
   for(int i = 0; i < total; i++)
   {
      if(g_synced_positions[i] == posId) return true;
   }
   return false;
}

//+------------------------------------------------------------------+
//| 辅助函数: 记录已同步 Position ID                                   |
//+------------------------------------------------------------------+
void RecordSyncedPosition(const long posId)
{
   if(IsPositionSynced(posId)) return;
   int size = ArraySize(g_synced_positions);
   ArrayResize(g_synced_positions, size + 1);
   g_synced_positions[size] = posId;
}

//+------------------------------------------------------------------+
//| 辅助函数: 检查该 Position 是否仍处于未完全平仓持仓中                 |
//+------------------------------------------------------------------+
bool IsPositionStillOpen(const long posId)
{
   int openTotal = PositionsTotal();
   for(int i = 0; i < openTotal; i++)
   {
      ulong openTicket = PositionGetTicket(i);
      if(openTicket == 0) continue;
      if(PositionGetInteger(POSITION_IDENTIFIER) == posId)
      {
         return true;
      }
   }
   return false;
}

//+------------------------------------------------------------------+
//| 辅助函数: 发送 HTTP POST JSON 请求                                |
//+------------------------------------------------------------------+
bool SendJsonRequest(const string endpoint, const string jsonBody, string &responseOut)
{
   if(StringLen(InpServerUrl) == 0)
   {
      Print("[TradeZen EA] 错误: 未配置 InpServerUrl 地址");
      return false;
   }

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
         PrintFormat("[TradeZen EA] 严重错误: WebRequest 被禁止! 请在 MT5 菜单 '工具' -> '选项' -> 'EA交易' 中勾选 '允许 WebRequest'，并添加 URL: %s", InpServerUrl);
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

   PrintFormat("[TradeZen EA] 请求失败! 目标: %s | HTTP状态码: %d | 错误码: %d | 响应: %s", url, httpCode, err, cleanErr);
   return false;
}

//+------------------------------------------------------------------+
//| 核心功能: 收集平仓订单并推送到远程接口 /trades/sync                     |
//+------------------------------------------------------------------+
void SyncOrders()
{
   if(!InpSyncOrders) return;
   if(g_last_order_sync_time > 0 && !InpLiveOrderSync) return;

   datetime now = TimeCurrent();
   datetime from = 0;

   if(g_last_order_sync_time > 0)
   {
      from = g_last_order_sync_time - 300;
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
            from = todayZero - daysFromMonday * 86400;
            break;
         }
         case ORDER_SYNC_THIS_MONTH:
         {
            datetime todayZero = now - (dt.hour * 3600 + dt.min * 60 + dt.sec);
            from = todayZero - (dt.day - 1) * 86400;
            break;
         }
         case ORDER_SYNC_THIS_YEAR:
         {
            dt.mon = 1;
            dt.day = 1;
            dt.hour = 0;
            dt.min = 0;
            dt.sec = 0;
            from = StructToTime(dt);
            break;
         }
         case ORDER_SYNC_ALL_HISTORY:
         {
            from = 0;
            break;
         }
         case ORDER_SYNC_RECENT_DAYS:
         default:
         {
            from = now - InpSyncHistoryDays * 86400;
            break;
         }
      }
   }

   if(!HistorySelect(from, now))
   {
      Print("[TradeZen EA] 查询历史交易失败: ", GetLastError());
      return;
   }

   int totalDeals = HistoryDealsTotal();
   if(totalDeals == 0) return;

   // 1. 按仓位 Position ID 去重收集所有「已完全平仓」的仓位，避免 HistorySelectByPosition 破坏外层缓存，同时与 HTML Positions 报表保持完全一致口径
   long candidatePosIds[];
   int candidateCount = 0;

   for(int i = 0; i < totalDeals; i++)
   {
      ulong dealTicket = HistoryDealGetTicket(i);
      if(dealTicket == 0) continue;

      long dealType = HistoryDealGetInteger(dealTicket, DEAL_TYPE);
      if(dealType != DEAL_TYPE_BUY && dealType != DEAL_TYPE_SELL) continue;

      long entryType = HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
      if(entryType != DEAL_ENTRY_OUT && entryType != DEAL_ENTRY_INOUT && entryType != DEAL_ENTRY_OUT_BY)
      {
         continue;
      }

      long posId = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
      if(posId <= 0) continue;
      if(IsPositionSynced(posId)) continue;
      if(IsPositionStillOpen(posId)) continue;

      bool alreadyQueued = false;
      for(int q = 0; q < candidateCount; q++)
      {
         if(candidatePosIds[q] == posId)
         {
            alreadyQueued = true;
            break;
         }
      }
      if(alreadyQueued) continue;

      ArrayResize(candidatePosIds, candidateCount + 1);
      candidatePosIds[candidateCount++] = posId;
   }

   if(candidateCount == 0) return;

   // 2. 按 Position 整仓维度聚合后分批推送（每批 100 笔，与 MT5 Positions 报表粒度/均价/净盈亏 100% 一致）
   int batchSize = 100;
   int totalBatches = (candidateCount + batchSize - 1) / batchSize;
   int totalSyncedTrades = 0;

   for(int b = 0; b < totalBatches; b++)
   {
      int startIdx = b * batchSize;
      int count = MathMin(batchSize, candidateCount - startIdx);
      string jsonItems = "";
      int batchValid = 0;
      long batchPosIds[];
      ArrayResize(batchPosIds, count);

      for(int i = 0; i < count; i++)
      {
         long posId = candidatePosIds[startIdx + i];
         if(!HistorySelectByPosition(posId)) continue;

         int posDeals = HistoryDealsTotal();
         if(posDeals == 0) continue;

         string symbol = "";
         string direction = "long";
         datetime openTime = 0;
         datetime closeTime = 0;
         bool hasInDeal = false;
         bool hasOutDeal = false;

         double inVolSum = 0.0;
         double inPriceVolSum = 0.0;
         double outVolSum = 0.0;
         double outPriceVolSum = 0.0;
         double profitSum = 0.0;
         double commSum = 0.0;
         double feeSum = 0.0;
         double swapSum = 0.0;

         double stopLoss = 0.0;
         double takeProfit = 0.0;
         string finalTrigger = "";
         string lastOutComment = "";
         string firstComment = "";
         long lastOutReason = -1;

         for(int j = 0; j < posDeals; j++)
         {
            ulong dTicket = HistoryDealGetTicket(j);
            if(dTicket == 0) continue;

            long dType = HistoryDealGetInteger(dTicket, DEAL_TYPE);
            if(dType != DEAL_TYPE_BUY && dType != DEAL_TYPE_SELL) continue;

            long dEntry = HistoryDealGetInteger(dTicket, DEAL_ENTRY);
            double dVol = HistoryDealGetDouble(dTicket, DEAL_VOLUME);
            double dPrice = HistoryDealGetDouble(dTicket, DEAL_PRICE);
            datetime dTime = (datetime)HistoryDealGetInteger(dTicket, DEAL_TIME);
            string dSymbol = HistoryDealGetString(dTicket, DEAL_SYMBOL);
            string dComment = HistoryDealGetString(dTicket, DEAL_COMMENT);

            if(StringLen(symbol) == 0 && StringLen(dSymbol) > 0) symbol = dSymbol;
            if(StringLen(firstComment) == 0 && StringLen(dComment) > 0) firstComment = dComment;

            profitSum += HistoryDealGetDouble(dTicket, DEAL_PROFIT);
            commSum   += HistoryDealGetDouble(dTicket, DEAL_COMMISSION);
            feeSum    += HistoryDealGetDouble(dTicket, DEAL_FEE);
            swapSum   += HistoryDealGetDouble(dTicket, DEAL_SWAP);

            if(dEntry == DEAL_ENTRY_IN)
            {
               if(!hasInDeal || dTime < openTime)
               {
                  openTime = dTime;
                  direction = (dType == DEAL_TYPE_BUY) ? "long" : "short";
                  hasInDeal = true;
               }
               inVolSum += dVol;
               inPriceVolSum += dVol * dPrice;
            }
            else if(dEntry == DEAL_ENTRY_OUT || dEntry == DEAL_ENTRY_INOUT || dEntry == DEAL_ENTRY_OUT_BY)
            {
               double effOutVol = dVol;
               if(dEntry == DEAL_ENTRY_INOUT && inVolSum > outVolSum && dVol > (inVolSum - outVolSum))
               {
                  effOutVol = inVolSum - outVolSum;
               }
               if(!hasOutDeal || dTime >= closeTime)
               {
                  closeTime = dTime;
                  lastOutReason = HistoryDealGetInteger(dTicket, DEAL_REASON);
                  lastOutComment = dComment;
                  hasOutDeal = true;
                  #ifdef DEAL_SL
                     double dSl = HistoryDealGetDouble(dTicket, DEAL_SL);
                     double dTp = HistoryDealGetDouble(dTicket, DEAL_TP);
                     if(dSl > 0.0) stopLoss = dSl;
                     if(dTp > 0.0) takeProfit = dTp;
                  #endif
               }
               outVolSum += effOutVol;
               outPriceVolSum += effOutVol * dPrice;
            }
         }

         if(!hasInDeal || !hasOutDeal || inVolSum <= 0.0 || outVolSum <= 0.0 || StringLen(symbol) == 0)
         {
            continue;
         }

         double volume = MathMin(inVolSum, outVolSum);
         double openPrice = inPriceVolSum / inVolSum;
         double closePrice = outPriceVolSum / outVolSum;

         // 若 DEAL_SL / DEAL_TP 为 0，反向遍历该仓位关联历史订单取最近一次非 0 止损/止盈
         int posOrders = HistoryOrdersTotal();
         for(int j = posOrders - 1; j >= 0; j--)
         {
            ulong ordTicket = HistoryOrderGetTicket(j);
            if(ordTicket > 0)
            {
               double ordSl = HistoryOrderGetDouble(ordTicket, ORDER_SL);
               double ordTp = HistoryOrderGetDouble(ordTicket, ORDER_TP);
               if(stopLoss <= 0.0 && ordSl > 0.0) stopLoss = ordSl;
               if(takeProfit <= 0.0 && ordTp > 0.0) takeProfit = ordTp;
               if(stopLoss > 0.0 && takeProfit > 0.0) break;
            }
         }

         string mergedComment = (StringLen(lastOutComment) > 0) ? lastOutComment : firstComment;
         string commentLower = mergedComment;
         StringToLower(commentLower);

         if(lastOutReason == DEAL_REASON_SL || StringFind(commentLower, "[sl") >= 0)
         {
            finalTrigger = "stopLoss";
         }
         else if(lastOutReason == DEAL_REASON_TP || StringFind(commentLower, "[tp") >= 0)
         {
            finalTrigger = "takeProfit";
         }

         // 从出场 Deal 备注中解析可能记录的止损止盈（例如 [sl 2640.50] / [tp 2650.00]）
         if(stopLoss <= 0.0)
         {
            int slIdx = StringFind(commentLower, "[sl ");
            if(slIdx >= 0)
            {
               int endIdx = StringFind(mergedComment, "]", slIdx);
               if(endIdx > slIdx)
               {
                  string slStr = StringSubstr(mergedComment, slIdx + 4, endIdx - (slIdx + 4));
                  stopLoss = StringToDouble(slStr);
               }
            }
         }
         if(takeProfit <= 0.0)
         {
            int tpIdx = StringFind(commentLower, "[tp ");
            if(tpIdx >= 0)
            {
               int endIdx = StringFind(mergedComment, "]", tpIdx);
               if(endIdx > tpIdx)
               {
                  string tpStr = StringSubstr(mergedComment, tpIdx + 4, endIdx - (tpIdx + 4));
                  takeProfit = StringToDouble(tpStr);
               }
            }
         }

         // 完整整仓净盈亏：Profit + Commission + Fee + Swap (与 MT5 HTML Positions 报表分毫不差)
         double netPnl = profitSum + commSum + feeSum + swapSum;

         string safeSymbol = EscapeJsonString(symbol);
         string safeComment = EscapeJsonString(mergedComment);

         if(batchValid > 0) jsonItems += ",";
         jsonItems += StringFormat(
            "{\"ticket\":\"%I64d\",\"positionId\":\"%I64d\",\"symbol\":\"%s\",\"direction\":\"%s\",\"size\":%.4f,\"entryPrice\":%.5f,\"exitPrice\":%.5f,\"stopLoss\":%.5f,\"takeProfit\":%.5f,\"finalTrigger\":\"%s\",\"entryTime\":\"%s\",\"exitTime\":\"%s\",\"manualPnl\":%.2f,\"profit\":%.2f,\"commission\":%.2f,\"fee\":%.2f,\"swap\":%.2f,\"notes\":\"%s\"}",
            posId,
            posId,
            safeSymbol,
            direction,
            volume,
            openPrice,
            closePrice,
            stopLoss,
            takeProfit,
            finalTrigger,
            TimeToString(openTime, TIME_DATE | TIME_SECONDS),
            TimeToString(closeTime, TIME_DATE | TIME_SECONDS),
            netPnl,
            profitSum,
            commSum,
            feeSum,
            swapSum,
            safeComment
         );

         batchPosIds[batchValid] = posId;
         batchValid++;
      }

      if(batchValid > 0)
      {
         string payloadTz = "broker";
         long payloadGmtOffsetSec = 0;
         ResolveBrokerTimezonePayload(payloadTz, payloadGmtOffsetSec);
         string payload = StringFormat(
            "{\"platform\":\"MT5 EA Direct\",\"timezone\":\"%s\",\"gmtOffsetSec\":%I64d,\"trades\":[%s]}",
            payloadTz,
            payloadGmtOffsetSec,
            jsonItems
         );
         string resp;
         if(SendJsonRequest("/trades/sync", payload, resp))
         {
            for(int k = 0; k < batchValid; k++)
            {
               RecordSyncedPosition(batchPosIds[k]);
            }
            totalSyncedTrades += batchValid;
         }
         else
         {
            PrintFormat("[TradeZen EA] 第 %d/%d 批持仓直推失败，终止本轮推送", b + 1, totalBatches);
            break;
         }
      }
   }

   if(totalSyncedTrades > 0)
   {
      g_last_order_sync_time = now;
      PrintFormat("[TradeZen EA] 成功直推同步 %d 笔交易订单到远程服务器! (分批次推送完成)", totalSyncedTrades);
   }
}

//+------------------------------------------------------------------+
//| 周期枚举转规范字符串                                               |
//+------------------------------------------------------------------+
string TimeframeToString(ENUM_TIMEFRAMES tf)
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
//| 核心功能: 收集图表K线数据并推送到远程接口 (支持自定义时间范围与智能分批)   |
//+------------------------------------------------------------------+
void SyncCandles()
{
   if(!InpSyncCandles) return;

   datetime now = TimeCurrent();
   if(g_last_candle_sync_time > 0 && (now - g_last_candle_sync_time < InpCandleSyncInterval))
   {
      return;
   }

   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   int copied = 0;

   // 1. 判断并执行获取模式
   if(InpCandleSyncMode == CANDLE_SYNC_CUSTOM_RANGE)
   {
      datetime stopTime = (InpCandleStopTime == 0) ? now : InpCandleStopTime;
      copied = CopyRates(_Symbol, InpCandleTf, InpCandleStartTime, stopTime, rates);
      PrintFormat("[TradeZen EA] [自定义范围模式] 获取 %s (%s): %s 至 %s | 获得 %d 根K线",
         _Symbol, TimeframeToString(InpCandleTf),
         TimeToString(InpCandleStartTime, TIME_DATE | TIME_MINUTES),
         TimeToString(stopTime, TIME_DATE | TIME_MINUTES),
         copied);
   }
   else if(InpCandleSyncMode == CANDLE_SYNC_ALL_HISTORY)
   {
      copied = CopyRates(_Symbol, InpCandleTf, 0, 50000, rates);
      PrintFormat("[TradeZen EA] [全量模式] 获取 %s (%s) 最大可用K线 | 获得 %d 根K线", _Symbol, TimeframeToString(InpCandleTf), copied);
   }
   else // CANDLE_SYNC_RECENT_BARS
   {
      copied = CopyRates(_Symbol, InpCandleTf, 0, InpCandleBars, rates);
   }

   if(copied <= 0)
   {
      PrintFormat("[TradeZen EA] 抓取 %s (%s) K线数据失败，错误码: %d", _Symbol, TimeframeToString(InpCandleTf), GetLastError());
      return;
   }

   // 2. 首次全量同步前，自动清理云端此品种的旧 M5 数据
   if(!g_initial_candle_sync_done && InpClearOldM5)
   {
      string clearPayload = StringFormat("{\"symbol\":\"%s\",\"timeframe\":\"M5\"}", _Symbol);
      string clearResp;
      PrintFormat("[TradeZen EA] 正在清空云端品种 %s 原有 M5 K线数据...", _Symbol);
      SendJsonRequest("/backtesting/candles/clear", clearPayload, clearResp);
   }

   // 3. 分批推送到服务器 (每批 300 根，安全适配各类网关并防止网络超时)
   string tfStr = TimeframeToString(InpCandleTf);
   int batchSize = 300;
   int totalBatches = (copied + batchSize - 1) / batchSize;
   int totalSynced = 0;

   for(int b = 0; b < totalBatches; b++)
   {
      int startIdx = b * batchSize;
      int count = MathMin(batchSize, copied - startIdx);

      string candlesJson = "";
      // rates 为降序排列 (rates[0] 为最新)。从旧到新构建 JSON:
      for(int i = startIdx + count - 1; i >= startIdx; i--)
      {
         if(StringLen(candlesJson) > 0) candlesJson += ",";
         candlesJson += StringFormat(
            "{\"time\":\"%s\",\"timestamp\":%d,\"open\":%.5f,\"high\":%.5f,\"low\":%.5f,\"close\":%.5f,\"volume\":%d}",
            TimeToString(rates[i].time, TIME_DATE | TIME_MINUTES),
            (long)rates[i].time,
            rates[i].open,
            rates[i].high,
            rates[i].low,
            rates[i].close,
            (long)rates[i].tick_volume
         );
      }

      string candleTz = "broker";
      long candleOffsetSec = 0;
      ResolveBrokerTimezonePayload(candleTz, candleOffsetSec);
      string payload = StringFormat(
         "{\"symbol\":\"%s\",\"timeframe\":\"%s\",\"timezone\":\"%s\",\"gmtOffsetSec\":%I64d,\"candles\":[%s]}",
         EscapeJsonString(_Symbol),
         tfStr,
         candleTz,
         candleOffsetSec,
         candlesJson
      );

      string resp;
      if(SendJsonRequest("/backtesting/candles/sync", payload, resp))
      {
         totalSynced += count;
      }
      else
      {
         PrintFormat("[TradeZen EA] 第 %d/%d 批K线推送失败，终止本次推送", b + 1, totalBatches);
         break;
      }
   }

   if(totalSynced > 0)
   {
      g_last_candle_sync_time = now;
      g_initial_candle_sync_done = true;
      g_last_bar_time = iTime(_Symbol, InpCandleTf, 0);
      PrintFormat("[TradeZen EA] 成功分批同步品种 %s (%s) 共 %d 根K线到远程服务器! 已自动切入实时增量流模式", _Symbol, tfStr, totalSynced);
   }
}

//+------------------------------------------------------------------+
//| 核心功能: 实时增量推送最新蜡烛 (仅推送当前未走完柱与刚收盘柱，极低延迟极小开销) |
//+------------------------------------------------------------------+
void SyncLiveCandles(int barsCount = 2)
{
   if(!InpSyncCandles || !InpLiveCandleSync) return;

   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   int copied = CopyRates(_Symbol, InpCandleTf, 0, barsCount, rates);
   if(copied <= 0) return;

   string tfStr = TimeframeToString(InpCandleTf);
   string candlesJson = "";

   // 从旧到新构建 JSON (rates[1] 先，rates[0] 后)
   for(int i = copied - 1; i >= 0; i--)
   {
      if(StringLen(candlesJson) > 0) candlesJson += ",";
      candlesJson += StringFormat(
         "{\"time\":\"%s\",\"timestamp\":%d,\"open\":%.5f,\"high\":%.5f,\"low\":%.5f,\"close\":%.5f,\"volume\":%d}",
         TimeToString(rates[i].time, TIME_DATE | TIME_MINUTES),
         (long)rates[i].time,
         rates[i].open,
         rates[i].high,
         rates[i].low,
         rates[i].close,
         (long)rates[i].tick_volume
      );
   }

   string candleTz = "broker";
   long candleOffsetSec = 0;
   ResolveBrokerTimezonePayload(candleTz, candleOffsetSec);
   string payload = StringFormat(
      "{\"symbol\":\"%s\",\"timeframe\":\"%s\",\"timezone\":\"%s\",\"gmtOffsetSec\":%I64d,\"candles\":[%s]}",
      EscapeJsonString(_Symbol),
      tfStr,
      candleTz,
      candleOffsetSec,
      candlesJson
   );

   string resp;
   if(SendJsonRequest("/backtesting/candles/sync", payload, resp))
   {
      g_last_live_candle_time = TimeCurrent();
   }
}

//+------------------------------------------------------------------+
//| EA 初始化                                                         |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("==================================================");
   Print("[TradeZen EA] 正在启动 (v1.30 统一仓位口径 + 实时增量流同步版)...");
   Print("[TradeZen EA] [安全提示] 当前使用的 API Token 为个人专属密钥，请勿转给他人使用以防账单数据被污染。");
   PrintFormat("[TradeZen EA] 远程目标: %s", InpServerUrl);
   PrintFormat("[TradeZen EA] 当前品种: %s | K线周期: %s (已锁定为 1M 基础原子周期，服务端自动向上聚合多周期)", _Symbol, TimeframeToString(InpCandleTf));
   if(InpCandleSyncMode == CANDLE_SYNC_CUSTOM_RANGE)
   {
      PrintFormat("[TradeZen EA] 初始K线同步: 自定义时间范围 (%s 至 %s)",
         TimeToString(InpCandleStartTime, TIME_DATE),
         (InpCandleStopTime == 0 ? "最新" : TimeToString(InpCandleStopTime, TIME_DATE)));
   }
   else if(InpCandleSyncMode == CANDLE_SYNC_ALL_HISTORY)
   {
      Print("[TradeZen EA] 初始K线同步: 全量历史同步");
   }
   else
   {
      PrintFormat("[TradeZen EA] 初始K线同步: 最近 %d 根", InpCandleBars);
   }

   if(InpLiveCandleSync)
   {
      PrintFormat("[TradeZen EA] 实时增量流同步已开启 (心跳: %d秒 | 新K线事件: %s)",
         InpLiveSyncInterval, (InpSyncOnNewBar ? "已启用" : "已关闭"));
   }
   Print("==================================================");

   // 定时器设为较短间隔，保证增量心跳与订单轮询的高敏响应
   int timerSec = MathMax(2, MathMin(InpLiveSyncInterval, InpSyncIntervalSec));
   EventSetTimer(timerSec);

   // 启动时立即执行一次初始化同步
   SyncOrders();
   SyncCandles();

   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| EA 退出清理                                                       |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("[TradeZen EA] 已卸载停止运行。");
}

//+------------------------------------------------------------------+
//| 实时行情 Tick 变动监听                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   // 1. 如果开启了新K线生成触发，并且初始历史已同步完成
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

   // 1. 定期检查历史平仓订单
   if(InpSyncOrders)
   {
      if(g_last_order_sync_time == 0 || (InpLiveOrderSync && (now - g_last_order_sync_time >= InpSyncIntervalSec)))
      {
         SyncOrders();
      }
   }

   // 2. K线同步逻辑
   if(InpSyncCandles)
   {
      if(!g_initial_candle_sync_done)
      {
         // 初始历史未完成，按初始重试间隔执行
         if(g_last_candle_sync_time == 0 || (now - g_last_candle_sync_time >= InpCandleSyncInterval))
         {
            SyncCandles();
         }
      }
      else if(InpLiveCandleSync)
      {
         // 初始已完成，按实时心跳间隔增量刷新当前正在跳动的K线
         if(g_last_live_candle_time == 0 || (now - g_last_live_candle_time >= InpLiveSyncInterval))
         {
            SyncLiveCandles(2);
         }
      }
   }
}

//+------------------------------------------------------------------+
//| 实时交易事件监听                                                  |
//+------------------------------------------------------------------+
void OnTradeTransaction(
   const MqlTradeTransaction& trans,
   const MqlTradeRequest& request,
   const MqlTradeResult& result
)
{
   if(trans.type == TRADE_TRANSACTION_DEAL_ADD)
   {
      if(InpSyncOrders && InpLiveOrderSync)
      {
         SyncOrders();
      }
   }
}
