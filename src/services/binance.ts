import { PriceData } from "../types";

export async function fetchPrices(): Promise<PriceData[]> {
  const response = await fetch("/api/prices");
  if (!response.ok) throw new Error("Failed to fetch prices");
  const data = await response.json();
  
  // Binance returns 'lastPrice', we need to map it to 'price' for our PriceData interface
  return data.map((item: any) => ({
    symbol: item.symbol,
    price: item.lastPrice,
    priceChangePercent: item.priceChangePercent
  }));
}

// Simple USDT/TWD rate fetcher (using our backend proxy)
export async function fetchUSDTTWD(): Promise<number> {
  try {
    const res = await fetch("/api/exchange-rate");
    const data = await res.json();
    return data.rates.TWD || 31.5; // Fallback to 31.5
  } catch {
    return 31.5;
  }
}
