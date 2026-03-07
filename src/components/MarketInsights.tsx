import { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { PriceData, Transaction } from '../types';
import { Sparkles, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MarketInsightsProps {
  prices: PriceData[];
  transactions: Transaction[];
}

export default function MarketInsights({ prices, transactions }: MarketInsightsProps) {
  const [insight, setInsight] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const generateInsight = async () => {
    setLoading(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      
      // Prepare data for the prompt
      const priceSummary = prices.map(p => `${p.symbol}: $${parseFloat(p.price).toLocaleString()} (${p.priceChangePercent}%)`).join('\n');
      
      // Basic portfolio summary
      const holdings: Record<string, number> = {};
      transactions.forEach(tx => {
        if (tx.type === 'BUY' && tx.asset) {
          holdings[tx.asset] = (holdings[tx.asset] || 0) + (tx.remainingAmount || 0);
        } else if (tx.type === 'SELL' && tx.asset) {
          holdings[tx.asset] = (holdings[tx.asset] || 0) - (tx.amount || 0);
        } else if (tx.type === 'EXCHANGE') {
          if (tx.fromAsset) holdings[tx.fromAsset] = (holdings[tx.fromAsset] || 0) - (tx.fromAmount || 0);
          if (tx.toAsset) holdings[tx.toAsset] = (holdings[tx.toAsset] || 0) + (tx.toAmount || 0);
        }
      });

      const portfolioSummary = Object.entries(holdings)
        .filter(([_, amount]) => amount > 0.0001)
        .map(([asset, amount]) => `${asset}: ${amount.toFixed(4)}`)
        .join(', ');

      const prompt = `
        You are a professional crypto market analyst. 
        Current Prices:
        ${priceSummary}

        User's Portfolio:
        ${portfolioSummary || 'No holdings yet.'}

        Provide a concise, professional market insight (max 150 words). 
        Include:
        1. A quick summary of the current market sentiment (Bullish/Bearish/Neutral).
        2. One specific observation about the user's holdings relative to current prices.
        3. A brief cautionary note or opportunity.
        
        IMPORTANT: Your response MUST be in Traditional Chinese (Taiwan).
        Use Markdown for formatting. Be direct and avoid generic advice.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setInsight(response.text || '無法生成洞察。');
    } catch (err) {
      console.error("Gemini Error:", err);
      setError('無法獲取 AI 洞察，請稍後再試。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (prices.length > 0) {
      generateInsight();
    }
  }, [prices.length]); // Re-generate when prices are first loaded

  return (
    <div className="bg-white rounded-2xl border border-black/5 overflow-hidden shadow-sm">
      <div className="p-4 border-b border-black/5 flex items-center justify-between bg-emerald-50/30">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-600" />
          <h3 className="font-bold text-sm text-emerald-900">AI 市場洞察</h3>
        </div>
        <button 
          onClick={generateInsight}
          disabled={loading}
          className="text-xs font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
        >
          {loading ? '分析中...' : '重新分析'}
        </button>
      </div>
      
      <div className="p-5">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="h-4 bg-gray-100 rounded w-3/4 animate-pulse" />
              <div className="h-4 bg-gray-100 rounded w-full animate-pulse" />
              <div className="h-4 bg-gray-100 rounded w-5/6 animate-pulse" />
            </motion.div>
          ) : error ? (
            <motion.div 
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-red-500 text-sm"
            >
              <AlertCircle className="w-4 h-4" />
              {error}
            </motion.div>
          ) : (
            <motion.div 
              key="content"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="prose prose-sm max-w-none text-gray-600 leading-relaxed"
            >
              <ReactMarkdown>{insight}</ReactMarkdown>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      <div className="px-5 py-3 bg-gray-50/50 border-t border-black/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            <TrendingUp className="w-3 h-3" />
            Bullish
          </div>
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            <TrendingDown className="w-3 h-3" />
            Bearish
          </div>
        </div>
        <span className="text-[10px] text-gray-400 font-mono">Powered by Gemini 3.0</span>
      </div>
    </div>
  );
}
