import React from 'react';
import { BookOpen } from 'lucide-react';

export default function FooterBrand() {
  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <BookOpen className="h-8 w-8 text-emerald-500" />
        <span className="ml-2 text-xl font-bold text-white">TradeZen</span>
      </div>
      <p className="text-gray-400">
        知行合一 · 交易管理与复盘大师。赋能交易者沉淀真实优势，严守纪律与风控。
      </p>
    </div>
  );
}
