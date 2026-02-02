
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { Supervisor, PayrollRecord, Transaction, LeaveRequest, HostelSettings } from '../types';

interface PayrollModuleProps {
  staff: Supervisor[];
  settings: HostelSettings;
  onUpdateTransactions: (tx: Transaction) => void;
}

const PayrollModule: React.FC<PayrollModuleProps> = ({ staff: initialStaff, settings, onUpdateTransactions }) => {
  const [staff, setStaff] = useState<Supervisor[]>(initialStaff);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'PROCESSING' | 'LEAVES' | 'REPORTS' | 'EMPLOYEES'>('PROCESSING');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  });
  
  const [showPayModal, setShowPayModal] = useState<PayrollRecord | null>(null);
  const [selectedPayslip, setSelectedPayslip] = useState<PayrollRecord | null>(null);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [newEmployee, setNewEmployee] = useState<Partial<Supervisor>>({
    role: 'WAITER', status: 'ACTIVE', gender: 'Male', relationshipStatus: 'Single',
    additionalDocs: ['', '', '', '', ''], assignedRoomIds: []
  });

  useEffect(() => {
    const load = async () => {
      setRecords(await db.payroll.toArray());
      setLeaves(await db.leaveRequests.toArray());
      const s = await db.supervisors.toArray();
      setStaff(s);
    };
    load();
  }, [initialStaff]);

  const handleSaveEmployee = async () => {
     if (!newEmployee.name || !newEmployee.loginId) return alert("Validation: Name and Login ID required.");
     const emp: Supervisor = {
        ...newEmployee,
        id: `STF-${Date.now()}`,
        password: newEmployee.password || 'admin'
     } as Supervisor;
     await db.supervisors.put(emp);
     setStaff([...staff, emp]);
     setShowAddEmployee(false);
     setNewEmployee({ role: 'WAITER', status: 'ACTIVE', gender: 'Male', relationshipStatus: 'Single', additionalDocs: ['', '', '', '', ''], assignedRoomIds: [] });
     alert("Employee registered successfully.");
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>, field: string, index?: number) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof index === 'number' && newEmployee.additionalDocs) {
          const next = [...newEmployee.additionalDocs];
          next[index] = reader.result as string;
          setNewEmployee({ ...newEmployee, additionalDocs: next });
        } else {
          setNewEmployee({ ...newEmployee, [field]: reader.result as string });
        }
      };
      reader.readAsDataURL(file);
    }
  };

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
      
      const epfEmp = (p_basic * (settings.epfRateEmployee ?? 12)) / 100;
      const epfEmplr = (p_basic * (settings.epfRateEmployer ?? 12)) / 100;
      const esiEmp = (gross * (settings.esiRateEmployee ?? 0.75)) / 100;
      const esiEmplr = (gross * (settings.esiRateEmployer ?? 3.25)) / 100;

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
    const updated: PayrollRecord = { ...rec, status: 'PAID', paymentDate: new Date().toISOString(), paymentMethod: method };
    await db.payroll.put(updated);
    setRecords(records.map(r => r.id === rec.id ? updated : r));
    const staffMember = staff.find(s => s.id === rec.staffId);
    onUpdateTransactions({ id: `TX-PAY-${Date.now()}`, date: new Date().toISOString().split('T')[0], type: 'PAYMENT', accountGroup: 'Direct Expense', ledger: `${method} Account`, amount: rec.netSalary, entityName: staffMember?.name || 'Staff', description: `Salary Payout ${rec.month}` });
    setShowPayModal(null);
  };

  const handleSanctionLeave = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    const leave = leaves.find(l => l.id === id);
    if (!leave) return;
    const updated = { ...leave, status };
    await db.leaveRequests.put(updated);
    setLeaves(leaves.map(l => l.id === id ? updated : l));
  };

  return (
    <div className="p-4 md:p-8 h-full flex flex-col gap-6 bg-[#f8fafc] animate-in fade-in duration-500 overflow-hidden">
      <div className="bg-white p-6 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 shrink-0">
        <div>
          <h2 className="text-2xl md:text-4xl font-extrabold text-slate-900 uppercase tracking-tighter leading-none">Enterprise Payroll</h2>
          <p className="text-[10px] md:text-[11px] font-bold text-orange-600 uppercase tracking-[0.4em] mt-2">GOI COMPLIANT SALARY ENGINE</p>
        </div>
        <div className="flex flex-wrap gap-2 bg-slate-50 p-2 rounded-2xl border no-print">
           <TabBtn active={activeTab === 'PROCESSING'} label="Salary Flow" onClick={() => setActiveTab('PROCESSING')} />
           <TabBtn active={activeTab === 'EMPLOYEES'} label="Personnel Master" onClick={() => setActiveTab('EMPLOYEES')} />
           <TabBtn active={activeTab === 'LEAVES'} label="Leaves" onClick={() => setActiveTab('LEAVES')} />
           <TabBtn active={activeTab === 'REPORTS'} label="Payment Reports" onClick={() => setActiveTab('REPORTS')} />
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col gap-6">
        {activeTab === 'PROCESSING' && (
          <div className="bg-white border rounded-[3rem] shadow-xl flex flex-col flex-1 overflow-hidden animate-in slide-in-from-right-4">
             <div className="p-6 md:p-8 border-b bg-slate-50/50 flex justify-between items-center">
                <div className="flex items-center gap-4">
                   <input type="month" className="border-2 border-slate-100 p-3 rounded-2xl font-black text-xs bg-white text-slate-900" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
                   <button onClick={handleGeneratePayroll} className="bg-blue-900 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg">Generate Sheet</button>
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
                   <tbody className="divide-y font-bold uppercase text-slate-700 bg-white">
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
                                 <input type="number" className="w-20 bg-white border border-slate-100 p-2 rounded-lg font-black text-slate-900" value={r.basicPay.toFixed(0)} onChange={e => handleUpdateRecord(r.id, 'basicPay', parseFloat(e.target.value) || 0)} />
                              </td>
                              <td className="p-6 text-[10px]">₹{(r.hra + r.vehicleAllowance + r.otherAllowances).toFixed(0)}</td>
                              <td className="p-6">
                                 <input type="number" className="w-20 bg-white border border-slate-100 p-2 rounded-lg font-black text-green-700" value={r.bonus} onChange={e => handleUpdateRecord(r.id, 'bonus', parseFloat(e.target.value) || 0)} />
                              </td>
                              <td className="p-6 text-[10px] text-red-400">₹{(r.epfEmployee + r.esiEmployee).toFixed(0)}</td>
                              <td className="p-6">
                                 <div className="flex gap-2">
                                    <input type="number" placeholder="TDS" className="w-16 border bg-white rounded p-1 text-[9px] text-slate-900" value={r.tds} onChange={e => handleUpdateRecord(r.id, 'tds', parseFloat(e.target.value) || 0)} />
                                    <input type="number" placeholder="Misc" className="w-16 border bg-white rounded p-1 text-[9px] text-slate-900" value={r.otherDeductions} onChange={e => handleUpdateRecord(r.id, 'otherDeductions', parseFloat(e.target.value) || 0)} />
                                 </div>
                              </td>
                              <td className="p-6 text-right font-black text-lg text-blue-900">₹{r.netSalary.toFixed(0)}</td>
                              <td className="p-6 text-center">
                                 <div className="flex gap-2 justify-center">
                                    <button onClick={() => setSelectedPayslip(r)} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-[9px] font-black uppercase">Payslip</button>
                                    {r.status === 'PENDING' ? (
                                      <button onClick={() => setShowPayModal(r)} className="bg-orange-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase">Release</button>
                                    ) : (
                                      <span className="text-green-600 font-black text-[9px] uppercase">PAID</span>
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

        {activeTab === 'EMPLOYEES' && (
          <div className="flex flex-col gap-6 animate-in slide-in-from-right-4 h-full overflow-hidden">
             <div className="flex justify-between items-center bg-white p-8 rounded-[2.5rem] border shadow-sm shrink-0">
                <div>
                   <h3 className="text-2xl font-black text-slate-900 uppercase">Staff Directory</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Full Service Personnel Management</p>
                </div>
                <button onClick={() => setShowAddEmployee(true)} className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-xl">+ Onboard New Staff</button>
             </div>
             <div className="flex-1 overflow-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                   {staff.map(s => (
                      <div key={s.id} className="bg-white border rounded-[3rem] p-8 shadow-sm flex flex-col justify-between hover:shadow-lg transition-all group">
                         <div>
                            <div className="flex justify-between items-start mb-6">
                               <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center overflow-hidden border-2 border-slate-100 shadow-inner">
                                  {s.photo ? <img src={s.photo} className="w-full h-full object-cover" /> : <span className="text-3xl font-black text-blue-900">{s.name.charAt(0)}</span>}
                               </div>
                               <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase ${s.status === 'ACTIVE' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{s.status}</span>
                            </div>
                            <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tight leading-none">{s.name}</h4>
                            <p className="text-[10px] font-bold text-blue-600 uppercase mt-2 tracking-widest">{s.role}</p>
                            <div className="mt-6 space-y-2">
                               <div className="flex justify-between text-[10px] font-bold text-slate-400"><span className="uppercase">Contact</span><span className="text-slate-700">{s.phone}</span></div>
                               <div className="flex justify-between text-[10px] font-bold text-slate-400"><span className="uppercase">Nominee</span><span className="text-slate-700">{s.nominee || 'NOT SET'}</span></div>
                               <div className="flex justify-between text-[10px] font-bold text-slate-400"><span className="uppercase">Net Pay</span><span className="text-blue-900 font-black">₹{s.basicPay}</span></div>
                            </div>
                         </div>
                         <button onClick={() => { setNewEmployee(s); setShowAddEmployee(true); }} className="mt-8 w-full bg-slate-50 py-3 rounded-2xl font-black text-[9px] uppercase text-slate-400 hover:bg-blue-900 hover:text-white transition-all">View Full File</button>
                      </div>
                   ))}
                </div>
             </div>
          </div>
        )}
      </div>

      {showAddEmployee && (
        <div className="fixed inset-0 z-[250] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-5xl rounded-[3.5rem] shadow-3xl overflow-hidden animate-in zoom-in flex flex-col max-h-[95vh]">
              <div className="bg-blue-900 p-8 text-white flex justify-between items-center shrink-0">
                 <div>
                   <h3 className="text-2xl font-black uppercase tracking-tighter">Personnel Master Authorization</h3>
                   <p className="text-[10px] uppercase font-bold text-blue-300 mt-1">Compliance Form 60 - Employee Onboarding</p>
                 </div>
                 <button onClick={() => setShowAddEmployee(false)} className="uppercase text-[10px] font-black opacity-60">Cancel Discard</button>
              </div>
              <div className="flex-1 overflow-y-auto p-12 custom-scrollbar bg-white text-slate-900">
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    {/* Part 1: Core Details */}
                    <div className="space-y-6">
                       <SectionLabel label="Core Identity" />
                       <Inp label="Legal Name" value={newEmployee.name} onChange={v => setNewEmployee({...newEmployee, name: v})} />
                       <div className="grid grid-cols-2 gap-4">
                          <Inp label="Date of Birth" type="date" value={newEmployee.dob} onChange={v => setNewEmployee({...newEmployee, dob: v})} />
                          <div className="space-y-1">
                             <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Gender</label>
                             <select className="w-full border-2 bg-white border-slate-100 p-4 rounded-2xl font-black text-xs text-slate-900 outline-none" value={newEmployee.gender} onChange={e => setNewEmployee({...newEmployee, gender: e.target.value as any})}>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                             </select>
                          </div>
                       </div>
                       <Inp label="Relationship Status" value={newEmployee.relationshipStatus} onChange={v => setNewEmployee({...newEmployee, relationshipStatus: v})} placeholder="Single / Married" />
                       <Inp label="Father's Name" value={newEmployee.fatherName} onChange={v => setNewEmployee({...newEmployee, fatherName: v})} />
                       <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Profile Photo</label>
                          <div className="h-32 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex items-center justify-center relative overflow-hidden group shadow-inner">
                             {newEmployee.photo ? <img src={newEmployee.photo} className="w-full h-full object-cover" /> : <span className="text-[8px] font-black text-slate-300">Snap/Upload</span>}
                             <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleFile(e, 'photo')} />
                          </div>
                       </div>
                    </div>

                    {/* Part 2: Contact & Docs */}
                    <div className="space-y-6">
                       <SectionLabel label="Contact & Compliance" />
                       <div className="grid grid-cols-2 gap-4">
                          <Inp label="Primary Mobile" value={newEmployee.phone} onChange={v => setNewEmployee({...newEmployee, phone: v})} />
                          <Inp label="Alternate Contact" value={newEmployee.alternatePhone} onChange={v => setNewEmployee({...newEmployee, alternatePhone: v})} />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Current Residential Address</label>
                          <textarea className="w-full border-2 bg-white border-slate-100 p-4 rounded-2xl font-black text-xs text-slate-900 h-20 outline-none" value={newEmployee.address} onChange={e => setNewEmployee({...newEmployee, address: e.target.value})}></textarea>
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Family / Permanent Address</label>
                          <textarea className="w-full border-2 bg-white border-slate-100 p-4 rounded-2xl font-black text-xs text-slate-900 h-20 outline-none" value={newEmployee.familyAddress} onChange={e => setNewEmployee({...newEmployee, familyAddress: e.target.value})}></textarea>
                       </div>
                       
                       <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Main Identification Doc</label>
                          <div className="h-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center relative overflow-hidden group">
                             {newEmployee.idDocument ? <img src={newEmployee.idDocument} className="w-full h-full object-cover" /> : <span className="text-[8px] font-black text-slate-300">Upload ID Card</span>}
                             <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleFile(e, 'idDocument')} />
                          </div>
                       </div>
                    </div>

                    {/* Part 3: Banking & Documents */}
                    <div className="space-y-6">
                       <SectionLabel label="Financials & Vault" />
                       <div className="grid grid-cols-2 gap-4">
                          <Inp label="Bank Name" value={newEmployee.bankName} onChange={v => setNewEmployee({...newEmployee, bankName: v})} />
                          <Inp label="Branch" value={newEmployee.bankBranch} onChange={v => setNewEmployee({...newEmployee, bankBranch: v})} />
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                          <Inp label="Account No" value={newEmployee.accountNumber} onChange={v => setNewEmployee({...newEmployee, accountNumber: v})} />
                          <Inp label="IFSC Code" value={newEmployee.bankIfsc} onChange={v => setNewEmployee({...newEmployee, bankIfsc: v})} />
                       </div>
                       <Inp label="Nominee Full Name" value={newEmployee.nominee} onChange={v => setNewEmployee({...newEmployee, nominee: v})} />
                       <div className="grid grid-cols-2 gap-4">
                          <Inp label="Basic Salary (₹)" type="number" value={newEmployee.basicPay?.toString()} onChange={v => setNewEmployee({...newEmployee, basicPay: parseFloat(v)})} />
                          <div className="space-y-1">
                             <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Portal Role</label>
                             <select className="w-full border-2 bg-white border-slate-100 p-4 rounded-2xl font-black text-xs text-slate-900 outline-none" value={newEmployee.role} onChange={e => setNewEmployee({...newEmployee, role: e.target.value as any})}>
                                <option value="RECEPTIONIST">Receptionist</option>
                                <option value="MANAGER">Manager</option>
                                <option value="SUPERVISOR">Supervisor</option>
                                <option value="CHEF">Chef</option>
                                <option value="WAITER">Waiter</option>
                             </select>
                          </div>
                       </div>
                       <Inp label="Portal Login ID (Email)" value={newEmployee.loginId} onChange={v => setNewEmployee({...newEmployee, loginId: v})} />
                       
                       <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Additional KYC Vault (5 Slots)</label>
                          <div className="grid grid-cols-5 gap-2">
                             {[0,1,2,3,4].map(idx => (
                                <div key={idx} className="aspect-square bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center relative overflow-hidden group shadow-inner">
                                   {newEmployee.additionalDocs?.[idx] ? <img src={newEmployee.additionalDocs[idx]} className="w-full h-full object-cover" /> : <span className="text-[8px] font-black text-slate-300">#{idx+1}</span>}
                                   <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleFile(e, 'additionalDocs', idx)} />
                                </div>
                             ))}
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
              <div className="p-8 bg-slate-50 border-t flex gap-4 shrink-0">
                 <button onClick={() => setShowAddEmployee(false)} className="flex-1 py-4 text-slate-400 font-black uppercase text-xs tracking-widest">Discard</button>
                 <button onClick={handleSaveEmployee} className="flex-[3] bg-blue-900 text-white py-4 rounded-2xl font-black uppercase text-sm shadow-xl hover:scale-[1.02] transition-all">Authorize Employee Record</button>
              </div>
           </div>
        </div>
      )}

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
                  <div><h1 className="text-3xl font-black tracking-tighter leading-none">{settings.name}</h1><p className="text-[10px] font-bold text-slate-500 mt-2 max-w-sm">{settings.address}</p></div>
                  <div className="text-right"><h2 className="text-2xl font-black tracking-tighter text-blue-900">PAYSLIP</h2><p className="text-[10px] text-slate-400 mt-1">{monthName}</p></div>
               </div>
               <div className="grid grid-cols-2 gap-x-20 gap-y-6 mb-12 bg-slate-50 p-10 rounded-[3rem] border"><PayslipInfo label="Employee Name" value={s?.name} /><PayslipInfo label="Emp ID" value={s?.loginId} /><PayslipInfo label="Designation" value={s?.role} /><PayslipInfo label="Bank" value={s?.bankName || 'N/A'} /><PayslipInfo label="A/C No" value={s?.accountNumber || 'N/A'} /><PayslipInfo label="UAN" value={s?.uanNumber || 'N/A'} /><PayslipInfo label="Worked Days" value={`${record.workedDays} / ${record.daysInMonth}`} /><PayslipInfo label="LOP Days" value={record.lopDays} /></div>
               <div className="grid grid-cols-2 border-2 border-slate-900 rounded-[3rem] overflow-hidden mb-12 shadow-sm"><div className="p-10 border-r-2 border-slate-900"><h3 className="text-lg font-black border-b-2 border-slate-900 pb-4 mb-6">Earnings</h3><div className="space-y-4"><PayslipLine label="Basic Pay" value={record.basicPay} /><PayslipLine label="HRA" value={record.hra} /><PayslipLine label="Vehicle" value={record.vehicleAllowance} /><PayslipLine label="Bonus" value={record.bonus} /></div></div><div className="p-10"><h3 className="text-lg font-black border-b-2 border-slate-900 pb-4 mb-6">Deductions</h3><div className="space-y-4"><PayslipLine label="EPF" value={record.epfEmployee} /><PayslipLine label="ESI" value={record.esiEmployee} /><PayslipLine label="TDS" value={record.tds} /><PayslipLine label="Others" value={record.otherDeductions} /></div></div></div>
               <div className="bg-slate-900 text-white p-10 rounded-[3rem] flex justify-between items-center shadow-xl"><div><p className="text-[10px] font-black opacity-60 tracking-[0.3em] mb-1">Take-Home Salary</p><p className="text-4xl font-black tracking-tighter">₹{record.netSalary.toFixed(0)}</p></div><div className="text-right"><p className="text-[10px] font-black opacity-60 tracking-[0.3em] mb-1">Status</p><p className="text-xl font-black text-green-400">{record.status}</p></div></div>
               <div className="mt-20 grid grid-cols-2 gap-40 text-center"><div className="border-t-2 pt-4 opacity-30 text-[9px] font-black">EMPLOYEE SIGNATURE</div><div className="border-t-2 pt-4">{settings.signature && <img src={settings.signature} className="h-8 mx-auto mix-blend-multiply mb-1" />}<p className="text-[9px] font-black">AUTHORIZED SIGNATORY</p></div></div>
            </div>
         </div>
      </div>
   );
};

