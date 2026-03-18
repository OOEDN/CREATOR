/**
 * Creator XP & Achievements System
 * 
 * Manages experience points, levels, streaks, and achievement unlocks.
 * This is the foundation for all gamification in the creator app.
 */

// ─── LEVEL DEFINITIONS ─────────────────────────────────────────────────────
export interface LevelDef {
  level: number;
  name: string;
  emoji: string;
  minXP: number;
  color: string;          // CSS gradient
  glowColor: string;      // For UI effects
}

export const LEVELS: LevelDef[] = [
  { level: 1, name: 'Newbie',  emoji: '🌱', minXP: 0,    color: 'from-neutral-500 to-neutral-600',   glowColor: 'rgba(115,115,115,0.3)' },
  { level: 2, name: 'Rising',  emoji: '⚡', minXP: 100,  color: 'from-blue-500 to-cyan-500',         glowColor: 'rgba(59,130,246,0.3)' },
  { level: 3, name: 'Pro',     emoji: '🔥', minXP: 300,  color: 'from-purple-500 to-violet-500',     glowColor: 'rgba(139,92,246,0.3)' },
  { level: 4, name: 'Star',    emoji: '⭐', minXP: 600,  color: 'from-amber-500 to-yellow-500',      glowColor: 'rgba(245,158,11,0.3)' },
  { level: 5, name: 'Elite',   emoji: '💎', minXP: 1000, color: 'from-emerald-400 to-teal-500',      glowColor: 'rgba(52,211,153,0.3)' },
  { level: 6, name: 'Legend',  emoji: '👑', minXP: 2000, color: 'from-rose-500 to-pink-500',         glowColor: 'rgba(244,63,94,0.3)' },
];

export function getLevel(xp: number): LevelDef {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) return LEVELS[i];
  }
  return LEVELS[0];
}

export function getNextLevel(xp: number): LevelDef | null {
  const current = getLevel(xp);
  const next = LEVELS.find(l => l.level === current.level + 1);
  return next || null;
}

export function getLevelProgress(xp: number): number {
  const current = getLevel(xp);
  const next = getNextLevel(xp);
  if (!next) return 100; // Max level
  const range = next.minXP - current.minXP;
  const progress = xp - current.minXP;
  return Math.min(100, Math.round((progress / range) * 100));
}

// ─── XP REWARDS ─────────────────────────────────────────────────────────────
export const XP_REWARDS: Record<string, { xp: number; label: string }> = {
  content_upload:     { xp: 25,  label: 'Content Upload' },
  campaign_accept:    { xp: 20,  label: 'Campaign Accepted' },
  campaign_complete:  { xp: 50,  label: 'Campaign Complete' },
  task_complete:      { xp: 10,  label: 'Task Done' },
  on_time_delivery:   { xp: 30,  label: 'On-Time Delivery' },
  streak_day:         { xp: 5,   label: 'Daily Streak' },
  first_upload:       { xp: 50,  label: 'First Upload Bonus' },
  profile_complete:   { xp: 25,  label: 'Profile Complete' },
  draft_approved:     { xp: 15,  label: 'Draft Approved' },
  collab_complete:    { xp: 40,  label: 'Collab Complete' },
};

// ─── ACHIEVEMENT DEFINITIONS ────────────────────────────────────────────────
export interface AchievementDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  xpReward: number;
  category: 'content' | 'campaigns' | 'social' | 'milestones' | 'special';
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // Content
  { id: 'first_upload',      name: 'First Steps',        emoji: '📸', description: 'Upload your first piece of content',     xpReward: 50,  category: 'content' },
  { id: 'ten_uploads',       name: 'Content Machine',     emoji: '🎬', description: 'Upload 10 pieces of content',            xpReward: 100, category: 'content' },
  { id: 'fifty_uploads',     name: 'Prolific Creator',    emoji: '🏭', description: 'Upload 50 pieces of content',            xpReward: 200, category: 'content' },
  { id: 'all_approved',      name: 'Quality King',        emoji: '✅', description: 'Have 5 uploads approved in a row',       xpReward: 75,  category: 'content' },

  // Campaigns
  { id: 'first_campaign',    name: 'Mission Start',       emoji: '🎯', description: 'Accept your first campaign',             xpReward: 30,  category: 'campaigns' },
  { id: 'five_campaigns',    name: 'Campaign Veteran',    emoji: '🏅', description: 'Complete 5 campaigns',                   xpReward: 100, category: 'campaigns' },
  { id: 'ten_campaigns',     name: 'Campaign Legend',     emoji: '🏆', description: 'Complete 10 campaigns',                  xpReward: 200, category: 'campaigns' },
  { id: 'speed_demon',       name: 'Speed Demon',         emoji: '⚡', description: 'Deliver content before the deadline',    xpReward: 50,  category: 'campaigns' },

  // Social
  { id: 'first_collab',      name: 'Team Player',         emoji: '🤝', description: 'Complete your first collaboration',      xpReward: 40,  category: 'social' },
  { id: 'reactor',           name: 'Hype Squad',          emoji: '🔥', description: 'React to 10 pieces of content',          xpReward: 25,  category: 'social' },
  { id: 'community_voice',   name: 'Community Voice',     emoji: '💬', description: 'Send 25 messages in team chat',          xpReward: 30,  category: 'social' },

  // Milestones
  { id: 'week_streak',       name: 'Consistent Creator',  emoji: '📅', description: '7-day activity streak',                  xpReward: 50,  category: 'milestones' },
  { id: 'month_streak',      name: 'Iron Will',           emoji: '💪', description: '30-day activity streak',                 xpReward: 200, category: 'milestones' },
  { id: 'level_3',           name: 'Going Pro',           emoji: '🔥', description: 'Reach Pro level',                        xpReward: 50,  category: 'milestones' },
  { id: 'level_5',           name: 'Elite Status',        emoji: '💎', description: 'Reach Elite level',                      xpReward: 100, category: 'milestones' },

  // Special
  { id: 'trailblazer',       name: 'Trailblazer',         emoji: '🗺️', description: 'Complete the onboarding quest',          xpReward: 75,  category: 'special' },
  { id: 'perfect_month',     name: 'Perfect Month',       emoji: '🌟', description: 'Complete all tasks in a month',          xpReward: 150, category: 'special' },
  { id: 'beta_tester',       name: 'Beta Pioneer',        emoji: '🧪', description: 'Participate in a beta test',             xpReward: 60,  category: 'special' },
];

