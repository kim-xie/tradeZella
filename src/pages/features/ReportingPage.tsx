import React, { useState, useEffect } from 'react';
import FeaturePageLayout from './FeaturePageLayout';
import SEO from '../../components/common/SEO';
import axios from 'axios';
import { 
  BarChart, PieChart, TrendingUp, Calendar, Download, Share2, 
  Plus, Save, Edit, Trash2, Copy, Eye, Clock
} from 'lucide-react';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  components: string[];
  isPublic: boolean;
  createdAt: string;
}

interface ScheduledReport {
  id: string;
  name: string;
  frequency: string;
  nextRun: string;
  recipients: string[];
}

const COMPONENT_LABELS: Record<string, { label: string; desc: string }> = {
  'performance-summary': { label: '核心绩效概览', desc: '包含总盈亏、胜率、盈亏比与期望值统计' },
  'win-loss-chart': { label: '盈亏比与胜负分布', desc: '可视化展示盈利与亏损订单占比及平均R值' },
  'equity-curve': { label: '资金增长与回撤曲线', desc: '账户累计资金随时间推移的复利增长趋势' },
  'monthly-performance': { label: '月度收益与日历矩阵', desc: '按月份拆解各交易周期的收益与活跃天数' },
  'trade-list': { label: '交易明细流水清单', desc: '包含入出场点位、持仓时长与佣金的详细表格' },
  'strategy-performance': { label: '战法策略归因透视', desc: '各 Playbook 战法在实盘中的胜率与盈亏贡献' },
  'risk-metrics': { label: '风控违规与极值指标', desc: '最大回撤日、单笔失误与心理纪律评分统计' },
  'correlation-analysis': { label: '标的多空相关性分析', desc: '不同交易品种间的多空敞口与收益贡献度' },
};

