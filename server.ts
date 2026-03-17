import "dotenv/config";
import express from "express";
import path from "path";
import pg from "pg";
const { Client } = pg;

// Helper to check if we should use Postgres
const usePostgres = !!process.env.POSTGRES_URL || !!process.env.DATABASE_URL || !!process.env.POSTGRES_URL_NON_POOLING;

const getDbClient = async () => {
  const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error("No database connection string found in environment variables.");
  }

  if (connectionString.startsWith("prisma://")) {
    throw new Error("CRITICAL: Your POSTGRES_URL is a Prisma Accelerate URL (prisma://). Vercel Postgres does NOT support Prisma URLs. Please go to Vercel Project Settings -> Storage -> Connect Database to get a standard postgres:// URL.");
  }

  console.log(`Connecting to DB (Type: ${connectionString.split(':')[0]})...`);

  const client = new Client({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false // Required for Vercel/Neon Postgres
    }
  });
  
  await client.connect();
  return client;
};

async function initDatabase() {
  if (usePostgres) {
    console.log("Using Vercel Postgres (@vercel/postgres)");
    try {
      const client = await getDbClient();
      // 1. Ensure basic table exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS transactions (
          id SERIAL PRIMARY KEY,
          type TEXT,
          asset TEXT,
          pair TEXT,
          amount DOUBLE PRECISION,
          price DOUBLE PRECISION,
          exchange_rate DOUBLE PRECISION,
          remaining_amount DOUBLE PRECISION,
          realized_profit_coin DOUBLE PRECISION DEFAULT 0,
          realized_profit_usdt DOUBLE PRECISION DEFAULT 0,
          from_asset TEXT,
          to_asset TEXT,
          from_amount DOUBLE PRECISION,
          to_amount DOUBLE PRECISION,
          asset_exchange_rate DOUBLE PRECISION,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 2. Migration: Add missing columns if they don't exist
      const migrations = [
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS from_asset TEXT",
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS to_asset TEXT",
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS from_amount DOUBLE PRECISION",
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS to_amount DOUBLE PRECISION",
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS asset_exchange_rate DOUBLE PRECISION",
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS realized_profit_coin DOUBLE PRECISION DEFAULT 0",
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS realized_profit_usdt DOUBLE PRECISION DEFAULT 0"
      ];

      for (const query of migrations) {
        try {
          await client.query(query);
        } catch (e) {
          // Ignore errors
        }
      }

      await client.end();
      console.log("Postgres table ensured and migrated");
    } catch (err) {
      console.error("Postgres init error:", err);
    }
  } else {
    console.warn("POSTGRES_URL is missing. Database will not be available in production.");
  }
}

const app = express();

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.use(express.json());

// Database diagnostics endpoint
app.get("/api/db-diagnostics", async (req, res) => {
  const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || process.env.DATABASE_URL;
  
  const diagnostics = {
    env: {
      POSTGRES_URL: !!process.env.POSTGRES_URL,
      POSTGRES_URL_NON_POOLING: !!process.env.POSTGRES_URL_NON_POOLING,
      DATABASE_URL: !!process.env.DATABASE_URL,
    },
    connection: {
      exists: !!connectionString,
      protocol: connectionString ? connectionString.split(':')[0] : null,
      isPrisma: connectionString ? connectionString.startsWith("prisma://") : false,
      maskedUrl: connectionString ? connectionString.replace(/:([^@]+)@/, ":****@").substring(0, 50) + "..." : null,
    },
    status: "unknown",
    error: null as string | null
  };

  if (!connectionString) {
    diagnostics.status = "error";
    diagnostics.error = "No connection string found";
    return res.json(diagnostics);
  }

  try {
    const client = await getDbClient();
    const result = await client.query("SELECT NOW() as now, version()");
    await client.end();
    diagnostics.status = "connected";
    (diagnostics as any).dbTime = result.rows[0].now;
    (diagnostics as any).dbVersion = result.rows[0].version;
  } catch (err: any) {
    diagnostics.status = "failed";
    diagnostics.error = err.message;
  }

  res.json(diagnostics);
});

// Ensure DB is initialized only for routes that need it
let dbInitialized = false;
const ensureDb = async (req: any, res: any, next: any) => {
  if (!dbInitialized && usePostgres) {
    try {
      await initDatabase();
      dbInitialized = true;
    } catch (err) {
      console.error("DB Init failed in middleware:", err);
    }
  }
  next();
};

// Price cache to handle quota issues
let priceCache: { data: any, timestamp: number } | null = null;
const CACHE_DURATION = 15000; // 15 seconds

