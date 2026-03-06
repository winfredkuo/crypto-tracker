import React, { useState, useEffect } from 'react';
import { Asset, Pair, Transaction, TransactionType } from '../types';
import { PlusCircle, ArrowRightLeft, CheckSquare, Square } from 'lucide-react';

interface Props {
  onAdd: (tx: any) => void;
  onUpdate?: (id: number, tx: any) => void;
  currentExchangeRate: number;
  transactions: Transaction[];
  editData?: Transaction | null;
  templateData?: Partial<Transaction> | null;
  onCancelEdit?: () => void;
}

export default function TransactionForm({ onAdd, onUpdate, currentExchangeRate, transactions, editData, templateData, onCancelEdit }: Props) {
  const [type, setType] = useState<TransactionType>('BUY');
  const [asset, setAsset] = useState<Asset>('ETH');
  const [pair, setPair] = useState<Pair>('USDT');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [exchangeRate, setExchangeRate] = useState((currentExchangeRate || 31.5).toString());

  // For EXCHANGE
  const [fromAsset, setFromAsset] = useState<Asset>('ETH');
  const [toAsset, setToAsset] = useState<Asset>('SOL');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [assetExchangeRate, setAssetExchangeRate] = useState('');

  // For Manual Lot Selection
  const [selectedLots, setSelectedLots] = useState<Record<number, number>>({});
  const [isManualSelection, setIsManualSelection] = useState(false);

  useEffect(() => {
    if (editData) {
      setType(editData.type);
      setAsset(editData.asset || 'ETH');
      setPair(editData.pair || 'USDT');
      setAmount((editData.amount ?? '').toString());
      setPrice((editData.price ?? '').toString());
      setTotalCost(((editData.amount || 0) * (editData.price || 0)).toString());
      setExchangeRate((editData.exchangeRate ?? currentExchangeRate ?? 31.5).toString());
      if (editData.type === 'EXCHANGE') {
        setFromAsset(editData.fromAsset || 'ETH');
        setToAsset(editData.toAsset || 'SOL');
        setFromAmount((editData.fromAmount ?? '').toString());
        setToAmount((editData.toAmount ?? '').toString());
        setAssetExchangeRate((editData.assetExchangeRate ?? '').toString());
      }
    } else if (templateData) {
      if (templateData.type) setType(templateData.type);
      if (templateData.asset) setAsset(templateData.asset);
      if (templateData.amount !== undefined && templateData.amount !== null) setAmount(templateData.amount.toString());
      if (templateData.price !== undefined && templateData.price !== null) {
        setPrice(templateData.price.toString());
        if (templateData.amount !== undefined && templateData.amount !== null) {
          setTotalCost((templateData.amount * templateData.price).toString());
        }
      }
      if (templateData.id) {
        setIsManualSelection(true);
        setSelectedLots({ [templateData.id]: templateData.amount || 0 });
      }
    } else {
      setExchangeRate((currentExchangeRate || 31.5).toString());
    }
  }, [editData, templateData, currentExchangeRate]);

  // Auto-calculate logic
  const handleAmountChange = (val: string) => {
    setAmount(val);
    const a = parseFloat(val);
    const p = parseFloat(price);
    const t = parseFloat(totalCost);
    const rate = parseFloat(exchangeRate);

    if (a > 0) {
      if (p > 0) {
        // Update total cost based on price
        const totalUSDT = a * p;
        const totalDisplay = pair === 'TWD' ? totalUSDT * rate : totalUSDT;
        setTotalCost(totalDisplay.toFixed(2).replace(/\.?0+$/, ''));
      } else if (t > 0) {
        // Update price based on total cost
        const totalUSDT = pair === 'TWD' ? t / rate : t;
        const calculatedPrice = totalUSDT / a;
        setPrice(calculatedPrice.toFixed(8).replace(/\.?0+$/, ''));
      }
    }
  };

  const handleTotalCostChange = (val: string) => {
    setTotalCost(val);
    const t = parseFloat(val);
    const a = parseFloat(amount);
    const rate = parseFloat(exchangeRate);

    if (t > 0 && a > 0 && rate > 0) {
      const totalUSDT = pair === 'TWD' ? t / rate : t;
      const calculatedPrice = totalUSDT / a;
      setPrice(calculatedPrice.toFixed(8).replace(/\.?0+$/, ''));
    }
  };

  const handlePriceChange = (val: string) => {
    setPrice(val);
    const p = parseFloat(val); // Price in USDT
    const a = parseFloat(amount);
    const rate = parseFloat(exchangeRate);
    if (p > 0 && a > 0 && rate > 0) {
      const totalUSDT = p * a;
      const totalDisplay = pair === 'TWD' ? totalUSDT * rate : totalUSDT;
      setTotalCost(totalDisplay.toFixed(2).replace(/\.?0+$/, ''));
    }
  };

  const handleExchangeRateChange = (val: string) => {
    setExchangeRate(val);
    const rate = parseFloat(val);
    const t = parseFloat(totalCost);
    const a = parseFloat(amount);
    const p = parseFloat(price);

    if (rate > 0 && pair === 'TWD') {
      if (a > 0 && t > 0) {
        // Update price based on TWD total and new rate
        const totalUSDT = t / rate;
        const calculatedPrice = totalUSDT / a;
        setPrice(calculatedPrice.toFixed(8).replace(/\.?0+$/, ''));
      } else if (a > 0 && p > 0) {
        // Update total cost based on price and new rate
        const totalUSDT = a * p;
        setTotalCost((totalUSDT * rate).toFixed(2).replace(/\.?0+$/, ''));
      }
    }
  };

  const handlePairChange = (newPair: Pair) => {
    setPair(newPair);
    const t = parseFloat(totalCost);
    const p = parseFloat(price);
    const a = parseFloat(amount);
    const rate = parseFloat(exchangeRate);

    if (t > 0 && rate > 0) {
      if (newPair === 'TWD') {
        // Was USDT, now TWD
        setTotalCost((t * rate).toFixed(2).replace(/\.?0+$/, ''));
      } else {
        // Was TWD, now USDT
        setTotalCost((t / rate).toFixed(2).replace(/\.?0+$/, ''));
      }
    } else if (p > 0 && a > 0 && rate > 0) {
      // Recalculate total cost from price and amount
      const totalUSDT = p * a;
      const totalDisplay = newPair === 'TWD' ? totalUSDT * rate : totalUSDT;
      setTotalCost(totalDisplay.toFixed(2).replace(/\.?0+$/, ''));
    }
  };

  // Auto-calculate asset exchange rate (Price of ETH in SOL if ETH/SOL pair)
  useEffect(() => {
    const from = parseFloat(fromAmount);
    const to = parseFloat(toAmount);
    if (from > 0 && to > 0) {
      let rate = 0;
      if (fromAsset === 'ETH' && toAsset === 'SOL') {
        rate = to / from; // SOL per ETH
      } else if (fromAsset === 'SOL' && toAsset === 'ETH') {
        rate = from / to; // SOL per ETH
      } else {
        rate = to / from; // Default: Price of FromAsset in ToAsset
      }
      setAssetExchangeRate(rate.toFixed(6).replace(/\.?0+$/, ''));
    }
  }, [fromAmount, toAmount, fromAsset, toAsset]);

  // Reset selected lots when asset or type changes
  useEffect(() => {
    setSelectedLots({});
  }, [asset, fromAsset, type]);

  const availableLots = transactions.filter(tx => 
    tx.type === 'BUY' && 
    (tx.remainingAmount || 0) > 0 && 
    tx.asset === (type === 'EXCHANGE' ? fromAsset : asset)
  ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const toggleLot = (lotId: number, maxAmount: number) => {
    setSelectedLots(prev => {
      const next = { ...prev };
      if (next[lotId] !== undefined) {
        delete next[lotId];
      } else {
        next[lotId] = maxAmount;
      }
      return next;
    });
  };

  const updateLotAmount = (lotId: number, val: string, maxAmount: number) => {
    const num = parseFloat(val);
    if (isNaN(num)) return;
    setSelectedLots(prev => ({
      ...prev,
      [lotId]: Math.min(num, maxAmount)
    }));
  };

  const totalSelectedAmount: number = (Object.values(selectedLots) as number[]).reduce((acc: number, curr: number) => acc + curr, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const lotData = isManualSelection ? Object.entries(selectedLots).map(([id, amt]) => ({
      id: parseInt(id),
      amount: amt
    })) : null;

    if (type === 'EXCHANGE') {
      if (!fromAmount || !toAmount) return;
      let rate = parseFloat(assetExchangeRate);
      if (!rate) {
        if (fromAsset === 'ETH' && toAsset === 'SOL') {
          rate = parseFloat(toAmount) / parseFloat(fromAmount);
        } else if (fromAsset === 'SOL' && toAsset === 'ETH') {
          rate = parseFloat(fromAmount) / parseFloat(toAmount);
        } else {
          rate = parseFloat(toAmount) / parseFloat(fromAmount);
        }
      }
      const data = {
        type,
        fromAsset,
        toAsset,
        fromAmount: parseFloat(fromAmount),
        toAmount: parseFloat(toAmount),
        assetExchangeRate: rate,
      };
      if (editData && onUpdate) {
        onUpdate(editData.id, data);
      } else {
        onAdd(data);
      }
    } else {
      const finalAmount = (type === 'SELL' && isManualSelection) ? totalSelectedAmount : parseFloat(amount);
      if (!finalAmount || !price) return;
      const data = {
        type,
        asset,
        pair,
        amount: finalAmount,
        price: parseFloat(price),
        exchangeRate: parseFloat(exchangeRate),
        originalCost: parseFloat(totalCost) || (finalAmount * parseFloat(price)),
        selectedLots: lotData,
        remainingAmount: editData ? editData.remainingAmount : (type === 'BUY' ? finalAmount : undefined),
        realizedProfit: editData ? editData.realizedProfit : undefined
      };
      if (editData && onUpdate) {
        onUpdate(editData.id, data);
      } else {
        onAdd(data);
      }
    }
    if (!editData) {
      setAmount('');
      setPrice('');
      setTotalCost('');
      setFromAmount('');
      setToAmount('');
      setAssetExchangeRate('');
      setSelectedLots({});
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">類型</label>
          <select 
            value={type} 
            onChange={(e) => setType(e.target.value as TransactionType)}
            className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value="BUY">買入</option>
            <option value="SELL">賣出</option>
            <option value="EXCHANGE">資產兌換</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">匯率 (USDT/TWD)</label>
          <input 
            type="number" 
            step="any"
            value={exchangeRate}
            onChange={(e) => handleExchangeRateChange(e.target.value)}
            className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>
      </div>

      {(type === 'SELL' || type === 'EXCHANGE') && (
        <div className="flex items-center gap-2 mb-2">
          <button
            type="button"
            onClick={() => setIsManualSelection(!isManualSelection)}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-emerald-600 transition-colors"
          >
            {isManualSelection ? <CheckSquare className="w-4 h-4 text-emerald-500" /> : <Square className="w-4 h-4" />}
            手動選擇賣出批次
          </button>
        </div>
      )}

      {isManualSelection && (type === 'SELL' || type === 'EXCHANGE') && (
        <div className="space-y-2 max-h-48 overflow-y-auto p-3 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">可選批次 (FIFO 排序)</p>
          {availableLots.map(lot => (
            <div key={lot.id} className="flex items-center gap-3 p-2 bg-white rounded-lg border border-gray-100 shadow-sm">
              <button
                type="button"
                onClick={() => toggleLot(lot.id, lot.remainingAmount)}
                className={`p-1 rounded ${selectedLots[lot.id] !== undefined ? 'text-emerald-500' : 'text-gray-300'}`}
              >
                {selectedLots[lot.id] !== undefined ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">{new Date(lot.timestamp).toLocaleDateString()} @ ${lot.price}</p>
                <p className="text-[10px] text-gray-400">剩餘: {(lot.remainingAmount ?? 0).toFixed(4)}</p>
              </div>
              {selectedLots[lot.id] !== undefined && (
                <input
                  type="number"
                  step="any"
                  value={selectedLots[lot.id]}
                  onChange={(e) => updateLotAmount(lot.id, e.target.value, lot.remainingAmount)}
                  className="w-20 p-1 text-xs border border-gray-200 rounded outline-none focus:ring-1 focus:ring-emerald-500"
                />
              )}
            </div>
          ))}
          {availableLots.length === 0 && <p className="text-xs text-gray-400 text-center py-4">無可用持倉</p>}
        </div>
      )}

      {type === 'EXCHANGE' ? (
        <div className="space-y-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">從 (From)</label>
              <select 
                value={fromAsset} 
                onChange={(e) => setFromAsset(e.target.value as Asset)}
                className="w-full p-2 bg-white border border-gray-200 rounded-lg outline-none"
              >
                <option value="ETH">ETH</option>
                <option value="SOL">SOL</option>
                <option value="BTC">BTC</option>
              </select>
            </div>
            <ArrowRightLeft className="w-4 h-4 text-gray-400 mt-5" />
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">到 (To)</label>
              <select 
                value={toAsset} 
                onChange={(e) => setToAsset(e.target.value as Asset)}
                className="w-full p-2 bg-white border border-gray-200 rounded-lg outline-none"
              >
                <option value="ETH">ETH</option>
                <option value="SOL">SOL</option>
                <option value="BTC">BTC</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">賣出數量 ({fromAsset})</label>
              <input 
                type="number" step="any" value={fromAmount} onChange={(e) => setFromAmount(e.target.value)}
                placeholder="0.00" className="w-full p-2 bg-white border border-gray-200 rounded-lg outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">換得數量 ({toAsset})</label>
              <input 
                type="number" step="any" value={toAmount} onChange={(e) => setToAmount(e.target.value)}
                placeholder="0.00" className="w-full p-2 bg-white border border-gray-200 rounded-lg outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">兌換匯率 ({fromAsset}/{toAsset})</label>
            <input 
              type="number" step="any" value={assetExchangeRate} onChange={(e) => setAssetExchangeRate(e.target.value)}
              placeholder="0.00" className="w-full p-2 bg-white border border-gray-200 rounded-lg outline-none"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">幣種</label>
              <select 
                value={asset} 
                onChange={(e) => setAsset(e.target.value as Asset)}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="ETH">ETH</option>
                <option value="SOL">SOL</option>
                <option value="BTC">BTC</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">支付幣種</label>
              <select 
                value={pair} 
                onChange={(e) => handlePairChange(e.target.value as Pair)}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="USDT">USDT</option>
                <option value="TWD">TWD</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {!isManualSelection && (
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">數量</label>
                <input 
                  type="number" 
                  step="any"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="0.00"
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  required
                />
              </div>
            )}
            <div className={isManualSelection ? "col-span-2" : ""}>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">總金額 ({pair})</label>
              <input 
                type="number" 
                step="any"
                value={totalCost}
                onChange={(e) => handleTotalCostChange(e.target.value)}
                placeholder="0.00"
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
              />
              {pair === 'TWD' && totalCost && exchangeRate && (
                <p className="text-[10px] text-emerald-600 mt-1">
                  ≈ {(parseFloat(totalCost) / parseFloat(exchangeRate)).toFixed(2)} USDT
                </p>
              )}
            </div>
            <div className={isManualSelection ? "col-span-2" : ""}>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">單價 (USDT)</label>
              <input 
                type="number" 
                step="any"
                value={price}
                onChange={(e) => handlePriceChange(e.target.value)}
                placeholder="0.00"
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                required
              />
              {pair === 'TWD' && price && exchangeRate && (
                <p className="text-[10px] text-gray-400 mt-1">
                  ≈ {(parseFloat(price) * parseFloat(exchangeRate)).toFixed(2)} TWD
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <button 
        type="submit"
        className={`w-full py-3 ${editData ? 'bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/20' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'} text-white font-semibold rounded-xl transition-colors shadow-lg`}
      >
        {editData ? '確認修改' : '確認新增'} {isManualSelection && `(${totalSelectedAmount.toFixed(4)})`}
      </button>
    </form>
  );
}
