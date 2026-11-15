import React, { useState, useEffect } from 'react';
import { Notebook, LineChart, BarChart2, Play, RefreshCw, FileText } from 'lucide-react';
import Button from './common/Button';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const features = [
  { icon: Notebook, label: '交易日志' },
  { icon: LineChart, label: '数据透视' },
  { icon: FileText, label: '策略战法', dark: true },
  { icon: BarChart2, label: '绩效报表' },
  { icon: RefreshCw, label: '策略回测' },
  { icon: Play, label: 'K线复盘' }
];

export default function Hero() {
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => {
      setHighlightedIndex((prevIndex) => (prevIndex + 1) % features.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleGetStarted = () => {
    const token = localStorage.getItem('token');
    if (token) {
      navigate('/');
    } else {
      navigate('/signup');
    }
  };

  return (
    <div className="pt-24 pb-16 bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-navy-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white leading-tight">
            打造稳定盈利体系所需的<br />
            <span className="bg-gradient-to-r from-purple-600 via-indigo-600 to-emerald-500 text-transparent bg-clip-text">知行合一交易管理中枢</span>
          </h1>
          
          <p className="mt-6 text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
            TradeZen 帮助交易员发现自身优势与心智盲区，通过知行合一的交易日志、复盘与情绪量化，踏上稳定盈利之路。
          </p>
          
          <Button variant="gradient" className="mt-8 text-base px-6 py-2.5 shadow-lg" onClick={handleGetStarted}>
            {localStorage.getItem('token') ? '进入交易仪表盘' : '立即免费体验'} &gt;
          </Button>
          
          <div className="mt-16 grid grid-cols-6 gap-8 justify-items-center">
            {features.map((Feature, index) => (
              <motion.div
                key={index}
                className="text-center"
                animate={{ scale: highlightedIndex === index ? 1.1 : 1 }}
                transition={{ duration: 0.5 }}
              >
                <div className={`${highlightedIndex === index ? 'bg-purple-600' : (Feature.dark ? 'bg-navy-900' : 'bg-white dark:bg-gray-800')} p-4 rounded-lg shadow-sm`}>
                  <Feature.icon className={`h-6 w-6 ${highlightedIndex === index ? 'text-white' : (Feature.dark ? 'text-white' : 'text-gray-700 dark:text-gray-300')}`} />
                </div>
                <p className="mt-2 text-sm dark:text-gray-300">{Feature.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
