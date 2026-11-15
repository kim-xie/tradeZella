import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Navbar from './components/Navbar';
import Loader from './components/Loader';
import Hero from './components/Hero';
import Stats from './components/Stats';
import Features from './components/sections/Features';
import Analysis from './components/sections/Analysis';
import Reports from './components/sections/Reports';
import Playbooks from './components/sections/Playbooks';
import Backtesting from './components/Backtesting';
import Newsletter from './components/Newsletter';
import AboutPage from './pages/AboutPage';
import CareersPage from './pages/CareersPage';
import PressPage from './pages/PressPage';
import BlogPage from './pages/BlogPage';
import ContactPage from './pages/ContactPage';
import FAQPage from './pages/FAQPage';
import HelpPage from './pages/HelpPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import CookiesPage from './pages/CookiesPage';
import AccessibilityPage from './pages/AccessibilityPage';
import CommunityPage from './pages/CommunityPage';
import PartnersPage from './pages/PartnersPage';
import PricingPage from './pages/PricingPage';
import BrokerSupportPage from './pages/BrokerSupportPage';
import AutomatedJournalingPage from './pages/features/AutomatedJournalingPage';
import TradeAnalysisPage from './pages/features/TradeAnalysisPage';
import ReportingPage from './pages/features/ReportingPage';
import PlaybooksPage from './pages/features/PlaybooksPage';
import BacktestingPage from './pages/features/BacktestingPage';
import BrokerIntegrationPage from './pages/features/BrokerIntegrationPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import TradesPage from './pages/TradesPage';
import StatsPage from './pages/StatsPage';
import DashboardPage from './pages/DashboardPage';
import TutorialPage from './pages/TutorialPage';
import { LoadingProvider, useLoading } from './components/common/LoadingContext';
import { ThemeProvider } from './components/common/ThemeContext';

function AppContent() {
  const { isLoading, setIsLoading } = useLoading();
  const location = useLocation();

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 120);
    return () => clearTimeout(timer);
  }, [location.pathname, setIsLoading]);

  return (
    <div className="min-h-screen bg-white dark:bg-navy-900">
      {isLoading && <Loader />}
      <Navbar />
      <div className="container mx-auto p-4 pt-[65px]">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/home" element={
            <>
              <Helmet>
                <title>TradeZen - 知行合一 交易管理与复盘系统</title>
                <meta name="description" content="TradeZen 是专为交易者打造的交易管理大师平台。集成交易日志、知行纪律与情绪分析、多维数据统计、逐根K线复盘与实盘直连同步。" />
                <meta property="og:title" content="TradeZen - 知行合一 交易管理与复盘系统" />
                <meta property="og:description" content="TradeZen 是专为交易者打造的交易管理大师平台。集成交易日志、知行纪律与情绪分析、多维数据统计、逐根K线复盘与实盘直连同步。" />
                <meta property="og:url" content="https://tradezen.app/" />
                <link rel="canonical" href="https://tradezen.app/" />
              </Helmet>
              <Hero />
              <Stats />
              <Features />
              <Analysis />
              <Reports />
              <Playbooks />
              <Backtesting />
              <Newsletter />
            </>
          } />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/careers" element={<CareersPage />} />
          <Route path="/press" element={<PressPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/faq" element={<FAQPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/cookies" element={<CookiesPage />} />
          <Route path="/accessibility" element={<AccessibilityPage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/partners" element={<PartnersPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/broker-support" element={<BrokerSupportPage />} />
          <Route path="/features/journaling" element={<AutomatedJournalingPage />} />
          <Route path="/features/analysis" element={<TradeAnalysisPage />} />
          <Route path="/features/reporting" element={<ReportingPage />} />
          <Route path="/features/playbooks" element={<PlaybooksPage />} />
          <Route path="/features/backtesting" element={<BacktestingPage />} />
          <Route path="/features/broker-integration" element={<BrokerIntegrationPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
          <Route path="/trades" element={<TradesPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/calendar" element={<StatsPage />} />
          <Route path="/tutorial" element={<TutorialPage />} />
          <Route path="/guide" element={<TutorialPage />} />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <ThemeProvider>
        <LoadingProvider>
          <AppContent />
        </LoadingProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;