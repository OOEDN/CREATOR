import React from 'react';
import { Creator, ShipmentStatus } from '../../../shared/types';
import { Package, Truck, CheckCircle, AlertTriangle, MapPin, Clock, Sparkles, ExternalLink } from 'lucide-react';

interface Props {
    creator: Creator;
}

const statusConfig: Record<string, { icon: React.ElementType; color: string; bg: string; border: string; emoji: string }> = {
    [ShipmentStatus.None]: { icon: Package, color: 'text-neutral-400', bg: 'bg-neutral-500/10', border: 'border-neutral-700', emoji: '📦' },
    [ShipmentStatus.Preparing]: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', emoji: '⏳' },
    [ShipmentStatus.Shipped]: { icon: Truck, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', emoji: '🚚' },
    'In Transit': { icon: Truck, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', emoji: '🚚' },
    [ShipmentStatus.Delivered]: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', emoji: '✅' },
    [ShipmentStatus.Issue]: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', emoji: '⚠️' },
};

const CreatorShipments: React.FC<Props> = ({ creator }) => {
    const shipments = creator.shipments || [];
    const deliveredCount = shipments.filter(s => s.status === ShipmentStatus.Delivered).length;
    const inTransitCount = shipments.filter(s => s.status === ShipmentStatus.Shipped || s.status === 'In Transit' as ShipmentStatus).length;

    const formatDate = (iso: string) => {
        try { return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return iso; }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-5">
            <div className="text-center mb-2">
                <h2 className="text-2xl font-black text-white uppercase tracking-tight flex items-center justify-center gap-2">
                    <Package size={24} className="text-purple-400" /> Shipments
                </h2>
                <p className="text-neutral-500 text-xs mt-1">Track incoming packages and product seedings 📦</p>
            </div>

            {/* Stats Bar */}
            {shipments.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-3 text-center">
                        <p className="text-xl font-black text-white">{shipments.length}</p>
                        <p className="text-[8px] text-neutral-500 font-bold uppercase tracking-widest">Total</p>
                    </div>
                    <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-3 text-center">
                        <p className="text-xl font-black text-blue-400">{inTransitCount}</p>
                        <p className="text-[8px] text-neutral-500 font-bold uppercase tracking-widest">In Transit</p>
                    </div>
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-3 text-center">
                        <p className="text-xl font-black text-emerald-400">{deliveredCount}</p>
                        <p className="text-[8px] text-neutral-500 font-bold uppercase tracking-widest">Delivered</p>
                    </div>
                </div>
            )}

            {shipments.length === 0 ? (
                <div className="bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-2xl p-14 text-center">
                    <div className="text-5xl mb-4">📦</div>
                    <p className="text-neutral-400 text-sm font-bold">No shipments yet</p>
                    <p className="text-neutral-600 text-[10px] mt-1">Products will appear here once shipped to you 🎁</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {shipments.map(shipment => {
                        const config = statusConfig[shipment.status] || statusConfig[ShipmentStatus.None];
                        const StatusIcon = config.icon;

                        return (
                            <div key={shipment.id} className={`bg-neutral-900/80 border ${config.border} rounded-2xl p-5 hover:scale-[1.01] transition-all group`}>
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-11 h-11 rounded-xl ${config.bg} flex items-center justify-center shadow-lg`}>
                                            <StatusIcon size={20} className={config.color} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-white group-hover:text-purple-400 transition-colors">{shipment.title}</p>
                                            <p className="text-[10px] text-neutral-500">{shipment.carrier} {shipment.isPriority ? '⚡ Priority' : ''}</p>
                                        </div>
                                    </div>
                                    <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-xl ${config.bg} ${config.color} border ${config.border} flex items-center gap-1`}>
                                        {config.emoji} {shipment.status}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div className="bg-black/50 rounded-xl p-3 border border-neutral-800">
                                        <p className="text-[9px] text-neutral-600 font-bold uppercase mb-1">Tracking #</p>
                                        <p className="text-xs text-white font-mono flex items-center gap-1">
                                            {shipment.trackingNumber || 'Pending'}
                                            {shipment.trackingNumber && (
                                                <ExternalLink size={8} className="text-neutral-600 group-hover:text-purple-400" />
                                            )}
                                        </p>
                                    </div>
                                    <div className="bg-black/50 rounded-xl p-3 border border-neutral-800">
                                        <p className="text-[9px] text-neutral-600 font-bold uppercase mb-1">Shipped</p>
                                        <p className="text-xs text-white">{formatDate(shipment.dateShipped)}</p>
                                    </div>
                                </div>

                                {/* Progress Dots */}
                                <div className="flex items-center gap-1 mb-3 px-2">
                                    {['Preparing', 'Shipped', 'In Transit', 'Delivered'].map((step, idx) => {
                                        const stepOrder = ['Preparing', 'Shipped', 'In Transit', 'Delivered'];
                                        const currentIdx = stepOrder.indexOf(shipment.status);
                                        const isComplete = idx <= currentIdx;
                                        const isCurrent = idx === currentIdx;
                                        return (
                                            <React.Fragment key={step}>
                                                <div className={`w-3 h-3 rounded-full flex-shrink-0 transition-all ${isComplete ? isCurrent ? 'bg-purple-500 shadow-lg shadow-purple-500/50 scale-125' : 'bg-emerald-500' : 'bg-neutral-800'
                                                    }`} title={step} />
                                                {idx < 3 && (
                                                    <div className={`flex-1 h-0.5 ${isComplete && idx < currentIdx ? 'bg-emerald-500' : 'bg-neutral-800'}`} />
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </div>

                                {/* AI Status */}
                                {shipment.detailedStatus && (
                                    <div className="bg-purple-500/5 border border-purple-500/10 rounded-xl p-3 flex items-start gap-2 mt-2">
                                        <MapPin size={12} className="text-purple-400 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-xs text-white">{shipment.detailedStatus}</p>
                                            {shipment.lastLocation && (
                                                <p className="text-[10px] text-neutral-500 mt-0.5">📍 {shipment.lastLocation}</p>
                                            )}
                                            {shipment.lastSyncedAt && (
                                                <p className="text-[9px] text-neutral-600 mt-1">Updated: {formatDate(shipment.lastSyncedAt)}</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {shipment.notes && (
                                    <p className="mt-3 text-xs text-neutral-400 italic bg-black/30 rounded-lg p-2 border border-neutral-800">📝 {shipment.notes}</p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default CreatorShipments;