const PayslipInfo = ({ label, value }: any) => (<div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 tracking-widest">{label}</span><span className="text-[11px] font-black text-slate-800">{value}</span></div>);
const PayslipLine = ({ label, value }: any) => (<div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-600">{label}</span><span className="font-black">₹{value.toFixed(0)}</span></div>);
const TabBtn = ({ active, label, onClick }: any) => (
  <button onClick={onClick} className={`px-8 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shrink-0 ${active ? 'bg-blue-900 text-white shadow-lg' : 'text-slate-400 hover:text-blue-900'}`}>{label}</button>
);
const SectionLabel = ({ label }: { label: string }) => (
  <div className="flex items-center gap-3 border-b-2 border-slate-100 pb-3 mb-2">
     <div className="w-1 h-4 bg-blue-600 rounded-full"></div>
     <p className="text-[11px] font-black uppercase text-blue-900 tracking-widest">{label}</p>
  </div>
);
const Inp = ({ label, value, onChange, type = "text", placeholder = "" }: any) => (
  <div className="space-y-1.5 w-full text-left">
    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest leading-none">{label}</label>
    <input type={type} className="w-full bg-white border border-slate-100 p-4 rounded-2xl font-bold text-sm text-slate-900 outline-none focus:border-blue-500 transition-all shadow-sm" value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
  </div>
);

export default PayrollModule;
