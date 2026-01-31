
import React from 'react';
import { Booking, Guest, Room, RoomStatus } from '../types';

interface ReservationPipelineProps {
  bookings: Booking[];
  guests: Guest[];
  rooms: Room[];
  onClose: () => void;
  onCheckIn: (booking: Booking) => void;
  onCancel: (bookingId: string) => void;
}

const ReservationPipeline: React.FC<ReservationPipelineProps> = ({ bookings, guests, rooms, onClose, onCheckIn, onCancel }) => {
  const reservations = bookings.filter(b => b.status === 'RESERVED').sort((a, b) => a.checkInDate.localeCompare(b.checkInDate));

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#f8fafc] w-full max-w-5xl h-[85vh] rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300">
        <div className="bg-orange-500 p-10 text-white flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-3xl font-black uppercase tracking-tighter leading-none">Reservation Registry</h2>
            <p className="text-[10px] font-bold text-orange-100 uppercase tracking-widest mt-2">Manage Upcoming Arrivals & Future Bookings</p>
          </div>
          <button onClick={onClose} className="p-4 bg-white/10 rounded-2xl hover:bg-white/20 transition-all font-black uppercase text-xs">Close Registry</button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reservations.map(res => {
              const guest = guests.find(g => g.id === res.guestId);
              const room = rooms.find(r => r.id === res.roomId);
              const isToday = res.checkInDate === new Date().toISOString().split('T')[0];

              return (
                <div key={res.id} className={`bg-white border-2 rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden flex flex-col justify-between ${isToday ? 'border-orange-500 ring-4 ring-orange-50' : 'border-slate-50'}`}>
                  {isToday && <div className="absolute top-0 right-0 bg-orange-500 text-white px-6 py-1.5 rounded-bl-3xl font-black text-[9px] uppercase tracking-widest animate-pulse">Arrival Today</div>}
                  
                  <div>
                    <div className="flex justify-between items-start mb-6">
                      <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600 text-xl font-black shadow-inner">
                        {room?.number || '?'}
                      </div>
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">#{res.bookingNo.slice(-6)}</span>
                    </div>
                    
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-tight">{guest?.name || 'Unknown Guest'}</h3>
                    <p className="text-[11px] font-bold text-slate-400 uppercase mt-1">{guest?.phone || 'No Phone'}</p>
                    
                    <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-slate-50">
                      <div>
                        <p className="text-[8px] font-black uppercase text-slate-300 tracking-widest">Arrival</p>
                        <p className="text-[11px] font-black text-slate-700">{res.checkInDate}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-black uppercase text-slate-300 tracking-widest text-right">Departure</p>
                        <p className="text-[11px] font-black text-slate-700 text-right">{res.checkOutDate}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-8 pt-4 border-t border-slate-50">
                    <button 
                      onClick={() => onCheckIn(res)}
                      className="flex-1 bg-blue-900 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-black transition-all"
                    >
                      Authorize Check-in
                    </button>
                    <button 
                      onClick={() => { if(confirm('Cancel this reservation?')) onCancel(res.id); }}
                      className="px-6 border-2 border-slate-100 text-slate-300 hover:text-red-500 hover:border-red-100 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            })}
            
            {reservations.length === 0 && (
              <div className="col-span-full py-40 text-center opacity-20 flex flex-col items-center">
                 <span className="text-6xl mb-4">📅</span>
                 <p className="font-black uppercase tracking-[0.3em] text-xl text-slate-900">No Pending Reservations</p>
                 <p className="text-[10px] font-bold mt-2">Future bookings will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReservationPipeline;
