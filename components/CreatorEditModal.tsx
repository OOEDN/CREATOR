import React, { useState, useRef, useEffect } from 'react';
import { Creator, CreatorStatus, PaymentMethod, Platform, CreatorRating, ContentItem, AppSettings, ShipmentStatus, PaymentOption, ReachPlatform, Shipment, CreatorAccount } from '../types';
import { X, Flag, Save, Trash2, LayoutGrid, FileImage, Truck, Camera, Sparkles, Loader2, Plus, CreditCard, MapPin, Mail, User, Link, Send, DownloadCloud, FileCheck, DollarSign, UserPlus, CheckCircle } from 'lucide-react';
import { RATING_COLORS, SHIPMENT_STATUS_COLORS, REACH_PLATFORM_COLORS } from '../constants';
import ContentLibrary from './ContentLibrary';
import { draftCreatorOutreach } from '../services/geminiService';
import { createGmailDraft } from '../services/googleWorkspaceService';
import { analyzeSentiment } from '../services/analysisService';
import ShipmentManager from './ShipmentManager';
import { sendPushNotification } from '../services/pushService';
import { sendEmail } from '../services/gmailService';
import { loadRemoteState, MasterDB } from '../services/cloudSync';
import { uploadJSONToGoogleCloud } from '../services/googleCloudStorage';

interface CreatorEditModalProps {
    creator: Creator;
    content: ContentItem[];
    onClose: () => void;
    onSave: (id: string, updates: Partial<Creator>) => void;
    onDelete: (id: string) => void;
    onContentUpload: (item: ContentItem) => Promise<void>;
    onUpdateContent: (id: string, updates: Partial<ContentItem>) => void;
    onDeleteContent: (id: string) => void;
    appSettings: AppSettings;
    initialShipmentId?: string | null;
}

