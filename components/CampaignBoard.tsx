
import React, { useState } from 'react';
import { Campaign, CampaignStatus, ContentItem, Creator, AppSettings, CreatorStatus, ContentType, CampaignTask, CampaignComment, MoodboardItem } from '../types';
import { Plus, X, Layout, FileText, CheckCircle2, MoreHorizontal, Save, Users, ImageIcon, Sparkles, Loader2, BrainCircuit, Film, HardDrive, Printer, CheckSquare, MessageSquare, Trash2, ListTodo, Send, GripHorizontal, Eye, Edit3, PenTool, Mail, Palette, LinkIcon, ExternalLink } from 'lucide-react';
import ContentLibrary from './ContentLibrary';
import { generateCampaignBrief, generateCampaignTasks, generateViralScript } from '../services/geminiService';
import { createDriveFolder, uploadToGoogleDrive } from '../services/googleDriveService';

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
}

const CampaignBoard: React.FC<CampaignBoardProps> = ({
    campaigns, creators, content, onSaveCampaign, onDeleteCampaign,
    onContentUpload, onContentUpdate, onContentDelete, appSettings, onEmailBrief, onNotifyCreator
}) => {
    const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
    const [showAIPrompt, setShowAIPrompt] = useState(false);
    const [aiPromptText, setAiPromptText] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSyncingDrive, setIsSyncingDrive] = useState(false);
    const [draggedCampaignId, setDraggedCampaignId] = useState<string | null>(null);
    const [commentText, setCommentText] = useState('');
    const [newTaskText, setNewTaskText] = useState('');
    const [editorMode, setEditorMode] = useState<'write' | 'preview'>('write'); // New Tab State

    const columns = [
        { id: CampaignStatus.Idea, label: 'Fresh Ideas', icon: Layout, color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/5' },
        { id: CampaignStatus.Brainstorming, label: 'Brainstorming Hub', icon: BrainCircuit, color: 'text-blue-400 border-blue-500/30 bg-blue-500/5' },
        { id: CampaignStatus.Final, label: 'Final Campaigns', icon: CheckCircle2, color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5' },
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

    return (
        <div className="h-full flex flex-col relative bg-ooedn-black">
            {/* BOARD VIEW */}
            {!editingCampaign && (
                <div className="flex-1 overflow-x-auto p-6">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setShowAIPrompt(true)} className="bg-emerald-500 hover:bg-emerald-400 text-black px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl active:scale-95">
                                <Sparkles size={18} /> AI Creative Brainstorm
                            </button>
                            <p className="text-neutral-500 text-[10px] font-black uppercase tracking-widest">Powered by OOEDN Brand Bible & Deep Research</p>
                        </div>
                    </div>

                    <div className="flex gap-6 h-[calc(100%-100px)]">
                        {columns.map(col => (
                            <div
                                key={col.id}
                                className="flex-1 flex flex-col min-w-[260px]"
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, col.id)}
                            >
                                <div className={`p-5 rounded-t-2xl border-b-2 flex items-center justify-between bg-neutral-900/50 ${col.color}`}>
                                    <div className="flex items-center gap-3 font-black uppercase text-xs tracking-widest">
                                        <col.icon size={20} />
                                        {col.label}
                                    </div>
                                    <button onClick={() => handleCreate(col.id)} className="hover:bg-white/10 p-2 rounded-lg transition-colors"><Plus size={20} /></button>
                                </div>
                                <div className="bg-neutral-900/20 border-x border-b border-neutral-800 rounded-b-2xl flex-1 p-4 space-y-4 overflow-y-auto custom-scrollbar">
                                    {campaigns.filter(c => c.status === col.id).map(campaign => (
                                        <div
                                            key={campaign.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, campaign.id)}
                                            onClick={() => setEditingCampaign(campaign)}
                                            className={`bg-ooedn-gray border border-neutral-800 p-5 rounded-2xl cursor-pointer hover:border-emerald-500/50 hover:shadow-2xl hover:-translate-y-1 transition-all group shadow-lg ${draggedCampaignId === campaign.id ? 'opacity-50' : ''}`}
                                        >
                                            <div className="flex justify-between items-start mb-3">
                                                <h4 className="font-black text-white group-hover:text-emerald-400 uppercase tracking-tighter text-sm leading-tight">{campaign.title}</h4>
                                                <GripHorizontal size={16} className="text-neutral-600 cursor-grab" />
                                            </div>
                                            <div className="flex items-center gap-4 mb-4">
                                                <span className="text-[10px] font-bold text-neutral-500 bg-neutral-900 px-2 py-1 rounded border border-neutral-800">{campaign.tasks?.filter(t => t.isDone).length || 0}/{campaign.tasks?.length || 0} Tasks</span>
                                                <span className="text-[10px] font-bold text-neutral-500 flex items-center gap-1"><MessageSquare size={10} /> {campaign.comments?.length || 0}</span>
                                            </div>
                                            <p className="text-[10px] text-neutral-500 line-clamp-2 mb-4 font-medium leading-relaxed font-mono">
                                                {campaign.description.slice(0, 100).replace(/[#\-]/g, '') || 'No brief defined.'}
                                            </p>
                                            <div className="flex items-center justify-between border-t border-neutral-800 pt-4">
                                                <div className="flex -space-x-2">
                                                    {campaign.assignedCreatorIds.slice(0, 4).map(id => {
                                                        const cr = creators.find(c => c.id === id);
                                                        return cr ? (
                                                            <div key={id} className="w-7 h-7 rounded-full border-2 border-neutral-900 bg-neutral-800 flex items-center justify-center overflow-hidden shadow-lg">
                                                                {cr.profileImage ? <img src={cr.profileImage} className="w-full h-full object-cover" /> : <span className="text-[8px] font-black">{cr.name[0]}</span>}
                                                            </div>
                                                        ) : null;
                                                    })}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[8px] font-black text-neutral-500 uppercase tracking-widest">
                                                    <ImageIcon size={14} /> {content.filter(c => c.campaignId === campaign.id).length} Assets
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
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
                            <div className="h-8 w-[1px] bg-neutral-800 mx-2"></div>
                            <button onClick={() => { if (confirm("Delete Campaign?")) { onDeleteCampaign(editingCampaign.id); setEditingCampaign(null); } }} className="bg-red-500/10 text-red-500 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">
                                <Trash2 size={16} />
                            </button>
                            <button onClick={() => { onSaveCampaign(editingCampaign); setEditingCampaign(null); }} className="bg-emerald-500 text-black px-8 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-400 transition-all shadow-lg">
                                <Save size={18} /> Done
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 flex overflow-hidden">
                        {/* CENTER: The Brief (Document Style) */}
                        <div className="flex-1 p-4 md:p-8 lg:p-12 overflow-y-auto custom-scrollbar bg-ooedn-gray/30 flex justify-center">
                            <div className="w-full max-w-4xl bg-ooedn-black border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-full min-h-[600px]">
                                <div className="p-6 border-b border-neutral-800 bg-neutral-900/50 flex justify-between items-center">
                                    <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                                        <FileText size={18} className="text-emerald-500" /> Creative Brief
                                    </h3>
                                    <div className="flex gap-2">
                                        {/* Toolbar */}
                                        <div className="flex bg-black border border-neutral-800 rounded-lg p-1 mr-4">
                                            <button
                                                onClick={() => setEditorMode('write')}
                                                className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${editorMode === 'write' ? 'bg-white text-black' : 'text-neutral-500 hover:text-white'}`}
                                            >
                                                <Edit3 size={12} /> Write
                                            </button>
                                            <button
                                                onClick={() => setEditorMode('preview')}
                                                className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${editorMode === 'preview' ? 'bg-white text-black' : 'text-neutral-500 hover:text-white'}`}
                                            >
                                                <Eye size={12} /> Preview
                                            </button>
                                        </div>

                                        <button onClick={handleGenerateScript} disabled={isGenerating} className="text-[10px] bg-purple-500/10 text-purple-400 px-3 py-1 rounded-lg border border-purple-500/20 hover:bg-purple-500 hover:text-white transition-all uppercase font-black flex items-center gap-2">
                                            <PenTool size={12} />
                                            {isGenerating ? 'Drafting...' : 'Magic Script'}
                                        </button>
                                        <button onClick={handleGenerateTasks} disabled={isGenerating} className="text-[10px] bg-blue-500/10 text-blue-400 px-3 py-1 rounded-lg border border-blue-500/20 hover:bg-blue-500 hover:text-white transition-all uppercase font-black flex items-center gap-2">
                                            <ListTodo size={12} />
                                            Task List
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 relative group flex flex-col">
                                    {/* TABBED VIEW */}
                                    {editorMode === 'write' && (
                                        <textarea
                                            value={editingCampaign.description}
                                            onChange={(e) => setEditingCampaign({ ...editingCampaign, description: e.target.value })}
                                            className="flex-1 bg-transparent text-base text-neutral-300 focus:text-white outline-none resize-none leading-relaxed font-mono p-10"
                                            placeholder="Start typing your campaign logic..."
                                        />
                                    )}

                                    {editorMode === 'preview' && (
                                        <div className="flex-1 p-10 overflow-y-auto bg-neutral-900/10 prose prose-invert prose-headings:font-black prose-p:text-neutral-300 prose-li:text-neutral-300 max-w-none">
                                            {formatDescription(editingCampaign.description)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* RIGHT SIDEBAR: Action Hub */}
                        <div className="w-[350px] bg-ooedn-dark border-l border-neutral-800 flex flex-col hidden lg:flex">
                            {/* TABS */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">

                                {/* TASKS */}
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
                                        <input
                                            value={newTaskText}
                                            onChange={(e) => setNewTaskText(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                                            placeholder="Add a new task..."
                                            className="flex-1 bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500 outline-none"
                                        />
                                        <button onClick={handleAddTask} className="bg-blue-500 text-white p-2 rounded-lg"><Plus size={16} /></button>
                                    </div>
                                </div>

                                {/* TEAM CHAT */}
                                <div className="border-t border-neutral-800 pt-6">
                                    <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-4 flex items-center gap-2"><MessageSquare size={14} /> Team & Creator Notes</h4>
                                    <div className="space-y-3 mb-4 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                        {(editingCampaign.comments || []).map(comment => (
                                            <div key={comment.id} className={`p-3 rounded-xl border ${comment.isCreatorComment
                                                    ? 'bg-purple-500/5 border-purple-500/20'
                                                    : 'bg-neutral-900 border-neutral-800'
                                                }`}>
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className={`text-[9px] font-black uppercase ${comment.isCreatorComment ? 'text-purple-400' : 'text-emerald-500'
                                                        }`}>
                                                        {comment.isCreatorComment ? `🎨 ${comment.user}` : comment.user}
                                                    </span>
                                                    <span className="text-[8px] text-neutral-600">{new Date(comment.date).toLocaleDateString()}</span>
                                                </div>
                                                <p className="text-xs text-neutral-300">{comment.text}</p>
                                            </div>
                                        ))}
                                        {(!editingCampaign.comments || editingCampaign.comments.length === 0) && <p className="text-[10px] text-neutral-600 italic">No comments yet. Start the discussion.</p>}
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            value={commentText}
                                            onChange={(e) => setCommentText(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                                            placeholder="Discuss ideas..."
                                            className="flex-1 bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 outline-none"
                                        />
                                        <button onClick={handleAddComment} className="bg-purple-500 text-white p-2 rounded-lg"><Send size={16} /></button>
                                    </div>
                                </div>

                                {/* ROSTER & ASSETS */}
                                <div className="border-t border-neutral-800 pt-6">
                                    <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Users size={14} /> Roster & Content</h4>
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {creators.filter(c => editingCampaign.assignedCreatorIds.includes(c.id)).map(c => (
                                            <div key={c.id} className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-full pr-3 p-1">
                                                <div className="w-6 h-6 rounded-full bg-neutral-800 overflow-hidden">{c.profileImage ? <img src={c.profileImage} alt={c.name} className="w-full h-full object-cover" /> : null}</div>
                                                <span className="text-[9px] font-bold text-white">{c.name}</span>
                                                <button
                                                    onClick={() => {
                                                        const updated = { ...editingCampaign, assignedCreatorIds: editingCampaign.assignedCreatorIds.filter(id => id !== c.id) };
                                                        setEditingCampaign(updated);
                                                        onSaveCampaign(updated);
                                                    }}
                                                    className="text-neutral-600 hover:text-red-400 ml-1"
                                                ><X size={10} /></button>
                                            </div>
                                        ))}
                                    </div>

                                    {/* SEND TO CREATOR */}
                                    <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4 mb-4">
                                        <h5 className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                            <Send size={12} /> Assign to Creator Portal
                                        </h5>
                                        <select
                                            onChange={(e) => {
                                                const creatorId = e.target.value;
                                                if (!creatorId || editingCampaign.assignedCreatorIds.includes(creatorId)) return;
                                                const updated = {
                                                    ...editingCampaign,
                                                    assignedCreatorIds: [...editingCampaign.assignedCreatorIds, creatorId],
                                                    creatorNotified: true,
                                                };
                                                setEditingCampaign(updated);
                                                onSaveCampaign(updated);
                                                // Send notification to creator
                                                if (onNotifyCreator) {
                                                    onNotifyCreator(creatorId, editingCampaign.title);
                                                }
                                                e.target.value = '';
                                            }}
                                            className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 outline-none mb-2"
                                            defaultValue=""
                                            title="Select a creator"
                                        >
                                            <option value="" disabled>Select a creator...</option>
                                            {creators
                                                .filter(c => !editingCampaign.assignedCreatorIds.includes(c.id))
                                                .map(c => <option key={c.id} value={c.id}>{c.name} ({c.handle})</option>)}
                                        </select>
                                        <p className="text-[9px] text-neutral-500">Selected creators will see this campaign in their portal</p>
                                    </div>

                                    {/* DEADLINE */}
                                    <div className="mb-4">
                                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-1" htmlFor="campaign-deadline">Deadline</label>
                                        <input
                                            id="campaign-deadline"
                                            type="date"
                                            value={editingCampaign.deadline?.split('T')[0] || ''}
                                            onChange={(e) => {
                                                const updated = { ...editingCampaign, deadline: e.target.value ? new Date(e.target.value).toISOString() : undefined };
                                                setEditingCampaign(updated);
                                                onSaveCampaign(updated);
                                            }}
                                            className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                                        />
                                    </div>

                                    {/* MOODBOARD & VISUAL DIRECTION */}
                                    <div className="border-t border-neutral-800 pt-6 mt-4">
                                        <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Palette size={14} /> Moodboard & Visual Direction</h4>

                                        {/* Style Notes */}
                                        <div className="mb-4">
                                            <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest block mb-1" htmlFor="style-notes">Style Notes & Tone</label>
                                            <textarea
                                                id="style-notes"
                                                value={editingCampaign.styleNotes || ''}
                                                onChange={(e) => {
                                                    const updated = { ...editingCampaign, styleNotes: e.target.value };
                                                    setEditingCampaign(updated);
                                                }}
                                                onBlur={() => onSaveCampaign(editingCampaign)}
                                                placeholder="Describe the mood, tone, colors, aesthetic, energy... e.g. 'Warm earth tones, cozy lifestyle vibes, natural lighting, soft transitions'"
                                                className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 outline-none h-20 resize-none leading-relaxed"
                                            />
                                        </div>

                                        {/* Reference Links */}
                                        <div className="mb-4">
                                            <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest block mb-1">Reference / Inspiration Links</label>
                                            <div className="space-y-1.5 mb-2">
                                                {(editingCampaign.referenceLinks || []).map((link, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 group">
                                                        <LinkIcon size={10} className="text-purple-400 flex-shrink-0" />
                                                        <a href={link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-purple-400 hover:text-purple-300 truncate flex-1">{link}</a>
                                                        <button
                                                            onClick={() => {
                                                                const updated = { ...editingCampaign, referenceLinks: (editingCampaign.referenceLinks || []).filter((_, i) => i !== idx) };
                                                                setEditingCampaign(updated);
                                                                onSaveCampaign(updated);
                                                            }}
                                                            className="text-neutral-600 hover:text-red-400 opacity-0 group-hover:opacity-100"
                                                            title="Remove link"
                                                        ><X size={10} /></button>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex gap-2">
                                                <input
                                                    placeholder="Paste a reference URL..."
                                                    className="flex-1 bg-black border border-neutral-800 rounded-lg px-3 py-1.5 text-[10px] text-white focus:border-purple-500 outline-none"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                                                            const url = (e.target as HTMLInputElement).value.trim();
                                                            const updated = { ...editingCampaign, referenceLinks: [...(editingCampaign.referenceLinks || []), url] };
                                                            setEditingCampaign(updated);
                                                            onSaveCampaign(updated);
                                                            (e.target as HTMLInputElement).value = '';
                                                        }
                                                    }}
                                                />
                                                <button
                                                    onClick={() => {
                                                        const inputEl = document.querySelector('#ref-link-input') as HTMLInputElement;
                                                        if (inputEl?.value.trim()) {
                                                            const updated = { ...editingCampaign, referenceLinks: [...(editingCampaign.referenceLinks || []), inputEl.value.trim()] };
                                                            setEditingCampaign(updated);
                                                            onSaveCampaign(updated);
                                                            inputEl.value = '';
                                                        }
                                                    }}
                                                    className="bg-purple-500/10 text-purple-400 px-2 py-1.5 rounded-lg hover:bg-purple-500/20 text-[10px] font-bold"
                                                    title="Add link"
                                                ><Plus size={12} /></button>
                                            </div>
                                        </div>

                                        {/* Moodboard Assets */}
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
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CampaignBoard;
