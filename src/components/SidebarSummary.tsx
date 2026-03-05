import React from 'react';
import { Asset, PriceData, Transaction } from '../types';
import { Wallet, Activity } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  transactions: Transaction[];
  prices: PriceData[];
  usdtTwd: number;
}

export default function SidebarSummary({ transactions, prices, usdtTwd }: Props) {
  const calculateHoldings = () => {
    const holdings: Record<Asset, { amount: number; totalCostUSDT: number }> = {
      ETH: { amount: 0, totalCostUSDT: 0 },
      SOL: { amount: 0, totalCostUSDT: 0 },
      BTC: { amount: 0, totalCostUSDT: 0 },
    };

    transactions.forEach((tx) => {
      if (tx.type === 'BUY') {
        const rate = tx.exchangeRate || usdtTwd || 31.5;
        const costInUSDT = tx.pair === 'USDT' ? tx.price : tx.price / rate;
        const amount = tx.remainingAmount || 0;
        
        if (holdings[tx.asset]) {
          holdings[tx.asset].amount += amount;
          holdings[tx.asset].totalCostUSDT += amount * costInUSDT;
        }
      }
    });

    return holdings;
  };

  const holdings = calculateHoldings();

  const getPriceInfo = (asset: Asset) => {
    return prices.find((p) => p.symbol === `${asset}USDT`);
  };

  const totalValueUSDT = Object.entries(holdings).reduce((acc, [asset, data]) => {
    const price = parseFloat(getPriceInfo(asset as Asset)?.price || '0');
    return acc + data.amount * price;
  }, 0);

  const ethPrice = parseFloat(getPriceInfo('ETH')?.price || '0');
  const solPrice = parseFloat(getPriceInfo('SOL')?.price || '0');
  const solEthRate = ethPrice > 0 && solPrice > 0 ? (solPrice / ethPrice) : 0;

  return (
    <div className="space-y-4">
      {/* Total Value Card */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-white p-4 rounded-xl shadow-sm border border-black/5"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 bg-indigo-50 rounded-lg">
            <Wallet className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">總資產價值</p>
        </div>
        <h2 className="text-xl font-bold text-gray-900">
          ${totalValueUSDT.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          <span className="text-xs font-normal text-gray-400 ml-1">USDT</span>
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          ≈ {(totalValueUSDT * usdtTwd).toLocaleString(undefined, { maximumFractionDigits: 0 })} TWD
        </p>
      </motion.div>

      {/* Exchange Rates Card */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white p-4 rounded-xl shadow-sm border border-black/5"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-amber-50 rounded-lg">
            <Activity className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">即時匯率</p>
        </div>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-gray-500">USDT/TWD</span>
            <span className="text-sm font-bold text-gray-900">{usdtTwd.toFixed(2)}</span>
          </div>
          
          {solEthRate > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-gray-500">SOL/ETH</span>
              <span className="text-sm font-bold text-emerald-600">{solEthRate.toFixed(4)}</span>
            </div>
          )}

          <div className="h-px bg-gray-50 my-1" />

          {(['BTC', 'ETH', 'SOL'] as Asset[]).map((asset) => {
            const info = getPriceInfo(asset);
            const currentPrice = parseFloat(info?.price || '0');
            const change = parseFloat(info?.priceChangePercent || '0');

            return (
              <div key={asset} className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-gray-700">{asset}</span>
                  <span className={`text-[8px] font-bold px-1 rounded ${change >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {change >= 0 ? '+' : ''}{change}%
                  </span>
                </div>
                <span className="text-sm font-bold text-gray-900">
                  ${currentPrice > 0 ? currentPrice.toLocaleString() : '...'}
                </span>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
