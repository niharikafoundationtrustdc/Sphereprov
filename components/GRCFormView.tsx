
import React from 'react';
import { Guest, Booking, Room, HostelSettings } from '../types';

interface GRCFormViewProps {
  guest: Partial<Guest>;
  booking: Partial<Booking>;
  room: Partial<Room>;
  settings: HostelSettings;
}

const GRCFormView: React.FC<GRCFormViewProps> = ({ guest, booking, room, settings }) => {
  return (
    <div className="bg-white p-12 w-[210mm] min-h-[297mm] mx-auto text-[10px] text-gray-800 font-sans leading-tight print:p-6 print:m-0 border shadow-inner invoice-sheet">
      
      {/* GRC Header */}
      <div className="flex justify-between items-center border-b-4 border-blue-900 pb-6 mb-8">
        <div className="flex items-center gap-6">
          {settings.logo && (
             <div className="w-20 h-20 bg-white border rounded-xl p-1.5 flex items-center justify-center">
                <img src={settings.logo} className="max-h-full max-w-full object-contain" alt="Property Logo" />
             </div>
          )}
          <div>
            <h1 className="text-2xl font-black text-blue-900 uppercase tracking-tighter leading-none">{settings.name}</h1>
            <p className="text-[8px] uppercase font-bold text-gray-500 max-w-sm mt-1">{settings.address}</p>
            <p className="text-[8px] font-black text-blue-800 uppercase mt-1 tracking-widest">GST: {settings.gstNumber || 'UNREGISTERED'}</p>
          </div>
        </div>
        <div className="text-right border-l-2 pl-6 border-gray-100">
          <p className="text-lg font-black uppercase text-blue-900 tracking-widest leading-none">Form - C</p>
          <p className="text-[8px] font-black uppercase text-gray-400 mt-2">Guest Registration Card (GRC)</p>
          <div className="bg-slate-100 px-3 py-1 rounded-full text-[7px] font-black mt-2 inline-block uppercase">Official Property Registry</div>
        </div>
      </div>

      {/* Main Form Grid */}
      <div className="grid grid-cols-3 gap-10">
        
        {/* Column 1: Personal Identifiers */}
        <div className="space-y-4">
          <SectionHeader label="Identification" />
          <Field label="Room Number" value={room.number} isLarge />
          <Field label="Sur Name / Family Name" value={guest.surName} />
          <Field label="Given Name / First Name" value={guest.givenName || guest.name} />
          <div className="space-y-1">
            <p className="text-[7px] font-black uppercase text-gray-400 tracking-widest">Gender</p>
            <div className="flex gap-6 pt-1">
              <label className="flex items-center gap-2 font-bold uppercase"><input type="radio" checked={guest.gender === 'Male'} readOnly className="w-3 h-3" /> Male</label>
              <label className="flex items-center gap-2 font-bold uppercase"><input type="radio" checked={guest.gender === 'Female'} readOnly className="w-3 h-3" /> Female</label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
             <Field label="Date of Birth" value={guest.dob} />
             <Field label="Nationality" value={guest.nationality} />
          </div>
          <Field label="Country of Origin" value={guest.country || (guest.nationality === 'Indian' ? 'India' : '')} />
          <Field label="State / Province" value={guest.state} />
          <div className="pt-4 space-y-4 border-t border-gray-100">
             <Field label="Arrival From" value={guest.arrivalFrom} />
             <Field label="Next Destination" value={guest.nextDestination} />
          </div>
        </div>

        {/* Column 2: Legal & Travel */}
        <div className="space-y-4">
          <SectionHeader label="Travel Auth" />
          <Field label="Passport Number" value={guest.passportNo || guest.idNumber} />
          <div className="grid grid-cols-2 gap-4">
             <Field label="Place of Issue" value={guest.passportPlaceOfIssue} />
             <Field label="Expiry Date" value={guest.passportDateOfExpiry} />
          </div>
          <Field label="Visa Number" value={guest.visaNo} />
          <div className="grid grid-cols-2 gap-4">
             <Field label="Visa Type" value={guest.visaType} />
             <Field label="Visa Expiry" value={guest.visaDateOfExpiry} />
          </div>
          <div className="space-y-1.5 pt-2">
            <p className="text-[7px] font-black uppercase text-gray-400 tracking-widest">Residential Address (Home)</p>
            <div className="border border-blue-900/10 p-3 min-h-[60px] rounded-xl text-[9px] font-bold uppercase bg-gray-50/50 leading-relaxed">{guest.address}</div>
          </div>
          <div className="space-y-1.5">
            <p className="text-[7px] font-black uppercase text-gray-400 tracking-widest">Contact Information</p>
            <div className="grid grid-cols-1 gap-2">
               <Field label="Mobile" value={guest.phone} />
               <Field label="Email ID" value={guest.email} />
            </div>
          </div>
        </div>

        {/* Column 3: Logistics & Photo */}
        <div className="space-y-4">
          <SectionHeader label="Stay & Admin" />
          <div className="grid grid-cols-2 gap-4">
             <Field label="Arrival Date" value={booking.checkInDate} />
             <Field label="Arrival Time" value={booking.checkInTime} />
          </div>
          <div className="grid grid-cols-2 gap-4">
             <Field label="Exp. Departure" value={booking.checkOutDate} />
             <Field label="Checkout Time" value={booking.checkOutTime} />
          </div>
          <Field label="Purpose of Visit" value={guest.purposeOfVisit || 'TOURISM'} />
          
          <div className="pt-2">
            <p className="text-[7px] font-black uppercase text-gray-400 tracking-widest mb-2">Guest Photograph</p>
            <div className="w-32 h-40 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50 flex items-center justify-center overflow-hidden mx-auto shadow-inner">
              {guest.documents?.photo ? (
                 <img src={guest.documents.photo} className="w-full h-full object-cover" alt="Captured" />
              ) : (
                 <div className="text-center space-y-2">
                    <svg className="w-8 h-8 text-gray-200 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                    <p className="text-[6px] text-gray-300 font-black uppercase">Affix Photo Here</p>
                 </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5 pt-2">
            <p className="text-[7px] font-black uppercase text-gray-400 tracking-widest">Remarks / Notes</p>
            <div className="border border-blue-900/10 p-3 min-h-[50px] rounded-xl text-[9px] font-bold uppercase bg-gray-50/50 italic text-gray-400">{guest.remarks || 'No special instructions recorded.'}</div>
          </div>
        </div>
      </div>

      {/* Compliance Footer */}
      <div className="mt-16 bg-blue-50/50 p-6 rounded-[2rem] border border-blue-100 mb-12">
         <p className="text-[8px] font-bold text-blue-900 leading-relaxed uppercase text-center">
            Declaration: I hereby declare that the particulars given above are true and correct to the best of my knowledge. 
            I also agree to abide by the rules and regulations of the property during my stay.
         </p>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-32 px-10">
        <div className="text-center">
          <div className="border-b-2 border-gray-300 h-20 mb-3 flex items-end justify-center"></div>
          <p className="text-[9px] font-black uppercase text-blue-900 tracking-widest">Guest Signature</p>
        </div>
        <div className="text-center">
          <div className="border-b-2 border-gray-300 h-20 mb-3 flex items-end justify-center overflow-hidden">
             {settings.signature && <img src={settings.signature} className="h-full object-contain mix-blend-multiply pb-1" />}
          </div>
          <p className="text-[9px] font-black uppercase text-blue-900 tracking-widest">Front Desk Authority</p>
        </div>
      </div>
      
      <div className="mt-16 border-t pt-6 flex justify-between items-center text-[7px] font-bold text-gray-400 uppercase tracking-widest">
         <span>Generated via HotelSphere Pro Registry</span>
         <span>v3.4.0 Authorized</span>
         <span>Print Date: {new Date().toLocaleDateString('en-GB')}</span>
      </div>
    </div>
  );
};

const SectionHeader = ({ label }: { label: string }) => (
  <div className="flex items-center gap-2 mb-2">
     <div className="h-4 w-1 bg-blue-900 rounded-full"></div>
     <p className="text-[8px] font-black uppercase text-blue-900 tracking-[0.2em]">{label}</p>
  </div>
);

const Field = ({ label, value, isLarge = false }: { label: string; value?: string | number; isLarge?: boolean }) => (
  <div className="space-y-1">
    <p className="text-[7px] font-black uppercase text-gray-400 tracking-widest">{label}</p>
    <div className={`border-b border-blue-900/20 pb-1 font-black uppercase tracking-tight overflow-hidden whitespace-nowrap ${isLarge ? 'text-lg text-blue-900' : 'text-[10px] text-gray-800'}`}>
      {value || '_'}
    </div>
  </div>
);

export default GRCFormView;
