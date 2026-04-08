export type TransactionType = 'BUY' | 'SELL' | 'EXCHANGE';
export type Asset = 'ETH' | 'SOL' | 'BTC';
export type Pair = 'TWD' | 'USDT';

export interface Transaction {
  id: number;
  type: TransactionType;
  asset?: Asset; // Optional for EXCHANGE
  pair?: Pair; // Optional for EXCHANGE
  amount?: number; // Optional for EXCHANGE
  price?: number; // Optional for EXCHANGE
  exchangeRate?: number; // TWD per USDT at time of transaction
  originalCost?: number; // The exact amount entered by user in the pair currency
  remainingAmount?: number; // For BUY lots
  realizedProfitCoin?: number; // 幣本位盈虧
  realizedProfitUSDT?: number; // U本位盈虧
  timestamp: string;
  note?: string;
  fee?: number;
  // For EXCHANGE
  fromAsset?: Asset;
  toAsset?: Asset;
  fromAmount?: number;
  toAmount?: number;
  assetExchangeRate?: number; // e.g., ETH/SOL rate
}

export interface PriceData {
  symbol: string;
  price: string;
  priceChangePercent: string;
}

export interface Holding {
  asset: Asset;
  amount: number;
  avgCostUSDT: number;
  avgCostTWD: number;
}
