import React, { useState, useEffect } from 'react';
import FeaturePageLayout from './FeaturePageLayout';
import axios from 'axios';
import { 
  BookOpen, Plus, Search, Filter, Heart, MessageCircle, 
  Share2, Download, Star, User, Lock, Globe, Edit, Trash2, Copy, Save
} from 'lucide-react';

interface Playbook {
  id: string;
  name: string;
  description: string;
  strategy: string;
  author: {
    name: string;
    avatar: string;
  };
  rating: number;
  reviews: number;
  downloads: number;
  isPublic: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface Review {
  id: string;
  playbookId: string;
  author: {
    name: string;
    avatar: string;
  };
  rating: number;
  comment: string;
  createdAt: string;
}

const PlaybookCard = ({ playbook, onView }: { playbook: Playbook; onView: (playbook: Playbook) => void }) => (
  <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
    <div className="p-5">
      <div className="flex justify-between">
        <h3 className="text-lg font-medium text-gray-900">{playbook.name}</h3>
        {playbook.isPublic ? (
          <Globe className="h-5 w-5 text-green-500" />
        ) : (
          <Lock className="h-5 w-5 text-gray-400" />
        )}
      </div>
      <p className="mt-2 text-sm text-gray-500 line-clamp-2">{playbook.description}</p>
      
      <div className="mt-4 flex items-center">
        <div className="flex-shrink-0">
          <div className="bg-gray-200 border-2 border-dashed rounded-xl w-10 h-10" />
        </div>
        <div className="ml-3">
          <p className="text-sm font-medium text-gray-900">{playbook.author.name}</p>
          <p className="text-xs text-gray-500">更新于 {playbook.updatedAt}</p>
        </div>
      </div>
      
      <div className="mt-4 flex flex-wrap gap-2">
        {playbook.tags.slice(0, 3).map((tag, index) => (
          <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            {tag}
          </span>
        ))}
        {playbook.tags.length > 3 && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            +{playbook.tags.length - 3}
          </span>
        )}
      </div>
      
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center">
          <div className="flex items-center">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`h-4 w-4 ${i < Math.floor(playbook.rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
              />
            ))}
          </div>
          <span className="ml-1 text-sm text-gray-500">
            {playbook.rating} ({playbook.reviews}条复盘)
          </span>
        </div>
        <div className="flex items-center text-sm text-gray-500">
          <Download className="h-4 w-4 mr-1" />
          {playbook.downloads}
        </div>
      </div>
    </div>
    <div className="bg-gray-50 px-5 py-3 flex justify-between">
      <button
        onClick={() => onView(playbook)}
        className="text-sm font-medium text-purple-600 hover:text-purple-800"
      >
        查看战法详情
      </button>
      <div className="flex space-x-2">
        <button className="text-gray-400 hover:text-red-500" title="收藏">
          <Heart className="h-4 w-4" />
        </button>
        <button className="text-gray-400 hover:text-blue-500" title="讨论">
          <MessageCircle className="h-4 w-4" />
        </button>
      </div>
    </div>
  </div>
);

const ReviewItem = ({ review }: { review: Review }) => (
  <div className="py-4">
    <div className="flex items-center">
      <div className="flex-shrink-0">
        <div className="bg-gray-200 border-2 border-dashed rounded-xl w-8 h-8" />
      </div>
      <div className="ml-3">
        <p className="text-sm font-medium text-gray-900">{review.author.name}</p>
        <div className="flex items-center">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={`h-4 w-4 ${i < review.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
            />
          ))}
          <span className="ml-2 text-xs text-gray-500">{review.createdAt}</span>
        </div>
      </div>
    </div>
    <p className="mt-2 text-sm text-gray-600">{review.comment}</p>
  </div>
);

