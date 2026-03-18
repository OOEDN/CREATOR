import React, { useState } from 'react';
import { Truck, Package, AlertTriangle, ArrowRight, RefreshCw, MapPin, Loader2 } from 'lucide-react';
import { Creator, ShipmentStatus, Shipment } from '../../../shared/types';
import { syncTrackingWithAI } from '../../../shared/services/geminiService';

interface ShipmentTrackerWidgetProps {
    creators: Creator[];
    onViewAll: () => void;
    onSelectCreator?: (creator: Creator, shipmentId?: string) => void;
    onUpdateShipment?: (creatorId: string, shipmentId: string, updates: Partial<Shipment>) => void;
}

const ShipmentTrackerWidget: React.FC<ShipmentTrackerWidgetProps> = ({ creators, onViewAll, onSelectCreator, onUpdateShipment }) => {
    const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
    const [syncingAll, setSyncingAll] = useState(false);

    // Flatten all shipments from all creators
    const allShipments = creators.flatMap(c =>
        (c.shipments || []).map(s => ({ ...s, creatorName: c.name, creatorHandle: c.handle, creatorObj: c, creatorId: c.id }))
    );

    // Filter for pending status - STRICT: No tracking numbers allowed
    const pendingShipments = allShipments.filter(s =>
        (s.status === ShipmentStatus.Preparing || s.status === ShipmentStatus.Issue) &&
        (!s.trackingNumber || s.trackingNumber === 'PENDING' || s.trackingNumber.trim().length < 3)
    ).sort((a, b) => new Date(b.dateShipped).getTime() - new Date(a.dateShipped).getTime());

    // Active shipments (have real tracking numbers, in transit)
    const trackableShipments = allShipments.filter(s =>
        s.trackingNumber && s.trackingNumber !== 'PENDING' && s.trackingNumber.trim().length >= 3 &&
        (s.status === ShipmentStatus.Shipped || s.status === ShipmentStatus.Preparing)
    ).sort((a, b) => new Date(b.dateShipped).getTime() - new Date(a.dateShipped).getTime());

    const getStatusColor = (status: ShipmentStatus) => {
        switch (status) {
            case ShipmentStatus.Shipped: return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
            case ShipmentStatus.Preparing: return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
            case ShipmentStatus.Delivered: return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
            case ShipmentStatus.Issue: return 'text-red-400 bg-red-500/10 border-red-500/20';
            default: return 'text-neutral-400';
        }
    };

    const syncSingleShipment = async (creatorId: string, shipment: typeof allShipments[0]) => {
        if (!shipment.trackingNumber || shipment.trackingNumber === 'PENDING') return;
        const key = shipment.id;
        try {
            setSyncingIds(prev => new Set(prev).add(key));
            const result = await syncTrackingWithAI(shipment.trackingNumber, shipment.carrier);
            if (result && onUpdateShipment) {
                onUpdateShipment(creatorId, shipment.id, {
                    status: result.status || shipment.status,
                    lastLocation: result.lastLocation || undefined,
                    detailedStatus: result.detailedStatus || undefined,
                    lastSyncedAt: new Date().toISOString(),
                    carrier: result.carrierFound || shipment.carrier,
                });
            }
        } catch (e) {
            console.warn('[AI Tracking] Sync failed (non-blocking):', e);
        } finally {
            setSyncingIds(prev => {
                const next = new Set(prev);
                next.delete(key);
                return next;
            });
        }
    };

    const syncAllShipments = async () => {
        if (syncingAll) return;
        setSyncingAll(true);
        try {
            for (const shipment of trackableShipments) {
                await syncSingleShipment(shipment.creatorId, shipment);
                // Small delay between calls to avoid rate limiting
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch (e) {
            console.warn('[AI Tracking] Sync all failed (non-blocking):', e);
        } finally {
            setSyncingAll(false);
        }
    };

    const displayShipments = [...pendingShipments, ...trackableShipments].slice(0, 10);

    return (
        <div className="bg-ooedn-gray border border-neutral-800 rounded-3xl p-6 flex flex-col h-[280px] shadow-2xl relative overflow-hidden">
            <div className="flex justify-between items-center mb-4 border-b border-neutral-800 pb-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                    <Truck size={16} className="text-emerald-500" /> Shipments
                </h3>
                <div className="flex items-center gap-2">
                    {trackableShipments.length > 0 && (
                        <button
                            onClick={syncAllShipments}
                            disabled={syncingAll}
                            className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${syncingAll
                                ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400 cursor-wait'
                                : 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:text-emerald-400 hover:border-emerald-500/30'
                                }`}
                            title="Use AI to check live tracking status"
                        >
                            {syncingAll ? (
                                <><Loader2 size={10} className="animate-spin" /> Syncing...</>
                            ) : (
                                <><RefreshCw size={10} /> AI Sync</>
                            )}
                        </button>
                    )}
                    <span className="text-[10px] font-bold text-neutral-500 bg-neutral-900 px-2 py-1 rounded-full">
                        {displayShipments.length} Active
                    </span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                {displayShipments.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-neutral-600 space-y-2 opacity-50">
                        <Package size={24} />
                        <p className="text-xs font-bold uppercase">No Active Shipments</p>
                    </div>
                )}
                {displayShipments.map(shipment => {
                    const isSyncing = syncingIds.has(shipment.id);
                    const hasTracking = shipment.trackingNumber && shipment.trackingNumber !== 'PENDING' && shipment.trackingNumber.trim().length >= 3;

                    return (
                        <div
                            key={shipment.id}
                            className="bg-black/40 border border-neutral-800/50 rounded-xl p-3 hover:border-emerald-500/30 transition-all group cursor-pointer"
                        >
                            <div className="flex justify-between items-start mb-2"
                                onClick={() => onSelectCreator && onSelectCreator(shipment.creatorObj, shipment.id)}
                            >
                                <div>
                                    <p className="text-xs font-bold text-white mb-0.5 group-hover:text-emerald-400 transition-colors">{shipment.creatorName}</p>
                                    <p className="text-[9px] text-neutral-500">{shipment.carrier} • {shipment.trackingNumber}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-[8px] px-2 py-0.5 rounded border uppercase font-black tracking-wider ${getStatusColor(shipment.status)}`}>
                                        {isSyncing ? '⏳ Syncing' : shipment.status}
                                    </span>
                                    {hasTracking && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                syncSingleShipment(shipment.creatorId, shipment);
                                            }}
                                            disabled={isSyncing}
                                            className="p-1 rounded-md hover:bg-neutral-800 text-neutral-600 hover:text-emerald-400 transition-all"
                                            title="Sync tracking with AI"
                                        >
                                            {isSyncing ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* AI Tracking Details */}
                            {(shipment.lastLocation || shipment.detailedStatus) && (
                                <div className="mt-2 pt-2 border-t border-white/5 flex items-start gap-2">
                                    <MapPin size={10} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        {shipment.lastLocation && (
                                            <p className="text-[9px] text-emerald-400 font-bold">{shipment.lastLocation}</p>
                                        )}
                                        {shipment.detailedStatus && (
                                            <p className="text-[9px] text-neutral-500">{shipment.detailedStatus}</p>
                                        )}
                                        {shipment.lastSyncedAt && (
                                            <p className="text-[8px] text-neutral-700 mt-0.5">
                                                Synced {new Date(shipment.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {!(shipment.lastLocation || shipment.detailedStatus) && (
                                <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/5">
                                    <span className="text-[9px] text-neutral-600">
                                        {new Date(shipment.dateShipped).toLocaleDateString()}
                                    </span>
                                    {shipment.status === ShipmentStatus.Issue && (
                                        <AlertTriangle size={12} className="text-red-500 animate-pulse" />
                                    )}
                                    <span className="opacity-0 group-hover:opacity-100 text-[8px] text-emerald-500 uppercase font-black tracking-widest flex items-center gap-1 transition-opacity">
                                        Open Profile <ArrowRight size={8} />
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <button onClick={onViewAll} className="w-full mt-4 py-3 bg-neutral-900 text-neutral-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-neutral-800 hover:text-white transition-all flex items-center justify-center gap-2">
                View All Logistics <ArrowRight size={12} />
            </button>
        </div>
    );
};

export default ShipmentTrackerWidget;
