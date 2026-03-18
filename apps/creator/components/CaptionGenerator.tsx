import React, { useState } from 'react';
import { Campaign } from '../../../shared/types';
import { Hash, Sparkles, Copy, Check, RefreshCw, Loader2, Wand2 } from 'lucide-react';

interface Props {
    campaign: Campaign;
    selectedAngle?: string;
    selectedAvatar?: string;
}

interface CaptionResult {
    caption: string;
    hashtags: string[];
    style: string;
}

const STYLES = [
    { id: 'authentic', label: 'Authentic', emoji: '💬', desc: 'Natural, conversational' },
    { id: 'hype', label: 'Hype', emoji: '🔥', desc: 'Energetic, exciting' },
    { id: 'storytelling', label: 'Story', emoji: '📖', desc: 'Narrative hook' },
    { id: 'educational', label: 'Edu', emoji: '🎓', desc: 'Value-driven' },
];

const CaptionGenerator: React.FC<Props> = ({ campaign, selectedAngle, selectedAvatar }) => {
    const [results, setResults] = useState<CaptionResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
    const [selectedStyle, setSelectedStyle] = useState('authentic');

    const generateCaptions = async () => {
        setLoading(true);
        setResults([]);

        // Build context from campaign data
        const briefSnippet = campaign.description?.slice(0, 300) || campaign.title;
        const avatarInfo = selectedAvatar || campaign.avatars?.[0]?.name || '';
        const angleInfo = selectedAngle || '';

        try {
            const response = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Generate 3 social media captions for a UGC creator campaign. Each caption should be in a different style.

Campaign: ${campaign.title}
Brief: ${briefSnippet}
${avatarInfo ? `Character/Avatar: ${avatarInfo}` : ''}
${angleInfo ? `Angle/Hook: ${angleInfo}` : ''}
Preferred style emphasis: ${selectedStyle}

For each caption, respond with JSON array format:
[{"caption": "...", "hashtags": ["tag1", "tag2", "tag3", "tag4", "tag5"], "style": "style name"}]

Make captions feel authentic, not salesy. Include a mix of viral hooks, personal storytelling, and value-driven angles. Keep under 200 chars each. Include 5 relevant hashtags per caption.`,
                    model: 'gemini',
                }),
            });

            if (response.ok) {
                const data = await response.json();
                try {
                    // Try to parse JSON from the response
                    const text = data.response || data.text || '';
                    const jsonMatch = text.match(/\[[\s\S]*\]/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        setResults(parsed);
                    }
                } catch {
                    // Fallback: generate sample captions
                    setResults(getFallbackCaptions(campaign.title, selectedStyle));
                }
            } else {
                setResults(getFallbackCaptions(campaign.title, selectedStyle));
            }
        } catch {
            setResults(getFallbackCaptions(campaign.title, selectedStyle));
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string, idx: number) => {
        navigator.clipboard.writeText(text);
        setCopiedIdx(idx);
        setTimeout(() => setCopiedIdx(null), 2000);
    };

    return (
        <div className="bg-gradient-to-br from-violet-500/5 to-pink-500/5 border border-violet-500/15 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-black text-violet-400 uppercase tracking-widest flex items-center gap-2">
                    <Wand2 size={14} /> Caption & Hashtag Generator
                </h4>
            </div>

            {/* Style Selector */}
            <div className="grid grid-cols-4 gap-2 mb-4">
                {STYLES.map(style => (
                    <button
                        key={style.id}
                        onClick={() => setSelectedStyle(style.id)}
                        className={`p-2 rounded-xl border text-center transition-all ${
                            selectedStyle === style.id
                                ? 'border-violet-500 bg-violet-500/10'
                                : 'border-neutral-800 bg-black/30 hover:border-neutral-700'
                        }`}
                    >
                        <span className="text-lg block">{style.emoji}</span>
                        <span className={`text-[8px] font-bold uppercase tracking-wider ${
                            selectedStyle === style.id ? 'text-violet-400' : 'text-neutral-500'
                        }`}>{style.label}</span>
                    </button>
                ))}
            </div>

            <button
                onClick={generateCaptions}
                disabled={loading}
                className="w-full bg-gradient-to-r from-violet-500 to-pink-500 text-white py-2.5 rounded-xl font-black uppercase tracking-widest text-xs hover:from-violet-400 hover:to-pink-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20 mb-4"
            >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {loading ? 'Generating...' : 'Generate Captions'}
            </button>

            {/* Results */}
            {results.length > 0 && (
                <div className="space-y-3">
                    {results.map((result, idx) => (
                        <div key={idx} className="bg-black/40 border border-neutral-800 rounded-xl p-4 group hover:border-violet-500/30 transition-all">
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <span className="text-[8px] font-bold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full uppercase">
                                    {result.style}
                                </span>
                                <button
                                    onClick={() => copyToClipboard(result.caption + '\n\n' + result.hashtags.map(h => `#${h}`).join(' '), idx)}
                                    className="text-neutral-600 hover:text-violet-400 transition-colors"
                                    title="Copy caption"
                                >
                                    {copiedIdx === idx ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                </button>
                            </div>
                            <p className="text-sm text-white leading-relaxed mb-3">{result.caption}</p>
                            <div className="flex flex-wrap gap-1.5">
                                {result.hashtags.map((tag, i) => (
                                    <button
                                        key={i}
                                        onClick={() => { navigator.clipboard.writeText(`#${tag}`); }}
                                        className="text-[9px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/15 hover:bg-cyan-500/20 transition-all flex items-center gap-0.5"
                                        title={`Copy #${tag}`}
                                    >
                                        <Hash size={7} /> {tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Fallback when AI is unavailable
function getFallbackCaptions(title: string, style: string): CaptionResult[] {
    return [
        {
            caption: `POV: You finally found the product that just gets it 🙌`,
            hashtags: ['ugc', 'creator', 'authentic', 'review', 'fyp'],
            style: 'Authentic',
        },
        {
            caption: `This is not a drill 🚨 ${title} is literally changing the game`,
            hashtags: ['trending', 'viral', 'musttry', 'creator', 'collab'],
            style: 'Hype',
        },
        {
            caption: `Let me tell you about the thing nobody asked for but everyone needs`,
            hashtags: ['storytelling', 'realtalk', 'honest', 'review', 'ugc'],
            style: 'Storytelling',
        },
    ];
}

export default CaptionGenerator;