// Helper to get env var regardless of common casing
const getEnv = (key: string) => process.env[key] || process.env[key.toLowerCase()] || process.env[key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()];

// API Routes
app.get("/api/debug/env", (req, res) => {
  const mask = (str: string | undefined) => str ? `${str.substring(0, 12)}...` : "missing";
  res.json({
    hasPostgresUrl: !!process.env.POSTGRES_URL,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasNonPoolingUrl: !!process.env.POSTGRES_URL_NON_POOLING,
    postgresUrl: mask(process.env.POSTGRES_URL),
    databaseUrl: mask(process.env.DATABASE_URL),
    nonPoolingUrl: mask(process.env.POSTGRES_URL_NON_POOLING),
    nodeEnv: process.env.NODE_ENV,
    usePostgres: usePostgres
  });
});

app.get("/api/prices", async (req, res) => {
    // Return cached data if valid (15s cache)
    if (priceCache && Date.now() - priceCache.timestamp < CACHE_DURATION) {
      return res.json(priceCache.data);
    }

    // Use a very short timeout for the live fetch to keep the UI responsive
    const fetchTimeout = 2500;

    try {
      // Helper to fetch from Binance (usually fastest)
      const fetchBinance = async () => {
        const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
        const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`;
        const response = await fetch(url, { signal: AbortSignal.timeout(fetchTimeout) });
        if (!response.ok) throw new Error("Binance failed");
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error("Invalid Binance data");
        return data;
      };

      // Helper to fetch from CoinGecko
      const fetchCoinGecko = async () => {
        const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true", { signal: AbortSignal.timeout(fetchTimeout) });
        if (!response.ok) throw new Error("CoinGecko failed");
        const data = await response.json();
        return [
          { symbol: "BTCUSDT", lastPrice: String(data.bitcoin.usd), priceChangePercent: String(data.bitcoin.usd_24h_change) },
          { symbol: "ETHUSDT", lastPrice: String(data.ethereum.usd), priceChangePercent: String(data.ethereum.usd_24h_change) },
          { symbol: "SOLUSDT", lastPrice: String(data.solana.usd), priceChangePercent: String(data.solana.usd_24h_change) }
        ];
      };

      // Try Binance first, then fallback to CoinGecko
      let priceData = null;
      try {
        priceData = await fetchBinance();
      } catch (e) {
        console.warn("Binance failed, trying CoinGecko...");
        try {
          priceData = await fetchCoinGecko();
        } catch (e2) {
          console.warn("CoinGecko failed too");
        }
      }

      if (priceData) {
        priceCache = { data: priceData, timestamp: Date.now() };
        return res.json(priceData);
      }

      // If all live fetches fail, return cache even if expired
      if (priceCache) {
        console.warn("All APIs failed, returning stale cache");
        return res.json(priceCache.data);
      }

      res.status(503).json({ error: "Price service temporarily unavailable" });
    } catch (error) {
      console.error("Price fetch error:", error);
      if (priceCache) return res.json(priceCache.data);
      res.status(500).json({ error: "Failed to fetch prices" });
    }
  });

  app.post("/api/admin/reset-db", ensureDb, async (req, res) => {
    try {
      if (usePostgres) {
        const client = await getDbClient();
        await client.query('DROP TABLE IF EXISTS transactions');
        await client.end();
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

  app.get("/api/transactions", ensureDb, async (req, res) => {
    try {
      let transactions = [];
      if (usePostgres) {
        const client = await getDbClient();
        const { rows } = await client.query('SELECT * FROM transactions ORDER BY timestamp DESC');
        transactions = rows;
        await client.end();
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
        realizedProfitCoin: t.realized_profit_coin,
        realizedProfitUSDT: t.realized_profit_usdt,
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

  app.post("/api/transactions", ensureDb, async (req, res) => {
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
            const client = await getDbClient();
            const { rows } = await client.query(
              'INSERT INTO transactions (type, asset, pair, amount, price, exchange_rate, remaining_amount) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
              [type, asset, pair, safeAmount, safePrice, safeExchangeRate, safeAmount]
            );
            await client.end();
            console.log("BUY transaction saved to Postgres, ID:", rows[0].id);
            return res.json({ id: rows[0].id });
          } else {
            return res.status(400).json({ error: "Database not available" });
          }
        }
  
        if (type === 'SELL') {
          const { selectedLots, realizedProfitCoin, realizedProfitUSDT } = req.body;
          
          const safeRealizedProfitCoin = parseFloat(realizedProfitCoin) || 0;
          const safeRealizedProfitUSDT = parseFloat(realizedProfitUSDT) || 0;
  
          if (selectedLots && Array.isArray(selectedLots) && selectedLots.length > 0) {
            for (const lotSelection of selectedLots) {
              let buy;
              if (usePostgres) {
                const client = await getDbClient();
                const { rows } = await client.query('SELECT * FROM transactions WHERE id = $1', [lotSelection.id]);
                buy = rows[0];
                await client.end();
              }
  
              if (!buy || buy.remaining_amount < lotSelection.amount) continue;
              
              if (usePostgres) {
                const client = await getDbClient();
                await client.query(
                  'UPDATE transactions SET remaining_amount = remaining_amount - $1 WHERE id = $2',
                  [lotSelection.amount, buy.id]
                );
                await client.end();
              }
            }
          } else {
            // FIFO Fallback
            let buys = [];
            if (usePostgres) {
              const client = await getDbClient();
              const { rows } = await client.query("SELECT * FROM transactions WHERE type = 'BUY' AND asset = $1 AND remaining_amount > 0 ORDER BY timestamp ASC", [asset]);
              buys = rows;
              await client.end();
            }
  
            let sellAmount = safeAmount;
            for (const buy of buys) {
              if (sellAmount <= 0) break;
              const consume = Math.min(sellAmount, buy.remaining_amount);
              
              if (usePostgres) {
                const client = await getDbClient();
                await client.query(
                  'UPDATE transactions SET remaining_amount = remaining_amount - $1 WHERE id = $2',
                  [consume, buy.id]
                );
                await client.end();
              }
              
              sellAmount -= consume;
            }
          }
  
          if (usePostgres) {
            const client = await getDbClient();
            const { rows } = await client.query(
              'INSERT INTO transactions (type, asset, pair, amount, price, exchange_rate, realized_profit_coin, realized_profit_usdt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
              [type, asset, pair, safeAmount, safePrice, safeExchangeRate, safeRealizedProfitCoin, safeRealizedProfitUSDT]
            );
            await client.end();
            console.log("SELL transaction saved to Postgres, ID:", rows[0].id);
            return res.json({ id: rows[0].id });
          } else {
            return res.status(400).json({ error: "Database not available" });
          }
        }
  
        if (type === 'EXCHANGE') {
          const { realizedProfitCoin, realizedProfitUSDT } = req.body;
          const safeRealizedProfitCoin = parseFloat(realizedProfitCoin) || 0;
          const safeRealizedProfitUSDT = parseFloat(realizedProfitUSDT) || 0;

          if (usePostgres) {
            const client = await getDbClient();
            const { rows } = await client.query(
              'INSERT INTO transactions (type, from_asset, to_asset, from_amount, to_amount, asset_exchange_rate, realized_profit_coin, realized_profit_usdt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
              [type, fromAsset, toAsset, safeFromAmount, safeToAmount, safeAssetExchangeRate, safeRealizedProfitCoin, safeRealizedProfitUSDT]
            );
            await client.end();
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

  app.delete("/api/transactions/:id", ensureDb, async (req, res) => {
    try {
      if (usePostgres) {
        const client = await getDbClient();
        await client.query('DELETE FROM transactions WHERE id = $1', [req.params.id]);
        await client.end();
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put("/api/transactions/:id", ensureDb, async (req, res) => {
    const { type, asset, pair, amount, price, exchangeRate, remainingAmount, realizedProfitCoin, realizedProfitUSDT, fromAsset, toAsset, fromAmount, toAmount, assetExchangeRate } = req.body;
    const id = req.params.id;

    try {
      if (usePostgres) {
        const client = await getDbClient();
        await client.query(
          `UPDATE transactions 
           SET type = $1, asset = $2, pair = $3, amount = $4, price = $5, 
               exchange_rate = $6, remaining_amount = $7, 
               realized_profit_coin = $8, realized_profit_usdt = $9, from_asset = $10, to_asset = $11,
               from_amount = $12, to_amount = $13, asset_exchange_rate = $14
           WHERE id = $15`,
          [type, asset, pair, amount, price, exchangeRate, remainingAmount, realizedProfitCoin, realizedProfitUSDT, fromAsset, toAsset, fromAmount, toAmount, assetExchangeRate, id]
        );
        await client.end();
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
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error("Vite setup error:", e);
    }
  };
  setupVite();
} else {
  // In production, serve static files from dist
  const distPath = path.resolve("dist");
  app.use(express.static(distPath));
  
  // SPA fallback - MUST be after API routes
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) {
      return res.status(404).json({ error: "API route not found" });
    }
    res.sendFile(path.join(distPath, "index.html"));
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

