import React, { useState } from 'react';
import {
    Creator, CreatorAccount, PaymentMethod, Platform
} from '../../types';
import {
    Sparkles, ArrowRight, ArrowLeft, CreditCard, Bell, User,
    CheckCircle, Rocket, Flame, FlaskConical, PartyPopper, Lock, Eye, EyeOff, Shield
} from 'lucide-react';

interface Props {
    account: CreatorAccount;
    creator: Creator;
    onComplete: () => void;
    onUpdateProfile: (updates: Partial<Creator>) => void;
    onEnableNotifications: () => void;
    onChangePassword?: (newPassword: string) => Promise<boolean>;
}

const STEPS = [
    { emoji: '🎉', title: 'Welcome to OOEDN!' },
    { emoji: '🔒', title: 'Secure Your Account' },
    { emoji: '👤', title: 'Your Profile' },
    { emoji: '💰', title: 'Get Paid' },
    { emoji: '🔔', title: 'Stay in the Loop' },
    { emoji: '🧪', title: 'Beta Lab' },
    { emoji: '🚀', title: "You're All Set!" },
];

const RELEASE_TEXT = `OOEDN BETA TESTING AGREEMENT

By opting into the OOEDN Beta Testing Program, you agree to the following terms:

1. CONFIDENTIALITY — All beta products, samples, and pre-release materials are confidential. You may not share, photograph, or discuss beta items publicly until the team-confirmed embargo date.

2. CONTENT POSTING — Any content created about beta products (photos, videos, reviews, social media posts) may ONLY be published after the confirmed post date provided by the OOEDN team. Posting before this date is a violation of this agreement.

3. TEAM APPROVAL — All beta-related content must be reviewed and approved by the OOEDN team before posting. Submit your content through the Creator Portal for review.

4. HONEST FEEDBACK — You agree to provide honest, constructive feedback on all beta products. Your reviews help us improve our products before launch.

5. SAMPLE RETURN — Beta samples remain the property of OOEDN until the team confirms you may keep them. Some samples may need to be returned after testing.

6. TERMINATION — OOEDN reserves the right to remove you from the beta program at any time if these terms are violated.

By clicking "I Agree," you acknowledge that you have read, understood, and agree to abide by these terms.`;

