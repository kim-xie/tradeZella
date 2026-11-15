# TradeZen (知行交易) - 交易管理与复盘大师 📈

![TradeZen Banner](/public/assets/1.png)

## 📖 Project Overview

**TradeZen (知行交易)** 是一款面向严肃交易者与量化主观交易团队的交易管理与认知进化工作台。融合了**自动化交易日志**、**知行合一纪律与情绪追踪**、**多维数据统计与归因透视**、**K线逐帧复盘回测 (Manual Bar Replay)** 与 **MT5 毫秒级直连同步**。

我们的使命是帮助交易员克服人性弱点，沉淀客观可复制的交易优势（Edge），实现知行合一。

---

## 🚀 核心功能特色 (Core Features)

### **1. 📝 交易日志与自动化同步 (Automated Journaling)**
- **MT5 终端本地直连**：一键毫秒级同步本地 MT5 历史 Deals 与仓位订单，无需手动输入。
- **智能 CSV 解析**：兼容 MT5、MT4 以及 TradeZen 通用标准 CSV 自动识别导入。
- **情绪与纪律追踪**：记录入场情绪（FOMO、犹豫、自信、焦虑等）、交易错误归因（追高、扛单、违规重仓、提早离场）与执行评分。

### **2. 📊 多维绩效透视 (Advanced Analytics)**
- **核心数据看板**：盈亏曲线 (P&L Equity Curve)、胜率、盈亏比 (RRR)、最大回撤 (Max Drawdown)、期望值 (Expectancy)。
- **错误代价计算 (P&L Without Mistakes)**：自动测算若严格遵守纪律、排除冲动交易所能多获得的潜在利润。
- **MFE / MAE 潜力和最大逆境分析**：量化入场后的最大顺行幅度与最大逆行幅度，精确优化止盈止损点位。

### **3. ⏪ K线逐帧复盘与回测 (Manual Bar Replay & Backtest)**
- **逐根K线推进回放**：还原真实交易现场，屏蔽“未来数据”，训练盘感与执行纪律。
- **复盘交易一键入库**：在模拟回放中开平仓，一键保存至 TradeZen 数据库并自动打上复盘标签对比实盘。

### **4. 🎯 战术手册与策略沉淀 (Playbooks)**
- 沉淀个人经典胜率战法，结构化关联每一笔真实交易与回测样本。

---

## 🛠 Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lightweight Charts, Lucide Icons, Framer Motion
- **Backend:** Node.js, Express.js
- **Database:** PostgreSQL (Neon Cloud / Local PG)
- **Data Integrations:** MetaTrader 5 (MT5 Python Direct Engine), CSV Multi-Broker Universal Parser
- **Authentication:** JWT, Passport.js

---

## ⚙️ Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/tradezen.git
   cd tradezen
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   - Create a `.env` file in the `backend/` directory and populate your database credentials.

4. **Run the development servers:**
   ```bash
   npm run dev
   ```

5. **Open the application:**
   - Open `http://localhost:5173` in your browser.

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    - Create a `.env` file in the `backend/` directory and populate it with your database credentials, API keys, etc.

4.  **Run the development servers:**
    - This command concurrently starts the Vite frontend and the Nodemon backend.
    ```bash
    npm run dev
    ```

5.  **Open the application:**
    - Navigate to `http://localhost:5173` in your web browser.

---

## 📸 Screenshots

### Advanced Trade Analysis
![Trade Analysis Dashboard](/public/assets/2.png)
*Performance metrics tracking, symbol-specific analysis, and more.*

### Automated Trade Journaling
![Journaling Interface](/public/assets/3.png)
*Effortless trade documentation with custom tags and emotion tracking.*

### Dashboard Overview
![Dashboard](/public/assets/4.png)
*Your trading performance at a glance.*

### Analytics Tools
![Analytics](/public/assets/5.png)
*Deep dive into your trading patterns.*

### Community Forum
![Community](/public/assets/6.png)
*Connect with fellow traders in the new Community Hub.*

---

## 📅 Roadmap

Our development is guided by a phased rollout plan to continuously deliver value.

- **Phase 1: Core Forum (Complete)**
  - ✅ Categories, threads, and replies
  - ✅ Rich text editing and chart embedding
  - ✅ Search and filtering

- **Phase 2: Engagement & Social Features (In Progress)**
  - ⏳ Real-time notifications
  - ⏳ Upvotes, reactions, and "Best Answer"
  - ⏳ "Follow Journal" feature

- **Phase 3: Gamification & Advanced Tooling**
  - 💡 Leaderboards and achievement badges
  - 💡 AI-assisted trade summaries
  - 💡 Private groups and mentorship circles

---

## 🤝 Contributing

We welcome contributions from the community! If you'd like to help improve TradeZella, please follow these steps:

1.  **Fork the repository.**
2.  **Create a new feature branch:** `git checkout -b feature/your-amazing-feature`
3.  **Commit your changes:** `git commit -m 'feat: Add some amazing feature'`
4.  **Push to the branch:** `git push origin feature/your-amazing-feature`
5.  **Open a Pull Request** against the `main` branch.

---

## 📜 License

This project is licensed under the **MIT License**. See the `LICENSE` file for more details.

---

<p align="center">
  Made with ❤️ by the TradeZen Team & Community
</p>