
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, CheckCircle2, AlertCircle, Loader2, Plus, Trash2, Hash, Box, History, Calendar, User, Info, ArrowRightLeft, PackageCheck, Edit2, Check } from 'lucide-react';
import { toTitleCase, cleanPONumber } from '../lib/utils';
import { RequestData } from './ItemsRequest';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useNotification } from './NotificationProvider';

interface ItemVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: RequestData | null;
  onConfirm: () => void;
  onNavigate?: (viewId: string, params?: any) => void;
  isDarkMode?: boolean;
}

interface DeliveryHistory {
  id: string;
  created_at: string;
  item_code: string;
  quantity: number;
  created_by: string;
  reason?: string;
  item_name?: string;
  serials?: string[];
}

const ItemVerificationModal: React.FC<ItemVerificationModalProps> = ({ 
  isOpen, 
  onClose, 
  request, 
  onConfirm,
  onNavigate,
  isDarkMode = false 
}) => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  const [history, setHistory] = useState<DeliveryHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedSerials, setExpandedSerials] = useState<Record<string, boolean>>({});

  const [selectedPOIndex, setSelectedPOIndex] = useState<number | null>(null);

  // State for editing date received
  const [editingDateGroupKey, setEditingDateGroupKey] = useState<string | null>(null);
  const [tempDateValue, setTempDateValue] = useState<string>('');
  const [savingDateGroupKey, setSavingDateGroupKey] = useState<string | null>(null);

  const poList = useMemo(() => {
    if (!request?.poNumber) return [];

    // Calculate received per PO from history to determine completion status
    const receivedPerPO: Record<string, Record<string, number>> = {};
    history.forEach(tx => {
      if (tx.reason?.includes('PO:')) {
        const poMatch = tx.reason.match(/PO:([^|]+)/);
        if (poMatch) {
          const poNum = poMatch[1].trim();
          if (!receivedPerPO[poNum]) receivedPerPO[poNum] = {};
          receivedPerPO[poNum][tx.item_code] = (receivedPerPO[poNum][tx.item_code] || 0) + (parseInt(tx.quantity as any) || 0);
        }
      }
    });

    const parts = request.poNumber.split(';').map(p => p.trim()).filter(Boolean);
    return parts.map(part => {
      // Regex to match: PO_NUMBER [SUPPLIER] {CODE:QTY,...}
      const match = part.match(/^(.*?)\s*(?:\[(.*?)\])?\s*\{(.*)\}$|^(.*?)\s*\[(.*?)\]$|^(.*)$/);
      
      let poNum = '';
      let qtiesRaw = '';
      let supplier = '';

      if (match) {
        if (match[1] !== undefined) {
          poNum = match[1].trim();
          supplier = match[2]?.trim() || '';
          qtiesRaw = match[3].trim();
        } else if (match[4] !== undefined) {
          poNum = match[4].trim();
          supplier = match[5]?.trim() || '';
        } else {
          poNum = match[6].trim();
        }
      } else {
        poNum = part.trim();
      }
      
      const items: Record<string, number> = {};
      if (qtiesRaw) {
        qtiesRaw.split(',').forEach(q => {
          const [code, qty] = q.split(':').map(s => s.trim());
          if (code && qty) items[code] = parseInt(qty) || 0;
        });
      }

      // Check if all items in this PO are complete
      let isComplete = true;
      let hasItems = false;
      Object.entries(items).forEach(([code, targetQty]) => {
        hasItems = true;
        const received = receivedPerPO[poNum]?.[code] || 0;
        if (received < targetQty) isComplete = false;
      });

      return { poNum, items, supplier, isComplete: hasItems && isComplete };
    });
  }, [request?.poNumber, history]);

  const toggleSerials = (id: string) => {
    setExpandedSerials(prev => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    if (isOpen) {
      setSelectedPOIndex(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (isOpen && request && isSupabaseConfigured) {
        setLoading(true);
        try {
          // Fetch transactions sorted by date ASC (to help with serial assignment)
          const { data: transactions, error } = await supabase
            .from('stock_transactions')
            .select('*')
            .eq('reference_id', request.id)
            .eq('transaction_type', 'Delivery')
            .order('created_at', { ascending: true });

          if (error) throw error;
          
          if (transactions && transactions.length > 0) {
            const itemCodes = Array.from(new Set(transactions.map(d => d.item_code)));
            
            // Fetch item descriptions
            const { data: itemsData } = await supabase
              .from('equipment')
              .select('item_code, description')
              .in('item_code', itemCodes);
            
            // Fetch serials for this request
            const { data: serialsData } = await supabase
              .from('item_serials')
              .select('item_code, serial_number, created_at')
              .eq('request_id', request.id)
              .order('created_at', { ascending: true });

            // Group serials by item_code to distribute them across transactions
            const serialsByItem: Record<string, string[]> = {};
            if (serialsData) {
              serialsData.forEach(s => {
                if (!serialsByItem[s.item_code]) serialsByItem[s.item_code] = [];
                serialsByItem[s.item_code].push(s.serial_number);
              });
            }

            // Assign serials to transactions in chronological order
            // We use a copy of serialsByItem so we can shift/splice them
            const serialsQueue = JSON.parse(JSON.stringify(serialsByItem));
            
            const historyWithDetails = transactions.map(d => {
              const itemSerials = serialsQueue[d.item_code] 
                ? serialsQueue[d.item_code].splice(0, d.quantity)
                : [];

              return {
                ...d,
                item_name: itemsData?.find(i => i.item_code === d.item_code)?.description || d.item_code,
                serials: itemSerials
              };
            });

            // Set state (reversing back to DESC for display)
            setHistory([...historyWithDetails].reverse());
          } else {
            setHistory([]);
          }
        } catch (err) {
          console.error('Error fetching delivery history:', err);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchHistory();
  }, [isOpen, request]);

  const formatDateDisplay = (dateStr: string | undefined | null) => {
    if (!dateStr) return '';
    const str = String(dateStr);
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, y, m, d] = match;
      const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
      return dateObj.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      });
    }
    const dateObj = new Date(str);
    return isNaN(dateObj.getTime()) ? str : dateObj.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
  };

  const groupedHistory = useMemo(() => {
    const groups: { 
      date: string; 
      items: { 
        id: string; 
        name: string; 
        code: string; 
        qty: number; 
        received_by: string;
        reason: string;
        serials?: string[];
        created_at?: string;
      }[] 
    }[] = [];
    
    history.forEach(tx => {
      const date = formatDateDisplay(tx.created_at);
      
      let existing = groups.find(g => g.date === date);
      if (!existing) {
        existing = { date, items: [] };
        groups.push(existing);
      }

      existing.items.push({
        id: tx.id,
        name: tx.item_name || tx.item_code,
        code: tx.item_code,
        qty: tx.quantity,
        received_by: tx.created_by,
        reason: tx.reason || 'No remarks',
        serials: tx.serials,
        created_at: tx.created_at
      });
    });
    
    return groups;
  }, [history]);

  if (!isOpen || !request) return null;

  const handleSaveDate = async (group: { date: string; items: any[] }) => {
    if (!tempDateValue || !request) return;
    setSavingDateGroupKey(group.date);
    try {
      const [year, month, day] = tempDateValue.split('-').map(Number);
      if (!year || !month || !day) throw new Error('Please select a valid date');

      // Set to 12:00:00 UTC to ensure consistency across timezones
      const newIsoString = `${tempDateValue}T12:00:00.000Z`;

      const transactionIds = group.items.map(it => it.id);

      if (isSupabaseConfigured) {
        const { error: txError } = await supabase
          .from('stock_transactions')
          .update({ created_at: newIsoString })
          .in('id', transactionIds);

        if (txError) throw txError;

        // Also update matching item_serials created_at if any exist for this request
        const itemCodes = group.items.map(it => it.code);
        if (itemCodes.length > 0) {
          try {
            await supabase
              .from('item_serials')
              .update({ created_at: newIsoString })
              .eq('request_id', request.id)
              .in('item_code', itemCodes);
          } catch (serialErr) {
            console.warn('Could not update item_serials created_at:', serialErr);
          }
        }

        // Also update item_requests delivered_at
        try {
          await supabase
            .from('item_requests')
            .update({ delivered_at: newIsoString })
            .eq('control_no', request.id);
        } catch (reqErr) {
          console.warn('Could not update item_requests delivered_at:', reqErr);
        }
      }

      // Update local state immediately
      setHistory(prev => prev.map(item => {
        if (transactionIds.includes(item.id)) {
          return { ...item, created_at: newIsoString };
        }
        return item;
      }));

      const formattedSavedDate = formatDateDisplay(newIsoString);
      showSuccess('Date Updated', `Delivery date updated successfully to ${formattedSavedDate}`);
      setEditingDateGroupKey(null);
      if (onConfirm) onConfirm();
    } catch (err: any) {
      console.error('Error updating delivery date:', err);
      showError('Update Failed', err.message || 'Could not update delivery date');
    } finally {
      setSavingDateGroupKey(null);
    }
  };

  const handleProceed = () => {
    if (request.status === 'Cancelled') return;
    const selectedPO = selectedPOIndex !== null ? poList[selectedPOIndex] : null;
    const hasItems = selectedPO?.items && Object.keys(selectedPO.items).length > 0;
    
    navigate(`/requests/${request.id}/serial-entry`, { 
      state: { 
        selectedPO: selectedPO?.poNum || null,
        poItems: hasItems ? selectedPO.items : null
      } 
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className={`relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 ${
        isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'
      }`}>
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">
              {request.status === 'Delivered' ? toTitleCase('Delivery Records') : toTitleCase('Verify Received Items')}
            </h2>
            <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-1 tracking-wider uppercase flex flex-wrap gap-x-4">
              <span>Control No: <span className="text-[#FE4E02]">{request.id}</span></span>
              {request.ticketNo && (
                 <span>Ticket No: <span className="text-[#FE4E02]">{request.ticketNo}</span></span>
              )}
              {request.poNumber && (
                <span>PO No: <span className="text-[#0081f1]">{cleanPONumber(request.poNumber)}</span></span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 dark:text-slate-500">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-8">
          {/* PO Selection Section - Only if there are POs and it's not fully delivered */}
          {request.status !== 'Delivered' && poList.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <PackageCheck size={14} className="text-[#0081f1]" />
                Select PO to Process
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {poList.map((po, idx) => (
                  <button
                    key={idx}
                    onClick={() => !po.isComplete && setSelectedPOIndex(idx)}
                    disabled={po.isComplete}
                    className={`relative p-4 rounded-2xl border-2 text-left transition-all group ${
                      po.isComplete 
                        ? 'opacity-50 cursor-not-allowed grayscale' 
                        : selectedPOIndex === idx 
                          ? 'border-[#FE4E02] bg-[#FE4E02]/5 shadow-lg shadow-[#FE4E02]/10 scale-[1.02]' 
                          : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-black tracking-tight ${selectedPOIndex === idx ? 'text-[#FE4E02]' : 'text-slate-800 dark:text-white'}`}>
                        {po.poNum}
                      </span>
                      {po.isComplete ? (
                        <CheckCircle2 size={16} className="text-emerald-500" />
                      ) : selectedPOIndex === idx ? (
                        <div className="w-4 h-4 rounded-full border-4 border-[#FE4E02]" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-300 pointer-events-none" />
                      )}
                    </div>
                    {po.supplier && (
                      <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        <User size={10} />
                        {po.supplier}
                      </div>
                    )}
                    {po.isComplete && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-50/20 dark:bg-slate-900/10 backdrop-blur-[1px] rounded-2xl">
                         <span className="bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">Complete</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <History size={14} className="text-[#FE4E02]" />
              Delivery Records
            </h3>

            {loading ? (
              <div className="flex flex-col items-center py-12 gap-3">
                <Loader2 className="animate-spin text-[#FE4E02]" size={32} />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fetching history...</p>
              </div>
            ) : history.length > 0 ? (
              <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse table-fixed">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50">
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 w-[22%]">
                        Date Received
                      </th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 w-[36%]">
                        Item
                      </th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 w-[10%] text-center">
                        Qty
                      </th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 w-[16%]">
                        Received By
                      </th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 w-[16%]">
                        Remarks
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                    {groupedHistory.map((group, groupIdx) => (
                      <React.Fragment key={group.date}>
                        {group.items.map((item, itemIdx) => {
                          const isFirstInGroup = itemIdx === 0;
                          return (
                            <tr 
                              key={item.id} 
                              className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors ${
                                isFirstInGroup && groupIdx > 0 ? 'border-t-2 border-slate-200/90 dark:border-slate-700/90' : ''
                              }`}
                            >
                              {/* Date Received Column with Rowspan and Editable Capability */}
                              {isFirstInGroup && (
                                <td 
                                  rowSpan={group.items.length} 
                                  className="px-4 py-3.5 align-top border-r border-slate-100 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-900/30"
                                >
                                  {editingDateGroupKey === group.date ? (
                                    <div className="flex flex-col gap-2 p-2 bg-white dark:bg-slate-800 rounded-xl border border-[#FE4E02]/60 shadow-md">
                                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        Edit Date
                                      </label>
                                      <input
                                        type="date"
                                        value={tempDateValue}
                                        onChange={(e) => setTempDateValue(e.target.value)}
                                        className="text-[11px] font-bold px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-[#FE4E02] w-full"
                                      />
                                      <div className="flex items-center justify-end gap-1.5 pt-1">
                                        <button
                                          type="button"
                                          onClick={() => setEditingDateGroupKey(null)}
                                          disabled={savingDateGroupKey === group.date}
                                          className="px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[10px] font-bold transition-colors"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleSaveDate(group)}
                                          disabled={savingDateGroupKey === group.date || !tempDateValue}
                                          className="px-2.5 py-1 rounded-lg bg-[#FE4E02] hover:bg-[#E04502] text-white text-[10px] font-black flex items-center gap-1 shadow-sm transition-all disabled:opacity-50"
                                        >
                                          {savingDateGroupKey === group.date ? (
                                            <Loader2 size={11} className="animate-spin" />
                                          ) : (
                                            <Check size={11} />
                                          )}
                                          <span>Save</span>
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between gap-1.5 group/date">
                                      <div className="flex flex-col">
                                        <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                          {group.date}
                                        </span>
                                        <span className="text-[9px] font-medium text-slate-400">
                                          {group.items.length} item{group.items.length !== 1 ? 's' : ''}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingDateGroupKey(group.date);
                                          const firstTx = group.items[0];
                                          const origCreatedAt = firstTx?.created_at || history.find(h => h.id === firstTx?.id)?.created_at;
                                          const match = origCreatedAt ? String(origCreatedAt).match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
                                          if (match) {
                                            setTempDateValue(`${match[1]}-${match[2]}-${match[3]}`);
                                          } else {
                                            const d = new Date(origCreatedAt || group.date);
                                            if (!isNaN(d.getTime())) {
                                              const yyyy = d.getFullYear();
                                              const mm = String(d.getMonth() + 1).padStart(2, '0');
                                              const dd = String(d.getDate()).padStart(2, '0');
                                              setTempDateValue(`${yyyy}-${mm}-${dd}`);
                                            } else {
                                              setTempDateValue('');
                                            }
                                          }
                                        }}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-[#FE4E02] hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors opacity-70 group-hover/date:opacity-100"
                                        title="Edit Date Received"
                                      >
                                        <Edit2 size={12} />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              )}

                              {/* Item Column */}
                              <td className="px-4 py-3.5 align-middle">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[11px] font-bold text-slate-800 dark:text-white leading-snug">
                                    {item.name}
                                  </span>
                                  {item.code && item.code !== item.name && (
                                    <span className="text-[9px] font-mono text-slate-400">
                                      {item.code}
                                    </span>
                                  )}
                                  {item.serials && item.serials.length > 0 && (
                                    <div className="mt-1">
                                      <button 
                                        type="button"
                                        onClick={() => toggleSerials(item.id)}
                                        className="flex items-center gap-1 text-[#FE4E02] text-[9px] font-black uppercase tracking-widest hover:opacity-80 transition-all w-fit"
                                      >
                                        <Hash size={10} />
                                        {expandedSerials[item.id] ? 'Hide Serials' : `Show Serials (${item.serials.length})`}
                                      </button>
                                      {expandedSerials[item.id] && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                          {item.serials.map((sn, snIdx) => (
                                            <span key={snIdx} className="px-1.5 py-0.5 bg-white dark:bg-slate-800 text-[8px] font-mono font-bold text-slate-500 dark:text-slate-400 rounded border border-slate-100 dark:border-slate-700 shadow-sm">
                                              {sn}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Qty Column */}
                              <td className="px-4 py-3.5 align-middle text-center">
                                <span className="text-[11px] font-black text-[#FE4E02]">
                                  {item.qty}
                                </span>
                              </td>

                              {/* Received By Column */}
                              <td className="px-4 py-3.5 align-middle font-bold text-slate-600 dark:text-slate-300 break-words" title={item.received_by}>
                                {item.received_by || '—'}
                              </td>

                              {/* Remarks Column */}
                              <td className="px-4 py-3.5 align-middle font-medium text-slate-400 dark:text-slate-500 italic break-words">
                                {item.reason || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                <History size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">No delivery history yet</p>
              </div>
            )}
          </div>
        </div>

        <footer className={`px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex items-center gap-4 shrink-0 justify-between`}>
          <button 
            onClick={onClose}
            className="px-6 py-2.5 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
          >
            {request.status === 'Delivered' ? 'Close' : 'Cancel'}
          </button>
          
          {request.status === 'Delivered' ? (
            <button 
              onClick={() => {
                onClose();
                onConfirm?.();
                if (onNavigate) {
                  onNavigate('inventory', { inventoryTab: 'transfer', openTransfer: true });
                } else {
                  navigate('/inventory');
                }
              }}
              className="bg-[#FE4E02] hover:bg-[#E04502] text-white px-8 py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-[#FE4E02]/20 active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
            >
              <ArrowRightLeft size={16} />
              <span>Proceed to Transfer</span>
            </button>
          ) : request.status === 'Cancelled' ? (
            <button 
              disabled
              className="px-8 py-2.5 rounded-xl font-bold text-xs bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed uppercase tracking-widest"
            >
              <span>Delivery Disabled (Cancelled)</span>
            </button>
          ) : (
            <button 
              onClick={handleProceed}
              disabled={poList.length > 0 && selectedPOIndex === null}
              className={`px-8 py-2.5 rounded-xl font-bold text-xs shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest ${
                poList.length > 0 && selectedPOIndex === null
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-[#FE4E02] hover:bg-[#E04502] text-white shadow-[#FE4E02]/20'
              }`}
            >
              <CheckCircle2 size={16} />
              <span>Check Items</span>
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};

export default ItemVerificationModal;
