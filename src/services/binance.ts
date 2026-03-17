import { PriceData } from "../types";

export async function fetchPrices(): Promise<PriceData[]> {
  try {
    const response = await fetch("/api/prices");
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server responded with ${response.status}: ${errorText}`);
    }
    const data = await response.json();
    
    // Binance returns 'lastPrice', we need to map it to 'price' for our PriceData interface
    return data.map((item: any) => ({
      symbol: item.symbol,
      price: item.lastPrice,
      priceChangePercent: item.priceChangePercent
    }));
  } catch (error) {
    console.error("fetchPrices error:", error);
    throw error;
  }
}
