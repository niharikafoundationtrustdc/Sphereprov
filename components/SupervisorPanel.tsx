
import React, { useState, useMemo } from 'react';
import { Room, RoomStatus, Supervisor, Booking } from '../types.ts';
import { STATUS_COLORS } from '../constants.tsx';

interface SupervisorPanelProps {
  staff: Supervisor | null;
  rooms: Room[];
  bookings: Booking[];
  onUpdateRoom: (room: Room) => Promise<void>;
}

const SupervisorPanel: React.FC<SupervisorPanelProps> = ({ staff, rooms, bookings, onUpdateRoom }) => {
  const [activeSubTab, setActiveSubTab] = useState<'MY_UNITS' | 'LOGS'>('MY_UNITS');

  const myAssignedRooms = useMemo(() => {
    if (!staff || !staff.assignedRoomIds) return rooms;
    return rooms.filter(r => staff.assignedRoomIds.includes(r.id));
  }, [staff, rooms]);

  const stats = useMemo(() => {
    return {
      total: myAssignedRooms.length,
      dirty: myAssignedRooms.filter(r => r.status === RoomStatus.DIRTY).length,
      occupied: myAssignedRooms.filter(r => r.status === RoomStatus.OCCUPIED).length,
      vacant: myAssignedRooms.filter(r => r.status === RoomStatus.VACANT).length
    };
  }, [myAssignedRooms]);

  const handleClean = async (room: Room) => {
    if (room.status !== RoomStatus.DIRTY) return;
    const updated = { ...room, status: RoomStatus.VACANT };
    await onUpdateRoom(updated);
  };

  return (
    <div className="p-4 md:p-8 lg:p-12 h-full flex flex-col gap-10 bg-[#f8fafc] animate-in fade-in duration-500 overflow-hidden">
      {/* Panel Header */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-8 md:p-12 rounded-[3.5rem] shadow-xl shadow-orange-100/30 border-2 border-white gap-8">
        <div className="flex items-center gap-8">
          <div className="w-20 h-20 bg-[#e65c00] text-white rounded-3xl flex items-center justify-center text-4xl font-black shadow-[0_15px_40px_rgba(230,92,0,0.3)] shrink-0">
            {staff?.name.charAt(0) || 'S'}
          </div>
          <div>
            <h2 className="text-2xl md:text-5xl font-black text-slate-900 uppercase tracking-tighter leading-none">
              {staff ? `${staff.name}'s Dashboard` : 'Supervisor Panel'}
            </h2>
            <p className="text-[10px] md:text-[12px] font-black text-[#e65c00] uppercase tracking-[0.4em] mt-3">Housekeeping & Asset Management</p>
          </div>
        </div>
        <div className="flex gap-2 bg-slate-50 p-2 rounded-2xl border-2 border-slate-100 shrink-0">
          <TabBtn active={activeSubTab === 'MY_UNITS'} label="My assigned Units" onClick={() => setActiveSubTab('MY_UNITS')} />
          <TabBtn active={activeSubTab === 'LOGS'} label="Cleaning Logs" onClick={() => setActiveSubTab('LOGS')} />
        </div>
      </div>

      {/* Statistics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 shrink-0">
        <StatCard label="Managed Inventory" value={stats.total} icon="🏢" color="bg-slate-900" />
        <StatCard label="Dirty / Laundry" value={stats.dirty} icon="🧺" color="bg-rose-600" />
        <StatCard label="Live Occupancy" value={stats.occupied} icon="🔑" color="bg-blue-600" />
        <StatCard label="Ready to Sell" value={stats.vacant} icon="✨" color="bg-emerald-600" />
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {activeSubTab === 'MY_UNITS' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-12">
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-6">
                {myAssignedRooms.map(room => {
                  const isDirty = room.status === RoomStatus.DIRTY;
                  return (
                    <div 
                      key={room.id} 
                      className={`min-h-[220px] bg-white border-4 rounded-[3.5rem] p-8 flex flex-col items-center justify-between transition-all shadow-md group relative ${isDirty ? 'border-rose-500 ring-8 ring-rose-50' : 'border-white hover:border-orange-500'}`}
                    >
                      <div className="text-center">
                         <span className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none">{room.number}</span>
                         <p className="text-[9px] font-black uppercase text-slate-400 mt-2 tracking-widest">{room.type.split(' ')[0]}</p>
                      </div>
                      
                      <div className="text-center w-full space-y-3">
                         <div className={`text-[8px] font-black uppercase py-1.5 px-4 rounded-full border-2 border-current inline-block ${STATUS_COLORS[room.status].split(' ')[2]}`}>
                           {room.status}
                         </div>
                         {isDirty && (
                           <button 
                             onClick={() => handleClean(room)}
                             className="w-full bg-emerald-600 text-white py-3 rounded-2xl font-black text-[9px] uppercase shadow-lg hover:scale-105 transition-all animate-pulse"
                           >
                              Mark Clean
                           </button>
                         )}
                      </div>

                      {isDirty && <div className="absolute -top-3 -right-3 w-10 h-10 bg-rose-600 text-white rounded-2xl flex items-center justify-center text-xs font-black shadow-xl border-4 border-white">!</div>}
                    </div>
                  );
                })}
             </div>
             {myAssignedRooms.length === 0 && (
                <div className="py-40 text-center opacity-20 flex flex-col items-center gap-6">
                   <span className="text-8xl">🏢</span>
                   <p className="font-black uppercase tracking-[0.4em] text-xl">No rooms assigned for oversight</p>
                </div>
             )}
          </div>
        )}

        {activeSubTab === 'LOGS' && (
           <div className="bg-white border-2 rounded-[3.5rem] p-12 shadow-sm animate-in slide-in-from-bottom-8 duration-500">
              <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-4">Maintenance Trail</h3>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-10">Historical record of all unit cleaning actions</p>
              <div className="py-20 text-center opacity-10 font-black uppercase text-4xl tracking-[0.2em] border-4 border-dashed rounded-[3rem]">
                 Logs Node: Coming Soon
              </div>
           </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon, color }: any) => (
  <div className={`${color} p-8 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden group`}>
    <div className="absolute top-0 right-0 p-4 text-4xl opacity-20 group-hover:scale-110 transition-transform">{icon}</div>
    <p className="text-[10px] font-black uppercase opacity-60 tracking-widest mb-3">{label}</p>
    <p className="text-4xl font-black tracking-tighter">{value}</p>
  </div>
);

const TabBtn = ({ active, label, onClick }: any) => (
  <button 
    onClick={onClick} 
    className={`px-10 py-3 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest shrink-0 ${active ? 'bg-[#e65c00] text-white shadow-xl scale-105' : 'text-slate-400 hover:text-slate-900 hover:bg-white'}`}
  >
    {label}
  </button>
);

export default SupervisorPanel;
