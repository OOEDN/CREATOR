
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { ContentItem, ContentStatus, ContentType, Platform, AppSettings } from '../types';
import {
  Upload, Trash2, X, Loader2, Play, Search,
  Sparkles, DownloadCloud, Copy, CheckCircle2, Maximize2, Film, Image as ImageIcon, Tag, HardDrive, Filter, CheckCircle, Circle, ChevronRight,
  Eye, Edit3, Send, MessageSquare
} from 'lucide-react';
import { CONTENT_STATUS_COLORS, PLATFORM_ICONS, PLATFORM_COLORS } from '../constants';
import { uploadToGoogleCloud } from '../services/googleCloudStorage';
import { analyzeImageWithVision } from '../services/visionService';
import { analyzeVideoWithIntelligence } from '../services/videoService';
import { uploadToGoogleDrive, ensureOOEDNMasterFolder, syncAllContentToDrive } from '../services/googleDriveService';

interface ContentLibraryProps {
  items: ContentItem[];
  creatorId?: string;
  creatorName?: string;
  onUpload: (item: ContentItem) => Promise<void>;
  onUpdate: (id: string, updates: Partial<ContentItem>) => void;
  onDelete: (id: string) => void;
  appSettings?: AppSettings;
  initialView?: 'Available' | 'Used' | 'Team' | 'All';
  hideTabs?: boolean;
}

const generateThumbnail = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const maxDim = 300;
          let w = img.width, h = img.height;
          if (w > h) { if (w > maxDim) { h *= maxDim / w; w = maxDim; } }
          else { if (h > maxDim) { w *= maxDim / h; h = maxDim; } }
          canvas.width = w; canvas.height = h;
          ctx?.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    } else if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.load();
      video.onloadeddata = () => {
        video.currentTime = 1;
      };
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth / 4;
        canvas.height = video.videoHeight / 4;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(video.src);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
    } else {
      resolve('');
    }
  });
};

