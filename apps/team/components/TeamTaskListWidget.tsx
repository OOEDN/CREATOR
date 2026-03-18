import React from 'react';
import { CheckCircle, Clock, Plus, Target } from 'lucide-react';
import { TeamTask } from '../../../shared/types';

interface TeamTaskListWidgetProps {
    tasks: TeamTask[];
    currentUser: string;
    onUpdateTask: (taskId: string, updates: Partial<TeamTask>) => void;
    onViewAll: () => void;
    onAddTask: (task: TeamTask) => void;
}

const TeamTaskListWidget: React.FC<TeamTaskListWidgetProps> = ({ tasks, currentUser, onUpdateTask, onViewAll, onAddTask }) => {
    // Filter tasks assigned to current user (case-insensitive check) and not done
    const myTasks = tasks.filter(t =>
        t.assignedTo.toLowerCase() === currentUser.toLowerCase() &&
        t.status !== 'Done'
    ).sort((a, b) => {
        // Sort by due date if available, otherwise created order (by id usually)
        if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        return 0;
    });

    const pendingCount = myTasks.length;

    return (
        <div className="bg-ooedn-gray border border-neutral-800 rounded-3xl p-6 flex flex-col h-[400px] shadow-2xl relative overflow-hidden">
            <div className="flex justify-between items-center mb-4 border-b border-neutral-800 pb-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                    <Target size={16} className="text-purple-500" /> My Tasks
                </h3>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${pendingCount > 0 ? 'bg-purple-500 text-white' : 'bg-neutral-900 text-neutral-500'}`}>
                    {pendingCount} Pending
                </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                {myTasks.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-neutral-600 space-y-2 opacity-50">
                        <CheckCircle size={24} />
                        <p className="text-xs font-bold uppercase">All Caught Up</p>
                    </div>
                )}
                {myTasks.map(task => (
                    <div key={task.id} className="bg-black/40 border border-neutral-800/50 rounded-xl p-3 hover:border-purple-500/30 transition-all group">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-xs font-bold text-white mb-0.5 line-clamp-2">{task.title}</p>
                            <button
                                onClick={() => onUpdateTask(task.id, { status: 'Done' })}
                                className="text-neutral-600 hover:text-emerald-500 transition-colors p-1"
                                title="Mark Complete"
                            >
                                <CheckCircle size={14} />
                            </button>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                            <span className={`text-[8px] px-2 py-0.5 rounded border uppercase font-black tracking-wider ${task.status === 'In Progress' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' : 'text-neutral-400 bg-neutral-900 border-neutral-800'}`}>
                                {task.status}
                            </span>
                            {task.dueDate && (
                                <span className="text-[9px] text-neutral-500 flex items-center gap-1">
                                    <Clock size={10} /> {new Date(task.dueDate).toLocaleDateString()}
                                </span>
                            )}
                        </div>

                        {task.status === 'Pending' && (
                            <button
                                onClick={() => onUpdateTask(task.id, { status: 'In Progress' })}
                                className="w-full mt-2 py-1 bg-neutral-900 text-[8px] font-black uppercase tracking-widest text-neutral-500 hover:text-blue-500 hover:bg-blue-500/10 rounded transition-all"
                            >
                                Start Task
                            </button>
                        )}
                    </div>
                ))}
            </div>

            <div className="mt-4 flex gap-2">
                <button
                    onClick={() => {
                        const title = prompt("Task Title:");
                        const assignee = prompt("Assign to (email):", "lauren@ooedn.com");
                        if (title && assignee) {
                            onAddTask({
                                id: crypto.randomUUID(),
                                title,
                                assignedTo: assignee,
                                assignedBy: currentUser,
                                status: 'Pending',
                                dueDate: new Date().toISOString()
                            });
                        }
                    }}
                    className="flex-1 py-3 bg-neutral-900 text-emerald-500 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-neutral-800 hover:text-emerald-400 transition-all flex items-center justify-center gap-2"
                >
                    + Add Task
                </button>
                <button onClick={onViewAll} className="flex-1 py-3 bg-neutral-900 text-neutral-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-neutral-800 hover:text-white transition-all flex items-center justify-center gap-2">
                    Manage All <Plus size={12} />
                </button>
            </div>
        </div>
    );
};

export default TeamTaskListWidget;
