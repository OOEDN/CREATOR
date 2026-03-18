import React, { useState } from 'react';
import {
    GraduationCap, ArrowRight, ArrowLeft, CheckCircle, Truck, Package,
    Users, Upload, MessageSquare, DollarSign, Star, AlertTriangle,
    Rocket, BookOpen, X
} from 'lucide-react';

interface AdminTrainingCourseProps {
    userName: string;
    onComplete: () => void;
}

interface QuizQuestion {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
}

const LESSONS = [
    {
        emoji: '👋',
        title: 'Welcome to OOEDN Tracker',
        subtitle: 'Your quick training course',
    },
    {
        emoji: '📋',
        title: 'The Creator Roster',
        subtitle: 'Managing creators correctly',
    },
    {
        emoji: '🚚',
        title: 'Shipping & Tracking',
        subtitle: 'How shipments work',
    },
    {
        emoji: '📹',
        title: 'Content & Review',
        subtitle: 'Handling creator uploads',
    },
    {
        emoji: '💰',
        title: 'Payments',
        subtitle: 'Payment status flow',
    },
    {
        emoji: '⚠️',
        title: 'Common Mistakes',
        subtitle: 'What NOT to do',
    },
    {
        emoji: '📝',
        title: 'Quick Quiz',
        subtitle: 'Test your knowledge',
    },
    {
        emoji: '🎓',
        title: 'Training Complete!',
        subtitle: 'You\'re ready to go',
    },
];

const QUIZ_QUESTIONS: QuizQuestion[] = [
    {
        question: 'When you add a tracking number to a shipment, what happens automatically?',
        options: [
            'Nothing, you have to change the status manually',
            'The status auto-changes to "In Transit"',
            'The shipment gets deleted',
            'An email is sent to the creator',
        ],
        correctIndex: 1,
        explanation: 'When you type/paste a tracking number (4+ characters), the status automatically updates to "In Transit". No need to change the dropdown manually!',
    },
    {
        question: 'To open a creator\'s full profile and edit their details, you should:',
        options: [
            'Double-click their name in the list',
            'Click on their card in the roster to open the edit modal',
            'Right-click and select "Edit"',
            'Go to Settings and find their name',
        ],
        correctIndex: 1,
        explanation: 'Click any creator card in the roster to open their full profile modal where you can edit all their details, manage shipments, and view content.',
    },
    {
        question: 'Where do you go to see ONLY creators who need shipping attention?',
        options: [
            'Click "Active Roster" in the sidebar',
            'Type "shipping" in the search bar',
            'Click the "shipments need attention" badge on the Dashboard',
            'Go to the Payments section',
        ],
        correctIndex: 2,
        explanation: 'The Dashboard shows a "shipments need attention" badge. Clicking it filters the roster to show ONLY creators with pending/issue shipments.',
    },
    {
        question: 'What should you NEVER do when editing creator data?',
        options: [
            'Update their handle or notes',
            'Accidentally delete a creator instead of updating them',
            'Add a new shipment to their profile',
            'Change their payment status',
        ],
        correctIndex: 1,
        explanation: 'Deleting a creator removes them permanently. Always double-check before using any destructive actions. If you need to temporarily remove someone, use the Reachout feature instead.',
    },
    {
        question: 'When a creator submits content for review, you should:',
        options: [
            'Delete it and ask them to re-upload',
            'Ignore it until the campaign is over',
            'Review it in Pending Review, then Approve or Request Changes',
            'Download it and email it to the team',
        ],
        correctIndex: 2,
        explanation: 'Go to Pending Review to see all creator submissions. You can Approve content (marks it ready) or Request Changes (sends a revision note back to the creator).',
    },
];

