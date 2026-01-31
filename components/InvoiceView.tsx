
import React from 'react';
import { Guest, Booking, Room, HostelSettings, Payment, Charge } from '../types';

interface InvoiceViewProps {
  guest: Guest;
  booking?: Booking; // Single booking for split billing
  groupBookings?: (Booking & { roomNumber: string, roomType: string })[]; // Multiple bookings for consolidated billing
  room?: Room;
  settings: HostelSettings;
  payments: Payment[];
}

const InvoiceView: React.FC<InvoiceViewProps> = ({ guest, booking, groupBookings, room, settings, payments }) => {
  const cgstRate = settings.cgstRate || (settings.taxRate ? settings.taxRate / 2 : 0);
  const sgstRate = settings.sgstRate || (settings.taxRate ? settings.taxRate / 2 : 0);
  const igstRate = settings.igstRate || (settings.taxRate || 0);

  const renderBookings = groupBookings || (booking ? [{ ...booking, roomNumber: room?.number || '?', roomType: room?.type || '?' }] : []);

  let totalRoomRent = 0;
  let totalServiceCharges = 0;
  let totalDiscount = 0;
  
  // Aggregate all charges from all linked bookings
  const allCharges: (Charge & { roomNo?: string })[] = [];

  const lineItems = renderBookings.map(b => {
    const start = new Date(b.checkInDate);
    const end = new Date(b.checkOutDate);
    const nights = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)));
    const rent = (b.basePrice || 0) * nights;
    
    totalRoomRent += rent;
    totalDiscount += (b.discount || 0);

    // Collect charges for breakdown
    if (b.charges) {
      b.charges.forEach(c => {
        allCharges.push({ ...c, roomNo: b.roomNumber });
        totalServiceCharges += c.amount;
      });
    }

    return { ...b, nights, rent };
  });

  const grossTotal = totalRoomRent + totalServiceCharges;
  const taxableAmount = grossTotal - totalDiscount;
  
  const isInterState = guest.state && settings.address && !settings.address.includes(guest.state);
  
  const cgstAmount = (taxableAmount * cgstRate) / 100;
  const sgstAmount = (taxableAmount * sgstRate) / 100;
  const igstAmount = (taxableAmount * igstRate) / 100;

  const totalTax = isInterState ? igstAmount : (cgstAmount + sgstAmount);
  const netTotal = taxableAmount + totalTax;
  const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);
  const balance = netTotal - totalPaid;

  const upiUrl = `upi://pay?pa=${settings.upiId || ''}&pn=${encodeURIComponent(settings.name)}&am=${balance.toFixed(2)}&cu=INR&tn=${encodeURIComponent('Bill ' + (booking?.bookingNo || 'GRP-INV'))}`;
  const upiQrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiUrl)}`;

  return (
    <div className="bg-white p-10 w-[210mm] min-h-[297mm] mx-auto text-[11px] text-gray-800 font-sans leading-tight border border-gray-200 shadow-2xl print:border-none print:shadow-none print:m-0 print:p-6 invoice-sheet">
      
      <div className="flex justify-between items-start mb-8 border-b-4 border-blue-900 pb-6">
        <div className="flex items-center gap-6">
          {settings.logo ? (
             <div className="w-24 h-24 bg-white border rounded-2xl p-2 flex items-center justify-center shadow-sm">
                <img src={settings.logo} className="max-h-full max-w-full object-contain" alt="Logo" />
             </div>
          ) : (
             <div className="w-20 h-20 bg-blue-900 rounded-2xl flex items-center justify-center text-white text-3xl font-black shadow-lg">
                {settings.name?.charAt(0) || 'H'}
             </div>
          )}
          
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-blue-900 uppercase tracking-tighter leading-none">{settings.name}</h1>
            <p className="text-[10px] font-bold text-gray-500 uppercase max-w-xs leading-relaxed">{settings.address}</p>
            <div className="flex gap-4 pt-1">
               <p className="text-[10px] font-black text-blue-800 uppercase">GSTIN: {settings.gstNumber || 'N/A'}</p>
               {settings.hsnCode && <p className="text-[10px] font-black text-gray-400 uppercase">HSN: {settings.hsnCode}</p>}
            </div>
          </div>
        </div>
        
        <div className="text-right flex flex-col justify-between h-24">
          <div className="bg-blue-900 text-white px-6 py-2 rounded-xl inline-block shadow-lg">
             <p className="text-[10px] font-black uppercase tracking-widest">{groupBookings ? 'Consolidated Invoice' : 'Tax Invoice'}</p>
          </div>
          <div className="space-y-0.5">
             <p className="text-[9px] font-black text-gray-400 uppercase">Invoice Reference</p>
             <p className="text-lg font-black text-blue-900 uppercase tracking-tight">{booking?.bookingNo || 'GROUP-MASTER'}</p>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 border p-5 rounded-2xl mb-8 flex justify-between shadow-sm">
        <div className="space-y-3">
          <InfoItem label="Guest / Billing Entity" value={guest.name} subValue={`${guest.phone} | ${guest.email}`} isPrimary />
          <InfoItem label="Address" value={guest.address} subValue={guest.state} />
        </div>
        <div className="text-right space-y-3">
          <InfoItem label="Date of Issue" value={new Date().toLocaleDateString('en-GB')} />
          {groupBookings && <InfoItem label="Total Rooms" value={`${groupBookings.length} Units`} />}
        </div>
      </div>

      {/* Main Stay Description Table */}
      <div className="border border-gray-200 rounded-2xl overflow-hidden mb-6 shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-blue-50/50 border-b border-gray-200 font-black uppercase text-blue-900 text-[9px]">
            <tr>
              <th className="p-4">Room/Stay Description</th>
              <th className="p-4 text-center">Nights</th>
              <th className="p-4 text-right">Daily Rate</th>
              <th className="p-4 text-right">Total Rent (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 font-bold uppercase">
            {lineItems.map((item, idx) => (
              <tr key={idx} className="bg-white">
                <td className="p-4">
                   <p className="text-blue-900">Room {item.roomNumber} - {item.roomType}</p>
                   <p className="text-[8px] text-gray-400">{item.checkInDate} to {item.checkOutDate}</p>
                </td>
                <td className="p-4 text-center">{item.nights}</td>
                <td className="p-4 text-right">₹{item.basePrice.toFixed(2)}</td>
                <td className="p-4 text-right">₹{item.rent.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detailed Services Breakdown Table */}
      {allCharges.length > 0 && (
        <div className="border border-gray-200 rounded-2xl overflow-hidden mb-8 shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-gray-200 font-black uppercase text-slate-500 text-[9px]">
              <tr>
                <th className="p-4">Modular Services (Dining/Transport/Facilities/Banquet)</th>
                <th className="p-4">Date</th>
                {groupBookings && <th className="p-4">Unit</th>}
                <th className="p-4 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-bold uppercase text-gray-600">
              {allCharges.map((charge, idx) => (
                <tr key={idx} className="bg-white">
                  <td className="p-4 truncate max-w-xs">{charge.description}</td>
                  <td className="p-4">{charge.date.split('T')[0]}</td>
                  {groupBookings && <td className="p-4">{charge.roomNo}</td>}
                  <td className="p-4 text-right">₹{charge.amount.toFixed(2)}</td>
                </tr>
              ))}
              <tr className="bg-slate-50/50 font-black">
                <td colSpan={groupBookings ? 3 : 2} className="p-4 text-right uppercase text-[9px] text-slate-400">Total Service Charges</td>
                <td className="p-4 text-right text-blue-900">₹{totalServiceCharges.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="grid grid-cols-2 gap-10 mb-8">
        <div className="space-y-4">
           <div className="bg-gray-50 border p-4 rounded-2xl">
              <p className="text-[9px] font-black uppercase text-gray-400 mb-2 border-b pb-2">Tax Breakdown</p>
              <div className="space-y-2 font-bold text-[10px] uppercase">
                 {isInterState ? (
                    <div className="flex justify-between">
                       <span>IGST @ {igstRate}%</span>
                       <span>₹{igstAmount.toFixed(2)}</span>
                    </div>
                 ) : (
                    <>
                       <div className="flex justify-between">
                          <span>CGST @ {cgstRate}%</span>
                          <span>₹{cgstAmount.toFixed(2)}</span>
                       </div>
                       <div className="flex justify-between">
                          <span>SGST @ {sgstRate}%</span>
                          <span>₹{sgstAmount.toFixed(2)}</span>
                       </div>
                    </>
                 )}
              </div>
           </div>
           <div className="bg-gray-50 border p-4 rounded-2xl">
              <p className="text-[9px] font-black uppercase text-gray-400 mb-2 border-b pb-2">Payment Receipts</p>
              <table className="w-full text-[9px] font-bold">
                 <tbody>
                    {payments.map(p => (
                       <tr key={p.id} className="border-b border-gray-100 last:border-0 h-8">
                          <td className="text-gray-500 uppercase">{p.method} ({p.date.split('T')[0]})</td>
                          <td className="text-right text-green-700">₹{p.amount.toFixed(2)}</td>
                       </tr>
                    ))}
                    {payments.length === 0 && <tr><td colSpan={2} className="py-2 text-gray-300 italic">No receipts recorded</td></tr>}
                 </tbody>
              </table>
           </div>
        </div>
        
        <div className="bg-blue-900 rounded-[2rem] p-8 text-white space-y-3 shadow-xl">
           <div className="flex justify-between items-center text-[10px] opacity-60 font-black uppercase">
              <span>Gross Bill Value</span>
              <span>₹{grossTotal.toFixed(2)}</span>
           </div>
           
           {totalDiscount > 0 && (
             <div className="flex justify-between items-center text-[10px] font-black uppercase text-orange-400">
                <span>(-) Total Discount Given</span>
                <span>- ₹{totalDiscount.toFixed(2)}</span>
             </div>
           )}

           <div className="flex justify-between items-center text-[10px] font-black uppercase text-white/80 border-t border-white/10 pt-2">
              <span>Net Taxable Amount</span>
              <span>₹{taxableAmount.toFixed(2)}</span>
           </div>

           <div className="flex justify-between items-center text-[10px] opacity-60 font-black uppercase">
              <span>Total Tax (GST)</span>
              <span>₹{totalTax.toFixed(2)}</span>
           </div>

           <div className="h-px bg-white/20 my-1"></div>
           <div className="flex justify-between items-end pt-1">
              <div>
                 <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Grand Total</p>
                 <p className="text-3xl font-black tracking-tighter">₹{netTotal.toFixed(2)}</p>
              </div>
              <div className="text-right">
                 <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Balance</p>
                 <p className={`text-xl font-black ${balance > 0 ? 'text-red-400' : 'text-green-400'} tracking-tighter`}>₹{balance.toFixed(2)}</p>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 p-6 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 mb-10 no-print">
        <div className="flex items-center gap-6">
           <div className="w-24 h-24 bg-white p-2 rounded-2xl shadow-md border flex items-center justify-center">
              <img src={upiQrSrc} className="w-full h-full" alt="Pay QR" />
           </div>
           <div className="space-y-1">
              <p className="text-[10px] font-black text-blue-900 uppercase tracking-widest leading-none">Scan to Pay (UPI)</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase leading-relaxed">UPI ID: {settings.upiId || 'N/A'}</p>
           </div>
        </div>
        <div className="text-right flex flex-col justify-center pr-4">
           <p className="text-[10px] font-black text-blue-900 uppercase tracking-widest">Authorized Invoicing</p>
           <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">This is a computer generated document.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-32 text-center pt-12">
        <div className="space-y-4">
           <div className="h-16 flex items-end justify-center border-b border-gray-200"></div>
           <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Guest Signature</p>
        </div>
        <div className="space-y-4">
           <div className="h-16 flex items-end justify-center border-b border-gray-200">
              {settings.signature && <img src={settings.signature} className="h-full object-contain mix-blend-multiply" />}
           </div>
           <p className="text-[9px] font-black uppercase text-blue-900 tracking-widest">Property Manager</p>
        </div>
      </div>
    </div>
  );
};

const InfoItem = ({ label, value, subValue, isPrimary = false }: { label: string, value?: string, subValue?: string, isPrimary?: boolean }) => (
  <div className="space-y-1">
    <p className="text-[8px] font-black uppercase text-gray-400 tracking-widest">{label}</p>
    <p className={`uppercase tracking-tight leading-none ${isPrimary ? 'text-sm font-black text-blue-900' : 'text-[10px] font-bold text-gray-700'}`}>
       {value || '—'}
    </p>
    {subValue && <p className="text-[8px] font-bold text-gray-400 uppercase leading-none">{subValue}</p>}
  </div>
);

export default InvoiceView;
