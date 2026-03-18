
import React, { useState } from 'react';
import { Campaign, CampaignStatus, ContentItem, Creator, AppSettings, CreatorStatus, ContentType, CampaignTask, CampaignComment, MoodboardItem, CampaignAvatar, UGCInspoItem, AvatarAngle } from '../../../shared/types';
import { Plus, X, Layout, FileText, CheckCircle2, MoreHorizontal, Save, Users, ImageIcon, Sparkles, Loader2, BrainCircuit, Film, HardDrive, Printer, CheckSquare, MessageSquare, Trash2, ListTodo, Send, GripHorizontal, Eye, Edit3, PenTool, Mail, Palette, LinkIcon, ExternalLink, UserCircle2, Play, Video, Bot, Hash, Tag, Pause, Clock, Bell } from 'lucide-react';
import ContentLibrary from './ContentLibrary';
import { generateCampaignBrief, generateCampaignTasks, generateViralScript } from '../../../shared/services/geminiService';
import { createDriveFolder, uploadToGoogleDrive } from '../../../shared/services/googleDriveService';

interface CampaignBoardProps {
    campaigns: Campaign[];
    creators: Creator[];
    content: ContentItem[];
    onSaveCampaign: (campaign: Campaign) => void;
    onDeleteCampaign: (id: string) => void;
    onContentUpload: (item: ContentItem) => Promise<void>;
    onContentUpdate: (id: string, updates: Partial<ContentItem>) => void;
    onContentDelete: (id: string) => void;
    appSettings: AppSettings;
    onEmailBrief?: (to: string, subject: string, body: string) => void;
    onNotifyCreator?: (creatorId: string, campaignTitle: string) => void;
    onAskCoco?: (context: string) => void;
    onSendAvatarEmail?: (creatorEmails: string[], subject: string, body: string) => void;
}

type SidebarTab = 'execution' | 'roster' | 'avatars' | 'ugc' | 'moodboard';

const AVATAR_COLORS = [
    'from-emerald-500 to-teal-600',
    'from-purple-500 to-violet-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
    'from-blue-500 to-cyan-600',
    'from-red-500 to-rose-600',
];

