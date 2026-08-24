
import React from 'react';
import { X, AlertTriangle, Trash2, Loader2, School } from 'lucide-react';

interface SchoolDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  schoolName: string;
  isDeleting: boolean;
  isDarkMode?: boolean;
  monitoringId?: string;
  customerCode?: string;
}

const SchoolDeleteModal: React.FC<SchoolDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  schoolName,
  isDeleting,
  isDarkMode = false,
  monitoringId,
  customerCode
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      <div className={`relative w-full max-w-[420px] rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-100 text-slate-800'
      }`}>
        <div className="p-8 sm:p-10 flex flex-col items-center text-center">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-inner relative ${
            isDarkMode ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-500'
          }`}>
            <School size={32} className="opacity-20 absolute" />
            <AlertTriangle size={36} className="relative z-10" />
          </div>
          
          <h3 className={`text-2xl font-black tracking-tight mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Delete Monitoring Record?
          </h3>

          <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
            {monitoringId && (
              <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-brand-orange/10 text-brand-orange border border-brand-orange/20">
                {monitoringId}
              </span>
            )}
            {customerCode && (
              <span className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold ${
                isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
              }`}>
                {customerCode}
              </span>
            )}
          </div>

          <p className={`text-sm font-medium leading-relaxed mb-6 px-2 ${
            isDarkMode ? 'text-slate-400' : 'text-slate-500'
          }`}>
            Are you sure you want to permanently delete the monitoring entry for{' '}
            <strong className={`font-black underline decoration-red-500/40 decoration-2 underline-offset-4 ${
              isDarkMode ? 'text-slate-100' : 'text-slate-900'
            }`}>
              {schoolName}
            </strong>
            ? This action will remove the entire row from School Monitoring.
          </p>

          <div className="flex flex-col w-full gap-3">
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="w-full py-3.5 bg-red-500 hover:bg-red-600 active:scale-98 text-white rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest shadow-lg shadow-red-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isDeleting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Deleting Record...
                </>
              ) : (
                <>
                  <Trash2 size={18} />
                  Delete Permanently
                </>
              )}
            </button>
            <button
              onClick={onClose}
              disabled={isDeleting}
              className={`w-full py-3.5 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest transition-all cursor-pointer ${
                isDarkMode ? 'bg-slate-800 hover:bg-slate-750 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              Cancel
            </button>
          </div>
        </div>
        
        <button 
          onClick={onClose}
          className={`absolute top-6 right-6 p-2 rounded-lg transition-colors cursor-pointer ${
            isDarkMode ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
          }`}
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
};

export default SchoolDeleteModal;
