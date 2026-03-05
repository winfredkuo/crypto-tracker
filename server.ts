import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";

const db = new Database("crypto_tracker.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT CHECK(type IN ('BUY', 'SELL', 'EXCHANGE')),
    asset TEXT,
    pair TEXT CHECK(pair IN ('TWD', 'USDT')),
    amount REAL,
    price REAL,
    exchange_rate REAL,
    remaining_amount REAL,
    realized_profit REAL DEFAULT 0,
    from_asset TEXT,
    to_asset TEXT,
    from_amount REAL,
    to_amount REAL,
    asset_exchange_rate REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Migration: Add missing columns if they don't exist
const tableInfo = db.prepare("PRAGMA table_info(transactions)").all();
const columns = tableInfo.map((c: any) => c.name);

if (!columns.includes('exchange_rate')) {
  db.exec("ALTER TABLE transactions ADD COLUMN exchange_rate REAL DEFAULT 31.5");
}
if (!columns.includes('remaining_amount')) {
  db.exec("ALTER TABLE transactions ADD COLUMN remaining_amount REAL");
  // Populate remaining_amount for existing BUY transactions
  db.exec("UPDATE transactions SET remaining_amount = amount WHERE type = 'BUY' AND remaining_amount IS NULL");
}
if (!columns.includes('realized_profit')) {
  db.exec("ALTER TABLE transactions ADD COLUMN realized_profit REAL DEFAULT 0");
}
if (!columns.includes('from_asset')) {
  db.exec("ALTER TABLE transactions ADD COLUMN from_asset TEXT");
}
if (!columns.includes('to_asset')) {
  db.exec("ALTER TABLE transactions ADD COLUMN to_asset TEXT");
}
if (!columns.includes('from_amount')) {
  db.exec("ALTER TABLE transactions ADD COLUMN from_amount REAL");
}
if (!columns.includes('to_amount')) {
  db.exec("ALTER TABLE transactions ADD COLUMN to_amount REAL");
}
if (!columns.includes('asset_exchange_rate')) {
  db.exec("ALTER TABLE transactions ADD COLUMN asset_exchange_rate REAL");
}

// Update type check if needed (SQLite doesn't easily allow updating CHECK constraints, but we can try to recreate or just ignore if it's already there)
// For simplicity in this environment, we'll just assume the new table creation or migration handled it.

// Ensure remaining_amount is not null for any existing BUY transactions (double check)
db.exec("UPDATE transactions SET remaining_amount = amount WHERE type = 'BUY' AND remaining_amount IS NULL");
db.exec("UPDATE transactions SET exchange_rate = 31.5 WHERE exchange_rate IS NULL");


async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/prices", async (req, res) => {
    try {
      const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
      const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Binance API error");
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Price fetch error:", error);
      res.status(500).json({ error: "Failed to fetch prices" });
    }
  });

  app.get("/api/exchange-rate", async (req, res) => {
    try {
      const response = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
      if (!response.ok) throw new Error("Exchange rate API error");
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Exchange rate fetch error:", error);
      res.status(500).json({ error: "Failed to fetch exchange rate" });
    }
  });

  app.get("/api/transactions", (req, res) => {
    const transactions = db.prepare("SELECT * FROM transactions ORDER BY timestamp DESC").all();
    // Map snake_case to camelCase
    const mapped = transactions.map((t: any) => ({
      id: t.id,
      type: t.type,
      asset: t.asset,
      pair: t.pair,
      amount: t.amount,
      price: t.price,
      exchangeRate: t.exchange_rate,
      remainingAmount: t.remaining_amount,
      realizedProfit: t.realized_profit,
      fromAsset: t.from_asset,
      toAsset: t.to_asset,
      fromAmount: t.from_amount,
      toAmount: t.to_amount,
      assetExchangeRate: t.asset_exchange_rate,
      timestamp: t.timestamp
    }));
    res.json(mapped);
  });

  app.post("/api/transactions", (req, res) => {
    const { type, asset, pair, amount, price, exchangeRate, fromAsset, toAsset, fromAmount, toAmount, assetExchangeRate } = req.body;
    
    if (type === 'BUY') {
      const info = db.prepare(
        "INSERT INTO transactions (type, asset, pair, amount, price, exchange_rate, remaining_amount) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(type, asset, pair, amount, price, exchangeRate, amount);
      return res.json({ id: info.lastInsertRowid });
    }

    if (type === 'SELL') {
      const { selectedLots } = req.body;
      let totalProfit = 0;
      const sellPriceInUSDT = pair === 'USDT' ? price : price / exchangeRate;

      if (selectedLots && Array.isArray(selectedLots) && selectedLots.length > 0) {
        // Manual lot selection
        for (const lotSelection of selectedLots) {
          const buy = db.prepare("SELECT * FROM transactions WHERE id = ?").get(lotSelection.id);
          if (!buy || buy.remaining_amount < lotSelection.amount) continue;

          const buyPriceInUSDT = buy.pair === 'USDT' ? buy.price : buy.price / buy.exchange_rate;
          const profitFromThisLot = lotSelection.amount * (sellPriceInUSDT - buyPriceInUSDT);
          
          db.prepare("UPDATE transactions SET remaining_amount = remaining_amount - ?, realized_profit = realized_profit + ? WHERE id = ?")
            .run(lotSelection.amount, profitFromThisLot, buy.id);
          
          totalProfit += profitFromThisLot;
        }
      } else {
        // Fallback to FIFO logic
        const buys = db.prepare("SELECT * FROM transactions WHERE type = 'BUY' AND asset = ? AND remaining_amount > 0 ORDER BY timestamp ASC").all(asset);
        let sellAmount = amount;
        for (const buy of buys) {
          if (sellAmount <= 0) break;
          const buyPriceInUSDT = buy.pair === 'USDT' ? buy.price : buy.price / buy.exchange_rate;
          const consume = Math.min(sellAmount, buy.remaining_amount);
          const profitFromThisLot = consume * (sellPriceInUSDT - buyPriceInUSDT);
          
          db.prepare("UPDATE transactions SET remaining_amount = remaining_amount - ?, realized_profit = realized_profit + ? WHERE id = ?")
            .run(consume, profitFromThisLot, buy.id);
          
          totalProfit += profitFromThisLot;
          sellAmount -= consume;
        }
      }

      const info = db.prepare(
        "INSERT INTO transactions (type, asset, pair, amount, price, exchange_rate, realized_profit) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(type, asset, pair, amount, price, exchangeRate, totalProfit);
      return res.json({ id: info.lastInsertRowid });
    }

    if (type === 'EXCHANGE') {
      const info = db.prepare(
        "INSERT INTO transactions (type, from_asset, to_asset, from_amount, to_amount, asset_exchange_rate) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(type, fromAsset, toAsset, fromAmount, toAmount, assetExchangeRate);
      return res.json({ id: info.lastInsertRowid });
    }

    res.status(400).json({ error: "Invalid transaction type" });
  });

  app.delete("/api/transactions/:id", (req, res) => {
    // Note: Deleting a transaction in a FIFO system is tricky.
    // For a simple app, we'll just delete it, but it might mess up calculations.
    // In a real app, you'd want to recalculate everything.
    db.prepare("DELETE FROM transactions WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.put("/api/transactions/:id", (req, res) => {
    const { type, asset, pair, amount, price, exchangeRate, remainingAmount, realizedProfit, fromAsset, toAsset, fromAmount, toAmount, assetExchangeRate } = req.body;
    const id = req.params.id;

    db.prepare(`
      UPDATE transactions 
      SET type = ?, asset = ?, pair = ?, amount = ?, price = ?, exchange_rate = ?, 
          remaining_amount = ?, realized_profit = ?, from_asset = ?, to_asset = ?,
          from_amount = ?, to_amount = ?, asset_exchange_rate = ?
      WHERE id = ?
    `).run(type, asset, pair, amount, price, exchangeRate, remainingAmount, realizedProfit, fromAsset, toAsset, fromAmount, toAmount, assetExchangeRate, id);

    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