const ContentLibrary: React.FC<ContentLibraryProps> = ({
  items, creatorId, creatorName, onUpload, onUpdate, onDelete, appSettings,
  initialView = 'Available', hideTabs = false
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | ContentType.Image | ContentType.Video>('All');
  const [currentView, setCurrentView] = useState<'Available' | 'Used' | 'Team' | 'All'>(initialView);
  const [uploadPlatform, setUploadPlatform] = useState<Platform>(Platform.Instagram); // Default to IG
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [previewItem, setPreviewItem] = useState<ContentItem | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const [reviewNote, setReviewNote] = useState('');
  const [analysisToast, setAnalysisToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const tagsMatch = item.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.creatorName?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        tagsMatch;
      const matchesType = typeFilter === 'All' || item.type === typeFilter;

      let matchesView = false;
      if (currentView === 'All') {
        matchesView = true;
      } else if (currentView === 'Available') {
        matchesView = !item.isUsed && item.creatorId !== 'team';
      } else if (currentView === 'Used') {
        matchesView = !!item.isUsed;
      } else if (currentView === 'Team') {
        matchesView = item.creatorId === 'team' && !item.isUsed;
      }

      return matchesSearch && matchesType && matchesView;
    });
  }, [items, searchTerm, typeFilter, currentView]);

  // Effect to handle preview loading — tries server proxy, then direct GCS with OAuth
  useEffect(() => {
    let active = true;
    const loadPreview = async () => {
      if (!previewItem?.fileUrl) return;

      setIsPreviewLoading(true);
      setPreviewBlobUrl(null);

      // Strategy 1: Server-side media proxy (works in production with service account)
      try {
        const proxyUrl = `/api/media-proxy?url=${encodeURIComponent(previewItem.fileUrl)}`;
        const response = await fetch(proxyUrl);
        if (response.ok) {
          const blob = await response.blob();
          if (active) {
            setPreviewBlobUrl(URL.createObjectURL(blob));
            setIsPreviewLoading(false);
          }
          return;
        }
      } catch (e) {
        console.warn('[MediaPreview] Proxy unavailable, trying direct GCS...');
      }

      // Strategy 2: Direct GCS fetch with user's OAuth token
      if (appSettings?.googleCloudToken) {
        try {
          const response = await fetch(previewItem.fileUrl, {
            headers: { 'Authorization': `Bearer ${appSettings.googleCloudToken}` }
          });
          if (response.ok) {
            const blob = await response.blob();
            if (active) {
              setPreviewBlobUrl(URL.createObjectURL(blob));
              setIsPreviewLoading(false);
            }
            return;
          }
        } catch (e) {
          console.warn('[MediaPreview] Direct GCS fetch failed, falling back to thumbnail');
        }
      }

      // Strategy 3: Try the URL directly (public files)
      if (active && previewItem.fileUrl) {
        try {
          const response = await fetch(previewItem.fileUrl);
          if (response.ok) {
            const blob = await response.blob();
            if (active) {
              setPreviewBlobUrl(URL.createObjectURL(blob));
              setIsPreviewLoading(false);
            }
            return;
          }
        } catch (e) {
          console.warn('[MediaPreview] Direct URL fetch failed');
        }
      }

      // Fallback: use stored thumbnail
      if (active && previewItem.thumbnail) {
        setPreviewBlobUrl(previewItem.thumbnail);
      }
      if (active) setIsPreviewLoading(false);
    };

    loadPreview();

    return () => {
      active = false;
      if (previewBlobUrl && !previewBlobUrl.startsWith('data:')) {
        URL.revokeObjectURL(previewBlobUrl);
      }
      setPreviewBlobUrl(null);
    };
  }, [previewItem]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !appSettings?.googleCloudBucket || !appSettings?.googleCloudToken) return;

    setIsUploading(true);
    setUploadStatus('Preparing...');
    const fileArray = Array.from(files) as File[];

    let masterDriveFolderId: string | null = null;
    try {
      masterDriveFolderId = await ensureOOEDNMasterFolder(appSettings.googleCloudToken, appSettings.googleProjectId);
    } catch (e) {
      console.warn("Drive Backup Init Failed - Continuing with Cloud Storage only", e);
    }

    for (const file of fileArray) {
      try {
        setUploadStatus(`Processing ${file.name}...`);
        const thumbnail = await generateThumbnail(file);
        const storagePath = `media/${Date.now()}-${file.name.replace(/\s+/g, '_')}`;

        const url = await uploadToGoogleCloud(file, appSettings.googleCloudBucket, appSettings.googleCloudToken, storagePath, file.type, appSettings.googleProjectId);

        if (masterDriveFolderId) {
          setUploadStatus(`Backing up ${file.name} to Drive...`);
          await uploadToGoogleDrive(
            file,
            masterDriveFolderId,
            appSettings.googleCloudToken,
            file.name,
            appSettings.googleProjectId
          ).catch(err => console.error(`Drive Backup Failed for ${file.name}`, err));
        }

        const newItem: ContentItem = {
          id: crypto.randomUUID(),
          creatorId: currentView === 'Team' ? 'team' : (creatorId || 'team'),
          creatorName: currentView === 'Team' ? 'Team Asset' : (creatorName || 'Team Asset'),
          title: file.name,
          type: file.type.startsWith('video') ? ContentType.Video : ContentType.Image,
          status: ContentStatus.Raw,
          platform: uploadPlatform, // USES SELECTED PLATFORM
          fileUrl: url,
          thumbnail: thumbnail,
          storageType: 'cloud',
          uploadDate: new Date().toISOString(),
          createdDate: new Date().toISOString(),
          tags: [],
          driveBackedUp: !!masterDriveFolderId // Mark as backed up if Drive succeeded
        };
        await onUpload(newItem);
      } catch (err) { console.error("Upload error:", err); }
    }
    setIsUploading(false);
    setUploadStatus('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSyncToDrive = async () => {
    if (!appSettings?.googleCloudToken) return;
    setIsSyncing(true);
    setSyncStatus('Starting sync...');
    try {
      const result = await syncAllContentToDrive(
        items,
        appSettings.googleCloudToken,
        appSettings.googleProjectId,
        (done, total, current) => setSyncStatus(`Syncing ${done + 1}/${total}: ${current}`),
        (id) => onUpdate(id, { driveBackedUp: true })
      );
      setSyncStatus(`✅ Done: ${result.synced} synced, ${result.failed} failed`);
      setTimeout(() => setSyncStatus(''), 5000);
    } catch (e) {
      setSyncStatus('❌ Sync failed');
      console.error('Drive sync error:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDownload = async (item: ContentItem) => {
    try {
      let blob: Blob | null = null;

      // Strategy 1: Server-side media proxy
      try {
        const proxyUrl = `/api/media-proxy?url=${encodeURIComponent(item.fileUrl)}`;
        const response = await fetch(proxyUrl);
        if (response.ok) blob = await response.blob();
      } catch (e) {
        console.warn('[Download] Proxy unavailable, trying direct GCS...');
      }

      // Strategy 2: Direct GCS with OAuth token
      if (!blob && appSettings?.googleCloudToken) {
        try {
          const response = await fetch(item.fileUrl, {
            headers: { 'Authorization': `Bearer ${appSettings.googleCloudToken}` }
          });
          if (response.ok) blob = await response.blob();
        } catch (e) {
          console.warn('[Download] Direct GCS fetch failed');
        }
      }

      // Strategy 3: Direct URL (public files)
      if (!blob) {
        const response = await fetch(item.fileUrl);
        if (response.ok) blob = await response.blob();
      }

      if (!blob) throw new Error('All download methods failed');

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = item.title;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download failed:", e);
      setAnalysisToast('Download failed. Please try again or re-login.');
      setTimeout(() => setAnalysisToast(null), 6000);
    }
  };

  const handleAutoTag = async (item: ContentItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!appSettings?.googleCloudToken || analyzingIds.has(item.id)) return;

    setAnalyzingIds(prev => new Set(prev).add(item.id));
    setAnalysisToast(null);

    try {
      let result;
      if (item.type === ContentType.Video) {
        result = await analyzeVideoWithIntelligence(item.fileUrl, appSettings.googleCloudToken, appSettings.googleProjectId);
      } else {
        result = await analyzeImageWithVision(item.fileUrl, appSettings.googleCloudToken, appSettings.googleProjectId);
      }
      onUpdate(item.id, { tags: result.tags, aiData: result.raw });
      setAnalysisToast(`✅ AI identified ${result.tags.length} tags: ${result.tags.slice(0, 3).join(', ')}...`);
      setTimeout(() => setAnalysisToast(null), 5000);
    } catch (error: any) {
      const isAuthError = error.message?.includes('authentication') || error.message?.includes('credential') || error.message?.includes('OAuth');
      setAnalysisToast(
        isAuthError
          ? '⚠️ AI Analysis requires a fresh login. Your session may have expired — try re-logging in from the sidebar.'
          : `⚠️ AI Analysis Error: ${error.message}`
      );
      setTimeout(() => setAnalysisToast(null), 8000);
    } finally {
      setAnalyzingIds(prev => { const next = new Set(prev); next.delete(item.id); return next; });
    }
  };

  return (
    <div className="space-y-4 relative">
      {/* Inline Toast for AI Analysis / Download feedback */}
      {analysisToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] max-w-lg animate-in slide-in-from-top-2 fade-in duration-300">
          <div className={`px-5 py-3 rounded-xl border shadow-2xl backdrop-blur-xl text-xs font-bold flex items-center gap-3
            ${analysisToast.startsWith('✅')
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}>
            <span className="flex-1">{analysisToast}</span>
            <button onClick={() => setAnalysisToast(null)} className="text-neutral-500 hover:text-white transition-colors flex-shrink-0" title="Dismiss">
              <X size={14} />
            </button>
          </div>
        </div>
      )}
      {previewItem && (
        <div className="fixed inset-0 z-[100] bg-black/98 flex items-center justify-center p-4 backdrop-blur-2xl animate-in fade-in duration-200">
          <div className="absolute top-6 right-6 flex items-center gap-4 z-50">
            <button onClick={() => handleDownload(previewItem)} className="p-3 bg-neutral-800 text-white rounded-full hover:bg-neutral-700 shadow-xl transition-all"><DownloadCloud size={24} /></button>
            <button onClick={() => setPreviewItem(null)} className="p-3 bg-white text-black rounded-full hover:bg-neutral-200 shadow-xl transition-all"><X size={24} /></button>
          </div>
          <div className="w-full h-full flex flex-col md:flex-row gap-8 items-center justify-center max-w-7xl mx-auto p-4">
            <div className="flex-1 w-full h-full flex items-center justify-center overflow-hidden relative">
              {isPreviewLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-neutral-500 bg-black/40 backdrop-blur-sm z-10">
                  <Loader2 size={48} className="animate-spin text-emerald-500" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Hydrating Media...</p>
                </div>
              )}

              {previewBlobUrl && (
                <>
                  {previewItem.type === ContentType.Image ? (
                    <img
                      src={previewBlobUrl}
                      className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                      onLoad={() => setIsPreviewLoading(false)}
                      onError={() => setIsPreviewLoading(false)}
                    />
                  ) : (
                    <video
                      src={previewBlobUrl}
                      controls
                      autoPlay
                      className="max-w-full max-h-full rounded-lg shadow-2xl"
                      onLoadedData={() => setIsPreviewLoading(false)}
                      onError={() => setIsPreviewLoading(false)}
                    />
                  )}
                </>
              )}
            </div>
            {/* Review & Metadata Sidebar */}
            <div className="w-full md:w-96 bg-neutral-900/80 p-6 rounded-2xl border border-neutral-800 backdrop-blur-md h-fit space-y-5 max-h-[80vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-white mb-1">{previewItem.title}</h3>
              <p className="text-xs text-neutral-500 uppercase font-black tracking-widest">@{previewItem.creatorName} • {new Date(previewItem.uploadDate).toLocaleDateString()}</p>

              {/* STATUS BADGE */}
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest ${CONTENT_STATUS_COLORS[previewItem.status]} border border-current/20`}>
                {previewItem.status === ContentStatus.Raw && '📦'}
                {previewItem.status === ContentStatus.Approved && '✅'}
                {previewItem.status === ContentStatus.Ready && '🟢'}
                {previewItem.status === ContentStatus.Posted && '🚀'}
                {previewItem.status === ContentStatus.Editing && '✂️'}
                {previewItem.status}
              </div>

              {/* REVIEW ACTIONS — only for Raw/Editing content */}
              {(previewItem.status === ContentStatus.Raw || previewItem.status === ContentStatus.Editing) && (
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-fuchsia-400 uppercase tracking-widest flex items-center gap-1">
                    <Eye size={12} /> Review Actions
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        onUpdate(previewItem.id, { status: ContentStatus.Approved, reviewedAt: new Date().toISOString(), reviewedBy: 'Team' });
                        setPreviewItem({ ...previewItem, status: ContentStatus.Approved });
                      }}
                      className="py-2.5 bg-emerald-500 text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all active:scale-95 flex items-center justify-center gap-1"
                    >
                      <CheckCircle size={14} /> Approve
                    </button>
                    <button
                      onClick={() => {
                        onUpdate(previewItem.id, { status: ContentStatus.Editing, reviewedAt: new Date().toISOString(), reviewedBy: 'Team' });
                        setPreviewItem({ ...previewItem, status: ContentStatus.Editing });
                      }}
                      className="py-2.5 bg-amber-500 text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-400 transition-all active:scale-95 flex items-center justify-center gap-1"
                    >
                      <Edit3 size={14} /> Needs Changes
                    </button>
                  </div>

                  {/* Team Note Input */}
                  <div>
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1 block">Review Note</label>
                    <div className="flex gap-2">
                      <input
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && reviewNote.trim()) {
                            const note = { id: crypto.randomUUID(), user: 'Team', text: reviewNote.trim(), date: new Date().toISOString() };
                            onUpdate(previewItem.id, { teamNotes: [...(previewItem.teamNotes || []), note] });
                            setPreviewItem({ ...previewItem, teamNotes: [...(previewItem.teamNotes || []), note] });
                            setReviewNote('');
                          }
                        }}
                        placeholder="Add feedback for the creator..."
                        className="flex-1 bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-fuchsia-500/50"
                      />
                      <button
                        onClick={() => {
                          if (!reviewNote.trim()) return;
                          const note = { id: crypto.randomUUID(), user: 'Team', text: reviewNote.trim(), date: new Date().toISOString() };
                          onUpdate(previewItem.id, { teamNotes: [...(previewItem.teamNotes || []), note] });
                          setPreviewItem({ ...previewItem, teamNotes: [...(previewItem.teamNotes || []), note] });
                          setReviewNote('');
                        }}
                        className="p-2 bg-fuchsia-500 text-black rounded-lg hover:bg-fuchsia-400 transition-all"
                        title="Add note"
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* EXISTING TEAM NOTES */}
              {previewItem.teamNotes && previewItem.teamNotes.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                    <MessageSquare size={10} /> Team Notes ({previewItem.teamNotes.length})
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {previewItem.teamNotes.map(note => (
                      <div key={note.id} className={`p-2.5 rounded-lg border text-xs ${note.isCreatorReply ? 'bg-purple-500/5 border-purple-500/10' : 'bg-blue-500/5 border-blue-500/10'}`}>
                        <div className="flex justify-between mb-1">
                          <span className={`text-[9px] font-bold ${note.isCreatorReply ? 'text-purple-400' : 'text-blue-400'}`}>{note.isCreatorReply ? `💬 ${note.user}` : `📣 ${note.user}`}</span>
                          <span className="text-[8px] text-neutral-600">{new Date(note.date).toLocaleDateString()}</span>
                        </div>
                        <p className="text-neutral-300">{note.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PLATFORM SELECTOR */}
              <div>
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2 block">Target Platform</label>
                <select
                  value={previewItem.platform}
                  onChange={(e) => onUpdate(previewItem.id, { platform: e.target.value as Platform })}
                  className="w-full bg-black border border-neutral-800 rounded-lg p-2 text-xs text-white uppercase font-bold focus:border-emerald-500 outline-none"
                >
                  {Object.values(Platform).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              {previewItem.tags && previewItem.tags.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2 flex items-center gap-2"><Sparkles size={12} /> AI Vision Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {previewItem.tags.map(tag => (
                      <span key={tag} className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md text-[9px] font-bold uppercase tracking-wider">{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <button onClick={(e) => handleAutoTag(previewItem, e as any)} disabled={analyzingIds.has(previewItem.id)} className="w-full py-3 bg-neutral-800 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-neutral-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {analyzingIds.has(previewItem.id) ? <Loader2 className="animate-spin" size={14} /> : <Tag size={14} />}
                  {analyzingIds.has(previewItem.id) ? 'Analyzing...' : 'Re-Analyze Media'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UPLOAD & FILTER BAR */}
      <div className="flex flex-col gap-4 bg-neutral-900/50 p-4 rounded-xl border border-neutral-800 shadow-inner">
        {/* TOP ROW: VIEW TABS */}
        {!hideTabs && (
          <div className="flex items-center gap-1 border-b border-neutral-800 pb-2">
            <button
              onClick={() => setCurrentView('Available')}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${currentView === 'Available' ? 'bg-white text-black shadow-lg shadow-white/10' : 'text-neutral-500 hover:text-white hover:bg-white/5'}`}
            >
              Available Content
            </button>
            <button
              onClick={() => setCurrentView('Used')}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${currentView === 'Used' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-neutral-500 hover:text-white hover:bg-white/5'}`}
            >
              Used Content
            </button>
            <button
              onClick={() => setCurrentView('Team')}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${currentView === 'Team' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-neutral-500 hover:text-white hover:bg-white/5'}`}
            >
              Team Content
            </button>
          </div>
        )}

        {/* BOTTOM ROW: SEARCH & TOOLS */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={14} />
              <input type="text" placeholder={`Search ${currentView} items...`} className="w-full bg-black border border-neutral-800 rounded-lg py-2 pl-9 pr-4 text-[10px] font-black uppercase tracking-widest text-white focus:border-emerald-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div className="flex bg-black border border-neutral-800 rounded-lg p-1 shrink-0">
              <button onClick={() => setTypeFilter('All')} className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded ${typeFilter === 'All' ? 'bg-white text-black' : 'text-neutral-500'}`}>All</button>
              <button onClick={() => setTypeFilter(ContentType.Video)} className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded ${typeFilter === ContentType.Video ? 'bg-white text-black' : 'text-neutral-500'}`}><Film size={12} /></button>
            </div>
          </div>

          {/* PLATFORM PICKER FOR UPLOAD */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:flex-none md:w-40">
              <select
                value={uploadPlatform}
                onChange={(e) => setUploadPlatform(e.target.value as Platform)}
                className="w-full bg-black border border-neutral-800 text-white text-[10px] font-black uppercase tracking-widest rounded-lg py-2 px-3 appearance-none focus:border-emerald-500 outline-none"
              >
                {Object.values(Platform).map(p => <option key={p} value={p}>To: {p}</option>)}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500">
                <Filter size={10} />
              </div>
            </div>

            <button onClick={() => fileInputRef.current?.click()} disabled={isUploading || isSyncing} className="bg-white text-black px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-2 hover:bg-neutral-200 transition-all active:scale-95 min-w-[140px] justify-center shadow-lg">
              {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              <span className="truncate">{isUploading ? (uploadStatus || 'Syncing...') : 'Upload'}</span>
            </button>
            <button
              onClick={handleSyncToDrive}
              disabled={isSyncing || isUploading}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 shadow-lg border ${isSyncing ? 'bg-blue-600 text-white border-blue-500 animate-pulse' : 'bg-transparent text-blue-400 border-blue-500/50 hover:bg-blue-500/10'
                }`}
              title="Sync all un-backed-up content to Google Drive"
            >
              {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <HardDrive size={14} />}
              <span className="truncate">{isSyncing ? (syncStatus || 'Syncing...') : `Sync to Drive (${items.filter(i => !i.driveBackedUp && i.fileUrl).length})`}</span>
            </button>
            <input ref={fileInputRef} type="file" multiple onChange={handleFileUpload} className="hidden" accept="image/*,video/*" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filteredItems.map(item => (
          <div key={item.id} className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden flex flex-col group hover:border-emerald-500/50 transition-all relative shadow-lg">
            <div onClick={() => { setPreviewItem(item); }} className="aspect-square bg-black relative cursor-pointer overflow-hidden flex items-center justify-center">
              {item.thumbnail ? (
                <img src={item.thumbnail} className="w-full h-full object-cover group-hover:scale-110 duration-700 ease-out" />
              ) : (
                <div className="text-neutral-700 flex flex-col items-center">
                  {item.type === ContentType.Video ? <Film size={32} /> : <ImageIcon size={32} />}
                </div>
              )}

              {/* Platform Badge Overlay */}
              <div className="absolute top-2 left-2 z-20">
                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md border backdrop-blur-md ${PLATFORM_COLORS[item.platform]} bg-opacity-80`}>
                  {PLATFORM_ICONS[item.platform]} {item.platform}
                </span>
              </div>

              {/* USED TOGGLE - Bottom Left IMPROVED */}
              <button
                onClick={(e) => { e.stopPropagation(); onUpdate(item.id, { isUsed: !item.isUsed }); }}
                className={`absolute bottom-2 left-2 z-30 p-2 rounded-lg backdrop-blur-md transition-all flex items-center gap-1.5 font-black uppercase tracking-widest text-[8px] ${item.isUsed ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-black/60 text-white hover:bg-emerald-500 hover:text-white border border-white/10'}`}
                title={item.isUsed ? "Mark Unused" : "Mark Used"}
              >
                {item.isUsed ? <CheckCircle size={12} /> : <Circle size={12} />}
                {item.isUsed ? 'Used' : 'Mark Used'}
              </button>

              {/* USED BADGE OVERLAY */}
              {item.isUsed && (
                <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
                  <div className="bg-emerald-500 text-white border-2 border-white px-4 py-1 rounded-lg transform -rotate-12 shadow-2xl">
                    <p className="text-lg font-black uppercase tracking-widest">USED</p>
                  </div>
                </div>
              )}

              {/* PENDING REVIEW BADGE */}
              {item.status === ContentStatus.Raw && !item.isUsed && (
                <div className="absolute bottom-2 right-2 z-20">
                  <span className="px-2 py-1 bg-fuchsia-500/90 text-white text-[7px] font-black uppercase tracking-widest rounded-md backdrop-blur-md animate-pulse flex items-center gap-1">
                    <Eye size={8} /> Review
                  </span>
                </div>
              )}

              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                <div className="px-3 py-1.5 bg-white text-black rounded-full font-black text-[8px] uppercase tracking-widest flex items-center gap-2">
                  <Maximize2 size={12} /> Fast Look
                </div>
              </div>

              <button
                onClick={(e) => handleAutoTag(item, e)}
                disabled={analyzingIds.has(item.id)}
                className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-emerald-500 text-white rounded-lg backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all z-30 disabled:opacity-50"
                title={item.type === ContentType.Video ? "Analyze Video Intelligence" : "Analyze with Cloud Vision"}
              >
                {analyzingIds.has(item.id) ? <Loader2 className="animate-spin" size={12} /> : <Tag size={12} />}
              </button>
            </div>
            <div className="p-3">
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-[10px] font-black text-white truncate uppercase tracking-tight max-w-[70%]">{item.title}</h4>
                <button onClick={(e) => { e.stopPropagation(); if (confirm('⚠️ Delete this content permanently?\n\nThis cannot be undone. The file will be removed from the pipeline.')) onDelete(item.id); }} className="text-neutral-700 hover:text-red-500 transition-colors" title="Delete content"><Trash2 size={12} /></button>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[8px] text-emerald-500 font-bold uppercase tracking-widest truncate">@{item.creatorName}</p>
                <select
                  value={item.status}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => { e.stopPropagation(); onUpdate(item.id, { status: e.target.value as ContentStatus }); }}
                  className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded border border-neutral-800 bg-transparent cursor-pointer hover:border-emerald-500/50 focus:outline-none transition-colors ${CONTENT_STATUS_COLORS[item.status]}`}
                >
                  {Object.values(ContentStatus).map(s => (
                    <option key={s} value={s} className="bg-black text-white">{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ContentLibrary;
