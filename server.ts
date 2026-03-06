import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { sql } from "@vercel/postgres";

// Helper to check if we should use Postgres
const usePostgres = !!process.env.POSTGRES_URL;

// Initialize SQLite lazily to avoid issues in environments where it's not supported
let sqliteDb: any = null;

async function getSqliteDb() {
  if (!sqliteDb && !usePostgres) {
    try {
      const { default: Database } = await import("better-sqlite3");
      sqliteDb = new Database("crypto_tracker.db");
    } catch (err) {
      console.warn("Failed to load better-sqlite3, local database will not be available.");
    }
  }
  return sqliteDb;
}

async function initDatabase() {
  if (usePostgres) {
    console.log("Using Vercel Postgres");
    try {
      // 1. Ensure basic table exists
      await sql`
        CREATE TABLE IF NOT EXISTS transactions (
          id SERIAL PRIMARY KEY,
          type TEXT,
          asset TEXT,
          pair TEXT,
          amount DOUBLE PRECISION,
          price DOUBLE PRECISION,
          exchange_rate DOUBLE PRECISION,
          remaining_amount DOUBLE PRECISION,
          realized_profit DOUBLE PRECISION DEFAULT 0,
          from_asset TEXT,
          to_asset TEXT,
          from_amount DOUBLE PRECISION,
          to_amount DOUBLE PRECISION,
          asset_exchange_rate DOUBLE PRECISION,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // 2. Migration: Add missing columns if they don't exist
      // We use a series of ALTER TABLE statements
      const migrations = [
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS from_asset TEXT",
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS to_asset TEXT",
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS from_amount DOUBLE PRECISION",
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS to_amount DOUBLE PRECISION",
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS asset_exchange_rate DOUBLE PRECISION",
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS realized_profit DOUBLE PRECISION DEFAULT 0"
      ];

      for (const query of migrations) {
        try {
          await sql.query(query);
        } catch (e) {
          // Ignore errors if column already exists or other minor issues
        }
      }

      console.log("Postgres table ensured and migrated");
    } catch (err) {
      console.error("Postgres init error:", err);
    }
  } else {
    const db = await getSqliteDb();
    if (db) {
      console.log("Using local SQLite");
      db.exec(`
        CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT,
          asset TEXT,
          pair TEXT,
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
    }
  }
}

const app = express();
app.use(express.json());

// Ensure DB is initialized
let dbInitialized = false;
app.use(async (req, res, next) => {
  if (!dbInitialized) {
    await initDatabase();
    dbInitialized = true;
  }
  next();
});

