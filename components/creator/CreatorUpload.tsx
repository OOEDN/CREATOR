import React, { useState, useRef } from 'react';
import { Creator, ContentItem, ContentType, ContentStatus, Platform, ContentNote } from '../../types';
import {
    Upload as UploadIcon, Image, Video, FileText, CheckCircle, Loader2,
    MessageSquare, Send, ChevronDown, ChevronUp, Sparkles, Eye
} from 'lucide-react';

interface Props {
    creator: Creator;
    contentItems: ContentItem[];
    onUpload: (item: ContentItem) => void;
    onReplyToNote: (contentId: string, text: string) => void;
}

const statusColors: Record<string, { bg: string; text: string; emoji: string }> = {
    'Raw': { bg: 'bg-neutral-500/10', text: 'text-neutral-400', emoji: '📋' },
    'In Review': { bg: 'bg-blue-500/10', text: 'text-blue-400', emoji: '👁️' },
    'Approved': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', emoji: '✅' },
    'Needs Changes': { bg: 'bg-orange-500/10', text: 'text-orange-400', emoji: '✏️' },
    'Published': { bg: 'bg-purple-500/10', text: 'text-purple-400', emoji: '🚀' },
};

const CreatorUpload: React.FC<Props> = ({ creator, contentItems, onUpload, onReplyToNote }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [title, setTitle] = useState('');
    const [caption, setCaption] = useState('');
    const [contentType, setContentType] = useState<ContentType>(ContentType.Video);
    const [platform, setPlatform] = useState<Platform>(creator.platform);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [expandedContentId, setExpandedContentId] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [showUploadForm, setShowUploadForm] = useState(true);
    const fileRef = useRef<HTMLInputElement>(null);

    const myContent = contentItems.filter(c => c.creatorId === creator.id || c.creatorName === creator.name);

    const handleFileSelect = (file: File) => {
        setSelectedFile(file);
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
        if (file.type.startsWith('video/')) setContentType(ContentType.Video);
        else if (file.type.startsWith('image/')) setContentType(ContentType.Image);
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => setPreview(e.target?.result as string);
            reader.readAsDataURL(file);
        } else {
            setPreview(null);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    };

    const handleSubmit = async () => {
        if (!selectedFile || !title) return;
        setIsUploading(true);
        try {
            // Read file as base64
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const result = reader.result as string;
                    // Strip the data:...;base64, prefix
                    resolve(result.split(',')[1]);
                };
                reader.onerror = reject;
                reader.readAsDataURL(selectedFile);
            });

            // Upload to GCS via server API
            const jwt = localStorage.getItem('ooedn_creator_jwt');
            const uploadResp = await fetch('/api/creator/upload-file', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${jwt}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fileData: base64,
                    fileName: selectedFile.name,
                    contentType: selectedFile.type,
                }),
            });

            let fileUrl = '';
            let storageType: 'cloud' | 'local' = 'local';

            if (uploadResp.ok) {
                const uploadData = await uploadResp.json();
                fileUrl = uploadData.url;
                storageType = 'cloud';
            } else {
                // Fallback to local blob if GCS upload fails (dev mode)
                console.warn('[Upload] GCS upload failed, using local blob URL');
                fileUrl = URL.createObjectURL(selectedFile);
            }

            const item: ContentItem = {
                id: crypto.randomUUID(),
                creatorId: creator.id,
                creatorName: creator.name,
                title,
                type: contentType,
                status: ContentStatus.Raw,
                platform,
                fileUrl,
                storageType,
                uploadDate: new Date().toISOString(),
                caption: caption || undefined,
                tags: [creator.name, 'creator-upload'],
                submittedByCreator: true,
            };
            onUpload(item);
            setSelectedFile(null);
            setTitle('');
            setCaption('');
            setPreview(null);
        } catch (e) {
            console.error('[Upload] Submit error:', e);
        } finally {
            setIsUploading(false);
        }
    };

    const handleReply = (contentId: string) => {
        if (!replyText.trim()) return;
        onReplyToNote(contentId, replyText.trim());
        setReplyText('');
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            {/* HEADER */}
            <div className="text-center mb-2">
                <h2 className="text-2xl font-black text-white uppercase tracking-tight flex items-center justify-center gap-2">
                    <UploadIcon size={24} className="text-purple-400" /> Content Hub
                </h2>
                <p className="text-neutral-500 text-xs mt-1">Upload content and view team feedback</p>
            </div>

            {/* TAB TOGGLE */}
            <div className="flex bg-neutral-900 rounded-xl p-1">
                <button
                    onClick={() => setShowUploadForm(true)}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${showUploadForm ? 'bg-purple-500 text-black' : 'text-neutral-500 hover:text-white'
                        }`}
                >
                    <UploadIcon size={12} /> Upload
                </button>
                <button
                    onClick={() => setShowUploadForm(false)}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${!showUploadForm ? 'bg-purple-500 text-black' : 'text-neutral-500 hover:text-white'
                        }`}
                >
                    <Eye size={12} /> My Videos ({myContent.length})
                </button>
            </div>

            {/* UPLOAD FORM */}
            {showUploadForm && (
                <>
                    <div
                        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => fileRef.current?.click()}
                        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${isDragging ? 'border-purple-500 bg-purple-500/5 scale-[1.02]' :
                            selectedFile ? 'border-emerald-500/30 bg-emerald-500/5' :
                                'border-neutral-800 hover:border-purple-500/30 bg-neutral-900/80'
                            }`}
                    >
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*,video/*"
                            className="hidden"
                            aria-label="Upload file"
                            onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                        />
                        {selectedFile ? (
                            <div className="space-y-3">
                                {preview && <img src={preview} alt="Preview" className="w-28 h-28 object-cover rounded-xl mx-auto border border-neutral-700" />}
                                {!preview && <Video size={40} className="text-purple-400 mx-auto" />}
                                <p className="text-sm font-bold text-white">{selectedFile.name}</p>
                                <p className="text-[10px] text-neutral-500">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setPreview(null); }}
                                    className="text-[10px] text-red-400 underline hover:text-red-300"
                                >Remove</button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto">
                                    <UploadIcon size={28} className="text-purple-400" />
                                </div>
                                <p className="text-sm text-neutral-300 font-bold">Drop your file here or click to browse</p>
                                <p className="text-[10px] text-neutral-600">Supports images and video 🎬</p>
                            </div>
                        )}
                    </div>

                    {selectedFile && (
                        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1" htmlFor="upload-title">Title</label>
                                <input
                                    id="upload-title"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1" htmlFor="upload-type">Type</label>
                                    <select
                                        id="upload-type"
                                        value={contentType}
                                        onChange={e => setContentType(e.target.value as ContentType)}
                                        className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                                    >
                                        <option value="Video">Video</option>
                                        <option value="Image">Image</option>
                                        <option value="Story">Story</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1" htmlFor="upload-platform">Platform</label>
                                    <select
                                        id="upload-platform"
                                        value={platform}
                                        onChange={e => setPlatform(e.target.value as Platform)}
                                        className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                                    >
                                        {Object.values(Platform).map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1" htmlFor="upload-caption">Caption / Notes</label>
                                <textarea
                                    id="upload-caption"
                                    value={caption}
                                    onChange={e => setCaption(e.target.value)}
                                    rows={3}
                                    className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50 resize-none"
                                    placeholder="Add a caption or notes for the team..."
                                />
                            </div>
                            <button
                                onClick={handleSubmit}
                                disabled={isUploading || !title}
                                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3.5 rounded-xl font-black uppercase tracking-widest text-sm hover:from-purple-400 hover:to-pink-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 active:scale-95"
                            >
                                {isUploading ? <Loader2 className="animate-spin" size={16} /> : <UploadIcon size={16} />}
                                Submit Content 🚀
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* MY VIDEOS GALLERY */}
            {!showUploadForm && (
                <div className="space-y-3">
                    {myContent.length === 0 ? (
                        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-12 text-center">
                            <div className="text-4xl mb-3">🎬</div>
                            <p className="text-neutral-400 text-sm">No uploads yet</p>
                            <p className="text-neutral-600 text-[10px]">Switch to Upload tab to submit your first video</p>
                        </div>
                    ) : (
                        myContent.map(content => {
                            const sc = statusColors[content.status] || statusColors['Raw'];
                            const isExpanded = expandedContentId === content.id;
                            const notes = content.teamNotes || [];
                            const hasNotes = notes.length > 0;

                            return (
                                <div key={content.id} className="bg-neutral-900/80 border border-neutral-800 rounded-2xl overflow-hidden transition-all">
                                    {/* Video Header */}
                                    <div
                                        className="p-4 flex items-center gap-3 cursor-pointer hover:bg-neutral-800/50 transition-colors"
                                        onClick={() => setExpandedContentId(isExpanded ? null : content.id)}
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                                            {content.type === 'Video' ? <Video size={18} className="text-purple-400" /> :
                                                content.type === 'Image' ? <Image size={18} className="text-blue-400" /> :
                                                    <FileText size={18} className="text-neutral-400" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-bold text-white truncate">{content.title}</p>
                                                {hasNotes && (
                                                    <span className="flex items-center gap-0.5 text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded-full font-bold">
                                                        <MessageSquare size={8} /> {notes.length}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-neutral-500">{content.platform} • {new Date(content.uploadDate).toLocaleDateString()}</p>
                                        </div>
                                        <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg ${sc.bg} ${sc.text} flex items-center gap-1`}>
                                            {sc.emoji} {content.status}
                                        </span>
                                        {isExpanded ? <ChevronUp size={14} className="text-neutral-600" /> : <ChevronDown size={14} className="text-neutral-600" />}
                                    </div>

                                    {/* Expanded Content */}
                                    {isExpanded && (
                                        <div className="px-4 pb-4 border-t border-neutral-800 pt-3 space-y-3">
                                            {content.caption && (
                                                <div className="bg-black/50 rounded-xl p-3 border border-neutral-800">
                                                    <p className="text-[10px] text-neutral-500 font-bold uppercase mb-1">Your Caption</p>
                                                    <p className="text-xs text-neutral-300">{content.caption}</p>
                                                </div>
                                            )}

                                            {/* Team Notes / Feedback Thread */}
                                            {hasNotes && (
                                                <div>
                                                    <p className="text-[10px] text-neutral-500 font-bold uppercase mb-2 flex items-center gap-1">
                                                        <MessageSquare size={10} /> Team Feedback
                                                    </p>
                                                    <div className="space-y-2">
                                                        {notes.map(note => (
                                                            <div
                                                                key={note.id}
                                                                className={`p-3 rounded-xl border ${note.isCreatorReply
                                                                    ? 'bg-purple-500/5 border-purple-500/10 ml-4'
                                                                    : 'bg-blue-500/5 border-blue-500/10'
                                                                    }`}
                                                            >
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <span className={`text-[10px] font-bold ${note.isCreatorReply ? 'text-purple-400' : 'text-blue-400'}`}>
                                                                        {note.isCreatorReply ? '💬 You' : `📣 ${note.user}`}
                                                                    </span>
                                                                    <span className="text-[9px] text-neutral-600">{new Date(note.date).toLocaleDateString()}</span>
                                                                </div>
                                                                <p className="text-xs text-neutral-300">{note.text}</p>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Reply Input */}
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <input
                                                            value={replyText}
                                                            onChange={e => setReplyText(e.target.value)}
                                                            onKeyDown={e => e.key === 'Enter' && handleReply(content.id)}
                                                            placeholder="Reply to feedback..."
                                                            className="flex-1 bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-purple-500/50"
                                                        />
                                                        <button
                                                            onClick={() => handleReply(content.id)}
                                                            disabled={!replyText.trim()}
                                                            className="p-2 bg-purple-500 text-black rounded-lg hover:bg-purple-400 transition-all disabled:opacity-30"
                                                            title="Send reply"
                                                        >
                                                            <Send size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {!hasNotes && (
                                                <p className="text-[10px] text-neutral-600 text-center py-2">No feedback yet — the team will review your content soon ⏳</p>
                                            )}

                                            {content.paymentRequested && (
                                                <div className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2">
                                                    <CheckCircle size={12} className="text-emerald-400" />
                                                    <span className="text-[10px] text-emerald-400 font-bold">Payment requested for this video</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};

export default CreatorUpload;
