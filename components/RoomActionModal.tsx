
import React from 'react';
import { Room, RoomStatus } from '../types';

interface RoomActionModalProps {
  room: Room;
  onClose: () => void;
  onCheckIn: () => void;
  onStatusUpdate: (status: RoomStatus) => void;
}

const RoomActionModal: React.FC<RoomActionModalProps> = ({ room, onClose, onCheckIn, onStatusUpdate }) => {
  return (
    <div className="fixed inset-0 z-[150] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300 border-4 border-blue-900">
        <div className={`p-10 text-white flex justify-between items-center bg-blue-900`}>
          <div>
            <h2 className="text-4xl font-black uppercase tracking-tighter leading-none">UNIT {room.number}</h2>
            <p className="text-[11px] font-black uppercase tracking-widest opacity-70 mt-2">{room.type}</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white/20 rounded-2xl transition-all">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="p-10 space-y-5">
          {room.status === RoomStatus.VACANT && (
            <button 
              onClick={onCheckIn} 
              className="w-full bg-orange-600 text-white py-6 rounded-3xl font-black uppercase text-xs tracking-widest shadow-2xl shadow-orange-500/20 hover:bg-black transition-all"
            >
              Express Check-in Now
            </button>
          )}

          <div className="grid grid-cols-1 gap-3 pt-4">
            <p className="text-[10px] font-black uppercase text-slate-400 text-center mb-2 tracking-[0.4em] border-b pb-3">Protocol Control</p>
            
            <StatusBtn color="bg-emerald-600" label="Clean & Set Ready" onClick={() => onStatusUpdate(RoomStatus.VACANT)} />
            <StatusBtn color="bg-rose-600" label="Mark for Laundry" onClick={() => onStatusUpdate(RoomStatus.DIRTY)} />
            <StatusBtn color="bg-blue-600" label="Management Block" onClick={() => onStatusUpdate(RoomStatus.MANAGEMENT)} />
            <StatusBtn color="bg-slate-800" label="Out of Order (Repair)" onClick={() => onStatusUpdate(RoomStatus.REPAIR)} />
          </div>
          
          <button onClick={onClose} className="w-full py-5 text-slate-400 font-black uppercase text-[11px] hover:text-blue-900 transition-all border-t mt-6">Dismiss Console</button>
        </div>
      </div>
    </div>
  );
};

const StatusBtn = ({ color, label, onClick }: { color: string, label: string, onClick: () => void }) => (
  <button onClick={onClick} className={`w-full ${color} text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:scale-[1.02] transition-all`}>
    {label}
  </button>
);

export default RoomActionModal;
