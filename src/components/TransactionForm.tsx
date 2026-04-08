import React, { useState, useEffect } from 'react';
import { Asset, Pair, Transaction, TransactionType } from '../types';
import { PlusCircle, ArrowRightLeft, CheckSquare, Square, Calculator } from 'lucide-react';

interface Props {
  onAdd: (tx: any) => void;
  onUpdate?: (id: number, tx: any) => void;
  transactions: Transaction[];
  editData?: Transaction | null;
  templateData?: Partial<Transaction> | null;
  onCancelEdit?: () => void;
}

export default function TransactionForm({ onAdd, onUpdate, transactions, editData, templateData, onCancelEdit }: Props) {
  const [type, setType] = useState<TransactionType>('BUY');
  const [asset, setAsset] = useState<Asset>('ETH');
  const [pair, setPair] = useState<Pair>('USDT');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [exchangeRate, setExchangeRate] = useState('31.5');
  const [realizedProfitCoin, setRealizedProfitCoin] = useState('');
  const [realizedProfitUSDT, setRealizedProfitUSDT] = useState('');
  const [note, setNote] = useState('');
  const [fee, setFee] = useState('');

  // For EXCHANGE
  const [fromAsset, setFromAsset] = useState<Asset>('ETH');
  const [toAsset, setToAsset] = useState<Asset>('SOL');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [assetExchangeRate, setAssetExchangeRate] = useState('');

  // For Manual Lot Selection
  const [selectedLots, setSelectedLots] = useState<Record<number, number>>({});
  const [isManualSelection, setIsManualSelection] = useState(false);

  // Calculator Modal State
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcInput, setCalcInput] = useState('');
  const [calcTarget, setCalcTarget] = useState<'amount' | 'price' | 'totalCost' | 'realizedProfitCoin' | 'realizedProfitUSDT' | 'fromAmount' | 'toAmount' | 'assetExchangeRate' | ''>('');

  useEffect(() => {
    if (editData) {
      setType(editData.type);
      setAsset(editData.asset || 'ETH');
      setPair(editData.pair || 'USDT');
      setAmount((editData.amount ?? '').toString());
      setPrice((editData.price ?? '').toString());
      setTotalCost((editData.originalCost ?? ((editData.amount || 0) * (editData.price || 0))).toString());
      setExchangeRate((editData.exchangeRate ?? 31.5).toString());
      setRealizedProfitCoin((editData.realizedProfitCoin ?? '').toString());
      setRealizedProfitUSDT((editData.realizedProfitUSDT ?? '').toString());
      setNote(editData.note || '');
      setFee((editData.fee ?? '').toString());
      if (editData.type === 'EXCHANGE') {
        setFromAsset(editData.fromAsset || 'ETH');
        setToAsset(editData.toAsset || 'SOL');
        setFromAmount((editData.fromAmount ?? '').toString());
        setToAmount((editData.toAmount ?? '').toString());
        
        // If ETH/SOL pair, display as SOL/ETH (0.033)
        // Stored value is ETH/SOL (30)
        if ((editData.fromAsset === 'ETH' && editData.toAsset === 'SOL') || (editData.fromAsset === 'SOL' && editData.toAsset === 'ETH')) {
           setAssetExchangeRate((1 / (editData.assetExchangeRate || 1)).toFixed(8).replace(/\.?0+$/, ''));
        } else {
           setAssetExchangeRate((editData.assetExchangeRate ?? '').toString());
        }
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
      setExchangeRate('31.5');
    }
  }, [editData, templateData]);

  const handleAmountChange = (val: string) => setAmount(val);
  const handleTotalCostChange = (val: string) => setTotalCost(val);
  const handlePriceChange = (val: string) => setPrice(val);
  const handleFromAmountChange = (val: string) => {
    setFromAmount(val);
    const from = parseFloat(val);
    const to = parseFloat(toAmount);
    if (!isNaN(from) && !isNaN(to) && from > 0 && to > 0) {
      if ((fromAsset === 'ETH' && toAsset === 'SOL') || (fromAsset === 'SOL' && toAsset === 'ETH')) {
        if (fromAsset === 'ETH') setAssetExchangeRate((to / from).toFixed(8).replace(/\.?0+$/, ''));
        else setAssetExchangeRate((from / to).toFixed(8).replace(/\.?0+$/, ''));
      } else {
        setAssetExchangeRate((to / from).toFixed(8).replace(/\.?0+$/, ''));
      }
    }
  };

  const handleToAmountChange = (val: string) => {
    setToAmount(val);
    const from = parseFloat(fromAmount);
    const to = parseFloat(val);
    if (!isNaN(from) && !isNaN(to) && from > 0 && to > 0) {
      if ((fromAsset === 'ETH' && toAsset === 'SOL') || (fromAsset === 'SOL' && toAsset === 'ETH')) {
        if (fromAsset === 'ETH') setAssetExchangeRate((to / from).toFixed(8).replace(/\.?0+$/, ''));
        else setAssetExchangeRate((from / to).toFixed(8).replace(/\.?0+$/, ''));
      } else {
        setAssetExchangeRate((to / from).toFixed(8).replace(/\.?0+$/, ''));
      }
    }
  };
  const handleAssetExchangeRateChange = (val: string) => setAssetExchangeRate(val);
  const handleExchangeRateChange = (val: string) => setExchangeRate(val);
  const handlePairChange = (newPair: Pair) => setPair(newPair);

  const openCalculator = (target: 'amount' | 'price' | 'totalCost' | 'realizedProfitCoin' | 'realizedProfitUSDT' | 'fromAmount' | 'toAmount' | 'assetExchangeRate') => {
    setCalcTarget(target);
    setCalcInput('');
    setShowCalculator(true);
  };

  const applyCalculatorResult = () => {
    try {
      // Basic math evaluation
      const result = new Function('return ' + calcInput)();
      if (!isNaN(result)) {
        const valStr = result.toString();
        if (calcTarget === 'amount') handleAmountChange(valStr);
        if (calcTarget === 'price') handlePriceChange(valStr);
        if (calcTarget === 'totalCost') handleTotalCostChange(valStr);
        if (calcTarget === 'realizedProfitCoin') setRealizedProfitCoin(valStr);
        if (calcTarget === 'realizedProfitUSDT') setRealizedProfitUSDT(valStr);
        if (calcTarget === 'fromAmount') handleFromAmountChange(valStr);
        if (calcTarget === 'toAmount') handleToAmountChange(valStr);
        if (calcTarget === 'assetExchangeRate') handleAssetExchangeRateChange(valStr);
      }
    } catch (e) {
      alert('計算式無效');
      return;
    }
    setShowCalculator(false);
  };

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
        if ((fromAsset === 'ETH' && toAsset === 'SOL') || (fromAsset === 'SOL' && toAsset === 'ETH')) {
             if (fromAsset === 'ETH') rate = parseFloat(fromAmount) / parseFloat(toAmount);
             else rate = parseFloat(toAmount) / parseFloat(fromAmount);
        } else {
             rate = parseFloat(toAmount) / parseFloat(fromAmount);
        }
      }
      
      // If ETH/SOL pair, we displayed SOL/ETH (e.g., 0.033), but want to store ETH/SOL (e.g., 30)
      if ((fromAsset === 'ETH' && toAsset === 'SOL') || (fromAsset === 'SOL' && toAsset === 'ETH')) {
          rate = 1 / rate;
      }

      const data = {
        type,
        fromAsset,
        toAsset,
        fromAmount: parseFloat(fromAmount),
        toAmount: parseFloat(toAmount),
        assetExchangeRate: rate,
        realizedProfitCoin: realizedProfitCoin ? parseFloat(realizedProfitCoin) : undefined,
        realizedProfitUSDT: realizedProfitUSDT ? parseFloat(realizedProfitUSDT) : undefined,
        note,
        fee: fee ? parseFloat(fee) : 0
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
        realizedProfitCoin: realizedProfitCoin ? parseFloat(realizedProfitCoin) : undefined,
        realizedProfitUSDT: realizedProfitUSDT ? parseFloat(realizedProfitUSDT) : undefined,
        note,
        fee: fee ? parseFloat(fee) : 0
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
      setRealizedProfitCoin('');
      setRealizedProfitUSDT('');
      setNote('');
      setFee('');
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
                onChange={(e) => {
                  const newFromAsset = e.target.value as Asset;
                  setFromAsset(newFromAsset);
                  const from = parseFloat(fromAmount) || 0;
                  const to = parseFloat(toAmount) || 0;
                  if (from > 0 && to > 0) {
                    let rate = 0;
                    if ((newFromAsset === 'ETH' && toAsset === 'SOL') || (newFromAsset === 'SOL' && toAsset === 'ETH')) {
                      if (newFromAsset === 'ETH') rate = from / to;
                      else rate = to / from;
                    } else {
                      rate = to / from;
                    }
                    setAssetExchangeRate(rate.toFixed(8).replace(/\.?0+$/, ''));
                  }
                }}
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
                onChange={(e) => {
                  const newToAsset = e.target.value as Asset;
                  setToAsset(newToAsset);
                  const from = parseFloat(fromAmount) || 0;
                  const to = parseFloat(toAmount) || 0;
                  if (from > 0 && to > 0) {
                    let rate = 0;
                    if ((fromAsset === 'ETH' && newToAsset === 'SOL') || (fromAsset === 'SOL' && newToAsset === 'ETH')) {
                      if (fromAsset === 'ETH') rate = from / to;
                      else rate = to / from;
                    } else {
                      rate = to / from;
                    }
                    setAssetExchangeRate(rate.toFixed(8).replace(/\.?0+$/, ''));
                  }
                }}
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
              <label className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase mb-1">
                <span>賣出數量 ({fromAsset})</span>
                <button type="button" onClick={() => openCalculator('fromAmount')} className="text-emerald-500 hover:text-emerald-600"><Calculator className="w-3 h-3" /></button>
              </label>
              <input 
                type="number" step="any" value={fromAmount} onChange={(e) => handleFromAmountChange(e.target.value)}
                placeholder="0.00" className="w-full p-2 bg-white border border-gray-200 rounded-lg outline-none"
              />
            </div>
            <div>
              <label className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase mb-1">
                <span>換得數量 ({toAsset})</span>
                <button type="button" onClick={() => openCalculator('toAmount')} className="text-emerald-500 hover:text-emerald-600"><Calculator className="w-3 h-3" /></button>
              </label>
              <input 
                type="number" step="any" value={toAmount} onChange={(e) => handleToAmountChange(e.target.value)}
                placeholder="0.00" className="w-full p-2 bg-white border border-gray-200 rounded-lg outline-none"
              />
            </div>
          </div>
          <div>
            <label className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase mb-1">
              <span>兌換匯率 ({(fromAsset === 'ETH' && toAsset === 'SOL') || (fromAsset === 'SOL' && toAsset === 'ETH') ? 'SOL/ETH' : `${fromAsset}/${toAsset}`})</span>
              <button type="button" onClick={() => openCalculator('assetExchangeRate')} className="text-emerald-500 hover:text-emerald-600"><Calculator className="w-3 h-3" /></button>
            </label>
            <input 
              type="number" step="any" value={assetExchangeRate} onChange={(e) => handleAssetExchangeRateChange(e.target.value)}
              placeholder="0.00" className="w-full p-2 bg-white border border-gray-200 rounded-lg outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
            <div>
              <label className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase mb-1">
                <span>幣本位盈虧</span>
                <button type="button" onClick={() => openCalculator('realizedProfitCoin')} className="text-emerald-500 hover:text-emerald-600"><Calculator className="w-3 h-3" /></button>
              </label>
              <input 
                type="number" 
                step="any"
                value={realizedProfitCoin}
                onChange={(e) => setRealizedProfitCoin(e.target.value)}
                placeholder="0.00"
                className="w-full p-2 bg-white border border-gray-200 rounded-lg outline-none text-sm"
              />
            </div>
            <div>
              <label className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase mb-1">
                <span>U本位盈虧</span>
                <button type="button" onClick={() => openCalculator('realizedProfitUSDT')} className="text-emerald-500 hover:text-emerald-600"><Calculator className="w-3 h-3" /></button>
              </label>
              <input 
                type="number" 
                step="any"
                value={realizedProfitUSDT}
                onChange={(e) => setRealizedProfitUSDT(e.target.value)}
                placeholder="0.00"
                className="w-full p-2 bg-white border border-gray-200 rounded-lg outline-none text-sm"
              />
            </div>
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
                <label className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase mb-1">
                  <span>數量</span>
                  <button type="button" onClick={() => openCalculator('amount')} className="text-emerald-500 hover:text-emerald-600"><Calculator className="w-3 h-3" /></button>
                </label>
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
              <label className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase mb-1">
                <span>總金額 ({pair})</span>
                <button type="button" onClick={() => openCalculator('totalCost')} className="text-emerald-500 hover:text-emerald-600"><Calculator className="w-3 h-3" /></button>
              </label>
              <input 
                type="number" 
                step="any"
                value={totalCost}
                onChange={(e) => handleTotalCostChange(e.target.value)}
                placeholder="0.00"
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
              />
            </div>
            <div className={isManualSelection ? "col-span-2" : ""}>
              <label className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase mb-1">
                <span>單價 ({pair})</span>
                <button type="button" onClick={() => openCalculator('price')} className="text-emerald-500 hover:text-emerald-600"><Calculator className="w-3 h-3" /></button>
              </label>
              <input 
                type="number" 
                step="any"
                value={price}
                onChange={(e) => handlePriceChange(e.target.value)}
                placeholder="0.00"
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                required
              />
            </div>
          </div>
          
          {type === 'SELL' && (
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
              <div>
                <label className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase mb-1">
                  <span>幣本位盈虧</span>
                  <button type="button" onClick={() => openCalculator('realizedProfitCoin')} className="text-emerald-500 hover:text-emerald-600"><Calculator className="w-3 h-3" /></button>
                </label>
                <input 
                  type="number" 
                  step="any"
                  value={realizedProfitCoin}
                  onChange={(e) => setRealizedProfitCoin(e.target.value)}
                  placeholder="0.00"
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase mb-1">
                  <span>U本位盈虧</span>
                  <button type="button" onClick={() => openCalculator('realizedProfitUSDT')} className="text-emerald-500 hover:text-emerald-600"><Calculator className="w-3 h-3" /></button>
                </label>
                <input 
                  type="number" 
                  step="any"
                  value={realizedProfitUSDT}
                  onChange={(e) => setRealizedProfitUSDT(e.target.value)}
                  placeholder="0.00"
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">手續費 ({pair})</label>
              <input 
                type="number" step="any" value={fee} onChange={(e) => setFee(e.target.value)}
                placeholder="0.00" className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">備註</label>
              <input 
                type="text" value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="選填" className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm"
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        {editData && (
          <button 
            type="button"
            onClick={onCancelEdit}
            className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl transition-all"
          >
            取消
          </button>
        )}
        <button 
          type="submit"
          className={`flex-[2] py-3 ${editData ? 'bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/20' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'} text-white font-bold rounded-xl transition-all shadow-lg`}
        >
          {editData ? '儲存修改' : '確認新增'} {isManualSelection && `(${totalSelectedAmount.toFixed(4)})`}
        </button>
      </div>

      {showCalculator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">
                手動計算機 - {
                  calcTarget === 'amount' ? '數量' :
                  calcTarget === 'price' ? '單價' :
                  calcTarget === 'totalCost' ? '總金額' :
                  calcTarget === 'realizedProfitCoin' ? '幣本位盈虧' :
                  calcTarget === 'realizedProfitUSDT' ? 'U本位盈虧' :
                  calcTarget === 'fromAmount' ? '賣出數量' :
                  calcTarget === 'toAmount' ? '換得數量' :
                  calcTarget === 'assetExchangeRate' ? '兌換匯率' :
                  ''
                }
              </h3>
              <button type="button" onClick={() => setShowCalculator(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4">
              <input
                type="text"
                value={calcInput}
                onChange={(e) => setCalcInput(e.target.value)}
                placeholder="例如: 100 * 31.5 / 2"
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-lg"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyCalculatorResult();
                  }
                }}
              />
              <button
                type="button"
                onClick={applyCalculatorResult}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-colors"
              >
                計算並填入
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
