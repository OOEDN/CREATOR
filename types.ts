
export enum CreatorStatus {
  Active = 'Active',
  LongTerm = 'Long Term',
  Inactive = 'Inactive',
  Blackburn = 'Blackburn',
}

export enum Platform {
  Instagram = 'Instagram',
  TikTok = 'TikTok',
  YouTube = 'YouTube',
  Twitter = 'Twitter',
  Twitch = 'Twitch',
  Other = 'Other',
}

export enum ReachPlatform {
  Brillo = 'Brillo',
  SocialCat = 'Social Cat',
  JoinBands = 'Join Bands',
  Other = 'Other',
}

export enum PaymentMethod {
  Venmo = 'Venmo',
  PayPal = 'PayPal',
  Zelle = 'Zelle',
  Bank = 'Bank Transfer',
  Gifted = 'Gifted',
  Other = 'Other',
  None = 'None',
}

export interface PaymentOption {
  method: PaymentMethod;
  details: string;
}

export enum PaymentStatus {
  Unpaid = 'Unpaid',
  Paid = 'Paid',
  Processing = 'Processing',
}

export enum ShipmentStatus {
  None = 'Not Shipped',
  Preparing = 'Preparing',
  Shipped = 'In Transit',
  Delivered = 'Delivered',
  Issue = 'Shipping Issue',
}

export enum CampaignStatus {
  Idea = 'Idea',
  Brainstorming = 'Brainstorming',
  Final = 'Final Campaign',
}

export type CreatorRating = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' | null;

export enum ContentStatus {
  Raw = 'Raw Asset',
  Editing = 'Needs Editing',
  Ready = 'Ready to Post',
  Posted = 'Posted',
}

export enum ContentType {
  Video = 'Video',
  Image = 'Image',
  Story = 'Story',
}

export interface AppSettings {
  googleCloudBucket?: string;
  googleDriveFolderId?: string;
  googleDriveContentFolderId?: string;
  googleCloudToken?: string;
  googleProjectId?: string;
  googleClientId?: string;
  useCloudStorage: boolean;
  logoUrl?: string;
  brandInfo?: string;
  teamEmail?: string;         // Dedicated email for creator comms (e.g. creators@ooedn.com)
  teamEmailToken?: string;    // OAuth token for the team email account
}

export interface ContentItem {
  id: string;
  creatorId?: string;
  campaignId?: string;
  creatorName?: string;
  title: string;
  type: ContentType;
  status: ContentStatus;
  platform: Platform;
  fileUrl: string;
  thumbnail?: string; // Base64 lightweight preview
  fileBlob?: Blob;
  storageType: 'local' | 'cloud';
  uploadDate: string;
  createdDate?: string;
  scheduledDate?: string;
  caption?: string;
  tags?: string[];
  isUsed?: boolean; // Track if content has been used in a campaign
  aiData?: any; // Store raw AI response for future proofing
  driveBackedUp?: boolean; // Track if file has been backed up to Google Drive
}

export interface CampaignTask {
  id: string;
  text: string;
  isDone: boolean;
}

export interface CampaignComment {
  id: string;
  user: string;
  text: string;
  date: string;
}

export interface Campaign {
  id: string;
  title: string;
  status: CampaignStatus;
  description: string;
  assignedCreatorIds: string[];
  lastUpdated: string;
  tasks?: CampaignTask[];
  comments?: CampaignComment[];
}

export interface Shipment {
  id: string;
  title: string;
  carrier: string;
  trackingNumber: string;
  status: ShipmentStatus;
  dateShipped: string;
  notes?: string;
  requestedBy?: string;
  isPriority?: boolean;
  // AI Tracking fields
  lastSyncedAt?: string;
  lastLocation?: string;
  detailedStatus?: string;
}

export interface TeamMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
  isSystem?: boolean;
  mentions?: string[]; // @mentioned team member emails
}

export interface TeamTask {
  id: string;
  title: string;
  assignedTo: string;
  assignedBy: string;
  status: 'Pending' | 'In Progress' | 'Done';
  dueDate?: string;
  relatedCreatorId?: string;
  notes?: string;
}

export interface Creator {
  id: string;
  name: string;
  handle: string;
  platform: Platform;
  reachPlatform?: string;
  profileImage: string;
  notes: string;
  status: CreatorStatus;
  paymentStatus: PaymentStatus;
  paymentOptions: PaymentOption[];
  rate: number;
  email?: string;
  address?: string;
  dateAdded: string;
  rating: CreatorRating;
  flagged: boolean;
  lastPaymentDate?: string;
  lastPaymentProof?: string;
  lastTransactionId?: string;
  campaign?: string;

  // Logistics
  shipments?: Shipment[]; // New array for multiple shipments

  // Legacy / Quick Status (Maintained for backward compatibility or primary status)
  shipmentStatus: ShipmentStatus;
  trackingNumber?: string;
  carrier?: string;
}

export interface TeamMember {
  email: string;
  role: string;
  addedAt: string;
}

declare global {
  interface Window {
    env: {
      API_KEY: string;
      CLIENT_ID?: string;
    };
    google?: any;
    APP_VERSION?: string;
  }
}
