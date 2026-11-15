import React, { useState, useEffect } from 'react';
import { ShieldCheckIcon, StarIcon, FireIcon, RssIcon, ChatBubbleLeftRightIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import SectionHeading from '../components/common/SectionHeading';
import { getCommunityCategories } from '../services/api';
import './Forum.css';

// Helper to map category names to icons
const iconMap: { [key: string]: React.ReactElement } = {
  'Trade Journals': <StarIcon className="h-8 w-8 text-yellow-500" />,
  'Market Discussions': <ChatBubbleLeftRightIcon className="h-8 w-8 text-sky-500" />,
  'Strategies & Playbooks': <FireIcon className="h-8 w-8 text-red-500" />,
  'Trader Psychology': <UserGroupIcon className="h-8 w-8 text-green-500" />,
  'Tools & Resources': <RssIcon className="h-8 w-8 text-orange-500" />,
  'Platform Feedback': <ShieldCheckIcon className="h-8 w-8 text-indigo-500" />,
  'Default': <ShieldCheckIcon className="h-8 w-8 text-gray-500" />,
};

const CATEGORY_NAMES_ZH: Record<string, { name: string; desc: string }> = {
  'Trade Journals': { name: '实盘复盘日志 (Journals)', desc: '分享真实交易记录、知行合一心理状态与每日盈亏心得' },
  'Market Discussions': { name: '行情研判与多空推演', desc: '宏观基本面、外汇/黄金/股指/加密货币盘面实时探讨' },
  'Strategies & Playbooks': { name: '交易战法与回测策略', desc: '交流经过实盘验证的高盈亏比系统与买卖规则' },
  'Trader Psychology': { name: '交易心态与知行修养', desc: '克服 FOMO、抗单、报复性交易与情绪波动的经验交流' },
  'Tools & Resources': { name: '指标与量化武器库', desc: 'MT5 脚本、EA、量化工具、投研数据源推荐与讨论' },
  'Platform Feedback': { name: 'TradeZen 需求与建议', desc: '向官方工程团队提交功能建议、Bug 反馈与路线图探讨' },
};

const getCategoryIcon = (categoryName: string) => {
  return iconMap[categoryName] || iconMap['Default'];
};

const LeaderboardItem = ({ user, stat, rank }: { user: string; stat: string; rank: number }) => (
  <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-navy-800/50 rounded-xl">
    <div className="flex-1 flex items-center min-w-0">
      <span className="text-xs font-bold text-gray-500 dark:text-gray-400 w-5 flex-shrink-0 font-mono">{rank}.</span>
      <img className="h-7 w-7 rounded-full mr-2.5 flex-shrink-0" src={`https://i.pravatar.cc/40?u=${user}`} alt={user} />
      <span className="font-semibold text-xs text-slate-800 dark:text-white truncate">{user}</span>
    </div>
    <span className="text-xs font-bold font-mono text-purple-600 dark:text-purple-400 ml-2 flex-shrink-0">{stat}</span>
  </div>
);

export default function CommunityPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await getCommunityCategories();
        setCategories(data);
      } catch (err) {
        setError('加载社区板块失败，请稍后重试。');
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  return (
    <div className="bg-gray-50 forum-bg min-h-screen py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="TradeZen 交易员共修联盟"
          description="与数万名崇尚「知行合一」的专业交易者共同交流、分享复盘心得、打磨策略战法，相互守望、稳步精进。"
          centered
        />

        <div className="mt-16 grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Content: Categories */}
          <div className="lg:col-span-2">
            {loading && <p className="text-center text-xs text-gray-400 py-12">正在加载板块列表...</p>}
            {error && <p className="text-red-500 text-center text-xs py-12">{error}</p>}
            {!loading && !error && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {categories.map((category: any) => {
                  const zh = CATEGORY_NAMES_ZH[category.name] || { name: category.name, desc: category.description };
                  return (
                    <a href={`/community/${category.slug}`} key={category.id} className="bg-white dark:bg-navy-900 category-card-3d group p-7 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col items-center text-center border border-gray-100 dark:border-white/5">
                      <div className="flex items-center justify-center h-14 w-14 bg-gray-100 dark:bg-navy-800 rounded-2xl mb-4 group-hover:scale-110 transition-transform duration-300 shadow-2xs">
                        {getCategoryIcon(category.name)}
                      </div>
                      <h3 className="text-base font-bold text-slate-800 dark:text-white mb-2">{zh.name}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 flex-grow leading-relaxed">{zh.desc}</p>
                      <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 group-hover:underline flex items-center space-x-1">
                        <span>进入交流探讨 &rarr;</span>
                      </span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sidebar: Leaderboards & Stats */}
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">周度交易员荣誉榜</h3>
              <div className="space-y-2">
                <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">最有价值分享者 (Top Contributors)</h4>
                <LeaderboardItem user="量化老K" stat="1,204 点赞" rank={1} />
                <LeaderboardItem user="波段之王" stat="987 点赞" rank={2} />
                <LeaderboardItem user="知行合一阿杰" stat="850 点赞" rank={3} />
              </div>
              <div className="mt-5 space-y-2">
                <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">最佳纪律复盘 (Top Journals)</h4>
                <LeaderboardItem user="风控守门员" stat="95% 纪律评分" rank={1} />
                <LeaderboardItem user="趋势猎手" stat="连续12天盈利" rank={2} />
                <LeaderboardItem user="期权收割者" stat="4.5 盈亏比" rank={3} />
              </div>
            </div>

            <div className="p-5 bg-white dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-white/5 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">社区活跃统计</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-gray-600 dark:text-gray-300"><span>主题帖总数:</span><span className="font-bold font-mono text-gray-900 dark:text-white">4,821 篇</span></div>
                <div className="flex justify-between text-gray-600 dark:text-gray-300"><span>累计复盘研讨:</span><span className="font-bold font-mono text-gray-900 dark:text-white">62,194 条</span></div>
                <div className="flex justify-between text-gray-600 dark:text-gray-300"><span>共修交易员:</span><span className="font-bold font-mono text-gray-900 dark:text-white">12,345 位</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
