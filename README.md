# 📊 Finance.ME — Personal Financial & Goals Dashboard

**Finance.ME** is a modern, full-stack financial management and goal-tracking platform built with a **Zero-Float Integer Cents Ledger** on **SQLite (Prisma ORM)**, a **Deterministic Compound Interest Engine** for individual Savings Goals, a **Smart Natural-Language Parser** supporting `k`/`kk` shorthand multipliers, and a **Manual Multi-Currency & Internal Interest Rate Converter (BRL / USD / EUR)**.

---

## ✨ Key Features

### 1. 🔐 Account Authentication & Password Recovery
- **Session & JWT Authentication:** Supports up to 5 individual profiles with strict ownership access control.
- **Password Recovery ("Esqueci minha senha"):** Built-in password reset flow on the authentication screen.
- **Zero Mock / Clean Slate:** The database starts with 0 hardcoded dummy transactions or fake users. Every record is dynamic.

### 2. 💱 Multi-Currency & Internal Interest Rate Sidebar (BRL / USD / EUR + % Rate)
- Located on the dedicated right-hand sidebar:
  - **Base Currency:** Fixed at **1 Real (R$ 1.00)**.
  - **Manual Exchange Rate Inputs:** Set custom conversion rates for **USD ($)** and **EUR (€)** (e.g. `1 USD = R$ 5.50`, `1 EUR = R$ 6.00`).
  - **Internal Interest Rate (Juros Interno):** Set the annual interest rate (`% a.a.`) applied to your **Savings / Metas** to evaluate compound growth in real time.

### 3. ✍️ Smart Natural Language Parser with `k` / `K` Multiplier (`x1000`)
- Type or paste multiple financial entries at once in a single free-text box.
- **Shorthand `k` / `K` Multiplier (`x1000`):**
  - `3k` or `3K` $\rightarrow$ `3,000`
  - `3kk` or `3KK` $\rightarrow$ `3,000,000`
  - `1.5k` or `1,5k` $\rightarrow$ `1,500`
  ```text
  Salário: +3k
  Meta Reserva: 1.5k
  Feira: 800
  Bonus 144,75
  Patrimônio = 3kk
  ```
- **3-Way Semantic Classification:** Automatically classifies entries into:
  - **`+ Acréscimo` (`INCOME`)**: *Salário*, *Bônus*, *Brinde*, *Receita*, *Ganhos*
  - **`- Decréscimo` (`EXPENSE`)**: *Feira*, *Contas*, *Carro*, *Lazer*
  - **`🎯 Meta / Savings` (`SAVINGS`)**: *Meta*, *Savings*, *Reserva*, *Poupança*, *Investimento*, *Aporte*

### 4. 🎯 Individual Goals (Metas / Savings) & Compound Interest ETA Engine
- A dedicated **3rd group type (`Meta / Savings`)** alongside Income and Expenses.
- **Individual Target (`Meta Individual`):** Define or edit the target value for each Savings group (supports `k`/`kk` notation, e.g., `50k`).
- **Historical Flow & Monthly Average:** Tracks how much was invested across recent months and automatically calculates your **Average Monthly Contribution (`Média de Entrada Mensal`)**.
- **Deterministic Time-to-Goal & Compound Interest Evaluation:** Uses the offline compound interest mathematics engine together with your configured **Internal Interest Rate** and **Monthly Average Inflow** to calculate:
  - Exact time remaining to hit each goal (**with compound interest** vs **without interest**).
  - Total out-of-pocket principal vs compound interest earned over the goal horizon.
  - Interactive growth curve for each individual goal.

### 5. 📂 Group Management & Reallocation
- Move any entry between groups (`Despesas`, `Mantimento`, `Lazer`, `Despesas com Carro`, `Ganhos com a Oficina`, `Metas & Savings`, or custom groups) with one click.
- Adjust values inline with `+` / `-` buttons or click to type exact values (including `3k` / `1.5k` notation).
- Cycle any entry between `+ Acréscimo`, `🎯 Meta / Savings`, and `- Decréscimo`.

### 6. 📈 Visualizations, Smart Surplus Allocation & Safe Export
- **Summary Cards:** Total Income, Paid Bills, Pending Liabilities, and Net Remaining Cash Flow.
- **Donut & 12-Month History Charts:** Category breakdown and historical cash flow trend.
- **Smart Allocations:** Distributes net monthly surplus across target buckets.
- **1-Click Export:** Formula-sanitized **CSV Export** and **JSON Snapshot Backup**.

---

## 🛠️ Tech Stack & Architecture

```
FinancialBoard/
├── backend/                  # Node.js + Express + Prisma ORM + TypeScript
│   ├── prisma/               # SQLite Schema & Seed scripts
│   ├── src/
│   │   ├── math/             # Integer-cents currency, cash flow & compound interest Goal ETA engine
│   │   ├── middleware/       # JWT Authentication, rate limiting & security headers
│   │   └── routes/           # REST endpoints (auth, dashboard, transactions, savings, export)
│   └── Dockerfile
├── frontend/                 # React 18 + Vite + Tailwind CSS + TypeScript
│   ├── src/
│   │   ├── components/       # Header, SummaryCards, TransactionLedger, SavingsGoalsPanel, CurrencySidebar
│   │   ├── services/         # API client
│   │   └── utils/            # Currency converter & Smart Textarea Parser (with k/kk support)
│   └── Dockerfile
├── docker-compose.yml        # Multi-container orchestration (Backend + Frontend + Caddy)
├── Caddyfile                 # Reverse proxy pre-configured for automatic HTTPS / TLS
├── .env.example              # Environment configuration template
└── package.json              # Monorepo concurrency scripts
```

---

## 🚀 Quick Start (Local Development)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start both backend and frontend concurrently:
   ```bash
   npm run dev
   ```

3. Open your browser at:
   👉 **`http://localhost:5173`**

---

## 🧪 Automated Testing

Run the financial mathematics, cash flow, and compound interest test suites:

```bash
npm run test
```

---

## 📄 License
This project is licensed under the MIT License.
