import React from 'react';
import { ContentItem, ContentStatus } from '../types';
import { ArrowRight, Sparkles } from 'lucide-react';

interface ContentPipelineWidgetProps {
    contentItems: ContentItem[];
    onNavigate: (view: string) => void;
    onUpdateContent: (id: string, updates: Partial<ContentItem>) => void;
}

const PIPELINE_STAGES = [
    { status: ContentStatus.Raw, label: 'Raw', color: 'bg-neutral-600', textColor: 'text-neutral-400', emoji: '📦' },
    { status: ContentStatus.Editing, label: 'Editing', color: 'bg-amber-500', textColor: 'text-amber-400', emoji: '✂️' },
    { status: ContentStatus.Ready, label: 'Ready', color: 'bg-blue-500', textColor: 'text-blue-400', emoji: '✅' },
    { status: ContentStatus.Approved, label: 'Approved', color: 'bg-emerald-500', textColor: 'text-emerald-400', emoji: '🟢' },
    { status: ContentStatus.Posted, label: 'Posted', color: 'bg-purple-500', textColor: 'text-purple-400', emoji: '🚀' },
];

const ContentPipelineWidget: React.FC<ContentPipelineWidgetProps> = ({ contentItems, onNavigate, onUpdateContent }) => {
    try {
        const counts = PIPELINE_STAGES.map(stage => ({
            ...stage,
            count: contentItems.filter(c => c.status === stage.status).length,
        }));

        const total = contentItems.length || 1;

        return (
            <div className="bg-ooedn-gray border border-neutral-800 rounded-3xl p-5 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                        <Sparkles size={16} className="text-purple-500" /> Content Pipeline
                        <span className="text-neutral-600 font-mono text-[10px] ml-2">{contentItems.length} total</span>
                    </h3>
                    <button
                        onClick={() => onNavigate('asset-pool')}
                        className="text-[9px] font-black uppercase tracking-widest text-neutral-500 hover:text-white transition-colors flex items-center gap-1"
                    >
                        Manage <ArrowRight size={10} />
                    </button>
                </div>

                {/* Funnel Bar */}
                <div className="flex rounded-xl overflow-hidden h-7 mb-4 bg-neutral-900">
                    {counts.map((stage) => {
                        const width = Math.max((stage.count / total) * 100, stage.count > 0 ? 8 : 0);
                        return (
                            <div
                                key={stage.status}
                                className={`${stage.color} flex items-center justify-center transition-all duration-500`}
                                style={{ width: `${width}%` }}
                                title={`${stage.label}: ${stage.count}`}
                            >
                                {stage.count > 0 && (
                                    <span className="text-[10px] font-black text-white/90">{stage.count}</span>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Compact Stats Row */}
                <div className="flex gap-2">
                    {counts.map(stage => (
                        <div
                            key={stage.status}
                            className={`flex-1 bg-black/30 rounded-lg px-3 py-2 border ${stage.status === ContentStatus.Raw && stage.count > 0 ? 'border-fuchsia-500/40 bg-fuchsia-500/5' : 'border-neutral-800/50'} flex items-center justify-between`}
                        >
                            <span className={`text-[9px] font-black uppercase tracking-wider ${stage.textColor}`}>
                                {stage.emoji} {stage.label}
                            </span>
                            <span className="text-sm font-black text-white flex items-center gap-1">
                                {stage.status === ContentStatus.Raw && stage.count > 0 && (
                                    <span className="w-2 h-2 bg-fuchsia-500 rounded-full animate-pulse" />
                                )}
                                {stage.count}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    } catch (e) {
        console.warn('[ContentPipeline] Render error (non-blocking):', e);
        return null;
    }
};

export default ContentPipelineWidget;
