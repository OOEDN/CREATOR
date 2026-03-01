import React, { useState } from 'react';
import { Creator, BetaTest, BetaRelease, CreatorAccount } from '../../types';
import {
    FlaskConical, FileText, Package, Star, CheckCircle, Lock,
    Calendar, Camera, Clock, AlertTriangle, Shield, Sparkles, Eye, X,
    Zap, Rocket, Gift, Heart, ArrowRight, TestTubes
} from 'lucide-react';

interface Props {
    creator: Creator;
    account: CreatorAccount;
    betaTests: BetaTest[];
    betaReleases: BetaRelease[];
    onSignRelease: (betaTestId: string) => void;
    onMarkSampleReceived: (betaTestId: string) => void;
    onSubmitReview: (betaTestId: string, rating: number, text: string) => void;
    onNavigate: (view: string) => void;
    onDismissIntro: () => void;
}

const RELEASE_TEXT = `OOEDN BETA TESTING AGREEMENT

By participating in the OOEDN Beta Testing Program, you agree to:

1. CONFIDENTIALITY — All beta products, samples, and pre-release materials are confidential. You may not share, photograph, or discuss beta items publicly until the team-confirmed embargo date.

2. CONTENT POSTING — Any content created about beta products may ONLY be published after the confirmed post date provided by the OOEDN team.

3. TEAM APPROVAL — All beta-related content must be reviewed and approved by the OOEDN team before posting.

4. HONEST FEEDBACK — You agree to provide honest, constructive feedback on all beta products.

5. SAMPLE RETURN — Beta samples remain OOEDN property until confirmed you may keep them.

6. TERMINATION — OOEDN reserves the right to remove you from the beta program if terms are violated.`;

