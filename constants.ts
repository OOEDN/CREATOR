
import { Platform, PaymentMethod, CreatorStatus, PaymentStatus, ContentStatus, ShipmentStatus } from './types';

export const PLATFORM_ICONS: Record<Platform, string> = {
  [Platform.Instagram]: '📸',
  [Platform.TikTok]: '🎵',
  [Platform.YouTube]: '▶️',
  [Platform.Twitter]: '🐦',
  [Platform.Twitch]: '👾',
  [Platform.Other]: '🌐',
};

export const PLATFORM_COLORS: Record<Platform, string> = {
  [Platform.Instagram]: 'bg-pink-500/20 text-pink-400 border-pink-500/30 hover:bg-pink-500/30',
  [Platform.TikTok]: 'bg-teal-500/20 text-teal-400 border-teal-500/30 hover:bg-teal-500/30',
  [Platform.YouTube]: 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30',
  [Platform.Twitter]: 'bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30',
  [Platform.Twitch]: 'bg-purple-500/20 text-purple-400 border-purple-500/30 hover:bg-purple-500/30',
  [Platform.Other]: 'bg-gray-500/20 text-gray-400 border-gray-500/30 hover:bg-gray-500/30',
};

export const REACH_PLATFORM_COLORS: Record<string, string> = {
  'Brillo': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Social Cat': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  'Join Bands': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
};

export const INITIAL_CREATORS_MOCK = [
  {
    id: '1',
    name: 'Sarah Jenkins',
    handle: '@sarahj_fits',
    platform: Platform.Instagram,
    profileImage: 'https://picsum.photos/100/100',
    notes: 'Fitness niche, very high engagement. Prefers email contact.',
    status: CreatorStatus.LongTerm,
    paymentOptions: [{ method: PaymentMethod.PayPal, details: 'sarah@example.com' }],
    paymentStatus: PaymentStatus.Paid,
    rate: 500,
    email: 'sarah@example.com',
    dateAdded: new Date().toISOString(),
    rating: 'A+',
    flagged: false,
    shipmentStatus: ShipmentStatus.Delivered,
    campaign: 'Summer Launch',
  },
  {
    id: '2',
    name: 'Davide M.',
    handle: '@davide_vlogs',
    platform: Platform.YouTube,
    profileImage: 'https://picsum.photos/101/101',
    notes: 'Tech reviewer. Potential for Q4 campaign.',
    status: CreatorStatus.Active,
    paymentOptions: [{ method: PaymentMethod.Bank, details: 'Davide Multi-Media LLC' }],
    paymentStatus: PaymentStatus.Unpaid,
    rate: 1200,
    email: 'davide@example.com',
    dateAdded: new Date().toISOString(),
    rating: 'B',
    flagged: true,
    shipmentStatus: ShipmentStatus.Shipped,
    trackingNumber: '1Z99999999',
    campaign: 'Tech Review',
  },
];

export const STATUS_COLORS: Record<CreatorStatus, string> = {
  [CreatorStatus.Active]: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  [CreatorStatus.LongTerm]: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  [CreatorStatus.Inactive]: 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30',
  [CreatorStatus.Blackburn]: 'bg-red-500/10 text-red-500 border-red-500/20 opacity-70',
};

export const SHIPMENT_STATUS_COLORS: Record<ShipmentStatus, string> = {
  [ShipmentStatus.None]: 'text-neutral-500',
  [ShipmentStatus.Preparing]: 'text-yellow-500',
  [ShipmentStatus.Shipped]: 'text-blue-400', // In Transit
  [ShipmentStatus.Delivered]: 'text-emerald-400', // Received
  [ShipmentStatus.Issue]: 'text-red-500',
};

export const RATING_COLORS: Record<string, string> = {
  'A+': 'text-purple-400 border-purple-500/50 bg-purple-500/10',
  'A': 'text-emerald-400 border-emerald-500/50 bg-emerald-500/10',
  'B': 'text-blue-400 border-blue-500/50 bg-blue-500/10',
  'C': 'text-yellow-400 border-yellow-500/50 bg-yellow-500/10',
  'D': 'text-orange-400 border-orange-500/50 bg-orange-500/10',
  'F': 'text-red-400 border-red-500/50 bg-red-500/10',
};

export const CONTENT_STATUS_COLORS: Record<ContentStatus, string> = {
  [ContentStatus.Raw]: 'bg-neutral-500/20 text-neutral-400',
  [ContentStatus.Editing]: 'bg-yellow-500/20 text-yellow-400',
  [ContentStatus.Ready]: 'bg-emerald-500/20 text-emerald-400',
  [ContentStatus.Approved]: 'bg-teal-500/20 text-teal-400',
  [ContentStatus.Posted]: 'bg-blue-500/20 text-blue-400',
};
