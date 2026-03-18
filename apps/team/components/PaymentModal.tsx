
import React, { useState } from 'react';
import { X, Upload, CheckCircle, CreditCard, Copy } from 'lucide-react';

interface PaymentModalProps {
  creatorName: string;
  rate: number;
  method: string;
  paymentDetails?: string;
  onClose: () => void;
  onConfirm: (proofFile: File | null, transactionId: string | null) => void;
  isReceiptOnly?: boolean;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ creatorName, rate, method, paymentDetails, onClose, onConfirm, isReceiptOnly }) => {
  const [transactionId, setTransactionId] = useState('');
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProofFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProofImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-ooedn-dark border border-neutral-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-neutral-800 flex justify-between items-center bg-neutral-900">
          <div className="flex items-center gap-2">
            <CreditCard className="text-emerald-500" size={20} />
            <h3 className="font-bold text-white">Record Payment</h3>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-lg flex justify-between items-center">
            <div className="flex-1 min-w-0 mr-2">
              <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">Paying To</p>
              <p className="text-white font-bold truncate">{creatorName}</p>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-neutral-400 text-xs bg-black/30 px-1.5 py-0.5 rounded border border-neutral-800">{method}</span>
                {paymentDetails && (
                  <div className="flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded text-xs text-emerald-200 border border-emerald-500/30 max-w-full">
                    <span className="truncate flex-1 font-mono">{paymentDetails}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(paymentDetails);
                      }}
                      className="hover:text-white flex-shrink-0"
                      title="Copy Handle"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">Amount</p>
              <p className="text-2xl font-bold text-white">${rate.toLocaleString()}</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-2">Transaction ID / Confirmation Code</label>
            <input
              type="text"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="e.g. VENMO-123456"
              className="w-full bg-black border border-neutral-800 rounded-lg p-3 text-sm text-white focus:border-emerald-500 outline-none placeholder-neutral-700"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-2">Attach Proof (Screenshot)</label>
            <div className="relative group">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className={`border-2 border-dashed border-neutral-800 rounded-lg p-4 flex flex-col items-center justify-center transition-colors min-h-[120px] ${proofImage ? 'bg-black border-emerald-500/30' : 'hover:border-neutral-600 hover:bg-neutral-900'}`}>
                {proofImage ? (
                  <div className="relative w-full h-32">
                    <img src={proofImage} alt="Proof" className="w-full h-full object-contain" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs text-white transition-opacity">
                      Click to change
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload size={24} className="text-neutral-500 mb-2" />
                    <span className="text-xs text-neutral-500">Click to upload receipt</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-neutral-800 bg-neutral-900">
          <button
            onClick={() => onConfirm(proofFile, transactionId)}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-[0_0_15px_rgba(16,185,129,0.3)]"
          >
            <CheckCircle size={18} />
            {isReceiptOnly ? 'Upload Receipt & Save' : 'Mark as Paid & Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
