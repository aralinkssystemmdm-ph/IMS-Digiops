import React from 'react';
import { Ban, RotateCcw, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface CancelRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  controlNo: string;
  schoolName?: string;
  isProcessing: boolean;
  isDarkMode?: boolean;
  mode?: 'cancel' | 'undo';
}

const CancelRequestModal: React.FC<CancelRequestModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  controlNo,
  schoolName,
  isProcessing,
  isDarkMode = false,
  mode = 'cancel'
}) => {
  if (!isOpen) return null;

  const isUndo = mode === 'undo';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" 
        onClick={onClose} 
      />
      <div className={`relative w-full max-w-[460px] rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${
        isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'
      }`}>
        <div className="p-8 flex flex-col items-center text-center">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-inner ${
            isUndo
              ? (isDarkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600')
              : (isDarkMode ? 'bg-rose-500/10 text-rose-400' : 'bg-rose-50 text-rose-500')
          }`}>
            {isUndo ? <RotateCcw size={36} /> : <Ban size={36} />}
          </div>
          
          <h3 className={`text-2xl font-black tracking-tight mb-2 ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
            {isUndo ? 'Undo Cancellation?' : 'Cancel Item Request?'}
          </h3>
          
          <p className={`text-sm font-medium leading-relaxed mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {isUndo ? (
              <>
                You are about to restore request <span className={`font-black ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{controlNo}</span>
                {schoolName ? <> for <span className={`font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{schoolName}</span></> : ''}.
              </>
            ) : (
              <>
                Are you sure you want to cancel request <span className={`font-black ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{controlNo}</span>
                {schoolName ? <> for <span className={`font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{schoolName}</span></> : ''}?
              </>
            )}
          </p>

          <div className={`w-full text-left p-4 rounded-xl mb-6 text-xs space-y-2 border ${
            isUndo
              ? (isDarkMode ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300' : 'bg-emerald-50/70 border-emerald-200 text-emerald-800')
              : (isDarkMode ? 'bg-rose-950/20 border-rose-800/40 text-rose-300' : 'bg-rose-50/70 border-rose-200 text-rose-800')
          }`}>
            {isUndo ? (
              <>
                <div className="flex items-start gap-2 font-medium">
                  <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-emerald-500" />
                  <span>The request row will return to active status with full opacity.</span>
                </div>
                <div className="flex items-start gap-2 font-medium">
                  <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-emerald-500" />
                  <span>PO assignment and deliverables processing will be re-enabled.</span>
                </div>
                <div className="flex items-start gap-2 font-medium">
                  <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-emerald-500" />
                  <span>The automated date for <strong>Stage 3 (Creation of Item request)</strong> in School Monitoring will be re-synced.</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-2 font-medium">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5 text-rose-500" />
                  <span>The row will not be deleted, but will appear faded in the list.</span>
                </div>
                <div className="flex items-start gap-2 font-medium">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5 text-rose-500" />
                  <span>Action buttons and PO assignment will be disabled.</span>
                </div>
                <div className="flex items-start gap-2 font-medium">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5 text-rose-500" />
                  <span>The automated date for <strong>Stage 3 (Creation of Item request)</strong> in School Monitoring will be removed.</span>
                </div>
                <div className="flex items-start gap-2 font-medium">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5 text-rose-500" />
                  <span>You can undo this cancellation at any time.</span>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col w-full gap-3">
            <button
              onClick={onConfirm}
              disabled={isProcessing}
              className={`w-full py-3.5 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isUndo
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                  : 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Processing...
                </>
              ) : isUndo ? (
                <>
                  <RotateCcw size={18} />
                  Confirm Undo Cancel
                </>
              ) : (
                <>
                  <Ban size={18} />
                  Confirm Cancel Request
                </>
              )}
            </button>
            <button
              onClick={onClose}
              disabled={isProcessing}
              className={`w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all cursor-pointer ${
                isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'
              }`}
            >
              {isUndo ? 'Keep Cancelled' : 'Keep Request Active'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CancelRequestModal;