const CreatorEditModal: React.FC<CreatorEditModalProps> = ({
    creator, content, onClose, onSave, onDelete,
    onContentUpload, onUpdateContent, onDeleteContent, appSettings, initialShipmentId
}) => {
    const [activeTab, setActiveTab] = useState<'details' | 'content' | 'outreach'>('details');
    const [formData, setFormData] = useState<Partial<Creator>>({ ...creator });
    const [customReach, setCustomReach] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [outreachDraft, setOutreachDraft] = useState('');
    const [isDrafting, setIsDrafting] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [sentiment, setSentiment] = useState<{ label: string, color: string } | null>(null);

    // Invite to Portal state
    const [isInviting, setIsInviting] = useState(false);
    const [inviteSent, setInviteSent] = useState(false);
    const [inviteError, setInviteError] = useState<string | null>(null);
    const [inviteEmail, setInviteEmail] = useState(creator.email || '');
    const [showInviteSection, setShowInviteSection] = useState(false);

    // Auto-analyze sentiment on mount if notes exist
    useEffect(() => {
        if (creator.notes && appSettings.googleCloudToken) {
            analyzeSentiment(creator.notes, appSettings.googleCloudToken).then(res => {
                if (res) setSentiment({ label: res.label, color: res.color });
            });
        }
    }, []);

    const handleChange = (field: keyof Creator, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleUpdatePaymentOption = (index: number, updates: Partial<PaymentOption>) => {
        const options = [...(formData.paymentOptions || [])];
        options[index] = { ...options[index], ...updates };
        handleChange('paymentOptions', options);
    };

    const handleAddPaymentOption = () => {
        const options = [...(formData.paymentOptions || [])];
        options.push({ method: PaymentMethod.None, details: '' });
        handleChange('paymentOptions', options);
    };

    const handleRemovePaymentOption = (index: number) => {
        const options = (formData.paymentOptions || []).filter((_, i) => i !== index);
        handleChange('paymentOptions', options);
    };

    const handleSave = () => {
        console.log(`[CreatorEditModal] handleSave called`, formData);
        onSave(creator.id, formData);
        onClose();
    };

    const handleGenerateOutreach = async (type: 'recruit' | 'followup' | 'payment') => {
        setIsDrafting(true);
        try {
            const draft = await draftCreatorOutreach(creator, type, formData.campaign, appSettings?.brandInfo);
            setOutreachDraft(draft || '');
        } catch (e) {
            alert('AI Drafting failed.');
        } finally {
            setIsDrafting(false);
        }
    };

    const handlePushToGmail = async () => {
        if (!outreachDraft || !formData.email) return alert("Missing email or draft content");
        if (!appSettings.googleCloudToken) return alert("Please log in to sync.");

        setIsSending(true);
        try {
            await createGmailDraft(formData.email, `OOEDN Collaboration: ${creator.name}`, outreachDraft, appSettings.googleCloudToken);
            alert("Draft saved to your Gmail Sent folder!");
        } catch (e: any) {
            alert(`Gmail Error: ${e.message}`);
        } finally {
            setIsSending(false);
        }
    };

    // --- SHIPMENT HANDLERS ---
    const handleAddShipment = (s: Shipment) => {
        const current = formData.shipments || [];
        handleChange('shipments', [s, ...current]);
        try { sendPushNotification('📦 Shipment Alert', `New package for ${creator.name} needs to go out`, '/', 'ooedn-shipment'); } catch (e) { }
    };

    const handleUpdateShipment = (id: string, updates: Partial<Shipment>) => {
        const current = formData.shipments || [];
        const updatedShipments = current.map(s => {
            if (s.id === id) {
                const updatedShipment = { ...s, ...updates };

                // Auto-update status to Shipped if tracking is added and it was Preparing
                if (updates.trackingNumber &&
                    updates.trackingNumber !== 'PENDING' &&
                    updatedShipment.status === ShipmentStatus.Preparing) {
                    updatedShipment.status = ShipmentStatus.Shipped;
                }
                return updatedShipment;
            }
            return s;
        });

        // Update local form state
        handleChange('shipments', updatedShipments);

        // INSTANT SAVE: Persist immediately to prevent data loss
        onSave(creator.id, { ...formData, shipments: updatedShipments });
    };

    const handleDeleteShipment = (id: string) => {
        const current = formData.shipments || [];
        handleChange('shipments', current.filter(s => s.id !== id));
    };

    const handleRequestShipping = () => {
        const newShipment: Shipment = {
            id: crypto.randomUUID(),
            title: `Product Send - ${new Date().toLocaleDateString()}`,
            carrier: 'Pending',
            trackingNumber: 'PENDING',
            status: ShipmentStatus.Preparing,
            dateShipped: new Date().toISOString(),
            requestedBy: 'System', // Could be current user if available
            notes: 'Shipping requested from Creator Profile'
        };
        const current = formData.shipments || [];
        handleChange('shipments', [newShipment, ...current]);
        alert(`Shipping request created for ${creator.name}. Please SAVE the profile to confirm.`);
    };

    const handleRequestPayment = () => {
        const rate = formData.rate || creator.rate || 0;
        const paymentMethods = (formData.paymentOptions || creator.paymentOptions || [])
            .filter(p => p.method !== 'None')
            .map(p => `${p.method}: ${p.details}`)
            .join(', ') || 'No payment method on file';

        // Update payment status to Processing
        handleChange('paymentStatus', 'Processing');
        onSave(creator.id, { ...formData, paymentStatus: 'Processing' as any });

        // Fire push notification to the whole team
        try {
            sendPushNotification(
                '💰 Payment Request',
                `${creator.name} (@${creator.handle}) has delivered and needs to be paid $${rate}. Method: ${paymentMethods}`,
                '/',
                'ooedn-payment-request'
            );
        } catch (e) { /* fire-and-forget */ }

        alert(`✅ Payment request sent!\n\nCreator: ${creator.name}\nAmount: $${rate}\nMethod: ${paymentMethods}\n\nYour team has been notified.`);
    };

    // --- INVITE TO PORTAL (via server endpoint) ---
    const handleInviteToPortal = async () => {
        const creatorEmail = inviteEmail.trim() || formData.email || creator.email;
        if (!creatorEmail) { setInviteError('Enter the creator\'s email address.'); return; }
        if (!appSettings.googleCloudToken) { setInviteError('Please log in to sync.'); return; }

        setIsInviting(true); setInviteError(null);
        handleChange('email', creatorEmail.toLowerCase().trim());
        try {
            // Generate a random password (emailed to creator in plain text)
            const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
            const password = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

            // Create account via server (password gets bcrypt-hashed server-side)
            const inviteResp = await fetch('/api/creator/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: creatorEmail.toLowerCase().trim(),
                    name: creator.name,
                    creatorId: creator.id,
                    plainPassword: password,
                })
            });
            const inviteData = await inviteResp.json();
            if (!inviteResp.ok) {
                setInviteError(inviteData.error || 'Invite failed');
                setIsInviting(false); return;
            }

            // Email credentials via Gmail (using admin's OAuth token)
            const portalUrl = 'https://ooedn-creators-270857128950.us-west1.run.app';
            const emailBody = `Hey ${creator.name}!\n\nYou've been invited to the OOEDN Creator Portal!\n\nHere are your login credentials:\n\nEmail: ${creatorEmail}\nPassword: ${password}\n\nPortal Link: ${portalUrl}\n\nLog in to view your campaigns, upload content, request payments, and chat with the team.\n\nWelcome aboard!\n\n-- The OOEDN Creative Team`;

            try {
                await sendEmail(
                    appSettings.googleCloudToken!,
                    creatorEmail,
                    'Welcome to the OOEDN Creator Portal!',
                    emailBody
                );
            } catch (emailErr: any) {
                console.warn('[Invite] Email send failed, but account was created:', emailErr);
                setInviteError(`Account created but email failed to send: ${emailErr.message}. Share credentials manually: ${creatorEmail} / ${password}`);
            }

            handleChange('portalEmail', creatorEmail.toLowerCase().trim());
            setInviteSent(true);
            setTimeout(() => setInviteSent(false), 5000);
        } catch (e: any) {
            setInviteError(`Invite failed: ${e.message}`);
        } finally {
            setIsInviting(false);
        }
    };

    const ratings: CreatorRating[] = ['A+', 'A', 'B', 'C', 'D', 'F'];
    const reachOptions = ['Brillo', 'Social Cat', 'Join Bands'];

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-ooedn-dark border border-neutral-700 rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-5 duration-300">

                <div className="p-8 border-b border-neutral-800 flex justify-between items-start bg-neutral-900/50">
                    <div className="flex items-center gap-6">
                        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                            <img src={formData.profileImage} alt={creator.name} className="w-20 h-20 rounded-full border-4 border-neutral-800 object-cover group-hover:opacity-50 transition-all shadow-xl" crossOrigin="anonymous" />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Camera size={24} className="text-white drop-shadow-lg" />
                            </div>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => handleChange('profileImage', reader.result as string);
                                    reader.readAsDataURL(f);
                                }
                            }} />
                        </div>
                        <div>
                            <input type="text" value={formData.name} onChange={(e) => handleChange('name', e.target.value)} className="bg-transparent text-3xl font-heading text-white border-none focus:outline-none focus:ring-0 placeholder-neutral-600 w-full uppercase tracking-tighter" placeholder="Creator Name" />
                            <input type="text" value={formData.handle} onChange={(e) => handleChange('handle', e.target.value)} className="bg-transparent text-emerald-400 text-lg font-bold border-none focus:outline-none focus:ring-0 placeholder-neutral-600 w-full" placeholder="@handle" />
                        </div>
                    </div>
                    <button onClick={onClose} className="text-neutral-500 hover:text-white p-2 transition-colors"><X size={32} /></button>
                </div>

                <div className="flex bg-neutral-900 border-b border-neutral-800">
                    <button onClick={() => setActiveTab('details')} className={`flex-1 py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'details' ? 'text-white border-b-4 border-emerald-500 bg-neutral-800/50' : 'text-neutral-500 hover:text-white'}`}>
                        <LayoutGrid size={18} /> Detailed Roster Info
                    </button>
                    <button onClick={() => setActiveTab('content')} className={`flex-1 py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'content' ? 'text-white border-b-4 border-emerald-500 bg-neutral-800/50' : 'text-neutral-500 hover:text-white'}`}>
                        <FileImage size={18} /> Media Vault ({content.length})
                    </button>
                    <button onClick={() => setActiveTab('outreach')} className={`flex-1 py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'outreach' ? 'text-white border-b-4 border-emerald-500 bg-neutral-800/50' : 'text-neutral-500 hover:text-white'}`}>
                        <Mail size={18} /> Outreach & Comms
                    </button>
                </div>

                <div className="p-8 overflow-y-auto space-y-8 flex-1 custom-scrollbar">
                    {/* Creator-entered data indicators */}
                    {(creator as any).editedByCreator && (
                        <div className="bg-teal-500/5 border border-teal-500/20 rounded-xl p-3 flex items-center gap-2">
                            <span className="text-teal-400 text-sm">👤</span>
                            <div>
                                <p className="text-[10px] font-black text-teal-400 uppercase tracking-widest">Creator Self-Edited Profile</p>
                                {(creator as any).lastEditedByCreatorAt && <p className="text-[9px] text-neutral-500">Last edited {new Date((creator as any).lastEditedByCreatorAt).toLocaleDateString()}</p>}
                            </div>
                        </div>
                    )}
                    {(creator as any).requestedBeta && (
                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-2">
                            <span className="text-emerald-400 text-sm">🧪</span>
                            <div>
                                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Beta Program Requested</p>
                                {(creator as any).requestedBetaAt && <p className="text-[9px] text-neutral-500">Requested {new Date((creator as any).requestedBetaAt).toLocaleDateString()}</p>}
                            </div>
                        </div>
                    )}
                    {activeTab === 'content' ? (
                        <ContentLibrary items={content} creatorId={creator.id} creatorName={creator.name} onUpload={onContentUpload} onUpdate={onUpdateContent} onDelete={onDeleteContent} appSettings={appSettings} />
                    ) : activeTab === 'outreach' ? (
                        <div className="space-y-6">
                            <div className="bg-neutral-900/50 p-6 rounded-2xl border border-neutral-800">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-black text-white uppercase tracking-widest">AI Outreach Generator</h3>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleGenerateOutreach('recruit')} disabled={isDrafting} className="bg-neutral-800 hover:bg-white hover:text-black text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50">Recruit</button>
                                        <button onClick={() => handleGenerateOutreach('followup')} disabled={isDrafting} className="bg-neutral-800 hover:bg-white hover:text-black text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50">Follow-up</button>
                                        <button onClick={() => handleGenerateOutreach('payment')} disabled={isDrafting} className="bg-neutral-800 hover:bg-white hover:text-black text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50">Payment</button>
                                    </div>
                                </div>
                                <div className="relative">
                                    {isDrafting && (
                                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center rounded-xl z-10">
                                            <Loader2 className="animate-spin text-emerald-500" />
                                        </div>
                                    )}
                                    <textarea
                                        value={outreachDraft}
                                        onChange={(e) => setOutreachDraft(e.target.value)}
                                        className="w-full bg-black border border-neutral-800 rounded-xl p-4 text-sm text-neutral-300 h-64 focus:border-emerald-500 outline-none resize-none leading-relaxed font-mono"
                                        placeholder="Select a template above to generate a draft..."
                                    />
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <button
                                        onClick={handlePushToGmail}
                                        disabled={isSending || !outreachDraft}
                                        className="bg-emerald-500 text-black px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center gap-2 hover:bg-emerald-400 disabled:opacity-50 transition-all shadow-lg"
                                    >
                                        {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                        Save to Gmail Drafts
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Creator Status</label>
                                    <div className="flex flex-wrap gap-2">
                                        {[CreatorStatus.Active, CreatorStatus.LongTerm, CreatorStatus.Inactive].map(s => (
                                            <button key={s} onClick={() => handleChange('status', s)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${formData.status === s ? 'bg-white text-black border-white shadow-lg shadow-white/10' : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:bg-neutral-700'}`}>{s}</button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Grading & Rating</label>
                                    <div className="flex items-center justify-between bg-black/40 p-2 rounded-xl border border-neutral-800">
                                        <div className="flex items-center gap-1">
                                            {ratings.map(r => (
                                                <button key={r} onClick={() => handleChange('rating', r)} className={`w-9 h-9 rounded-lg text-xs font-black transition-all border ${formData.rating === r ? RATING_COLORS[r!] : 'bg-transparent text-neutral-600 border-transparent hover:bg-neutral-800'}`}>{r}</button>
                                            ))}
                                        </div>
                                        <button onClick={() => handleChange('flagged', !formData.flagged)} className={`p-2.5 rounded-xl transition-all ${formData.flagged ? 'text-red-500 bg-red-500/10 border border-red-500/30' : 'text-neutral-600 hover:text-red-400 border border-transparent'}`}>
                                            <Flag size={20} fill={formData.flagged ? "currentColor" : "none"} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                                    <Link size={14} /> Reach Out Platform
                                </label>
                                <div className="flex flex-wrap gap-2 items-center">
                                    {reachOptions.map(opt => (
                                        <button
                                            key={opt}
                                            onClick={() => handleChange('reachPlatform', opt)}
                                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border transition-all 
                                    ${formData.reachPlatform === opt
                                                    ? `${REACH_PLATFORM_COLORS[opt]} border-current shadow-lg`
                                                    : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:bg-neutral-700'
                                                }`}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                    <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                                        <input
                                            type="text"
                                            value={(!reachOptions.includes(formData.reachPlatform || '') && formData.reachPlatform) || customReach}
                                            onChange={(e) => {
                                                setCustomReach(e.target.value);
                                                handleChange('reachPlatform', e.target.value);
                                            }}
                                            className={`flex-1 bg-black border rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none focus:border-emerald-500 
                                    ${(!reachOptions.includes(formData.reachPlatform || '') && formData.reachPlatform) ? 'border-emerald-500 text-emerald-400' : 'border-neutral-800 text-neutral-500'}`}
                                            placeholder="Custom Platform..."
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-neutral-900/50 p-5 rounded-2xl border border-neutral-800 space-y-4">
                                    <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2"><MapPin size={14} /> Shipping Destination</h4>
                                    <textarea value={formData.address || ''} onChange={(e) => handleChange('address', e.target.value)} placeholder="Full physical address for product sends..." className="w-full bg-black border border-neutral-800 rounded-xl p-4 text-xs text-white h-28 focus:border-emerald-500 outline-none resize-none" />
                                </div>
                                <div className="bg-neutral-900/50 p-5 rounded-2xl border border-neutral-800 space-y-4">
                                    <ShipmentManager
                                        shipments={formData.shipments || []}
                                        onAdd={handleAddShipment}
                                        onUpdate={handleUpdateShipment}
                                        onDelete={handleDeleteShipment}
                                        onRequestShipping={handleRequestShipping}
                                        initialEditingId={initialShipmentId}
                                    />
                                </div>
                            </div>

                            <div className="bg-ooedn-dark border border-neutral-800 rounded-2xl p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2"><CreditCard size={16} /> Financial Hub (Multi-Method)</label>
                                    <button onClick={handleAddPaymentOption} className="text-emerald-500 hover:text-white flex items-center gap-2 text-[10px] font-black uppercase transition-all"><Plus size={16} /> Add New Method</button>
                                </div>
                                <div className="space-y-3">
                                    {(formData.paymentOptions || []).map((opt, idx) => (
                                        <div key={idx} className={`grid grid-cols-3 gap-3 animate-in fade-in slide-in-from-left-2 duration-200 ${(opt as any).addedByCreator ? 'border-l-2 border-teal-400 pl-3' : ''}`}>
                                            {(opt as any).addedByCreator && (
                                                <div className="col-span-3 flex items-center gap-1.5 mb-1">
                                                    <span className="text-[8px] font-black text-teal-400 uppercase tracking-widest bg-teal-500/10 px-2 py-0.5 rounded-md border border-teal-500/20">👤 Creator-entered</span>
                                                    {(opt as any).addedAt && <span className="text-[8px] text-neutral-600">{new Date((opt as any).addedAt).toLocaleDateString()}</span>}
                                                </div>
                                            )}
                                            <select value={opt.method} onChange={(e) => handleUpdatePaymentOption(idx, { method: e.target.value as PaymentMethod })} className="bg-black border border-neutral-800 rounded-xl p-3 text-xs text-white outline-none focus:border-emerald-500">
                                                {Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                            <input value={opt.details} onChange={(e) => handleUpdatePaymentOption(idx, { details: e.target.value })} placeholder="Email, ID, or Phone" className="bg-black border border-neutral-800 rounded-xl p-3 text-xs text-white outline-none focus:border-emerald-500" />
                                            <div className="flex items-center gap-3">
                                                <button onClick={() => handleRemovePaymentOption(idx)} className="text-neutral-600 hover:text-red-500 transition-colors p-2 bg-black rounded-lg border border-neutral-800"><X size={18} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* PAYMENT RECEIPT DOWNLOAD SECTION */}
                            {creator.lastPaymentProof && (
                                <div className="bg-emerald-900/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-500 border border-emerald-500/20">
                                            <FileCheck size={20} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Payment Receipt Available</p>
                                            <p className="text-[9px] text-neutral-400 font-mono font-medium">
                                                ID: {creator.lastTransactionId || 'MANUAL'} • {new Date(creator.lastPaymentDate || Date.now()).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <a
                                        href={creator.lastPaymentProof}
                                        download={`receipt_${creator.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.png`}
                                        className="flex items-center gap-2 bg-emerald-500 text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-lg active:scale-95"
                                    >
                                        <DownloadCloud size={14} /> Download Proof
                                    </a>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black text-neutral-400 mb-2 uppercase tracking-widest">Agreed Rate ($)</label>
                                    <input type="number" value={formData.rate} onChange={(e) => handleChange('rate', Number(e.target.value))} className="w-full bg-black border border-neutral-800 rounded-xl p-4 text-sm text-white focus:border-emerald-500 outline-none font-bold" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-neutral-400 mb-2 uppercase tracking-widest">Business Email</label>
                                    <input type="email" value={formData.email || ''} onChange={(e) => handleChange('email', e.target.value)} className="w-full bg-black border border-neutral-800 rounded-xl p-4 text-sm text-white focus:border-emerald-500 outline-none" placeholder="contact@creator.com" />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest">Creator Interaction Log</label>
                                    {sentiment && (
                                        <div className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded bg-black border border-neutral-800 ${sentiment.color}`}>
                                            AI Vibe Check: {sentiment.label}
                                        </div>
                                    )}
                                </div>
                                <textarea value={formData.notes} onChange={(e) => handleChange('notes', e.target.value)} className="w-full bg-black border border-neutral-800 rounded-xl p-4 text-xs text-white focus:border-emerald-500 outline-none h-40 resize-none leading-relaxed" placeholder="Detailed notes about vibes, performance, and previous chats..." />
                            </div>
                        </>
                    )}
                </div>

                <div className="p-6 border-t border-neutral-800 bg-neutral-900/80 backdrop-blur space-y-3">
                    {/* Invite to Portal Section */}
                    {showInviteSection && (
                        <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <UserPlus size={14} className="text-purple-400" />
                                    <span className="text-xs text-purple-400 font-black uppercase tracking-widest">Invite to Creator Portal</span>
                                </div>
                                <button onClick={() => setShowInviteSection(false)} className="text-neutral-500 hover:text-white" title="Close invite panel">
                                    <X size={14} />
                                </button>
                            </div>
                            <p className="text-[10px] text-neutral-400">This will create a login for the creator and email them their credentials. They can then sign in at <span className="text-purple-400 font-bold">/creator</span> to view campaigns, upload content, and chat with the team.</p>
                            <div className="flex gap-2">
                                <input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={e => setInviteEmail(e.target.value)}
                                    placeholder="creator@email.com"
                                    className="flex-1 bg-black border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-purple-500 outline-none"
                                />
                                <button
                                    onClick={handleInviteToPortal}
                                    disabled={isInviting || inviteSent || !inviteEmail.trim()}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] font-black uppercase tracking-widest hover:from-purple-400 hover:to-pink-400 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-purple-500/20"
                                >
                                    {isInviting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                                    {inviteSent ? '✓ Sent!' : 'Send Invite'}
                                </button>
                            </div>
                            {inviteSent && (
                                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-emerald-400">
                                    <CheckCircle size={14} />
                                    <span className="text-[10px] font-black uppercase">✅ Invitation sent to {inviteEmail}! Credentials emailed.</span>
                                </div>
                            )}
                            {inviteError && (
                                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400">
                                    <X size={14} />
                                    <span className="text-[10px] font-black uppercase">{inviteError}</span>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex justify-between items-center">
                        <button onClick={() => { if (confirm('Blackburn this creator?')) onSave(creator.id, { status: CreatorStatus.Blackburn }); onClose(); }} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-900/20 text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">Blackburn</button>
                        <button
                            onClick={() => setShowInviteSection(!showInviteSection)}
                            className={`flex items-center gap-2 px-5 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${showInviteSection ? 'bg-purple-500 text-white border-purple-500' : 'bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500 hover:text-black'}`}
                        >
                            <UserPlus size={14} />
                            Invite to Portal
                        </button>
                        <button onClick={handleRequestPayment} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-black uppercase tracking-widest hover:bg-amber-500 hover:text-black transition-all active:scale-95">
                            <DollarSign size={14} /> Payment
                        </button>
                        <button onClick={handleSave} className="flex items-center gap-2 px-8 py-3 rounded-xl bg-white text-black text-xs font-black uppercase tracking-widest hover:bg-neutral-200 transition-all shadow-2xl active:scale-95">Save</button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default CreatorEditModal;
