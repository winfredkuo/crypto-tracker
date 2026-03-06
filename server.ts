import "dotenv/config";
import express from "express";
import path from "path";
import { sql } from "@vercel/postgres";

// Helper to check if we should use Postgres
const usePostgres = !!process.env.POSTGRES_URL || !!process.env.DATABASE_URL;

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
          // Ignore errors
        }
      }

      console.log("Postgres table ensured and migrated");
    } catch (err) {
      console.error("Postgres init error:", err);
    }
  } else {
    console.warn("POSTGRES_URL is missing. Database will not be available in production.");
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

// Price cache to handle quota issues
let priceCache: { data: any, timestamp: number } | null = null;
const CACHE_DURATION = 15000; // 15 seconds

// Helper to get env var regardless of common casing
const getEnv = (key: string) => process.env[key] || process.env[key.toLowerCase()] || process.env[key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()];

// API Routes
app.get("/api/debug/env", (req, res) => {
  res.json({
    hasPostgresUrl: !!process.env.POSTGRES_URL,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    usePostgres: usePostgres
  });
});

app.get("/api/prices", async (req, res) => {
    // Return cached data if valid
    if (priceCache && Date.now() - priceCache.timestamp < CACHE_DURATION) {
      return res.json(priceCache.data);
    }

    try {
      // Strategy: 1. CoinGlass (if key exists) -> 2. Binance -> 3. CoinGecko
      let priceData = null;
      
      // 1. Try CoinGlass
      const cgSecret = getEnv("COINGLASS_SECRET") || process.env.Coinglass_secret;
      if (cgSecret) {
        try {
          const response = await fetch("https://open-api.coinglass.com/public/v2/index/price", {
            headers: { "coinglassSecret": cgSecret },
            signal: AbortSignal.timeout(5000)
          });
          
          if (response.ok) {
            const json = await response.json();
            if (json.success && json.data) {
              const data = json.data;
              const symbolsMap: Record<string, string> = { "BTC": "BTCUSDT", "ETH": "ETHUSDT", "SOL": "SOLUSDT" };
              const relevantData = data.filter((item: any) => symbolsMap[item.symbol]);
              
              if (relevantData.length > 0) {
                priceData = relevantData.map((item: any) => ({
                  symbol: symbolsMap[item.symbol],
                  lastPrice: String(item.price),
                  priceChangePercent: String(item.changePercent24h || 0)
                }));
              }
            }
          }
        } catch (e) {
          console.warn("CoinGlass failed, trying Binance...", e);
        }
      }

      // 2. Try Binance
      if (!priceData) {
        try {
          const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
          const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`;
          const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) priceData = data;
          }
        } catch (e) {
          console.warn("Binance.com failed, trying Binance.us...", e);
          try {
            const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
            const url = `https://api.binance.us/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`;
            const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
            if (response.ok) {
              const data = await response.json();
              if (Array.isArray(data)) priceData = data;
            }
          } catch (e2) {
            console.warn("Binance.us failed, trying CoinGecko...", e2);
          }
        }
      }

      // 3. Try CoinGecko
      if (!priceData) {
        try {
          const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true", { signal: AbortSignal.timeout(5000) });
          if (response.ok) {
            const data = await response.json();
            priceData = [
              { symbol: "BTCUSDT", lastPrice: String(data.bitcoin.usd), priceChangePercent: String(data.bitcoin.usd_24h_change) },
              { symbol: "ETHUSDT", lastPrice: String(data.ethereum.usd), priceChangePercent: String(data.ethereum.usd_24h_change) },
              { symbol: "SOLUSDT", lastPrice: String(data.solana.usd), priceChangePercent: String(data.solana.usd_24h_change) }
            ];
          }
        } catch (e) {
          console.warn("CoinGecko failed final fallback", e);
        }
      }

      if (priceData) {
        priceCache = { data: priceData, timestamp: Date.now() };
        return res.json(priceData);
      }

      // If all fail, return cache even if expired
      if (priceCache) {
        console.warn("All APIs failed, returning stale cache");
        return res.json(priceCache.data);
      }

      throw new Error("All price APIs failed and no cache available");
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

  app.post("/api/admin/reset-db", async (req, res) => {
    try {
      if (usePostgres) {
        await sql`DROP TABLE IF EXISTS transactions`;
        dbInitialized = false; // Trigger re-init on next request
        res.json({ success: true, message: "Database reset successfully" });
      } else {
        res.status(400).json({ error: "Postgres not configured" });
      }
    } catch (err) {
      console.error("Reset DB error:", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get("/api/transactions", async (req, res) => {
    try {
      let transactions = [];
      if (usePostgres) {
        const { rows } = await sql`SELECT * FROM transactions ORDER BY timestamp DESC`;
        transactions = rows;
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
            return res.status(400).json({ error: "Database not available" });
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
              }
              
              totalProfit += profitFromThisLot;
            }
          } else {
            // FIFO Fallback
            let buys = [];
            if (usePostgres) {
              const { rows } = await sql`SELECT * FROM transactions WHERE type = 'BUY' AND asset = ${asset} AND remaining_amount > 0 ORDER BY timestamp ASC`;
              buys = rows;
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
            return res.status(400).json({ error: "Database not available" });
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
            return res.status(400).json({ error: "Database not available" });
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
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

// Global Error Handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error("GLOBAL ERROR:", err);
  res.status(500).json({ 
    error: "Internal Server Error", 
    message: err.message || "Unknown error",
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Vite middleware for development
if (process.env.NODE_ENV !== "production") {
  const setupVite = async () => {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  };
  setupVite();
} else {
  app.use(express.static("dist"));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.resolve("dist/index.html"));
  });
}

async function startServer() {
  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Export for Vercel
export default app;

if (process.env.NODE_ENV !== "production") {
  startServer();
}