const ReportComponent = ({ component, onRemove }: { component: string; onRemove: () => void }) => {
  const meta = COMPONENT_LABELS[component] || { label: component, desc: '' };
  return (
    <div className="bg-white dark:bg-navy-900 border border-gray-200 dark:border-white/10 rounded-xl p-3.5 flex justify-between items-center shadow-2xs">
      <div className="flex items-center space-x-3">
        <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
          {component === 'performance-summary' && <BarChart className="h-4 w-4" />}
          {component === 'win-loss-chart' && <PieChart className="h-4 w-4" />}
          {component === 'equity-curve' && <TrendingUp className="h-4 w-4" />}
          {component === 'monthly-performance' && <Calendar className="h-4 w-4" />}
          {!['performance-summary', 'win-loss-chart', 'equity-curve', 'monthly-performance'].includes(component) && <BarChart className="h-4 w-4" />}
        </div>
        <div>
          <span className="text-xs font-bold text-gray-900 dark:text-white">{meta.label}</span>
          <p className="text-[11px] text-gray-400 mt-0.5">{meta.desc}</p>
        </div>
      </div>
      <button 
        onClick={onRemove}
        className="p-1 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-navy-800 transition"
        title="移除此模块"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
};

export default function ReportingPage() {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'builder' | 'templates' | 'scheduled'>('builder');
  const [reportName, setReportName] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [availableComponents] = useState([
    'performance-summary',
    'win-loss-chart',
    'equity-curve',
    'monthly-performance',
    'trade-list',
    'strategy-performance',
    'risk-metrics',
    'correlation-analysis'
  ]);
  const [selectedComponents, setSelectedComponents] = useState<string[]>(['performance-summary', 'win-loss-chart', 'equity-curve']);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
          setError('请登录后访问报表系统。');
          return;
        }

        const mockTemplates: ReportTemplate[] = [
          {
            id: '1',
            name: '月度量化综合绩效报告',
            description: '包含月度关键指标、胜率分布与资金复利曲线的完整投研报表',
            components: ['performance-summary', 'win-loss-chart', 'monthly-performance', 'equity-curve'],
            isPublic: true,
            createdAt: '2023-01-15'
          },
          {
            id: '2',
            name: '战法纪律与风控审计报告',
            description: '专注于交易战法执行度、最大回撤与情绪心理追踪的专项复盘',
            components: ['strategy-performance', 'risk-metrics', 'equity-curve'],
            isPublic: false,
            createdAt: '2023-02-20'
          }
        ];

        const mockScheduled: ScheduledReport[] = [
          {
            id: '1',
            name: '周度知行合一复盘周报',
            frequency: '每周一早间',
            nextRun: '2023-04-10',
            recipients: ['trader@tradezen.app']
          },
          {
            id: '2',
            name: '月度机构级量化对账单',
            frequency: '每月首日',
            nextRun: '2023-05-01',
            recipients: ['trader@tradezen.app', 'investor@tradezen.app']
          }
        ];

        setTemplates(mockTemplates);
        setScheduledReports(mockScheduled);
      } catch (err) {
        setError('加载报表数据失败，请重试。');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const addComponent = (component: string) => {
    if (!selectedComponents.includes(component)) {
      setSelectedComponents([...selectedComponents, component]);
    }
  };

  const removeComponent = (component: string) => {
    setSelectedComponents(selectedComponents.filter(c => c !== component));
  };

  const saveTemplate = async () => {
    if (!reportName.trim()) {
      alert('请输入报表模板名称');
      return;
    }

    try {
      const newTemplate: ReportTemplate = {
        id: `${Date.now()}`,
        name: reportName,
        description: reportDescription,
        components: selectedComponents,
        isPublic: false,
        createdAt: new Date().toISOString().split('T')[0]
      };

      setTemplates([newTemplate, ...templates]);
      setReportName('');
      setReportDescription('');
      setSelectedComponents(['performance-summary', 'win-loss-chart', 'equity-curve']);
      alert('报表模板保存成功！');
    } catch (err) {
      setError('保存报表模板失败。');
      console.error(err);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!window.confirm('确定要删除此报表模板吗？')) return;
    
    try {
      setTemplates(templates.filter(template => template.id !== id));
      alert('报表模板已删除。');
    } catch (err) {
      setError('删除报表模板失败。');
      console.error(err);
    }
  };

  const duplicateTemplate = (template: ReportTemplate) => {
    const duplicated: ReportTemplate = {
      ...template,
      id: `${Date.now()}`,
      name: `${template.name} (副本)`,
      createdAt: new Date().toISOString().split('T')[0]
    };
    setTemplates([duplicated, ...templates]);
  };

  const scheduleReport = () => {
    alert('定期自动推送配置已打开，支持绑定邮件与 Webhook 推送。');
  };

  const exportReport = () => {
    alert('正在生成高分辨率 PDF 报表与 CSV 数据文件...');
  };

  const shareReport = () => {
    alert('分享链接已复制到剪贴板，任何人可通过只读链接查看此份复盘报表。');
  };

  return (
    <>
      <SEO 
        title="投研报表系统"
        description="可视化拖拽式报表生成器、定期自动推送，以及支持机构级排版与分享的交易复盘报告。"
        keywords="TradeZen, 交易报表, 投研报告, 报表生成器, 自动化推送, PDF导出"
        url="https://tradezen.app/features/reporting"
      />
      <FeaturePageLayout
        title="专业投研报表 (Reporting)"
        description="模块化拖拽拼装报告组件，支持导出机构级高精 PDF 与自动化定期推送，向投资人与团队清晰呈现知行合一成果。"
        image="/assets/3.png"
      >
        <div className="bg-white dark:bg-[#0b0f19] p-6 rounded-2xl shadow-sm border border-gray-200/80 dark:border-white/10">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200 dark:border-white/10 mb-6">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('builder')}
                className={`whitespace-nowrap py-3.5 px-1 border-b-2 font-semibold text-xs transition-colors ${
                  activeTab === 'builder'
                    ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                报表生成器 (Builder)
              </button>
              <button
                onClick={() => setActiveTab('templates')}
                className={`whitespace-nowrap py-3.5 px-1 border-b-2 font-semibold text-xs transition-colors ${
                  activeTab === 'templates'
                    ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                已保存模板 (Templates)
              </button>
              <button
                onClick={() => setActiveTab('scheduled')}
                className={`whitespace-nowrap py-3.5 px-1 border-b-2 font-semibold text-xs transition-colors ${
                  activeTab === 'scheduled'
                    ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                定期自动推送 (Scheduled)
              </button>
            </nav>
          </div>

          {loading ? (
            <div className="text-center py-10">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
              <p className="mt-2 text-xs text-gray-500">正在生成报表预览...</p>
            </div>
          ) : error ? (
            <div className="text-center py-10">
              <div className="text-rose-500 text-xs">{error}</div>
            </div>
          ) : activeTab === 'builder' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Available Components */}
              <div className="lg:col-span-1">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">可选报表组件 (点击添加)</h3>
                <div className="space-y-2">
                  {availableComponents.map((component) => {
                    const meta = COMPONENT_LABELS[component] || { label: component, desc: '' };
                    const isAdded = selectedComponents.includes(component);
                    return (
                      <div 
                        key={component}
                        onClick={() => addComponent(component)}
                        className={`border rounded-xl p-3 cursor-pointer transition ${
                          isAdded 
                            ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-300 dark:border-purple-800' 
                            : 'bg-gray-50/80 dark:bg-navy-900/50 border-gray-200 dark:border-white/5 hover:border-purple-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{meta.label}</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${isAdded ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' : 'bg-gray-200 text-gray-600'}`}>
                            {isAdded ? '已添加' : '+ 添加'}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1">
                          {meta.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Report Builder */}
              <div className="lg:col-span-2">
                <div className="bg-gray-50 dark:bg-navy-900/50 rounded-xl p-4 mb-5 border border-gray-200 dark:border-white/5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={reportName}
                        onChange={(e) => setReportName(e.target.value)}
                        placeholder="输入报表标题 (如：2026年Q1 个人量化实盘复盘简报)"
                        className="block w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-700 rounded-lg shadow-xs focus:ring-purple-500 focus:border-purple-500 dark:bg-navy-950 dark:text-white"
                      />
                      <textarea
                        value={reportDescription}
                        onChange={(e) => setReportDescription(e.target.value)}
                        placeholder="报表副标题或简要说明 (可选)..."
                        className="mt-2 block w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-700 rounded-lg shadow-xs focus:ring-purple-500 focus:border-purple-500 dark:bg-navy-950 dark:text-white"
                        rows={2}
                      />
                    </div>
                    <div className="flex sm:flex-col gap-2">
                      <button
                        onClick={saveTemplate}
                        className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-xs font-bold rounded-lg shadow-xs text-white bg-purple-600 hover:bg-purple-700 transition"
                      >
                        <Save className="h-3.5 w-3.5 mr-1.5" />
                        保存模板
                      </button>
                      <button
                        onClick={exportReport}
                        className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-700 text-xs font-semibold rounded-lg text-gray-700 dark:text-gray-200 bg-white dark:bg-navy-800 hover:bg-gray-50 transition"
                      >
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        导出 PDF
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-gray-900 dark:text-white">已编排报表组件 ({selectedComponents.length} 个模块)</h3>
                  <span className="text-[11px] text-gray-400">生成时将按从上至下顺序排版输出</span>
                </div>
                <div className="space-y-3">
                  {selectedComponents.length === 0 ? (
                    <div className="text-center py-10 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl">
                      <p className="text-xs text-gray-400">请点击左侧组件添加到当前报表中</p>
                    </div>
                  ) : (
                    selectedComponents.map((component) => (
                      <ReportComponent 
                        key={component} 
                        component={component} 
                        onRemove={() => removeComponent(component)} 
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'templates' ? (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">已保存的报表模板</h3>
                <button
                  onClick={() => setActiveTab('builder')}
                  className="inline-flex items-center px-3.5 py-1.5 border border-transparent text-xs font-bold rounded-lg shadow-xs text-white bg-purple-600 hover:bg-purple-700 transition"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  新建模板
                </button>
              </div>

              {templates.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-xs text-gray-400">暂无已保存的报表模板</p>
                  <button
                    onClick={() => setActiveTab('builder')}
                    className="mt-3 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-lg text-purple-700 bg-purple-100 hover:bg-purple-200"
                  >
                    创建首个模板
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {templates.map((template) => (
                    <div key={template.id} className="bg-white dark:bg-navy-900 border border-gray-200 dark:border-white/10 rounded-xl shadow-xs overflow-hidden flex flex-col justify-between">
                      <div className="p-5">
                        <div className="flex justify-between items-center">
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white">{template.name}</h3>
                          {template.isPublic && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300">
                              公开
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">{template.description}</p>
                        <div className="mt-4">
                          <p className="text-[11px] text-gray-400">包含模块:</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {template.components.slice(0, 3).map((component) => (
                              <span key={component} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-navy-800 text-gray-700 dark:text-gray-300">
                                {COMPONENT_LABELS[component]?.label || component}
                              </span>
                            ))}
                            {template.components.length > 3 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-navy-800 text-gray-700 dark:text-gray-300">
                                +{template.components.length - 3} 个模块
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="bg-gray-50/70 dark:bg-navy-950/50 px-5 py-3 flex justify-between items-center border-t border-gray-100 dark:border-white/5">
                        <div className="text-[10px] text-gray-400 font-mono">
                          创建于 {template.createdAt}
                        </div>
                        <div className="flex space-x-1.5">
                          <button
                            onClick={() => duplicateTemplate(template)}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
                            title="复制副本"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => deleteTemplate(template.id)}
                            className="p-1 text-gray-400 hover:text-rose-500 transition"
                            title="删除"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={shareReport}
                            className="p-1 text-gray-400 hover:text-purple-500 transition"
                            title="生成分享链接"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={scheduleReport}
                            className="p-1 text-gray-400 hover:text-blue-500 transition"
                            title="设置定时推送"
                          >
                            <Clock className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">定时自动推送任务</h3>
                <button
                  onClick={scheduleReport}
                  className="inline-flex items-center px-3.5 py-1.5 border border-transparent text-xs font-bold rounded-lg shadow-xs text-white bg-purple-600 hover:bg-purple-700 transition"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  新建推送任务
                </button>
              </div>

              {scheduledReports.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-xs text-gray-400">暂无已配置的定时推送任务</p>
                  <button
                    onClick={scheduleReport}
                    className="mt-3 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-lg text-purple-700 bg-purple-100 hover:bg-purple-200"
                  >
                    配置第一个推送任务
                  </button>
                </div>
              ) : (
                <div className="bg-white dark:bg-navy-900 shadow-xs overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
                  <ul className="divide-y divide-gray-100 dark:divide-white/5">
                    {scheduledReports.map((report) => (
                      <li key={report.id} className="hover:bg-gray-50/50 dark:hover:bg-navy-800/30 transition">
                        <div className="px-5 py-4 sm:px-6">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-purple-600 dark:text-purple-400 truncate">{report.name}</p>
                            <div className="ml-2 flex-shrink-0 flex">
                              <p className="px-2.5 py-0.5 inline-flex text-[10px] font-bold rounded-full bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300">
                                {report.frequency}
                              </p>
                            </div>
                          </div>
                          <div className="mt-2 sm:flex sm:justify-between text-xs text-gray-500 dark:text-gray-400">
                            <div className="sm:flex">
                              <p className="flex items-center text-xs">
                                <Eye className="flex-shrink-0 mr-1.5 h-3.5 w-3.5 text-gray-400" />
                                接收邮箱: {report.recipients.join(', ')}
                              </p>
                            </div>
                            <div className="mt-2 flex items-center text-xs sm:mt-0 font-mono">
                              <Calendar className="flex-shrink-0 mr-1.5 h-3.5 w-3.5 text-gray-400" />
                              <p>
                                下次触发: {report.nextRun}
                              </p>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </FeaturePageLayout>
    </>
  );
}