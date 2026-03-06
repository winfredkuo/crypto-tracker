import { useState } from 'react';
import { Database, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';

export default function DbCheck() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [data, setData] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);

  const checkDb = async () => {
    setStatus('loading');
    try {
      const res = await fetch('/api/db-diagnostics');
      const result = await res.json();
      setData(result);
      if (result.status === 'connected') {
        setStatus('success');
      } else {
        setStatus('error');
      }
    } catch (err) {
      setStatus('error');
      setData({ error: 'Failed to fetch diagnostics' });
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen && status === 'idle') checkDb();
        }}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          status === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
          status === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
          'bg-gray-50 text-gray-600 border border-gray-200'
        }`}
      >
        {status === 'loading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
        資料庫狀態
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-50 animate-in fade-in slide-in-from-top-2">
          <div className="flex justify-between items-start mb-3">
            <h3 className="font-semibold text-sm text-gray-900">Postgres 診斷</h3>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>

          {status === 'loading' ? (
            <div className="py-8 flex flex-col items-center justify-center text-gray-500 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-xs">正在測試連線...</p>
            </div>
          ) : data ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 border border-gray-100">
                {data.status === 'connected' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className="text-xs font-medium uppercase">{data.status}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="p-2 bg-gray-50 rounded border border-gray-100">
                  <p className="text-gray-400 uppercase mb-1">環境變數</p>
                  <p className={data.env?.POSTGRES_URL ? 'text-emerald-600' : 'text-red-500'}>
                    {data.env?.POSTGRES_URL ? '✅ 已設定' : '❌ 未設定'}
                  </p>
                </div>
                <div className="p-2 bg-gray-50 rounded border border-gray-100">
                  <p className="text-gray-400 uppercase mb-1">通訊協定</p>
                  <p className="text-gray-700 font-mono">{data.connection?.protocol || 'N/A'}</p>
                </div>
              </div>

              {data.connection?.isPrisma && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <p className="text-[10px] text-amber-800 leading-relaxed">
                    偵測到 Prisma URL！這是不相容的。請在 Vercel 中將 POSTGRES_URL 改為標準的 postgres:// 連結。
                  </p>
                </div>
              )}

              {data.error && (
                <div className="p-2 bg-red-50 border border-red-100 rounded-lg">
                  <p className="text-[10px] text-red-600 font-mono break-words leading-relaxed">
                    錯誤: {data.error}
                  </p>
                </div>
              )}

              {data.dbVersion && (
                <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-lg">
                  <p className="text-[10px] text-indigo-700 font-mono truncate">
                    版本: {data.dbVersion}
                  </p>
                </div>
              )}

              <button
                onClick={checkDb}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors"
              >
                重新測試
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
