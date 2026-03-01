
import React, { useState } from 'react';
import { Sparkles, Loader2, Clipboard } from 'lucide-react';
import { parseCreatorInfo } from '../services/geminiService';
import { Creator, Platform, PaymentMethod, CreatorStatus, PaymentStatus } from '../types';

interface MagicPasteProps {
  onParsed: (data: Partial<Creator>) => void;
}

const MagicPaste: React.FC<MagicPasteProps> = ({ onParsed }) => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleProcess = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const result = await parseCreatorInfo(text);
      // FIXED: Use paymentOptions array from AI result instead of non-existent single fields
      onParsed({
        name: result.name,
        handle: result.handle,
        platform: result.platform as Platform,
        email: result.email,
        paymentOptions: result.paymentOptions || [],
        rate: result.rate || 0,
        notes: result.notes || text,
        // Defaults
        status: CreatorStatus.Active,
        paymentStatus: PaymentStatus.Unpaid,
        profileImage: `https://picsum.photos/seed/${result.handle}/100/100`,
      });
      setText(''); // Clear after success
    } catch (err) {
      setError("Failed to process with AI. Please try manually or check your API Key.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-ooedn-gray p-4 rounded-xl border border-neutral-800 mb-6 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
        <Sparkles size={64} />
      </div>
      
      <div className="flex items-center gap-2 mb-3 text-emerald-400">
        <Sparkles size={18} />
        <h3 className="font-semibold text-sm uppercase tracking-wider">AI Magic Paste</h3>
      </div>
      
      <p className="text-neutral-400 text-xs mb-3">
        Paste any unstructured text (bio, email, chat) here. OOEDN AI will extract the details automatically.
      </p>

      <textarea
        className="w-full bg-ooedn-black border border-neutral-800 rounded-lg p-3 text-sm text-neutral-200 focus:outline-none focus:border-emerald-500/50 transition-colors min-h-[100px]"
        placeholder="e.g. 'Found this cool creator @jason_skates on TikTok. He charges $200 per post. Email: jason@skate.com'"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={loading}
      />

      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

      <div className="mt-3 flex justify-end">
        <button
          onClick={handleProcess}
          disabled={loading || !text.trim()}
          className="flex items-center gap-2 bg-neutral-100 text-black px-4 py-2 rounded-lg text-sm font-semibold hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : <Clipboard size={16} />}
          {loading ? 'Processing...' : 'Extract & Fill'}
        </button>
      </div>
    </div>
  );
};

export default MagicPaste;
