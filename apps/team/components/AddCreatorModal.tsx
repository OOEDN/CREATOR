import React, { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { Creator, Platform } from '../../../shared/types';
import MagicPaste from './MagicPaste';
import BulkAdd from './BulkAdd';

interface AddCreatorModalProps {
    onAdd: (creators: Partial<Creator>[]) => void;
    onClose: () => void;
}

const AddCreatorModal: React.FC<AddCreatorModalProps> = ({ onAdd, onClose }) => {
    const [addTab, setAddTab] = useState<'manual' | 'ai' | 'bulk'>('manual');
    const [manualForm, setManualForm] = useState<Partial<Creator>>({
        name: '',
        handle: '',
        platform: Platform.Instagram,
        rate: 0
    });

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-ooedn-dark border border-neutral-700 rounded-3xl w-full max-w-2xl p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">Add to Roster</h3>
                    <button onClick={onClose} className="text-neutral-500 hover:text-white"><X size={24} /></button>
                </div>

                <div className="flex gap-4 mb-6 border-b border-neutral-800 pb-4">
                    <button onClick={() => setAddTab('manual')} className={`text-xs font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${addTab === 'manual' ? 'text-white border-emerald-500' : 'text-neutral-600 border-transparent hover:text-neutral-400'}`}>Manual Entry</button>
                    <button onClick={() => setAddTab('ai')} className={`text-xs font-black uppercase tracking-widest pb-2 border-b-2 transition-all flex items-center gap-2 ${addTab === 'ai' ? 'text-emerald-400 border-emerald-500' : 'text-neutral-600 border-transparent hover:text-neutral-400'}`}><Sparkles size={12} /> AI Magic Paste</button>
                    <button onClick={() => setAddTab('bulk')} className={`text-xs font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${addTab === 'bulk' ? 'text-white border-emerald-500' : 'text-neutral-600 border-transparent hover:text-neutral-400'}`}>Bulk Import</button>
                </div>

                {addTab === 'manual' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <input value={manualForm.name} onChange={e => setManualForm({ ...manualForm, name: e.target.value })} placeholder="Creator Name" className="bg-black border border-neutral-800 rounded-xl p-3 text-sm text-white focus:border-emerald-500 outline-none" />
                            <input value={manualForm.handle} onChange={e => setManualForm({ ...manualForm, handle: e.target.value })} placeholder="@Handle" className="bg-black border border-neutral-800 rounded-xl p-3 text-sm text-white focus:border-emerald-500 outline-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <select value={manualForm.platform} onChange={e => setManualForm({ ...manualForm, platform: e.target.value as Platform })} className="bg-black border border-neutral-800 rounded-xl p-3 text-sm text-white focus:border-emerald-500 outline-none">
                                {Object.values(Platform).map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <input type="number" value={manualForm.rate} onChange={e => setManualForm({ ...manualForm, rate: Number(e.target.value) })} placeholder="Rate ($)" className="bg-black border border-neutral-800 rounded-xl p-3 text-sm text-white focus:border-emerald-500 outline-none" />
                        </div>
                        <button onClick={() => onAdd([manualForm])} disabled={!manualForm.name} className="w-full bg-white text-black py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-neutral-200 transition-all shadow-lg disabled:opacity-50">Create Profile</button>
                    </div>
                )}

                {addTab === 'ai' && <MagicPaste onParsed={(data) => onAdd([data])} />}
                {addTab === 'bulk' && <BulkAdd onAdded={onAdd} />}
            </div>
        </div>
    );
};

export default AddCreatorModal;
