
import React from 'react';
import { Creator, CreatorStatus, PaymentStatus, PaymentMethod, ShipmentStatus } from '../types';
import { PLATFORM_ICONS, STATUS_COLORS, RATING_COLORS, SHIPMENT_STATUS_COLORS, REACH_PLATFORM_COLORS } from '../constants';
import { Flame, Trash2, DollarSign, CheckCircle, Clock, Flag, Truck, Box, CreditCard, Link } from 'lucide-react';

interface CreatorCardProps {
  creator: Creator;
  onUpdate: (id: string, updates: Partial<Creator>) => void;
  onBlackburn: (id: string) => void;
  onDelete: (id: string) => void;
  onClick: (creator: Creator) => void;
}

const AVATAR_COLORS = [
  'bg-emerald-600',
  'bg-blue-600',
  'bg-purple-600',
  'bg-rose-600',
  'bg-indigo-600',
  'bg-amber-600',
  'bg-cyan-600',
  'bg-violet-600',
];

const CreatorCard: React.FC<CreatorCardProps> = ({ creator, onUpdate, onBlackburn, onDelete, onClick }) => {
  const isBlackburned = creator.status === CreatorStatus.Blackburn;
  
  // Calculate initials from name
  const initials = creator.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';
  
  // Stable color based on name hash
  const getHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  };
  
  const colorIndex = getHash(creator.name) % AVATAR_COLORS.length;
  const bgColor = AVATAR_COLORS[colorIndex];

  const hasRealImage = creator.profileImage && 
                       creator.profileImage.length > 10 && 
                       !creator.profileImage.includes('picsum.photos/seed');

  const reachColor = creator.reachPlatform ? (REACH_PLATFORM_COLORS[creator.reachPlatform] || 'bg-neutral-800 text-neutral-400 border-neutral-700') : null;

  return (
    <div 
      onClick={() => onClick(creator)}
      className={`
      relative group overflow-hidden rounded-[1.5rem] border transition-all duration-300 cursor-pointer
      ${isBlackburned 
        ? 'bg-neutral-900/50 border-neutral-800 grayscale-[0.8] hover:grayscale-0' 
        : 'bg-ooedn-gray border-neutral-800 hover:border-neutral-600 hover:shadow-2xl hover:shadow-black/50 hover:-translate-y-1'}
    `}>
      <div className={`h-1.5 w-full ${isBlackburned ? 'bg-red-600' : (creator.paymentStatus === PaymentStatus.Paid ? 'bg-emerald-500' : 'bg-yellow-500')}`} />
      
      {creator.flagged && (
        <div className="absolute top-4 right-4 z-10 text-red-500 animate-pulse">
            <Flag size={18} fill="currentColor" />
        </div>
      )}

      <div className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
                {hasRealImage ? (
                  <img 
                    src={creator.profileImage} 
                    alt={creator.name} 
                    className="w-14 h-14 rounded-full object-cover border-2 border-neutral-800 bg-neutral-900 shadow-xl" 
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className={`w-14 h-14 rounded-full ${bgColor} border-2 border-neutral-800 flex items-center justify-center text-xl font-black text-white shadow-xl uppercase tracking-tighter`}>
                    {initials}
                  </div>
                )}
                <span className="absolute -bottom-1 -right-1 bg-neutral-900 rounded-full w-6 h-6 flex items-center justify-center text-[10px] border border-neutral-700 shadow-lg">
                    {PLATFORM_ICONS[creator.platform]}
                </span>
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-white group-hover:text-emerald-400 transition-colors truncate w-32 uppercase tracking-tighter leading-none mb-1">{creator.name}</h3>
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{creator.handle}</span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 mb-4">
             <div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${STATUS_COLORS[creator.status]}`}>
                {creator.status}
             </div>
             {creator.reachPlatform && (
                 <div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border flex items-center gap-1 ${reachColor}`}>
                    <Link size={8} /> {creator.reachPlatform}
                 </div>
             )}
             {creator.rating && (
                 <div className={`px-2 py-1 rounded-lg text-[8px] font-black border uppercase tracking-widest ${RATING_COLORS[creator.rating]}`}>
                     Grade {creator.rating}
                 </div>
             )}
             {creator.campaign && (
                <div className="text-[8px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-1 rounded-lg font-black uppercase tracking-widest truncate max-w-[120px]">
                    {creator.campaign}
                </div>
             )}
        </div>

        <div className="space-y-3 mb-6">
            <div className="text-[10px] text-neutral-400 bg-black/30 p-3 rounded-xl border border-neutral-800/50 min-h-[4rem] line-clamp-3 italic leading-relaxed">
                {creator.notes || 'Roster entry awaiting detailed interaction log...'}
            </div>
            
            <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-1">
                    <DollarSign size={14} className="text-emerald-500" />
                    <span className="font-black text-white text-sm">${creator.rate.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[8px] text-neutral-500 uppercase font-black tracking-widest">
                     <CreditCard size={12} />
                     {creator.paymentOptions?.length || 0} Methods
                </div>
            </div>
        </div>

        <div className="flex items-center justify-between pt-5 border-t border-neutral-800">
            <button 
                onClick={(e) => {
                    e.stopPropagation();
                    onUpdate(creator.id, { 
                        paymentStatus: creator.paymentStatus === PaymentStatus.Paid ? PaymentStatus.Unpaid : PaymentStatus.Paid 
                    });
                }}
                className={`flex items-center gap-1.5 text-[10px] font-black uppercase px-3 py-2 rounded-xl transition-all active:scale-95
                    ${creator.paymentStatus === PaymentStatus.Paid 
                        ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-black' 
                        : 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500 hover:text-black'}`}
            >
                {creator.paymentStatus === PaymentStatus.Paid ? <CheckCircle size={14} /> : <Clock size={14} />}
                {creator.paymentStatus}
            </button>

            <div className="flex items-center gap-2">
                {!isBlackburned && (
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onBlackburn(creator.id);
                        }}
                        className="p-2.5 text-neutral-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/20"
                    >
                        <Flame size={18} />
                    </button>
                )}
                
                {isBlackburned && (
                     <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(creator.id);
                        }}
                        className="p-2.5 text-neutral-600 hover:text-red-700 hover:bg-red-900/20 rounded-xl transition-all border border-transparent hover:border-red-900/20"
                     >
                         <Trash2 size={18} />
                     </button>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default CreatorCard;
