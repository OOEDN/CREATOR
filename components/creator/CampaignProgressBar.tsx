import React from 'react';
import { Creator, Campaign, ContentItem, ContentStatus } from '../../types';
import { CheckCircle, Circle, ArrowRight } from 'lucide-react';

interface Props {
    campaign: Campaign;
    creator: Creator;
    contentItems: ContentItem[];
    compact?: boolean;
}

interface StepDef {
    key: string;
    label: string;
    emoji: string;
}

const STEPS: StepDef[] = [
    { key: 'brief',     label: 'Brief',     emoji: '📋' },
    { key: 'character',  label: 'Character', emoji: '⚔️' },
    { key: 'hook',       label: 'Hook',      emoji: '🎣' },
    { key: 'uploaded',   label: 'Uploaded',  emoji: '📤' },
    { key: 'approved',   label: 'Approved',  emoji: '✅' },
    { key: 'paid',       label: 'Paid',      emoji: '💰' },
];

function getCompletedSteps(campaign: Campaign, creator: Creator, contentItems: ContentItem[]): Set<string> {
    const done = new Set<string>();
    const creatorId = creator.id;

    // Brief — always done if campaign is assigned
    if (campaign.assignedCreatorIds?.includes(creatorId)) {
        done.add('brief');
    }

    // Character — creator has selected an avatar
    const avatars = campaign.avatars || [];
    const chosenAvatar = avatars.find(a => a.matchedCreatorIds?.includes(creatorId));
    if (chosenAvatar) {
        done.add('character');
    }

    // Hook — creator has selected an angle
    if (chosenAvatar) {
        const hasAngle = chosenAvatar.angles?.some(a => a.selectedByCreatorIds?.includes(creatorId));
        if (hasAngle) done.add('hook');
    }

    // Uploaded — creator has content for this campaign
    const myContent = contentItems.filter(c => c.creatorId === creatorId && c.campaignId === campaign.id);
    if (myContent.length > 0) {
        done.add('uploaded');
    }

    // Approved — team approved content
    if (myContent.some(c => c.approvedByTeam)) {
        done.add('approved');
    }

    // Paid — creator got paid
    if (myContent.some(c => c.status === ContentStatus.Posted) || creator.paymentStatus === 'Paid') {
        done.add('paid');
    }

    return done;
}

const CampaignProgressBar: React.FC<Props> = ({ campaign, creator, contentItems, compact = false }) => {
    const completedSteps = getCompletedSteps(campaign, creator, contentItems);
    const completedCount = STEPS.filter(s => completedSteps.has(s.key)).length;
    const percent = Math.round((completedCount / STEPS.length) * 100);

    if (compact) {
        return (
            <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-purple-500 to-emerald-500 transition-all duration-700"
                        style={{ width: `${percent}%` }}
                    />
                </div>
                <span className="text-[8px] font-bold text-neutral-500">{completedCount}/{STEPS.length}</span>
            </div>
        );
    }

    return (
        <div className="bg-black/20 backdrop-blur-[60px] rounded-xl p-4 border border-purple-500/[0.08] shadow-[0_4px_24px_rgba(127,181,181,0.04),inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Campaign Progress</span>
                <span className="text-[10px] font-bold text-purple-400">{percent}%</span>
            </div>
            <div className="flex items-center gap-1">
                {STEPS.map((step, idx) => {
                    const isDone = completedSteps.has(step.key);
                    // Find the current step (first incomplete)
                    const isCurrent = !isDone && (idx === 0 || completedSteps.has(STEPS[idx - 1].key));
                    return (
                        <React.Fragment key={step.key}>
                            <div className={`flex flex-col items-center gap-1 flex-1 ${
                                isDone ? '' : isCurrent ? 'animate-pulse' : 'opacity-40'
                            }`}>
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all ${
                                    isDone
                                        ? 'bg-emerald-500/20 border border-emerald-500/30'
                                        : isCurrent
                                            ? 'bg-purple-500/20 border border-purple-500/30'
                                            : 'bg-neutral-900 border border-neutral-800'
                                }`}>
                                    {isDone ? <CheckCircle size={12} className="text-emerald-400" /> : <span>{step.emoji}</span>}
                                </div>
                                <span className={`text-[7px] font-bold uppercase tracking-wider ${
                                    isDone ? 'text-emerald-400' : isCurrent ? 'text-purple-400' : 'text-neutral-600'
                                }`}>
                                    {step.label}
                                </span>
                            </div>
                            {idx < STEPS.length - 1 && (
                                <div className={`h-[1px] flex-1 max-w-[20px] ${
                                    isDone && completedSteps.has(STEPS[idx + 1]?.key) ? 'bg-emerald-500/40' : 'bg-neutral-800'
                                }`} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
};

export default CampaignProgressBar;
