import React, { useState } from 'react';
import { ArrowLeft, Shield, FileText, Camera, X } from 'lucide-react';

type LegalPage = 'terms' | 'privacy' | 'content-license';

interface LegalPagesProps {
    page: LegalPage;
    onClose: () => void;
}

function LegalPages({ page, onClose }: LegalPagesProps) {
    const pages: Record<LegalPage, { title: string; icon: React.ReactNode; content: React.ReactNode }> = {
        terms: {
            title: 'Terms of Service',
            icon: <FileText size={20} />,
            content: (
                <div>
                    <p className="legal-date">Last Updated: March 17, 2026</p>

                    <h3>1. Acceptance of Terms</h3>
                    <p>By accessing or using the OOEDN Creator Portal ("Portal"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the Portal.</p>

                    <h3>2. Eligibility</h3>
                    <p>You must be at least 18 years old and have the legal capacity to enter into these Terms. By using the Portal, you represent that you meet these requirements.</p>

                    <h3>3. Account Registration</h3>
                    <p>You must provide accurate, complete information when creating an account. You are responsible for maintaining the confidentiality of your login credentials and are liable for all activity under your account. Notify us immediately of any unauthorized use.</p>

                    <h3>4. Creator Obligations</h3>
                    <ul>
                        <li>Create original content that complies with all applicable laws</li>
                        <li>Not upload content that infringes on third-party intellectual property rights</li>
                        <li>Deliver content within agreed-upon campaign timelines</li>
                        <li>Comply with FTC disclosure requirements for sponsored content</li>
                        <li>Not use bots, AI-generated impersonation, or deceptive practices</li>
                    </ul>

                    <h3>5. Payment Terms</h3>
                    <p>Payment amounts, schedules, and methods are specified in your individual creator agreement or campaign brief. OOEDN reserves the right to withhold payment for content that does not meet campaign requirements or violates these Terms. Tax reporting (1099 forms) will be issued for earnings exceeding $600 annually as required by US law.</p>

                    <h3>6. Termination</h3>
                    <p>Either party may terminate this agreement at any time. OOEDN reserves the right to suspend or terminate your account for violations of these Terms. Upon termination, previously licensed content remains licensed per the Content License Agreement.</p>

                    <h3>7. Limitation of Liability</h3>
                    <p>OOEDN SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE PORTAL. Our total liability shall not exceed the amounts paid to you in the preceding 12 months.</p>

                    <h3>8. Dispute Resolution</h3>
                    <p>Any disputes shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association, conducted in the state of OOEDN's principal office.</p>

                    <h3>9. Modifications</h3>
                    <p>We may modify these Terms at any time. Continued use of the Portal after changes constitutes acceptance. We will notify you of material changes via email or in-app notification.</p>

                    <h3>10. Governing Law</h3>
                    <p>These Terms are governed by the laws of the State of Delaware, United States, without regard to conflict of law principles.</p>

                    <h3>11. Contact</h3>
                    <p>For questions about these Terms, contact: <strong>legal@ooedn.com</strong></p>
                </div>
            ),
        },
        privacy: {
            title: 'Privacy Policy',
            icon: <Shield size={20} />,
            content: (
                <div>
                    <p className="legal-date">Last Updated: March 17, 2026</p>

                    <h3>1. Information We Collect</h3>
                    <p><strong>Account Information:</strong> Name, email address, social media handles, profile photo, and hashed password.</p>
                    <p><strong>Content Data:</strong> Videos, images, and other media you upload to the Portal.</p>
                    <p><strong>Usage Data:</strong> Pages visited, features used, timestamps, device type, browser type, and IP address.</p>
                    <p><strong>Payment Information:</strong> Payment method details processed through secure third-party payment processors. We do not store full financial account numbers.</p>
                    <p><strong>Communications:</strong> Messages sent through the Portal's chat features.</p>

                    <h3>2. How We Use Your Information</h3>
                    <ul>
                        <li>Provide and maintain the Portal</li>
                        <li>Process payments and manage creator contracts</li>
                        <li>Facilitate campaign matching between creators and brands</li>
                        <li>Send notifications about campaigns, payments, and platform updates</li>
                        <li>Analyze usage patterns to improve the Portal</li>
                        <li>Comply with legal obligations</li>
                    </ul>

                    <h3>3. Data Storage & Security</h3>
                    <p>Your data is stored on Google Cloud Platform (Firestore and Cloud Storage) with encryption at rest and in transit. We use industry-standard security practices including JWT-based authentication, bcrypt password hashing, and TLS encryption.</p>

                    <h3>4. Data Sharing</h3>
                    <p>We do not sell your personal information. We may share your data with:</p>
                    <ul>
                        <li><strong>Brands/Clients:</strong> Creator profile information and approved content as part of campaign deliverables</li>
                        <li><strong>Service Providers:</strong> Google Cloud (hosting), payment processors, and email services — only as necessary to operate the Portal</li>
                        <li><strong>Legal Requirements:</strong> When required by law, subpoena, or government request</li>
                    </ul>

                    <h3>5. Your Rights</h3>
                    <p><strong>Access:</strong> Request a copy of all personal data we hold about you.</p>
                    <p><strong>Correction:</strong> Update inaccurate or incomplete personal information.</p>
                    <p><strong>Deletion:</strong> Request deletion of your personal data (subject to legal retention requirements and existing content licenses).</p>
                    <p><strong>Portability:</strong> Request your data in a machine-readable format.</p>
                    <p><strong>Opt-Out:</strong> Unsubscribe from marketing communications at any time.</p>

                    <h3>6. Cookies & Local Storage</h3>
                    <p>We use browser local storage for session management (JWT tokens), theme preferences, and application state. We do not use third-party tracking cookies. Push notification subscriptions are stored to deliver real-time updates.</p>

                    <h3>7. Data Retention</h3>
                    <p>We retain your data for as long as your account is active. After account termination, we retain data for up to 12 months for legal and audit purposes, then permanently delete it unless retention is required by law.</p>

                    <h3>8. California Residents (CCPA)</h3>
                    <p>California residents have the right to: know what personal information is collected, request deletion, and opt out of data sales (we do not sell data). To exercise these rights, contact legal@ooedn.com.</p>

                    <h3>9. International Users (GDPR)</h3>
                    <p>If you are located in the European Economic Area, you have additional rights under GDPR including the right to lodge a complaint with a supervisory authority. Our legal basis for processing is contractual necessity and legitimate interest.</p>

                    <h3>10. Children's Privacy</h3>
                    <p>The Portal is not intended for individuals under 18 years of age. We do not knowingly collect personal information from children.</p>

                    <h3>11. Changes to This Policy</h3>
                    <p>We will notify you of material changes via email. Continued use after changes constitutes acceptance.</p>

                    <h3>12. Contact</h3>
                    <p>Privacy inquiries: <strong>privacy@ooedn.com</strong></p>
                    <p>Data Protection Officer: <strong>legal@ooedn.com</strong></p>
                </div>
            ),
        },
        'content-license': {
            title: 'Content License Agreement',
            icon: <Camera size={20} />,
            content: (
                <div>
                    <p className="legal-date">Last Updated: March 17, 2026</p>

                    <h3>1. Content Ownership</h3>
                    <p>You retain ownership of all original content ("Creator Content") that you create and upload to the OOEDN Creator Portal. Nothing in this Agreement transfers ownership of your intellectual property to OOEDN.</p>

                    <h3>2. License Grant to OOEDN</h3>
                    <p>By uploading Creator Content to the Portal for a campaign, you grant OOEDN and its brand partners a <strong>non-exclusive, worldwide, royalty-free license</strong> to:</p>
                    <ul>
                        <li>Use, reproduce, and distribute the content across social media platforms</li>
                        <li>Modify or edit the content for format requirements (aspect ratio, duration, captions)</li>
                        <li>Use the content in paid advertising and promotional materials</li>
                        <li>Sublicense the content to the brand partner specified in the campaign brief</li>
                    </ul>

                    <h3>3. License Duration</h3>
                    <p>The license is granted for the duration specified in the campaign brief. If no duration is specified, the default license period is <strong>12 months</strong> from the date of content approval. After the license period, OOEDN and brand partners must cease active use (existing posts may remain live).</p>

                    <h3>4. Usage Scope</h3>
                    <p>Content may be used for:</p>
                    <ul>
                        <li>Organic social media posts on brand accounts</li>
                        <li>Paid social media advertisements (with proper sponsorship disclosure)</li>
                        <li>Website and landing page content</li>
                        <li>Email marketing (with your content credited)</li>
                    </ul>
                    <p>Content will NOT be used for purposes materially different from the original campaign brief without your prior written consent.</p>

                    <h3>5. Creator Warranties</h3>
                    <p>By uploading content, you warrant that:</p>
                    <ul>
                        <li>You are the sole creator and owner of the content</li>
                        <li>The content does not infringe on any third-party rights (copyright, trademark, right of publicity)</li>
                        <li>You have obtained necessary permissions from any individuals appearing in the content</li>
                        <li>The content complies with all applicable advertising laws and FTC guidelines</li>
                        <li>Any music, sounds, or effects used are properly licensed or royalty-free</li>
                    </ul>

                    <h3>6. Content Removal</h3>
                    <p>You may request removal of content that is not currently under an active campaign license by emailing legal@ooedn.com. OOEDN will remove the content from its systems within 30 business days. Content already distributed to brand partners is subject to the brand's separate license terms.</p>

                    <h3>7. Compensation</h3>
                    <p>Compensation for content is specified in your creator agreement or individual campaign briefs. This Content License does not create an independent obligation to compensate beyond what is outlined in those agreements.</p>

                    <h3>8. Termination</h3>
                    <p>If either party terminates the creator relationship, all active campaign licenses will be honored through their specified duration. No new licenses will be granted after termination.</p>

                    <h3>9. Contact</h3>
                    <p>For questions about content licensing: <strong>legal@ooedn.com</strong></p>
                </div>
            ),
        },
    };

    const current = pages[page];

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 10000, background: '#07070a',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
            {/* Header */}
            <div style={{
                padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', gap: '12px',
                background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(20px)',
            }}>
                <button onClick={onClose} style={{
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px', padding: '8px', cursor: 'pointer', color: 'rgba(255,255,255,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <ArrowLeft size={16} />
                </button>
                <span style={{ color: 'rgba(127,181,181,0.8)' }}>{current.icon}</span>
                <h2 style={{ color: 'white', fontSize: '16px', fontWeight: 700, margin: 0 }}>{current.title}</h2>
            </div>

            {/* Content */}
            <div style={{
                flex: 1, overflow: 'auto', padding: '24px 20px 60px',
                maxWidth: '720px', margin: '0 auto', width: '100%',
            }}>
                <style>{`
                    .legal-content h3 { color: white; font-size: 15px; font-weight: 700; margin: 24px 0 8px; }
                    .legal-content p { color: rgba(255,255,255,0.55); font-size: 13px; line-height: 1.7; margin: 0 0 10px; }
                    .legal-content ul { color: rgba(255,255,255,0.55); font-size: 13px; line-height: 1.7; padding-left: 20px; margin: 0 0 10px; }
                    .legal-content li { margin-bottom: 4px; }
                    .legal-content strong { color: rgba(255,255,255,0.75); }
                    .legal-date { color: rgba(127,181,181,0.5); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 20px !important; }
                `}</style>
                <div className="legal-content">
                    {current.content}
                </div>
            </div>
        </div>
    );
}

export default LegalPages;
