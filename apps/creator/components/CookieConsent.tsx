import React, { useState, useEffect } from 'react';
import { Shield, X } from 'lucide-react';

interface CookieConsentProps {
    onShowLegal: (page: 'terms' | 'privacy' | 'content-license') => void;
}

function CookieConsent({ onShowLegal }: CookieConsentProps) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem('ooedn_cookie_consent');
        if (!consent) {
            // Small delay so it doesn't flash on page load
            const timer = setTimeout(() => setVisible(true), 1000);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem('ooedn_cookie_consent', 'accepted');
        localStorage.setItem('ooedn_cookie_consent_date', new Date().toISOString());
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div style={{
            position: 'fixed', bottom: '16px', left: '16px', right: '16px',
            zIndex: 9999, maxWidth: '480px',
            background: 'rgba(15,15,20,0.95)', backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px',
            padding: '16px 20px', boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
            animation: 'cookieSlideUp 0.5s cubic-bezier(0.22,1,0.36,1) forwards',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif',
        }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <Shield size={18} style={{ color: 'rgba(127,181,181,0.7)', marginTop: '2px', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', lineHeight: 1.6, margin: '0 0 12px' }}>
                        We use local storage for session management and preferences. No third-party tracking cookies.
                        Read our{' '}
                        <button onClick={() => onShowLegal('privacy')} style={{
                            background: 'none', border: 'none', color: '#7fb5b5', cursor: 'pointer',
                            fontSize: '12px', textDecoration: 'underline', padding: 0,
                        }}>Privacy Policy</button>
                        {' '}and{' '}
                        <button onClick={() => onShowLegal('terms')} style={{
                            background: 'none', border: 'none', color: '#7fb5b5', cursor: 'pointer',
                            fontSize: '12px', textDecoration: 'underline', padding: 0,
                        }}>Terms of Service</button>.
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={handleAccept} style={{
                            padding: '8px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                            background: 'linear-gradient(135deg, #5a9e9e, #8cc5c5)', color: 'white',
                            fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                        }}>Accept</button>
                        <button onClick={handleAccept} style={{
                            padding: '8px 16px', borderRadius: '10px', cursor: 'pointer',
                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                            color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: 600,
                        }}>Dismiss</button>
                    </div>
                </div>
                <button onClick={handleAccept} style={{
                    background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)',
                    cursor: 'pointer', padding: '2px', flexShrink: 0,
                }}>
                    <X size={14} />
                </button>
            </div>
            <style>{`
                @keyframes cookieSlideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}

export default CookieConsent;
