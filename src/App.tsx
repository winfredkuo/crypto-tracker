import { useState, useEffect } from 'react';
import { Transaction, PriceData } from './types';
import { fetchPrices, fetchUSDTTWD } from './services/binance';
import Dashboard from './components/Dashboard';
import ExchangeHistory from './components/ExchangeHistory';
import TransactionForm from './components/TransactionForm';
import SidebarSummary from './components/SidebarSummary';
import MarketInsights from './components/MarketInsights';
import Modal from './components/Modal';
import { RefreshCw, LayoutDashboard, Plus, PlusCircle, ArrowRightLeft } from 'lucide-react';

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [usdtTwd, setUsdtTwd] = useState(31.5);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [templateTransaction, setTemplateTransaction] = useState<Partial<Transaction> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'DASHBOARD' | 'EXCHANGE'>('DASHBOARD');

  const loadData = async () => {
    try {
      // Fetch transactions first as they are critical
      const txRes = await fetch('/api/transactions');
      if (txRes.ok) {
        const txs = await txRes.json();
        setTransactions(txs);
      }

      // Fetch prices and exchange rate independently
      try {
        const priceData = await fetchPrices();
        setPrices(priceData);
      } catch (e) {
        console.warn("Failed to fetch prices:", e);
      }

      try {
        const rate = await fetchUSDTTWD();
        setUsdtTwd(rate);
      } catch (e) {
        console.warn("Failed to fetch exchange rate:", e);
      }
      
    } catch (error) {
      console.error("Failed to load critical data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      fetchPrices()
        .then(setPrices)
        .catch(err => console.error("Periodic price fetch failed:", err));
    }, 30000); // Update prices every 30s
    return () => clearInterval(interval);
  }, []);

  const handleAddTransaction = async (tx: Omit<Transaction, 'id' | 'timestamp'>) => {
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tx),
      });
      if (res.ok) {
        setTemplateTransaction(null);
        setIsModalOpen(false);
        loadData();
      } else {
        const text = await res.text();
        try {
          const errorData = JSON.parse(text);
          alert(`儲存失敗: ${errorData.error || '資料庫連線異常，請確認 Vercel Postgres 已正確配置'}`);
        } catch (e) {
          alert(`伺服器錯誤 (${res.status}): ${text.substring(0, 100)}...`);
        }
      }
    } catch (error) {
      console.error("Failed to add transaction:", error);
      const msg = error instanceof Error ? error.message : '連線失敗';
      alert(`網路錯誤: ${msg}。請檢查 Vercel Logs 或確認資料庫設定。`);
    }
  };

  const handleUpdateTransaction = async (id: number, tx: Partial<Transaction>) => {
    try {
      const res = await fetch(`/api/transactions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tx),
      });
      if (res.ok) {
        setEditingTransaction(null);
        setIsModalOpen(false);
        loadData();
      } else {
        const errorData = await res.json();
        alert(`更新失敗: ${errorData.error || '未知錯誤'}`);
      }
    } catch (error) {
      console.error("Failed to update transaction:", error);
      alert("網路錯誤，請稍後再試");
    }
  };

  const handleDeleteTransaction = async (id: number) => {
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadData();
      }
    } catch (error) {
      console.error("Failed to delete transaction:", error);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const openAddModal = () => {
    setEditingTransaction(null);
    setTemplateTransaction(null);
    setIsModalOpen(true);
  };

  const handleResetDatabase = async () => {
    if (!confirm("確定要清除所有交易紀錄嗎？此操作無法復原。")) return;
    try {
      const res = await fetch('/api/admin/reset-db', { method: 'POST' });
      if (res.ok) {
        alert("資料庫已重置");
        loadData();
      } else {
        const text = await res.text();
        alert(`重置失敗 (${res.status}): ${text.substring(0, 100)}...`);
      }
    } catch (error) {
      console.error("Failed to reset database:", error);
      alert(`重置失敗: ${error instanceof Error ? error.message : '連線失敗'}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
          <p className="text-gray-500 font-medium">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-900 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-black/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <RefreshCw className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">CryptoTrack <span className="text-emerald-500">.</span></h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <div className="h-6 w-px bg-gray-200 mx-2" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-400 to-teal-500" />
              <span className="text-sm font-medium hidden sm:inline-block">User</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sidebar / Navigation */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white p-2 rounded-xl border border-black/5 space-y-1">
              <button 
                onClick={() => setCurrentView('DASHBOARD')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-sm transition-all ${
                  currentView === 'DASHBOARD' 
                    ? 'bg-emerald-50 text-emerald-600' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <LayoutDashboard className="w-5 h-5" />
                資產概覽
              </button>
              <button 
                onClick={() => setCurrentView('EXCHANGE')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-sm transition-all ${
                  currentView === 'EXCHANGE' 
                    ? 'bg-emerald-50 text-emerald-600' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <ArrowRightLeft className="w-5 h-5" />
                資產兌換
              </button>
            </div>

            <MarketInsights 
              prices={prices}
              transactions={transactions}
            />

            <button 
              onClick={openAddModal}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 group"
            >
              <PlusCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
              新增交易紀錄
            </button>

            <SidebarSummary 
              transactions={transactions}
              prices={prices}
              usdtTwd={usdtTwd}
              onReset={handleResetDatabase}
            />
          </div>

          {/* Content Area */}
          <div className="lg:col-span-9">
            {currentView === 'DASHBOARD' ? (
              <Dashboard 
                transactions={transactions} 
                prices={prices}
                onDelete={handleDeleteTransaction}
                onEdit={(tx) => {
                  setTemplateTransaction(null);
                  setEditingTransaction(tx);
                  setIsModalOpen(true);
                }}
                onQuickSell={(tx) => {
                  setEditingTransaction(null);
                  setTemplateTransaction({
                    type: 'SELL',
                    asset: tx.asset,
                    amount: tx.remainingAmount,
                    price: parseFloat(prices.find(p => p.symbol === `${tx.asset}USDT`)?.price || '0'),
                    id: tx.id
                  });
                  setIsModalOpen(true);
                }}
              />
            ) : (
              <ExchangeHistory 
                transactions={transactions}
                onDelete={handleDeleteTransaction}
                onEdit={(tx) => {
                  setTemplateTransaction(null);
                  setEditingTransaction(tx);
                  setIsModalOpen(true);
                }}
              />
            )}
          </div>
        </div>
      </main>

      {/* Transaction Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setEditingTransaction(null);
          setTemplateTransaction(null);
        }}
        title={editingTransaction ? '修改交易紀錄' : templateTransaction ? '快速賣出' : '新增交易紀錄'}
      >
        <TransactionForm 
          onAdd={handleAddTransaction} 
          onUpdate={handleUpdateTransaction}
          currentExchangeRate={usdtTwd} 
          transactions={transactions}
          editData={editingTransaction}
          templateData={templateTransaction}
          onCancelEdit={() => {
            setIsModalOpen(false);
            setEditingTransaction(null);
            setTemplateTransaction(null);
          }}
        />
      </Modal>

      {/* Mobile FAB for adding transaction (optional) */}
      <div className="lg:hidden fixed bottom-6 right-6">
        <button 
          onClick={openAddModal}
          className="w-14 h-14 bg-emerald-500 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
