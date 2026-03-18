import React, { useState } from 'react';
import { Creator, PaymentMethod, Platform } from '../../../shared/types';
import {
    User, Save, CheckCircle, Sparkles, Camera, Shield, Star,
    CreditCard, Plus, Trash2, Edit3, X, Award, Zap, Heart, Trophy, Lock
} from 'lucide-react';
import { getLevel, getLevelProgress, getNextLevel, ACHIEVEMENTS } from '../../../shared/services/creatorXP';

interface Props {
    creator: Creator;
    onUpdate: (updates: Partial<Creator>) => void;
}

const paymentIcons: Record<string, { emoji: string; gradient: string }> = {
    'Venmo': { emoji: '💙', gradient: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30' },
    'PayPal': { emoji: '💛', gradient: 'from-blue-600/20 to-teal-500/20 border-blue-600/30' },
    'Zelle': { emoji: '💜', gradient: 'from-teal-600/20 to-teal-500/20 border-teal-500/30' },
    'Bank Transfer': { emoji: '🏦', gradient: 'from-emerald-500/20 to-green-500/20 border-emerald-500/30' },
    'Gifted': { emoji: '🎁', gradient: 'from-pink-500/20 to-rose-500/20 border-pink-500/30' },
    'Other': { emoji: '💳', gradient: 'from-neutral-500/20 to-gray-500/20 border-neutral-500/30' },
    'None': { emoji: '❌', gradient: 'from-neutral-500/10 to-gray-500/10 border-neutral-700' },
};

const CreatorProfile: React.FC<Props> = ({ creator, onUpdate }) => {
    const [editMode, setEditMode] = useState(false);
    const [saved, setSaved] = useState(false);
    const [showAddPayment, setShowAddPayment] = useState(false);
    const [newMethod, setNewMethod] = useState<PaymentMethod>(PaymentMethod.Venmo);
    const [newDetails, setNewDetails] = useState('');
    const [editingPaymentIdx, setEditingPaymentIdx] = useState<number | null>(null);

    const [form, setForm] = useState({
        email: creator.email || '',
        address: creator.address || '',
        handle: creator.handle || '',
        paymentOptions: creator.paymentOptions || [],
    });

    const handleSave = () => {
        onUpdate({ ...form, editedByCreator: true, lastEditedByCreatorAt: new Date().toISOString() } as any);
        setEditMode(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    const addPaymentMethod = () => {
        if (!newDetails.trim()) return;
        const updated = [...form.paymentOptions, { method: newMethod, details: newDetails.trim(), addedByCreator: true, addedAt: new Date().toISOString() }];
        setForm(f => ({ ...f, paymentOptions: updated }));
        onUpdate({ paymentOptions: updated });
        setNewMethod(PaymentMethod.Venmo);
        setNewDetails('');
        setShowAddPayment(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const removePaymentMethod = (index: number) => {
        const updated = form.paymentOptions.filter((_, i) => i !== index);
        setForm(f => ({ ...f, paymentOptions: updated }));
        onUpdate({ paymentOptions: updated });
    };

    const updatePaymentOption = (index: number, field: 'method' | 'details', value: string) => {
        const updated = [...form.paymentOptions];
        if (field === 'method') {
            updated[index] = { ...updated[index], method: value as PaymentMethod };
        } else {
            updated[index] = { ...updated[index], details: value };
        }
        setForm(f => ({ ...f, paymentOptions: updated }));
    };

    const saveEditingPayment = () => {
        onUpdate({ paymentOptions: form.paymentOptions });
        setEditingPaymentIdx(null);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    // Level from XP engine
    const currentLevel = getLevel(creator.xp || 0);
    const nextLevel = getNextLevel(creator.xp || 0);
    const progressPercent = getLevelProgress(creator.xp || 0);
    const earnedSet = new Set(creator.achievements || []);
    const categories = ['content', 'campaigns', 'social', 'milestones', 'special'] as const;

    return (
        <div className="max-w-2xl mx-auto space-y-5">
            {/* HERO HEADER */}
            <div className="bg-gradient-to-br from-teal-700/20 via-cyan-500/10 to-teal-500/15 border border-teal-500/20 rounded-3xl p-6 relative overflow-hidden">
                <div className="absolute -top-20 -right-20 w-60 h-60 bg-teal-500/5 rounded-full blur-3xl" />
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-pink-500/5 rounded-full blur-3xl" />
                <div className="relative flex items-center gap-5">
                    <div className="relative group">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-600 to-cyan-500 flex items-center justify-center text-black font-black text-3xl shadow-xl shadow-teal-500/20 overflow-hidden">
                            {creator.profileImage ? (
                                <img src={creator.profileImage} alt={creator.name} className="w-full h-full object-cover" />
                            ) : (
                                creator.name?.[0]?.toUpperCase() || 'C'
                            )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-lg flex items-center justify-center border-2 border-black">
                            <CheckCircle size={10} className="text-black" />
                        </div>
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-2xl font-black text-white">{creator.name}</h2>
                            <Shield size={16} className="text-teal-400" />
                        </div>
                        <p className="text-sm text-neutral-400">{creator.handle} • {creator.platform}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${creator.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                creator.status === 'Long Term' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                    'bg-neutral-500/10 text-neutral-400 border border-neutral-700'
                                }`}>{creator.status === 'Active' ? '🟢' : '⚪'} {creator.status}</span>
                            {creator.rating && (
                                <span className="text-[10px] font-black text-yellow-400 bg-yellow-500/10 px-2.5 py-1 rounded-lg border border-yellow-500/20 flex items-center gap-1">
                                    <Star size={8} /> {creator.rating}
                                </span>
                            )}
                            <span className="text-[10px] font-black text-teal-400 bg-teal-500/10 px-2.5 py-1 rounded-lg border border-teal-500/20">
                                {currentLevel.emoji} {currentLevel.name}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-3 mt-5">
                    <div className="bg-black/30 backdrop-blur-sm rounded-xl p-3 text-center border border-white/5">
                        <p className="text-lg font-black text-emerald-400">${(creator.totalEarned || 0).toLocaleString()}</p>
                        <p className="text-[8px] text-neutral-500 font-bold uppercase tracking-widest">Lifetime Earned</p>
                    </div>
                    <div className="bg-black/30 backdrop-blur-sm rounded-xl p-3 text-center border border-white/5">
                        <p className="text-lg font-black text-teal-400">${(creator.rate || 0).toLocaleString()}</p>
                        <p className="text-[8px] text-neutral-500 font-bold uppercase tracking-widest">Per Video</p>
                    </div>
                    <div className="bg-black/30 backdrop-blur-sm rounded-xl p-3 text-center border border-white/5">
                        <p className="text-lg font-black text-white">{form.paymentOptions.length}</p>
                        <p className="text-[8px] text-neutral-500 font-bold uppercase tracking-widest">Pay Methods</p>
                    </div>
                </div>
            </div>

            {/* XP PROGRESS BAR */}
            <div className="bg-neutral-900/40 backdrop-blur-[80px] border border-teal-500/[0.08] rounded-2xl p-5 shadow-[0_8px_40px_rgba(127,181,181,0.06),inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-black uppercase tracking-widest text-teal-400 flex items-center gap-2">
                        <Zap size={14} /> Level {currentLevel.level} — {currentLevel.emoji} {currentLevel.name}
                    </h3>
                    <span className="text-[10px] font-bold text-neutral-500">{creator.xp || 0} XP</span>
                </div>
                <div className="h-3 bg-black/50 rounded-full overflow-hidden border border-neutral-800">
                    <div
                        className={`h-full rounded-full bg-gradient-to-r ${currentLevel.color} transition-all duration-1000`}
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
                <div className="flex justify-between mt-1.5">
                    <span className="text-[9px] text-neutral-600 font-bold">{currentLevel.emoji} {currentLevel.name}</span>
                    {nextLevel && <span className="text-[9px] text-neutral-600 font-bold">{nextLevel.emoji} {nextLevel.name} ({nextLevel.minXP} XP)</span>}
                </div>
                <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold text-amber-400">🔥 {creator.streak || 0} day streak</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Trophy size={10} className="text-teal-400" />
                        <span className="text-[9px] font-bold text-teal-400">{(creator.achievements || []).length}/{ACHIEVEMENTS.length} achievements</span>
                    </div>
                </div>
            </div>

            {/* CONTACT INFO */}
            <div className="bg-neutral-900/40 backdrop-blur-[80px] border border-teal-500/[0.08] rounded-2xl p-5 shadow-[0_8px_40px_rgba(127,181,181,0.06),inset_0_1px_0_rgba(255,255,255,0.06)] space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase tracking-widest text-teal-400 flex items-center gap-2">
                        <User size={14} /> Contact Info
                    </h3>
                    {!editMode ? (
                        <button onClick={() => setEditMode(true)} className="text-[10px] font-bold text-teal-400 hover:text-teal-300 bg-teal-500/10 px-3 py-1.5 rounded-lg flex items-center gap-1">
                            <Edit3 size={8} /> Edit
                        </button>
                    ) : (
                        <button onClick={handleSave} className="text-[10px] font-bold text-black bg-emerald-500 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-emerald-400 active:scale-95 transition-all">
                            <Save size={8} /> Save Changes
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1.5" htmlFor="profile-email">Email</label>
                        {editMode ? (
                            <input id="profile-email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                className="w-full bg-black border border-neutral-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500/50" />
                        ) : (
                            <p className="text-sm text-white bg-black/50 rounded-xl px-3 py-2.5 border border-neutral-800">{creator.email || '✏️ Not set'}</p>
                        )}
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1.5" htmlFor="profile-handle">Handle</label>
                        {editMode ? (
                            <input id="profile-handle" value={form.handle} onChange={e => setForm(f => ({ ...f, handle: e.target.value }))}
                                className="w-full bg-black border border-neutral-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500/50" />
                        ) : (
                            <p className="text-sm text-white bg-black/50 rounded-xl px-3 py-2.5 border border-neutral-800">{creator.handle || '✏️ Not set'}</p>
                        )}
                    </div>
                </div>

                <div>
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1.5" htmlFor="profile-address">Shipping Address</label>
                    {editMode ? (
                        <textarea id="profile-address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                            rows={2} className="w-full bg-black border border-neutral-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500/50 resize-none"
                            placeholder="Your shipping address for product seedings..." />
                    ) : (
                        <p className="text-sm text-white bg-black/50 rounded-xl px-3 py-2.5 border border-neutral-800">{creator.address || '✏️ Not set — add for product seedings'}</p>
                    )}
                </div>
            </div>

            {/* PAYMENT METHODS */}
            <div className="bg-neutral-900/40 backdrop-blur-[80px] border border-teal-500/[0.08] rounded-2xl p-5 shadow-[0_8px_40px_rgba(127,181,181,0.06),inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black uppercase tracking-widest text-teal-400 flex items-center gap-2">
                        <CreditCard size={14} /> Payment Methods
                    </h3>
                    <button
                        onClick={() => setShowAddPayment(true)}
                        className="flex items-center gap-1.5 text-[10px] font-black text-black bg-gradient-to-r from-teal-600 to-cyan-500 px-3 py-1.5 rounded-lg hover:from-teal-400 hover:to-cyan-400 transition-all active:scale-95 shadow-lg shadow-teal-500/20"
                    >
                        <Plus size={10} /> Add Method
                    </button>
                </div>

                {form.paymentOptions.length === 0 && !showAddPayment ? (
                    <div className="text-center py-8">
                        <div className="text-4xl mb-3">💳</div>
                        <p className="text-neutral-400 text-sm font-bold">No payment methods yet</p>
                        <p className="text-neutral-600 text-[10px] mb-4">Add a payment method so the team knows how to pay you</p>
                        <button
                            onClick={() => setShowAddPayment(true)}
                            className="inline-flex items-center gap-2 text-xs font-black text-black bg-gradient-to-r from-teal-600 to-cyan-500 px-5 py-2.5 rounded-xl hover:from-teal-400 hover:to-cyan-400 transition-all active:scale-95 shadow-lg shadow-teal-500/20"
                        >
                            <Plus size={12} /> Add Your First Payment Method 🎉
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {form.paymentOptions.map((po, i) => {
                            const config = paymentIcons[po.method] || paymentIcons['Other'];
                            const isEditing = editingPaymentIdx === i;

                            return (
                                <div
                                    key={i}
                                    className={`bg-gradient-to-r ${config.gradient} border rounded-xl p-4 transition-all group hover:scale-[1.01]`}
                                >
                                    {isEditing ? (
                                        <div className="space-y-3">
                                            <div className="flex gap-2">
                                                <select
                                                    value={po.method}
                                                    onChange={e => updatePaymentOption(i, 'method', e.target.value)}
                                                    title="Payment method"
                                                    className="bg-black border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                                                >
                                                    {Object.values(PaymentMethod).filter(m => m !== 'None').map(m => (
                                                        <option key={m} value={m}>{m}</option>
                                                    ))}
                                                </select>
                                                <input
                                                    value={po.details}
                                                    onChange={e => updatePaymentOption(i, 'details', e.target.value)}
                                                    placeholder="Username, email, or account #"
                                                    className="flex-1 bg-black border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-teal-500"
                                                />
                                            </div>
                                            <div className="flex gap-2 justify-end">
                                                <button onClick={() => setEditingPaymentIdx(null)} className="text-[10px] text-neutral-400 font-bold px-3 py-1.5 bg-neutral-800 rounded-lg hover:text-white">Cancel</button>
                                                <button onClick={saveEditingPayment} className="text-[10px] text-black font-bold px-3 py-1.5 bg-emerald-500 rounded-lg hover:bg-emerald-400 flex items-center gap-1">
                                                    <Save size={8} /> Save
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{config.emoji}</span>
                                            <div className="flex-1">
                                                <p className="text-sm font-black text-white">{po.method}</p>
                                                <p className="text-xs text-neutral-300">{po.details}</p>
                                            </div>
                                            <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => setEditingPaymentIdx(i)}
                                                    className="p-1.5 bg-white/10 rounded-lg hover:bg-white/20 text-white transition-all"
                                                    title="Edit"
                                                >
                                                    <Edit3 size={10} />
                                                </button>
                                                <button
                                                    onClick={() => removePaymentMethod(i)}
                                                    className="p-1.5 bg-red-500/10 rounded-lg hover:bg-red-500/20 text-red-400 transition-all"
                                                    title="Remove"
                                                >
                                                    <Trash2 size={10} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ADD PAYMENT METHOD FORM */}
                {showAddPayment && (
                    <div className="mt-4 bg-black/60 border border-teal-500/20 rounded-xl p-5 animate-in slide-in-from-top-2">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-xs font-black text-teal-400 uppercase tracking-widest flex items-center gap-2">
                                <Sparkles size={12} /> Add Payment Method
                            </h4>
                            <button onClick={() => setShowAddPayment(false)} className="text-neutral-600 hover:text-white">
                                <X size={14} />
                            </button>
                        </div>

                        {/* Method Selection Grid */}
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            {Object.values(PaymentMethod).filter(m => m !== 'None' && m !== 'Gifted').map(method => {
                                const config = paymentIcons[method] || paymentIcons['Other'];
                                const isSelected = newMethod === method;
                                return (
                                    <button
                                        key={method}
                                        onClick={() => setNewMethod(method)}
                                        className={`p-3 rounded-xl border text-center transition-all active:scale-95 ${isSelected
                                            ? 'border-teal-500 bg-teal-500/10 shadow-lg shadow-teal-500/10'
                                            : 'border-neutral-800 bg-neutral-900 hover:border-neutral-700'
                                            }`}
                                    >
                                        <span className="text-xl block mb-1">{config.emoji}</span>
                                        <span className={`text-[9px] font-bold uppercase tracking-wider ${isSelected ? 'text-teal-400' : 'text-neutral-500'}`}>
                                            {method}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Details Input */}
                        <div className="mb-4">
                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1.5" htmlFor="payment-details">
                                {newMethod === PaymentMethod.Venmo ? 'Venmo Username' :
                                    newMethod === PaymentMethod.PayPal ? 'PayPal Email' :
                                        newMethod === PaymentMethod.Zelle ? 'Zelle Phone or Email' :
                                            newMethod === PaymentMethod.Bank ? 'Bank Account Details' :
                                                'Account Details'}
                            </label>
                            <input
                                id="payment-details"
                                value={newDetails}
                                onChange={e => setNewDetails(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addPaymentMethod()}
                                placeholder={
                                    newMethod === PaymentMethod.Venmo ? '@username' :
                                        newMethod === PaymentMethod.PayPal ? 'your@email.com' :
                                            newMethod === PaymentMethod.Zelle ? '(555) 123-4567 or email' :
                                                newMethod === PaymentMethod.Bank ? 'Routing # / Account #' :
                                                    'Enter your details...'
                                }
                                className="w-full bg-black border border-neutral-700 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-teal-500/50"
                            />
                        </div>

                        <button
                            onClick={addPaymentMethod}
                            disabled={!newDetails.trim()}
                            className="w-full bg-gradient-to-r from-teal-600 to-cyan-500 text-black py-3 rounded-xl font-black uppercase tracking-widest text-sm hover:from-teal-400 hover:to-cyan-400 transition-all disabled:opacity-30 flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 active:scale-95"
                        >
                            <CreditCard size={14} /> Add {newMethod} 💸
                        </button>
                    </div>
                )}
            </div>

            {/* ACCOUNT INFO */}
            <div className="bg-neutral-900/40 backdrop-blur-[80px] border border-teal-500/[0.08] rounded-2xl p-5 shadow-[0_8px_40px_rgba(127,181,181,0.06),inset_0_1px_0_rgba(255,255,255,0.06)]">
                <h3 className="text-sm font-black uppercase tracking-widest text-neutral-500 mb-3 flex items-center gap-2">
                    <Shield size={14} /> Account
                </h3>
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-black/50 rounded-xl p-3 border border-neutral-800">
                        <p className="text-[9px] text-neutral-600 font-bold uppercase mb-0.5">Member Since</p>
                        <p className="text-xs text-white">{new Date(creator.dateAdded).toLocaleDateString([], { month: 'long', year: 'numeric' })}</p>
                    </div>
                    <div className="bg-black/50 rounded-xl p-3 border border-neutral-800">
                        <p className="text-[9px] text-neutral-600 font-bold uppercase mb-0.5">Platform</p>
                        <p className="text-xs text-white">{creator.platform}</p>
                    </div>
                    <div className="bg-black/50 rounded-xl p-3 border border-neutral-800">
                        <p className="text-[9px] text-neutral-600 font-bold uppercase mb-0.5">Payment Status</p>
                        <p className={`text-xs font-bold ${creator.paymentStatus === 'Paid' ? 'text-emerald-400' :
                            creator.paymentStatus === 'Processing' ? 'text-yellow-400' : 'text-neutral-400'
                            }`}>{creator.paymentStatus === 'Paid' ? '✅' : creator.paymentStatus === 'Processing' ? '⏳' : '⬜'} {creator.paymentStatus}</p>
                    </div>
                    <div className="bg-black/50 rounded-xl p-3 border border-neutral-800">
                        <p className="text-[9px] text-neutral-600 font-bold uppercase mb-0.5">Notifications</p>
                        <p className="text-xs text-white">{creator.notificationsEnabled ? '🔔 Enabled' : '🔕 Disabled'}</p>
                    </div>
                </div>
            </div>

            {/* PROFILE THEME */}
            <div className="bg-neutral-900/40 backdrop-blur-[80px] border border-teal-500/[0.08] rounded-2xl p-5 shadow-[0_8px_40px_rgba(127,181,181,0.06),inset_0_1px_0_rgba(255,255,255,0.06)]">
                <h3 className="text-sm font-black uppercase tracking-widest text-teal-400 flex items-center gap-2 mb-4">
                    <Sparkles size={14} /> Profile Theme
                </h3>
                <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest mb-3">Accent Color</p>
                <div className="flex flex-wrap gap-2">
                    {[
                        { id: '#7fb5b5', label: 'Teal' },
                        { id: '#8cc5c5', label: 'Pink' },
                        { id: '#06b6d4', label: 'Cyan' },
                        { id: '#10b981', label: 'Emerald' },
                        { id: '#f59e0b', label: 'Amber' },
                        { id: '#ef4444', label: 'Red' },
                        { id: '#3b82f6', label: 'Blue' },
                        { id: '#5a9e9e', label: 'Violet' },
                        { id: '#f97316', label: 'Orange' },
                        { id: '#14b8a6', label: 'Teal' },
                    ].map(color => {
                        const isActive = (creator.profileTheme?.accent || '#a855f7') === color.id;
                        return (
                            <button
                                key={color.id}
                                title={color.label}
                                onClick={() => onUpdate({ profileTheme: { ...(creator.profileTheme || {}), accent: color.id } })}
                                className={`w-8 h-8 rounded-xl border-2 transition-all active:scale-90 ${
                                    isActive ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'
                                }`}
                                style={{ background: color.id, boxShadow: isActive ? `0 0 16px ${color.id}50` : 'none' }}
                            />
                        );
                    })}
                </div>
            </div>

            {/* ACHIEVEMENTS GALLERY — pushed to bottom */}
            <div className="bg-neutral-900/40 backdrop-blur-[80px] border border-teal-500/[0.08] rounded-2xl p-5 shadow-[0_8px_40px_rgba(127,181,181,0.06),inset_0_1px_0_rgba(255,255,255,0.06)]">
                <h3 className="text-sm font-black uppercase tracking-widest text-teal-400 flex items-center gap-2 mb-4">
                    <Trophy size={14} /> Achievements
                </h3>
                {categories.map(cat => {
                    const catAchievements = ACHIEVEMENTS.filter(a => a.category === cat);
                    return (
                        <div key={cat} className="mb-4 last:mb-0">
                            <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mb-2">{cat}</p>
                            <div className="grid grid-cols-2 gap-2">
                                {catAchievements.map(ach => {
                                    const unlocked = earnedSet.has(ach.id);
                                    return (
                                        <div
                                            key={ach.id}
                                            className={`rounded-xl p-3 border transition-all ${
                                                unlocked
                                                    ? 'bg-teal-500/10 border-teal-500/20'
                                                    : 'bg-black/30 border-neutral-800 opacity-50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-lg">{unlocked ? ach.emoji : '🔒'}</span>
                                                <span className={`text-[10px] font-black ${unlocked ? 'text-white' : 'text-neutral-500'}`}>
                                                    {ach.name}
                                                </span>
                                            </div>
                                            <p className="text-[9px] text-neutral-500 leading-relaxed">{ach.description}</p>
                                            <p className="text-[8px] font-bold text-teal-400 mt-1">+{ach.xpReward} XP</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* SAVED TOAST */}
            {saved && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-emerald-500 text-black px-5 py-3 rounded-xl shadow-2xl shadow-emerald-500/30 animate-in slide-in-from-bottom-4 font-black text-sm">
                    <CheckCircle size={16} /> Saved! ✨
                </div>
            )}
        </div>
    );
};

export default CreatorProfile;