const CreatorOnboarding: React.FC<Props> = ({ account, creator, onComplete, onUpdateProfile, onEnableNotifications, onChangePassword }) => {
    const [step, setStep] = useState(0);
    const [name, setName] = useState(creator.name || account.displayName || '');
    const [handle, setHandle] = useState(creator.handle || '');
    const [platform, setPlatform] = useState(creator.platform || Platform.Instagram);
    const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null);
    const [paymentDetails, setPaymentDetails] = useState('');
    const [betaOptIn, setBetaOptIn] = useState(false);
    const [releaseAgreed, setReleaseAgreed] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    // Password change
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPw, setShowNewPw] = useState(false);
    const [pwSaved, setPwSaved] = useState(false);
    const [pwError, setPwError] = useState('');

    const progress = ((step + 1) / STEPS.length) * 100;

    const handleNext = () => {
        // Save profile data on step 2
        if (step === 2 && (name || handle)) {
            onUpdateProfile({ name, handle, platform });
        }
        // Save payment on step 3
        if (step === 3 && selectedPayment && paymentDetails) {
            onUpdateProfile({
                paymentOptions: [
                    ...(creator.paymentOptions || []),
                    { method: selectedPayment, details: paymentDetails }
                ]
            });
        }
        if (step < STEPS.length - 1) {
            setStep(step + 1);
            if (step === STEPS.length - 2) {
                setShowConfetti(true);
                setTimeout(() => setShowConfetti(false), 4000);
            }
        }
    };

    const handleFinish = () => {
        onComplete();
    };

    const paymentMethods = [
        { method: PaymentMethod.Venmo, emoji: '💙', label: 'Venmo', placeholder: '@username' },
        { method: PaymentMethod.PayPal, emoji: '💛', label: 'PayPal', placeholder: 'your@email.com' },
        { method: PaymentMethod.Zelle, emoji: '💜', label: 'Zelle', placeholder: 'Phone or email' },
        { method: PaymentMethod.Bank, emoji: '🏦', label: 'Bank', placeholder: 'Account details' },
    ];

    const platforms = [
        { id: Platform.Instagram, emoji: '📸', label: 'Instagram' },
        { id: Platform.TikTok, emoji: '🎵', label: 'TikTok' },
        { id: Platform.YouTube, emoji: '🎬', label: 'YouTube' },
        { id: Platform.Twitter, emoji: '🐦', label: 'Twitter' },
    ];

    return (
        <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center p-4">
            {/* Background effects */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-black to-black" />
            <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-1/3 right-1/4 w-60 h-60 bg-pink-500/10 rounded-full blur-[100px] animate-pulse" />

            {/* Confetti */}
            {showConfetti && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
                    {Array.from({ length: 60 }).map((_, i) => {
                        const colors = ['#a855f7', '#facc15', '#34d399', '#f472b6', '#60a5fa', '#fb923c'];
                        const confettiStyle: React.CSSProperties = {
                            left: `${Math.random() * 100}%`,
                            top: '-10px',
                            width: `${6 + Math.random() * 8}px`,
                            height: `${6 + Math.random() * 8}px`,
                            backgroundColor: colors[Math.floor(Math.random() * colors.length)],
                            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                            animationDelay: `${Math.random() * 2}s`,
                            animationDuration: `${2 + Math.random() * 2}s`,
                        };
                        return <div key={i} className="absolute animate-onboard-confetti" style={confettiStyle} />;
                    })}
                    <style>{`
                        @keyframes onboard-confetti {
                            0% { transform: translateY(0) rotate(0deg); opacity: 1; }
                            100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
                        }
                        .animate-onboard-confetti { animation: onboard-confetti 3s ease-in forwards; }
                    `}</style>
                </div>
            )}

            <div className="z-10 w-full max-w-lg">
                {/* Progress Bar */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Step {step + 1} of {STEPS.length}</span>
                        <span className="text-[10px] font-black text-purple-400 uppercase">{STEPS[step].title}</span>
                    </div>
                    <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Content Card */}
                <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-8 backdrop-blur-xl shadow-2xl">

                    {/* STEP 0: Welcome */}
                    {step === 0 && (
                        <div className="text-center space-y-6">
                            <div className="text-6xl mb-2">🎉</div>
                            <h2 className="text-3xl font-black text-white uppercase tracking-tight">Welcome, {account.displayName}!</h2>
                            <p className="text-neutral-400 text-sm leading-relaxed">
                                You're now part of the <span className="text-purple-400 font-bold">OOEDN Creator Family</span>. This portal is your home base — let's walk through what's here.
                            </p>
                            <div className="space-y-2 text-left">
                                {[
                                    { emoji: '📊', label: 'Dashboard', desc: 'See stats, notifications, and your campaign timeline at a glance' },
                                    { emoji: '📋', label: 'Campaigns', desc: 'View assigned campaigns, deadlines, and deliverables' },
                                    { emoji: '📹', label: 'Content Hub', desc: 'Upload videos, photos, and manage revision requests' },
                                    { emoji: '💬', label: 'Team Chat', desc: 'Message the OOEDN team directly from your portal' },
                                    { emoji: '💰', label: 'Payments', desc: 'Track earnings, request payments, and upload receipts' },
                                    { emoji: '🧪', label: 'Beta Lab', desc: 'Test unreleased products before anyone else' },
                                ].map(f => (
                                    <div key={f.label} className="flex items-start gap-3 bg-black/30 border border-neutral-800/50 rounded-xl p-3">
                                        <span className="text-lg mt-0.5">{f.emoji}</span>
                                        <div>
                                            <p className="text-xs font-bold text-white">{f.label}</p>
                                            <p className="text-[10px] text-neutral-500 leading-relaxed">{f.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <p className="text-[10px] text-neutral-600">Let's get you set up in just a few steps →</p>
                        </div>
                    )}

                    {/* STEP 1: Password */}
                    {step === 1 && (
                        <div className="space-y-5">
                            <div className="text-center mb-2">
                                <div className="text-4xl mb-2">🔒</div>
                                <h2 className="text-2xl font-black text-white">Secure Your Account</h2>
                                <p className="text-neutral-500 text-xs mt-1">Your password was auto-generated — you can change it or keep it</p>
                            </div>
                            {pwSaved ? (
                                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-5 text-center">
                                    <Shield size={32} className="text-emerald-400 mx-auto mb-2" />
                                    <p className="text-sm font-bold text-emerald-400">Password Updated! ✓</p>
                                    <p className="text-[10px] text-neutral-500 mt-1">Your new password is saved</p>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-1">New Password</label>
                                        <div className="relative">
                                            <input value={newPassword} onChange={e => { setNewPassword(e.target.value); setPwError(''); }}
                                                type={showNewPw ? 'text' : 'password'} placeholder="Enter new password (min 6 characters)"
                                                className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 pr-10 text-sm text-white focus:border-purple-500 outline-none" />
                                            <button onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white" type="button">
                                                {showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-1">Confirm Password</label>
                                        <input value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setPwError(''); }}
                                            type="password" placeholder="Re-enter password"
                                            className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:border-purple-500 outline-none" />
                                    </div>
                                    {pwError && <p className="text-red-400 text-xs text-center">{pwError}</p>}
                                    <button onClick={async () => {
                                        if (newPassword.length < 6) { setPwError('Password must be at least 6 characters'); return; }
                                        if (newPassword !== confirmPassword) { setPwError('Passwords do not match'); return; }
                                        if (onChangePassword) {
                                            const ok = await onChangePassword(newPassword);
                                            if (ok) setPwSaved(true); else setPwError('Failed to save — try again');
                                        }
                                    }} className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 hover:from-purple-400 hover:to-pink-400 transition-all active:scale-95 shadow-lg shadow-purple-500/20">
                                        <Lock size={14} /> Save New Password
                                    </button>
                                </>
                            )}
                            <button onClick={handleNext} className="text-neutral-500 text-xs hover:text-white transition-colors w-full text-center">
                                {pwSaved ? 'Continue →' : 'Skip — keep current password →'}
                            </button>
                        </div>
                    )}

                    {/* STEP 2: Profile */}
                    {step === 2 && (
                        <div className="space-y-5">
                            <div className="text-center mb-2">
                                <div className="text-4xl mb-2">👤</div>
                                <h2 className="text-2xl font-black text-white">Your Profile</h2>
                                <p className="text-neutral-500 text-xs mt-1">Tell us about yourself</p>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-1">Your Name</label>
                                <input value={name} onChange={e => setName(e.target.value)}
                                    className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:border-purple-500 outline-none" placeholder="Your name" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-1">Social Handle</label>
                                <input value={handle} onChange={e => setHandle(e.target.value)}
                                    className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:border-purple-500 outline-none" placeholder="@yourhandle" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-2">Main Platform</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {platforms.map(p => (
                                        <button key={p.id} onClick={() => setPlatform(p.id)}
                                            className={`p-3 rounded-xl text-center transition-all border ${platform === p.id ? 'bg-purple-500/10 border-purple-500/30 text-white' : 'bg-black/50 border-neutral-800 text-neutral-500 hover:border-neutral-700'}`}>
                                            <div className="text-xl mb-1">{p.emoji}</div>
                                            <p className="text-[9px] font-bold uppercase">{p.label}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Payment */}
                    {step === 3 && (
                        <div className="space-y-5">
                            <div className="text-center mb-2">
                                <div className="text-4xl mb-2">💰</div>
                                <h2 className="text-2xl font-black text-white">Get Paid</h2>
                                <p className="text-neutral-500 text-xs mt-1">How should we send your payments?</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {paymentMethods.map(pm => (
                                    <button key={pm.method} onClick={() => setSelectedPayment(pm.method)}
                                        className={`p-3 rounded-xl text-center transition-all border ${selectedPayment === pm.method ? 'bg-purple-500/10 border-purple-500/30 text-white' : 'bg-black/50 border-neutral-800 text-neutral-500 hover:border-neutral-700'}`}>
                                        <div className="text-xl mb-1">{pm.emoji}</div>
                                        <p className="text-[10px] font-bold uppercase">{pm.label}</p>
                                    </button>
                                ))}
                            </div>
                            {selectedPayment && (
                                <div>
                                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-1">
                                        {paymentMethods.find(p => p.method === selectedPayment)?.label} Details
                                    </label>
                                    <input value={paymentDetails} onChange={e => setPaymentDetails(e.target.value)}
                                        placeholder={paymentMethods.find(p => p.method === selectedPayment)?.placeholder}
                                        className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:border-purple-500 outline-none" />
                                </div>
                            )}
                            <p className="text-[10px] text-neutral-600 text-center">You can always add more methods later in your profile</p>
                        </div>
                    )}

                    {/* STEP 4: Notifications */}
                    {step === 4 && (
                        <div className="text-center space-y-5">
                            <div className="text-5xl mb-2">🔔</div>
                            <h2 className="text-2xl font-black text-white">Stay in the Loop</h2>
                            <p className="text-neutral-400 text-sm leading-relaxed">
                                Enable notifications to get alerted when you receive new campaigns, payment updates, revision requests, and messages from the team.
                            </p>
                            <div className="space-y-2 text-left text-xs">
                                {[
                                    { emoji: '📋', text: 'New campaign assignments' },
                                    { emoji: '💰', text: 'Payment sent notifications' },
                                    { emoji: '✂️', text: 'Revision requests on your content' },
                                    { emoji: '💬', text: 'Direct messages from the team' },
                                ].map((n, i) => (
                                    <div key={i} className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-2">
                                        <span>{n.emoji}</span>
                                        <span className="text-neutral-400">{n.text}</span>
                                    </div>
                                ))}
                            </div>
                            <button onClick={onEnableNotifications}
                                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 hover:from-purple-400 hover:to-pink-400 transition-all active:scale-95 shadow-lg shadow-purple-500/20">
                                <Bell size={16} /> Enable Notifications
                            </button>
                            <button onClick={handleNext} className="text-neutral-500 text-xs hover:text-white transition-colors">
                                Skip for now →
                            </button>
                        </div>
                    )}

                    {/* STEP 5: Beta Lab */}
                    {step === 5 && (
                        <div className="space-y-5">
                            <div className="text-center mb-2">
                                <div className="text-4xl mb-2">🧪</div>
                                <h2 className="text-2xl font-black text-white">Beta Lab</h2>
                                <p className="text-neutral-400 text-xs mt-1">Test products before anyone else</p>
                            </div>
                            <div className="bg-black/50 border border-neutral-800 rounded-xl p-4 text-sm text-neutral-300 leading-relaxed">
                                <p className="mb-3">As an OOEDN creator, you may be invited to <span className="text-purple-400 font-bold">beta test unreleased products</span>. Here's how it works:</p>
                                <div className="space-y-2 text-xs">
                                    {[
                                        { emoji: '📦', text: 'Receive exclusive pre-release samples' },
                                        { emoji: '⭐', text: 'Review and rate before launch' },
                                        { emoji: '📹', text: 'Create content (posted after embargo date)' },
                                        { emoji: '✍️', text: 'Sign a release agreement per beta test' },
                                        { emoji: '✅', text: 'Team approves all content before posting' },
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <span>{item.emoji}</span>
                                            <span className="text-neutral-400">{item.text}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input type="checkbox" checked={betaOptIn} onChange={e => setBetaOptIn(e.target.checked)}
                                        className="mt-0.5 accent-purple-500" />
                                    <div>
                                        <p className="text-sm text-white font-bold">I'm interested in beta testing! 🧪</p>
                                        <p className="text-[10px] text-neutral-500 mt-0.5">You'll be notified when beta tests are available</p>
                                    </div>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* STEP 6: All Set! */}
                    {step === 6 && (
                        <div className="text-center space-y-6">
                            <div className="text-6xl mb-2">🚀</div>
                            <h2 className="text-3xl font-black text-white uppercase tracking-tight">You're All Set!</h2>
                            <p className="text-neutral-400 text-sm leading-relaxed">
                                Your portal is ready. Here's a quick cheat sheet:
                            </p>
                            <div className="space-y-2 text-left">
                                {[
                                    { emoji: '📊', label: 'Dashboard', tip: 'Check here daily for updates and revision requests' },
                                    { emoji: '📹', label: 'Content Hub', tip: 'Upload videos/photos here. Named uploads match to campaigns' },
                                    { emoji: '✂️', label: 'Revisions', tip: 'Orange banners = team wants changes. Re-upload in Content Hub' },
                                    { emoji: '💬', label: 'Chat', tip: 'Message the team anytime — they\'ll see it immediately' },
                                ].map(f => (
                                    <div key={f.label} className="bg-gradient-to-br from-purple-500/5 to-pink-500/5 border border-purple-500/15 rounded-xl p-3">
                                        <div className="flex items-center gap-2">
                                            <span>{f.emoji}</span>
                                            <p className="text-xs font-bold text-purple-400 uppercase">{f.label}</p>
                                        </div>
                                        <p className="text-[10px] text-neutral-500 mt-1 pl-7">{f.tip}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Navigation */}
                    <div className="flex items-center justify-between mt-8 pt-6 border-t border-neutral-800">
                        {step > 0 ? (
                            <button onClick={() => setStep(step - 1)} className="flex items-center gap-2 text-neutral-500 hover:text-white text-xs font-bold transition-colors">
                                <ArrowLeft size={14} /> Back
                            </button>
                        ) : <div />}

                        {step === 6 ? (
                            <button onClick={handleFinish}
                                className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-sm flex items-center gap-2 hover:from-purple-400 hover:to-pink-400 transition-all shadow-xl shadow-purple-500/20 active:scale-95">
                                <Rocket size={16} /> Let's Go!
                            </button>
                        ) : step === 4 ? (
                            // Notifications step has its own "next" flow
                            <button onClick={handleNext}
                                className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center gap-2 hover:from-purple-400 hover:to-pink-400 transition-all active:scale-95">
                                <ArrowRight size={14} /> Continue
                            </button>
                        ) : (
                            <button onClick={handleNext}
                                className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center gap-2 hover:from-purple-400 hover:to-pink-400 transition-all active:scale-95">
                                <ArrowRight size={14} /> Next
                            </button>
                        )}
                    </div>
                </div>

                {/* Step Dots */}
                <div className="flex items-center justify-center gap-2 mt-6">
                    {STEPS.map((s, i) => (
                        <button
                            key={i}
                            onClick={() => i <= step && setStep(i)}
                            className={`transition-all rounded-full ${i === step ? 'w-8 h-2 bg-gradient-to-r from-purple-500 to-pink-500' :
                                i < step ? 'w-2 h-2 bg-purple-500/50' :
                                    'w-2 h-2 bg-neutral-800'
                                }`}
                            title={s.title}
                        />
                    ))}
                </div>
            </div>
        </div >
    );
};

export default CreatorOnboarding;
