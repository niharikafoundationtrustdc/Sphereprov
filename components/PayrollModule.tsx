
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { Supervisor, PayrollRecord, Transaction, LeaveRequest, HostelSettings } from '../types';

interface PayrollModuleProps {
  staff: Supervisor[];
  settings: HostelSettings;
  onUpdateTransactions: (tx: Transaction) => void;
}

const PayrollModule: React.FC<PayrollModuleProps> = ({ staff, settings, onUpdateTransactions }) => {
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'PROCESSING' | 'LEAVES' | 'REPORTS' | 'CONFIG'>('PROCESSING');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  });
  
  const [showPayModal, setShowPayModal] = useState<PayrollRecord | null>(null);
  const [selectedPayslip, setSelectedPayslip] = useState<PayrollRecord | null>(null);

  const epfEmpRate = settings.epfRateEmployee ?? 12;
  const epfEmplrRate = settings.epfRateEmployer ?? 12;
  const esiEmpRate = settings.esiRateEmployee ?? 0.75;
  const esiEmplrRate = settings.esiRateEmployer ?? 3.25;

  useEffect(() => {
    const load = async () => {
      setRecords(await db.payroll.toArray());
      setLeaves(await db.leaveRequests.toArray());
    };
    load();
  }, []);

  const calculateDaysInMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-').map(Number);
    return new Date(year, month, 0).getDate();
  };

  const getLopForStaff = (staffId: string, monthStr: string) => {
    const approvedLeaves = leaves.filter(l => 
      l.staffId === staffId && 
      l.status === 'APPROVED' && 
      l.startDate.startsWith(monthStr) &&
      l.type === 'LWP'
    );
    return approvedLeaves.reduce((acc, l) => {
      const start = new Date(l.startDate);
      const end = new Date(l.endDate);
      const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
      return acc + diff;
    }, 0);
  };

  const handleGeneratePayroll = async () => {
    const daysInMonth = calculateDaysInMonth(selectedMonth);
    const newRecords: PayrollRecord[] = [];
    
    for (const member of staff) {
      if (member.status === 'INACTIVE') continue;
      const existing = records.find(r => r.staffId === member.id && r.month === selectedMonth);
      if (existing) continue;

      const lop = getLopForStaff(member.id, selectedMonth);
      const workedDays = daysInMonth - lop;
      
      const basic = member.basicPay || 0;
      const hra = member.hra || 0;
      const vehicle = member.vehicleAllowance || 0;
      const other = member.otherAllowances || 0;
      
      const proRatedFactor = workedDays / daysInMonth;
      
      const p_basic = basic * proRatedFactor;
      const p_hra = hra * proRatedFactor;
      const p_vehicle = vehicle * proRatedFactor;
      const p_other = other * proRatedFactor;

      const gross = p_basic + p_hra + p_vehicle + p_other;
      
      const epfEmp = (p_basic * epfEmpRate) / 100;
      const epfEmplr = (p_basic * epfEmplrRate) / 100;
      const esiEmp = (gross * esiEmpRate) / 100;
      const esiEmplr = (gross * esiEmplrRate) / 100;

      const rec: PayrollRecord = {
        id: `PAY-${member.id}-${selectedMonth}`,
        staffId: member.id,
        month: selectedMonth,
        daysInMonth,
        workedDays,
        lopDays: lop,
        basicPay: p_basic,
        hra: p_hra,
        vehicleAllowance: p_vehicle,
        otherAllowances: p_other,
        bonus: 0,
        grossEarnings: gross,
        epfEmployee: epfEmp,
        esiEmployee: esiEmp,
        tds: 0,
        loanRecovery: 0,
        otherDeductions: 0,
        totalDeductions: epfEmp + esiEmp,
        epfEmployer: epfEmplr,
        esiEmployer: esiEmplr,
        netSalary: gross - (epfEmp + esiEmp),
        status: 'PENDING'
      };
      newRecords.push(rec);
    }

    if (newRecords.length > 0) {
      await db.payroll.bulkPut(newRecords);
      setRecords([...records, ...newRecords]);
      alert(`Payroll generated for ${newRecords.length} staff members.`);
    } else {
      alert("Payroll already initialized or no active staff found.");
    }
  };

  const handleUpdateRecord = async (id: string, field: keyof PayrollRecord, val: number) => {
    const rec = records.find(r => r.id === id);
    if (!rec) return;
    const updated = { ...rec, [field]: val };
    
    updated.grossEarnings = updated.basicPay + updated.hra + updated.vehicleAllowance + updated.otherAllowances + updated.bonus;
    updated.totalDeductions = updated.epfEmployee + updated.esiEmployee + updated.tds + updated.loanRecovery + updated.otherDeductions;
    updated.netSalary = updated.grossEarnings - updated.totalDeductions;
    
    await db.payroll.put(updated);
    setRecords(records.map(r => r.id === id ? updated : r));
  };

  const processPayment = async (rec: PayrollRecord, method: string) => {
    const updated: PayrollRecord = {
      ...rec,
      status: 'PAID',
      paymentDate: new Date().toISOString(),
      paymentMethod: method
    };
    await db.payroll.put(updated);
    setRecords(records.map(r => r.id === rec.id ? updated : r));

    const staffMember = staff.find(s => s.id === rec.staffId);
    const tx: Transaction = {
      id: `TX-PAY-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      type: 'PAYMENT',
      accountGroup: 'Direct Expense',
      ledger: `${method} Account`,
      amount: rec.netSalary,
      entityName: staffMember?.name || 'Staff',
      description: `Salary Payout ${rec.month}`
    };
    onUpdateTransactions(tx);
    setShowPayModal(null);
  };

  // handleSanctionLeave implementation to process leave requests
  const handleSanctionLeave = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    const leave = leaves.find(l => l.id === id);
    if (!leave) return;
    const updated = { ...leave, status };
    await db.leaveRequests.put(updated);
    setLeaves(leaves.map(l => l.id === id ? updated : l));
    alert(`Leave request ${status.toLowerCase()}.`);
  };

  return (
    <div className="p-4 md:p-8 h-full flex flex-col gap-6 bg-[#f8fafc] animate-in fade-in duration-500 overflow-hidden">
      <div className="bg-white p-6 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 shrink-0">
        <div>
          <h2 className="text-2xl md:text-4xl font-extrabold text-slate-900 uppercase tracking-tighter leading-none">Enterprise Payroll</h2>
          <p className="text-[10px] md:text-[11px] font-bold text-orange-600 uppercase tracking-[0.4em] mt-2">GOI COMPLIANT SALARY ENGINE</p>
        </div>
        <div className="flex flex-wrap gap-2 bg-slate-50 p-2 rounded-2xl border no-print">
           <TabBtn active={activeTab === 'PROCESSING'} label="Salary Registry" onClick={() => setActiveTab('PROCESSING')} />
           <TabBtn active={activeTab === 'LEAVES'} label="Leave Board" onClick={() => setActiveTab('LEAVES')} />
           <TabBtn active={activeTab === 'REPORTS'} label="Payment Reports" onClick={() => setActiveTab('REPORTS')} />
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col gap-6">
        {activeTab === 'PROCESSING' && (
          <div className="bg-white border rounded-[3rem] shadow-xl flex flex-col flex-1 overflow-hidden animate-in slide-in-from-right-4">
             <div className="p-6 md:p-8 border-b bg-slate-50/50 flex justify-between items-center">
                <div className="flex items-center gap-4">
                   <input type="month" className="border-2 p-3 rounded-2xl font-black text-xs bg-white" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
                   <button onClick={handleGeneratePayroll} className="bg-orange-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg">Init Month Flow</button>
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Calculations pro-rated by LOP days</p>
             </div>
             <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[1400px]">
                   <thead className="bg-slate-900 text-white font-black uppercase text-[9px] sticky top-0 z-10">
                      <tr>
                        <th className="p-6">Staff Member</th>
                        <th className="p-6">LOP</th>
                        <th className="p-6">Basic (₹)</th>
                        <th className="p-6">Allowances (₹)</th>
                        <th className="p-6">Bonus (₹)</th>
                        <th className="p-6">EPF/ESI Emp (₹)</th>
                        <th className="p-6">TDS/Others (₹)</th>
                        <th className="p-6 text-right">Net (₹)</th>
                        <th className="p-6 text-center">Action</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y font-bold uppercase text-slate-700">
                      {records.filter(r => r.month === selectedMonth).map(r => {
                         const s = staff.find(sm => sm.id === r.staffId);
                         return (
                           <tr key={r.id} className="hover:bg-orange-50/30 transition-all h-20">
                              <td className="p-6">
                                 <p className="font-black text-blue-900">{s?.name}</p>
                                 <p className="text-[8px] opacity-40">{s?.role}</p>
                              </td>
                              <td className="p-6 text-center">
                                 <span className="bg-red-50 text-red-600 px-3 py-1 rounded-lg text-[10px] font-black">{r.lopDays}d</span>
                              </td>
                              <td className="p-6">
                                 <input type="number" className="w-20 bg-transparent border-b border-transparent focus:border-orange-500 outline-none font-black" value={r.basicPay.toFixed(0)} onChange={e => handleUpdateRecord(r.id, 'basicPay', parseFloat(e.target.value) || 0)} />
                              </td>
                              <td className="p-6">
                                 <p className="text-[10px]">₹{(r.hra + r.vehicleAllowance + r.otherAllowances).toFixed(0)}</p>
                              </td>
                              <td className="p-6">
                                 <input type="number" className="w-20 bg-emerald-50 rounded-lg p-2 outline-none font-black text-green-700" value={r.bonus} onChange={e => handleUpdateRecord(r.id, 'bonus', parseFloat(e.target.value) || 0)} />
                              </td>
                              <td className="p-6">
                                 <p className="text-[10px] text-red-400">₹{(r.epfEmployee + r.esiEmployee).toFixed(0)}</p>
                              </td>
                              <td className="p-6">
                                 <div className="flex gap-2">
                                    <input type="number" placeholder="TDS" className="w-16 border rounded p-1 text-[9px]" value={r.tds} onChange={e => handleUpdateRecord(r.id, 'tds', parseFloat(e.target.value) || 0)} />
                                    <input type="number" placeholder="Misc" className="w-16 border rounded p-1 text-[9px]" value={r.otherDeductions} onChange={e => handleUpdateRecord(r.id, 'otherDeductions', parseFloat(e.target.value) || 0)} />
                                 </div>
                              </td>
                              <td className="p-6 text-right font-black text-lg text-orange-900">₹{r.netSalary.toFixed(0)}</td>
                              <td className="p-6 text-center">
                                 <div className="flex gap-2 justify-center">
                                    <button onClick={() => setSelectedPayslip(r)} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-[9px] font-black">Payslip</button>
                                    {r.status === 'PENDING' ? (
                                      <button onClick={() => setShowPayModal(r)} className="bg-orange-600 text-white px-4 py-2 rounded-xl text-[9px] font-black">Disburse</button>
                                    ) : (
                                      <span className="text-green-600 font-black text-[9px]">PAID</span>
                                    )}
                                 </div>
                              </td>
                           </tr>
                         );
                      })}
                   </tbody>
                </table>
             </div>
          </div>
        )}

        {activeTab === 'LEAVES' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full overflow-hidden animate-in slide-in-from-right-4">
             <div className="lg:col-span-2 bg-white rounded-[3rem] border shadow-sm flex flex-col overflow-hidden">
                <div className="p-8 border-b bg-slate-50/50">
                   <h3 className="text-xl font-black text-blue-900 uppercase">Sanction Dashboard</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Review & Approve Absence Requests</p>
                </div>
                <div className="flex-1 overflow-auto custom-scrollbar p-8">
                   <div className="space-y-4">
                      {leaves.filter(l => l.status === 'PENDING').map(l => (
                         <div key={l.id} className="p-6 bg-slate-50 border rounded-[2rem] flex justify-between items-center group hover:border-orange-500 transition-all">
                            <div className="flex items-center gap-6">
                               <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-xl font-black text-orange-600 shadow-inner">
                                  {staff.find(s => s.id === l.staffId)?.name.charAt(0)}
                               </div>
                               <div>
                                  <p className="font-black text-blue-900 uppercase">{staff.find(s => s.id === l.staffId)?.name}</p>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{l.type} Request • {l.startDate} to {l.endDate}</p>
                                  <p className="text-[10px] text-slate-500 italic mt-2">"{l.reason}"</p>
                               </div>
                            </div>
                            <div className="flex gap-2">
                               <button onClick={() => handleSanctionLeave(l.id, 'APPROVED')} className="bg-green-600 text-white px-6 py-2 rounded-xl font-black text-[9px] uppercase shadow-lg">Approve</button>
                               <button onClick={() => handleSanctionLeave(l.id, 'REJECTED')} className="bg-red-50 text-red-600 px-6 py-2 rounded-xl font-black text-[9px] uppercase border border-red-100">Reject</button>
                            </div>
                         </div>
                      ))}
                      {leaves.filter(l => l.status === 'PENDING').length === 0 && (
                         <div className="py-20 text-center opacity-20">
                            <span className="text-6xl">🗓️</span>
                            <p className="font-black uppercase tracking-widest mt-4">No pending requests</p>
                         </div>
                      )}
                   </div>
                </div>
             </div>
             
             <div className="bg-[#1a0f00] rounded-[3rem] p-10 text-white shadow-2xl flex flex-col gap-8 h-fit">
                <h3 className="text-xl font-black uppercase tracking-tighter text-orange-500 border-b border-white/5 pb-4">Log Leave Request</h3>
                <div className="space-y-6">
                   <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-orange-300 ml-1">Staff Member</label>
                      <select id="leaveStaff" className="w-full bg-white/5 border-2 border-white/10 p-4 rounded-2xl font-black text-xs text-white outline-none">
                         {staff.map(s => <option key={s.id} value={s.id} className="text-slate-900">{s.name}</option>)}
                      </select>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                         <label className="text-[10px] font-black uppercase text-orange-300 ml-1">From</label>
                         <input id="leaveStart" type="date" className="w-full bg-white/5 border-2 border-white/10 p-4 rounded-2xl text-xs" />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-black uppercase text-orange-300 ml-1">To</label>
                         <input id="leaveEnd" type="date" className="w-full bg-white/5 border-2 border-white/10 p-4 rounded-2xl text-xs" />
                      </div>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-orange-300 ml-1">Leave Type</label>
                      <select id="leaveType" className="w-full bg-white/5 border-2 border-white/10 p-4 rounded-2xl font-black text-xs text-white outline-none">
                         <option value="CL" className="text-slate-900">Casual Leave (CL)</option>
                         <option value="SL" className="text-slate-900">Sick Leave (SL)</option>
                         <option value="EL" className="text-slate-900">Earned Leave (EL)</option>
                         <option value="LWP" className="text-slate-900">LWP (Loss of Pay)</option>
                      </select>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-orange-300 ml-1">Reason</label>
                      <textarea id="leaveReason" className="w-full bg-white/5 border-2 border-white/10 p-4 rounded-2xl text-xs h-24 resize-none"></textarea>
                   </div>
                   <button onClick={async () => {
                      const sid = (document.getElementById('leaveStaff') as HTMLSelectElement).value;
                      const start = (document.getElementById('leaveStart') as HTMLInputElement).value;
                      const end = (document.getElementById('leaveEnd') as HTMLInputElement).value;
                      const type = (document.getElementById('leaveType') as HTMLSelectElement).value as any;
                      const reason = (document.getElementById('leaveReason') as HTMLTextAreaElement).value;
                      if(!start || !end) return alert("Select dates");
                      const req: LeaveRequest = { id: `LR-${Date.now()}`, staffId: sid, startDate: start, endDate: end, type, reason, status: 'PENDING' };
                      await db.leaveRequests.put(req);
                      setLeaves([...leaves, req]);
                      alert("Leave request submitted.");
                   }} className="w-full bg-orange-600 text-white py-6 rounded-[2rem] font-black uppercase text-xs shadow-2xl hover:scale-105 transition-all">Submit Protocol</button>
                </div>
             </div>
          </div>
        )}

        {activeTab === 'REPORTS' && (
          <div className="bg-white border rounded-[3rem] shadow-sm flex flex-col flex-1 overflow-hidden animate-in fade-in duration-500">
             <div className="p-8 border-b flex justify-between items-center">
                <div>
                   <h3 className="text-xl font-black text-blue-900 uppercase">Statutory & Payment Report</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Comprehensive monthly liabilities</p>
                </div>
                <button onClick={() => window.print()} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg">Print Summary</button>
             </div>
             <div className="flex-1 overflow-auto custom-scrollbar p-10">
                <table className="w-full text-left border-collapse">
                   <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[9px]">
                      <tr>
                         <th className="p-6">Staff</th>
                         <th className="p-6">Gross Pay</th>
                         <th className="p-6">EPF (E+R)</th>
                         <th className="p-6">ESI (E+R)</th>
                         <th className="p-6">TDS</th>
                         <th className="p-6 text-right">Employer Net Liability</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y font-black uppercase text-slate-700">
                      {records.filter(r => r.month === selectedMonth).map(r => {
                         const s = staff.find(sm => sm.id === r.staffId);
                         return (
                            <tr key={r.id}>
                               <td className="p-6">{s?.name}</td>
                               <td className="p-6 text-blue-600">₹{r.grossEarnings.toFixed(0)}</td>
                               <td className="p-6">₹{(r.epfEmployee + r.epfEmployer).toFixed(0)}</td>
                               <td className="p-6">₹{(r.esiEmployee + r.esiEmployer).toFixed(0)}</td>
                               <td className="p-6">₹{r.tds.toFixed(0)}</td>
                               <td className="p-6 text-right text-orange-900 font-black text-base">₹{(r.grossEarnings + r.epfEmployer + r.esiEmployer).toFixed(0)}</td>
                            </tr>
                         );
                      })}
                   </tbody>
                </table>
             </div>
          </div>
        )}
      </div>

      {showPayModal && (
        <div className="fixed inset-0 z-[250] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-md rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
              <div className="bg-emerald-600 p-10 text-white text-center">
                 <h2 className="text-2xl font-black uppercase tracking-tighter leading-none">Salary Release</h2>
                 <p className="text-[10px] font-bold uppercase opacity-80 mt-2">Payable: ₹{showPayModal.netSalary.toFixed(0)}</p>
              </div>
              <div className="p-12 space-y-8 text-slate-900">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Select Payment Method</label>
                    <div className="grid grid-cols-2 gap-2">
                       {['Cash', 'Bank Transfer', 'UPI', 'Cheque'].map(mode => (
                          <button key={mode} onClick={() => processPayment(showPayModal, mode)} className="py-4 rounded-2xl font-black text-[10px] uppercase border-2 border-slate-100 bg-slate-50 hover:bg-orange-600 hover:border-orange-600 hover:text-white transition-all shadow-sm">{mode}</button>
                       ))}
                    </div>
                 </div>
                 <button onClick={() => setShowPayModal(null)} className="w-full py-5 text-slate-400 font-black uppercase text-[10px] tracking-widest">Cancel</button>
              </div>
           </div>
        </div>
      )}

      {selectedPayslip && (
         <PayslipModal record={selectedPayslip} staff={staff} settings={settings} onClose={() => setSelectedPayslip(null)} />
      )}
    </div>
  );
};

const PayslipModal = ({ record, staff, settings, onClose }: any) => {
   const s = staff.find((m: any) => m.id === record.staffId);
   const monthName = new Date(record.month + '-01').toLocaleString('default', { month: 'long', year: 'numeric' });
   
   return (
      <div className="fixed inset-0 z-[300] bg-slate-900/95 backdrop-blur-md flex flex-col no-print-backdrop">
         <div className="p-4 bg-black flex justify-between items-center no-print">
            <p className="text-white font-black text-[10px] uppercase tracking-widest">Compliance Document Node • {monthName}</p>
            <div className="flex gap-4">
               <button onClick={() => window.print()} className="bg-orange-600 text-white px-8 py-2 rounded-xl font-black text-xs uppercase shadow-xl">Print Payslip</button>
               <button onClick={onClose} className="text-white px-6 py-2 border border-white/20 rounded-xl font-black text-xs uppercase">Close</button>
            </div>
         </div>
         <div className="flex-1 overflow-y-auto p-10 flex justify-center">
            <div className="bg-white w-[210mm] min-h-[297mm] p-16 shadow-2xl invoice-sheet text-slate-900 font-sans uppercase font-bold text-[11px] leading-relaxed">
               <div className="flex justify-between items-start border-b-4 border-slate-900 pb-10 mb-10">
                  <div>
                     <h1 className="text-3xl font-black tracking-tighter leading-none">{settings.name}</h1>
                     <p className="text-[10px] font-bold text-slate-500 mt-2 max-w-sm">{settings.address}</p>
                     <p className="text-[10px] font-black text-orange-600 mt-1">E-PAYSLIP GENERATED VIA HOTELSPHERE PRO</p>
                  </div>
                  <div className="text-right">
                     <h2 className="text-2xl font-black tracking-tighter text-blue-900">PAYSLIP</h2>
                     <p className="text-[10px] text-slate-400 mt-1">{monthName}</p>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-x-20 gap-y-6 mb-12 bg-slate-50 p-10 rounded-[3rem] border">
                  <PayslipInfo label="Employee Name" value={s?.name} />
                  <PayslipInfo label="Emp ID" value={s?.loginId} />
                  <PayslipInfo label="Designation" value={s?.role} />
                  <PayslipInfo label="Bank" value={s?.bankName || 'N/A'} />
                  <PayslipInfo label="A/C No" value={s?.accountNumber || 'N/A'} />
                  <PayslipInfo label="UAN" value={s?.uanNumber || 'N/A'} />
                  <PayslipInfo label="Worked Days" value={`${record.workedDays} / ${record.daysInMonth}`} />
                  <PayslipInfo label="LOP Days" value={record.lopDays} />
               </div>

               <div className="grid grid-cols-2 gap-0 border-2 border-slate-900 rounded-[3rem] overflow-hidden mb-12 shadow-sm">
                  <div className="p-10 border-r-2 border-slate-900">
                     <h3 className="text-lg font-black border-b-2 border-slate-900 pb-4 mb-6">Earnings</h3>
                     <div className="space-y-4">
                        <PayslipLine label="Basic Pay" value={record.basicPay} />
                        <PayslipLine label="House Rent (HRA)" value={record.hra} />
                        <PayslipLine label="Vehicle Allow." value={record.vehicleAllowance} />
                        <PayslipLine label="Special Allow." value={record.otherAllowances} />
                        <PayslipLine label="Performance Bonus" value={record.bonus} />
                     </div>
                  </div>
                  <div className="p-10">
                     <h3 className="text-lg font-black border-b-2 border-slate-900 pb-4 mb-6">Deductions</h3>
                     <div className="space-y-4">
                        <PayslipLine label="Provident Fund (EPF)" value={record.epfEmployee} />
                        <PayslipLine label="ESI Contribution" value={record.esiEmployee} />
                        <PayslipLine label="Income Tax (TDS)" value={record.tds} />
                        <PayslipLine label="Loan Recovery" value={record.loanRecovery} />
                        <PayslipLine label="Misc Deductions" value={record.otherDeductions} />
                     </div>
                  </div>
               </div>

               <div className="bg-slate-900 text-white p-10 rounded-[3rem] flex justify-between items-center shadow-xl">
                  <div>
                     <p className="text-[10px] font-black opacity-60 tracking-[0.3em] mb-1">Take-Home Salary</p>
                     <p className="text-4xl font-black tracking-tighter">₹{record.netSalary.toFixed(0)}</p>
                  </div>
                  <div className="text-right">
                     <p className="text-[10px] font-black opacity-60 tracking-[0.3em] mb-1">Status</p>
                     <p className="text-xl font-black text-green-400">{record.status}</p>
                  </div>
               </div>

               <div className="mt-20 grid grid-cols-2 gap-40 text-center">
                  <div className="border-t-2 pt-4 opacity-30 text-[9px] font-black">EMPLOYEE SIGNATURE</div>
                  <div className="border-t-2 pt-4">
                     {settings.signature && <img src={settings.signature} className="h-8 mx-auto mix-blend-multiply mb-1" />}
                     <p className="text-[9px] font-black">AUTHORIZED SIGNATORY</p>
                  </div>
               </div>

               <div className="mt-24 text-center opacity-30 text-[8px] font-black tracking-[0.5em]">
                  FORM 60 FORMAT COMPLIANT • COMPUTER GENERATED RECORD
               </div>
            </div>
         </div>
      </div>
   );
};

const PayslipInfo = ({ label, value }: any) => (
   <div className="flex flex-col">
      <span className="text-[8px] font-black text-slate-400 tracking-widest">{label}</span>
      <span className="text-[11px] font-black text-slate-800">{value}</span>
   </div>
);

const PayslipLine = ({ label, value }: any) => (
   <div className="flex justify-between items-center">
      <span className="text-[10px] font-black text-slate-600">{label}</span>
      <span className="font-black">₹{value.toFixed(0)}</span>
   </div>
);

const TabBtn = ({ active, label, onClick }: any) => (
  <button onClick={onClick} className={`px-8 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${active ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-400 hover:text-blue-900'}`}>{label}</button>
);

export default PayrollModule;
