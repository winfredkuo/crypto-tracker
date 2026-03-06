import { useState, useMemo } from 'react';
import { Transaction, PriceData } from '../types';
import { ArrowDownRight, Trash2, Edit2, TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'motion/react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface Props {
  transactions: Transaction[];
  prices: PriceData[];
  onDelete: (id: number) => void;
  onEdit: (tx: Transaction) => void;
  onQuickSell: (tx: Transaction) => void;
}

// Mock historical data for sparklines
const generateSparklineData = (currentPrice: number) => {
  const data = [];
  let price = currentPrice * 0.95;
  for (let i = 0; i < 20; i++) {
    price = price * (1 + (Math.random() * 0.02 - 0.01));
    data.push({ value: price });
  }
  data.push({ value: currentPrice });
  return data;
};

export default function Dashboard({ transactions, prices, onDelete, onEdit, onQuickSell }: Props) {
  const [selectedAsset, setSelectedAsset] = useState<string>('ALL');

  const assetStats = useMemo(() => {
    const stats: Record<string, { amount: number; price: number; change: number }> = {};
    
    // Get current prices
    prices.forEach(p => {
      const asset = p.symbol.replace('USDT', '');
      stats[asset] = {
        amount: 0,
        price: parseFloat(p.price),
        change: parseFloat(p.priceChangePercent)
      };
    });

    // Calculate holdings
    transactions.forEach(tx => {
      if (tx.type === 'BUY' && tx.asset && stats[tx.asset]) {
        stats[tx.asset].amount += (tx.remainingAmount || 0);
      } else if (tx.type === 'SELL' && tx.asset && stats[tx.asset]) {
        stats[tx.asset].amount -= (tx.amount || 0);
      } else if (tx.type === 'EXCHANGE') {
        if (tx.fromAsset && stats[tx.fromAsset]) stats[tx.fromAsset].amount -= (tx.fromAmount || 0);
        if (tx.toAsset && stats[tx.toAsset]) stats[tx.toAsset].amount += (tx.toAmount || 0);
      }
    });

    return stats;
  }, [transactions, prices]);

  const assets = useMemo(() => {
    const assetSet = new Set<string>();
    transactions.forEach(tx => {
      if (tx.type !== 'EXCHANGE' && tx.asset) {
        assetSet.add(tx.asset);
      }
    });
    return Array.from(assetSet).sort();
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const reversed = [...transactions].filter(tx => tx.type !== 'EXCHANGE').reverse();
    if (selectedAsset === 'ALL') return reversed;
    return reversed.filter(tx => 
      tx.asset === selectedAsset
    );
  }, [transactions, selectedAsset]);

  return (
    <div className="space-y-6">
      {/* Asset Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(assetStats).map(([asset, stat]) => (
          <motion.div
            key={asset}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-4 rounded-2xl border border-black/5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{asset} / USDT</span>
                <h4 className="text-xl font-bold text-gray-900">${stat.price.toLocaleString()}</h4>
              </div>
              <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                stat.change >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
              }`}>
                {stat.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(stat.change).toFixed(2)}%
              </div>
            </div>
            
            <div className="h-12 w-full mb-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={generateSparklineData(stat.price)}>
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke={stat.change >= 0 ? '#10b981' : '#f43f5e'} 
                    strokeWidth={2} 
                    dot={false} 
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="flex justify-between items-end">
              <div className="text-[10px] text-gray-400 font-medium">
                持有數量: <span className="text-gray-900">{stat.amount.toFixed(4)}</span>
              </div>
              <div className="text-[10px] text-gray-400 font-medium">
                價值: <span className="text-gray-900">${(stat.amount * stat.price).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Detailed Transaction List on Dashboard */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden flex flex-col"
      >
        <div className="p-3 border-b border-black/5 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50/50 gap-3">
          <div className="flex items-center gap-3">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-tight">交易明細紀錄</h3>
            <span className="text-[9px] font-bold text-gray-400 uppercase">共 {transactions.length} 筆</span>
          </div>
          
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedAsset('ALL')}
              className={`px-2 py-1 rounded-md text-[9px] font-bold transition-colors ${
                selectedAsset === 'ALL' 
                  ? 'bg-black text-white' 
                  : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              全部
            </button>
            {assets.map(asset => (
              <button
                key={asset}
                onClick={() => setSelectedAsset(asset)}
                className={`px-2 py-1 rounded-md text-[9px] font-bold transition-colors ${
                  selectedAsset === asset 
                    ? 'bg-black text-white' 
                    : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {asset}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white z-10 shadow-sm">
              <tr className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                <th className="px-3 py-3">時間</th>
                <th className="px-3 py-3">類型</th>
                <th className="px-3 py-3">資產</th>
                <th className="px-3 py-2">數量</th>
                <th className="px-3 py-2">價格</th>
                <th className="px-3 py-2">總額</th>
                <th className="px-3 py-2">剩餘</th>
                <th className="px-3 py-2">盈虧</th>
                <th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredTransactions.map((tx) => {
                const isTWD = tx.pair === 'TWD';

                return (
                  <tr key={tx.id} className="hover:bg-gray-50/80 transition-colors group">
                    <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(tx.timestamp).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                        tx.type === 'BUY' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {tx.type === 'BUY' ? '買入' : '賣出'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs font-bold text-gray-700">
                      {tx.asset}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-600 font-medium">{tx.amount}</td>
                    <td className="px-3 py-3 text-xs text-gray-600">
                      <span className="font-medium">${(tx.price || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                      <span className="text-[10px] text-gray-400 ml-0.5 font-normal">USDT</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-700">
                          {isTWD 
                            ? `${(tx.originalCost || ((tx.amount || 0) * (tx.price || 0) * (tx.exchangeRate || 31.5))).toLocaleString(undefined, { maximumFractionDigits: 0 })} TWD` 
                            : `${(tx.originalCost || ((tx.amount || 0) * (tx.price || 0))).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT`
                          }
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {isTWD 
                            ? `≈ ${((tx.amount || 0) * (tx.price || 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT` 
                            : `≈ ${((tx.amount || 0) * (tx.price || 0) * (tx.exchangeRate || 31.5)).toLocaleString(undefined, { maximumFractionDigits: 0 })} TWD`
                          }
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs font-medium text-emerald-600">
                      {tx.type === 'BUY' ? tx.remainingAmount?.toFixed(4) : '-'}
                    </td>
                    <td className={`px-3 py-3 text-xs font-bold ${(tx.realizedProfit || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {tx.realizedProfit !== 0 && tx.realizedProfit !== null && tx.realizedProfit !== undefined ? `${tx.realizedProfit >= 0 ? '+' : ''}${tx.realizedProfit.toFixed(1)}` : '-'}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {tx.type === 'BUY' && (tx.remainingAmount || 0) > 0 && (
                          <button 
                            onClick={() => onQuickSell(tx)}
                            className="text-emerald-500 hover:text-emerald-600 transition-colors p-1 hover:bg-emerald-50 rounded"
                            title="快速賣出"
                          >
                            <ArrowDownRight className="w-4 h-4" />
                          </button>
                        )}
                        <button 
                          onClick={() => onEdit(tx)}
                          className="text-gray-400 hover:text-indigo-500 transition-colors p-1 hover:bg-indigo-50 rounded"
                          title="修改"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => onDelete(tx.id)}
                          className="text-gray-400 hover:text-rose-500 transition-colors p-1 hover:bg-rose-50 rounded"
                          title="刪除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-center text-gray-400 text-xs italic">
                    尚無交易紀錄
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
