import React, { useState } from 'react';
import { Package, Truck, Plus, ExternalLink, Calendar, AlertCircle, Clock, CheckCircle, X, Edit2 } from 'lucide-react';
import { Shipment, ShipmentStatus } from '../types';
import { syncTrackingWithAI } from '../services/geminiService';

interface ShipmentManagerProps {
    shipments: Shipment[];
    onAdd: (shipment: Shipment) => void;
    onUpdate: (id: string, updates: Partial<Shipment>) => void;
    onDelete: (id: string) => void;
    onRequestShipping: () => void;
    initialEditingId?: string | null;
}

const ShipmentManager: React.FC<ShipmentManagerProps> = ({ shipments, onAdd, onUpdate, onDelete, onRequestShipping, initialEditingId }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [form, setForm] = useState<Partial<Shipment>>({
        title: 'New Package',
        carrier: 'UPS',
        status: ShipmentStatus.Preparing,
        isPriority: false
    });
    const [isTracking, setIsTracking] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Deep Linking Effect
    React.useEffect(() => {
        if (initialEditingId) {
            const match = shipments.find(s => s.id === initialEditingId);
            if (match) {
                setForm({
                    title: match.title,
                    carrier: match.carrier,
                    trackingNumber: match.trackingNumber,
                    status: match.status,
                    notes: match.notes,
                    isPriority: match.isPriority
                });
                setEditingId(match.id);
                setIsAdding(true);
            }
        }
    }, [initialEditingId, shipments]);

    const handleEdit = (s: Shipment) => {
        setForm({
            title: s.title,
            carrier: s.carrier,
            trackingNumber: s.trackingNumber,
            status: s.status,
            notes: s.notes,
            isPriority: s.isPriority
        });
        setEditingId(s.id);
        setIsAdding(true);
    };

    const handleSave = () => {
        if (!form.trackingNumber && !editingId) return; // Allow save if editing even if tracking is missing (though unlikely)

        if (editingId) {
            onUpdate(editingId, {
                title: form.title,
                carrier: form.carrier,
                trackingNumber: form.trackingNumber,
                status: form.status,
                notes: form.notes,
                isPriority: form.isPriority
            });
            setEditingId(null);
        } else {
            const newShipment: Shipment = {
                id: crypto.randomUUID(),
                title: form.title || 'Package',
                carrier: form.carrier || 'Unknown',
                trackingNumber: form.trackingNumber || 'PENDING',
                // Default to Shipped since tracking is provided, unless specifically overridden
                status: form.status === ShipmentStatus.Preparing ? ShipmentStatus.Shipped : form.status || ShipmentStatus.Shipped,
                dateShipped: new Date().toISOString(),
                notes: form.notes,
                isPriority: form.isPriority,
                requestedBy: 'Admin' // Should be current user
            };
            onAdd(newShipment);
        }
        setIsAdding(false);
        setForm({ title: 'New Package', carrier: 'UPS', status: ShipmentStatus.Preparing, isPriority: false });
    };

    const runAICloudTrack = async (s: Shipment) => {
        setIsTracking(s.id);
        const result = await syncTrackingWithAI(s.trackingNumber, s.carrier);
        if (result && result.status) {
            onUpdate(s.id, {
                status: result.status,
                notes: result.detailedStatus ? `${s.notes || ''}\n[AI Update]: ${result.detailedStatus}` : s.notes
            });
        }
        setIsTracking(null);
    };

    return (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h4 className="text-sm font-black uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                    <Truck size={16} /> Logistics & Shipments
                </h4>
                <button
                    onClick={onRequestShipping}
                    className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1.5 rounded-lg hover:bg-indigo-500/20 transition-all font-bold uppercase tracking-widest flex items-center gap-1"
                >
                    <AlertCircle size={12} /> Request Shipping
                </button>
            </div>

            {/* Shipment List */}
            <div className="space-y-3">
                {shipments.length === 0 && !isAdding && (
                    <div className="text-center p-6 border border-dashed border-neutral-800 rounded-xl">
                        <p className="text-neutral-600 text-xs font-medium">No active shipments.</p>
                    </div>
                )}

                {shipments.map(s => (
                    <div key={s.id} className="bg-black border border-neutral-800 rounded-xl p-4 flex flex-col gap-3 group hover:border-neutral-700 transition-all">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${s.status === ShipmentStatus.Delivered ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                    <Package size={18} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-white uppercase tracking-wide">{s.title}</p>
                                    <p className="text-[10px] text-neutral-500 font-mono mt-0.5 flex items-center gap-2">
                                        {s.carrier} • {s.trackingNumber}
                                        <a href={`https://www.google.com/search?q=${s.carrier}+tracking+${s.trackingNumber}`} target="_blank" className="hover:text-white"><ExternalLink size={10} /></a>
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase border ${s.status === ShipmentStatus.Delivered ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10' :
                                    s.status === ShipmentStatus.Issue ? 'border-red-500/30 text-red-500 bg-red-500/10' :
                                        'border-blue-500/30 text-blue-500 bg-blue-500/10'
                                    }`}>
                                    {s.status}
                                </span>
                                <span className="text-[9px] text-neutral-600 font-mono">{new Date(s.dateShipped).toLocaleDateString()}</span>
                            </div>
                        </div>

                        {s.notes && (
                            <div className="bg-neutral-900/50 p-2 rounded-lg text-[10px] text-neutral-400 leading-relaxed font-mono">
                                {s.notes}
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800/50">
                            <button onClick={() => runAICloudTrack(s)} disabled={!!isTracking} className="text-[10px] text-neutral-500 hover:text-emerald-400 flex items-center gap-1 transition-colors">
                                {isTracking === s.id ? <Clock size={12} className="animate-spin" /> : <Clock size={12} />} Track AI
                            </button>
                            <button onClick={() => handleEdit(s)} className="text-[10px] text-neutral-500 hover:text-blue-400 flex items-center gap-1 transition-colors">
                                <Edit2 size={12} /> Edit
                            </button>
                            <button onClick={() => onDelete(s.id)} className="text-[10px] text-neutral-500 hover:text-red-400 flex items-center gap-1 transition-colors">
                                <X size={12} /> Remove
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add New Form */}
            {isAdding ? (
                <div className="bg-neutral-800/50 rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black uppercase text-white">{editingId ? 'Edit Shipment' : 'New Shipment Details'}</span>
                        <button onClick={() => { setIsAdding(false); setEditingId(null); setForm({ title: 'New Package', carrier: 'UPS', status: ShipmentStatus.Preparing, isPriority: false }); }} className="text-neutral-500 hover:text-white"><X size={14} /></button>
                    </div>
                    <input
                        value={form.title}
                        onChange={e => setForm({ ...form, title: e.target.value })}
                        placeholder="Shipment Title (e.g. Seeding Kit)"
                        className="w-full bg-black border border-neutral-700 rounded-lg p-2 text-xs text-white focus:border-emerald-500 outline-none"
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <select
                            value={form.carrier}
                            onChange={e => setForm({ ...form, carrier: e.target.value })}
                            className="bg-black border border-neutral-700 rounded-lg p-2 text-xs text-white focus:border-emerald-500 outline-none"
                        >
                            <option value="UPS">UPS</option>
                            <option value="FedEx">FedEx</option>
                            <option value="USPS">USPS</option>
                            <option value="DHL">DHL</option>
                            <option value="Other">Other</option>
                        </select>
                        <input
                            value={form.trackingNumber}
                            onChange={e => {
                                const val = e.target.value;
                                const updates: Partial<Shipment> = { trackingNumber: val };
                                // Auto-detect: if tracking number is entered and status is still Preparing/Issue, auto-set to Shipped
                                if (val.trim().length > 3 && (form.status === ShipmentStatus.Preparing || form.status === ShipmentStatus.Issue)) {
                                    updates.status = ShipmentStatus.Shipped;
                                    updates.dateShipped = new Date().toISOString();
                                }
                                // If tracking is cleared, revert back to Preparing
                                if (!val.trim() && form.status === ShipmentStatus.Shipped) {
                                    updates.status = ShipmentStatus.Preparing;
                                }
                                setForm(prev => ({ ...prev, ...updates }));
                            }}
                            placeholder="Tracking Number — auto-sets to In Transit"
                            className="bg-black border border-neutral-700 rounded-lg p-2 text-xs text-white focus:border-emerald-500 outline-none"
                        />
                    </div>
                    <select
                        value={form.status}
                        onChange={e => setForm({ ...form, status: e.target.value as ShipmentStatus })}
                        className={`w-full bg-black border rounded-lg p-2 text-xs text-white focus:border-emerald-500 outline-none ${form.status === ShipmentStatus.Shipped ? 'border-emerald-500/50' : 'border-neutral-700'}`}
                    >
                        {Object.values(ShipmentStatus).map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                    {form.trackingNumber && form.trackingNumber.trim().length > 3 && form.status === ShipmentStatus.Shipped && (
                        <p className="text-[10px] text-emerald-400 flex items-center gap-1 -mt-1 ml-1">
                            <CheckCircle size={10} /> Status auto-set to In Transit (tracking detected)
                        </p>
                    )}
                    <textarea
                        value={form.notes}
                        onChange={e => setForm({ ...form, notes: e.target.value })}
                        placeholder="Notes..."
                        className="w-full bg-black border border-neutral-700 rounded-lg p-2 text-xs text-white focus:border-emerald-500 outline-none h-16 resize-none"
                    />
                    <div className="flex items-center gap-2">
                        <input type="checkbox" checked={form.isPriority} onChange={e => setForm({ ...form, isPriority: e.target.checked })} id="priority_s" className="accent-emerald-500" />
                        <label htmlFor="priority_s" className="text-xs text-neutral-400">Mark as Priority / Urgent</label>
                    </div>
                    <button onClick={handleSave} disabled={!form.trackingNumber && !editingId} className="w-full bg-emerald-500 text-black py-2 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-emerald-400 disabled:opacity-50">
                        {editingId ? 'Update Shipment' : 'Confirm Shipment'}
                    </button>
                </div>
            ) : (
                <button onClick={() => setIsAdding(true)} className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 border-dashed rounded-xl text-neutral-400 hover:text-white text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                    <Plus size={14} /> Add Tracking
                </button>
            )}
        </div>
    );
};

export default ShipmentManager;
