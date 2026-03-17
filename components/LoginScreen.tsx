import React, { useState } from 'react';
import { Flame, Loader2, ArrowRight, AlertTriangle, X } from 'lucide-react';
import { AppSettings } from '../types';

interface LoginScreenProps {
    settings: AppSettings;
    isLoadingInitial: boolean;
    loginError: string | null;
    showConfigHelp: boolean;
    onGoogleLogin: () => void;
    onManualLogin: (token: string) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({
    settings, isLoadingInitial, loginError, showConfigHelp, onGoogleLogin, onManualLogin
}) => {
    const [showManualInput, setShowManualInput] = useState(false);
    const [manualToken, setManualToken] = useState('');

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-900/20 via-black to-black animate-pulse"></div>

            <div className="z-10 w-full max-w-md bg-neutral-900/50 border border-neutral-800 p-8 rounded-3xl backdrop-blur-xl shadow-2xl">
                <div className="flex justify-center mb-8">
                    {settings.logoUrl ? <img src={settings.logoUrl} className="h-16 object-contain opacity-90" /> : <Flame size={64} className="text-emerald-500" />}
                </div>

                <h1 className="text-3xl font-black text-white text-center mb-2 uppercase tracking-tighter">OOEDN Tracker <span className="text-emerald-500 text-sm align-super">v4.31</span></h1>
                <p className="text-neutral-500 text-center mb-8 text-xs font-bold uppercase tracking-widest">Team Internal Access Portal</p>

                <button
                    onClick={onGoogleLogin}
                    className="w-full bg-white text-black py-4 rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-neutral-200 transition-all shadow-xl active:scale-95 group"
                >
                    {isLoadingInitial ? <Loader2 className="animate-spin" /> : <div className="p-1 bg-black rounded-full"><ArrowRight className="text-white" size={14} /></div>}
                    Sign in with Google
                </button>

                {loginError && (
                    <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center animate-in slide-in-from-top-2">
                        <p className="text-red-500 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center justify-center gap-2"><AlertTriangle size={12} /> Login Error</p>
                        <p className="text-red-400 text-xs">{loginError}</p>
                        {showConfigHelp && (
                            <div className="mt-2 text-[9px] text-neutral-400 text-left bg-black/40 p-2 rounded">
                                <p className="font-bold text-white mb-1">Troubleshooting:</p>
                                <ul className="list-disc pl-4 space-y-1">
                                    <li>Authorized Origin mismatch. Ensure <code>window.location.origin</code> matches GCP Console.</li>
                                    <li>Check if <code>CLIENT_ID</code> env var is set correctly in Cloud Run.</li>
                                </ul>
                            </div>
                        )}
                        <button onClick={() => setShowManualInput(!showManualInput)} className="text-[9px] text-neutral-600 underline mt-2 hover:text-white">Use Emergency Token</button>
                    </div>
                )}

                {showManualInput && (
                    <div className="mt-4 space-y-2 animate-in fade-in">
                        <input
                            value={manualToken}
                            onChange={(e) => setManualToken(e.target.value)}
                            placeholder="Paste OAuth Token (Bearer)..."
                            className="w-full bg-black border border-neutral-800 rounded-lg p-2 text-xs text-white"
                        />
                        <button onClick={() => onManualLogin(manualToken)} className="w-full bg-neutral-800 text-white py-2 rounded-lg text-xs font-bold hover:bg-neutral-700">Validate Token</button>
                    </div>
                )}

                <div className="mt-8 pt-6 border-t border-neutral-800 text-center">
                    <p className="text-[9px] text-neutral-600 uppercase font-black">Protected System • OOEDN Holdings LLC</p>
                </div>
            </div>
        </div>
    );
};

export default LoginScreen;
