
import React, { useState, useEffect } from 'react';
import { Users, UserPlus, ShieldCheck, X, Loader2, Trash2, Mail, ShieldAlert, CheckCircle, ExternalLink, Star, Wrench, AlertTriangle, CloudCog, ArrowRight, Settings as SettingsIcon, Sheet, CalendarDays } from 'lucide-react';
import { grantTeamAccess, getProjectIAMPolicy, revokeTeamAccess, fixBucketCORS } from '../services/iamService';
import { TeamTask, AppSettings, Creator } from '../types';
import { exportCreatorsToSheet } from '../services/googleWorkspaceService';

interface TeamManagerProps {
  appSettings: AppSettings;
  onOpenSettings: () => void;
  creators?: Creator[];
  teamTasks?: TeamTask[];
  onUpdateTasks?: (tasks: TeamTask[]) => void;
  currentUser?: string;
}

const TeamManager: React.FC<TeamManagerProps> = ({ appSettings, onOpenSettings, creators = [], teamTasks = [], onUpdateTasks, currentUser = '' }) => {
  const [email, setEmail] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [teamList, setTeamList] = useState<{ email: string; roles: string[] }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string, code?: string, url?: string } | null>(null);

  const officialTeam = ['lauren@ooedn.com', 'Jenna@ooedn.com'];

  useEffect(() => {
    fetchTeam();
  }, [appSettings.googleProjectId, appSettings.googleCloudToken]);

  const fetchTeam = async () => {
    if (!appSettings.googleProjectId || !appSettings.googleCloudToken) return;
    setIsLoading(true);
    try {
      const policy = await getProjectIAMPolicy(appSettings.googleProjectId, appSettings.googleCloudToken);

      const userMap: Record<string, string[]> = {};
      policy.bindings.forEach(binding => {
        if (binding.role.includes('storage') || binding.role.includes('serviceusage') || binding.role.includes('editor') || binding.role.includes('owner')) {
          binding.members.forEach(member => {
            if (member.startsWith('user:')) {
              const email = member.replace('user:', '');
              if (!userMap[email]) userMap[email] = [];
              const roleName = binding.role.split('/').pop() || binding.role;
              if (!userMap[email].includes(roleName)) {
                userMap[email].push(roleName);
              }
            }
          });
        }
      });

      setTeamList(Object.entries(userMap).map(([email, roles]) => ({ email, roles })));
    } catch (e: any) {
      console.error("Fetch Team Error:", e);
      if (e.code === 'API_DISABLED') {
        setMessage({ type: 'error', text: e.message, code: 'API_DISABLED', url: e.url });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGrantEmail = async (targetEmail: string) => {
    if (!targetEmail.includes('@') || isProcessing) return;

    setIsProcessing(true);
    setMessage(null);
    try {
      const success = await grantTeamAccess(appSettings.googleProjectId!, appSettings.googleCloudToken!, targetEmail);
      if (success) {
        setMessage({ type: 'success', text: `${targetEmail} has been granted permanent team access.` });
        setEmail('');
        fetchTeam();
      } else {
        setMessage({ type: 'error', text: `${targetEmail} already has required permissions.` });
      }
    } catch (e: any) {
      setMessage({
        type: 'error',
        text: e.message,
        code: e.code,
        url: e.url
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeepRepair = async () => {
    if (!appSettings.googleCloudBucket || !appSettings.googleCloudToken || isRepairing) return;
    setIsRepairing(true);
    setMessage(null);
    try {
      await fixBucketCORS(appSettings.googleCloudBucket, appSettings.googleCloudToken);
      setMessage({ type: 'success', text: "Bucket CORS policies repaired. Access should now work for Lauren and Jenna." });
    } catch (e: any) {
      setMessage({
        type: 'error',
        text: e.message,
        code: e.code
      });
    } finally {
      setIsRepairing(false);
    }
  };

  const handleRevoke = async (targetEmail: string) => {
    if (!confirm(`Revoke all OOEDN cloud permissions for ${targetEmail}?`)) return;

    setIsProcessing(true);
    try {
      await revokeTeamAccess(appSettings.googleProjectId!, appSettings.googleCloudToken!, targetEmail);
      setMessage({ type: 'success', text: `Permissions revoked for ${targetEmail}.` });
      fetchTeam();
    } catch (e: any) {
      alert(`Revoke failed: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportSheets = async () => {
    if (!appSettings.googleCloudToken) return alert("Please log in.");
    try {
      const url = await exportCreatorsToSheet(creators, appSettings.googleCloudToken);
      window.open(url, '_blank');
    } catch (e: any) {
      alert(`Export Failed: ${e.message}`);
    }
  };

  const handleAddTask = (task: TeamTask) => {
    if (onUpdateTasks) onUpdateTasks([...teamTasks, task]);
  };

  const handleUpdateTask = (id: string, updates: Partial<TeamTask>) => {
    if (onUpdateTasks) onUpdateTasks(teamTasks.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const handleDeleteTask = (id: string) => {
    if (onUpdateTasks) onUpdateTasks(teamTasks.filter(t => t.id !== id));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-end">
        <button onClick={handleExportSheets} className="bg-emerald-500 hover:bg-emerald-400 text-black px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-xl transition-all">
          <Sheet size={16} /> Export Master Roster to Sheets
        </button>
      </div>
      <div className="bg-ooedn-gray border border-neutral-800 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
        <div className="absolute -right-4 -top-4 text-emerald-500/10 group-hover:text-emerald-500/20 transition-all">
          <ShieldCheck size={160} />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-white rounded-2xl shadow-lg">
              <UserPlus size={24} className="text-black" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Onboarding Hub</h2>
              <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Permanent Team Delegation Hub</p>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-black/40 p-6 rounded-2xl border border-neutral-800">
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-4">Quick Add Core Team:</p>
              <div className="flex flex-col gap-3">
                {officialTeam.map(tm => {
                  const alreadyAdded = teamList.some(u => u.email.toLowerCase() === tm.toLowerCase());
                  return (
                    <button
                      key={tm}
                      onClick={() => handleGrantEmail(tm)}
                      disabled={isProcessing || alreadyAdded}
                      className={`flex items-center justify-between gap-2 px-6 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                          ${alreadyAdded
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 cursor-default'
                          : 'bg-neutral-800 text-white border border-neutral-700 hover:bg-white hover:text-black hover:border-white shadow-xl'}
                        `}
                    >
                      <span className="flex items-center gap-2">
                        {alreadyAdded ? <CheckCircle size={14} /> : <Star size={14} className="text-yellow-500" />}
                        {tm}
                      </span>
                      {!alreadyAdded && <span className="text-[8px] bg-white/10 px-2 py-0.5 rounded">Grant Now</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-red-500/5 p-6 rounded-2xl border border-red-500/20 flex flex-col justify-between">
              <div>
                <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2 mb-2">
                  <Wrench size={14} /> Critical Access Repair
                </h4>
                <p className="text-[9px] text-neutral-500 leading-relaxed uppercase font-medium">
                  If team members can login but see "Access Denied", click the button below. This fixes the Bucket CORS policy which Google often blocks by default.
                </p>
              </div>
              <button
                onClick={handleDeepRepair}
                disabled={isRepairing}
                className="mt-6 w-full py-4 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-900/20"
              >
                {isRepairing ? <Loader2 size={16} className="animate-spin" /> : <CloudCog size={16} />}
                Repair GCS Bucket Access
              </button>
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleGrantEmail(email); }} className="flex flex-col md:flex-row gap-4 mt-10">
            <div className="flex-1 relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email to grant access..."
                className="w-full bg-black border border-neutral-800 rounded-2xl py-4 pl-12 pr-4 text-sm text-white focus:border-emerald-500 outline-none transition-all shadow-inner"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isProcessing || !email.includes('@')}
              className="bg-white text-black px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-neutral-200 transition-all shadow-xl active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
              Add Team Member
            </button>
          </form>

          {message && (
            <div className={`mt-6 p-6 rounded-2xl border flex flex-col gap-4 animate-in slide-in-from-top-2 shadow-2xl ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
              <div className="flex items-start gap-3">
                {message.type === 'success' ? <CheckCircle size={24} className="flex-shrink-0" /> : <ShieldAlert size={24} className="flex-shrink-0" />}
                <div className="flex-1">
                  <span className="text-xs font-black uppercase tracking-widest block mb-1">{message.type === 'success' ? 'Task Complete' : 'Infrastructure Blocked'}</span>
                  <p className="text-[10px] font-medium leading-relaxed opacity-80 uppercase">{message.text}</p>
                </div>
              </div>

              {message.code === 'API_DISABLED' && message.url && (
                <div className="bg-black/40 p-4 rounded-xl border border-red-500/30">
                  <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-3">ACTION REQUIRED: ENABLE GOOGLE API</p>
                  <a
                    href={message.url}
                    target="_blank"
                    className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-500 transition-all"
                  >
                    Enable Cloud Resource Manager API <ExternalLink size={12} />
                  </a>
                </div>
              )}

              {message.code === 'BUCKET_NOT_FOUND' && (
                <div className="bg-black/40 p-4 rounded-xl border border-red-500/30">
                  <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-3">ACTION REQUIRED: VERIFY BUCKET NAME</p>
                  <button
                    onClick={onOpenSettings}
                    className="inline-flex items-center gap-2 bg-neutral-800 text-white px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all"
                  >
                    <SettingsIcon size={12} /> Edit Storage Settings <ArrowRight size={12} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-ooedn-dark border border-neutral-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-neutral-800 bg-neutral-900/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users size={20} className="text-neutral-500" />
            <h3 className="text-xs font-black uppercase tracking-widest text-white">Active Cloud Permissions</h3>
          </div>
          <a href="https://console.cloud.google.com/iam-admin/iam" target="_blank" className="text-[10px] font-black text-neutral-500 hover:text-white flex items-center gap-1 uppercase transition-all">
            Console <ExternalLink size={12} />
          </a>
        </div>

        {isLoading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4">
            <Loader2 size={40} className="animate-spin text-neutral-700" />
            <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">Querying IAM Metadata...</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-800">
            {teamList.length > 0 ? teamList.map((user, idx) => (
              <div key={idx} className="p-6 flex items-center justify-between hover:bg-white/[0.02] transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500 font-black">
                    {user.email[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-black text-white uppercase tracking-tighter">{user.email}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {user.roles.map(r => (
                        <span key={r} className="text-[8px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full border border-emerald-500/20 font-black uppercase tracking-widest">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                {!officialTeam.includes(user.email) && user.roles.every(r => r !== 'owner') && (
                  <button
                    onClick={() => handleRevoke(user.email)}
                    disabled={isProcessing}
                    className="p-3 text-neutral-700 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/20 opacity-0 group-hover:opacity-100 disabled:opacity-0"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
              </div>
            )) : (
              <div className="p-20 text-center">
                <p className="text-[10px] font-black text-neutral-700 uppercase tracking-widest italic">No external members detected in project.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* TASK BOARD */}
      <div className="bg-ooedn-dark border border-neutral-800 rounded-[2.5rem] overflow-hidden shadow-2xl p-8">
        <h3 className="text-xl font-black uppercase tracking-tighter text-white mb-6">Team Task Board</h3>

        <div className="flex gap-4 mb-6 overflow-x-auto pb-4 custom-scrollbar">
          {['Pending', 'In Progress', 'Done'].map(status => (
            <div key={status} className="min-w-[300px] flex-1 bg-neutral-900/50 rounded-2xl p-4 border border-neutral-800">
              <h4 className={`text-xs font-black uppercase tracking-widest mb-4 flex items-center justify-between ${status === 'Done' ? 'text-emerald-500' : 'text-neutral-400'}`}>
                {status}
                <span className="bg-neutral-800 text-white px-2 py-0.5 rounded-full text-[9px]">{teamTasks.filter(t => t.status === status).length}</span>
              </h4>
              <div className="space-y-3">
                {teamTasks.filter(t => t.status === status).map(task => (
                  <div key={task.id} className="bg-black border border-neutral-800 p-4 rounded-xl group hover:border-emerald-500/50 transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[9px] bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded uppercase tracking-widest font-bold">{task.assignedTo}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {status !== 'Done' && <button onClick={() => handleUpdateTask(task.id, { status: 'Done' })} className="p-1 hover:text-emerald-500"><CheckCircle size={14} /></button>}
                        <button onClick={() => handleDeleteTask(task.id)} className="p-1 hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-white mb-1">{task.title}</p>
                    {task.dueDate && <p className="text-[10px] text-neutral-500 flex items-center gap-1"><CalendarDays size={10} /> {new Date(task.dueDate).toLocaleDateString()}</p>}

                    {status !== 'Done' && (
                      <div className="mt-3 flex gap-2">
                        {status === 'Pending' && <button onClick={() => handleUpdateTask(task.id, { status: 'In Progress' })} className="text-[8px] bg-blue-500/10 text-blue-500 px-2 py-1 rounded uppercase tracking-widest hover:bg-blue-500/20">Start</button>}
                      </div>
                    )}
                  </div>
                ))}
                {status === 'Pending' && (
                  <button
                    onClick={() => {
                      const title = prompt("New Task:");
                      const assignee = prompt("Assign to (email):", "lauren@ooedn.com");
                      if (title && assignee) handleAddTask({
                        id: crypto.randomUUID(),
                        title,
                        assignedTo: assignee,
                        assignedBy: currentUser,
                        status: 'Pending',
                        dueDate: new Date().toISOString()
                      });
                    }}
                    className="w-full py-3 border border-dashed border-neutral-800 rounded-xl text-neutral-500 text-[10px] font-black uppercase tracking-widest hover:border-emerald-500 hover:text-emerald-500 transition-all"
                  >
                    + Add Task
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TeamManager;
