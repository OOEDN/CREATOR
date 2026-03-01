
import React, { useState } from 'react';
import { ContentItem, ContentStatus, Platform, AppSettings, ContentType } from '../types';
import { PLATFORM_ICONS, CONTENT_STATUS_COLORS, PLATFORM_COLORS } from '../constants';
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Film, Image as ImageIcon, DownloadCloud, Copy, CheckCircle2, Calendar, Move, Sparkles, Loader2, ClipboardCheck } from 'lucide-react';
import { createCalendarEvent } from '../services/googleWorkspaceService';
import { generateCaptionAI } from '../services/geminiService';

interface CalendarViewProps {
    contentItems: ContentItem[];
    onUpdateContent: (id: string, updates: Partial<ContentItem>) => void;
    onUploadContent: (item: ContentItem) => void;
    onDeleteContent: (id: string) => void;
    appSettings?: AppSettings;
}

const CalendarView: React.FC<CalendarViewProps> = ({ contentItems, onUpdateContent, onUploadContent, onDeleteContent, appSettings }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedPlatform, setSelectedPlatform] = useState<Platform | 'All'>('All');
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
    const [generatingCaption, setGeneratingCaption] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const handleGenerateCaption = async (item: ContentItem) => {
        try {
            setGeneratingCaption(item.id);
            const caption = await generateCaptionAI(
                item.title,
                item.creatorName || 'Team',
                contentItems.filter(c => c.caption).map(c => c.caption!).slice(-5),
                appSettings?.brandInfo
            );
            if (caption) {
                onUpdateContent(item.id, { caption });
            }
        } catch (e) {
            console.warn('[Caption AI] Generation failed (non-blocking):', e);
        } finally {
            setGeneratingCaption(null);
        }
    };

    const handleCopyCaption = (item: ContentItem) => {
        try {
            navigator.clipboard.writeText(item.caption || '');
            setCopiedId(item.id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (e) {
            console.warn('[Caption] Copy failed:', e);
        }
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();
        return { days, firstDay };
    };

    const { days, firstDay } = getDaysInMonth(currentDate);

    const changeMonth = (offset: number) => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
    };

    const getDayContent = (day: number) => {
        const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toISOString().split('T')[0];
        return contentItems.filter(item => {
            const isDateMatch = item.scheduledDate?.split('T')[0] === dateStr;
            const isPlatformMatch = selectedPlatform === 'All' || item.platform === selectedPlatform;
            return isDateMatch && isPlatformMatch;
        });
    };

    const getUnusedContent = () => {
        return contentItems.filter(item => !item.scheduledDate && item.status !== ContentStatus.Posted);
    };

    const handleDownload = async (item: ContentItem) => {
        if (!appSettings?.googleCloudToken) return;
        try {
            const response = await fetch(item.fileUrl, { headers: { 'Authorization': `Bearer ${appSettings.googleCloudToken}` } });
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = item.title;
            link.click();
            window.URL.revokeObjectURL(url);
        } catch (e) { alert("Download failed. Bucket access restricted?"); }
    };

    const handleCalendarSync = async (item: ContentItem) => {
        if (!appSettings?.googleCloudToken) return alert("Please log in to sync.");
        setIsSyncing(true);
        try {
            await createCalendarEvent(item, appSettings.googleCloudToken);
            alert("Synced to Google Calendar!");
        } catch (e: any) {
            alert(`Sync Failed: ${e.message}`);
        } finally {
            setIsSyncing(false);
        }
    };

    // --- Drag and Drop Logic ---

    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedItemId(id);
        e.dataTransfer.setData('text/plain', id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, day: number) => {
        e.preventDefault();
        const id = e.dataTransfer.getData('text/plain');
        const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);

        // Preserve original time if exists, otherwise default to noon
        const originalItem = contentItems.find(i => i.id === id);
        let newDateIso = targetDate.toISOString();

        if (originalItem?.scheduledDate) {
            const timePart = originalItem.scheduledDate.split('T')[1] || '12:00:00.000Z';
            newDateIso = `${targetDate.toISOString().split('T')[0]}T${timePart}`;
        }

        onUpdateContent(id, { scheduledDate: newDateIso });
        setDraggedItemId(null);
    };

    return (
        <div className="flex h-full flex-col bg-ooedn-black">
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-sm">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 bg-neutral-900 rounded-xl p-1 border border-neutral-800 shadow-lg">
                        <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400 transition-colors"><ChevronLeft size={16} /></button>
                        <span className="w-32 text-center font-black uppercase text-xs tracking-widest text-emerald-500">
                            {currentDate.toLocaleDateString('default', { month: 'short', year: 'numeric' })}
                        </span>
                        <button onClick={() => changeMonth(1)} className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400 transition-colors"><ChevronRight size={16} /></button>
                    </div>
                    <div className="hidden md:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-neutral-600">
                        <Move size={12} /> Drag & Drop posts to reschedule
                    </div>
                </div>

                <div className="flex bg-neutral-900 border border-neutral-800 rounded-xl p-1">
                    <button onClick={() => setSelectedPlatform('All')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${selectedPlatform === 'All' ? 'bg-white text-black shadow-md' : 'text-neutral-500 hover:text-white'}`}>All</button>
                    <button onClick={() => setSelectedPlatform(Platform.Instagram)} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${selectedPlatform === Platform.Instagram ? 'bg-pink-500 text-white shadow-md' : 'text-neutral-500 hover:text-pink-500'}`}>IG</button>
                    <button onClick={() => setSelectedPlatform(Platform.TikTok)} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${selectedPlatform === Platform.TikTok ? 'bg-teal-500 text-white shadow-md' : 'text-neutral-500 hover:text-teal-500'}`}>TikTok</button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4 md:p-6">
                <div className="grid grid-cols-7 gap-px bg-neutral-800 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} className="bg-ooedn-dark p-3 text-center text-[10px] font-black text-neutral-500 uppercase tracking-widest border-b border-neutral-800/50">{d}</div>
                    ))}

                    {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} className="bg-ooedn-black/80 min-h-[140px]" />)}

                    {Array.from({ length: days }).map((_, i) => {
                        const day = i + 1;
                        const content = getDayContent(day);
                        const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();

                        return (
                            <div
                                key={day}
                                onClick={() => setSelectedDay(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, day)}
                                className={`
                                bg-ooedn-black min-h-[140px] p-2 transition-all cursor-pointer group relative border-r border-b border-neutral-800/30
                                hover:bg-neutral-900/40
                                ${isToday ? 'bg-emerald-900/5 ring-1 ring-inset ring-emerald-500/30' : ''}
                            `}
                            >
                                <span className={`text-[10px] font-black block mb-2 px-2 py-1 rounded-md w-fit ${isToday ? 'bg-emerald-500 text-black' : 'text-neutral-600'}`}>
                                    {day}
                                </span>

                                <div className="space-y-1.5">
                                    {content.map(item => (
                                        <div
                                            key={item.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, item.id)}
                                            className={`
                                            p-1.5 rounded-lg border flex items-center gap-2 
                                            ${PLATFORM_COLORS[item.platform]} bg-opacity-10 hover:bg-opacity-20 backdrop-blur-sm 
                                            transition-all cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md hover:scale-[1.02]
                                            ${draggedItemId === item.id ? 'opacity-50' : 'opacity-100'}
                                        `}
                                        >
                                            <div className="w-6 h-6 rounded bg-black flex-shrink-0 overflow-hidden border border-white/10 relative">
                                                {item.thumbnail ? (
                                                    <img src={item.thumbnail} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-neutral-800">
                                                        {item.type === ContentType.Image ? <ImageIcon size={10} /> : <Film size={10} />}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1 overflow-hidden">
                                                <p className="font-black uppercase text-[8px] tracking-wide truncate leading-tight">{item.title}</p>
                                                <p className="text-[7px] font-bold opacity-70 truncate">@{item.creatorName}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Hover Add Button */}
                                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="p-1.5 bg-neutral-800 text-neutral-400 rounded-lg hover:bg-white hover:text-black shadow-lg">
                                        <Plus size={14} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {selectedDay && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-hidden animate-in fade-in duration-200">
                    <div className="bg-ooedn-dark border border-neutral-700 rounded-[2rem] w-full max-w-5xl h-[85vh] flex flex-col md:flex-row overflow-hidden shadow-2xl">

                        {/* Left: Scheduled Feed */}
                        <div className="w-full md:w-1/2 border-r border-neutral-800 p-8 flex flex-col bg-black/40">
                            <div className="flex justify-between items-center mb-8">
                                <div className="flex items-center gap-4">
                                    <h3 className="font-heading text-3xl text-white uppercase tracking-tighter">{selectedDay.toLocaleDateString('default', { month: 'long', day: 'numeric' })}</h3>
                                </div>
                                <button onClick={() => setSelectedDay(null)} className="text-neutral-500 hover:text-white transition-colors p-2 bg-neutral-900 rounded-full hover:bg-red-500 hover:shadow-lg"><X size={24} /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
                                {contentItems.filter(c => c.scheduledDate?.split('T')[0] === selectedDay.toISOString().split('T')[0]).map(item => (
                                    <div key={item.id} className={`border rounded-2xl p-4 flex flex-col gap-4 ${PLATFORM_COLORS[item.platform]} bg-opacity-5 border-white/5 shadow-lg group hover:bg-opacity-10 transition-all`}>
                                        <div className="flex gap-4">
                                            <div className="w-20 h-20 rounded-xl bg-black overflow-hidden border border-white/10 flex-shrink-0 shadow-lg relative group-hover:scale-105 transition-transform">
                                                {item.thumbnail ? (
                                                    <img src={item.thumbnail} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-neutral-900">
                                                        {item.type === ContentType.Image ? <ImageIcon className="text-neutral-700" /> : <Film className="text-neutral-700" />}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start gap-2">
                                                    <p className="text-sm font-black uppercase tracking-tight truncate flex items-center gap-2 text-white">
                                                        {PLATFORM_ICONS[item.platform]} {item.title}
                                                    </p>
                                                    <button onClick={() => onUpdateContent(item.id, { scheduledDate: undefined })} className="p-1.5 bg-neutral-900 text-neutral-500 hover:text-red-500 rounded-lg transition-all" title="Remove from Calendar"><X size={14} /></button>
                                                </div>
                                                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mt-1">@{item.creatorName}</p>

                                                <div className="mt-4 flex flex-wrap items-center gap-2">
                                                    <select
                                                        value={item.status}
                                                        onChange={(e) => onUpdateContent(item.id, { status: e.target.value as ContentStatus })}
                                                        className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border-none outline-none text-white cursor-pointer shadow-lg hover:brightness-110 ${CONTENT_STATUS_COLORS[item.status]}`}
                                                    >
                                                        {Object.values(ContentStatus).map(s => <option key={s} value={s} className="bg-neutral-900">{s}</option>)}
                                                    </select>
                                                    <button onClick={() => handleDownload(item)} className="p-1.5 bg-neutral-800 text-white rounded-lg hover:bg-white hover:text-black transition-all shadow-lg flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest">
                                                        <DownloadCloud size={12} /> Download
                                                    </button>
                                                    <button onClick={() => handleCalendarSync(item)} disabled={isSyncing} className="p-1.5 bg-neutral-800 text-white rounded-lg hover:bg-blue-500 transition-all shadow-lg flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest">
                                                        <Calendar size={12} /> Sync G-Cal
                                                    </button>
                                                </div>

                                                {/* CAPTION DRAFTING */}
                                                <div className="mt-4 pt-4 border-t border-white/5">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500">📝 Caption Draft</span>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => handleGenerateCaption(item)}
                                                                disabled={generatingCaption === item.id}
                                                                className="flex items-center gap-1 px-2 py-1 text-[8px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg hover:bg-purple-500/20 transition-all disabled:opacity-50"
                                                            >
                                                                {generatingCaption === item.id ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                                                                {generatingCaption === item.id ? 'Writing...' : 'AI Draft'}
                                                            </button>
                                                            {item.caption && (
                                                                <button
                                                                    onClick={() => handleCopyCaption(item)}
                                                                    className={`flex items-center gap-1 px-2 py-1 text-[8px] font-black uppercase tracking-widest rounded-lg border transition-all ${copiedId === item.id
                                                                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                                                            : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white hover:border-neutral-600'
                                                                        }`}
                                                                >
                                                                    {copiedId === item.id ? <><ClipboardCheck size={10} /> Copied!</> : <><Copy size={10} /> Copy</>}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <textarea
                                                        value={item.caption || ''}
                                                        onChange={(e) => onUpdateContent(item.id, { caption: e.target.value })}
                                                        placeholder="Write or AI-generate a caption ready to copy when it's time to post..."
                                                        className="w-full bg-black/60 border border-neutral-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-purple-500/50 resize-none transition-colors placeholder:text-neutral-700"
                                                        rows={4}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {contentItems.filter(c => c.scheduledDate?.split('T')[0] === selectedDay.toISOString().split('T')[0]).length === 0 && (
                                    <div className="h-full flex flex-col items-center justify-center text-neutral-700 border-2 border-dashed border-neutral-800 rounded-3xl">
                                        <Calendar size={48} className="mb-4 opacity-20" />
                                        <p className="text-xs font-black uppercase tracking-widest">No scheduled posts</p>
                                        <p className="text-[10px] text-neutral-600 mt-2">Drag from the pool on the right</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right: Asset Pool */}
                        <div className="w-full md:w-1/2 p-8 bg-neutral-900/30 flex flex-col overflow-hidden">
                            <div className="flex justify-between items-center mb-6">
                                <h4 className="text-xs font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                                    <ImageIcon size={16} /> Unscheduled Asset Pool
                                </h4>
                                <span className="text-[10px] font-bold bg-neutral-800 px-2 py-1 rounded text-white">{getUnusedContent().length} Items</span>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                                {getUnusedContent().map(item => (
                                    <div key={item.id} className={`border rounded-2xl p-3 flex justify-between items-center group ${PLATFORM_COLORS[item.platform]} bg-opacity-5 hover:bg-opacity-15 transition-all border-white/5`}>
                                        <div className="flex gap-4 items-center min-w-0 flex-1">
                                            <div className="w-12 h-12 rounded-lg bg-black overflow-hidden flex-shrink-0 border border-white/10 shadow-lg">
                                                {item.thumbnail ? (
                                                    <img src={item.thumbnail} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-neutral-800">
                                                        {item.type === ContentType.Image ? <ImageIcon size={14} className="text-neutral-600" /> : <Film size={14} className="text-neutral-600" />}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg">{PLATFORM_ICONS[item.platform]}</span>
                                                    <p className="text-[10px] font-black uppercase tracking-tight truncate text-white">{item.title}</p>
                                                </div>
                                                <p className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest">@{item.creatorName}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => onUpdateContent(item.id, { scheduledDate: selectedDay.toISOString() })} className="bg-emerald-500 text-black p-2 rounded-xl hover:scale-110 transition-all shadow-lg active:scale-95">
                                                <Plus size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CalendarView;