export default function PlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'library' | 'my-playbooks' | 'editor'>('library');
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTag, setFilterTag] = useState('all');

  // Mock data - in a real app, this would come from an API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Mock playbooks data
        const mockPlaybooks: Playbook[] = [
          {
            id: '1',
            name: '波段动量突破战法 (Swing Momentum)',
            description: '专注于强势品种突破后回踩确认的波段交易战法，以动量因子与均线多头排列为入场核心。',
            strategy: '识别成交量放大的突破标的，等待回抽重要支撑位分批建仓，以反转K线形态或跌破关键防守位分批离场。',
            author: {
              name: 'Alex Johnson',
              avatar: ''
            },
            rating: 4.7,
            reviews: 24,
            downloads: 128,
            isPublic: true,
            tags: ['波段交易', '动量突破', '技术分析'],
            createdAt: '2023-01-15',
            updatedAt: '2023-03-22'
          },
          {
            id: '2',
            name: '期权备兑现金流收割战法 (Covered Calls)',
            description: '通过卖出虚值备兑看涨期权和现金担保卖权，获取稳健的月度现金流与时间价值衰减收益。',
            strategy: '选择距到期日 30-45 天、Delta 在 0.2-0.3 之间的期权合约卖出，目标追求月度 1-2% 确定性收益。',
            author: {
              name: 'Sarah Miller',
              avatar: ''
            },
            rating: 4.5,
            reviews: 18,
            downloads: 96,
            isPublic: true,
            tags: ['期权策略', '现金流', '备兑看涨'],
            createdAt: '2023-02-10',
            updatedAt: '2023-04-05'
          },
          {
            id: '3',
            name: '早盘高胜率开盘区间突破战法 (ORB)',
            description: '利用开盘前 15~30 分钟的市场多空博弈区间高低点，捕捉早盘机构大单爆发方向。',
            strategy: '在开盘首小时内锁定高成交量品种，一旦放量突破 ORB 上沿即刻顺势做多，设置 1R 移动止损保本。',
            author: {
              name: 'Mike Chen',
              avatar: ''
            },
            rating: 4.2,
            reviews: 31,
            downloads: 210,
            isPublic: true,
            tags: ['日内日内', 'ORB突破', '量价分析'],
            createdAt: '2023-01-28',
            updatedAt: '2023-03-15'
          },
          {
            id: '4',
            name: '长线价值安全边际框架 (Value Investing)',
            description: '聚焦基本面扎实、自由现金流充沛且交易价格低于内在价值的优质龙头公司。',
            strategy: '多维度筛选资产负债表健康、ROIC 高且市盈率处于历史低位的标的，分批买入并长期持有。',
            author: {
              name: 'David Wilson',
              avatar: ''
            },
            rating: 4.8,
            reviews: 42,
            downloads: 187,
            isPublic: true,
            tags: ['价值投资', '基本面分析', '长线复利'],
            createdAt: '2022-11-15',
            updatedAt: '2023-02-20'
          }
        ];

        // Mock reviews data
        const mockReviews: Review[] = [
          {
            id: '1',
            playbookId: '1',
            author: {
              name: 'TraderPro',
              avatar: ''
            },
            rating: 5,
            comment: '这套波段战法彻底改变了我的交易体系！突破回踩的入场条件非常清晰客观，严格执行后回撤大幅降低。',
            createdAt: '2023-04-01'
          },
          {
            id: '2',
            playbookId: '1',
            author: {
              name: 'MarketMaster',
              avatar: ''
            },
            rating: 4,
            comment: '逻辑清晰且实战案例丰富，如果能增加更详细的动态移动止损指南就更完美了！',
            createdAt: '2023-03-15'
          }
        ];

        setPlaybooks(mockPlaybooks);
        setReviews(mockReviews);
      } catch (err) {
        setError('加载战法库失败，请稍后重试。');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const viewPlaybook = (playbook: Playbook) => {
    setSelectedPlaybook(playbook);
    setActiveTab('library');
  };

  const filteredPlaybooks = playbooks.filter(playbook => {
    const matchesSearch = playbook.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          playbook.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTag = filterTag === 'all' || playbook.tags.includes(filterTag);
    
    return matchesSearch && matchesTag;
  });

  const uniqueTags = Array.from(new Set(playbooks.flatMap(p => p.tags)));

  const createNewPlaybook = () => {
    setActiveTab('editor');
    setSelectedPlaybook(null);
  };

  return (
    <FeaturePageLayout
      title="策略战法兵器库 (Playbooks)"
      description="汇聚专业操盘手验证的高胜率策略体系，提供结构化战法编辑器，知行合一规范入场条件与风控防守底线。"
      image="/assets/4.png"
    >
      <div className="bg-white p-6 rounded-lg shadow-md">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => {
                setActiveTab('library');
                setSelectedPlaybook(null);
              }}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'library'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              战法兵器库 (Library)
            </button>
            <button
              onClick={() => {
                setActiveTab('my-playbooks');
                setSelectedPlaybook(null);
              }}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'my-playbooks'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              我的战法 (My Playbooks)
            </button>
            <button
              onClick={createNewPlaybook}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'editor'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              战法编辑器 (Editor)
            </button>
          </nav>
        </div>

        {loading ? (
          <div className="text-center py-10">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
            <p className="mt-2 text-gray-500">正在加载战法库...</p>
          </div>
        ) : error ? (
          <div className="text-center py-10">
            <div className="text-red-500">{error}</div>
          </div>
        ) : activeTab === 'library' || activeTab === 'my-playbooks' ? (
          selectedPlaybook ? (
            <div>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="flex items-center">
                    <h3 className="text-2xl font-bold text-gray-900">{selectedPlaybook.name}</h3>
                    {selectedPlaybook.isPublic ? (
                      <Globe className="h-5 w-5 text-green-500 ml-2" />
                    ) : (
                      <Lock className="h-5 w-5 text-gray-400 ml-2" />
                    )}
                  </div>
                  <p className="mt-2 text-gray-600">{selectedPlaybook.description}</p>
                </div>
                <div className="flex space-x-2">
                  <button className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                    <Download className="h-4 w-4 mr-1" />
                    导出战法
                  </button>
                  <button className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                    <Copy className="h-4 w-4 mr-1" />
                    克隆此战法
                  </button>
                  <button 
                    onClick={() => setSelectedPlaybook(null)}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    返回列表
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <div className="bg-gray-50 rounded-lg p-5 mb-6">
                    <h4 className="text-lg font-medium text-gray-900 mb-3">战法核心策略逻辑</h4>
                    <p className="text-gray-700 leading-relaxed">{selectedPlaybook.strategy}</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-5">
                    <h4 className="text-lg font-medium text-gray-900 mb-4">交易员实战交流与评价</h4>
                    <div className="space-y-4">
                      {reviews.filter(r => r.playbookId === selectedPlaybook.id).length > 0 ? (
                        reviews
                          .filter(r => r.playbookId === selectedPlaybook.id)
                          .map(review => (
                            <ReviewItem key={review.id} review={review} />
                          ))
                      ) : (
                        <p className="text-gray-500 text-center py-4">暂无战友评价，快来抢先分享您的实战心得吧！</p>
                      )}
                    </div>
                    
                    <div className="mt-6">
                      <h5 className="text-md font-medium text-gray-900 mb-3">发表您的执行心得</h5>
                      <div className="flex items-center mb-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button key={star} className="text-gray-300 hover:text-yellow-400 focus:outline-none">
                            <Star className="h-6 w-6" />
                          </button>
                        ))}
                      </div>
                      <textarea
                        placeholder="分享您在实盘中执行该战法的经验、胜率或注意事项..."
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                        rows={3}
                      ></textarea>
                      <div className="mt-2 flex justify-end">
                        <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500">
                          发布复盘心得
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 mb-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="bg-gray-200 border-2 border-dashed rounded-xl w-12 h-12" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">{selectedPlaybook.author.name}</p>
                        <p className="text-xs text-gray-500">发布于 {selectedPlaybook.createdAt}</p>
                      </div>
                    </div>
                    
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-center">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${i < Math.floor(selectedPlaybook.rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
                            />
                          ))}
                        </div>
                        <p className="mt-1 text-sm font-medium text-gray-900">{selectedPlaybook.rating}</p>
                        <p className="text-xs text-gray-500">{selectedPlaybook.reviews} 条复盘评价</p>
                      </div>
                      
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <Download className="h-5 w-5 text-gray-400 mx-auto" />
                        <p className="mt-1 text-sm font-medium text-gray-900">{selectedPlaybook.downloads}</p>
                        <p className="text-xs text-gray-500">次下载引用</p>
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-900">战法标签</h4>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedPlaybook.tags.map((tag, index) => (
                          <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
                    <h4 className="text-lg font-medium text-gray-900 mb-3">相似推荐战法</h4>
                    <div className="space-y-3">
                      {playbooks
                        .filter(p => p.id !== selectedPlaybook.id)
                        .slice(0, 3)
                        .map(playbook => (
                          <div 
                            key={playbook.id} 
                            className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded"
                            onClick={() => setSelectedPlaybook(playbook)}
                          >
                            <BookOpen className="h-5 w-5 text-gray-400 mr-2" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{playbook.name}</p>
                              <p className="text-xs text-gray-500">{playbook.author.name}</p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
                <div className="flex-1">
                  <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="focus:ring-purple-500 focus:border-purple-500 block w-full pl-10 pr-12 py-2 sm:text-sm border-gray-300 rounded-md"
                      placeholder="搜索交易战法名称、规则或描述..."
                    />
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <div className="relative">
                    <select
                      value={filterTag}
                      onChange={(e) => setFilterTag(e.target.value)}
                      className="focus:ring-purple-500 focus:border-purple-500 block w-full pl-3 pr-10 py-2 text-base border-gray-300 rounded-md sm:text-sm"
                    >
                      <option value="all">全部标签</option>
                      {uniqueTags.map(tag => (
                        <option key={tag} value={tag}>{tag}</option>
                      ))}
                    </select>
                  </div>
                  
                  {activeTab === 'my-playbooks' && (
                    <button
                      onClick={createNewPlaybook}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      新建战法
                    </button>
                  )}
                </div>
              </div>
              
              {filteredPlaybooks.length === 0 ? (
                <div className="text-center py-10">
                  <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">未找到匹配的战法</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {activeTab === 'my-playbooks' 
                      ? "从创建您的第一套交易战法体系开始吧！" 
                      : "尝试更改搜索关键字或标签筛选条件。"}
                  </p>
                  {activeTab === 'my-playbooks' && (
                    <div className="mt-6">
                      <button
                        onClick={createNewPlaybook}
                        className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        创建新战法
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredPlaybooks.map((playbook) => (
                    <PlaybookCard 
                      key={playbook.id} 
                      playbook={playbook} 
                      onView={viewPlaybook} 
                    />
                  ))}
                </div>
              )}
            </div>
          )
        ) : (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium text-gray-900">
                {selectedPlaybook ? '编辑交易战法' : '创建新交易战法'}
              </h3>
              <div className="flex space-x-2">
                <button className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                  <Save className="h-4 w-4 mr-2" />
                  保存草稿
                </button>
                <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700">
                  发布战法
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      战法名称
                    </label>
                    <input
                      type="text"
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                      placeholder="例如：亚洲盘假突破 + 伦敦盘动量顺势跟随战法"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      战法简述
                    </label>
                    <textarea
                      rows={3}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                      placeholder="简要概括该战法适用的市场环境、核心逻辑与交易时段..."
                    ></textarea>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      策略执行细则 (包含入场信号、止损防守、移动止盈与仓位管理)
                    </label>
                    <textarea
                      rows={10}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                      placeholder="详细罗列您的开平仓条件：&#10;1. 标的选择与周期框架&#10;2. 入场触发条件 (如突破K线收盘确认)&#10;3. 初始硬止损点位设置&#10;4. 达到 1.5R 移动保护止损与分批止盈计划"
                    ></textarea>
                  </div>
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
                  <h4 className="text-md font-medium text-gray-900 mb-3">战法属性设置</h4>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        可见范围
                      </label>
                      <div className="flex space-x-4">
                        <label className="inline-flex items-center">
                          <input
                            type="radio"
                            className="h-4 w-4 text-purple-600 border-gray-300 focus:ring-purple-500"
                            name="visibility"
                            defaultChecked
                          />
                          <span className="ml-2 text-sm text-gray-700">仅自己可见 (Private)</span>
                        </label>
                        <label className="inline-flex items-center">
                          <input
                            type="radio"
                            className="h-4 w-4 text-purple-600 border-gray-300 focus:ring-purple-500"
                            name="visibility"
                          />
                          <span className="ml-2 text-sm text-gray-700">公开共享 (Public)</span>
                        </label>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        分类标签
                      </label>
                      <input
                        type="text"
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                        placeholder="例如：突破, 动量, 外汇, 黄金"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        多个标签使用英文逗号隔开
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
                  <h4 className="text-md font-medium text-gray-900 mb-3">实时卡片效果预览</h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="bg-gray-200 border-2 border-dashed rounded-xl w-10 h-10" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">当前交易员</p>
                        <p className="text-xs text-gray-500">刚刚</p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <h5 className="font-medium text-gray-900">未命名交易战法</h5>
                      <p className="text-sm text-gray-500 mt-1">
                        战法简述将展示在此处...
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                          草稿
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </FeaturePageLayout>
  );
}