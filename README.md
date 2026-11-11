# 📊 FamilyFinance — Personal & Family Financial Dashboard

A modern, production-grade financial management platform tailored for a **5-member family base**. Built with a **Zero-Float Integer Cents Ledger** on **SQLite (Prisma ORM)**, an **Offline Deterministic Financial Mathematics Engine**, a **Smart Natural-Language Parser** for free-form multi-line accounting entries, and a **Manual Multi-Currency Converter (BRL / USD / EUR)**.

---

## ✨ Key Features

### 1. 🔐 Multi-User Authentication & Strong Password Policy
- **Lightweight JWT Auth:** Supports up to 5 family member profiles with Role-Based Access Control (`ADMIN` and `MEMBER`).
- **Real-Time Password Validation:** Reactive visual checklist enforcing security standards:
  - Minimum of 8 characters.
  - At least 1 uppercase letter (`A-Z`).
  - At least 1 lowercase letter (`a-z`).
  - At least 1 special character (`!@#$%^&*`).
- **Zero Mock / Clean Slate:** The database starts with 0 hardcoded dummy transactions or fake users. Every record is dynamic.

### 2. 💱 Multi-Currency & Manual Exchange Rate Converter (BRL / USD / EUR)
- Located on the dedicated right-hand sidebar.
- **Base Currency:** Fixed at **1 Real (R$ 1.00)**.
- **Manual Rate Inputs:** Enter custom exchange rates for **USD ($)** and **EUR (€)** (e.g. `1 USD = R$ 5.50`, `1 EUR = R$ 6.00`).
- **Dynamic UI Cascading:** Switching between `R$`, `$`, and `€` immediately recalculates and formats all metrics, summary cards, charts, and ledger entries in real time based on your defined rates.

### 3. ✍️ Smart Natural Language Free-Text Parser
- Replace tedious repetitive form filling with a **single multi-line text box**.
- Paste or type entries freely:
  ```text
  Salário: +2.300
  Feira: 800
  Brinde 200
  Bonus 144,75
  Carroceria do carro = 500
  ```
- **Semantic Inference:** Automatically classifies terms into **+ Income** (*Salário*, *Bônus*, *Brinde*, *Receita*) or **- Expense** (*Feira*, *Carroceria*, *Contas*).
- **Automatic Grouping:** Intelligently allocates entries into categories (*Mantimento*, *Despesas com Carro*, *Renda & Ganhos*, *Lazer*, *Moradia*).
- **Pre-Save Interactive Review:** Review parsed lines, switch groups, adjust values, and save to SQLite in a single batch.

### 4. 📂 Group Management & Reallocation
- Move any transaction between groups with one click (e.g., move *"Carroceria do carro"* from *"Despesas com Carro"* to *"Ganhos com a Oficina"*).
- Adjust transaction amounts inline with quick `+` and `-` buttons or click to edit exact numbers.
- Toggle between `+ Acréscimo` and `- Decréscimo` anytime.
- Create custom groups with dedicated color coding.

### 5. 🧮 100% Offline Compound Interest & Wealth Simulator
- Deterministic bank ledger growth simulation running purely on the local client/server (no external stock or Selic APIs).
- Interactive sliders for:
  - Initial Principal ($P$)
  - Monthly Contribution ($PMT$)
  - Annual Interest Rate ($i$)
  - Time Horizon ($n$)
- Outputs Future Value ($FV$), total out-of-pocket investment, compound interest accrued, growth curve chart, and wealth milestones ($10k, $50k, $100k, $500k, $1M).

### 6. 📈 Visualizations & Real-Time Balance Engine
- **Summary Cards:** Total Income, Paid Bills, Pending Liabilities, and Net Remaining Cash Flow.
- **Donut Chart:** Expense breakdown by group/category with interactive tooltips.
- **12-Month History Chart:** Historical trend comparing Income vs Expenses vs Net Cash Flow.
- **Smart Allocations:** Automatically reserves surplus cash flow into target buckets (Emergency Reserve 40%, Wealth Investments 40%, Leisure 20%).

### 7. 💾 Backup & Data Export
- 1-click **CSV Export** for spreadsheets.
- 1-click full **JSON Database Snapshot** backup.

---

## 🛠️ Tech Stack & Architecture

```
FinancialBoard/
├── backend/                  # Node.js + Express + Prisma ORM + TypeScript
│   ├── prisma/               # SQLite Schema & Migration scripts
│   ├── src/
│   │   ├── math/             # Safe integer-cents currency & compound interest math
│   │   ├── middleware/       # JWT Authentication & role protection
│   │   └── routes/           # REST endpoints (auth, dashboard, transactions, savings, export)
│   └── Dockerfile
├── frontend/                 # React 18 + Vite + Tailwind CSS + TypeScript
│   ├── src/
│   │   ├── components/       # Header, SummaryCards, ExpenseDonutChart, CurrencySidebar, etc.
│   │   ├── services/         # API client
│   │   └── utils/            # Currency converter & Smart Textarea Parser
│   └── Dockerfile
├── docker-compose.yml        # Multi-container orchestration (Backend + Frontend + Caddy)
├── Caddyfile                 # Reverse proxy pre-configured for automatic HTTPS / TLS
├── .gitignore                # Excludes node_modules, dist, and local database files
└── package.json              # Monorepo concurrency scripts
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/) (v9 or higher)

### Installation & Run

1. Clone or open the repository folder:
   ```bash
   cd financial-board-site
   ```

2. Install root dependencies:
   ```bash
   npm install
   ```

3. Start both backend and frontend concurrently with a single command:
   ```bash
   npm run dev
   ```

4. Open your browser at:
   👉 **`http://localhost:5173`**

The backend API will run simultaneously on `http://localhost:5000`.

---

## 🐳 Docker Deployment & HTTPS (DuckDNS / GCP Ready)

The repository includes a ready-to-run containerized setup with **Caddy Reverse Proxy** for automatic SSL/TLS certificates:

```bash
docker compose up -d
```

### Automatic HTTPS Configuration:
1. Point your domain or DuckDNS subdomain (e.g. `yourfamilyfinance.duckdns.org`) to your server IP.
2. In `Caddyfile`, replace `:80, :443` with your domain:
   ```caddy
   yourfamilyfinance.duckdns.org {
       handle /api/* {
           reverse_proxy backend:5000
       }
       handle /* {
           reverse_proxy frontend:80
       }
   }
   ```
3. Restart Caddy:
   ```bash
   docker compose restart caddy
   ```
   Caddy will automatically generate and renew a free Let's Encrypt SSL/TLS certificate.

---

## 🧪 Automated Testing

Run the financial mathematics and currency test suites:

```bash
npm run test
```

---

## 📄 License
This project is licensed under the MIT License.
