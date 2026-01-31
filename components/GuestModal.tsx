
import React, { useState } from 'react';
import { Guest } from '../types';
import CameraCapture from './CameraCapture';

interface GuestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (guest: Guest) => void;
  initialData?: Guest;
}

const GuestModal: React.FC<GuestModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const [formData, setFormData] = useState<Partial<Guest>>(initialData || {
    name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    documents: {}
  });
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  if (!isOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, docType: keyof Guest['documents']) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          documents: { ...prev.documents, [docType]: reader.result as string }
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePhotoCapture = (imageData: string) => {
    setFormData(prev => ({
      ...prev,
      documents: { ...prev.documents, photo: imageData }
    }));
    setIsCameraOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: formData.id || Math.random().toString(36).substr(2, 9),
      name: formData.name || '',
      phone: formData.phone || '',
      email: formData.email || '',
      address: formData.address || '',
      city: formData.city || '',
      state: formData.state || '',
      documents: formData.documents || {}
    } as Guest);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto py-8">
      <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden my-auto">
        <div className="bg-blue-600 px-6 py-4 flex justify-between items-center text-white">
          <h2 className="text-xl font-bold">{initialData ? 'Edit Guest' : 'Register New Guest'}</h2>
          <button onClick={onClose} className="hover:bg-blue-700 p-1 rounded">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-700 border-b pb-2">Guest Details</h3>
              <div>
                <label className="block text-sm font-medium text-gray-600">Full Name *</label>
                <input required name="name" value={formData.name} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600">Phone *</label>
                  <input required name="phone" value={formData.phone} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">Email</label>
                  <input name="email" value={formData.email} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Address</label>
                <textarea name="address" value={formData.address} onChange={handleInputChange} rows={3} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600">City</label>
                  <input name="city" value={formData.city} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">State</label>
                  <input name="state" value={formData.state} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>

            {/* Document Uploads */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-700 border-b pb-2">KYC Documents</h3>
              <div className="grid grid-cols-2 gap-4">
                <DocUpload label="Aadhar Front" onChange={(e) => handleFileUpload(e, 'aadharFront')} preview={formData.documents?.aadharFront} />
                <DocUpload label="Aadhar Back" onChange={(e) => handleFileUpload(e, 'aadharBack')} preview={formData.documents?.aadharBack} />
                <DocUpload label="PAN Card" onChange={(e) => handleFileUpload(e, 'pan')} preview={formData.documents?.pan} />
                <DocUpload label="Passport Front" onChange={(e) => handleFileUpload(e, 'passportFront')} preview={formData.documents?.passportFront} />
              </div>
              
              <div className="pt-4">
                <label className="block text-sm font-medium text-gray-600 mb-2">Guest Photo</label>
                <div className="flex items-center gap-4">
                  {formData.documents?.photo ? (
                    <img src={formData.documents.photo} className="w-24 h-24 object-cover rounded-lg border-2 border-blue-500" />
                  ) : (
                    <div className="w-24 h-24 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                    </div>
                  )}
                  <button type="button" onClick={() => setIsCameraOpen(true)} className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    Capture Live
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3 border-t pt-6">
            <button type="button" onClick={onClose} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium">Cancel</button>
            <button type="submit" className="px-8 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg font-medium">Save Guest Profile</button>
          </div>
        </form>
      </div>

      {isCameraOpen && <CameraCapture onCapture={handlePhotoCapture} onClose={() => setIsCameraOpen(false)} />}
    </div>
  );
};

const DocUpload: React.FC<{ label: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, preview?: string }> = ({ label, onChange, preview }) => (
  <div>
    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">{label}</label>
    <div className={`relative h-24 rounded-lg border-2 border-dashed ${preview ? 'border-blue-300' : 'border-gray-300'} overflow-hidden bg-gray-50 flex flex-col items-center justify-center group`}>
      {preview ? (
        <img src={preview} className="w-full h-full object-cover" />
      ) : (
        <>
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 00-2 2z"></path></svg>
          <span className="text-[10px] text-gray-500 mt-1">Upload File</span>
        </>
      )}
      <input type="file" accept="image/*" onChange={onChange} className="absolute inset-0 opacity-0 cursor-pointer" />
    </div>
  </div>
);

export default GuestModal;
