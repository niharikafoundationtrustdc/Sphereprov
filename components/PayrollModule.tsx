
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { Supervisor, PayrollRecord, Transaction } from '../types';

interface PayrollModuleProps {
  staff: Supervisor[];
  settings: any;
  onUpdateTransactions: (tx: Transaction) => void;
}

const PayrollModule: React.FC<PayrollModuleProps> = ({ staff, settings, onUpdateTransactions }) => {
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  });
  const [activeTab, setActiveTab] = useState<'SHEET' | 'HISTORY'>('SHEET');
  const [showPayModal, setShowPayModal] = useState<PayrollRecord | null>(null);

  useEffect(() => {
    db.payroll.toArray().then(setRecords);
  }, []);

  const monthSheet = useMemo(() => {
    return staff.map(member => {
      const record = records.find(r => r.staffId === member.id && r.month === selectedMonth);
      return {
        member,
        record
      };
    });
  }, [staff, records, selectedMonth]);

  const handleGeneratePayroll = async () => {
    const newRecords: PayrollRecord[] = [];
    for (const member of staff) {
      if (!records.find(r => r.staffId === member.id && r.month === selectedMonth)) {
        const rec: PayrollRecord = {
          id: `PAY-${member.id}-${selectedMonth}`,
          staffId: member.id,
          month: selectedMonth,
          baseSalary: member.baseSalary || 15000,
          allowances: 0,
          deductions: 0,
          netSalary: member.baseSalary || 15000,
          status: 'PENDING'
        };
        newRecords.push(rec);
      }
    }
    if (newRecords.length > 0) {
      await db.payroll.bulkPut(newRecords);
      setRecords([...records, ...newRecords]);
      alert(`Generated payroll for ${newRecords.length} staff members for ${selectedMonth}`);
    } else {
      alert("Payroll already generated for this month.");
    }
  };

  const handleProcessPayment = async (rec: PayrollRecord, method: string) => {
    const updated: PayrollRecord = {
      ...rec,
      status: 'PAID',
      paymentDate: new Date().toISOString(),
      paymentMethod: method
    };
    await db.payroll.put(updated);
    setRecords(records.map(r => r.id === rec.id ? updated : r));

    // Log to accounting
    const staffName = staff.find(s => s.id === rec.staffId)?.name || 'Staff';
    const tx: Transaction = {
      id: `TX-PAY-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      type: 'PAYMENT',
      accountGroup: 'Direct Expense',
      ledger: `${method} Account`,
      amount: rec.netSalary,
      entityName: staffName,
      description: `Salary Payment for ${rec.month}`
    };
    onUpdateTransactions(tx);
    setShowPayModal(null);
    alert(`Salary processed for ${staffName}. Receipt logged.`);
  };

  const updateRecord = async (id: string, field: keyof PayrollRecord, value: number) => {
    const rec = records.find(r => r.id === id);
    if (!rec) return;
    const updated = { ...rec, [field]: value };
    updated.netSalary = updated.baseSalary + updated.allowances - updated.deductions;
    await db.payroll.put(updated);
    setRecords(records.map(r => r.id === id ? updated : r));
  };

  return (
    <div className="p-4 md:p-8 h-full flex flex-col gap-6 bg-[#f8fafc] animate-in fade-in duration-500">
      <div className="bg-white p-6 md:p-10 rounded-[2.5rem] shadow-sm border flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-2xl md:text-4xl font-extrabold text-slate-900 uppercase tracking-tighter leading-none">Staff Payroll</h2>
          <p className="text-[10px] md:text-[11px] font-bold text-orange-600 uppercase tracking-[0.4em] mt-2">Salary, Disbursement & Ledger</p>
        </div>
        <div className="flex flex-wrap gap-4 items-center">
           <input 
             type="month" 
             className="border-2 p-3 rounded-2xl font-black text-xs bg-slate-50 outline-none focus:border-orange-500" 
             value={selectedMonth} 
             onChange={e => setSelectedMonth(e.target.value)} 
           />
           <button onClick={handleGeneratePayroll} className="bg-orange-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-black transition-all">Init Month Sheet</button>
        </div>
      </div>

      <div className="bg-white border-2 rounded-[3rem] shadow-xl overflow-hidden flex flex-col flex-1">
         <div className="overflow-x-auto custom-scrollbar flex-1">
            <table className="w-full text-left border-collapse">
               <thead className="bg-slate-900 text-white font-black uppercase sticky top-0 z-10">
                  <tr>
                    <th className="p-6">Staff Member</th>
                    <th className="p-6">Base Salary (₹)</th>
                    <th className="p-6">Allowances (₹)</th>
                    <th className="p-6">Deductions (₹)</th>
                    <th className="p-6 text-right">Net Pay (₹)</th>
                    <th className="p-6 text-center">Status</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50 font-bold uppercase text-slate-700 bg-white">
                  {monthSheet.map(({ member, record }) => (
                    <tr key={member.id} className="hover:bg-orange-50/30 h-24">
                       <td className="p-6">
                          <p className="text-orange-900 font-black text-sm">{member.name}</p>
                          <p className="text-[8px] text-slate-400 tracking-widest mt-1">{member.role}</p>
                       </td>
                       <td className="p-6">
                          {record ? (
                             <input 
                               type="number" 
                               className="w-24 border-b-2 border-transparent focus:border-orange-500 bg-transparent outline-none font-black text-blue-900" 
                               value={record.baseSalary} 
                               onChange={e => updateRecord(record.id, 'baseSalary', parseFloat(e.target.value) || 0)} 
                             />
                          ) : '-'}
                       </td>
                       <td className="p-6">
                          {record ? (
                             <input 
                               type="number" 
                               className="w-24 border-b-2 border-transparent focus:border-orange-500 bg-transparent outline-none font-black text-emerald-600" 
                               value={record.allowances} 
                               onChange={e => updateRecord(record.id, 'allowances', parseFloat(e.target.value) || 0)} 
                             />
                          ) : '-'}
                       </td>
                       <td className="p-6">
                          {record ? (
                             <input 
                               type="number" 
                               className="w-24 border-b-2 border-transparent focus:border-orange-500 bg-transparent outline-none font-black text-rose-600" 
                               value={record.deductions} 
                               onChange={e => updateRecord(record.id, 'deductions', parseFloat(e.target.value) || 0)} 
                             />
                          ) : '-'}
                       </td>
                       <td className="p-6 text-right font-black text-xl text-orange-900">
                          {record ? `₹${record.netSalary.toFixed(0)}` : '-'}
                       </td>
                       <td className="p-6 text-center">
                          {record ? (
                             record.status === 'PAID' ? (
                                <span className="bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full text-[9px] font-black border border-emerald-100">Disbursed</span>
                             ) : (
                                <button onClick={() => setShowPayModal(record)} className="bg-orange-600 text-white px-6 py-2 rounded-xl text-[9px] font-black uppercase shadow-md hover:bg-black transition-all">Release Pay</button>
                             )
                          ) : (
                             <span className="text-slate-300 italic text-[9px]">Not Initialized</span>
                          )}
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

      {showPayModal && (
        <div className="fixed inset-0 z-[250] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-md rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
              <div className="bg-orange-600 p-10 text-white text-center">
                 <h2 className="text-2xl font-black uppercase tracking-tighter leading-none">Salary Release</h2>
                 <p className="text-[10px] font-bold uppercase opacity-80 mt-2">Payable: ₹{showPayModal.netSalary.toFixed(0)}</p>
              </div>
              <div className="p-12 space-y-8 text-slate-900">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Select Payment Method</label>
                    <div className="grid grid-cols-2 gap-2">
                       {['Cash', 'Bank Transfer', 'UPI', 'Cheque'].map(mode => (
                          <button 
                            key={mode} 
                            onClick={() => handleProcessPayment(showPayModal, mode)} 
                            className="py-4 rounded-2xl font-black text-[10px] uppercase border-2 border-slate-100 bg-slate-50 hover:bg-orange-600 hover:border-orange-600 hover:text-white transition-all shadow-sm"
                          >
                            {mode}
                          </button>
                       ))}
                    </div>
                 </div>
                 <button onClick={() => setShowPayModal(null)} className="w-full py-5 text-slate-400 font-black uppercase text-[10px] tracking-widest">Cancel Disbursement</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ label, value, color }: any) => (
   <div className={`${color} p-8 rounded-[3rem] text-white shadow-xl relative overflow-hidden group`}>
      <p className="text-[10px] font-black uppercase opacity-60 tracking-widest mb-3">{label}</p>
      <p className="text-3xl font-black tracking-tighter">{value}</p>
   </div>
);

const SubTab = ({ active, label, onClick }: any) => (
  <button onClick={onClick} className={`px-8 py-3 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest ${active ? 'bg-orange-600 text-white shadow-xl' : 'text-slate-400 hover:bg-white hover:text-orange-900'}`}>{label}</button>
);

export default PayrollModule;
