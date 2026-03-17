
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
  Paused = 'Paused',
}

export enum ReachoutStatus {
  None = 'None',
  Queued = 'Queued',
  Contacted = 'Contacted',
  Responded = 'Responded',
  Reactivated = 'Reactivated',
}

export type CreatorRating = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' | null;

export enum ContentStatus {
  Raw = 'Raw Asset',
  Editing = 'Needs Editing',
  Ready = 'Ready to Post',
  Approved = 'Approved',
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

export interface ContentNote {
  id: string;
  user: string;
  text: string;
  date: string;
  isCreatorReply?: boolean;
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
  thumbnail?: string;
  fileBlob?: Blob;
  storageType: 'local' | 'cloud';
  uploadDate: string;
  createdDate?: string;
  scheduledDate?: string;
  caption?: string;
  tags?: string[];
  isUsed?: boolean;
  aiData?: any;
  driveBackedUp?: boolean;
  // Video feedback
  teamNotes?: ContentNote[];       // Team notes / feedback on this video
  paymentRequested?: boolean;       // Creator flagged this for payment
  paymentAmount?: number;           // Per-video payment amount
  // Approval gate
  approvedByTeam?: boolean;         // Team approved content for posting/payment
  approvedAt?: string;
  approvedBy?: string;
  // Review tracking
  reviewedAt?: string;              // When the content was last reviewed
  reviewedBy?: string;              // Who reviewed it
  submittedByCreator?: boolean;     // True if uploaded from creator portal (not team-uploaded)
  revisionCount?: number;           // Number of times this content has been revised
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
  isCreatorComment?: boolean;
  creatorId?: string;
}

export interface MoodboardItem {
  id: string;
  imageUrl: string;            // GCS or external URL
  caption?: string;
  addedBy: string;             // Team member name
  addedAt: string;
}

// Character Avatar for campaign creator matching
export interface CampaignAvatar {
  id: string;
  name: string;                // e.g. "The Rebel", "The Creator", "The Minimalist"
  description: string;         // Character personality and content style
  imageUrl?: string;           // Avatar image URL (optional)
  traits: string[];            // Key traits: ["bold", "streetwear", "minimal"]
  color: string;               // Accent color for the avatar card
  matchedCreatorIds: string[]; // Creators who identified with this avatar
  angles?: AvatarAngle[];      // Hook/story angles for this avatar
}

// Angle within an Avatar — creators choose an angle to unlock the full brief
export interface AvatarAngle {
  id: string;
  hook: string;                // The hook line (visible to creators)
  story: string;               // The overarching story/approach (visible)
  summary: string;             // Short brief summary (always visible on card)
  briefContent: string;        // Full brief / story script (revealed after selection)
  psychology?: string;         // Why this angle works psychologically
  visualCue?: string;          // Filming tips (location, style, overlays)
  hooks?: string[];            // Array of selectable hook options
  selectedByCreatorIds: string[];  // Creators who chose this angle
}

// Creator-to-Creator peer messaging
export interface PeerMessage {
  id: string;
  fromCreatorId: string;
  toCreatorId: string;
  text: string;
  timestamp: string;
  readAt?: string;
}

// UGC Inspiration Video reference
export interface UGCInspoItem {
  id: string;
  url: string;                 // Video URL (YouTube, TikTok, Instagram, etc.)
  title: string;
  platform?: string;           // Where the video is from
  notes?: string;              // Why this is inspiration
  addedBy: string;
  addedAt: string;
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
  deadline?: string;               // Due date for deliverables
  creatorNotified?: boolean;        // Whether creators have been notified
  acceptedByCreatorIds?: string[];  // Creators who accepted the campaign
  moodboard?: MoodboardItem[];     // Visual direction images
  styleNotes?: string;             // Tone, mood, colors, aesthetic guidance
  referenceLinks?: string[];       // Inspiration URLs
  // Avatar-based creator matching
  avatars?: CampaignAvatar[];      // Character personas for this campaign
  avatarOutreachSent?: boolean;    // Whether avatar identification emails have been sent
  // UGC Inspiration
  ugcInspo?: UGCInspoItem[];       // Inspiration UGC video references
  // Channel & Goal (Lark-style)
  channels?: string[];             // Content channels: "Social", "Video", "Display", "Linear TV", etc.
  goal?: string;                   // Campaign goal: "Traffic", "Engagement", "Branding", "Conversion", "Awareness"
  coverImage?: string;             // Cover image URL for gallery view
  // Brief fields
  briefGoal?: string;              // Campaign goal/metaphor (e.g. "Reframe Scalp Milk as Daily Supplement")
  briefMandatories?: string;       // Dos/don'ts / required shots / tagging rules
  maxCreatorsPerAvatar?: number;   // Max creators allowed per avatar (when all full → campaign closed)
  waitlistCreatorIds?: string[];   // Creators waiting for a slot to open up
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
  // Creator comms fields
  creatorId?: string;
  creatorName?: string;
  isCreatorMessage?: boolean;
  readByTeam?: boolean;             // Whether the team has read this creator message
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

  // Creator Portal fields
  role?: 'team' | 'creator';
  portalEmail?: string;
  paymentRequestDate?: string;
  notificationsEnabled?: boolean;       // Browser push notifications
  totalEarned?: number;                 // Lifetime earnings tracker
  lastActiveDate?: string;              // For streak tracking

  // Reachout tracking
  reachoutStatus?: ReachoutStatus;      // Pipeline status for creator reactivation
  reachoutNote?: string;                // Why this creator was tagged
  reachoutDate?: string;                // When they were tagged / last status change
}

export interface TeamMember {
  email: string;
  role: string;
  addedAt: string;
}

// Beta Testing Platform
export interface BetaTest {
  id: string;
  title: string;
  description: string;
  status: 'draft' | 'open' | 'in-progress' | 'complete';
  launched?: boolean; // Team must launch before creators can see it
  sampleImageUrl?: string;
  createdAt: string;
  embargoDate?: string;
  embargoConfirmedByTeam?: boolean;
  assignedCreatorIds: string[];
  styleNotes?: string;
}

export interface BetaRelease {
  id: string;
  betaTestId: string;
  creatorId: string;
  signedAt: string;
  agreed: boolean;
  releaseText: string;
  sampleShipped?: boolean;
  sampleReceived?: boolean;
  reviewSubmitted?: boolean;
  reviewText?: string;
  reviewRating?: number;
  contentApprovedByTeam?: boolean;
  contentPostDate?: string;
}

// Creator Portal — self-registration accounts
export interface CreatorAccount {
  id: string;
  email: string;
  password: string;            // Simple password (hashed in production)
  displayName: string;
  createdAt: string;
  linkedCreatorId?: string;    // Links to a Creator record once team approves
  invitedByTeam?: boolean;     // True if team created the account
  inviteEmailSent?: boolean;   // True if welcome email was sent
  onboardingComplete?: boolean; // True after creator finishes walkthrough
  betaLabIntroSeen?: boolean;   // True after creator sees Beta Lab intro
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