const CampaignBoard: React.FC<CampaignBoardProps> = ({
    campaigns, creators, content, onSaveCampaign, onDeleteCampaign,
    onContentUpload, onContentUpdate, onContentDelete, appSettings, onEmailBrief, onNotifyCreator,
    onAskCoco, onSendAvatarEmail
}) => {
    const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
    const [showAIPrompt, setShowAIPrompt] = useState(false);
    const [aiPromptText, setAiPromptText] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSyncingDrive, setIsSyncingDrive] = useState(false);
    const [draggedCampaignId, setDraggedCampaignId] = useState<string | null>(null);
    const [commentText, setCommentText] = useState('');
    const [newTaskText, setNewTaskText] = useState('');
    const [editorMode, setEditorMode] = useState<'write' | 'preview'>('write');
    // New state for enhanced features
    const [sidebarTab, setSidebarTab] = useState<SidebarTab>('execution');
    const [newAvatarName, setNewAvatarName] = useState('');
    const [newAvatarDesc, setNewAvatarDesc] = useState('');
    const [newAvatarTraits, setNewAvatarTraits] = useState('');
    const [showAvatarForm, setShowAvatarForm] = useState(false);
    const [newUgcUrl, setNewUgcUrl] = useState('');
    const [newUgcTitle, setNewUgcTitle] = useState('');
    const [newUgcNotes, setNewUgcNotes] = useState('');
    const [showUgcForm, setShowUgcForm] = useState(false);
    const [avatarEmailTarget, setAvatarEmailTarget] = useState<string | null>(null);
    const [showAngleForm, setShowAngleForm] = useState<string | null>(null); // avatarId
    const [newAngleHook, setNewAngleHook] = useState('');
    const [newAngleStory, setNewAngleStory] = useState('');
    const [newAngleSummary, setNewAngleSummary] = useState('');
    const [newAngleBrief, setNewAngleBrief] = useState('');
    const [newAnglePsychology, setNewAnglePsychology] = useState('');
    const [newAngleVisualCue, setNewAngleVisualCue] = useState('');
    const [newAngleHooks, setNewAngleHooks] = useState('');
    // Lark-inspired: board view mode & filters
    const [boardView, setBoardView] = useState<'kanban' | 'gallery'>('kanban');
    const [channelFilter, setChannelFilter] = useState<string | null>(null);

    const CHANNEL_OPTIONS = ['Social', 'Video', 'Display', 'Linear TV', 'Email', 'Influencer', 'UGC', 'Audio'];
    const GOAL_OPTIONS = ['Traffic', 'Engagement', 'Branding', 'Conversion', 'Awareness', 'Retention'];
    const CHANNEL_COLORS: Record<string, string> = {
        'Social': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        'Video': 'bg-rose-500/20 text-rose-400 border-rose-500/30',
        'Display': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        'Linear TV': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        'Email': 'bg-teal-500/20 text-teal-400 border-teal-500/30',
        'Influencer': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
        'UGC': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        'Audio': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    };
    const GOAL_COLORS: Record<string, string> = {
        'Traffic': 'bg-emerald-500/20 text-emerald-400',
        'Engagement': 'bg-violet-500/20 text-violet-400',
        'Branding': 'bg-amber-500/20 text-amber-400',
        'Conversion': 'bg-rose-500/20 text-rose-400',
        'Awareness': 'bg-sky-500/20 text-sky-400',
        'Retention': 'bg-teal-500/20 text-teal-400',
    };

    // Filter campaigns by channel
    const filteredCampaigns = channelFilter
        ? campaigns.filter(c => c.channels?.includes(channelFilter))
        : campaigns;

    const columns = [
        { id: CampaignStatus.Idea, label: 'Fresh Ideas', icon: Layout, color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/5' },
        { id: CampaignStatus.Brainstorming, label: 'Brainstorming Hub', icon: BrainCircuit, color: 'text-blue-400 border-blue-500/30 bg-blue-500/5' },
        { id: CampaignStatus.Final, label: 'Final Campaigns', icon: CheckCircle2, color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5' },
        { id: CampaignStatus.Paused, label: 'Paused', icon: Pause, color: 'text-orange-400 border-orange-500/30 bg-orange-500/5' },
    ];

    const handleCreate = (status: CampaignStatus) => {
        const newCampaign: Campaign = {
            id: crypto.randomUUID(),
            title: 'New Agentic Brief',
            description: `## 🎯 North Star Objective
Reach 100k views with 15% retention at 3s.

## 🧠 Psychographic Audience
Users who engage with streetwear and gaming.

## 🪝 Hook Strategy (0-3s)
Use "Negative Assumption": Stop doing X if you want Y.

## 📝 Scripting (Hook -> Body -> CTA)
- Hook: ...
- Body: ...
- CTA: ...

## ⚖️ Compliance
- [ ] FTC #ad overlay
- [ ] AI Disclosure`,
            status: status,
            assignedCreatorIds: [],
            lastUpdated: new Date().toISOString(),
            tasks: [],
            comments: []
        };
        onSaveCampaign(newCampaign);
        setEditingCampaign(newCampaign);
    };

    // --- Drag and Drop Logic ---
    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedCampaignId(id);
        e.dataTransfer.setData('text/plain', id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent, newStatus: CampaignStatus) => {
        e.preventDefault();
        const id = e.dataTransfer.getData('text/plain');
        const campaign = campaigns.find(c => c.id === id);
        if (campaign && campaign.status !== newStatus) {
            onSaveCampaign({ ...campaign, status: newStatus });
        }
        setDraggedCampaignId(null);
    };

    // --- Tasks & Comments Logic ---
    const handleAddTask = () => {
        if (!editingCampaign || !newTaskText.trim()) return;
        const newTask: CampaignTask = { id: crypto.randomUUID(), text: newTaskText, isDone: false };
        const updated = { ...editingCampaign, tasks: [...(editingCampaign.tasks || []), newTask] };
        setEditingCampaign(updated);
        onSaveCampaign(updated);
        setNewTaskText('');
    };

    const handleToggleTask = (taskId: string) => {
        if (!editingCampaign) return;
        const updatedTasks = (editingCampaign.tasks || []).map(t => t.id === taskId ? { ...t, isDone: !t.isDone } : t);
        const updated = { ...editingCampaign, tasks: updatedTasks };
        setEditingCampaign(updated);
        onSaveCampaign(updated);
    };

    const handleAddComment = () => {
        if (!editingCampaign || !commentText.trim()) return;
        const newComment: CampaignComment = {
            id: crypto.randomUUID(),
            user: 'Team',
            text: commentText,
            date: new Date().toISOString()
        };
        const updated = { ...editingCampaign, comments: [...(editingCampaign.comments || []), newComment] };
        setEditingCampaign(updated);
        onSaveCampaign(updated);
        setCommentText('');
    };

    // --- AI Functions ---

    const handleGenerateTasks = async () => {
        if (!editingCampaign) return;
        setIsGenerating(true);
        try {
            const tasks = await generateCampaignTasks(editingCampaign.description, appSettings.brandInfo);
            const newTasks: CampaignTask[] = tasks.map((t: string) => ({ id: crypto.randomUUID(), text: t, isDone: false }));
            const updated = { ...editingCampaign, tasks: [...(editingCampaign.tasks || []), ...newTasks] };
            setEditingCampaign(updated);
            onSaveCampaign(updated);
        } catch (e) {
            alert("Failed to generate tasks.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateScript = async () => {
        if (!editingCampaign) return;
        setIsGenerating(true);
        try {
            const scriptSection = await generateViralScript(editingCampaign.description, appSettings.brandInfo);
            const updatedDescription = editingCampaign.description + "\n\n" + scriptSection;
            const updated = { ...editingCampaign, description: updatedDescription };
            setEditingCampaign(updated);
            onSaveCampaign(updated);
            setEditorMode('preview'); // Switch to preview to see the result
        } catch (e) {
            alert("Failed to generate script.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleAIGenerate = async () => {
        if (!aiPromptText.trim()) return;
        setIsGenerating(true);
        try {
            const result = await generateCampaignBrief(aiPromptText, creators, campaigns, appSettings.brandInfo);
            const newCampaign: Campaign = {
                id: crypto.randomUUID(),
                title: result.title,
                description: result.description,
                status: CampaignStatus.Idea,
                assignedCreatorIds: result.recommendedCreatorIds || [],
                lastUpdated: new Date().toISOString(),
                tasks: [],
                comments: []
            };
            onSaveCampaign(newCampaign);
            setEditingCampaign(newCampaign);
            setShowAIPrompt(false);
            setAiPromptText('');
        } catch (e) {
            alert("Failed to generate campaign. Check Brand Bible and API settings.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDriveSync = async () => {
        if (!editingCampaign || !appSettings.googleCloudToken) return alert("Login required.");
        setIsSyncingDrive(true);
        try {
            const folderId = await createDriveFolder(`[OOEDN] ${editingCampaign.title}`, appSettings.googleCloudToken, appSettings.googleProjectId);
            const briefBlob = new Blob([
                `CAMPAIGN: ${editingCampaign.title}\nSTATUS: ${editingCampaign.status}\nLAST UPDATED: ${new Date().toLocaleDateString()}\n\n----------------------------------------\n\n${editingCampaign.description}`
            ], { type: 'text/plain' });
            await uploadToGoogleDrive(briefBlob, folderId, appSettings.googleCloudToken, 'Campaign_Brief.txt', appSettings.googleProjectId);

            const campaignAssets = content.filter(c => c.campaignId === editingCampaign.id);
            for (const asset of campaignAssets) {
                try {
                    const res = await fetch(asset.fileUrl, { headers: { 'Authorization': `Bearer ${appSettings.googleCloudToken}` } });
                    const blob = await res.blob();
                    await uploadToGoogleDrive(blob, folderId, appSettings.googleCloudToken, asset.title, appSettings.googleProjectId);
                } catch (e) { console.warn("Skipped asset upload due to error", e); }
            }
            alert("Campaign Folder Created in Drive! Brief and assets synced.");
        } catch (e: any) { alert(`Sync Error: ${e.message}`); } finally { setIsSyncingDrive(false); }
    };

    const handlePrint = () => {
        if (!editingCampaign) return;
        // Build a clean HTML document for the brief
        const title = editingCampaign.title;
        const desc = editingCampaign.description;
        const assignedNames = editingCampaign.assignedCreatorIds
            .map(id => creators.find(c => c.id === id)?.name)
            .filter(Boolean)
            .join(', ');
        const tasks = (editingCampaign.tasks || [])
            .map(t => `${t.isDone ? '✅' : '⬜'} ${t.text}`)
            .join('\n');

        const printContent = `
      <html>
        <head><title>${title} - Campaign Brief</title>
        <style>
          body { font-family: 'Segoe UI', system-ui, sans-serif; max-width: 700px; margin: 40px auto; padding: 20px; color: #222; }
          h1 { font-size: 28px; margin-bottom: 4px; }
          .meta { color: #666; font-size: 13px; margin-bottom: 24px; border-bottom: 2px solid #10b981; padding-bottom: 12px; }
          h2 { font-size: 18px; color: #10b981; margin-top: 24px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
          p, li { font-size: 14px; line-height: 1.7; }
          .tasks { background: #f8f8f8; padding: 16px; border-radius: 8px; margin-top: 16px; }
          .tasks h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px; }
          .task { padding: 4px 0; font-size: 13px; }
          @media print { body { margin: 0; } }
        </style></head>
        <body>
          <h1>${title}</h1>
          <div class="meta">Status: ${editingCampaign.status} · ${assignedNames ? 'Creators: ' + assignedNames : 'No creators assigned'} · ${new Date().toLocaleDateString()}</div>
          ${desc.split('\n').map(line => {
            if (line.trim().startsWith('##')) return '<h2>' + line.replace('##', '').trim() + '</h2>';
            if (line.trim().startsWith('-')) return '<li>' + line.replace('-', '').trim() + '</li>';
            return '<p>' + line + '</p>';
        }).join('')}
          ${tasks ? '<div class="tasks"><h3>Tasks</h3>' + tasks.split('\n').map(t => '<div class="task">' + t + '</div>').join('') + '</div>' : ''}
        </body>
      </html>`;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(printContent);
            printWindow.document.close();
            setTimeout(() => printWindow.print(), 300);
        }
    };

    const handleEmailBrief = () => {
        if (!editingCampaign) return;
        const title = editingCampaign.title;
        const assignedNames = editingCampaign.assignedCreatorIds
            .map(id => creators.find(c => c.id === id)?.name)
            .filter(Boolean);
        const body = `Campaign Brief: ${title}\n\nStatus: ${editingCampaign.status}\nAssigned: ${assignedNames.join(', ') || 'None'}\n\n${editingCampaign.description}\n\n---\nSent from OOEDN Creator Hub`;

        if (onEmailBrief) {
            onEmailBrief('', `Campaign Brief: ${title}`, body);
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(body).then(() => alert('Brief copied to clipboard! Paste into the Creator Inbox.'));
        }
    };

    const formatDescription = (text: string) => {
        return text.split('\n').map((line, i) => {
            if (line.trim().startsWith('##')) return <h4 key={i} className="text-xl font-black text-emerald-400 mt-8 mb-4 uppercase tracking-wide border-b border-emerald-500/30 pb-2">{line.replace('##', '').trim()}</h4>
            if (line.trim().startsWith('-')) return <li key={i} className="ml-4 text-neutral-300 mb-2 leading-relaxed">{line.replace('-', '').trim()}</li>
            return <p key={i} className="text-neutral-300 mb-3 leading-relaxed text-base">{line}</p>
        });
    };

    // --- Avatar Handlers ---
    const handleAddAvatar = () => {
        if (!editingCampaign || !newAvatarName.trim()) return;
        const newAvatar: CampaignAvatar = {
            id: crypto.randomUUID(),
            name: newAvatarName,
            description: newAvatarDesc,
            traits: newAvatarTraits.split(',').map(t => t.trim()).filter(Boolean),
            color: AVATAR_COLORS[(editingCampaign.avatars?.length || 0) % AVATAR_COLORS.length],
            matchedCreatorIds: [],
        };
        const updated = { ...editingCampaign, avatars: [...(editingCampaign.avatars || []), newAvatar] };
        setEditingCampaign(updated);
        onSaveCampaign(updated);
        setNewAvatarName(''); setNewAvatarDesc(''); setNewAvatarTraits(''); setShowAvatarForm(false);
    };

    const handleDeleteAvatar = (avatarId: string) => {
        if (!editingCampaign) return;
        const updated = { ...editingCampaign, avatars: (editingCampaign.avatars || []).filter(a => a.id !== avatarId) };
        setEditingCampaign(updated);
        onSaveCampaign(updated);
    };

    const handleSendAvatarEmail = (avatar: CampaignAvatar) => {
        if (!editingCampaign) return;
        const eligibleCreators = creators.filter(c => c.email && editingCampaign.assignedCreatorIds.includes(c.id));
        if (eligibleCreators.length === 0) return alert('No creators with emails assigned to this campaign. Assign creators first.');
        const emails = eligibleCreators.map(c => c.email!);
        const subject = `OOEDN — Do you vibe with "${avatar.name}"?`;
        const body = `Hey {name},\n\nWe're building something special for our next campaign: "${editingCampaign.title}"\n\nWe've created a character called "${avatar.name}" — ${avatar.description}\n\nTraits: ${avatar.traits.join(', ')}\n\nDo you identify with this character? If this feels like you, reply and let us know — we'll send you a campaign brief that matches your energy.\n\nNo pressure. We just want to make sure the content feels authentic to who you are.\n\n— OOEDN Team`;
        if (onSendAvatarEmail) {
            onSendAvatarEmail(emails, subject, body);
            const updated = { ...editingCampaign, avatarOutreachSent: true };
            setEditingCampaign(updated);
            onSaveCampaign(updated);
            alert(`Avatar outreach sent to ${emails.length} creator(s)!`);
        } else if (onEmailBrief) {
            onEmailBrief(emails.join(', '), subject, body);
        } else {
            navigator.clipboard.writeText(body).then(() => alert('Email body copied to clipboard!'));
        }
    };

    // --- UGC Handlers ---
    const handleAddUgc = () => {
        if (!editingCampaign || !newUgcUrl.trim() || !newUgcTitle.trim()) return;
        const platform = newUgcUrl.includes('youtube') || newUgcUrl.includes('youtu.be') ? 'YouTube'
            : newUgcUrl.includes('tiktok') ? 'TikTok'
                : newUgcUrl.includes('instagram') ? 'Instagram'
                    : newUgcUrl.includes('vimeo') ? 'Vimeo' : 'Other';
        const item: UGCInspoItem = {
            id: crypto.randomUUID(), url: newUgcUrl, title: newUgcTitle,
            platform, notes: newUgcNotes || undefined, addedBy: 'Team', addedAt: new Date().toISOString(),
        };
        const updated = { ...editingCampaign, ugcInspo: [...(editingCampaign.ugcInspo || []), item] };
        setEditingCampaign(updated);
        onSaveCampaign(updated);
        setNewUgcUrl(''); setNewUgcTitle(''); setNewUgcNotes(''); setShowUgcForm(false);
    };

    const handleDeleteUgc = (ugcId: string) => {
        if (!editingCampaign) return;
        const updated = { ...editingCampaign, ugcInspo: (editingCampaign.ugcInspo || []).filter(u => u.id !== ugcId) };
        setEditingCampaign(updated);
        onSaveCampaign(updated);
    };

    const getYouTubeEmbedUrl = (url: string): string | null => {
        const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        return match ? `https://www.youtube.com/embed/${match[1]}` : null;
    };

    // --- Coco Context ---
    const handleAskCoco = () => {
        if (!editingCampaign || !onAskCoco) return;
        const avatarSummary = (editingCampaign.avatars || []).map(a => `"${a.name}" (${a.traits.join(', ')}) — ${a.matchedCreatorIds.length} matched`).join('; ');
        const creatorNames = editingCampaign.assignedCreatorIds.map(id => creators.find(c => c.id === id)?.name).filter(Boolean).join(', ');
        const ctx = `I'm working on campaign "${editingCampaign.title}" (Status: ${editingCampaign.status}). Brief: ${editingCampaign.description.slice(0, 500)}. Assigned creators: ${creatorNames || 'None'}. Avatars: ${avatarSummary || 'None'}. UGC Inspo: ${editingCampaign.ugcInspo?.length || 0} videos.`;
        onAskCoco(ctx);
    };

    // Sidebar tab config
    const sidebarTabs: { id: SidebarTab; label: string; icon: any; color: string }[] = [
        { id: 'execution', label: 'Tasks', icon: ListTodo, color: 'text-blue-400 border-blue-500' },
        { id: 'roster', label: 'Roster', icon: Users, color: 'text-emerald-400 border-emerald-500' },
        { id: 'avatars', label: 'Avatars', icon: UserCircle2, color: 'text-purple-400 border-purple-500' },
        { id: 'ugc', label: 'UGC', icon: Video, color: 'text-rose-400 border-rose-500' },
        { id: 'moodboard', label: 'Mood', icon: Palette, color: 'text-amber-400 border-amber-500' },
    ];

    return (
        <div className="h-full flex flex-col relative bg-ooedn-black">
            {/* BOARD VIEW */}
            {!editingCampaign && (
                <div className="flex-1 overflow-x-auto p-6">
                    {/* Toolbar: AI Button + View Toggle + Channel Filter */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setShowAIPrompt(true)} className="bg-emerald-500 hover:bg-emerald-400 text-black px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl active:scale-95">
                                <Sparkles size={18} /> AI Creative Brainstorm
                            </button>
                            <div className="flex bg-neutral-900 border border-neutral-800 rounded-lg p-1 gap-0.5">
                                <button onClick={() => setBoardView('kanban')} className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all ${boardView === 'kanban' ? 'bg-white text-black' : 'text-neutral-500 hover:text-white'}`} title="Kanban Board">
                                    <Layout size={12} /> Board
                                </button>
                                <button onClick={() => setBoardView('gallery')} className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all ${boardView === 'gallery' ? 'bg-white text-black' : 'text-neutral-500 hover:text-white'}`} title="Gallery View">
                                    <ImageIcon size={12} /> Gallery
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Channel Filter Bar */}
                    <div className="flex items-center gap-2 mb-6 flex-wrap">
                        <span className="text-[9px] font-black text-neutral-600 uppercase tracking-widest mr-1">Channels:</span>
                        <button onClick={() => setChannelFilter(null)} className={`px-3 py-1 rounded-full text-[9px] font-bold transition-all border ${!channelFilter ? 'bg-white text-black border-white' : 'text-neutral-500 border-neutral-800 hover:border-neutral-600'}`}>All</button>
                        {CHANNEL_OPTIONS.map(ch => {
                            const count = campaigns.filter(c => c.channels?.includes(ch)).length;
                            if (count === 0 && channelFilter !== ch) return null;
                            return (
                                <button key={ch} onClick={() => setChannelFilter(channelFilter === ch ? null : ch)} className={`px-3 py-1 rounded-full text-[9px] font-bold transition-all border flex items-center gap-1.5 ${channelFilter === ch ? CHANNEL_COLORS[ch] + ' border-current' : 'text-neutral-500 border-neutral-800 hover:border-neutral-600'}`}>
                                    {ch} <span className="text-[7px] opacity-60">{count}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* KANBAN VIEW */}
                    {boardView === 'kanban' && (
                        <div className="flex gap-6 h-[calc(100%-140px)]">
                            {columns.map(col => (
                                <div key={col.id} className="flex-1 flex flex-col min-w-[260px]" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, col.id)}>
                                    <div className={`p-5 rounded-t-2xl border-b-2 flex items-center justify-between bg-neutral-900/50 ${col.color}`}>
                                        <div className="flex items-center gap-3 font-black uppercase text-xs tracking-widest">
                                            <col.icon size={20} />
                                            {col.label}
                                            <span className="text-[9px] opacity-50">{filteredCampaigns.filter(c => c.status === col.id).length}</span>
                                        </div>
                                        <button onClick={() => handleCreate(col.id)} className="hover:bg-white/10 p-2 rounded-lg transition-colors" title="Add campaign"><Plus size={20} /></button>
                                    </div>
                                    <div className="bg-neutral-900/20 border-x border-b border-neutral-800 rounded-b-2xl flex-1 p-4 space-y-4 overflow-y-auto custom-scrollbar">
                                        {filteredCampaigns.filter(c => c.status === col.id).map(campaign => (
                                            <div
                                                key={campaign.id} draggable onDragStart={(e) => handleDragStart(e, campaign.id)}
                                                onClick={() => setEditingCampaign(campaign)}
                                                className={`bg-ooedn-gray border border-neutral-800 rounded-2xl cursor-pointer hover:border-emerald-500/50 hover:shadow-2xl hover:-translate-y-1 transition-all group shadow-lg overflow-hidden ${draggedCampaignId === campaign.id ? 'opacity-50' : ''}`}
                                            >
                                                {/* Cover Image (if set) */}
                                                {campaign.coverImage && (
                                                    <div className="h-28 w-full overflow-hidden">
                                                        <img src={campaign.coverImage} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                                    </div>
                                                )}
                                                <div className="p-5">
                                                    {/* Goal Badge */}
                                                    {campaign.goal && (
                                                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md mb-2 inline-block ${GOAL_COLORS[campaign.goal] || 'bg-neutral-800 text-neutral-400'}`}>{campaign.goal}</span>
                                                    )}
                                                    <div className="flex justify-between items-start mb-2">
                                                        <h4 className="font-black text-white group-hover:text-emerald-400 uppercase tracking-tighter text-sm leading-tight">{campaign.title}</h4>
                                                        <GripHorizontal size={16} className="text-neutral-600 cursor-grab flex-shrink-0" />
                                                    </div>
                                                    {/* Channel Tags */}
                                                    {campaign.channels && campaign.channels.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mb-3">
                                                            {campaign.channels.map(ch => (
                                                                <span key={ch} className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${CHANNEL_COLORS[ch] || 'bg-neutral-800 text-neutral-400 border-neutral-700'}`}>{ch}</span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                                                        <span className="text-[10px] font-bold text-neutral-500 bg-neutral-900 px-2 py-1 rounded border border-neutral-800">{campaign.tasks?.filter(t => t.isDone).length || 0}/{campaign.tasks?.length || 0} Tasks</span>
                                                        <span className="text-[10px] font-bold text-neutral-500 flex items-center gap-1"><MessageSquare size={10} /> {campaign.comments?.length || 0}</span>
                                                        {(campaign.avatars?.length || 0) > 0 && <span className="text-[10px] font-bold text-purple-400 flex items-center gap-1 bg-purple-500/10 px-2 py-0.5 rounded-full"><UserCircle2 size={10} /> {campaign.avatars!.length}</span>}
                                                        {(campaign.ugcInspo?.length || 0) > 0 && <span className="text-[10px] font-bold text-rose-400 flex items-center gap-1 bg-rose-500/10 px-2 py-0.5 rounded-full"><Play size={10} /> {campaign.ugcInspo!.length}</span>}
                                                    </div>
                                                    <p className="text-[10px] text-neutral-500 line-clamp-2 mb-3 font-medium leading-relaxed font-mono">
                                                        {campaign.description.slice(0, 100).replace(/[#\-]/g, '') || 'No brief defined.'}
                                                    </p>
                                                    <div className="flex items-center justify-between border-t border-neutral-800 pt-3">
                                                        <div className="flex -space-x-2">
                                                            {campaign.assignedCreatorIds.slice(0, 4).map(id => {
                                                                const cr = creators.find(c => c.id === id);
                                                                return cr ? (
                                                                    <div key={id} className="w-7 h-7 rounded-full border-2 border-neutral-900 bg-neutral-800 flex items-center justify-center overflow-hidden shadow-lg">
                                                                        {cr.profileImage ? <img src={cr.profileImage} className="w-full h-full object-cover" alt={cr.name} /> : <span className="text-[8px] font-black">{cr.name[0]}</span>}
                                                                    </div>
                                                                ) : null;
                                                            })}
                                                        </div>
                                                        <span className="flex items-center gap-1 text-[8px] font-black text-neutral-500 uppercase tracking-widest"><ImageIcon size={14} /> {content.filter(c => c.campaignId === campaign.id).length}</span>
                                                        {(campaign.waitlistCreatorIds?.length || 0) > 0 && (
                                                            <span className="text-[8px] font-bold text-amber-400 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                                                <Clock size={9} /> {campaign.waitlistCreatorIds!.length} waitlisted
                                                            </span>
                                                        )}
                                                        {campaign.status === CampaignStatus.Paused && (
                                                            <span className="text-[8px] font-bold text-orange-400 flex items-center gap-1 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
                                                                <Pause size={9} /> Paused
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* GALLERY VIEW */}
                    {boardView === 'gallery' && (
                        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                            {filteredCampaigns.map(campaign => (
                                <div key={campaign.id} onClick={() => setEditingCampaign(campaign)} className="bg-ooedn-gray border border-neutral-800 rounded-2xl overflow-hidden cursor-pointer hover:border-emerald-500/50 hover:shadow-2xl hover:-translate-y-1 transition-all group">
                                    {/* Cover */}
                                    <div className={`h-36 w-full overflow-hidden ${!campaign.coverImage ? 'bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center' : ''}`}>
                                        {campaign.coverImage ? (
                                            <img src={campaign.coverImage} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                        ) : (
                                            <div className="text-center">
                                                <FileText size={32} className="mx-auto text-neutral-700 mb-1" />
                                                <p className="text-[8px] text-neutral-700 font-bold uppercase">No Cover</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4">
                                        <h4 className="font-black text-white group-hover:text-emerald-400 uppercase tracking-tighter text-xs leading-tight mb-2 line-clamp-2">{campaign.title}</h4>
                                        {/* Goal */}
                                        {campaign.goal && <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md mr-2 ${GOAL_COLORS[campaign.goal] || 'bg-neutral-800 text-neutral-400'}`}>{campaign.goal}</span>}
                                        {/* Channel Tags */}
                                        <div className="flex flex-wrap gap-1 mt-2 mb-3">
                                            {(campaign.channels || []).map(ch => (
                                                <span key={ch} className={`text-[7px] font-bold px-1.5 py-0.5 rounded border ${CHANNEL_COLORS[ch] || 'bg-neutral-800 text-neutral-400 border-neutral-700'}`}>{ch}</span>
                                            ))}
                                        </div>
                                        {/* Description snippet */}
                                        <p className="text-[9px] text-neutral-500 line-clamp-2 mb-3 leading-relaxed">{campaign.description.slice(0, 80).replace(/[#\-]/g, '') || 'No brief.'}</p>
                                        {/* Footer */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex -space-x-1.5">
                                                {campaign.assignedCreatorIds.slice(0, 3).map(id => {
                                                    const cr = creators.find(c => c.id === id);
                                                    return cr ? (
                                                        <div key={id} className="w-6 h-6 rounded-full border-2 border-neutral-900 bg-neutral-800 flex items-center justify-center overflow-hidden">
                                                            {cr.profileImage ? <img src={cr.profileImage} className="w-full h-full object-cover" alt={cr.name} /> : <span className="text-[7px] font-black">{cr.name[0]}</span>}
                                                        </div>
                                                    ) : null;
                                                })}
                                            </div>
                                            <span className={`text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${campaign.status === CampaignStatus.Final ? 'text-emerald-400 bg-emerald-500/10' : campaign.status === CampaignStatus.Brainstorming ? 'text-blue-400 bg-blue-500/10' : 'text-yellow-400 bg-yellow-500/10'}`}>{campaign.status}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {/* Add Campaign Card */}
                            <button onClick={() => handleCreate(CampaignStatus.Idea)} className="border-2 border-dashed border-neutral-800 rounded-2xl h-36 flex flex-col items-center justify-center gap-2 text-neutral-600 hover:text-emerald-400 hover:border-emerald-500/30 transition-all" title="Add campaign">
                                <Plus size={28} />
                                <span className="text-[9px] font-black uppercase tracking-widest">New Campaign</span>
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* AI PROMPT MODAL */}
            {showAIPrompt && (
                <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-ooedn-dark border border-neutral-700 rounded-3xl w-full max-w-xl p-10 shadow-2xl">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-2xl font-black text-white flex items-center gap-3 uppercase tracking-tighter"><Sparkles className="text-emerald-500" size={28} /> AI Creative Engine</h3>
                            <button onClick={() => setShowAIPrompt(false)} className="text-neutral-500 hover:text-white transition-colors"><X size={28} /></button>
                        </div>
                        <textarea
                            value={aiPromptText}
                            onChange={(e) => setAiPromptText(e.target.value)}
                            placeholder="Describe the drop, mood, and goals..."
                            className="w-full h-48 bg-black border border-neutral-800 rounded-2xl p-5 text-sm text-white focus:border-emerald-500 outline-none mb-8 resize-none shadow-inner"
                        />
                        <button
                            onClick={handleAIGenerate}
                            disabled={isGenerating || !aiPromptText.trim()}
                            className="w-full bg-emerald-500 text-black font-black uppercase tracking-widest py-5 rounded-2xl flex items-center justify-center gap-3 hover:bg-emerald-400 disabled:opacity-50 transition-all shadow-xl"
                        >
                            {isGenerating ? <Loader2 className="animate-spin" size={22} /> : <Sparkles size={22} />}
                            {isGenerating ? 'Dreaming...' : 'Initiate AI Campaign Flow'}
                        </button>
                    </div>
                </div>
            )}

            {/* FULL SCREEN STUDIO EDITING MODE */}
            {editingCampaign && (
                <div className="absolute inset-0 z-50 bg-ooedn-black flex flex-col animate-in slide-in-from-bottom-5 overflow-hidden">
                    {/* Top Bar */}
                    <div className="h-20 border-b border-neutral-800 flex items-center justify-between px-8 bg-ooedn-dark flex-shrink-0">
                        <div className="flex items-center gap-6 flex-1">
                            <button onClick={() => setEditingCampaign(null)} className="text-neutral-400 hover:text-white transition-colors"><X size={28} /></button>
                            <div className="h-10 w-[1px] bg-neutral-800"></div>
                            <input
                                value={editingCampaign.title}
                                onChange={(e) => setEditingCampaign({ ...editingCampaign, title: e.target.value })}
                                className="bg-transparent text-2xl font-black text-white focus:outline-none placeholder-neutral-700 w-full uppercase tracking-tighter"
                                placeholder="Campaign Title"
                            />
                            <select
                                value={editingCampaign.status}
                                onChange={(e) => {
                                    const updated = { ...editingCampaign, status: e.target.value as CampaignStatus };
                                    setEditingCampaign(updated);
                                    onSaveCampaign(updated);
                                }}
                                className="bg-neutral-900 border border-neutral-800 text-white text-xs font-black uppercase tracking-widest rounded-lg px-3 py-2 outline-none focus:border-emerald-500"
                            >
                                {Object.values(CampaignStatus).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-3 print:hidden">
                            <button onClick={handleDriveSync} disabled={isSyncingDrive} className="bg-neutral-800 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-white hover:text-black transition-all" title="Create Drive Folder & Doc">
                                {isSyncingDrive ? <Loader2 size={16} className="animate-spin" /> : <HardDrive size={16} />} Sync to Drive
                            </button>
                            <button onClick={handlePrint} className="bg-neutral-800 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-white hover:text-black transition-all">
                                <Printer size={16} /> PDF
                            </button>
                            <button onClick={handleEmailBrief} className="bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-500 hover:text-black transition-all border border-emerald-500/20">
                                <Mail size={16} /> Email Brief
                            </button>
                            {onAskCoco && (
                                <button onClick={handleAskCoco} className="bg-gradient-to-r from-violet-600 to-purple-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:from-violet-500 hover:to-purple-500 transition-all shadow-lg shadow-purple-500/20">
                                    <Bot size={16} /> Ask Coco
                                </button>
                            )}
                            <div className="h-8 w-[1px] bg-neutral-800 mx-2"></div>
                            <button onClick={() => { if (confirm("Delete Campaign?")) { onDeleteCampaign(editingCampaign.id); setEditingCampaign(null); } }} className="bg-red-500/10 text-red-500 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">
                                <Trash2 size={16} />
                            </button>
                            <button
                                onClick={() => {
                                    const avatars = editingCampaign.avatars || [];
                                    if (avatars.length === 0) {
                                        alert('⚠️ Cannot finalize: No avatars created yet. Parse avatars from the brief first.');
                                        return;
                                    }
                                    const noAngles = avatars.filter(a => (a.angles || []).length === 0);
                                    if (noAngles.length > 0) {
                                        alert('⚠️ Cannot finalize: ' + noAngles.map(a => a.name).join(', ') + ' need angles. Add angles to all avatars first.');
                                        return;
                                    }
                                    if (!editingCampaign.assignedCreatorIds || editingCampaign.assignedCreatorIds.length === 0) {
                                        if (!confirm('⚠️ No creators assigned yet. Finalize anyway? (Assign creators later from Roster tab)')) return;
                                    }
                                    const finalized = { ...editingCampaign, status: CampaignStatus.Final };
                                    setEditingCampaign(finalized);
                                    onSaveCampaign(finalized);
                                    alert('🚀 Campaign "' + finalized.title + '" is now LIVE!\n\n✅ Status: Final Campaign\n✅ ' + avatars.length + ' avatars, ' + avatars.reduce((s, a) => s + (a.angles?.length || 0), 0) + ' angles\n✅ ' + (finalized.assignedCreatorIds?.length || 0) + ' creators assigned\n\nCreators will see this on their dashboard now.');
                                }}
                                className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-black px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:from-emerald-400 hover:to-cyan-400 transition-all shadow-lg shadow-emerald-500/20"
                                title="Validate and push campaign live to creator app"
                            >
                                🚀 Finalize
                            </button>
                            {editingCampaign.status === CampaignStatus.Final && (
                                <button
                                    onClick={() => {
                                        const paused = { ...editingCampaign, status: CampaignStatus.Paused };
                                        setEditingCampaign(paused);
                                        onSaveCampaign(paused);
                                        alert('⏸ Campaign "' + paused.title + '" is now PAUSED.\n\nCreators will see a "Campaign Paused" message and cannot interact with it until you resume.');
                                    }}
                                    className="bg-orange-500/10 text-orange-400 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 border border-orange-500/20 hover:bg-orange-500 hover:text-black transition-all"
                                    title="Pause this campaign — creators won't be able to interact"
                                >
                                    <Pause size={14} /> Pause
                                </button>
                            )}
                            {editingCampaign.status === CampaignStatus.Paused && (
                                <button
                                    onClick={() => {
                                        const resumed = { ...editingCampaign, status: CampaignStatus.Final };
                                        setEditingCampaign(resumed);
                                        onSaveCampaign(resumed);
                                        alert('▶️ Campaign "' + resumed.title + '" is LIVE again!\n\nCreators can now interact with it.');
                                    }}
                                    className="bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 border border-emerald-500/20 hover:bg-emerald-500 hover:text-black transition-all"
                                    title="Resume this campaign — put it back live"
                                >
                                    <Play size={14} /> Resume
                                </button>
                            )}
                            <button onClick={() => { onSaveCampaign(editingCampaign); setEditingCampaign(null); }} className="bg-emerald-500 text-black px-8 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-400 transition-all shadow-lg">
                                <Save size={18} /> Done
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 flex overflow-hidden">
                        {/* LEFT: Compact Brief Panel */}
                        <div className="w-[320px] bg-ooedn-dark border-r border-neutral-800 flex flex-col flex-shrink-0">
                            <div className="p-4 border-b border-neutral-800 bg-neutral-900/50 flex justify-between items-center">
                                <h3 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                                    <FileText size={14} className="text-emerald-500" /> Brief
                                </h3>
                                <div className="flex gap-1">
                                    <div className="flex bg-black border border-neutral-800 rounded-lg p-0.5">
                                        <button
                                            onClick={() => setEditorMode('write')}
                                            className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest flex items-center gap-1 transition-all ${editorMode === 'write' ? 'bg-white text-black' : 'text-neutral-500 hover:text-white'}`}
                                        >
                                            <Edit3 size={10} /> Write
                                        </button>
                                        <button
                                            onClick={() => setEditorMode('preview')}
                                            className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest flex items-center gap-1 transition-all ${editorMode === 'preview' ? 'bg-white text-black' : 'text-neutral-500 hover:text-white'}`}
                                        >
                                            <Eye size={10} /> Preview
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-1 p-2 border-b border-neutral-800">
                                <button onClick={handleGenerateScript} disabled={isGenerating} className="text-[8px] bg-purple-500/10 text-purple-400 px-2 py-1 rounded-lg border border-purple-500/20 hover:bg-purple-500 hover:text-white transition-all uppercase font-black flex items-center gap-1 flex-1">
                                    <PenTool size={10} /> {isGenerating ? '...' : 'Magic Script'}
                                </button>
                                <button onClick={handleGenerateTasks} disabled={isGenerating} className="text-[8px] bg-blue-500/10 text-blue-400 px-2 py-1 rounded-lg border border-blue-500/20 hover:bg-blue-500 hover:text-white transition-all uppercase font-black flex items-center gap-1 flex-1">
                                    <ListTodo size={10} /> Tasks
                                </button>
                            </div>
                            <div className="flex-1 relative flex flex-col overflow-hidden">
                                {editorMode === 'write' && (
                                    <textarea
                                        value={editingCampaign.description}
                                        onChange={(e) => setEditingCampaign({ ...editingCampaign, description: e.target.value })}
                                        className="flex-1 bg-transparent text-[11px] text-neutral-300 focus:text-white outline-none resize-none leading-relaxed font-mono p-4"
                                        placeholder="Start typing your campaign brief..."
                                    />
                                )}
                                {editorMode === 'preview' && (
                                    <div className="flex-1 p-4 overflow-y-auto bg-neutral-900/10 prose prose-invert prose-sm prose-headings:font-black prose-p:text-neutral-300 prose-li:text-neutral-300 max-w-none">
                                        {formatDescription(editingCampaign.description)}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* MAIN CONTENT: Tabbed Action Hub */}
                        <div className="flex-1 flex flex-col overflow-hidden bg-ooedn-gray/30">
                            {/* Tab Navigation */}
                            <div className="flex border-b border-neutral-800 px-2 pt-2 gap-1 flex-shrink-0">
                                {sidebarTabs.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setSidebarTab(tab.id)}
                                        className={`flex items-center gap-1.5 px-3 py-2.5 rounded-t-xl text-[9px] font-black uppercase tracking-widest transition-all ${sidebarTab === tab.id
                                            ? `${tab.color} bg-neutral-900/50 border border-neutral-800 border-b-transparent -mb-[1px]`
                                            : 'text-neutral-600 hover:text-neutral-400'
                                            }`}
                                    >
                                        <tab.icon size={12} /> {tab.label}
                                    </button>
                                ))}
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">

                                {/* === EXECUTION TAB === */}
                                {sidebarTab === 'execution' && (
                                    <>
                                        {/* Tasks */}
                                        <div>
                                            <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2"><ListTodo size={14} /> Execution Plan</h4>
                                            <div className="space-y-2 mb-4">
                                                {(editingCampaign.tasks || []).map(task => (
                                                    <div key={task.id} className="flex items-start gap-3 p-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-600 transition-colors group">
                                                        <button onClick={() => handleToggleTask(task.id)} className={`mt-0.5 ${task.isDone ? 'text-emerald-500' : 'text-neutral-600 hover:text-white'}`}>
                                                            {task.isDone ? <CheckCircle2 size={16} /> : <CheckSquare size={16} />}
                                                        </button>
                                                        <span className={`text-xs ${task.isDone ? 'text-neutral-600 line-through' : 'text-neutral-300'}`}>{task.text}</span>
                                                        <button onClick={() => {
                                                            const updated = { ...editingCampaign, tasks: editingCampaign.tasks?.filter(t => t.id !== task.id) };
                                                            setEditingCampaign(updated);
                                                            onSaveCampaign(updated);
                                                        }} className="ml-auto text-neutral-700 hover:text-red-500 opacity-0 group-hover:opacity-100"><X size={14} /></button>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex gap-2">
                                                <input value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddTask()} placeholder="Add a new task..." className="flex-1 bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500 outline-none" />
                                                <button onClick={handleAddTask} className="bg-blue-500 text-white p-2 rounded-lg"><Plus size={16} /></button>
                                            </div>
                                        </div>

                                        {/* Comments */}
                                        <div className="border-t border-neutral-800 pt-5">
                                            <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-4 flex items-center gap-2"><MessageSquare size={14} /> Team & Creator Notes</h4>
                                            <div className="space-y-3 mb-4 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                                {(editingCampaign.comments || []).map(comment => (
                                                    <div key={comment.id} className={`p-3 rounded-xl border ${comment.isCreatorComment ? 'bg-purple-500/5 border-purple-500/20' : 'bg-neutral-900 border-neutral-800'}`}>
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className={`text-[9px] font-black uppercase ${comment.isCreatorComment ? 'text-purple-400' : 'text-emerald-500'}`}>
                                                                {comment.isCreatorComment ? `🎨 ${comment.user}` : comment.user}
                                                            </span>
                                                            <span className="text-[8px] text-neutral-600">{new Date(comment.date).toLocaleDateString()}</span>
                                                        </div>
                                                        <p className="text-xs text-neutral-300">{comment.text}</p>
                                                    </div>
                                                ))}
                                                {(!editingCampaign.comments || editingCampaign.comments.length === 0) && <p className="text-[10px] text-neutral-600 italic">No comments yet.</p>}
                                            </div>
                                            <div className="flex gap-2">
                                                <input value={commentText} onChange={(e) => setCommentText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddComment()} placeholder="Discuss ideas..." className="flex-1 bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 outline-none" />
                                                <button onClick={handleAddComment} className="bg-purple-500 text-white p-2 rounded-lg"><Send size={16} /></button>
                                            </div>
                                        </div>

                                        {/* Deadline */}
                                        <div className="border-t border-neutral-800 pt-5">
                                            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-1" htmlFor="campaign-deadline">Deadline</label>
                                            <input id="campaign-deadline" type="date" value={editingCampaign.deadline?.split('T')[0] || ''} onChange={(e) => {
                                                const updated = { ...editingCampaign, deadline: e.target.value ? new Date(e.target.value).toISOString() : undefined };
                                                setEditingCampaign(updated);
                                                onSaveCampaign(updated);
                                            }} className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none" />
                                        </div>

                                        {/* Channels */}
                                        <div className="border-t border-neutral-800 pt-5">
                                            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-2">Channels</label>
                                            <div className="flex flex-wrap gap-1.5">
                                                {CHANNEL_OPTIONS.map(ch => {
                                                    const isActive = editingCampaign.channels?.includes(ch);
                                                    return (
                                                        <button key={ch} title={`Toggle ${ch} channel`} onClick={() => {
                                                            const current = editingCampaign.channels || [];
                                                            const updated = { ...editingCampaign, channels: isActive ? current.filter(c => c !== ch) : [...current, ch] };
                                                            setEditingCampaign(updated);
                                                            onSaveCampaign(updated);
                                                        }} className={`px-2.5 py-1 rounded-lg text-[9px] font-bold border transition-all ${isActive ? CHANNEL_COLORS[ch] + ' border-current' : 'text-neutral-600 border-neutral-800 hover:border-neutral-600'}`}>
                                                            {ch}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Goal */}
                                        <div className="border-t border-neutral-800 pt-5">
                                            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-2">Campaign Goal</label>
                                            <div className="flex flex-wrap gap-1.5">
                                                {GOAL_OPTIONS.map(g => {
                                                    const isActive = editingCampaign.goal === g;
                                                    return (
                                                        <button key={g} title={`Set goal to ${g}`} onClick={() => {
                                                            const updated = { ...editingCampaign, goal: isActive ? undefined : g };
                                                            setEditingCampaign(updated);
                                                            onSaveCampaign(updated);
                                                        }} className={`px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all ${isActive ? GOAL_COLORS[g] + ' ring-1 ring-current' : 'text-neutral-600 bg-neutral-900 hover:text-neutral-400'}`}>
                                                            {g}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Cover Image */}
                                        <div className="border-t border-neutral-800 pt-5">
                                            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-1" htmlFor="campaign-cover">Cover Image URL</label>
                                            <input id="campaign-cover" type="url" value={editingCampaign.coverImage || ''} onChange={(e) => {
                                                setEditingCampaign({ ...editingCampaign, coverImage: e.target.value || undefined });
                                            }} onBlur={() => onSaveCampaign(editingCampaign)} placeholder="https://..." className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none placeholder-neutral-700" />
                                            {editingCampaign.coverImage && (
                                                <div className="mt-2 rounded-lg overflow-hidden border border-neutral-800">
                                                    <img src={editingCampaign.coverImage} alt="Cover preview" className="w-full h-24 object-cover" />
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}

                                {/* === ROSTER TAB === */}
                                {sidebarTab === 'roster' && (
                                    <>
                                        <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Users size={14} /> Assigned Creators</h4>
                                        <div className="space-y-2 mb-4">
                                            {creators.filter(c => editingCampaign.assignedCreatorIds.includes(c.id)).map(c => (
                                                <div key={c.id} className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 rounded-xl p-3 group hover:border-emerald-500/30 transition-all">
                                                    <div className="w-8 h-8 rounded-full bg-neutral-800 overflow-hidden flex-shrink-0">{c.profileImage ? <img src={c.profileImage} alt={c.name} className="w-full h-full object-cover" /> : <span className="w-full h-full flex items-center justify-center text-[10px] font-black">{c.name[0]}</span>}</div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold text-white truncate">{c.name}</p>
                                                        <p className="text-[9px] text-neutral-500">{c.handle} · {c.email || 'No email'}</p>
                                                    </div>
                                                    <button onClick={() => {
                                                        const updated = { ...editingCampaign, assignedCreatorIds: editingCampaign.assignedCreatorIds.filter(id => id !== c.id) };
                                                        setEditingCampaign(updated);
                                                        onSaveCampaign(updated);
                                                    }} className="text-neutral-600 hover:text-red-400 opacity-0 group-hover:opacity-100"><X size={14} /></button>
                                                </div>
                                            ))}
                                            {editingCampaign.assignedCreatorIds.length === 0 && <p className="text-[10px] text-neutral-600 italic py-4 text-center">No creators assigned yet.</p>}
                                        </div>
                                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                                            <h5 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Send size={12} /> Assign Creator</h5>
                                            <select onChange={(e) => {
                                                const creatorId = e.target.value;
                                                if (!creatorId || editingCampaign.assignedCreatorIds.includes(creatorId)) return;
                                                const updated = { ...editingCampaign, assignedCreatorIds: [...editingCampaign.assignedCreatorIds, creatorId], creatorNotified: true };
                                                setEditingCampaign(updated);
                                                onSaveCampaign(updated);
                                                if (onNotifyCreator) onNotifyCreator(creatorId, editingCampaign.title);
                                                e.target.value = '';
                                            }} className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none" defaultValue="" title="Select a creator">
                                                <option value="" disabled>Select a creator...</option>
                                                {creators.filter(c => !editingCampaign.assignedCreatorIds.includes(c.id)).map(c => <option key={c.id} value={c.id}>{c.name} ({c.handle})</option>)}
                                            </select>
                                        </div>
                                    </>
                                )}

                                {/* === AVATARS TAB === */}
                                {sidebarTab === 'avatars' && (
                                    <>
                                        {/* === STEP 1: Campaign Brief Config === */}
                                        <div className="mb-6">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-6 h-6 rounded-lg bg-yellow-500/20 text-yellow-400 flex items-center justify-center text-[10px] font-black">1</div>
                                                <p className="text-[10px] font-black text-white uppercase tracking-widest">Campaign Overview</p>
                                            </div>
                                            <div className="space-y-3 bg-neutral-900/60 rounded-xl p-4 border border-neutral-800">
                                                <div>
                                                    <label className="text-[8px] font-black text-yellow-400 uppercase tracking-widest block mb-1">🚀 Campaign Goal / Metaphor</label>
                                                    <textarea value={editingCampaign.briefGoal || ''} onChange={(e) => setEditingCampaign({ ...editingCampaign, briefGoal: e.target.value })} onBlur={() => onSaveCampaign(editingCampaign)} placeholder='Paste your campaign goal here from the brief on the left...' className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-[11px] text-white focus:border-yellow-500 outline-none h-16 resize-none leading-relaxed" />
                                                </div>
                                                <div>
                                                    <label className="text-[8px] font-black text-red-400 uppercase tracking-widest block mb-1">🛡️ Mandatories (Dos/Don'ts)</label>
                                                    <textarea value={editingCampaign.briefMandatories || ''} onChange={(e) => setEditingCampaign({ ...editingCampaign, briefMandatories: e.target.value })} onBlur={() => onSaveCampaign(editingCampaign)} placeholder='Paste your dos and don&#39;ts here...' className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-[11px] text-white focus:border-red-500 outline-none h-20 resize-none leading-relaxed" />
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1">
                                                        <label className="text-[8px] font-black text-cyan-400 uppercase tracking-widest block mb-1">🎯 Max Creators Per Avatar</label>
                                                        <input type="number" min={1} max={50} value={editingCampaign.maxCreatorsPerAvatar || ''} onChange={(e) => setEditingCampaign({ ...editingCampaign, maxCreatorsPerAvatar: parseInt(e.target.value) || undefined })} onBlur={() => onSaveCampaign(editingCampaign)} placeholder="e.g. 2" className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-[11px] text-white focus:border-cyan-500 outline-none" />
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            const briefText = editingCampaign.description || '';
                                                            if (!briefText.trim()) {
                                                                alert('No brief text found! Paste your brief into the panel on the left first.');
                                                                return;
                                                            }

                                                            const AVATAR_COLORS_LIST = ['from-purple-500 to-pink-500', 'from-emerald-500 to-cyan-500', 'from-amber-500 to-orange-500', 'from-blue-500 to-indigo-500', 'from-rose-500 to-red-500', 'from-teal-500 to-green-500'];

                                                            // === STEP 1: Split brief into 3 major parts ===
                                                            // Must match SECTION HEADERS, not inline mentions like "instructions in Part 2."
                                                            const part2Idx = briefText.search(/\n[🎬📍]*\s*PART\s*2[:\s]|^\s*🎬\s*PART\s*2/im);
                                                            const part3Idx = briefText.search(/\n[📦📍]*\s*PART\s*3[:\s]|^\s*📦\s*PART\s*3/im);

                                                            const part1Text = part2Idx > 0 ? briefText.slice(0, part2Idx) : briefText;
                                                            const part2Text = part2Idx > 0 ? briefText.slice(part2Idx, part3Idx > part2Idx ? part3Idx : undefined) : '';
                                                            const part3Text = part3Idx > 0 ? briefText.slice(part3Idx) : '';
                                                            console.log('[PARSER] part2Idx=', part2Idx, 'part3Idx=', part3Idx, 'part1Len=', part1Text.length, 'part2Len=', part2Text.length, 'part3Len=', part3Text.length);

                                                            // === STEP 2: Extract avatars from PART 1 ===
                                                            const avatarBlocks: Array<{letter: string; section: string}> = [];
                                                            const avatarStarts = [...part1Text.matchAll(/\nAvatar\s+([A-Z]):?\s*/gi)];
                                                            for (let i = 0; i < avatarStarts.length; i++) {
                                                                const letter = avatarStarts[i][1].toUpperCase();
                                                                const start = avatarStarts[i].index! + avatarStarts[i][0].length;
                                                                const end = i + 1 < avatarStarts.length ? avatarStarts[i + 1].index! : part1Text.length;
                                                                avatarBlocks.push({ letter, section: part1Text.slice(start, end).trim() });
                                                            }
                                                            console.log('[PARSER] Found', avatarBlocks.length, 'avatar blocks:', avatarBlocks.map(b => b.letter + ': ' + b.section.substring(0, 40)));

                                                            if (avatarBlocks.length === 0) {
                                                                alert('Could not find avatars. Make sure your brief has "Avatar A:", "Avatar B:", etc.');
                                                                return;
                                                            }

                                                            // === STEP 3: Extract PART 2 sections per avatar ===
                                                            const part2Sections: Record<string, string> = {};
                                                            if (part2Text) {
                                                                const p2Markers = [...part2Text.matchAll(/If\s+You\s+Chose\s+Avatar\s+([A-Z])/gi)];
                                                                for (let i = 0; i < p2Markers.length; i++) {
                                                                    const letter = p2Markers[i][1].toUpperCase();
                                                                    const start = p2Markers[i].index!;
                                                                    const end = i + 1 < p2Markers.length ? p2Markers[i + 1].index! : part2Text.length;
                                                                    part2Sections[letter] = part2Text.slice(start, end).trim();
                                                                }
                                                            }
                                                            console.log('[PARSER] PART 2 sections:', Object.keys(part2Sections), Object.entries(part2Sections).map(([k,v]) => k + ': ' + v.length + ' chars'));

                                                            // === STEP 4: Build avatars by merging PART 1 + PART 2 ===
                                                            const parsedAvatars: CampaignAvatar[] = avatarBlocks.map((block, i) => {
                                                                const sec = block.section;

                                                                // Name from quoted text
                                                                const nameQ = sec.match(/(?:The\s+)?[""\u201c]([^""\u201d]+)[""\u201d]/);
                                                                const avatarName = nameQ ? nameQ[1].trim() : 'Avatar ' + block.letter;

                                                                // Subtitle from parentheses
                                                                const subMatch = sec.match(/\(([^)]+)\)/);
                                                                const subtitle = subMatch ? subMatch[1].trim() : '';

                                                                // Choose this if
                                                                const chooseM = sec.match(/Choose this if:?\s*(.*?)(?=\n\s*(?:The Vibe|Your Angle|$))/is);
                                                                const desc = chooseM ? chooseM[1].trim() : subtitle;

                                                                // The Vibe
                                                                const vibeM = sec.match(/The Vibe:?\s*(.*?)(?=\n\s*(?:Your Angle|$))/is);
                                                                const vibe = vibeM ? vibeM[1].trim() : '';

                                                                // Your Angle
                                                                const angleM = sec.match(/Your Angle:?\s*(.*?)$/is);
                                                                const angleStory = angleM ? angleM[1].trim() : '';

                                                                // === Now merge PART 2 data ===
                                                                const p2 = part2Sections[block.letter] || '';
                                                                let hooks: string[] = [];
                                                                let visualCue = '';
                                                                let scriptIdeas: string[] = [];
                                                                let goalText = '';
                                                                let solutionText = '';
                                                                let reliefText = '';

                                                                if (p2) {
                                                                    // Goal
                                                                    const gM = p2.match(/Goal:\s*(.*?)(?=\n\s*\d+\.)/is);
                                                                    if (gM) goalText = gM[1].trim();

                                                                    // Line-by-line extraction for hooks, scripts, visual
                                                                    const lines = p2.split('\n');
                                                                    let inVisualSection = false;
                                                                    let inSolutionSection = false;
                                                                    let inReliefSection = false;

                                                                    for (const line of lines) {
                                                                        const trimmed = line.trim();

                                                                        // Detect sections
                                                                        if (/VISUAL CONTRAST|THE SETUP/i.test(trimmed)) { inVisualSection = true; inSolutionSection = false; inReliefSection = false; }
                                                                        if (/THE SOLUTION/i.test(trimmed)) { inSolutionSection = true; inVisualSection = false; inReliefSection = false; }
                                                                        if (/THE RELIEF/i.test(trimmed)) { inReliefSection = true; inVisualSection = false; inSolutionSection = false; }

                                                                        // Hook extraction: The "Name" Hook: "text"
                                                                        const hookMatch = trimmed.match(/^The\s+[""\u201c]([^""\u201d]+)[""\u201d]\s+Hook:\s*[""\u201c](.+?)[""\u201d]?\s*$/i);
                                                                        if (hookMatch) {
                                                                            const hookText = hookMatch[2].replace(/[""\u201c\u201d]/g, '').trim();
                                                                            if (hookText.length > 5) hooks.push(hookText);
                                                                        }

                                                                        // Script Ideas
                                                                        const scriptMatch = trimmed.match(/^Script\s*Idea:\s*[""\u201c]?(.+?)[""\u201d]?\s*$/i);
                                                                        if (scriptMatch) {
                                                                            const st = scriptMatch[1].replace(/^[""\u201c]|[""\u201d]$/g, '').trim();
                                                                            if (st.length > 5) scriptIdeas.push(st);
                                                                        }

                                                                        // Visual cue from Action line in visual section
                                                                        if (inVisualSection) {
                                                                            const actionMatch = trimmed.match(/^Action(?:\s*\([^)]*\))?:\s*(.+)/i);
                                                                            if (actionMatch && !visualCue) visualCue = actionMatch[1].trim();
                                                                        }

                                                                        // Solution script
                                                                        if (inSolutionSection) {
                                                                            const solScript = trimmed.match(/^Script\s*Idea:\s*[""\u201c]?(.+?)[""\u201d]?\s*$/i);
                                                                            if (solScript) solutionText = solScript[1].trim();
                                                                        }

                                                                        // Relief action
                                                                        if (inReliefSection) {
                                                                            const reliefAction = trimmed.match(/^Action(?:\s*\([^)]*\))?:\s*(.+)/i);
                                                                            if (reliefAction && !reliefText) reliefText = reliefAction[1].trim();
                                                                        }
                                                                    }
                                                                }

                                                                // Build full brief content
                                                                const bcParts: string[] = [];
                                                                if (goalText) bcParts.push('GOAL: ' + goalText);
                                                                bcParts.push('\nANGLE: ' + angleStory);
                                                                if (visualCue) bcParts.push('\nVISUAL: ' + visualCue);
                                                                scriptIdeas.forEach((s, si) => bcParts.push('\nSCRIPT ' + (si + 1) + ': \u201c' + s + '\u201d'));
                                                                const fullBrief = bcParts.join('\n').trim();

                                                                // Traits
                                                                const allText = (sec + ' ' + p2).toLowerCase();
                                                                const possibleTraits = ['wellness', 'skincare', 'beauty', 'fitness', 'health', 'nutrition', 'mom', 'busy', 'routine', 'hair', 'scalp', 'organic', 'natural', 'premium', 'luxury', 'practical', 'aesthetic', 'anti-aging', 'supplements', 'lifestyle', 'science', 'bio-hacking', 'growth'];
                                                                const traits = possibleTraits.filter(t => allText.includes(t)).slice(0, 5);
                                                                if (traits.length === 0) traits.push('creator');

                                                                return {
                                                                    id: crypto.randomUUID(),
                                                                    name: avatarName.substring(0, 50),
                                                                    description: (desc + (subtitle && desc !== subtitle ? ' (' + subtitle + ')' : '')).substring(0, 300),
                                                                    traits,
                                                                    color: AVATAR_COLORS_LIST[i % AVATAR_COLORS_LIST.length],
                                                                    matchedCreatorIds: [],
                                                                    angles: [{
                                                                        id: crypto.randomUUID(),
                                                                        hook: avatarName,
                                                                        story: angleStory.substring(0, 500),
                                                                        summary: (vibe ? 'Vibe: ' + vibe + '. ' : '') + desc.substring(0, 200),
                                                                        briefContent: fullBrief.substring(0, 3000),
                                                                        psychology: goalText || undefined,
                                                                        visualCue: visualCue || undefined,
                                                                        hooks: hooks.length > 0 ? hooks : undefined,
                                                                        selectedByCreatorIds: [],
                                                                    }],
                                                                };
                                                            });

                                                            // === STEP 5: Extract campaign-level info ===
                                                            const topSection = briefText.split(/PART\s*1/i)[0] || '';
                                                            const goalMatch = topSection.match(/(?:Campaign\s*(?:Goal|Theme)):?\s*(.*?)(?=\n(?:The|Campaign|$))/is);
                                                            const insightMatch = topSection.match(/The\s+Insight:?\s*(.*?)(?=\n)/i);
                                                            const solutionMatch = topSection.match(/The\s+Solution:?\s*(.*?)(?=\n)/i);
                                                            const briefGoal = [goalMatch?.[1]?.trim(), insightMatch?.[1]?.trim(), solutionMatch?.[1]?.trim()].filter(Boolean).join('\n');

                                                            // Mandatories from PART 3
                                                            let mandText = '';
                                                            if (part3Text) {
                                                                const mandM = part3Text.match(/Mandator(?:ies|y):?\s*(.*?)$/is);
                                                                if (mandM) mandText = mandM[1].trim();
                                                                if (!mandText) {
                                                                    const tagM = part3Text.match(/(Tag\s+@.*(?:\n.*#\w+.*)?)/im);
                                                                    if (tagM) mandText = tagM[1].trim();
                                                                }
                                                            }

                                                            const updated = {
                                                                ...editingCampaign,
                                                                briefGoal: briefGoal || editingCampaign.briefGoal,
                                                                briefMandatories: mandText || editingCampaign.briefMandatories,
                                                                avatars: parsedAvatars,
                                                                maxCreatorsPerAvatar: editingCampaign.maxCreatorsPerAvatar || 2,
                                                            };
                                                            setEditingCampaign(updated);
                                                            onSaveCampaign(updated);

                                                            const hookCount = parsedAvatars.reduce((s, a) => s + (a.angles?.[0]?.hooks?.length || 0), 0);
                                                            alert('\u2705 Parsed ' + parsedAvatars.length + ' avatars with ' + hookCount + ' total hooks!\n\n' + parsedAvatars.map(a => '\u2022 ' + a.name + ': ' + (a.angles?.[0]?.hooks?.length || 0) + ' hooks, ' + (a.angles?.[0]?.briefContent ? 'script \u2713' : 'no script') + ', ' + (a.angles?.[0]?.visualCue ? 'visual \u2713' : '')).join('\n'));
                                                        }}
                                                        className="mt-4 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest hover:from-emerald-500/20 hover:to-cyan-500/20 hover:text-emerald-300 transition-all whitespace-nowrap flex items-center gap-1"
                                                        title="Parse avatars and angles from the brief text on the left"
                                                    >
                                                        📥 Parse from Brief
                                                    </button>

                                                </div>
                                            </div>
                                        </div>

                                        {/* === STEP 2: Character Avatars === */}
                                        <div className="mb-6">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center text-[10px] font-black">2</div>
                                                    <p className="text-[10px] font-black text-white uppercase tracking-widest">Character Avatars</p>
                                                    <span className="text-[8px] text-neutral-500">({(editingCampaign.avatars || []).length})</span>
                                                </div>
                                                <button onClick={() => setShowAvatarForm(!showAvatarForm)} className="bg-purple-500/10 text-purple-400 px-2 py-1 rounded-lg hover:bg-purple-500/20 transition-all text-[8px] font-black uppercase flex items-center gap-1">
                                                    <Plus size={12} /> New Avatar
                                                </button>
                                            </div>
                                            <p className="text-[9px] text-neutral-500 mb-3 leading-relaxed">Copy avatar descriptions from the brief on the left, or paste content directly into each field below.</p>
                                        </div>

                                        {/* Campaign Full Banner */}
                                        {editingCampaign.maxCreatorsPerAvatar && editingCampaign.avatars && editingCampaign.avatars.length > 0 && (() => {
                                            const allFull = editingCampaign.avatars.every(a => a.matchedCreatorIds.length >= (editingCampaign.maxCreatorsPerAvatar || Infinity));
                                            const totalSlots = editingCampaign.avatars.length * (editingCampaign.maxCreatorsPerAvatar || 0);
                                            const totalFilled = editingCampaign.avatars.reduce((sum, a) => sum + a.matchedCreatorIds.length, 0);
                                            return (
                                                <div className={`rounded-xl p-3 mb-4 flex items-center gap-2 border ${allFull ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-cyan-500/5 border-cyan-500/15'}`}>
                                                    {allFull ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Users size={14} className="text-cyan-400" />}
                                                    <span className={`text-[9px] font-bold ${allFull ? 'text-emerald-400' : 'text-cyan-400'}`}>
                                                        {allFull ? `✅ CAMPAIGN FULL — All ${totalSlots} slots filled` : `🎯 ${totalFilled}/${totalSlots} creator slots filled`}
                                                    </span>
                                                </div>
                                            );
                                        })()}

                                        {editingCampaign.avatarOutreachSent && (
                                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 mb-4 flex items-center gap-2">
                                                <CheckCircle2 size={12} className="text-emerald-500" />
                                                <span className="text-[9px] text-emerald-400 font-bold">Avatar outreach sent</span>
                                            </div>
                                        )}

                                        {/* Avatar Form */}
                                        {showAvatarForm && (
                                            <div className="bg-neutral-900 border border-purple-500/20 rounded-2xl p-4 mb-4 space-y-3">
                                                <input value={newAvatarName} onChange={(e) => setNewAvatarName(e.target.value)} placeholder='Character name (e.g. "The Rebel")' className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 outline-none" />
                                                <textarea value={newAvatarDesc} onChange={(e) => setNewAvatarDesc(e.target.value)} placeholder="Personality description..." className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 outline-none h-16 resize-none" />
                                                <input value={newAvatarTraits} onChange={(e) => setNewAvatarTraits(e.target.value)} placeholder="Traits (comma separated): bold, streetwear, minimal" className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 outline-none" />
                                                <div className="flex gap-2">
                                                    <button onClick={handleAddAvatar} disabled={!newAvatarName.trim()} className="flex-1 bg-purple-500 text-white py-2 rounded-lg text-xs font-black uppercase tracking-widest disabled:opacity-50 hover:bg-purple-400 transition-all">Create Avatar</button>
                                                    <button onClick={() => setShowAvatarForm(false)} className="px-3 py-2 text-neutral-500 hover:text-white text-xs"><X size={14} /></button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Avatar Cards */}
                                        <div className="space-y-3">
                                            {(editingCampaign.avatars || []).map(avatar => (
                                                <div key={avatar.id} className="relative group">
                                                    <div className={`bg-gradient-to-br ${avatar.color} p-[1px] rounded-2xl`}>
                                                        <div className="bg-ooedn-dark rounded-2xl p-4">
                                                            <div className="flex items-start justify-between mb-2">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatar.color} flex items-center justify-center text-white font-black text-sm`}>{avatar.name[0]}</div>
                                                                    <div>
                                                                        <h5 className="text-xs font-black text-white">{avatar.name}</h5>
                                                                        <p className="text-[8px] text-neutral-500">{avatar.matchedCreatorIds.length}{editingCampaign.maxCreatorsPerAvatar ? `/${editingCampaign.maxCreatorsPerAvatar}` : ''} matched</p>
                                                                        {editingCampaign.maxCreatorsPerAvatar && avatar.matchedCreatorIds.length >= editingCampaign.maxCreatorsPerAvatar && (
                                                                            <span className="text-[7px] font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">FULL</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <button onClick={() => handleDeleteAvatar(avatar.id)} className="text-neutral-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
                                                            </div>
                                                            <p className="text-[10px] text-neutral-400 mb-3 leading-relaxed">{avatar.description || 'No description.'}</p>
                                                            <div className="flex flex-wrap gap-1 mb-3">
                                                                {avatar.traits.map((trait, i) => (
                                                                    <span key={i} className="text-[8px] bg-white/5 text-neutral-300 px-2 py-0.5 rounded-full border border-neutral-700 flex items-center gap-1"><Tag size={8} />{trait}</span>
                                                                ))}
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => {
                                                                        const lines = [`📋 AVATAR: ${avatar.name}\n${avatar.description}\nTraits: ${avatar.traits.join(', ')}\nSlots: ${avatar.matchedCreatorIds.length}${editingCampaign.maxCreatorsPerAvatar ? '/' + editingCampaign.maxCreatorsPerAvatar : ''} matched`];
                                                                        (avatar.angles || []).forEach((angle, i) => {
                                                                            lines.push(`\n--- Angle ${i + 1}: ${angle.hook} ---\nStory: ${angle.story}\nSummary: ${angle.summary}`);
                                                                            if (angle.psychology) lines.push(`Psychology: ${angle.psychology}`);
                                                                            if (angle.visualCue) lines.push(`Visual: ${angle.visualCue}`);
                                                                            if (angle.hooks?.length) lines.push(`Hooks:\n${angle.hooks.map(h => `  • "${h}"`).join('\n')}`);
                                                                            if (angle.briefContent) lines.push(`Script:\n${angle.briefContent}`);
                                                                        });
                                                                        navigator.clipboard.writeText(lines.join('\n')).then(() => alert('Avatar copied to clipboard!'));
                                                                    }}
                                                                    className="flex-1 bg-neutral-800 text-neutral-300 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white hover:text-black transition-all border border-neutral-700"
                                                                    title="Copy avatar details to clipboard"
                                                                >
                                                                    📋 Copy
                                                                </button>
                                                                <button onClick={() => handleSendAvatarEmail(avatar)} className="flex-1 bg-purple-500/10 text-purple-400 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-purple-500 hover:text-white transition-all border border-purple-500/20">
                                                                    <Mail size={12} /> Mail
                                                                </button>
                                                            </div>

                                                            {/* Angles Section */}
                                                            <div className="mt-3 pt-3 border-t border-neutral-800">
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <p className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">Angles ({(avatar.angles || []).length})</p>
                                                                    <button
                                                                        onClick={() => setShowAngleForm(showAngleForm === avatar.id ? null : avatar.id)}
                                                                        className="text-[8px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1"
                                                                        title="Add angle"
                                                                    >
                                                                        <Plus size={10} /> Add Angle
                                                                    </button>
                                                                </div>

                                                                {/* Angle Form */}
                                                                {showAngleForm === avatar.id && (
                                                                    <div className="bg-black border border-purple-500/20 rounded-xl p-3 mb-2 space-y-2">
                                                                        {/* Parse from Brief Button */}
                                                                        <button
                                                                            onClick={() => {
                                                                                const briefText = editingCampaign.description || '';
                                                                                if (!briefText.trim()) {
                                                                                    alert('No brief text found! Paste your brief into the panel on the left first.');
                                                                                    return;
                                                                                }

                                                                                // Find the section for this avatar in the brief
                                                                                const avatarNameClean = avatar.name.replace(/^The\s+/i, '').toLowerCase();
                                                                                const lines = briefText.split('\n');

                                                                                // Find the line that contains this avatar's name
                                                                                let avatarStartLine = -1;
                                                                                let avatarEndLine = lines.length;
                                                                                for (let i = 0; i < lines.length; i++) {
                                                                                    const lineLower = lines[i].toLowerCase();
                                                                                    if (lineLower.includes(avatarNameClean) || lineLower.includes(avatar.name.toLowerCase())) {
                                                                                        if (avatarStartLine === -1) avatarStartLine = i;
                                                                                    }
                                                                                    // If we found the start, look for the next avatar marker
                                                                                    if (avatarStartLine >= 0 && i > avatarStartLine) {
                                                                                        if (/(?:Avatar\s+[A-Z]:|💊\s*Angle\s+\d+:|PART\s+\d+)/i.test(lines[i]) && !lines[i].toLowerCase().includes(avatarNameClean)) {
                                                                                            avatarEndLine = i;
                                                                                            break;
                                                                                        }
                                                                                    }
                                                                                }

                                                                                if (avatarStartLine === -1) {
                                                                                    alert(`Could not find "${avatar.name}" in the brief. Make sure the avatar name appears in the brief text on the left.`);
                                                                                    return;
                                                                                }

                                                                                const section = lines.slice(avatarStartLine, avatarEndLine).join('\n');

                                                                                // Extract angle name/hook
                                                                                const hookMatch = section.match(/(?:Your Angle|The Angle|Hook|Angle\s*Name):?\s*(.*?)(?:\n|$)/i)
                                                                                    || section.match(/[""](.*?)[""]/);
                                                                                if (hookMatch) setNewAngleHook(hookMatch[1].trim());

                                                                                // Extract "Choose this if:" for summary
                                                                                const chooseMatch = section.match(/Choose this if:?\s*(.*?)(?=\n\s*(?:The Vibe|Your Angle|Hook|Visual|Psychology|$))/is);
                                                                                if (chooseMatch) setNewAngleSummary(chooseMatch[1].trim());

                                                                                // Extract "The Vibe:" for story
                                                                                const vibeMatch = section.match(/The Vibe:?\s*(.*?)(?=\n\s*(?:Your Angle|Hook|Visual|Psychology|$))/is);
                                                                                if (vibeMatch) setNewAngleStory(vibeMatch[1].trim());

                                                                                // Extract "Your Angle:" for brief content
                                                                                const angleMatch = section.match(/Your Angle:?\s*(.*?)(?=\n\s*(?:Hook|Visual|Psychology|Avatar|$))/is);
                                                                                if (angleMatch) setNewAngleBrief(angleMatch[1].trim());

                                                                                // If no vibe, use the angle content as story
                                                                                if (!vibeMatch && angleMatch) setNewAngleStory(angleMatch[1].trim().substring(0, 200));

                                                                                // Extract psychology
                                                                                const psychMatch = section.match(/Psychology:?\s*(.*?)(?=\n\s*(?:Visual|Hook|Avatar|$))/is);
                                                                                if (psychMatch) setNewAnglePsychology(psychMatch[1].trim());

                                                                                // Extract visual cue
                                                                                const visualMatch = section.match(/Visual(?:\s*Cue)?:?\s*(.*?)(?=\n\s*(?:Psychology|Hook|Avatar|$))/is);
                                                                                if (visualMatch) setNewAngleVisualCue(visualMatch[1].trim());

                                                                                // Extract hooks
                                                                                const hooksMatch = section.match(/Hooks?:?\s*(.*?)(?=\n\s*(?:Visual|Psychology|Avatar|$))/is);
                                                                                if (hooksMatch) {
                                                                                    const hookLines = hooksMatch[1].split('\n')
                                                                                        .map(h => h.replace(/^[\s•\-*"]+|["]+$/g, '').trim())
                                                                                        .filter(h => h.length > 5);
                                                                                    if (hookLines.length > 0) setNewAngleHooks(hookLines.join('\n'));
                                                                                }

                                                                                // If nothing specific found, use the whole section as brief content
                                                                                if (!hookMatch && !chooseMatch && !vibeMatch && !angleMatch) {
                                                                                    setNewAngleBrief(section.trim());
                                                                                    const firstLine = section.trim().split('\n')[0];
                                                                                    setNewAngleHook(firstLine.substring(0, 80));
                                                                                }
                                                                            }}
                                                                            className="w-full bg-emerald-500/10 text-emerald-400 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-500/20 transition-all border border-emerald-500/20 mb-1"
                                                                            title={`Parse angle data for "${avatar.name}" from the brief`}
                                                                        >
                                                                            📥 Parse "{avatar.name}" from Brief
                                                                        </button>
                                                                        <input
                                                                            value={newAngleHook}
                                                                            onChange={e => setNewAngleHook(e.target.value)}
                                                                            placeholder='Hook (e.g. "Wait till you see what just arrived"  )'
                                                                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-[10px] text-white focus:border-purple-500 outline-none"
                                                                        />
                                                                        <input
                                                                            value={newAngleStory}
                                                                            onChange={e => setNewAngleStory(e.target.value)}
                                                                            placeholder="Story approach (e.g. unboxing with real reaction)"
                                                                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-[10px] text-white focus:border-purple-500 outline-none"
                                                                        />
                                                                        <input
                                                                            value={newAngleSummary}
                                                                            onChange={e => setNewAngleSummary(e.target.value)}
                                                                            placeholder="Summary (visible to creators before they choose, e.g. 'This brief focuses on morning routines...')"
                                                                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-[10px] text-white focus:border-purple-500 outline-none"
                                                                        />
                                                                        <textarea
                                                                            value={newAngleBrief}
                                                                            onChange={e => setNewAngleBrief(e.target.value)}
                                                                            placeholder="Full brief / story script (revealed to creator after they choose this angle)..."
                                                                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-[10px] text-white focus:border-purple-500 outline-none h-20 resize-none"
                                                                        />
                                                                        <input
                                                                            value={newAnglePsychology}
                                                                            onChange={e => setNewAnglePsychology(e.target.value)}
                                                                            placeholder='Psychology — why this works (e.g. "Uses Loss Aversion — fear of losing hair")'
                                                                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-[10px] text-white focus:border-purple-500 outline-none"
                                                                        />
                                                                        <input
                                                                            value={newAngleVisualCue}
                                                                            onChange={e => setNewAngleVisualCue(e.target.value)}
                                                                            placeholder='Visual Cue — filming tips (e.g. "Film in kitchen next to green juice")'
                                                                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-[10px] text-white focus:border-purple-500 outline-none"
                                                                        />
                                                                        <textarea
                                                                            value={newAngleHooks}
                                                                            onChange={e => setNewAngleHooks(e.target.value)}
                                                                            placeholder={'Hook bank — one per line:\n"I drink organic greens but I was letting my hair starve"\n"Definition of Insanity: feeding your body premium nutrients but feeding your hair soap"'}
                                                                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-[10px] text-white focus:border-yellow-500 outline-none h-20 resize-none"
                                                                        />
                                                                        <div className="flex gap-2">
                                                                            <button
                                                                                onClick={() => {
                                                                                    if (!editingCampaign || !newAngleHook.trim()) return;
                                                                                    const hooksArray = newAngleHooks.trim() ? newAngleHooks.split('\n').map(h => h.replace(/^"|"$/g, '').trim()).filter(Boolean) : [];
                                                                                    const newAngle: AvatarAngle = {
                                                                                        id: crypto.randomUUID(),
                                                                                        hook: newAngleHook,
                                                                                        story: newAngleStory,
                                                                                        summary: newAngleSummary,
                                                                                        briefContent: newAngleBrief,
                                                                                        psychology: newAnglePsychology || undefined,
                                                                                        visualCue: newAngleVisualCue || undefined,
                                                                                        hooks: hooksArray.length > 0 ? hooksArray : undefined,
                                                                                        selectedByCreatorIds: [],
                                                                                    };
                                                                                    const updatedAvatars = (editingCampaign.avatars || []).map(a => {
                                                                                        if (a.id !== avatar.id) return a;
                                                                                        return { ...a, angles: [...(a.angles || []), newAngle] };
                                                                                    });
                                                                                    const updated = { ...editingCampaign, avatars: updatedAvatars };
                                                                                    setEditingCampaign(updated);
                                                                                    onSaveCampaign(updated);
                                                                                    setNewAngleHook(''); setNewAngleStory(''); setNewAngleSummary(''); setNewAngleBrief(''); setNewAnglePsychology(''); setNewAngleVisualCue(''); setNewAngleHooks(''); setShowAngleForm(null);
                                                                                }}
                                                                                disabled={!newAngleHook.trim()}
                                                                                className="flex-1 bg-purple-500 text-white py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest disabled:opacity-50"
                                                                            >
                                                                                Save Angle
                                                                            </button>
                                                                            <button onClick={() => setShowAngleForm(null)} className="px-2 text-neutral-500 hover:text-white text-[9px]"><X size={12} /></button>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Angle List */}
                                                                {(avatar.angles || []).map(angle => (
                                                                    <div key={angle.id} className="bg-black/50 border border-neutral-800 rounded-lg p-3 mb-2 group/angle">
                                                                        <div className="flex items-start justify-between">
                                                                            <div className="flex-1">
                                                                                <p className="text-[11px] font-bold text-white">🪝 {angle.hook}</p>
                                                                                <p className="text-[9px] text-neutral-400 mt-1 leading-relaxed">{angle.story}</p>
                                                                                {angle.summary && <p className="text-[9px] text-cyan-400/70 mt-1 italic">📝 {angle.summary}</p>}
                                                                                {angle.psychology && <p className="text-[9px] text-purple-400/70 mt-1">🧠 {angle.psychology}</p>}
                                                                                {angle.visualCue && <p className="text-[9px] text-amber-400/70 mt-1">🎬 {angle.visualCue}</p>}
                                                                                {angle.hooks && angle.hooks.length > 0 && (
                                                                                    <div className="mt-2">
                                                                                        <p className="text-[8px] font-black text-yellow-400 uppercase tracking-widest mb-1">Hook Bank ({angle.hooks.length})</p>
                                                                                        {angle.hooks.map((h, hi) => (
                                                                                            <p key={hi} className="text-[9px] text-neutral-300 pl-2 border-l border-yellow-500/30 mb-0.5">&ldquo;{h}&rdquo;</p>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                                {angle.briefContent && (
                                                                                    <div className="mt-2 bg-neutral-900/50 rounded-lg p-2 border border-neutral-800">
                                                                                        <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-1">📋 Script / Brief Content</p>
                                                                                        <p className="text-[9px] text-neutral-300 leading-relaxed whitespace-pre-line">{angle.briefContent.substring(0, 500)}{angle.briefContent.length > 500 ? '...' : ''}</p>
                                                                                    </div>
                                                                                )}
                                                                                {angle.selectedByCreatorIds.length > 0 && (
                                                                                    <p className="text-[8px] text-emerald-400 mt-2 font-bold">
                                                                                        ✔ {angle.selectedByCreatorIds.length} creator{angle.selectedByCreatorIds.length > 1 ? 's' : ''} selected
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                            <button
                                                                                onClick={() => {
                                                                                    if (!editingCampaign) return;
                                                                                    const updatedAvatars = (editingCampaign.avatars || []).map(a => {
                                                                                        if (a.id !== avatar.id) return a;
                                                                                        return { ...a, angles: (a.angles || []).filter(an => an.id !== angle.id) };
                                                                                    });
                                                                                    const updated = { ...editingCampaign, avatars: updatedAvatars };
                                                                                    setEditingCampaign(updated);
                                                                                    onSaveCampaign(updated);
                                                                                }}
                                                                                className="text-neutral-700 hover:text-red-400 opacity-0 group-hover/angle:opacity-100 transition-opacity ml-2"
                                                                                title="Delete angle"
                                                                            >
                                                                                <X size={10} />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {(!editingCampaign.avatars || editingCampaign.avatars.length === 0) && !showAvatarForm && (
                                                <div className="text-center py-8 border border-dashed border-neutral-800 rounded-2xl">
                                                    <UserCircle2 size={32} className="mx-auto mb-2 text-neutral-700" />
                                                    <p className="text-[10px] text-neutral-600">No avatars yet. Create character personas to match with creators.</p>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}

                                {/* === UGC TAB === */}
                                {sidebarTab === 'ugc' && (
                                    <>
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-2"><Video size={14} /> UGC Inspiration</h4>
                                            <button onClick={() => setShowUgcForm(!showUgcForm)} className="bg-rose-500/10 text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/20 transition-all"><Plus size={14} /></button>
                                        </div>
                                        <p className="text-[9px] text-neutral-500 mb-4 leading-relaxed">Add reference UGC videos for content direction. YouTube links will auto-embed.</p>

                                        {/* UGC Add Form */}
                                        {showUgcForm && (
                                            <div className="bg-neutral-900 border border-rose-500/20 rounded-2xl p-4 mb-4 space-y-3">
                                                <input value={newUgcUrl} onChange={(e) => setNewUgcUrl(e.target.value)} placeholder="Video URL (YouTube, TikTok, Instagram...)" className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:border-rose-500 outline-none" />
                                                <input value={newUgcTitle} onChange={(e) => setNewUgcTitle(e.target.value)} placeholder="Title / Label" className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:border-rose-500 outline-none" />
                                                <textarea value={newUgcNotes} onChange={(e) => setNewUgcNotes(e.target.value)} placeholder="Why is this inspiring? (optional)" className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:border-rose-500 outline-none h-14 resize-none" />
                                                <div className="flex gap-2">
                                                    <button onClick={handleAddUgc} disabled={!newUgcUrl.trim() || !newUgcTitle.trim()} className="flex-1 bg-rose-500 text-white py-2 rounded-lg text-xs font-black uppercase tracking-widest disabled:opacity-50 hover:bg-rose-400 transition-all">Add Video</button>
                                                    <button onClick={() => setShowUgcForm(false)} className="px-3 py-2 text-neutral-500 hover:text-white text-xs"><X size={14} /></button>
                                                </div>
                                            </div>
                                        )}

                                        {/* UGC Cards */}
                                        <div className="space-y-3">
                                            {(editingCampaign.ugcInspo || []).map(ugc => {
                                                const ytEmbed = getYouTubeEmbedUrl(ugc.url);
                                                return (
                                                    <div key={ugc.id} className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden group hover:border-rose-500/30 transition-all">
                                                        {ytEmbed && (
                                                            <div className="aspect-video">
                                                                <iframe src={ytEmbed} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={ugc.title} />
                                                            </div>
                                                        )}
                                                        <div className="p-3">
                                                            <div className="flex items-start justify-between mb-1">
                                                                <div className="flex-1 min-w-0">
                                                                    <h5 className="text-xs font-bold text-white truncate">{ugc.title}</h5>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        {ugc.platform && <span className="text-[8px] bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded-full font-bold">{ugc.platform}</span>}
                                                                        <span className="text-[8px] text-neutral-600">{new Date(ugc.addedAt).toLocaleDateString()}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <a href={ugc.url} target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-rose-400 p-1"><ExternalLink size={12} /></a>
                                                                    <button onClick={() => handleDeleteUgc(ugc.id)} className="text-neutral-600 hover:text-red-400 p-1"><X size={12} /></button>
                                                                </div>
                                                            </div>
                                                            {ugc.notes && <p className="text-[9px] text-neutral-500 mt-2 leading-relaxed">{ugc.notes}</p>}
                                                            {!ytEmbed && (
                                                                <a href={ugc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 mt-2 bg-rose-500/10 text-rose-400 px-3 py-2 rounded-lg text-[9px] font-bold hover:bg-rose-500/20 transition-all">
                                                                    <Play size={12} /> Watch Video
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {(!editingCampaign.ugcInspo || editingCampaign.ugcInspo.length === 0) && !showUgcForm && (
                                                <div className="text-center py-8 border border-dashed border-neutral-800 rounded-2xl">
                                                    <Video size={32} className="mx-auto mb-2 text-neutral-700" />
                                                    <p className="text-[10px] text-neutral-600">No UGC reference videos yet. Add inspiration content.</p>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}

                                {/* === MOODBOARD TAB === */}
                                {sidebarTab === 'moodboard' && (
                                    <>
                                        <h4 className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Palette size={14} /> Moodboard & Visual Direction</h4>
                                        {/* Style Notes */}
                                        <div className="mb-4">
                                            <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest block mb-1">Style Notes & Tone</label>
                                            <textarea value={editingCampaign.styleNotes || ''} onChange={(e) => setEditingCampaign({ ...editingCampaign, styleNotes: e.target.value })} onBlur={() => onSaveCampaign(editingCampaign)} placeholder="Describe the mood, tone, colors, aesthetic, energy..." className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500 outline-none h-20 resize-none leading-relaxed" />
                                        </div>
                                        {/* Reference Links */}
                                        <div className="mb-4">
                                            <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest block mb-1">Reference / Inspiration Links</label>
                                            <div className="space-y-1.5 mb-2">
                                                {(editingCampaign.referenceLinks || []).map((link, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 group">
                                                        <LinkIcon size={10} className="text-amber-400 flex-shrink-0" />
                                                        <a href={link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-amber-400 hover:text-amber-300 truncate flex-1">{link}</a>
                                                        <button onClick={() => {
                                                            const updated = { ...editingCampaign, referenceLinks: (editingCampaign.referenceLinks || []).filter((_, i) => i !== idx) };
                                                            setEditingCampaign(updated);
                                                            onSaveCampaign(updated);
                                                        }} className="text-neutral-600 hover:text-red-400 opacity-0 group-hover:opacity-100"><X size={10} /></button>
                                                    </div>
                                                ))}
                                            </div>
                                            <input placeholder="Paste a reference URL and press Enter..." className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-1.5 text-[10px] text-white focus:border-amber-500 outline-none" onKeyDown={(e) => {
                                                if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                                                    const url = (e.target as HTMLInputElement).value.trim();
                                                    const updated = { ...editingCampaign, referenceLinks: [...(editingCampaign.referenceLinks || []), url] };
                                                    setEditingCampaign(updated);
                                                    onSaveCampaign(updated);
                                                    (e.target as HTMLInputElement).value = '';
                                                }
                                            }} />
                                        </div>
                                        {/* Content Library */}
                                        <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest block mb-2">Moodboard Images & Assets</label>
                                        <div className="bg-neutral-900/50 rounded-xl border border-neutral-800">
                                            <ContentLibrary
                                                items={content.filter(c => c.campaignId === editingCampaign.id)}
                                                onUpload={(item) => onContentUpload({ ...item, campaignId: editingCampaign.id, creatorId: undefined, creatorName: 'MoodBoard' })}
                                                onUpdate={onContentUpdate}
                                                onDelete={onContentDelete}
                                                appSettings={appSettings}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CampaignBoard;
