import { useState, useMemo } from 'react';
import { Transaction, PriceData, Asset, Pair } from '../types';
import { ArrowDownRight, Trash2, Edit2, Activity, TrendingUp, TrendingDown, DollarSign, Package } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  transactions: Transaction[];
  prices: PriceData[];
  onDelete: (id: number) => void;
  onEdit: (tx: Transaction) => void;
  onQuickSell: (tx: Transaction) => void;
}

export default function Dashboard({ transactions, prices, onDelete, onEdit, onQuickSell }: Props) {
  const [selectedAsset, setSelectedAsset] = useState<Asset | 'ALL'>('ALL');

  const assets = useMemo(() => {
    const assetSet = new Set<Asset>();
    transactions.forEach(tx => {
      if (tx.asset) assetSet.add(tx.asset);
      if (tx.fromAsset) assetSet.add(tx.fromAsset);
      if (tx.toAsset) assetSet.add(tx.toAsset);
    });
    return Array.from(assetSet).sort();
  }, [transactions]);

  const stats = useMemo(() => {
    const result: Record<string, any> = {};
    
    assets.forEach(asset => {
      ['USDT', 'TWD'].forEach(pair => {
        const key = `${asset}-${pair}`;
        const assetLots = transactions.filter(tx => tx.type === 'BUY' && tx.asset === asset && tx.pair === pair);
        
        if (assetLots.length === 0) return;

        let totalHolding = 0;
        let totalCost = 0;
        let totalRecovered = 0;
        let totalRealizedPnL = 0;

        assetLots.forEach(lot => {
          const lotCost = (lot.amount || 0) * (lot.price || 0) + (lot.fee || 0);
          const lotSells = transactions.filter(tx => 
            (tx.type === 'SELL' && tx.asset === asset && tx.pair === pair) ||
            (tx.type === 'EXCHANGE' && tx.fromAsset === asset)
          ).filter(tx => {
            // This is a bit tricky since we don't have a direct link in the transaction object 
            // but server handles remaining_amount. For stats, we can use the lot's history if we had it.
            // Since we don't have a join table here, we'll approximate or rely on remainingAmount.
            return false; // We'll calculate per lot below
          });

          totalHolding += (lot.remainingAmount || 0);
          totalCost += lotCost;
        });

        // Better way: iterate all transactions once
        let holding = 0;
        let cost = 0;
        let recovered = 0;
        let realizedPnL = 0;

        transactions.forEach(tx => {
          if (tx.asset === asset && tx.pair === pair) {
            if (tx.type === 'BUY') {
              holding += (tx.amount || 0);
              cost += (tx.amount || 0) * (tx.price || 0) + (tx.fee || 0);
            } else if (tx.type === 'SELL') {
              holding -= (tx.amount || 0);
              recovered += (tx.amount || 0) * (tx.price || 0) - (tx.fee || 0);
              realizedPnL += (tx.realizedProfitUSDT || 0);
            }
          }
          if (tx.type === 'EXCHANGE') {
            if (tx.fromAsset === asset) {
              // For exchange, we don't have a 'pair' in the same way, 
              // but we can track realized profit if it was provided.
              holding -= (tx.fromAmount || 0);
              realizedPnL += (tx.realizedProfitUSDT || 0);
            }
            if (tx.toAsset === asset) {
              holding += (tx.toAmount || 0);
            }
          }
        });

        result[key] = { holding, cost, recovered, realizedPnL };
      });
    });

    return result;
  }, [transactions, assets]);

  const activeLots = useMemo(() => {
    return transactions
      .filter(tx => tx.type === 'BUY' && (tx.remainingAmount || 0) > 0.000001)
      .filter(tx => selectedAsset === 'ALL' || tx.asset === selectedAsset)
      .map(lot => {
        // Approximate recovered for this lot
        // Since we don't have a direct link, we can't be 100% sure without a join table
        // But we can show the "Sold" amount which is (amount - remainingAmount)
        const sold = (lot.amount || 0) - (lot.remainingAmount || 0);
        return { ...lot, sold };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [transactions, selectedAsset]);

  const sellHistory = useMemo(() => {
    return transactions
      .filter(tx => tx.type === 'SELL' || tx.type === 'EXCHANGE')
      .filter(tx => {
        if (selectedAsset === 'ALL') return true;
        if (tx.type === 'SELL') return tx.asset === selectedAsset;
        return tx.fromAsset === selectedAsset || tx.toAsset === selectedAsset;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [transactions, selectedAsset]);

  return (
    <div className="space-y-8 pb-20">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {assets.filter(a => selectedAsset === 'ALL' || a === selectedAsset).map(asset => {
          const usdtStats = stats[`${asset}-USDT`];
          const twdStats = stats[`${asset}-TWD`];
          
          if (!usdtStats && !twdStats) return null;

          const currentPrice = parseFloat(prices.find(p => p.symbol === `${asset}USDT`)?.price || '0');

          return (
            <motion.div 
              key={asset}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                    asset === 'ETH' ? 'bg-indigo-100 text-indigo-600' : 
                    asset === 'SOL' ? 'bg-teal-100 text-teal-600' : 
                    'bg-orange-100 text-orange-600'
                  }`}>
                    {asset[0]}
                  </div>
                  <span className="font-bold text-gray-800">{asset}</span>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 uppercase font-bold">當前價格</p>
                  <p className="text-sm font-mono font-bold text-gray-700">${currentPrice.toLocaleString()}</p>
                </div>
              </div>

              <div className="pt-2">
                <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">當前持倉</p>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-3xl font-mono font-bold text-gray-900">
                    {( (usdtStats?.holding || 0) + (twdStats?.holding || 0) ).toFixed(4)}
                  </h2>
                  <span className="text-sm text-gray-500 font-medium">{asset}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">已實現盈虧</p>
                  <p className={`text-sm font-bold font-mono ${((usdtStats?.realizedPnL || 0) + (twdStats?.realizedPnL || 0)) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {((usdtStats?.realizedPnL || 0) + (twdStats?.realizedPnL || 0)) >= 0 ? '+' : ''}
                    {((usdtStats?.realizedPnL || 0) + (twdStats?.realizedPnL || 0)).toFixed(2)} U
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 uppercase font-bold">持倉價值</p>
                  <p className="text-sm font-bold font-mono text-gray-700">
                    ≈ ${(((usdtStats?.holding || 0) + (twdStats?.holding || 0)) * currentPrice).toFixed(2)} U
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Tabs / Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedAsset('ALL')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            selectedAsset === 'ALL' ? 'bg-black text-white shadow-lg' : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'
          }`}
        >
          全部資產
        </button>
        {assets.map(asset => (
          <button
            key={asset}
            onClick={() => setSelectedAsset(asset)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              selectedAsset === asset ? 'bg-black text-white shadow-lg' : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'
            }`}
          >
            {asset}
          </button>
        ))}
      </div>

      {/* Active Lots Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <Package className="w-4 h-4 text-indigo-500" />
            持倉批次 (Active Lots)
          </h3>
          <span className="text-[10px] font-bold text-gray-400 uppercase">共 {activeLots.length} 筆</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-4 py-3">日期</th>
                  <th className="px-4 py-3">資產</th>
                  <th className="px-4 py-3">買入量</th>
                  <th className="px-4 py-3">單價</th>
                  <th className="px-4 py-3">剩餘持倉</th>
                  <th className="px-4 py-3">底倉成本</th>
                  <th className="px-4 py-3">狀態</th>
                  <th className="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {activeLots.map(lot => {
                  const cost = (lot.amount || 0) * (lot.price || 0) + (lot.fee || 0);
                  const sold = lot.sold || 0;
                  const recovered = 0; // We need to track this per lot in DB ideally
                  const rem = lot.remainingAmount || 0;
                  const holdCost = rem > 0 ? (cost * (rem / (lot.amount || 1))) - recovered : 0;
                  const isZeroCost = holdCost <= 0 && sold > 0;

                  return (
                    <tr key={lot.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-4 py-4 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(lot.timestamp).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          lot.asset === 'ETH' ? 'bg-indigo-50 text-indigo-600' : 
                          lot.asset === 'SOL' ? 'bg-teal-50 text-teal-600' : 
                          'bg-orange-50 text-orange-600'
                        }`}>
                          {lot.asset}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs font-mono text-gray-600">{lot.amount?.toFixed(4)}</td>
                      <td className="px-4 py-4 text-xs font-mono text-gray-600">
                        ${lot.price?.toLocaleString()} <span className="text-[9px] text-gray-400">{lot.pair}</span>
                      </td>
                      <td className="px-4 py-4 text-xs font-mono font-bold text-gray-900">{rem.toFixed(4)}</td>
                      <td className="px-4 py-4">
                        {isZeroCost ? (
                          <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full flex items-center gap-1 w-fit">
                            ✓ 零成本底倉
                          </span>
                        ) : (
                          <span className="text-xs font-mono text-gray-600">${holdCost.toFixed(2)} <span className="text-[9px] text-gray-400">{lot.pair}</span></span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          sold > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                        }`}>
                          {sold > 0 ? '部分賣出' : '持倉中'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => onQuickSell(lot)} className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"><ArrowDownRight className="w-4 h-4" /></button>
                          <button onClick={() => onEdit(lot)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => onDelete(lot.id)} className="p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-500 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {activeLots.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400 text-xs italic">尚無持倉批次</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Sell History Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <Activity className="w-4 h-4 text-rose-500" />
            賣出紀錄 (Sell History)
          </h3>
          <span className="text-[10px] font-bold text-gray-400 uppercase">共 {sellHistory.length} 筆</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-4 py-3">日期</th>
                  <th className="px-4 py-3">類型</th>
                  <th className="px-4 py-3">資產</th>
                  <th className="px-4 py-3">數量</th>
                  <th className="px-4 py-3">價格</th>
                  <th className="px-4 py-3">損益</th>
                  <th className="px-4 py-3">備註</th>
                  <th className="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sellHistory.map(tx => (
                  <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-4 py-4 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(tx.timestamp).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        tx.type === 'SELL' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
                      }`}>
                        {tx.type === 'SELL' ? '賣出' : '兌換'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs font-bold text-gray-700">
                        {tx.type === 'SELL' ? tx.asset : `${tx.fromAsset} → ${tx.toAsset}`}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-xs font-mono text-gray-600">
                      {tx.type === 'SELL' ? tx.amount?.toFixed(4) : tx.fromAmount?.toFixed(4)}
                    </td>
                    <td className="px-4 py-4 text-xs font-mono text-gray-600">
                      {tx.type === 'SELL' ? `$${tx.price?.toLocaleString()}` : `${tx.assetExchangeRate?.toFixed(4)}`}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-0.5">
                        {tx.realizedProfitUSDT !== undefined && (
                          <span className={`text-xs font-bold font-mono ${tx.realizedProfitUSDT >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {tx.realizedProfitUSDT >= 0 ? '+' : ''}{tx.realizedProfitUSDT.toFixed(2)} U
                          </span>
                        )}
                        {tx.realizedProfitCoin !== undefined && (
                          <span className={`text-[10px] font-bold font-mono ${tx.realizedProfitCoin >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {tx.realizedProfitCoin >= 0 ? '+' : ''}{tx.realizedProfitCoin.toFixed(4)} 幣
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-[10px] text-gray-400 max-w-[120px] truncate">
                      {tx.note || '-'}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => onEdit(tx)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => onDelete(tx.id)} className="p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-500 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {sellHistory.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400 text-xs italic">尚無賣出紀錄</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