const AdminTrainingCourse: React.FC<AdminTrainingCourseProps> = ({ userName, onComplete }) => {
    const [step, setStep] = useState(0);
    const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
    const [quizSubmitted, setQuizSubmitted] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);

    const progress = ((step + 1) / LESSONS.length) * 100;

    const allQuizCorrect = QUIZ_QUESTIONS.every((q, i) => quizAnswers[i] === q.correctIndex);
    const quizScore = QUIZ_QUESTIONS.filter((q, i) => quizAnswers[i] === q.correctIndex).length;

    const handleNext = () => {
        if (step < LESSONS.length - 1) {
            setStep(step + 1);
            if (step === LESSONS.length - 2) {
                setShowConfetti(true);
                setTimeout(() => setShowConfetti(false), 4000);
            }
        }
    };

    const canProceed = () => {
        // Quiz step: must answer all and score at least 4/5
        if (step === 6) {
            return quizSubmitted && quizScore >= 4;
        }
        return true;
    };

    return (
        <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center p-4 overflow-y-auto">
            {/* Background */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-900/15 via-black to-black" />
            <div className="absolute top-1/4 left-1/3 w-80 h-80 bg-emerald-500/8 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-1/3 right-1/4 w-60 h-60 bg-blue-500/8 rounded-full blur-[100px] animate-pulse" />

            {/* Confetti */}
            {showConfetti && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
                    {Array.from({ length: 60 }).map((_, i) => {
                        const colors = ['#10b981', '#3b82f6', '#f59e0b', '#a855f7', '#f472b6', '#60a5fa'];
                        const style: React.CSSProperties = {
                            left: `${Math.random() * 100}%`,
                            top: '-10px',
                            width: `${6 + Math.random() * 8}px`,
                            height: `${6 + Math.random() * 8}px`,
                            backgroundColor: colors[Math.floor(Math.random() * colors.length)],
                            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                            animationDelay: `${Math.random() * 2}s`,
                            animationDuration: `${2 + Math.random() * 2}s`,
                        };
                        return <div key={i} className="absolute animate-training-confetti" style={style} />;
                    })}
                    <style>{`
                        @keyframes training-confetti {
                            0% { transform: translateY(0) rotate(0deg); opacity: 1; }
                            100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
                        }
                        .animate-training-confetti { animation: training-confetti 3s ease-in forwards; }
                    `}</style>
                </div>
            )}

            <div className="z-10 w-full max-w-xl my-8">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <GraduationCap size={20} className="text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-xs font-black text-emerald-400 uppercase tracking-widest">OOEDN Training</p>
                        <p className="text-[10px] text-neutral-500">Required before using the tracker</p>
                    </div>
                </div>

                {/* Progress */}
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                            Lesson {step + 1} of {LESSONS.length}
                        </span>
                        <span className="text-[10px] font-black text-emerald-400 uppercase">
                            {LESSONS[step].title}
                        </span>
                    </div>
                    <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Content Card */}
                <div className="bg-neutral-900/70 border border-neutral-800 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl max-h-[70vh] overflow-y-auto">

                    {/* LESSON 0: Welcome */}
                    {step === 0 && (
                        <div className="text-center space-y-5">
                            <div className="text-5xl mb-2">👋</div>
                            <h2 className="text-2xl font-black text-white uppercase tracking-tight">
                                Hey {userName}!
                            </h2>
                            <p className="text-neutral-400 text-sm leading-relaxed">
                                Before you start using the OOEDN Tracker, you need to complete this
                                <span className="text-emerald-400 font-bold"> quick training course</span>.
                                It takes about 3 minutes.
                            </p>
                            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-left">
                                <p className="text-xs text-amber-400 font-bold flex items-center gap-2 mb-2">
                                    <AlertTriangle size={14} /> Why is this important?
                                </p>
                                <p className="text-xs text-neutral-400 leading-relaxed">
                                    This app manages real creator data, shipments, and payments.
                                    Incorrect actions can cause data issues that affect the entire team.
                                    This training ensures everyone knows the correct workflows.
                                </p>
                            </div>
                            <div className="text-left space-y-2">
                                <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">What you'll learn:</p>
                                {[
                                    { emoji: '📋', text: 'How to navigate and manage the creator roster' },
                                    { emoji: '🚚', text: 'How shipping and tracking works' },
                                    { emoji: '📹', text: 'How to review and approve content' },
                                    { emoji: '💰', text: 'How payments flow through the system' },
                                    { emoji: '⚠️', text: 'Common mistakes and how to avoid them' },
                                ].map(item => (
                                    <div key={item.text} className="flex items-center gap-2 text-xs text-neutral-400 bg-black/30 rounded-lg px-3 py-2">
                                        <span>{item.emoji}</span>
                                        <span>{item.text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* LESSON 1: Creator Roster */}
                    {step === 1 && (
                        <div className="space-y-5">
                            <div className="text-center mb-2">
                                <div className="text-4xl mb-2">📋</div>
                                <h2 className="text-2xl font-black text-white">The Creator Roster</h2>
                            </div>
                            <div className="space-y-3">
                                {[
                                    {
                                        icon: <Users size={16} className="text-emerald-400" />,
                                        title: 'Active Roster',
                                        desc: 'Shows all active creators. Click any card to open their full profile with shipments, content, comms, and payment info.',
                                    },
                                    {
                                        icon: <Star size={16} className="text-blue-400" />,
                                        title: 'Searching & Filtering',
                                        desc: 'Use the search bar at the top to find creators by name or handle. The Dashboard badges filter to specific views (e.g., pending shipments).',
                                    },
                                    {
                                        icon: <AlertTriangle size={16} className="text-amber-400" />,
                                        title: '⚠️ IMPORTANT: Never Delete Accidentally',
                                        desc: 'Deleting a creator is PERMANENT. If you need to temporarily remove someone, use the Reachout feature instead. Double-check before clicking any red buttons.',
                                    },
                                ].map(item => (
                                    <div key={item.title} className="flex gap-3 bg-black/30 border border-neutral-800/50 rounded-xl p-4">
                                        <div className="mt-0.5 flex-shrink-0">{item.icon}</div>
                                        <div>
                                            <p className="text-xs font-bold text-white">{item.title}</p>
                                            <p className="text-[10px] text-neutral-500 leading-relaxed mt-1">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* LESSON 2: Shipping */}
                    {step === 2 && (
                        <div className="space-y-5">
                            <div className="text-center mb-2">
                                <div className="text-4xl mb-2">🚚</div>
                                <h2 className="text-2xl font-black text-white">Shipping & Tracking</h2>
                            </div>
                            <div className="space-y-3">
                                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                                    <p className="text-xs font-bold text-emerald-400 flex items-center gap-2 mb-2">
                                        <CheckCircle size={14} /> New: Auto-Detect
                                    </p>
                                    <p className="text-xs text-neutral-400 leading-relaxed">
                                        When you paste or type a tracking number into the tracking field, the status
                                        <span className="text-emerald-400 font-bold"> automatically changes to "In Transit"</span>.
                                        You do NOT need to manually change the status dropdown. Just enter the tracking number and hit Save.
                                    </p>
                                </div>
                                {[
                                    {
                                        icon: <Package size={16} className="text-amber-400" />,
                                        title: 'Preparing → In Transit → Delivered',
                                        desc: 'Shipments start as "Preparing". Once you add a tracking number, they auto-switch to "In Transit". Mark as "Delivered" when the package arrives.',
                                    },
                                    {
                                        icon: <Truck size={16} className="text-blue-400" />,
                                        title: 'Finding Pending Shipments',
                                        desc: 'Click "shipments need attention" on the Dashboard. This shows ONLY creators who have packages in Preparing or Issue status.',
                                    },
                                    {
                                        icon: <AlertTriangle size={16} className="text-red-400" />,
                                        title: '⚠️ Don\'t Delete Shipments',
                                        desc: 'Removing a shipment is permanent. If there\'s an issue, use the "Shipping Issue" status instead.',
                                    },
                                ].map(item => (
                                    <div key={item.title} className="flex gap-3 bg-black/30 border border-neutral-800/50 rounded-xl p-4">
                                        <div className="mt-0.5 flex-shrink-0">{item.icon}</div>
                                        <div>
                                            <p className="text-xs font-bold text-white">{item.title}</p>
                                            <p className="text-[10px] text-neutral-500 leading-relaxed mt-1">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* LESSON 3: Content & Review */}
                    {step === 3 && (
                        <div className="space-y-5">
                            <div className="text-center mb-2">
                                <div className="text-4xl mb-2">📹</div>
                                <h2 className="text-2xl font-black text-white">Content & Review</h2>
                            </div>
                            <div className="space-y-3">
                                {[
                                    {
                                        icon: <Upload size={16} className="text-purple-400" />,
                                        title: 'Creator Submissions',
                                        desc: 'When creators upload content through their portal, it appears in the "Pending Review" section. The Dashboard badge shows how many items need review.',
                                    },
                                    {
                                        icon: <CheckCircle size={16} className="text-emerald-400" />,
                                        title: 'Approve or Request Changes',
                                        desc: 'Click on a submission to review it. You can Approve (marks content as ready) or Request Changes (sends a note back to the creator for revisions).',
                                    },
                                    {
                                        icon: <MessageSquare size={16} className="text-blue-400" />,
                                        title: 'Review Notes',
                                        desc: 'Add detailed notes when requesting changes so the creator knows exactly what to fix. Notes are visible to both the team and the creator.',
                                    },
                                ].map(item => (
                                    <div key={item.title} className="flex gap-3 bg-black/30 border border-neutral-800/50 rounded-xl p-4">
                                        <div className="mt-0.5 flex-shrink-0">{item.icon}</div>
                                        <div>
                                            <p className="text-xs font-bold text-white">{item.title}</p>
                                            <p className="text-[10px] text-neutral-500 leading-relaxed mt-1">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* LESSON 4: Payments */}
                    {step === 4 && (
                        <div className="space-y-5">
                            <div className="text-center mb-2">
                                <div className="text-4xl mb-2">💰</div>
                                <h2 className="text-2xl font-black text-white">Payments</h2>
                            </div>
                            <div className="space-y-3">
                                {[
                                    {
                                        icon: <DollarSign size={16} className="text-emerald-400" />,
                                        title: 'Payment Statuses',
                                        desc: 'Unpaid → Processing → Paid. When a creator requests payment, it enters "Processing". Once sent, mark as "Paid" and record the amount.',
                                    },
                                    {
                                        icon: <BookOpen size={16} className="text-blue-400" />,
                                        title: 'Payment Records',
                                        desc: 'Always record the payment amount and method when marking as Paid. This keeps financial records accurate for the team.',
                                    },
                                    {
                                        icon: <AlertTriangle size={16} className="text-amber-400" />,
                                        title: '⚠️ Don\'t Change Payment Status Without Authorization',
                                        desc: 'Only change payment status when a payment is actually being processed or has been sent. Incorrect status changes cause confusion.',
                                    },
                                ].map(item => (
                                    <div key={item.title} className="flex gap-3 bg-black/30 border border-neutral-800/50 rounded-xl p-4">
                                        <div className="mt-0.5 flex-shrink-0">{item.icon}</div>
                                        <div>
                                            <p className="text-xs font-bold text-white">{item.title}</p>
                                            <p className="text-[10px] text-neutral-500 leading-relaxed mt-1">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* LESSON 5: Common Mistakes */}
                    {step === 5 && (
                        <div className="space-y-5">
                            <div className="text-center mb-2">
                                <div className="text-4xl mb-2">⚠️</div>
                                <h2 className="text-2xl font-black text-white">Common Mistakes</h2>
                                <p className="text-neutral-500 text-xs mt-1">Things to avoid</p>
                            </div>
                            <div className="space-y-3">
                                {[
                                    {
                                        bad: '❌ Deleting creators instead of archiving',
                                        good: '✅ Use Reachout to temporarily remove, or Archive to make inactive',
                                        severity: 'border-red-500/30 bg-red-500/5',
                                    },
                                    {
                                        bad: '❌ Manually changing shipment status when adding tracking',
                                        good: '✅ Just paste the tracking number — status changes automatically',
                                        severity: 'border-amber-500/30 bg-amber-500/5',
                                    },
                                    {
                                        bad: '❌ Leaving the search bar filled when navigating',
                                        good: '✅ Clear the search bar to see all creators. Old searches can hide people.',
                                        severity: 'border-amber-500/30 bg-amber-500/5',
                                    },
                                    {
                                        bad: '❌ Editing a creator\'s data without checking if it synced',
                                        good: '✅ Look for the green "Saved" indicator in the sidebar. If it\'s yellow/red, wait for sync.',
                                        severity: 'border-amber-500/30 bg-amber-500/5',
                                    },
                                    {
                                        bad: '❌ Changing payment status before money is actually sent',
                                        good: '✅ Only mark as "Paid" after confirming the payment was processed',
                                        severity: 'border-red-500/30 bg-red-500/5',
                                    },
                                ].map((item, i) => (
                                    <div key={i} className={`border rounded-xl p-4 ${item.severity}`}>
                                        <p className="text-xs text-red-400 font-bold">{item.bad}</p>
                                        <p className="text-xs text-emerald-400 font-bold mt-1.5">{item.good}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* LESSON 6: Quiz */}
                    {step === 6 && (
                        <div className="space-y-5">
                            <div className="text-center mb-2">
                                <div className="text-4xl mb-2">📝</div>
                                <h2 className="text-2xl font-black text-white">Quick Quiz</h2>
                                <p className="text-neutral-500 text-xs mt-1">Score at least 4/5 to continue</p>
                            </div>
                            <div className="space-y-6">
                                {QUIZ_QUESTIONS.map((q, qi) => (
                                    <div key={qi} className="space-y-2">
                                        <p className="text-xs font-bold text-white">
                                            {qi + 1}. {q.question}
                                        </p>
                                        <div className="space-y-1.5">
                                            {q.options.map((opt, oi) => {
                                                const isSelected = quizAnswers[qi] === oi;
                                                const isCorrect = oi === q.correctIndex;
                                                const showResult = quizSubmitted;

                                                let borderColor = 'border-neutral-800';
                                                let bgColor = 'bg-black/30';
                                                if (isSelected && !showResult) {
                                                    borderColor = 'border-blue-500/50';
                                                    bgColor = 'bg-blue-500/5';
                                                }
                                                if (showResult && isCorrect) {
                                                    borderColor = 'border-emerald-500/50';
                                                    bgColor = 'bg-emerald-500/5';
                                                }
                                                if (showResult && isSelected && !isCorrect) {
                                                    borderColor = 'border-red-500/50';
                                                    bgColor = 'bg-red-500/5';
                                                }

                                                return (
                                                    <button
                                                        key={oi}
                                                        onClick={() => !quizSubmitted && setQuizAnswers(prev => ({ ...prev, [qi]: oi }))}
                                                        disabled={quizSubmitted}
                                                        className={`w-full text-left px-3 py-2.5 rounded-lg border ${borderColor} ${bgColor} text-[11px] text-neutral-300 transition-all hover:border-neutral-600 disabled:cursor-default flex items-start gap-2`}
                                                    >
                                                        <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-neutral-700'}`}>
                                                            {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                                        </span>
                                                        <span>{opt}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {quizSubmitted && (
                                            <p className={`text-[10px] px-3 py-1.5 rounded-lg ${quizAnswers[qi] === q.correctIndex ? 'text-emerald-400 bg-emerald-500/5' : 'text-amber-400 bg-amber-500/5'}`}>
                                                {q.explanation}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {!quizSubmitted ? (
                                <button
                                    onClick={() => setQuizSubmitted(true)}
                                    disabled={Object.keys(quizAnswers).length < QUIZ_QUESTIONS.length}
                                    className="w-full bg-gradient-to-r from-emerald-500 to-blue-500 text-black py-3 rounded-xl font-black uppercase tracking-widest text-xs disabled:opacity-30 hover:from-emerald-400 hover:to-blue-400 transition-all active:scale-95"
                                >
                                    Submit Quiz
                                </button>
                            ) : (
                                <div className={`text-center p-4 rounded-xl border ${quizScore >= 4 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                                    <p className={`text-lg font-black ${quizScore >= 4 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {quizScore}/{QUIZ_QUESTIONS.length}
                                    </p>
                                    <p className="text-xs text-neutral-400 mt-1">
                                        {quizScore >= 4
                                            ? '🎉 Great job! You passed! Click Next to finish.'
                                            : '⚠️ You need at least 4/5 to continue. Review the lessons and try again.'}
                                    </p>
                                    {quizScore < 4 && (
                                        <button
                                            onClick={() => { setQuizSubmitted(false); setQuizAnswers({}); setStep(0); }}
                                            className="mt-3 text-xs text-blue-400 hover:text-blue-300 font-bold underline"
                                        >
                                            Review Lessons Again →
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* LESSON 7: Complete */}
                    {step === 7 && (
                        <div className="text-center space-y-5">
                            <div className="text-5xl mb-2">🎓</div>
                            <h2 className="text-2xl font-black text-white uppercase tracking-tight">
                                Training Complete!
                            </h2>
                            <p className="text-neutral-400 text-sm leading-relaxed">
                                Great work, {userName}! You've completed the OOEDN Tracker training.
                                Here's your quick reference:
                            </p>
                            <div className="space-y-2 text-left">
                                {[
                                    { emoji: '🚚', tip: 'Paste tracking number → status auto-updates. Just save.' },
                                    { emoji: '📋', tip: 'Click creator cards to open their full profile.' },
                                    { emoji: '📊', tip: 'Dashboard badges are shortcuts to filtered views.' },
                                    { emoji: '⚠️', tip: 'Never delete — use Reachout or Archive instead.' },
                                    { emoji: '💾', tip: 'Check the green sync dot before closing the app.' },
                                ].map(item => (
                                    <div key={item.tip} className="flex items-start gap-2 bg-emerald-500/5 border border-emerald-500/15 rounded-lg px-3 py-2">
                                        <span className="mt-0.5">{item.emoji}</span>
                                        <p className="text-xs text-neutral-300">{item.tip}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Navigation */}
                    <div className="flex items-center justify-between mt-6 pt-5 border-t border-neutral-800">
                        {step > 0 ? (
                            <button onClick={() => setStep(step - 1)} className="flex items-center gap-2 text-neutral-500 hover:text-white text-xs font-bold transition-colors">
                                <ArrowLeft size={14} /> Back
                            </button>
                        ) : <div />}

                        {step === 7 ? (
                            <button onClick={onComplete}
                                className="bg-gradient-to-r from-emerald-500 to-blue-500 text-black px-8 py-3 rounded-xl font-black uppercase tracking-widest text-sm flex items-center gap-2 hover:from-emerald-400 hover:to-blue-400 transition-all shadow-xl shadow-emerald-500/20 active:scale-95">
                                <Rocket size={16} /> Start Using Tracker
                            </button>
                        ) : (
                            <button onClick={handleNext}
                                disabled={!canProceed()}
                                className="bg-gradient-to-r from-emerald-500 to-blue-500 text-black px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center gap-2 hover:from-emerald-400 hover:to-blue-400 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed">
                                <ArrowRight size={14} /> Next
                            </button>
                        )}
                    </div>
                </div>

                {/* Step Dots */}
                <div className="flex items-center justify-center gap-2 mt-4">
                    {LESSONS.map((s, i) => (
                        <button
                            key={i}
                            onClick={() => i <= step && setStep(i)}
                            className={`transition-all rounded-full ${i === step ? 'w-8 h-2 bg-gradient-to-r from-emerald-500 to-blue-500' :
                                i < step ? 'w-2 h-2 bg-emerald-500/50' :
                                    'w-2 h-2 bg-neutral-800'
                                }`}
                            title={s.title}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AdminTrainingCourse;