// ─── ACHIEVEMENT CHECKER ────────────────────────────────────────────────────
import { Creator, ContentItem, Campaign, TeamMessage } from '../types';

interface CheckResult {
  newAchievements: AchievementDef[];
  totalNewXP: number;
}

export function checkAchievements(
  creator: Creator,
  contentItems: ContentItem[],
  campaigns: Campaign[],
  messages: TeamMessage[]
): CheckResult {
  const earned = new Set(creator.achievements || []);
  const newAchievements: AchievementDef[] = [];
  
  const myContent = contentItems.filter(c => c.creatorId === creator.id);
  const myUploads = myContent.filter(c => c.submittedByCreator);
  const myCampaigns = campaigns.filter(c => c.acceptedByCreatorIds?.includes(creator.id));
  const myMessages = messages.filter(m => m.creatorId === creator.id && m.isCreatorMessage);

  function tryUnlock(id: string) {
    if (!earned.has(id)) {
      const def = ACHIEVEMENTS.find(a => a.id === id);
      if (def) { newAchievements.push(def); earned.add(id); }
    }
  }

  // Content achievements
  if (myUploads.length >= 1)  tryUnlock('first_upload');
  if (myUploads.length >= 10) tryUnlock('ten_uploads');
  if (myUploads.length >= 50) tryUnlock('fifty_uploads');

  // Check for 5 approved in a row
  const recentApproved = myContent.slice(-5);
  if (recentApproved.length >= 5 && recentApproved.every(c => c.approvedByTeam)) {
    tryUnlock('all_approved');
  }

  // Campaign achievements
  if (myCampaigns.length >= 1)  tryUnlock('first_campaign');
  if (myCampaigns.length >= 5)  tryUnlock('five_campaigns');
  if (myCampaigns.length >= 10) tryUnlock('ten_campaigns');

  // Social achievements
  if (myMessages.length >= 25) tryUnlock('community_voice');

  // Streak achievements
  if ((creator.streak || 0) >= 7)  tryUnlock('week_streak');
  if ((creator.streak || 0) >= 30) tryUnlock('month_streak');

  // Level achievements
  const level = getLevel(creator.xp || 0);
  if (level.level >= 3) tryUnlock('level_3');
  if (level.level >= 5) tryUnlock('level_5');

  const totalNewXP = newAchievements.reduce((sum, a) => sum + a.xpReward, 0);
  return { newAchievements, totalNewXP };
}

// ─── STREAK CALCULATOR ──────────────────────────────────────────────────────
export function updateStreak(creator: Creator): { streak: number; longestStreak: number; streakXP: number } {
  const now = new Date();
  const lastActive = creator.lastActiveDate ? new Date(creator.lastActiveDate) : null;
  
  if (!lastActive) {
    return { streak: 1, longestStreak: 1, streakXP: XP_REWARDS.streak_day.xp };
  }

  const diffMs = now.getTime() - lastActive.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Same day, no streak change
    return { streak: creator.streak || 1, longestStreak: creator.longestStreak || 1, streakXP: 0 };
  } else if (diffDays === 1) {
    // Consecutive day
    const newStreak = (creator.streak || 0) + 1;
    const longest = Math.max(newStreak, creator.longestStreak || 0);
    return { streak: newStreak, longestStreak: longest, streakXP: XP_REWARDS.streak_day.xp };
  } else {
    // Streak broken
    return { streak: 1, longestStreak: creator.longestStreak || 1, streakXP: XP_REWARDS.streak_day.xp };
  }
}
