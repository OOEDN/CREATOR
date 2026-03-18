import React from 'react';
import { X, CloudCog, AlertTriangle, Trash2 } from 'lucide-react';
import { AppSettings, Creator, ShipmentStatus } from '../../../shared/types';
import { subscribeToPush, sendPushNotification } from '../../../shared/services/pushService';

interface SettingsModalProps {
    settings: AppSettings;
    onUpdateSettings: (updates: Partial<AppSettings>) => void;
    creators: Creator[];
    onUpdateCreators: (creators: Creator[]) => void;
    onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
    settings, onUpdateSettings, creators, onUpdateCreators, onClose
}) => {
    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <div className="bg-ooedn-dark border border-neutral-700 rounded-3xl w-full max-w-2xl p-8 shadow-2xl animate-in slide-in-from-bottom-5">
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-3">
                        <CloudCog size={28} className="text-emerald-500" />
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">System Config</h3>
                    </div>
                    <button onClick={onClose} className="text-neutral-500 hover:text-white"><X size={28} /></button>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-2">Google Cloud Project ID</label>
                        <input value={settings.googleProjectId} onChange={e => onUpdateSettings({ googleProjectId: e.target.value })} className="w-full bg-black border border-neutral-800 rounded-xl p-4 text-white text-xs font-mono" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-2">Google Cloud Storage Bucket</label>
                        <input value={settings.googleCloudBucket} onChange={e => onUpdateSettings({ googleCloudBucket: e.target.value })} className="w-full bg-black border border-neutral-800 rounded-xl p-4 text-white text-xs font-mono" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-2">Brand Bible (AI Context)</label>
                        <textarea value={settings.brandInfo} onChange={e => onUpdateSettings({ brandInfo: e.target.value })} className="w-full bg-black border border-neutral-800 rounded-xl p-4 text-white text-xs h-32 resize-none leading-relaxed" placeholder="Define brand voice, do's/don'ts for the AI..." />
                    </div>

                    <div className="flex justify-end pt-4 border-t border-neutral-800">
                        <button onClick={onClose} className="bg-emerald-500 text-black px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-emerald-400 transition-all shadow-xl">
                            Save Configuration
                        </button>
                    </div>

                    <div className="mt-8 border-t border-neutral-800 pt-6">
                        <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2">🔔 Push Notifications</h4>
                        <div className="flex flex-wrap gap-3 items-center">
                            <span className="text-[10px] text-neutral-400 font-mono">
                                Status: {'Notification' in window ? Notification.permission : 'unsupported'}
                            </span>
                            <button
                                onClick={async () => {
                                    try {
                                        const success = await subscribeToPush();
                                        alert(success ? '✅ Push notifications enabled! You\'ll receive alerts for new tasks, creators, and more.' : '❌ Could not enable push. Check if notifications are blocked in your browser settings.');
                                    } catch (e: any) { alert('Error: ' + e.message); }
                                }}
                                className="bg-blue-500/10 text-blue-400 px-4 py-2 rounded-lg border border-blue-500/20 text-xs font-bold hover:bg-blue-500/20 transition-all"
                            >
                                Subscribe / Re-subscribe
                            </button>
                            <button
                                onClick={async () => {
                                    try {
                                        await sendPushNotification('🔔 OOEDN Test', 'Push notifications are working! You\'ll get alerts for creator updates, tasks, and more.', '/', 'ooedn-test');
                                        alert('Test notification sent! You should see it pop up in a moment. If you don\'t see it, check your browser notification settings.');
                                    } catch (e: any) { alert('Error: ' + e.message); }
                                }}
                                className="bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-lg border border-emerald-500/20 text-xs font-bold hover:bg-emerald-500/20 transition-all"
                            >
                                ⚡ Send Test Notification
                            </button>
                            <button
                                onClick={() => {
                                    localStorage.removeItem('ooedn_push_dismissed');
                                    localStorage.removeItem('ooedn_push_enabled');
                                    alert('Push preferences cleared. Reload the page to see the notification banner again.');
                                }}
                                className="text-[10px] text-neutral-500 hover:text-white transition-colors"
                            >
                                Reset Push Preferences
                            </button>
                        </div>
                    </div>

                    <div className="mt-8 border-t border-neutral-800 pt-6">
                        <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-4 flex items-center gap-2"><AlertTriangle size={14} /> Danger Zone / Tools</h4>
                        <button
                            onClick={() => {
                                if (!confirm("Start automated cleanup of duplicate pending shipments? (If a creator has a shipped package, their pending 'Preparing' tasks will be removed).")) return;

                                const cleanedCreators = creators.map(c => {
                                    const shipments = c.shipments || [];
                                    const hasShipped = shipments.some(s => s.trackingNumber && s.trackingNumber !== 'PENDING' && s.trackingNumber.length > 3);

                                    if (hasShipped) {
                                        const cleanShipments = shipments.filter(s => {
                                            const isPending = s.status === ShipmentStatus.Preparing || (s.trackingNumber === 'PENDING');
                                            const isTracked = s.trackingNumber && s.trackingNumber !== 'PENDING' && s.trackingNumber.length > 3;
                                            if (isPending && !isTracked) return false;
                                            return true;
                                        });

                                        if (cleanShipments.length !== shipments.length) {
                                            console.log(`Cleaning up ${shipments.length - cleanShipments.length} duplicates for ${c.name}`);
                                            return { ...c, shipments: cleanShipments };
                                        }
                                    }
                                    return c;
                                });

                                onUpdateCreators(cleanedCreators);
                                alert("Cleanup Complete! Validated all shipment records.");
                                onClose();
                            }}
                            className="w-full bg-red-900/20 text-red-500 border border-red-900/50 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
                        >
                            <Trash2 size={14} /> Auto-Cleanup Duplicate Shipments
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