const CreatorBetaLab: React.FC<Props> = ({ creator, account, betaTests, betaReleases, onSignRelease, onMarkSampleReceived, onSubmitReview, onNavigate, onDismissIntro }) => {
    // Only show launched tests assigned to this creator
    const myTests = betaTests.filter(t => t.launched && t.assignedCreatorIds?.includes(creator.id));
    const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
    const [showRelease, setShowRelease] = useState(false);
    const [releaseAgreed, setReleaseAgreed] = useState(false);
    const [showReview, setShowReview] = useState(false);
    const [reviewRating, setReviewRating] = useState(0);
    const [reviewText, setReviewText] = useState('');
    const [hoverRating, setHoverRating] = useState(0);

    const selectedTest = myTests.find(t => t.id === selectedTestId);
    const getRelease = (testId: string) => betaReleases.find(r => r.betaTestId === testId && r.creatorId === creator.id);

    const formatDate = (iso?: string) => {
        if (!iso) return '';
        try { return new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }); } catch { return ''; }
    };

    const getStatus = (test: BetaTest) => {
        const release = getRelease(test.id);
        if (!release || !release.agreed) return { label: 'Sign Release', emoji: '📋', color: 'text-yellow-400 bg-yellow-500/10', step: 1 };
        if (!release.sampleShipped) return { label: 'Awaiting Sample', emoji: '⏳', color: 'text-blue-400 bg-blue-500/10', step: 2 };
        if (!release.sampleReceived) return { label: 'Sample Shipped', emoji: '📦', color: 'text-purple-400 bg-purple-500/10', step: 3 };
        if (!release.reviewSubmitted) return { label: 'Review Sample', emoji: '⭐', color: 'text-amber-400 bg-amber-500/10', step: 4 };
        if (!release.contentApprovedByTeam) return { label: 'Pending Approval', emoji: '⏳', color: 'text-orange-400 bg-orange-500/10', step: 5 };
        return { label: 'Approved', emoji: '✅', color: 'text-emerald-400 bg-emerald-500/10', step: 6 };
    };

    const handleSignRelease = () => {
        if (!selectedTestId || !releaseAgreed) return;
        onSignRelease(selectedTestId);
        setShowRelease(false);
        setReleaseAgreed(false);
    };

    const handleSubmitReview = () => {
        if (!selectedTestId || !reviewRating) return;
        onSubmitReview(selectedTestId, reviewRating, reviewText);
        setShowReview(false);
        setReviewRating(0);
        setReviewText('');
    };

    // ── INTRO SCREEN ──────────────────────────────────────────
    if (!account.betaLabIntroSeen) {
        return (
            <div className="max-w-xl mx-auto">
                <div className="relative bg-gradient-to-b from-neutral-900/80 to-black border border-neutral-800 rounded-3xl overflow-hidden">
                    {/* Animated background glow */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute top-10 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/5 rounded-full blur-[80px] animate-pulse" />

                    <div className="relative z-10 p-8 text-center">
                        {/* Icon */}
                        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 rounded-3xl flex items-center justify-center animate-bounce">
                            <FlaskConical size={36} className="text-emerald-400" />
                        </div>

                        <h1 className="text-3xl font-black text-white uppercase tracking-tight mb-2">
                            Beta Lab
                        </h1>
                        <p className="text-emerald-400 text-sm font-bold uppercase tracking-widest mb-8">
                            Exclusive Early Access
                        </p>

                        {/* Hero question */}
                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 mb-6">
                            <h2 className="text-xl font-black text-white mb-3">
                                Want to test new products<br />
                                <span className="text-emerald-400">before they come out?</span> 🧪
                            </h2>
                            <p className="text-neutral-400 text-sm leading-relaxed">
                                Be part of how they're made. Get exclusive samples shipped directly to you,
                                share your honest feedback, and help shape products before the world even knows they exist.
                            </p>
                        </div>

                        {/* Perks */}
                        <div className="space-y-3 mb-8 text-left">
                            {[
                                { icon: Gift, color: 'text-pink-400', bg: 'bg-pink-500/5 border-pink-500/20', text: 'Free samples shipped to your door', emoji: '🎁' },
                                { icon: Rocket, color: 'text-purple-400', bg: 'bg-purple-500/5 border-purple-500/20', text: 'Be the first to try unreleased products', emoji: '🚀' },
                                { icon: Star, color: 'text-amber-400', bg: 'bg-amber-500/5 border-amber-500/20', text: 'Your feedback directly shapes the final product', emoji: '⭐' },
                                { icon: Camera, color: 'text-blue-400', bg: 'bg-blue-500/5 border-blue-500/20', text: 'Exclusive content opportunities nobody else has', emoji: '📸' },
                                { icon: Heart, color: 'text-red-400', bg: 'bg-red-500/5 border-red-500/20', text: 'Build a deeper connection with the brand', emoji: '💜' },
                                { icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-500/5 border-yellow-500/20', text: 'Priority access to future collabs & drops', emoji: '⚡' },
                            ].map((perk, i) => (
                                <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${perk.bg} transition-all hover:scale-[1.01]`}>
                                    <span className="text-lg flex-shrink-0">{perk.emoji}</span>
                                    <span className="text-sm text-white font-medium">{perk.text}</span>
                                </div>
                            ))}
                        </div>

                        {/* How it works */}
                        <div className="bg-black/50 border border-neutral-800 rounded-2xl p-5 mb-6">
                            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-3">How It Works</p>
                            <div className="flex items-center justify-between text-center gap-1">
                                {[
                                    { step: '1', label: 'Get Invited', emoji: '📬' },
                                    { step: '2', label: 'Sign Release', emoji: '✍️' },
                                    { step: '3', label: 'Receive Sample', emoji: '📦' },
                                    { step: '4', label: 'Review & Create', emoji: '⭐' },
                                    { step: '5', label: 'Post on Date', emoji: '🎬' },
                                ].map((s, i) => (
                                    <React.Fragment key={i}>
                                        <div className="flex-1">
                                            <div className="text-xl mb-1">{s.emoji}</div>
                                            <p className="text-[9px] text-neutral-400 font-bold">{s.label}</p>
                                        </div>
                                        {i < 4 && <ArrowRight size={10} className="text-neutral-700 flex-shrink-0" />}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>

                        {/* Important note */}
                        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 mb-6 flex items-start gap-3 text-left">
                            <Shield size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs text-yellow-400 font-bold">Heads Up</p>
                                <p className="text-[10px] text-neutral-400 mt-0.5">
                                    Beta products are confidential. You'll sign a simple release for each test, and content
                                    can only be posted after the team confirms the date. It's all part of keeping the magic. ✨
                                </p>
                            </div>
                        </div>

                        {/* CTA */}
                        <button
                            onClick={onDismissIntro}
                            className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-black py-4 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 hover:from-emerald-400 hover:to-teal-400 transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
                        >
                            <Rocket size={16} /> I'm In — Let's Go! 🚀
                        </button>

                        <p className="text-[9px] text-neutral-600 mt-3">
                            When new tests are available, they'll appear right here.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // ── MAIN BETA LAB VIEW ────────────────────────────────────
    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center mb-2">
                <h2 className="text-2xl font-black text-white uppercase tracking-tight flex items-center justify-center gap-2">
                    <FlaskConical size={24} className="text-emerald-400" /> Beta Lab
                </h2>
                <p className="text-neutral-500 text-xs mt-1">Test exclusive products before they launch. Content subject to embargo.</p>
            </div>

            {/* Info Banner */}
            <div className="bg-gradient-to-r from-emerald-500/5 to-teal-500/5 border border-emerald-500/20 rounded-2xl p-4 flex items-start gap-3">
                <Shield size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-xs text-emerald-400 font-bold">Beta Testing Rules</p>
                    <p className="text-[10px] text-neutral-400 mt-0.5">All content requires team approval. Post only after embargo dates. Each test requires a signed release agreement.</p>
                </div>
            </div>

            {myTests.length === 0 ? (
                <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-12 text-center">
                    <div className="text-5xl mb-3">🧪</div>
                    <p className="text-neutral-400 text-sm font-bold">No beta tests available yet</p>
                    <p className="text-neutral-600 text-[10px] mt-1">When the team launches a new test for you, it'll show up here 🔬</p>
                    <div className="mt-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                        <p className="text-[10px] text-emerald-400">💡 You're opted in! The team will invite you when the next test drops.</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {myTests.map(test => {
                        const status = getStatus(test);
                        const release = getRelease(test.id);
                        const isSelected = selectedTestId === test.id;

                        return (
                            <div key={test.id} className="bg-neutral-900/80 border border-neutral-800 rounded-2xl overflow-hidden transition-all">
                                {/* Card Header */}
                                <button
                                    onClick={() => setSelectedTestId(isSelected ? null : test.id)}
                                    className="w-full p-5 text-left flex items-start gap-4 group"
                                >
                                    {/* Sample Image */}
                                    {test.sampleImageUrl ? (
                                        <img src={test.sampleImageUrl} alt={test.title} className="w-16 h-16 rounded-xl object-cover border border-neutral-800" />
                                    ) : (
                                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 flex items-center justify-center">
                                            <FlaskConical size={24} className="text-emerald-400" />
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <h3 className="text-white font-black text-lg group-hover:text-emerald-400 transition-colors">{test.title}</h3>
                                        <p className="text-neutral-500 text-xs mt-0.5 line-clamp-1">{test.description}</p>
                                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-lg flex items-center gap-1 ${status.color}`}>
                                                {status.emoji} {status.label}
                                            </span>
                                            {test.embargoDate && (
                                                <span className="text-[10px] text-neutral-500 font-bold flex items-center gap-1">
                                                    <Lock size={8} /> Embargo: {formatDate(test.embargoDate)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5, 6].map(s => (
                                            <div key={s} className={`w-1.5 h-6 rounded-full transition-all ${s <= status.step ? 'bg-emerald-500' : 'bg-neutral-800'}`} />
                                        ))}
                                    </div>
                                </button>

                                {/* Expanded Detail */}
                                {isSelected && (
                                    <div className="px-5 pb-5 space-y-4 border-t border-neutral-800 pt-4">
                                        <div className="bg-black/50 rounded-xl p-4 border border-neutral-800">
                                            <p className="text-[10px] text-neutral-500 font-bold uppercase mb-1">About This Beta Test</p>
                                            <p className="text-sm text-neutral-300 leading-relaxed">{test.description}</p>
                                        </div>

                                        {test.styleNotes && (
                                            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                                                <p className="text-[10px] text-emerald-400 font-bold uppercase mb-1 flex items-center gap-1">
                                                    <Sparkles size={10} /> Style Direction
                                                </p>
                                                <p className="text-xs text-neutral-300 leading-relaxed">{test.styleNotes}</p>
                                            </div>
                                        )}

                                        {test.embargoDate && (
                                            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                                                <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-xs text-red-400 font-bold">Embargo Active</p>
                                                    <p className="text-[10px] text-neutral-400 mt-0.5">
                                                        Do NOT post any content about this product until <span className="text-white font-bold">{formatDate(test.embargoDate)}</span>.
                                                        {test.embargoConfirmedByTeam ? ' ✅ Date confirmed by team.' : ' ⏳ Date pending team confirmation.'}
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {(!release || !release.agreed) && (
                                            <button onClick={() => setShowRelease(true)}
                                                className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-black py-3 rounded-xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 hover:from-yellow-400 hover:to-orange-400 transition-all active:scale-95 shadow-lg shadow-yellow-500/20">
                                                <FileText size={14} /> Sign Release Agreement
                                            </button>
                                        )}

                                        {release?.agreed && release?.sampleShipped && !release?.sampleReceived && (
                                            <button onClick={() => onMarkSampleReceived(test.id)}
                                                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 hover:from-purple-400 hover:to-pink-400 transition-all active:scale-95">
                                                <Package size={14} /> I Received My Sample 📦
                                            </button>
                                        )}

                                        {release?.agreed && release?.sampleReceived && !release?.reviewSubmitted && (
                                            <button onClick={() => setShowReview(true)}
                                                className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 text-black py-3 rounded-xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 hover:from-amber-400 hover:to-yellow-400 transition-all active:scale-95">
                                                <Star size={14} /> Write Your Review ⭐
                                            </button>
                                        )}

                                        {release?.reviewSubmitted && !release?.contentApprovedByTeam && (
                                            <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4 text-center">
                                                <Clock size={16} className="text-orange-400 mx-auto mb-2" />
                                                <p className="text-xs text-orange-400 font-bold">Content Under Review</p>
                                                <p className="text-[10px] text-neutral-500 mt-1">The team is reviewing your beta content. You'll be notified when it's approved.</p>
                                            </div>
                                        )}

                                        {release?.contentApprovedByTeam && (
                                            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 text-center">
                                                <CheckCircle size={16} className="text-emerald-400 mx-auto mb-2" />
                                                <p className="text-xs text-emerald-400 font-bold">Content Approved! ✅</p>
                                                {release.contentPostDate ? (
                                                    <p className="text-[10px] text-neutral-400 mt-1">
                                                        You may post on or after <span className="text-white font-bold">{formatDate(release.contentPostDate)}</span>
                                                    </p>
                                                ) : (
                                                    <p className="text-[10px] text-neutral-400 mt-1">Waiting for team to confirm post date.</p>
                                                )}
                                            </div>
                                        )}

                                        {release?.agreed && release?.sampleReceived && (
                                            <button onClick={() => onNavigate('upload')}
                                                className="w-full flex items-center justify-between p-3 bg-purple-500/5 border border-purple-500/20 rounded-xl hover:border-purple-500/40 transition-all group">
                                                <div className="flex items-center gap-2 text-purple-400">
                                                    <Camera size={14} />
                                                    <span className="text-xs font-bold">Upload beta content</span>
                                                </div>
                                            </button>
                                        )}

                                        {release?.reviewSubmitted && (
                                            <div className="bg-black/50 rounded-xl p-4 border border-neutral-800">
                                                <p className="text-[10px] text-neutral-500 font-bold uppercase mb-2">Your Review</p>
                                                <div className="flex items-center gap-1 mb-2">
                                                    {[1, 2, 3, 4, 5].map(s => (
                                                        <Star key={s} size={14} className={s <= (release.reviewRating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-neutral-700'} />
                                                    ))}
                                                </div>
                                                {release.reviewText && <p className="text-xs text-neutral-300">{release.reviewText}</p>}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* RELEASE MODAL */}
            {showRelease && selectedTest && (
                <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-auto">
                        <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Shield size={18} className="text-yellow-400" />
                                <h3 className="text-white font-black uppercase text-sm">Release Agreement</h3>
                            </div>
                            <button onClick={() => { setShowRelease(false); setReleaseAgreed(false); }} className="text-neutral-500 hover:text-white" title="Close">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="bg-black border border-neutral-800 rounded-xl p-4 mb-4 max-h-60 overflow-auto">
                                <pre className="text-[10px] text-neutral-400 whitespace-pre-wrap font-mono leading-relaxed">{RELEASE_TEXT}</pre>
                            </div>
                            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 mb-4">
                                <p className="text-xs text-yellow-400 font-bold mb-2">For: {selectedTest.title}</p>
                                {selectedTest.embargoDate && (
                                    <p className="text-[10px] text-neutral-400">Embargo until: <span className="text-white font-bold">{formatDate(selectedTest.embargoDate)}</span></p>
                                )}
                            </div>
                            <label className="flex items-start gap-3 cursor-pointer mb-4">
                                <input type="checkbox" checked={releaseAgreed} onChange={e => setReleaseAgreed(e.target.checked)} className="mt-0.5 accent-yellow-500" />
                                <span className="text-xs text-white">I have read, understood, and agree to the OOEDN Beta Testing Agreement. I understand that violating these terms may result in removal from the program.</span>
                            </label>
                            <button onClick={handleSignRelease} disabled={!releaseAgreed}
                                className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-black py-3 rounded-xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 disabled:opacity-30 hover:from-yellow-400 hover:to-orange-400 transition-all active:scale-95">
                                <FileText size={14} /> Sign Agreement ✍️
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* REVIEW MODAL */}
            {showReview && selectedTest && (
                <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg">
                        <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Star size={18} className="text-amber-400" />
                                <h3 className="text-white font-black uppercase text-sm">Review: {selectedTest.title}</h3>
                            </div>
                            <button onClick={() => { setShowReview(false); setReviewRating(0); setReviewText(''); }} className="text-neutral-500 hover:text-white" title="Close">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="text-center">
                                <p className="text-[10px] text-neutral-500 font-bold uppercase mb-3">Rate this product</p>
                                <div className="flex items-center justify-center gap-2">
                                    {[1, 2, 3, 4, 5].map(s => (
                                        <button key={s} onMouseEnter={() => setHoverRating(s)} onMouseLeave={() => setHoverRating(0)}
                                            onClick={() => setReviewRating(s)} className="transition-transform hover:scale-125" title={`${s} star${s > 1 ? 's' : ''}`}>
                                            <Star size={32} className={`transition-colors ${s <= (hoverRating || reviewRating) ? 'text-yellow-400 fill-yellow-400' : 'text-neutral-700'}`} />
                                        </button>
                                    ))}
                                </div>
                                {reviewRating > 0 && (
                                    <p className="text-xs text-yellow-400 font-bold mt-2">
                                        {['', '😕 Needs Work', '🤔 Okay', '😊 Good', '🔥 Great', '⭐ Amazing!'][reviewRating]}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-1" htmlFor="beta-review-text">Your Honest Review</label>
                                <textarea id="beta-review-text" value={reviewText} onChange={e => setReviewText(e.target.value)}
                                    placeholder="What did you think? Quality, packaging, usability, first impressions, suggestions..."
                                    className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:border-amber-500 outline-none h-28 resize-none" />
                            </div>
                            <button onClick={handleSubmitReview} disabled={!reviewRating}
                                className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 text-black py-3 rounded-xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 disabled:opacity-30 hover:from-amber-400 hover:to-yellow-400 transition-all active:scale-95">
                                <CheckCircle size={14} /> Submit Review
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CreatorBetaLab;
