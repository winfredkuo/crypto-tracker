import { useMemo } from 'react';
import { Transaction } from '../types';
import { ArrowRightLeft, Trash2, Edit2 } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  transactions: Transaction[];
  onDelete: (id: number) => void;
  onEdit: (tx: Transaction) => void;
}

export default function ExchangeHistory({ transactions, onDelete, onEdit }: Props) {
  const exchangeTransactions = useMemo(() => {
    return transactions.filter(tx => tx.type === 'EXCHANGE').sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [transactions]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5 text-emerald-500" />
          資產兌換紀錄
        </h2>
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          共 {exchangeTransactions.length} 筆
        </span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-3">時間</th>
                <th className="px-4 py-3">兌換對</th>
                <th className="px-4 py-3 text-right">賣出數量</th>
                <th className="px-4 py-3 text-center"></th>
                <th className="px-4 py-3 text-left">換得數量</th>
                <th className="px-4 py-3 text-right">匯率</th>
                <th className="px-4 py-3 text-right">盈虧</th>
                <th className="px-4 py-3 text-left">備註</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {exchangeTransactions.map((tx) => (
                <motion.tr 
                  key={tx.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-gray-50/80 transition-colors group"
                >
                  <td className="px-4 py-4 text-sm text-gray-500 whitespace-nowrap">
                    {new Date(tx.timestamp).toLocaleString(undefined, { 
                      month: 'numeric', 
                      day: 'numeric', 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-gray-700">{tx.fromAsset}</span>
                      <ArrowRightLeft className="w-3 h-3 text-gray-300" />
                      <span className="text-sm font-bold text-gray-700">{tx.toAsset}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <span className="text-sm font-medium text-rose-600">-{tx.fromAmount}</span>
                    <span className="text-xs text-gray-400 ml-1">{tx.fromAsset}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
                      <ArrowRightLeft className="w-4 h-4 text-gray-400" />
                    </div>
                  </td>
                  <td className="px-4 py-4 text-left">
                    <span className="text-sm font-medium text-emerald-600">+{tx.toAmount}</span>
                    <span className="text-xs text-gray-400 ml-1">{tx.toAsset}</span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-bold text-gray-700">
                        {((tx.fromAsset === 'ETH' && tx.toAsset === 'SOL') || (tx.fromAsset === 'SOL' && tx.toAsset === 'ETH'))
                          ? (1 / (tx.assetExchangeRate || 1)).toFixed(6).replace(/\.?0+$/, '')
                          : tx.assetExchangeRate?.toFixed(6).replace(/\.?0+$/, '')}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {(tx.fromAsset === 'ETH' && tx.toAsset === 'SOL') || (tx.fromAsset === 'SOL' && tx.toAsset === 'ETH') 
                          ? 'SOL/ETH' 
                          : `${tx.fromAsset}/${tx.toAsset}`}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col items-end gap-1">
                      {tx.realizedProfitUSDT !== undefined && tx.realizedProfitUSDT !== null && (
                        <span className={`text-xs font-bold font-mono ${tx.realizedProfitUSDT >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {tx.realizedProfitUSDT >= 0 ? '+' : ''}{tx.realizedProfitUSDT.toFixed(2)} U
                        </span>
                      )}
                      {tx.realizedProfitCoin !== undefined && tx.realizedProfitCoin !== null && (
                        <span className={`text-[10px] font-bold font-mono ${tx.realizedProfitCoin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {tx.realizedProfitCoin >= 0 ? '+' : ''}{tx.realizedProfitCoin.toFixed(4)} 幣
                        </span>
                      )}
                      {tx.realizedProfitUSDT === undefined && tx.realizedProfitCoin === undefined && <span className="text-gray-400">-</span>}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-[10px] text-gray-400 max-w-[120px] truncate">
                    {tx.note || '-'}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => onEdit(tx)}
                        className="text-gray-400 hover:text-indigo-500 transition-colors p-1.5 hover:bg-indigo-50 rounded-lg"
                        title="修改"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => onDelete(tx.id)}
                        className="text-gray-400 hover:text-rose-500 transition-colors p-1.5 hover:bg-rose-50 rounded-lg"
                        title="刪除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
              {exchangeTransactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400 text-sm italic">
                    尚無兌換紀錄
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
