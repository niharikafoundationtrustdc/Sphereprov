
import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType, Guest, Booking, Quotation, AccountGroupName, Room } from '../types';
import InvoiceView from './InvoiceView';

interface AccountingProps {
  transactions: Transaction[];
  setTransactions: (transactions: Transaction[]) => void;
  guests: Guest[];
  bookings: Booking[];
  quotations: Quotation[];
  setQuotations: (quotations: Quotation[]) => void;
  settings: any;
  rooms: Room[];
}

const Accounting: React.FC<AccountingProps> = ({ transactions, setTransactions, bookings, guests, rooms, settings }) => {
  const [activeTab, setActiveTab] = useState<'ENTRY' | 'LEDGER' | 'CASHBOOK' | 'ARCHIVE'>('ENTRY');
  const [type, setType] = useState<TransactionType>('RECEIPT');
  const [amount, setAmount] = useState('');
  const [ledger, setLedger] = useState('Cash Account');
  const [group, setGroup] = useState<AccountGroupName>('Operating');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [desc, setDesc] = useState('');
  const [targetGuest, setTargetGuest] = useState('');
  const [selectedLedger, setSelectedLedger] = useState('Cash Account');
  
  // Archive states
  const [archiveSearch, setArchiveSearch] = useState('');
  const [viewingBooking, setViewingBooking] = useState<Booking | null>(null);

  const [reportStart, setReportStart] = useState(new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0]);
  const [reportEnd, setReportEnd] = useState(new Date().toISOString().split('T')[0]);

  const ACCOUNT_GROUPS: AccountGroupName[] = [
    'Capital', 'Fixed Asset', 'Current Asset', 'Direct Expense', 'Indirect Expense', 
    'Direct Income', 'Indirect Income', 'Current Liability', 'Operating'
  ];

  const ledgers = useMemo(() => Array.from(new Set(transactions.map(t => t.ledger))), [transactions]);

  const handleEntry = () => {
    if (!amount || !ledger) return alert("Please fill Amount and Ledger.");
    const newTx: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      date,
      type, 
      amount: parseFloat(amount) || 0, 
      ledger, 
      description: desc,
      accountGroup: group,
      entityName: targetGuest || 'General Node'
    };
    setTransactions([...transactions, newTx]);
    setAmount(''); setDesc(''); setTargetGuest('');
    alert(`Financial entry posted.`);
  };

  const ledgerTransactions = useMemo(() => transactions.filter(t => t.ledger === selectedLedger && t.date >= reportStart && t.date <= reportEnd), [transactions, selectedLedger, reportStart, reportEnd]);
  const cashbookTransactions = useMemo(() => transactions.filter(t => t.ledger.toLowerCase().includes('cash') && t.date >= reportStart && t.date <= reportEnd), [transactions, reportStart, reportEnd]);
  
  const filteredArchive = useMemo(() => {
    if (!archiveSearch) return bookings.slice(-50).reverse();
    const low = archiveSearch.toLowerCase();
    return bookings.filter(b => {
      const g = guests.find(guest => guest.id === b.guestId);
      return b.bookingNo.toLowerCase().includes(low) || g?.name.toLowerCase().includes(low) || g?.phone.includes(low);
    }).reverse();
  }, [bookings, guests, archiveSearch]);

  return (
    <div className="p-4 md:p-8 bg-[#f8fafc] h-full flex flex-col gap-8 text-black">
      <div className="flex gap-1 overflow-x-auto no-print scrollbar-hide pb-2 border-b">
        <Tab active={activeTab === 'ENTRY'} onClick={() => setActiveTab('ENTRY')}>New Entry</Tab>
        <Tab active={activeTab === 'LEDGER'} onClick={() => setActiveTab('LEDGER')}>General Ledger</Tab>
        <Tab active={activeTab === 'CASHBOOK'} onClick={() => setActiveTab('CASHBOOK')}>Cash Register</Tab>
        <Tab active={activeTab === 'ARCHIVE'} onClick={() => setActiveTab('ARCHIVE')}>Invoice Archive (Duplicates)</Tab>
      </div>

      <div className="flex-1 bg-white rounded-[3rem] shadow-sm border p-6 md:p-12 overflow-y-auto custom-scrollbar">
        {activeTab === 'ENTRY' && (
          <div className="max-w-4xl space-y-12 animate-in fade-in duration-300">
             <div className="border-l-[10px] border-blue-900 pl-8">
               <h2 className="text-3xl font-black text-black uppercase tracking-tighter">Voucher Portal</h2>
               <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">Compliance Posting Node</p>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Field label="Voucher Date">
                   <input type="date" className="w-full border-2 border-slate-100 p-4 rounded-2xl font-black text-xs bg-slate-50 text-slate-900 outline-none focus:bg-white focus:border-blue-600 transition-all" value={date} onChange={e => setDate(e.target.value)} />
                </Field>
                <Field label="Type">
                   <select className="w-full border-2 border-slate-100 p-4 rounded-2xl font-black text-xs bg-slate-50 text-slate-900 outline-none focus:bg-white focus:border-blue-600 transition-all" value={type} onChange={e => setType(e.target.value as any)}>
                      <option value="RECEIPT">RECEIPT (+)</option>
                      <option value="PAYMENT">PAYMENT (-)</option>
                   </select>
                </Field>
                <Field label="Group">
                   <select className="w-full border-2 border-slate-100 p-4 rounded-2xl font-black text-xs bg-slate-50 text-slate-900 outline-none focus:bg-white focus:border-blue-600 transition-all" value={group} onChange={e => setGroup(e.target.value as any)}>
                      {ACCOUNT_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                   </select>
                </Field>
                <Field label="Entity Name">
                   <input className="w-full border-2 border-slate-100 p-4 rounded-2xl font-black text-xs bg-slate-50 text-slate-900 outline-none focus:bg-white focus:border-blue-600 transition-all" value={targetGuest} onChange={e => setTargetGuest(e.target.value)} placeholder="Resident / Company" />
                </Field>
                <Field label="Ledger">
                   <input className="w-full border-2 border-slate-100 p-4 rounded-2xl font-black text-xs bg-slate-50 text-slate-900 outline-none focus:bg-white focus:border-blue-600 transition-all" value={ledger} onChange={e => setLedger(e.target.value)} placeholder="Cash / Bank / Online" />
                </Field>
                <Field label="Amount (₹)">
                   <input type="number" className="w-full border-2 border-slate-100 p-4 rounded-2xl font-black text-lg bg-blue-50/30 text-blue-900 outline-none focus:bg-white focus:border-blue-600 transition-all" value={amount} onChange={e => setAmount(e.target.value)} />
                </Field>
                <div className="col-span-full">
                   <Field label="Narration">
                      <textarea className="w-full border-2 border-slate-100 p-5 rounded-[2rem] font-bold text-xs h-32 resize-none bg-slate-50 text-slate-900 outline-none focus:bg-white focus:border-blue-600 transition-all" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Explanation..."></textarea>
                   </Field>
                </div>
             </div>
             <button onClick={handleEntry} className="bg-blue-900 text-white font-black px-12 py-5 rounded-3xl text-xs uppercase shadow-xl tracking-[0.2em] hover:bg-black transition-all">Authorize Entry</button>
          </div>
        )}

        {activeTab === 'ARCHIVE' && (
          <div className="space-y-10 animate-in fade-in duration-300">
             <div className="flex justify-between items-end border-b pb-8">
                <div>
                   <h2 className="text-3xl font-black text-black uppercase tracking-tighter leading-none">Invoice Archive</h2>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Duplicate Bill Generator & History</p>
                </div>
                <div className="w-80">
                   <input 
                     type="text" 
                     placeholder="Search by Name, Phone, Bill No..." 
                     className="w-full border-2 border-slate-200 p-3.5 rounded-2xl font-black text-[11px] bg-slate-50 text-slate-900 outline-none focus:border-blue-900 transition-all shadow-sm"
                     value={archiveSearch}
                     onChange={e => setArchiveSearch(e.target.value)}
                   />
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredArchive.map(b => {
                   const g = guests.find(guest => guest.id === b.guestId);
                   const r = rooms.find(rm => rm.id === b.roomId);
                   return (
                      <div key={b.id} className="bg-slate-50 border-2 rounded-[2.5rem] p-8 flex flex-col justify-between hover:border-blue-600 hover:bg-white transition-all group shadow-sm">
                         <div>
                            <div className="flex justify-between items-start mb-6">
                               <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase ${b.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{b.status}</span>
                               <span className="text-[10px] font-bold text-slate-300">#{b.bookingNo.slice(-6)}</span>
                            </div>
                            <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">{g?.name || 'Unknown Guest'}</h4>
                            <p className="text-[11px] font-bold text-slate-500 uppercase mt-2">Unit {r?.number} • {b.checkInDate}</p>
                         </div>
                         <button 
                           onClick={() => setViewingBooking(b)}
                           className="mt-10 bg-white border-2 border-slate-200 py-3.5 rounded-2xl font-black uppercase text-[10px] group-hover:bg-blue-900 group-hover:border-blue-900 group-hover:text-white transition-all shadow-sm"
                         >
                            Print Duplicate Bill
                         </button>
                      </div>
                   );
                })}
             </div>
          </div>
        )}

        {(activeTab === 'LEDGER' || activeTab === 'CASHBOOK') && (
          <div className="space-y-10 animate-in fade-in duration-300">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b pb-8">
                <h2 className="text-3xl font-black text-black uppercase tracking-tighter leading-none">{activeTab}</h2>
                <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border">
                   <input type="date" className="bg-white p-2 rounded-xl text-[10px] font-black text-slate-900" value={reportStart} onChange={e => setReportStart(e.target.value)} />
                   <span className="text-xs font-black text-slate-400">TO</span>
                   <input type="date" className="bg-white p-2 rounded-xl text-[10px] font-black text-slate-900" value={reportEnd} onChange={e => setReportEnd(e.target.value)} />
                </div>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                   <thead className="bg-slate-900 text-white font-black uppercase">
                      <tr><th className="p-6">Date</th><th className="p-6">Narration</th><th className="p-6 text-right">Debit</th><th className="p-6 text-right">Credit</th></tr>
                   </thead>
                   <tbody className="divide-y font-bold uppercase text-slate-700">
                      {(activeTab === 'LEDGER' ? ledgerTransactions : cashbookTransactions).map(t => (
                        <tr key={t.id} className="hover:bg-slate-50">
                           <td className="p-6 opacity-50">{t.date}</td>
                           <td className="p-6">{t.description}</td>
                           <td className="p-6 text-right text-red-600">{t.type === 'PAYMENT' ? `₹${t.amount}` : '-'}</td>
                           <td className="p-6 text-right text-green-700">{t.type === 'RECEIPT' ? `₹${t.amount}` : '-'}</td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        )}
      </div>

      {viewingBooking && (
         <div className="fixed inset-0 z-[200] bg-slate-900 flex flex-col overflow-hidden no-print-backdrop">
            <div className="bg-black p-4 flex justify-between items-center no-print">
               <div className="flex gap-4">
                  <button onClick={() => window.print()} className="bg-blue-600 text-white px-8 py-2 rounded-xl font-black text-xs uppercase shadow-xl">Print Duplicate</button>
                  <button onClick={() => setViewingBooking(null)} className="text-white px-8 py-2 border border-white/20 rounded-xl font-black text-xs uppercase hover:bg-white/10">Close [X]</button>
               </div>
               <p className="text-white font-black uppercase text-[10px] opacity-40">DUPLICATE BILL RE-PRINT PROTOCOL</p>
            </div>
            <div className="flex-1 overflow-y-auto bg-gray-500/20 p-4 md:p-10 custom-scrollbar">
               <InvoiceView 
                  guest={guests.find(g => g.id === viewingBooking.guestId)!}
                  booking={viewingBooking}
                  room={rooms.find(r => r.id === viewingBooking.roomId)!}
                  settings={settings}
                  payments={viewingBooking.payments || []}
               />
            </div>
         </div>
      )}
    </div>
  );
};

const Tab: React.FC<{ active: boolean, onClick: () => void, children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button onClick={onClick} className={`px-6 md:px-10 py-3 md:py-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shrink-0 ${active ? 'bg-blue-900 text-white shadow-lg' : 'bg-transparent text-slate-400 hover:text-blue-900 hover:bg-slate-50'}`}>{children}</button>
);

const Field: React.FC<{ label: string, children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1.5">
     <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">{label}</label>
     {children}
  </div>
);

export default Accounting;
