
import React from 'react';
import { Room, RoomStatus } from '../types';
import { STATUS_COLORS } from '../constants';

interface RoomActionModalProps {
  room: Room;
  onClose: () => void;
  onCheckIn: () => void;
  onStatusUpdate: (status: RoomStatus) => void;
}

const RoomActionModal: React.FC<RoomActionModalProps> = ({ room, onClose, onCheckIn, onStatusUpdate }) => {
  return (
    <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-[3rem] shadow-[0_30px_100px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in duration-300 ring-8 ring-white/10">
        <div className={`p-10 text-white flex justify-between items-center ${STATUS_COLORS[room.status].split(' ')[0]}`}>
          <div>
            <h2 className="text-3xl font-black uppercase tracking-tighter">Unit {room.number}</h2>
            <p className="text-[11px] font-black uppercase tracking-widest opacity-70">{room.type}</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white/20 rounded-2xl transition-all">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="p-10 space-y-4">
          {room.status === RoomStatus.VACANT && (
            <button 
              onClick={onCheckIn} 
              className="w-full bg-[#003d80] text-white py-6 rounded-3xl font-black uppercase text-xs tracking-widest shadow-2xl hover:bg-black transition-all hover:scale-[1.02]"
            >
              Express Check-in Now
            </button>
          )}

          <div className="grid grid-cols-1 gap-2.5 pt-4">
            <p className="text-[10px] font-black uppercase text-slate-400 text-center mb-2 tracking-[0.3em] border-b pb-2">Status Protocols</p>
            
            {room.status !== RoomStatus.VACANT && (
              <StatusBtn color="bg-emerald-600" label="Clean & Set Vacant" onClick={() => onStatusUpdate(RoomStatus.VACANT)} />
            )}
            
            {room.status !== RoomStatus.DIRTY && (
              <StatusBtn color="bg-rose-600" label="Mark for Laundry (Dirty)" onClick={() => onStatusUpdate(RoomStatus.DIRTY)} />
            )}
            
            {room.status !== RoomStatus.REPAIR && (
              <StatusBtn color="bg-[#5c2d0a]" label="Mark for REPAIR / FIX" onClick={() => onStatusUpdate(RoomStatus.REPAIR)} />
            )}

            {room.status !== RoomStatus.MANAGEMENT && (
              <StatusBtn color="bg-indigo-600" label="Management Block Unit" onClick={() => onStatusUpdate(RoomStatus.MANAGEMENT)} />
            )}
          </div>
          
          <button onClick={onClose} className="w-full py-5 text-slate-400 font-black uppercase text-[10px] hover:text-slate-900 transition-all border-t mt-6">Dismiss Modal</button>
        </div>
      </div>
    </div>
  );
};

const StatusBtn = ({ color, label, onClick }: { color: string, label: string, onClick: () => void }) => (
  <button 
    onClick={onClick} 
    className={`w-full ${color} text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:brightness-110 hover:scale-[1.02] transition-all`}
  >
    {label}
  </button>
);

export default RoomActionModal;
