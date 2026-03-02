import React, { useState } from 'react';
import { Creator, ContentItem, PaymentStatus } from '../../types';
import {
    CreditCard, Clock, CheckCircle, AlertCircle, Send, DollarSign,
    Video, Image, Check, Sparkles, TrendingUp, Download
} from 'lucide-react';

interface Props {
    creator: Creator;
    contentItems: ContentItem[];
    onRequestPayment: (selectedContentIds: string[], totalAmount: number) => void;
}

const CreatorPayments: React.FC<Props> = ({ creator, contentItems, onRequestPayment }) => {
    const [justRequested, setJustRequested] = useState(false);
    const [showChaChingAnim, setShowChaChingAnim] = useState(false);
    const myContent = contentItems.filter(c =>
        (c.creatorId === creator.id || c.creatorName === creator.name) && !c.paymentRequested
    );
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAll = () => {
        if (selectedIds.size === myContent.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(myContent.map(c => c.id)));
        }
    };

    const perVideoRate = creator.rate || 0;
    const totalAmount = selectedIds.size * perVideoRate;
    const paidContent = contentItems.filter(c =>
        (c.creatorId === creator.id || c.creatorName === creator.name) && c.paymentRequested
    );

    const handleRequest = () => {
        if (selectedIds.size === 0) return;
        onRequestPayment(Array.from(selectedIds), totalAmount);
        setShowChaChingAnim(true);
        setJustRequested(true);
        setTimeout(() => { setShowChaChingAnim(false); setJustRequested(false); }, 4000);
        setSelectedIds(new Set());
    };

    const statusConfig = {
        [PaymentStatus.Unpaid]: {
            icon: AlertCircle, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20',
            label: 'Ready to Request', desc: 'Select your videos below and request payment 💰'
        },
        [PaymentStatus.Processing]: {
            icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20',
            label: 'Payment Processing ⏳', desc: 'Your payment request is being reviewed.'
        },
        [PaymentStatus.Paid]: {
            icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20',
            label: 'Paid! 🎉', desc: 'Your latest payment has been completed.'
        },
    };

    const status = statusConfig[creator.paymentStatus] || statusConfig[PaymentStatus.Unpaid];
    const StatusIcon = status.icon;

    const formatDate = (iso?: string) => {
        if (!iso) return 'N/A';
        try { return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return iso; }
    };

    // Proxy GCS URLs through server so browser can load them without auth headers
    const proxyUrl = (url: string) => {
        if (url.includes('storage.googleapis.com')) {
            return `/api/media-proxy?url=${encodeURIComponent(url)}`;
        }
        return url;
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Cha-ching animation */}
            {showChaChingAnim && (
                <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
                    <div className="animate-bounce text-6xl">💸</div>
                    <style>{`
            @keyframes chaChingGlow { 0% { opacity: 0; transform: scale(0.5); } 50% { opacity: 1; transform: scale(1.2); } 100% { opacity: 0; transform: scale(1.5); } }
          `}</style>
                </div>
            )}

            <div className="text-center mb-2">
                <h2 className="text-2xl font-black text-white uppercase tracking-tight flex items-center justify-center gap-2">
                    <DollarSign size={24} className="text-emerald-400" /> Payments
                </h2>
                <p className="text-neutral-500 text-xs mt-1">Select your completed videos and request payment</p>
            </div>

            {/* STATUS CARD */}
            <div className={`${status.bg} border rounded-2xl p-5`}>
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-black/30 flex items-center justify-center">
                        <StatusIcon size={22} className={status.color} />
                    </div>
                    <div>
                        <p className={`text-lg font-black ${status.color}`}>{status.label}</p>
                        <p className="text-sm text-neutral-400">{status.desc}</p>
                    </div>
                </div>
            </div>

            {/* LAST PAYMENT RECEIPT */}
            {(creator.lastPaymentProof || creator.lastPaymentDate) && (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5">
                    <h3 className="text-sm font-black uppercase tracking-widest text-emerald-400 mb-3 flex items-center gap-2">
                        <Download size={14} /> Last Payment Receipt
                    </h3>
                    <div className="flex items-start gap-4">
                        {creator.lastPaymentProof && (
                            <a href={proxyUrl(creator.lastPaymentProof)} target="_blank" rel="noopener noreferrer"
                                className="w-24 h-24 rounded-xl border border-emerald-500/30 overflow-hidden flex-shrink-0 hover:border-emerald-400 transition-colors block">
                                <img src={proxyUrl(creator.lastPaymentProof)} alt="Payment Receipt" className="w-full h-full object-cover" />
                            </a>
                        )}
                        <div className="flex-1 space-y-2">
                            {creator.lastPaymentDate && (
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-neutral-500 uppercase">Date:</span>
                                    <span className="text-sm text-white font-bold">{formatDate(creator.lastPaymentDate)}</span>
                                </div>
                            )}
                            {creator.lastTransactionId && (
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-neutral-500 uppercase">Transaction:</span>
                                    <span className="text-sm text-neutral-300 font-mono">{creator.lastTransactionId}</span>
                                </div>
                            )}
                            {creator.rate > 0 && (
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-neutral-500 uppercase">Amount:</span>
                                    <span className="text-sm text-emerald-400 font-black">${creator.rate.toLocaleString()}</span>
                                </div>
                            )}
                            {creator.lastPaymentProof && (
                                <a href={proxyUrl(creator.lastPaymentProof)} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg hover:bg-emerald-500/20 transition-colors mt-1">
                                    <Download size={10} /> View Receipt
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* EARNINGS OVERVIEW */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-neutral-900/80 backdrop-blur-sm rounded-2xl p-4 border border-neutral-800 text-center">
                    <TrendingUp size={16} className="text-emerald-400 mx-auto mb-2" />
                    <p className="text-xl font-black text-emerald-400">${(creator.totalEarned || 0).toLocaleString()}</p>
                    <p className="text-[9px] text-neutral-600 font-bold uppercase">Total Earned</p>
                </div>
                <div className="bg-neutral-900/80 backdrop-blur-sm rounded-2xl p-4 border border-neutral-800 text-center">
                    <Video size={16} className="text-purple-400 mx-auto mb-2" />
                    <p className="text-xl font-black text-white">{paidContent.length}</p>
                    <p className="text-[9px] text-neutral-600 font-bold uppercase">Videos Paid</p>
                </div>
                <div className="bg-neutral-900/80 backdrop-blur-sm rounded-2xl p-4 border border-neutral-800 text-center">
                    <DollarSign size={16} className="text-yellow-400 mx-auto mb-2" />
                    <p className="text-xl font-black text-white">${perVideoRate.toLocaleString()}</p>
                    <p className="text-[9px] text-neutral-600 font-bold uppercase">Per Video</p>
                </div>
            </div>

            {/* SELECT VIDEOS FOR PAYMENT */}
            {myContent.length > 0 && creator.paymentStatus !== PaymentStatus.Paid && (
                <div className="bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black uppercase tracking-widest text-purple-400 flex items-center gap-2">
                            <Sparkles size={14} /> Select Videos
                        </h3>
                        <button onClick={selectAll} className="text-[10px] text-purple-400 font-bold hover:text-purple-300 bg-purple-500/10 px-3 py-1.5 rounded-lg">
                            {selectedIds.size === myContent.length ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                        {myContent.map(content => {
                            const isSelected = selectedIds.has(content.id);
                            return (
                                <button
                                    key={content.id}
                                    onClick={() => toggleSelect(content.id)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${isSelected
                                        ? 'bg-purple-500/10 border border-purple-500/30'
                                        : 'bg-black/50 border border-neutral-800 hover:border-neutral-700'
                                        }`}
                                >
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${isSelected ? 'bg-purple-500 text-black' : 'bg-neutral-800 text-neutral-600'
                                        }`}>
                                        {isSelected ? <Check size={14} /> : (content.type === 'Video' ? <Video size={14} /> : <Image size={14} />)}
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="text-sm font-bold text-white truncate">{content.title}</p>
                                        <p className="text-[10px] text-neutral-500">
                                            {content.platform} • {formatDate(content.uploadDate)}
                                        </p>
                                    </div>
                                    {isSelected && (
                                        <span className="text-sm font-black text-emerald-400">${perVideoRate}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* TOTAL & SUBMIT */}
                    {selectedIds.size > 0 && (
                        <div className="pt-3 border-t border-neutral-800">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm text-neutral-400">
                                    {selectedIds.size} video{selectedIds.size !== 1 ? 's' : ''} selected
                                </span>
                                <span className="text-2xl font-black text-emerald-400">${totalAmount.toLocaleString()}</span>
                            </div>
                            <button
                                onClick={handleRequest}
                                disabled={justRequested || creator.paymentStatus === PaymentStatus.Processing}
                                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-xl font-black uppercase tracking-widest text-sm hover:from-purple-400 hover:to-pink-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 active:scale-95"
                            >
                                {justRequested ? (
                                    <><CheckCircle size={16} /> Request Sent! 🎉</>
                                ) : (
                                    <><Send size={16} /> Request ${totalAmount.toLocaleString()}</>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* NO CONTENT MESSAGE */}
            {myContent.length === 0 && creator.paymentStatus !== PaymentStatus.Paid && (
                <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-8 text-center">
                    <div className="text-4xl mb-3">📹</div>
                    <p className="text-neutral-400 text-sm">Upload videos first to request payment</p>
                    <p className="text-neutral-600 text-[10px]">Head to the Upload tab to submit your content</p>
                </div>
            )}

            {/* PAYMENT HISTORY */}
            {paidContent.length > 0 && (
                <div className="bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-2xl p-5">
                    <h3 className="text-sm font-black uppercase tracking-widest text-emerald-400 mb-3 flex items-center gap-2">
                        <CheckCircle size={14} /> Paid Videos
                    </h3>
                    <div className="space-y-2">
                        {paidContent.slice(0, 5).map(c => (
                            <div key={c.id} className="flex items-center gap-3 p-2.5 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                                <CheckCircle size={12} className="text-emerald-400 flex-shrink-0" />
                                <span className="text-xs text-white truncate flex-1">{c.title}</span>
                                <span className="text-xs font-bold text-emerald-400">${c.paymentAmount || perVideoRate}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* PAYMENT METHODS */}
            {creator.paymentOptions && creator.paymentOptions.length > 0 && (
                <div className="bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-2xl p-5">
                    <h3 className="text-sm font-black uppercase tracking-widest text-purple-400 mb-3">Payment Methods</h3>
                    <div className="space-y-2">
                        {creator.paymentOptions.map((po, i) => (
                            <div key={i} className="flex items-center gap-3 bg-black/50 rounded-lg p-3 border border-neutral-800">
                                <CreditCard size={14} className="text-purple-400" />
                                <span className="text-sm text-white font-bold">{po.method}</span>
                                <span className="text-neutral-600">•</span>
                                <span className="text-sm text-neutral-400 truncate">{po.details}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CreatorPayments;
