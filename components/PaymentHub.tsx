
import React, { useState } from 'react';
import { Creator, PaymentStatus, AppSettings, CreatorStatus } from '../types';
import { DollarSign, Copy, CheckCircle2, Clock, CreditCard, X, AlertCircle, FolderOpen, Search, Download, History, ArrowUpRight, Loader2, Archive, Upload, LayoutGrid, List } from 'lucide-react';
import PaymentModal from './PaymentModal';
import { uploadToGoogleCloud } from '../services/googleCloudStorage';

interface PaymentHubProps {
  creators: Creator[];
  onUpdateCreator: (id: string, updates: Partial<Creator>) => void;
  appSettings: AppSettings;
}

const PaymentHub: React.FC<PaymentHubProps> = ({ creators, onUpdateCreator, appSettings }) => {
  const [selectedCreator, setSelectedCreator] = useState<Creator | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');
  const [historyView, setHistoryView] = useState<'list' | 'gallery'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const unpaidCreators = creators.filter(c => c.paymentStatus !== PaymentStatus.Paid);
  const totalOutstanding = unpaidCreators.reduce((sum, c) => sum + (c.rate || 0), 0);

  // Robust History Filter: Includes anything Paid OR with a payment date
  const receiptHistory = creators
    .filter(c => c.paymentStatus === PaymentStatus.Paid || c.lastPaymentDate)
    .sort((a, b) => {
      const dateA = a.lastPaymentDate ? new Date(a.lastPaymentDate).getTime() : 0;
      const dateB = b.lastPaymentDate ? new Date(b.lastPaymentDate).getTime() : 0;
      return dateB - dateA; // Newest first
    });

  const totalPaid = receiptHistory.reduce((sum, c) => sum + (c.rate || 0), 0);

  const filteredHistory = receiptHistory.filter(c => {
    const searchLower = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(searchLower) ||
      c.handle.toLowerCase().includes(searchLower) ||
      (c.lastTransactionId || '').toLowerCase().includes(searchLower)
    );
  });

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePaymentConfirm = async (proofFile: File | null, transactionId: string | null) => {
    if (!selectedCreator) return;
    setIsUploading(true);

    let proofUrl = selectedCreator.lastPaymentProof; // Keep existing if not updating

    if (proofFile && appSettings.googleCloudBucket && appSettings.googleCloudToken) {
      try {
        const fileName = `receipts/${selectedCreator.id}_${Date.now()}_${proofFile.name.replace(/\s+/g, '_')}`;
        proofUrl = await uploadToGoogleCloud(
          proofFile,
          appSettings.googleCloudBucket,
          appSettings.googleCloudToken,
          fileName,
          proofFile.type,
          appSettings.googleProjectId
        );
      } catch (e) {
        console.error("Receipt upload failed", e);
        alert("Warning: Receipt upload failed. Payment will be recorded without the image.");
      }
    } else if (proofFile) {
      alert("Cannot upload receipt: System not connected to Cloud Storage.");
    }

    // If creator is already Paid, only update proof/transaction — don't overwrite date or re-mark
    const isAlreadyPaid = selectedCreator.paymentStatus === PaymentStatus.Paid;

    if (isAlreadyPaid) {
      const updates: Partial<Creator> = {};
      if (proofUrl) updates.lastPaymentProof = proofUrl;
      if (transactionId) updates.lastTransactionId = transactionId;
      if (proofUrl || transactionId) {
        updates.notes = `${selectedCreator.notes || ''}\n\n[RECEIPT ADDED ${new Date().toLocaleDateString()}]: Proof uploaded${transactionId ? ` — ${transactionId}` : ''}`;
      }
      onUpdateCreator(selectedCreator.id, updates);
    } else {
      onUpdateCreator(selectedCreator.id, {
        paymentStatus: PaymentStatus.Paid,
        lastPaymentDate: new Date().toISOString(),
        lastPaymentProof: proofUrl || undefined,
        lastTransactionId: transactionId || undefined,
        notes: `${selectedCreator.notes || ''}\n\n[PAID ${new Date().toLocaleDateString()}]: $${selectedCreator.rate} via ${transactionId || 'Manual'}`
      });
    }

    setIsUploading(false);
    setSelectedCreator(null);
    setActiveTab('history');
  };

  return (
    <div className="space-y-8 pb-20 relative animate-in fade-in duration-500">

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Outstanding */}
        <div
          onClick={() => setActiveTab('queue')}
          className={`p-8 rounded-3xl shadow-2xl relative overflow-hidden group border cursor-pointer transition-all
            ${activeTab === 'queue' ? 'bg-ooedn-gray border-neutral-600 ring-2 ring-emerald-500/20' : 'bg-ooedn-gray border-neutral-800 hover:bg-neutral-800'}`}
        >
          <div className="absolute -right-4 -top-4 text-emerald-500/10 group-hover:text-emerald-500/20 transition-all">
            <DollarSign size={120} />
          </div>
          <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2">Accounts Payable</p>
          <h2 className="text-4xl font-black text-white tracking-tighter">${totalOutstanding.toLocaleString()}</h2>
          <p className="text-xs text-emerald-500 font-bold mt-2 uppercase">Outstanding to {unpaidCreators.length} Creators</p>
        </div>

        {/* Card 2: Processing */}
        <div className="bg-neutral-900/50 border border-neutral-800 p-8 rounded-3xl flex flex-col justify-center">
          <div className="flex items-center gap-3 text-blue-400 mb-2">
            <Clock size={20} />
            <span className="text-[10px] font-black uppercase tracking-widest">Awaiting Proof</span>
          </div>
          <p className="text-2xl font-black text-white">{creators.filter(c => c.paymentStatus === PaymentStatus.Processing).length}</p>
        </div>

        {/* Card 3: Total Paid / History Trigger */}
        <div
          onClick={() => setActiveTab('history')}
          className={`p-8 rounded-3xl flex flex-col justify-center cursor-pointer transition-all group relative overflow-hidden active:scale-95 shadow-lg border
            ${activeTab === 'history' ? 'bg-neutral-800 border-emerald-500 ring-2 ring-emerald-500/20' : 'bg-neutral-900/50 border-neutral-800 hover:bg-neutral-800'}`}
        >
          <div className="absolute -right-6 -bottom-6 text-neutral-800 group-hover:text-emerald-900/10 transition-colors duration-500">
            <History size={100} />
          </div>
          <div className="flex items-center gap-3 text-emerald-500 mb-2 relative z-10 group-hover:scale-105 transition-transform origin-left">
            <History size={20} />
            <span className="text-[10px] font-black uppercase tracking-widest">Payment History</span>
          </div>
          <p className="text-2xl font-black text-white relative z-10">${totalPaid.toLocaleString()}</p>
          <p className="text-xs text-neutral-500 font-medium leading-relaxed mt-1 relative z-10 group-hover:text-emerald-400 transition-colors">
            {receiptHistory.length} Settled Payments
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-ooedn-dark border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl min-h-[500px] flex flex-col">

        {/* Tab Header */}
        <div className="p-4 border-b border-neutral-800 bg-neutral-900/50 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex p-1 bg-black rounded-xl border border-neutral-800">
            <button
              onClick={() => setActiveTab('queue')}
              className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'queue' ? 'bg-white text-black shadow-lg' : 'text-neutral-500 hover:text-white'}`}
            >
              <AlertCircle size={14} /> Payment Queue
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-emerald-500 text-black shadow-lg' : 'text-neutral-500 hover:text-white'}`}
            >
              <History size={14} /> History & Receipts
            </button>
          </div>

          {activeTab === 'history' && (
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="flex bg-black border border-neutral-800 rounded-lg p-1">
                <button onClick={() => setHistoryView('list')} className={`p-2 rounded ${historyView === 'list' ? 'bg-white text-black' : 'text-neutral-500'}`}><List size={14} /></button>
                <button onClick={() => setHistoryView('gallery')} className={`p-2 rounded ${historyView === 'gallery' ? 'bg-white text-black' : 'text-neutral-500'}`}><LayoutGrid size={14} /></button>
              </div>
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={14} />
                <input
                  type="text"
                  placeholder="Search history..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-black border border-neutral-800 rounded-xl py-2 pl-9 pr-4 text-xs text-white focus:border-emerald-500 outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* TAB CONTENT: QUEUE */}
        {activeTab === 'queue' && (
          <div className="overflow-x-auto animate-in fade-in slide-in-from-left-4 duration-300">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-neutral-500">Creator</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-neutral-500">Amount</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-neutral-500">Payment Methods</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-neutral-500">Status</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-neutral-500 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {unpaidCreators.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-20 text-center">
                      <CheckCircle2 className="mx-auto text-emerald-500 mb-4" size={48} />
                      <p className="text-sm font-black uppercase tracking-widest text-neutral-500">All Payouts Settled</p>
                    </td>
                  </tr>
                ) : (
                  unpaidCreators.map(creator => (
                    <tr key={creator.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="p-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-neutral-800 border-2 border-neutral-700 flex items-center justify-center overflow-hidden">
                            {creator.profileImage ? <img src={creator.profileImage} className="w-full h-full object-cover" /> : <span className="text-xs font-black">{creator.name[0]}</span>}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-black text-white uppercase tracking-tighter">{creator.name}</p>
                              {creator.status === CreatorStatus.Inactive && (
                                <span className="text-[7px] font-black uppercase bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded border border-neutral-700 flex items-center gap-1">
                                  <Archive size={8} /> Inactive
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">@{creator.handle}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <span className="text-lg font-black text-white tracking-tighter">${creator.rate.toLocaleString()}</span>
                      </td>
                      <td className="p-6">
                        <div className="flex flex-wrap gap-2">
                          {creator.paymentOptions?.map((opt, i) => (
                            <button
                              key={i}
                              onClick={() => handleCopy(opt.details, `${creator.id}-${i}`)}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all
                                    ${copiedId === `${creator.id}-${i}` ? 'bg-emerald-500 border-emerald-500 text-black' : 'bg-black border-neutral-800 text-neutral-400 hover:border-emerald-500/50 hover:text-white'}
                                  `}
                            >
                              <CreditCard size={12} />
                              {opt.method}: {opt.details}
                              {copiedId === `${creator.id}-${i}` ? <CheckCircle2 size={10} /> : <Copy size={10} />}
                            </button>
                          ))}
                          {(!creator.paymentOptions || creator.paymentOptions.length === 0) && (
                            <span className="text-[9px] font-black uppercase text-red-500 bg-red-500/10 px-3 py-1.5 rounded-xl border border-red-500/20">No Method Found</span>
                          )}
                        </div>
                      </td>
                      <td className="p-6">
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border
                                ${creator.paymentStatus === PaymentStatus.Unpaid ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}
                             `}>
                          <div className={`w-1.5 h-1.5 rounded-full ${creator.paymentStatus === PaymentStatus.Unpaid ? 'bg-yellow-500 animate-pulse' : 'bg-blue-500'}`} />
                          {creator.paymentStatus}
                        </div>
                      </td>
                      <td className="p-6 text-right">
                        <button
                          onClick={() => setSelectedCreator(creator)}
                          className="bg-white text-black hover:bg-emerald-500 hover:text-black px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
                        >
                          Record Payout
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB CONTENT: HISTORY */}
        {activeTab === 'history' && (
          <div className="overflow-x-auto animate-in fade-in slide-in-from-right-4 duration-300">
            {historyView === 'list' ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800">
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-neutral-500">Paid To</th>
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-neutral-500">Date Paid</th>
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-neutral-500">Amount</th>
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-neutral-500">Transaction ID</th>
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-neutral-500 text-right">Receipt / Proof</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-20 text-center">
                        <History className="mx-auto text-neutral-700 mb-4" size={48} />
                        <p className="text-sm font-black uppercase tracking-widest text-neutral-500">No Payment History Found</p>
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map(creator => (
                      <tr key={creator.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="p-6">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-neutral-800 border-2 border-neutral-700 flex items-center justify-center overflow-hidden">
                              {creator.profileImage ? <img src={creator.profileImage} className="w-full h-full object-cover" /> : <span className="text-xs font-black">{creator.name[0]}</span>}
                            </div>
                            <div>
                              <p className="text-sm font-black text-white uppercase tracking-tighter">{creator.name}</p>
                              <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">@{creator.handle}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-6">
                          <div className="flex items-center gap-2 text-neutral-400">
                            <Clock size={14} />
                            <span className="text-xs font-bold">{creator.lastPaymentDate ? new Date(creator.lastPaymentDate).toLocaleDateString() : 'Historical'}</span>
                          </div>
                        </td>
                        <td className="p-6">
                          <span className="text-lg font-black text-emerald-500 tracking-tighter">${creator.rate.toLocaleString()}</span>
                        </td>
                        <td className="p-6">
                          <span className="text-xs font-mono text-neutral-400 bg-black px-2 py-1 rounded border border-neutral-800">
                            {creator.lastTransactionId || 'MANUAL-LOG'}
                          </span>
                        </td>
                        <td className="p-6 text-right">
                          {creator.lastPaymentProof ? (
                            <a
                              href={creator.lastPaymentProof}
                              download={`receipt_${creator.name.replace(/\s+/g, '_')}_${creator.lastPaymentDate?.split('T')[0]}.png`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 bg-neutral-800 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-black transition-all shadow-lg"
                            >
                              <Download size={14} /> View Receipt
                            </a>
                          ) : (
                            <button
                              onClick={() => setSelectedCreator(creator)}
                              className="inline-flex items-center gap-2 bg-neutral-900 text-neutral-500 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-neutral-800 hover:border-emerald-500 hover:text-emerald-500 transition-all"
                            >
                              <Upload size={14} /> Add Receipt
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-6">
                {filteredHistory.map(creator => (
                  <div key={creator.id} className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden group">
                    <div className="aspect-[3/4] bg-black relative flex items-center justify-center overflow-hidden">
                      {creator.lastPaymentProof ? (
                        <img src={creator.lastPaymentProof} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <div className="text-neutral-700 flex flex-col items-center">
                          <AlertCircle size={32} className="mb-2" />
                          <p className="text-[9px] font-black uppercase tracking-widest">No Receipt</p>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        {creator.lastPaymentProof ? (
                          <a
                            href={creator.lastPaymentProof}
                            target="_blank"
                            download
                            className="p-2 bg-white text-black rounded-full hover:scale-110 transition-transform"
                            title="Download Receipt"
                          >
                            <Download size={20} />
                          </a>
                        ) : (
                          <button
                            onClick={() => setSelectedCreator(creator)}
                            className="p-2 bg-emerald-500 text-black rounded-full hover:scale-110 transition-transform"
                            title="Upload Receipt"
                          >
                            <Upload size={20} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="p-4">
                      <h4 className="text-white font-black truncate">{creator.name}</h4>
                      <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">{new Date(creator.lastPaymentDate || '').toLocaleDateString()}</p>
                      <div className="flex justify-between items-center">
                        <span className="text-emerald-500 font-black">${creator.rate.toLocaleString()}</span>
                        <span className="text-[9px] bg-neutral-800 px-2 py-0.5 rounded text-neutral-400 font-mono truncate max-w-[80px]">
                          {creator.lastTransactionId || 'MANUAL'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedCreator && (
        <div className={isUploading ? "pointer-events-none opacity-80" : ""}>
          <PaymentModal
            creatorName={selectedCreator.name}
            rate={selectedCreator.rate}
            method={selectedCreator.paymentOptions?.[0]?.method || 'Manual'}
            paymentDetails={selectedCreator.paymentOptions?.[0]?.details}
            onClose={() => !isUploading && setSelectedCreator(null)}
            onConfirm={handlePaymentConfirm}
            isReceiptOnly={selectedCreator.paymentStatus === PaymentStatus.Paid}
          />
          {isUploading && (
            <div className="fixed inset-0 z-[90] flex items-center justify-center">
              <div className="bg-black/80 backdrop-blur-md px-8 py-6 rounded-2xl flex flex-col items-center gap-4">
                <Loader2 size={40} className="text-emerald-500 animate-spin" />
                <p className="text-white font-black uppercase tracking-widest text-xs">Uploading Secure Receipt...</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PaymentHub;
