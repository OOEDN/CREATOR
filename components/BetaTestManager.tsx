import React, { useState } from 'react';
import { BetaTest, BetaRelease, Creator } from '../types';
import {
    FlaskConical, Plus, X, Calendar, Users, Star, CheckCircle,
    Shield, Clock, Trash2, ChevronDown, ChevronUp, Package, FileText, Eye,
    Rocket, Send, AlertTriangle, Zap, Play, Pause, BarChart3
} from 'lucide-react';

interface Props {
    betaTests: BetaTest[];
    betaReleases: BetaRelease[];
    creators: Creator[];
    onSaveBetaTest: (test: BetaTest) => void;
    onDeleteBetaTest: (id: string) => void;
    onUpdateRelease: (release: BetaRelease) => void;
}

const BetaTestManager: React.FC<Props> = ({ betaTests, betaReleases, creators, onSaveBetaTest, onDeleteBetaTest, onUpdateRelease }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [editingTest, setEditingTest] = useState<BetaTest | null>(null);
    const [showLaunchConfirm, setShowLaunchConfirm] = useState<string | null>(null);
    const [expandedTestId, setExpandedTestId] = useState<string | null>(null);

    const handleCreate = () => {
        const newTest: BetaTest = {
            id: crypto.randomUUID(),
            title: '',
            description: '',
            status: 'draft',
            launched: false,
            createdAt: new Date().toISOString(),
            assignedCreatorIds: [],
        };
        setEditingTest(newTest);
    };

    const handleSave = () => {
        if (!editingTest || !editingTest.title.trim()) return;
        onSaveBetaTest({ ...editingTest, title: editingTest.title.trim() });
        setEditingTest(null);
    };

    const handleLaunch = (testId: string) => {
        const test = betaTests.find(t => t.id === testId);
        if (!test) return;
        onSaveBetaTest({ ...test, launched: true, status: 'open' });
        setShowLaunchConfirm(null);
    };

    const handlePause = (testId: string) => {
        const test = betaTests.find(t => t.id === testId);
        if (!test) return;
        onSaveBetaTest({ ...test, launched: false });
    };

    const toggleCreatorAssignment = (creatorId: string) => {
        if (!editingTest) return;
        const ids = editingTest.assignedCreatorIds || [];
        setEditingTest({
            ...editingTest,
            assignedCreatorIds: ids.includes(creatorId)
                ? ids.filter(id => id !== creatorId)
                : [...ids, creatorId],
        });
    };

    const getReleasesForTest = (testId: string) => betaReleases.filter(r => r.betaTestId === testId);

    const formatDate = (iso?: string) => {
        if (!iso) return '';
        try { return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return ''; }
    };

    const launchedCount = betaTests.filter(t => t.launched).length;
    const draftCount = betaTests.filter(t => !t.launched).length;

    return (
        <div className="mb-6">
            {/* Collapsible Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl hover:bg-emerald-500/10 transition-all group"
            >
                <div className="flex items-center gap-3">
                    <FlaskConical size={18} className="text-emerald-400" />
                    <span className="text-sm font-black text-white uppercase tracking-widest">Beta Testing Lab</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                        {betaTests.length} test{betaTests.length !== 1 ? 's' : ''}
                    </span>
                    {launchedCount > 0 && (
                        <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                            <Rocket size={8} /> {launchedCount} live
                        </span>
                    )}
                    {draftCount > 0 && (
                        <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full font-bold">
                            {draftCount} draft{draftCount !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>
                {isExpanded ? <ChevronUp size={14} className="text-emerald-400" /> : <ChevronDown size={14} className="text-neutral-500 group-hover:text-emerald-400" />}
            </button>

            {isExpanded && (
                <div className="mt-3 space-y-3">
                    {/* Create Button */}
                    <button onClick={handleCreate}
                        className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold hover:bg-emerald-500/5 transition-all">
                        <Plus size={14} /> Create New Beta Test
                    </button>

                    {/* Test Cards */}
                    {betaTests.map(test => {
                        const releases = getReleasesForTest(test.id);
                        const signedCount = releases.filter(r => r.agreed).length;
                        const reviewedCount = releases.filter(r => r.reviewSubmitted).length;
                        const approvedCount = releases.filter(r => r.contentApprovedByTeam).length;
                        const assignedCount = test.assignedCreatorIds.length;
                        const isExpDetail = expandedTestId === test.id;

                        return (
                            <div key={test.id} className={`bg-neutral-900/80 border rounded-2xl overflow-hidden transition-all ${test.launched ? 'border-emerald-500/30' : 'border-neutral-800'}`}>
                                {/* Header Row */}
                                <div className="p-4 flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                            <h4 className="text-white font-black text-sm truncate">{test.title}</h4>

                                            {/* Launch Status Badge */}
                                            {test.launched ? (
                                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase bg-emerald-500/10 text-emerald-400 flex items-center gap-1">
                                                    <Rocket size={8} /> Live
                                                </span>
                                            ) : (
                                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase bg-yellow-500/10 text-yellow-400">
                                                    Draft
                                                </span>
                                            )}

                                            {/* Status */}
                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${test.status === 'complete' ? 'bg-emerald-500/10 text-emerald-400' :
                                                    test.status === 'in-progress' ? 'bg-blue-500/10 text-blue-400' :
                                                        test.status === 'open' ? 'bg-green-500/10 text-green-400' :
                                                            'bg-neutral-800 text-neutral-500'
                                                }`}>{test.status}</span>
                                        </div>
                                        <p className="text-neutral-500 text-[10px] line-clamp-1">{test.description || 'No description'}</p>

                                        {/* Stats Row */}
                                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                                            <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                                                <Users size={10} /> {assignedCount} creator{assignedCount !== 1 ? 's' : ''}
                                            </span>
                                            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                                                <FileText size={10} /> {signedCount} signed
                                            </span>
                                            <span className="text-[10px] text-amber-400 flex items-center gap-1">
                                                <Star size={10} /> {reviewedCount} reviewed
                                            </span>
                                            <span className="text-[10px] text-purple-400 flex items-center gap-1">
                                                <CheckCircle size={10} /> {approvedCount} approved
                                            </span>
                                            {test.embargoDate && (
                                                <span className="text-[10px] text-red-400 flex items-center gap-1">
                                                    <Shield size={10} /> Embargo: {formatDate(test.embargoDate)}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        {/* Launch / Pause Button */}
                                        {!test.launched ? (
                                            <button
                                                onClick={() => {
                                                    if (test.assignedCreatorIds.length === 0) {
                                                        alert('Assign at least one creator before launching.');
                                                        setEditingTest(test);
                                                        return;
                                                    }
                                                    setShowLaunchConfirm(test.id);
                                                }}
                                                className="px-2.5 py-1.5 bg-emerald-500/10 text-emerald-400 text-[9px] font-black uppercase rounded-lg hover:bg-emerald-500/20 transition-colors flex items-center gap-1"
                                                title="Launch to creators"
                                            >
                                                <Rocket size={11} /> Launch
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handlePause(test.id)}
                                                className="px-2.5 py-1.5 bg-yellow-500/10 text-yellow-400 text-[9px] font-black uppercase rounded-lg hover:bg-yellow-500/20 transition-colors flex items-center gap-1"
                                                title="Pause (hide from creators)"
                                            >
                                                <Pause size={11} /> Pause
                                            </button>
                                        )}
                                        <button onClick={() => setExpandedTestId(isExpDetail ? null : test.id)} className="p-1.5 text-neutral-600 hover:text-white transition-colors rounded-lg hover:bg-neutral-800" title="Expand details">
                                            <BarChart3 size={14} />
                                        </button>
                                        <button onClick={() => setEditingTest(test)} className="p-1.5 text-neutral-600 hover:text-white transition-colors rounded-lg hover:bg-neutral-800" title="Edit">
                                            <Eye size={14} />
                                        </button>
                                        <button onClick={() => onDeleteBetaTest(test.id)} className="p-1.5 text-neutral-600 hover:text-red-400 transition-colors rounded-lg hover:bg-neutral-800" title="Delete">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded Creator Progress */}
                                {isExpDetail && test.assignedCreatorIds.length > 0 && (
                                    <div className="border-t border-neutral-800 px-4 py-3">
                                        <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest mb-2">Creator Progress</p>
                                        <div className="space-y-2">
                                            {test.assignedCreatorIds.map(cId => {
                                                const creator = creators.find(c => c.id === cId);
                                                const release = betaReleases.find(r => r.betaTestId === test.id && r.creatorId === cId);

                                                // Progress calculation
                                                let progressSteps = 0;
                                                if (release?.agreed) progressSteps = 1;
                                                if (release?.sampleShipped) progressSteps = 2;
                                                if (release?.sampleReceived) progressSteps = 3;
                                                if (release?.reviewSubmitted) progressSteps = 4;
                                                if (release?.contentApprovedByTeam) progressSteps = 5;

                                                return (
                                                    <div key={cId} className="bg-black/30 rounded-xl p-3 border border-neutral-800">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-neutral-200 font-bold text-xs">{creator?.name || 'Unknown'}</span>
                                                            <div className="flex items-center gap-1.5">
                                                                {/* Progress dots */}
                                                                {['📋', '✍️', '📦', '⭐', '✅'].map((emoji, i) => (
                                                                    <span key={i} className={`text-[10px] ${i < progressSteps ? '' : 'opacity-20'}`} title={['Assigned', 'Signed', 'Received', 'Reviewed', 'Approved'][i]}>{emoji}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        {/* Action buttons */}
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {release?.agreed && !release.sampleShipped && (
                                                                <button onClick={() => onUpdateRelease({ ...release, sampleShipped: true })}
                                                                    className="text-[9px] px-2.5 py-1 bg-blue-500/10 text-blue-400 font-bold rounded-lg hover:bg-blue-500/20 transition-colors flex items-center gap-1">
                                                                    <Send size={9} /> Ship Sample
                                                                </button>
                                                            )}
                                                            {release?.sampleShipped && !release.sampleReceived && (
                                                                <span className="text-[9px] text-purple-400 font-bold flex items-center gap-1">
                                                                    <Package size={9} /> Awaiting receipt...
                                                                </span>
                                                            )}
                                                            {release?.reviewSubmitted && !release.contentApprovedByTeam && (
                                                                <button onClick={() => onUpdateRelease({ ...release, contentApprovedByTeam: true, contentPostDate: test.embargoDate })}
                                                                    className="text-[9px] px-2.5 py-1 bg-emerald-500/10 text-emerald-400 font-bold rounded-lg hover:bg-emerald-500/20 transition-colors flex items-center gap-1">
                                                                    <CheckCircle size={9} /> Approve Content
                                                                </button>
                                                            )}
                                                            {release?.contentApprovedByTeam && (
                                                                <span className="text-[9px] text-emerald-400 font-bold">✅ All done!</span>
                                                            )}
                                                            {!release?.agreed && (
                                                                <span className="text-[9px] text-neutral-500">Waiting for creator to sign release...</span>
                                                            )}
                                                            {/* Show review details if submitted */}
                                                            {release?.reviewSubmitted && release.reviewRating && (
                                                                <div className="flex items-center gap-1 ml-auto">
                                                                    {[1, 2, 3, 4, 5].map(s => (
                                                                        <Star key={s} size={9} className={s <= release.reviewRating! ? 'text-yellow-400 fill-yellow-400' : 'text-neutral-700'} />
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {isExpDetail && test.assignedCreatorIds.length === 0 && (
                                    <div className="border-t border-neutral-800 px-4 py-3 text-center">
                                        <p className="text-[10px] text-neutral-600">No creators assigned. Edit this test to add creators.</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {betaTests.length === 0 && (
                        <div className="text-center py-8 text-neutral-600">
                            <FlaskConical size={24} className="mx-auto mb-2 opacity-30" />
                            <p className="text-[10px]">No beta tests yet. Create one to get started.</p>
                        </div>
                    )}
                </div>
            )}

            {/* LAUNCH CONFIRMATION */}
            {showLaunchConfirm && (() => {
                const test = betaTests.find(t => t.id === showLaunchConfirm);
                if (!test) return null;
                return (
                    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-neutral-900 border border-emerald-500/30 rounded-2xl w-full max-w-md">
                            <div className="p-6 text-center">
                                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 rounded-2xl flex items-center justify-center">
                                    <Rocket size={28} className="text-emerald-400" />
                                </div>
                                <h3 className="text-white font-black text-lg uppercase mb-2">Launch Beta Test?</h3>
                                <p className="text-neutral-400 text-sm mb-1">
                                    <span className="text-white font-bold">{test.title}</span>
                                </p>
                                <p className="text-neutral-500 text-xs mb-4">
                                    This will make the test visible to <span className="text-emerald-400 font-bold">{test.assignedCreatorIds.length} assigned creator{test.assignedCreatorIds.length !== 1 ? 's' : ''}</span> in their Beta Lab.
                                </p>

                                {/* Pre-launch checklist */}
                                <div className="bg-black/50 border border-neutral-800 rounded-xl p-4 mb-5 text-left space-y-2">
                                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-1">Pre-Launch Check</p>
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className={test.description ? 'text-emerald-400' : 'text-red-400'}>{test.description ? '✅' : '⚠️'}</span>
                                        <span className={test.description ? 'text-neutral-300' : 'text-red-400'}>Description {test.description ? 'set' : 'missing'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className={test.embargoDate ? 'text-emerald-400' : 'text-yellow-400'}>{test.embargoDate ? '✅' : '⏳'}</span>
                                        <span className={test.embargoDate ? 'text-neutral-300' : 'text-yellow-400'}>Embargo date {test.embargoDate ? formatDate(test.embargoDate) : 'not set (optional)'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className={test.assignedCreatorIds.length > 0 ? 'text-emerald-400' : 'text-red-400'}>{test.assignedCreatorIds.length > 0 ? '✅' : '⚠️'}</span>
                                        <span className={test.assignedCreatorIds.length > 0 ? 'text-neutral-300' : 'text-red-400'}>{test.assignedCreatorIds.length} creator{test.assignedCreatorIds.length !== 1 ? 's' : ''} assigned</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className={test.styleNotes ? 'text-emerald-400' : 'text-yellow-400'}>{test.styleNotes ? '✅' : '⏳'}</span>
                                        <span className={test.styleNotes ? 'text-neutral-300' : 'text-yellow-400'}>Style notes {test.styleNotes ? 'added' : 'not added (optional)'}</span>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <button onClick={() => setShowLaunchConfirm(null)}
                                        className="flex-1 bg-neutral-800 text-neutral-300 py-3 rounded-xl font-bold text-sm hover:bg-neutral-700 transition-colors">
                                        Cancel
                                    </button>
                                    <button onClick={() => handleLaunch(test.id)}
                                        className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-black py-3 rounded-xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 hover:from-emerald-400 hover:to-teal-400 transition-all active:scale-95">
                                        <Rocket size={14} /> Launch 🚀
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* EDIT MODAL */}
            {editingTest && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-auto">
                        <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
                            <h3 className="text-white font-black text-sm uppercase flex items-center gap-2">
                                <FlaskConical size={16} className="text-emerald-400" />
                                {editingTest.title ? 'Edit' : 'New'} Beta Test
                            </h3>
                            <button onClick={() => setEditingTest(null)} className="text-neutral-500 hover:text-white" title="Close">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-1" htmlFor="beta-title">Title</label>
                                <input id="beta-title" value={editingTest.title} onChange={e => setEditingTest({ ...editingTest, title: e.target.value })}
                                    className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none" placeholder="Spring '26 Fragrance Line" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-1" htmlFor="beta-desc">Description</label>
                                <textarea id="beta-desc" value={editingTest.description} onChange={e => setEditingTest({ ...editingTest, description: e.target.value })}
                                    className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none h-20 resize-none" placeholder="What are creators testing?" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-1" htmlFor="beta-embargo">Embargo Date</label>
                                    <input id="beta-embargo" type="date" value={editingTest.embargoDate?.split('T')[0] || ''} onChange={e => setEditingTest({ ...editingTest, embargoDate: e.target.value })}
                                        className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-1" htmlFor="beta-status">Status</label>
                                    <select id="beta-status" value={editingTest.status} onChange={e => setEditingTest({ ...editingTest, status: e.target.value as BetaTest['status'] })}
                                        className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none">
                                        <option value="draft">Draft</option>
                                        <option value="open">Open</option>
                                        <option value="in-progress">In Progress</option>
                                        <option value="complete">Complete</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-1" htmlFor="beta-notes">Style Notes for Creators</label>
                                <textarea id="beta-notes" value={editingTest.styleNotes || ''} onChange={e => setEditingTest({ ...editingTest, styleNotes: e.target.value })}
                                    className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none h-16 resize-none" placeholder="Tone, visual direction, dos and don'ts..." />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-1" htmlFor="beta-image">Sample Image URL</label>
                                <input id="beta-image" value={editingTest.sampleImageUrl || ''} onChange={e => setEditingTest({ ...editingTest, sampleImageUrl: e.target.value })}
                                    className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none" placeholder="https://..." />
                            </div>
                            {/* Embargo confirmation toggle */}
                            <label className="flex items-center gap-3 cursor-pointer bg-red-500/5 border border-red-500/20 rounded-xl p-3">
                                <input type="checkbox" checked={editingTest.embargoConfirmedByTeam || false}
                                    onChange={e => setEditingTest({ ...editingTest, embargoConfirmedByTeam: e.target.checked })}
                                    className="accent-red-500" />
                                <div>
                                    <span className="text-xs text-red-400 font-bold">Embargo Confirmed</span>
                                    <p className="text-[9px] text-neutral-500">Check when the embargo date is finalized</p>
                                </div>
                            </label>
                            {/* Creator Assignment */}
                            <div>
                                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-2">Assign Creators</label>
                                <div className="max-h-40 overflow-y-auto space-y-1">
                                    {creators.filter(c => c.status !== 'Blackburn').map(c => {
                                        const isAssigned = editingTest.assignedCreatorIds.includes(c.id);
                                        return (
                                            <button key={c.id} onClick={() => toggleCreatorAssignment(c.id)}
                                                className={`w-full flex items-center gap-2 p-2 rounded-lg text-left text-xs transition-all ${isAssigned ? 'bg-emerald-500/10 border border-emerald-500/30 text-white' : 'bg-black/50 border border-neutral-800 text-neutral-500 hover:border-neutral-700'}`}>
                                                {isAssigned && <CheckCircle size={12} className="text-emerald-400 flex-shrink-0" />}
                                                <span className="font-bold">{c.name}</span>
                                                {c.handle && <span className="text-neutral-600">{c.handle}</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Launch status info */}
                            {editingTest.launched && (
                                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-3">
                                    <Rocket size={14} className="text-emerald-400" />
                                    <div>
                                        <span className="text-xs text-emerald-400 font-bold">This test is LIVE</span>
                                        <p className="text-[9px] text-neutral-500">Creators can currently see this in their Beta Lab</p>
                                    </div>
                                </div>
                            )}

                            <button onClick={handleSave}
                                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-black py-3 rounded-xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 hover:from-emerald-400 hover:to-teal-400 transition-all active:scale-95">
                                <CheckCircle size={14} /> Save Beta Test
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BetaTestManager;
