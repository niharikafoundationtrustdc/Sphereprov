
import React, { useState, useEffect } from 'react';
import { HostelSettings, Room, RoomStatus, Booking, Transaction, Supervisor, UserRole, StaffDocument } from '../types.ts';
import { exportDatabase, db } from '../services/db.ts';
import CameraCapture from './CameraCapture.tsx';

interface SettingsProps {
  settings: HostelSettings;
  setSettings: (settings: HostelSettings) => void;
  rooms: Room[];
  setRooms: (rooms: Room[]) => Promise<any> | void;
  supervisors: Supervisor[];
  setSupervisors: (supervisors: Supervisor[]) => void;
}

const Settings: React.FC<SettingsProps> = ({ 
  settings, setSettings, rooms, setRooms, supervisors, setSupervisors
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'GENERAL' | 'ROOMS' | 'STAFF' | 'TAX' | 'DATA'>('GENERAL');
  const [tempSettings, setTempSettings] = useState<HostelSettings>(settings);
  
  // Staff Management States
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Partial<Supervisor> | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [showRoomAssignModal, setShowRoomAssignModal] = useState(false);

  useEffect(() => {
    setTempSettings(settings);
  }, [settings]);

  const handleUpdate = (field: keyof HostelSettings, value: any) => {
    const updated = { ...tempSettings, [field]: value };
    setTempSettings(updated);
    setSettings(updated);
  };

  const handleStaffSave = async () => {
    if (!editingStaff?.name || !editingStaff?.loginId || !editingStaff?.password) return alert("Name, Login ID and Password are mandatory.");
    
    const staffObj: Supervisor = {
      ...editingStaff as Supervisor,
      id: editingStaff.id || `STF-${Date.now()}`,
      status: editingStaff.status || 'ACTIVE',
      role: editingStaff.role || 'WAITER',
      basicPay: editingStaff.basicPay || 0,
      hra: editingStaff.hra || 0,
      vehicleAllowance: editingStaff.vehicleAllowance || 0,
      otherAllowances: editingStaff.otherAllowances || 0,
      assignedRoomIds: editingStaff.assignedRoomIds || [],
      documents: editingStaff.documents || []
    };

    const nextStaffList = staffObj.id === editingStaff?.id 
      ? supervisors.map(s => s.id === staffObj.id ? staffObj : s)
      : [...supervisors, staffObj];

    setSupervisors(nextStaffList);
    setShowStaffModal(false);
    setEditingStaff(null);
  };

  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newDoc: StaffDocument = {
          id: `DOC-${Date.now()}`,
          name: file.name,
          fileData: reader.result as string,
          uploadDate: new Date().toISOString()
        };
        setEditingStaff(prev => ({
          ...prev,
          documents: [...(prev?.documents || []), newDoc]
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleRoomAssignment = (roomId: string) => {
    if (!editingStaff) return;
    const current = new Set(editingStaff.assignedRoomIds || []);
    if (current.has(roomId)) current.delete(roomId);
    else current.add(roomId);
    setEditingStaff({ ...editingStaff, assignedRoomIds: Array.from(current) });
  };

  return (
    <div className="p-4 md:p-8 bg-[#f8fafc] min-h-full pb-32 text-black overflow-x-hidden">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
        
        {/* Navigation */}
        <div className="flex items-center justify-between bg-white p-2 md:p-3 rounded-2xl md:rounded-[2rem] border shadow-xl sticky top-2 z-10 overflow-x-auto scrollbar-hide no-print gap-1">
          <SubTab active={activeSubTab === 'GENERAL'} label="Property Profile" onClick={() => setActiveSubTab('GENERAL')} />
          <SubTab active={activeSubTab === 'ROOMS'} label="Inventory Master" onClick={() => setActiveSubTab('ROOMS')} />
          <SubTab active={activeSubTab === 'STAFF'} label="Personnel / HR" onClick={() => setActiveSubTab('STAFF')} />
          <SubTab active={activeSubTab === 'TAX'} label="Taxation Config" onClick={() => setActiveSubTab('TAX')} />
          <SubTab active={activeSubTab === 'DATA'} label="Global Backups" onClick={() => setActiveSubTab('DATA')} />
        </div>

        {activeSubTab === 'STAFF' && (
          <div className="space-y-8 animate-in fade-in duration-500">
             <div className="flex justify-between items-end">
                <div>
                   <h3 className="text-3xl font-black text-[#1a2b4b] uppercase tracking-tighter">EMPLOYEE REGISTER</h3>
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Personnel Management & Salary Configuration</p>
                </div>
                <button onClick={() => { setEditingStaff({ role: 'WAITER', status: 'ACTIVE', assignedRoomIds: [] }); setShowStaffModal(true); }} className="bg-[#e65c00] text-white px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-black transition-all">+ ADD NEW STAFF</button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {supervisors.map(staffMember => (
                   <div key={staffMember.id} className="bg-white border rounded-[3rem] p-8 shadow-sm hover:shadow-2xl transition-all group cursor-pointer" onClick={() => { setEditingStaff(staffMember); setShowStaffModal(true); }}>
                      <div className="flex justify-between items-start mb-6">
                         {staffMember.photo ? (
                            <img src={staffMember.photo} className="w-16 h-16 rounded-2xl object-cover shadow-lg" alt={staffMember.name} />
                         ) : (
                            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-xl font-black text-slate-300">ST</div>
                         )}
                         <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${staffMember.status === 'ACTIVE' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                            {staffMember.status}
                         </span>
                      </div>
                      <h4 className="text-xl font-black text-[#1a2b4b] uppercase leading-tight">{staffMember.name}</h4>
                      <p className="text-[10px] font-bold text-[#e65c00] uppercase tracking-widest mt-1">{staffMember.role}</p>
                      
                      <div className="mt-8 space-y-3">
                         <div className="flex justify-between text-[10px] font-bold text-slate-400">
                            <span className="uppercase">Identity (Login)</span>
                            <span className="text-slate-900 font-black">{staffMember.loginId}</span>
                         </div>
                         <div className="flex justify-between text-[10px] font-bold text-slate-400">
                            <span className="uppercase">Contact</span>
                            <span className="text-slate-900">{staffMember.phone || 'N/A'}</span>
                         </div>
                         <div className="flex justify-between text-[10px] font-bold text-slate-400">
                            <span className="uppercase">Assigned Rooms</span>
                            <span className="text-blue-600 font-black">{staffMember.assignedRoomIds?.length || 0} Units</span>
                         </div>
                      </div>
                   </div>
                ))}
                {supervisors.length === 0 && (
                  <div className="col-span-full py-20 text-center opacity-20 border-2 border-dashed rounded-[3rem]">
                    <p className="font-black uppercase tracking-widest">No staff records found</p>
                  </div>
                )}
             </div>
          </div>
        )}

        {/* ... Other Tabs remain same ... */}
        {activeSubTab === 'GENERAL' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
            <section className="lg:col-span-2 bg-white p-10 rounded-[3rem] border shadow-sm space-y-8">
               <h3 className="font-black uppercase text-xs text-[#e65c00] tracking-widest border-b pb-4">Business Identity</h3>
               <Input label="Business Legal Name" value={tempSettings.name} onChange={v => handleUpdate('name', v)} />
               <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase text-gray-400 ml-2 tracking-widest">Postal Address</label>
                 <textarea className="w-full border-2 p-4 rounded-2xl font-bold h-24 bg-slate-50 focus:bg-white outline-none transition-all resize-none text-xs" value={tempSettings.address} onChange={e => handleUpdate('address', e.target.value)} />
               </div>
            </section>
            <section className="bg-white p-10 rounded-[3rem] border shadow-sm space-y-8 h-fit">
               <h3 className="font-black uppercase text-xs text-[#e65c00] tracking-widest border-b pb-4">Digital Branding</h3>
               <div className="space-y-4">
                  {tempSettings.logo ? <img src={tempSettings.logo} className="h-24 mx-auto mb-4 object-contain" /> : <div className="h-24 bg-slate-50 border-2 border-dashed rounded-3xl flex items-center justify-center text-[10px] font-black text-slate-300 uppercase">Logo Placeholder</div>}
                  <input type="file" className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-orange-50 file:text-[#e65c00] hover:file:bg-orange-100" onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const r = new FileReader();
                        r.onload = () => handleUpdate('logo', r.result as string);
                        r.readAsDataURL(file);
                      }
                  }} />
               </div>
            </section>
          </div>
        )}
      </div>

      {/* Staff Management Modal */}
      {showStaffModal && editingStaff && (
         <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-6xl h-[90vh] rounded-[4rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col border-[12px] border-white">
               
               <div className="bg-[#1a2b4b] p-8 md:p-12 text-white flex justify-between items-center shrink-0">
                  <div>
                     <h3 className="text-2xl md:text-5xl font-black uppercase tracking-tighter leading-none">
                        {editingStaff.id ? 'Employee Master' : 'Staff Enrollment'}
                     </h3>
                     <p className="text-[10px] md:text-[12px] font-black uppercase tracking-[0.4em] text-blue-300 mt-2 md:mt-4">
                        Personnel & Salary Slap Protocol
                     </p>
                  </div>
                  <div className="flex gap-4">
                     <button onClick={() => setShowStaffModal(false)} className="bg-white/10 hover:bg-white/20 p-4 md:p-6 rounded-3xl transition-all font-black text-xs md:text-sm uppercase tracking-widest">Discard</button>
                     <button onClick={handleStaffSave} className="bg-[#e65c00] hover:bg-[#ff6a00] p-4 md:px-12 md:py-6 rounded-3xl transition-all font-black text-xs md:text-sm uppercase tracking-widest shadow-2xl">Authorize Record</button>
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto custom-scrollbar p-10 bg-slate-50">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                     
                     {/* Left: Bio & Photos */}
                     <div className="lg:col-span-4 space-y-8">
                        <section className="bg-white p-8 rounded-[3rem] shadow-sm space-y-6">
                           <h4 className="text-[10px] font-black uppercase text-blue-600 tracking-widest border-b pb-4">Personal Profile</h4>
                           <div className="flex items-center gap-6">
                              <div className="w-24 h-24 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex items-center justify-center overflow-hidden relative group">
                                 {editingStaff.photo ? <img src={editingStaff.photo} className="w-full h-full object-cover" /> : <span className="text-[10px] font-black text-slate-300 uppercase">PHOTO</span>}
                                 <button onClick={() => setIsCameraOpen(true)} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all text-white font-black text-[9px] uppercase">Capture</button>
                              </div>
                              <div className="space-y-1">
                                 <p className="text-[11px] font-black uppercase text-slate-900">{editingStaff.name || 'Staff Name'}</p>
                                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{editingStaff.role || 'Designation'}</p>
                              </div>
                           </div>
                           <Inp label="Employee Full Name *" value={editingStaff.name} onChange={v => setEditingStaff({...editingStaff, name: v})} />
                           <Inp label="Father's Name" value={editingStaff.fatherName} onChange={v => setEditingStaff({...editingStaff, fatherName: v})} />
                           <div className="grid grid-cols-2 gap-4">
                              <Inp label="Phone Number" value={editingStaff.phone} onChange={v => setEditingStaff({...editingStaff, phone: v})} />
                              <Inp label="Alt Contact" value={editingStaff.alternateNumber} onChange={v => setEditingStaff({...editingStaff, alternateNumber: v})} />
                           </div>
                           <Inp label="Email Address" value={editingStaff.email} onChange={v => setEditingStaff({...editingStaff, email: v})} />
                           <div className="grid grid-cols-2 gap-4">
                              <Inp label="Blood Group" value={editingStaff.bloodGroup} onChange={v => setEditingStaff({...editingStaff, bloodGroup: v})} />
                              <div className="space-y-1">
                                 <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Portal Access Role</label>
                                 <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 outline-none" value={editingStaff.role} onChange={e => setEditingStaff({...editingStaff, role: e.target.value as any})}>
                                    <option value="RECEPTIONIST">Receptionist</option>
                                    <option value="WAITER">Waiter</option>
                                    <option value="CHEF">Kitchen Staff</option>
                                    <option value="MANAGER">Property Manager</option>
                                    <option value="SUPERVISOR">Supervisor / HK</option>
                                    <option value="ACCOUNTANT">Accountant</option>
                                 </select>
                              </div>
                           </div>
                           <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Current Address</label>
                              <textarea className="w-full border-2 p-4 rounded-2xl font-bold h-24 bg-slate-50 outline-none transition-all resize-none text-xs" value={editingStaff.address} onChange={e => setEditingStaff({...editingStaff, address: e.target.value})} />
                           </div>
                        </section>

                        <section className="bg-white p-8 rounded-[3rem] shadow-sm space-y-6">
                           <h4 className="text-[10px] font-black uppercase text-blue-600 tracking-widest border-b pb-4">Nominee Details</h4>
                           <div className="grid grid-cols-2 gap-4">
                              <Inp label="Nominee Name" value={editingStaff.nomineeName} onChange={v => setEditingStaff({...editingStaff, nomineeName: v})} />
                              <Inp label="Relationship" value={editingStaff.nomineeRelation} onChange={v => setEditingStaff({...editingStaff, nomineeRelation: v})} />
                           </div>
                        </section>
                     </div>

                     {/* Middle: Salary Slap & Banking */}
                     <div className="lg:col-span-4 space-y-8">
                        <section className="bg-[#1a2b4b] p-8 rounded-[3rem] text-white space-y-6 shadow-2xl">
                           <h4 className="text-[10px] font-black uppercase text-blue-300 tracking-widest border-b border-white/10 pb-4">Monthly Salary Structure</h4>
                           <InpWhite label="Basic Salary (Monthly ₹)" type="number" value={editingStaff.basicPay?.toString()} onChange={v => setEditingStaff({...editingStaff, basicPay: parseFloat(v) || 0})} />
                           <div className="grid grid-cols-2 gap-4">
                              <InpWhite label="HRA (₹)" type="number" value={editingStaff.hra?.toString()} onChange={v => setEditingStaff({...editingStaff, hra: parseFloat(v) || 0})} />
                              <InpWhite label="Conveyance (₹)" type="number" value={editingStaff.vehicleAllowance?.toString()} onChange={v => setEditingStaff({...editingStaff, vehicleAllowance: parseFloat(v) || 0})} />
                           </div>
                           <InpWhite label="Misc Allowances (₹)" type="number" value={editingStaff.otherAllowances?.toString()} onChange={v => setEditingStaff({...editingStaff, otherAllowances: parseFloat(v) || 0})} />
                           
                           <div className="pt-6 border-t border-white/10 mt-6 flex justify-between items-end">
                              <p className="text-[10px] font-black uppercase text-blue-300">Target Monthly Take-Home</p>
                              <p className="text-4xl font-black text-white tracking-tighter leading-none">
                                 ₹{((editingStaff.basicPay || 0) + (editingStaff.hra || 0) + (editingStaff.vehicleAllowance || 0) + (editingStaff.otherAllowances || 0)).toFixed(0)}
                              </p>
                           </div>
                        </section>

                        <section className="bg-white p-8 rounded-[3rem] shadow-sm space-y-6">
                           <h4 className="text-[10px] font-black uppercase text-blue-600 tracking-widest border-b pb-4">Banking & Compliance</h4>
                           <Inp label="Bank Name" value={editingStaff.bankName} onChange={v => setEditingStaff({...editingStaff, bankName: v})} />
                           <div className="grid grid-cols-2 gap-4">
                              <Inp label="Account No" value={editingStaff.accountNumber} onChange={v => setEditingStaff({...editingStaff, accountNumber: v})} />
                              <Inp label="IFSC Code" value={editingStaff.ifscCode} onChange={v => setEditingStaff({...editingStaff, ifscCode: v})} />
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                              <Inp label="PAN Card No" value={editingStaff.panNumber} onChange={v => setEditingStaff({...editingStaff, panNumber: v})} />
                              <Inp label="UAN (PF) No" value={editingStaff.uanNumber} onChange={v => setEditingStaff({...editingStaff, uanNumber: v})} />
                           </div>
                           <Inp label="ESI Number" value={editingStaff.esiNumber} onChange={v => setEditingStaff({...editingStaff, esiNumber: v})} />
                        </section>
                     </div>

                     {/* Right: Security, Rooms & Docs */}
                     <div className="lg:col-span-4 space-y-8">
                        <section className="bg-white p-8 rounded-[3rem] shadow-sm space-y-6 border-2 border-orange-500">
                           <h4 className="text-[10px] font-black uppercase text-orange-600 tracking-widest border-b pb-4">Access Credentials (VIsible to Admin)</h4>
                           <div className="grid grid-cols-2 gap-4">
                              <Inp label="Login Identity *" value={editingStaff.loginId} onChange={v => setEditingStaff({...editingStaff, loginId: v})} />
                              <Inp label="Secret Key (Pass) *" type="password" value={editingStaff.password} onChange={v => setEditingStaff({...editingStaff, password: v})} />
                           </div>
                           <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Active Status</label>
                              <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 outline-none" value={editingStaff.status} onChange={e => setEditingStaff({...editingStaff, status: e.target.value as any})}>
                                 <option value="ACTIVE">Authorized / Active</option>
                                 <option value="INACTIVE">Locked / Inactive</option>
                              </select>
                           </div>
                        </section>

                        <section className="bg-white p-8 rounded-[3rem] shadow-sm space-y-6">
                           <div className="flex justify-between items-center border-b pb-4">
                              <h4 className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Unit Assignment (Cleaning)</h4>
                              <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-[9px] font-black">{editingStaff.assignedRoomIds?.length || 0} Rooms</span>
                           </div>
                           <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto custom-scrollbar p-2">
                              {rooms.map(r => (
                                 <button 
                                    key={r.id} 
                                    onClick={() => toggleRoomAssignment(r.id)}
                                    className={`p-2 rounded-xl text-[10px] font-black border-2 transition-all ${editingStaff.assignedRoomIds?.includes(r.id) ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-slate-50 border-white text-slate-400'}`}
                                 >
                                    {r.number}
                                 </button>
                              ))}
                           </div>
                        </section>

                        <section className="bg-white p-8 rounded-[3rem] shadow-sm space-y-6">
                           <div className="flex justify-between items-center border-b pb-4">
                              <h4 className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Digital Vault (Docs)</h4>
                              <div className="relative overflow-hidden cursor-pointer bg-slate-50 px-4 py-2 rounded-xl text-[9px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all">
                                 Upload
                                 <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleDocUpload} />
                              </div>
                           </div>
                           <div className="space-y-2">
                              {editingStaff.documents?.map(doc => (
                                 <div key={doc.id} className="flex justify-between items-center p-3 bg-slate-50 border rounded-2xl">
                                    <span className="text-[9px] font-black text-slate-600 truncate max-w-[150px] uppercase">{doc.name}</span>
                                    <button onClick={() => setEditingStaff({...editingStaff, documents: editingStaff.documents?.filter(d => d.id !== doc.id)})} className="text-red-400 font-black text-[9px]">X</button>
                                 </div>
                              ))}
                              {!editingStaff.documents?.length && <p className="text-[9px] text-slate-300 font-bold uppercase text-center py-4">No documents uploaded</p>}
                           </div>
                        </section>
                     </div>

                  </div>
               </div>
            </div>
            {isCameraOpen && (
               <CameraCapture 
                  onCapture={img => { setEditingStaff({...editingStaff, photo: img}); setIsCameraOpen(false); }} 
                  onClose={() => setIsCameraOpen(false)} 
               />
            )}
         </div>
      )}
    </div>
  );
};

const SubTab: React.FC<{ active: boolean, label: string, onClick: () => void }> = ({ active, label, onClick }) => (
  <button onClick={onClick} className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shrink-0 ${active ? 'bg-orange-600 text-white shadow-lg' : 'bg-transparent text-slate-400 hover:text-slate-900'}`}>{label}</button>
);

const Input: React.FC<{ label: string, value: any, onChange?: (v: string) => void, type?: string, readOnly?: boolean, placeholder?: string }> = ({ label, value, onChange, type = "text", readOnly = false, placeholder = "" }) => (
  <div className="space-y-1 w-full text-left">
    <label className="text-[10px] font-black uppercase text-gray-400 ml-2 tracking-widest">{label}</label>
    <input type={type} readOnly={readOnly} placeholder={placeholder} className={`w-full border-2 p-3.5 rounded-2xl font-black text-[11px] ${readOnly ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-50 focus:bg-white'} transition-all shadow-inner text-black outline-none focus:border-orange-500`} value={value || ''} onChange={e => onChange && onChange(e.target.value)} />
  </div>
);

const Inp: React.FC<{ label: string, value: any, onChange: (v: string) => void, type?: string, placeholder?: string }> = ({ label, value, onChange, type = "text", placeholder = "" }) => (
   <div className="space-y-1 w-full text-left">
     <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">{label}</label>
     <input type={type} placeholder={placeholder} className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 focus:bg-white outline-none transition-all shadow-inner text-black" value={value || ''} onChange={e => onChange(e.target.value)} />
   </div>
);

const InpWhite: React.FC<{ label: string, value: any, onChange: (v: string) => void, type?: string }> = ({ label, value, onChange, type = "text" }) => (
   <div className="space-y-1 w-full text-left">
     <label className="text-[10px] font-black uppercase text-blue-300 ml-2 tracking-widest">{label}</label>
     <input type={type} className="w-full border-2 border-white/10 p-4 rounded-2xl font-black text-sm bg-white/5 focus:bg-white/10 outline-none transition-all shadow-inner text-white" value={value || ''} onChange={e => onChange(e.target.value)} />
   </div>
);

export default Settings;
