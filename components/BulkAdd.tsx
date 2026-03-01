
import React, { useState } from 'react';
import { Layers, Loader2, Sparkles, PlusCircle } from 'lucide-react';
import { parseBulkCreators } from '../services/geminiService';
import { Creator, Platform, CreatorStatus, PaymentStatus, ShipmentStatus } from '../types';

interface BulkAddProps {
  onAdded: (creators: Partial<Creator>[]) => void;
}

const BulkAdd: React.FC<BulkAddProps> = ({ onAdded }) => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'ai' | 'simple'>('simple');

  const handleBulkProcess = async () => {
    if (!text.trim()) return;
    setLoading(true);

    try {
      if (mode === 'ai') {
        const results = await parseBulkCreators(text);
        onAdded(results);
      } else {
        // Simple line by line split
        const names = text.split('\n').filter(line => line.trim() !== '');
        const newCreators = names.map(name => ({
          name: name.trim(),
          handle: '',
          platform: Platform.Instagram,
          status: CreatorStatus.Active,
          paymentStatus: PaymentStatus.Unpaid,
          shipmentStatus: ShipmentStatus.None,
          rate: 0
        }));
        onAdded(newCreators);
      }
      setText('');
    } catch (err) {
      alert("Error processing bulk list.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex bg-neutral-900 p-1 rounded-xl border border-neutral-800">
        <button onClick={() => setMode('simple')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'simple' ? 'bg-neutral-800 text-white' : 'text-neutral-500'}`}>Simple List</button>
        <button onClick={() => setMode('ai')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'ai' ? 'bg-emerald-500 text-black' : 'text-neutral-500'}`}>AI Smart Parse</button>
      </div>

      <textarea
        className="w-full bg-black border border-neutral-800 rounded-xl p-4 text-sm text-neutral-200 focus:outline-none focus:border-emerald-500/50 transition-colors h-48 resize-none"
        placeholder={mode === 'simple' ? "Paste names here, one per line..." : "Paste raw text (emails, DMs, spreadsheets) and let OOEDN AI find the creators..."}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={loading}
      />

      <button
        onClick={handleBulkProcess}
        disabled={loading || !text.trim()}
        className="w-full flex items-center justify-center gap-2 bg-white text-black py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-neutral-200 transition-all disabled:opacity-50"
      >
        {loading ? <Loader2 className="animate-spin" size={18} /> : mode === 'ai' ? <Sparkles size={18} /> : <PlusCircle size={18} />}
        {loading ? 'Processing...' : mode === 'ai' ? 'Extract & Add Creators' : 'Add All to Roster'}
      </button>
    </div>
  );
};

export default BulkAdd;