// API Routes
app.get("/api/prices", async (req, res) => {
    try {
      // Strategy: 1. CoinGlass (if key exists) -> 2. Binance -> 3. CoinGecko
      
      // 1. Try CoinGlass (Primary - if API key is configured)
      if (process.env.COINGLASS_SECRET) {
        try {
          const response = await fetch("https://open-api.coinglass.com/public/v2/index/price", {
            headers: { "coinglassSecret": process.env.COINGLASS_SECRET },
            signal: AbortSignal.timeout(5000)
          });
          
          if (response.ok) {
            const json = await response.json();
            if (json.success && json.data) {
              const data = json.data;
              const symbolsMap: Record<string, string> = { "BTC": "BTCUSDT", "ETH": "ETHUSDT", "SOL": "SOLUSDT" };
              const relevantData = data.filter((item: any) => symbolsMap[item.symbol]);
              
              if (relevantData.length > 0) {
                const mappedData = relevantData.map((item: any) => ({
                  symbol: symbolsMap[item.symbol],
                  lastPrice: String(item.price),
                  priceChangePercent: String(item.changePercent24h || 0)
                }));
                return res.json(mappedData);
              }
            }
          }
        } catch (e) {
          console.warn("CoinGlass failed, trying Binance...", e);
        }
      }

      // 2. Try Binance (Secondary)
      try {
        const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
        const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`;
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            return res.json(data);
          }
        }
      } catch (e) {
        console.warn("Binance.com failed, trying Binance.us...", e);
        try {
          const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
          const url = `https://api.binance.us/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`;
          const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) return res.json(data);
          }
        } catch (e2) {
          console.warn("Binance.us failed, trying CoinGecko...", e2);
        }
      }

      // 3. Try CoinGecko (Tertiary)
      try {
        const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true", { signal: AbortSignal.timeout(5000) });
        if (response.ok) {
          const data = await response.json();
          const mappedData = [
            { 
              symbol: "BTCUSDT", 
              lastPrice: String(data.bitcoin.usd), 
              priceChangePercent: String(data.bitcoin.usd_24h_change) 
            },
            { 
              symbol: "ETHUSDT", 
              lastPrice: String(data.ethereum.usd), 
              priceChangePercent: String(data.ethereum.usd_24h_change) 
            },
            { 
              symbol: "SOLUSDT", 
              lastPrice: String(data.solana.usd), 
              priceChangePercent: String(data.solana.usd_24h_change) 
            }
          ];
          return res.json(mappedData);
        }
      } catch (e) {
        console.warn("CoinGecko failed final fallback", e);
      }

      throw new Error("All price APIs failed");
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

  app.get("/api/transactions", async (req, res) => {
    try {
      let transactions;
      if (usePostgres) {
        const { rows } = await sql`SELECT * FROM transactions ORDER BY timestamp DESC`;
        transactions = rows;
      } else {
        const db = await getSqliteDb();
        transactions = db ? db.prepare("SELECT * FROM transactions ORDER BY timestamp DESC").all() : [];
      }

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
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/api/transactions", async (req, res) => {
    const { type, asset, pair, amount, price, exchangeRate, fromAsset, toAsset, fromAmount, toAmount, assetExchangeRate } = req.body;
    
    console.log(`Incoming transaction: ${type}`, req.body);

    try {
      // Sanitize numeric inputs to prevent NaN errors in Postgres
      const safeAmount = parseFloat(amount) || 0;
      const safePrice = parseFloat(price) || 0;
      const safeExchangeRate = parseFloat(exchangeRate) || 0;
      const safeFromAmount = parseFloat(fromAmount) || 0;
      const safeToAmount = parseFloat(toAmount) || 0;
      const safeAssetExchangeRate = parseFloat(assetExchangeRate) || 0;

      if (type === 'BUY') {
          if (usePostgres) {
            const { rows } = await sql`
              INSERT INTO transactions (type, asset, pair, amount, price, exchange_rate, remaining_amount) 
              VALUES (${type}, ${asset}, ${pair}, ${safeAmount}, ${safePrice}, ${safeExchangeRate}, ${safeAmount})
              RETURNING id
            `;
            console.log("BUY transaction saved to Postgres, ID:", rows[0].id);
            return res.json({ id: rows[0].id });
          } else {
            const db = await getSqliteDb();
            if (!db) throw new Error("Database not available");
            const info = db.prepare(
              "INSERT INTO transactions (type, asset, pair, amount, price, exchange_rate, remaining_amount) VALUES (?, ?, ?, ?, ?, ?, ?)"
            ).run(type, asset, pair, safeAmount, safePrice, safeExchangeRate, safeAmount);
            return res.json({ id: info.lastInsertRowid });
          }
        }
  
        if (type === 'SELL') {
          const { selectedLots } = req.body;
          let totalProfit = 0;
          const sellPriceInUSDT = pair === 'USDT' ? safePrice : safePrice / (safeExchangeRate || 1);
  
          if (selectedLots && Array.isArray(selectedLots) && selectedLots.length > 0) {
            for (const lotSelection of selectedLots) {
              let buy;
              if (usePostgres) {
                const { rows } = await sql`SELECT * FROM transactions WHERE id = ${lotSelection.id}`;
                buy = rows[0];
              } else {
                const db = await getSqliteDb();
                buy = db ? db.prepare("SELECT * FROM transactions WHERE id = ?").get(lotSelection.id) : null;
              }
  
              if (!buy || buy.remaining_amount < lotSelection.amount) continue;
  
              const buyPriceInUSDT = buy.pair === 'USDT' ? buy.price : buy.price / (buy.exchange_rate || 1);
              const profitFromThisLot = lotSelection.amount * (sellPriceInUSDT - buyPriceInUSDT);
              
              if (usePostgres) {
                await sql`
                  UPDATE transactions 
                  SET remaining_amount = remaining_amount - ${lotSelection.amount}, 
                      realized_profit = realized_profit + ${profitFromThisLot} 
                  WHERE id = ${buy.id}
                `;
              } else {
                const db = await getSqliteDb();
                if (db) {
                  db.prepare("UPDATE transactions SET remaining_amount = remaining_amount - ?, realized_profit = realized_profit + ? WHERE id = ?")
                    .run(lotSelection.amount, profitFromThisLot, buy.id);
                }
              }
              
              totalProfit += profitFromThisLot;
            }
          } else {
            // FIFO Fallback
            let buys;
            if (usePostgres) {
              const { rows } = await sql`SELECT * FROM transactions WHERE type = 'BUY' AND asset = ${asset} AND remaining_amount > 0 ORDER BY timestamp ASC`;
              buys = rows;
            } else {
              const db = await getSqliteDb();
              buys = db ? db.prepare("SELECT * FROM transactions WHERE type = 'BUY' AND asset = ? AND remaining_amount > 0 ORDER BY timestamp ASC").all(asset) : [];
            }
  
            let sellAmount = safeAmount;
            for (const buy of buys) {
              if (sellAmount <= 0) break;
              const buyPriceInUSDT = buy.pair === 'USDT' ? buy.price : buy.price / (buy.exchange_rate || 1);
              const consume = Math.min(sellAmount, buy.remaining_amount);
              const profitFromThisLot = consume * (sellPriceInUSDT - buyPriceInUSDT);
              
              if (usePostgres) {
                await sql`
                  UPDATE transactions 
                  SET remaining_amount = remaining_amount - ${consume}, 
                      realized_profit = realized_profit + ${profitFromThisLot} 
                  WHERE id = ${buy.id}
                `;
              } else {
                const db = await getSqliteDb();
                if (db) {
                  db.prepare("UPDATE transactions SET remaining_amount = remaining_amount - ?, realized_profit = realized_profit + ? WHERE id = ?")
                    .run(consume, profitFromThisLot, buy.id);
                }
              }
              
              totalProfit += profitFromThisLot;
              sellAmount -= consume;
            }
          }
  
          if (usePostgres) {
            const { rows } = await sql`
              INSERT INTO transactions (type, asset, pair, amount, price, exchange_rate, realized_profit) 
              VALUES (${type}, ${asset}, ${pair}, ${safeAmount}, ${safePrice}, ${safeExchangeRate}, ${totalProfit})
              RETURNING id
            `;
            console.log("SELL transaction saved to Postgres, ID:", rows[0].id);
            return res.json({ id: rows[0].id });
          } else {
            const db = await getSqliteDb();
            if (!db) throw new Error("Database not available");
            const info = db.prepare(
              "INSERT INTO transactions (type, asset, pair, amount, price, exchange_rate, realized_profit) VALUES (?, ?, ?, ?, ?, ?, ?)"
            ).run(type, asset, pair, safeAmount, safePrice, safeExchangeRate, totalProfit);
            return res.json({ id: info.lastInsertRowid });
          }
        }
  
        if (type === 'EXCHANGE') {
          if (usePostgres) {
            const { rows } = await sql`
              INSERT INTO transactions (type, from_asset, to_asset, from_amount, to_amount, asset_exchange_rate) 
              VALUES (${type}, ${fromAsset}, ${toAsset}, ${safeFromAmount}, ${safeToAmount}, ${safeAssetExchangeRate})
              RETURNING id
            `;
            console.log("EXCHANGE transaction saved to Postgres, ID:", rows[0].id);
            return res.json({ id: rows[0].id });
          } else {
            const db = await getSqliteDb();
            if (!db) throw new Error("Database not available");
            const info = db.prepare(
              "INSERT INTO transactions (type, from_asset, to_asset, from_amount, to_amount, asset_exchange_rate) VALUES (?, ?, ?, ?, ?, ?)"
            ).run(type, fromAsset, toAsset, safeFromAmount, safeToAmount, safeAssetExchangeRate);
            return res.json({ id: info.lastInsertRowid });
          }
        }

      res.status(400).json({ error: "Invalid transaction type" });
    } catch (err) {
      console.error("Transaction save error:", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete("/api/transactions/:id", async (req, res) => {
    try {
      if (usePostgres) {
        await sql`DELETE FROM transactions WHERE id = ${req.params.id}`;
      } else {
        const db = await getSqliteDb();
        if (db) db.prepare("DELETE FROM transactions WHERE id = ?").run(req.params.id);
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put("/api/transactions/:id", async (req, res) => {
    const { type, asset, pair, amount, price, exchangeRate, remainingAmount, realizedProfit, fromAsset, toAsset, fromAmount, toAmount, assetExchangeRate } = req.body;
    const id = req.params.id;

    try {
      if (usePostgres) {
        await sql`
          UPDATE transactions 
          SET type = ${type}, asset = ${asset}, pair = ${pair}, amount = ${amount}, price = ${price}, 
              exchange_rate = ${exchangeRate}, remaining_amount = ${remainingAmount}, 
              realized_profit = ${realizedProfit}, from_asset = ${fromAsset}, to_asset = ${toAsset},
              from_amount = ${fromAmount}, to_amount = ${toAmount}, asset_exchange_rate = ${assetExchangeRate}
          WHERE id = ${id}
        `;
      } else {
        const db = await getSqliteDb();
        if (db) {
          db.prepare(`
            UPDATE transactions 
            SET type = ?, asset = ?, pair = ?, amount = ?, price = ?, exchange_rate = ?, 
                remaining_amount = ?, realized_profit = ?, from_asset = ?, to_asset = ?,
                from_amount = ?, to_amount = ?, asset_exchange_rate = ?
            WHERE id = ?
          `).run(type, asset, pair, amount, price, exchangeRate, remainingAmount, realizedProfit, fromAsset, toAsset, fromAmount, toAmount, assetExchangeRate, id);
        }
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

async function startServer() {
  const PORT = 3000;

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

// Export for Vercel
export default app;

if (process.env.NODE_ENV !== "production") {
  startServer();
}

