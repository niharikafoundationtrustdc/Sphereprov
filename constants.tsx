
import { RoomStatus, RoomType, Room } from './types';

export const STATUS_COLORS: Record<RoomStatus, string> = {
  [RoomStatus.VACANT]: 'bg-white border-emerald-200 text-emerald-900 shadow-sm',
  [RoomStatus.OCCUPIED]: 'bg-indigo-50/50 border-indigo-500 text-indigo-900 shadow-sm',
  [RoomStatus.RESERVED]: 'bg-orange-50/50 border-orange-400 text-orange-900 shadow-sm',
  [RoomStatus.DIRTY]: 'bg-rose-50/50 border-rose-400 text-rose-900 shadow-sm',
  [RoomStatus.REPAIR]: 'bg-[#5c2d0a]/10 border-[#5c2d0a] text-[#5c2d0a] shadow-sm', 
  [RoomStatus.MANAGEMENT]: 'bg-violet-50 border-violet-400 text-violet-900 shadow-sm',
  [RoomStatus.STAFF_BLOCK]: 'bg-slate-800 border-slate-900 text-white shadow-sm',
};

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", 
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", 
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", 
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", 
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", 
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", 
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

export const INITIAL_ROOMS: Room[] = [
  // First Floor
  { id: '101', number: '101', floor: 1, type: RoomType.DELUXE, price: 2900, status: RoomStatus.VACANT },
  { id: '102', number: '102', floor: 1, type: RoomType.DELUXE, price: 2900, status: RoomStatus.VACANT },
  { id: '103', number: '103', floor: 1, type: RoomType.BUDGET, price: 2000, status: RoomStatus.DIRTY },
  { id: '104', number: '104', floor: 1, type: RoomType.BUDGET, price: 2000, status: RoomStatus.VACANT },
  { id: '105', number: '105', floor: 1, type: RoomType.BUDGET, price: 2000, status: RoomStatus.VACANT },
  { id: '106', number: '106', floor: 1, type: RoomType.BUDGET, price: 2000, status: RoomStatus.VACANT },
  { id: '107', number: '107', floor: 1, type: RoomType.BUDGET, price: 2000, status: RoomStatus.VACANT },
  { id: '108', number: '108', floor: 1, type: RoomType.AC_FAMILY, price: 4100, status: RoomStatus.VACANT },
  { id: '109', number: '109', floor: 1, type: RoomType.BUDGET, price: 2000, status: RoomStatus.VACANT },
  { id: '110', number: '110', floor: 1, type: RoomType.BUDGET, price: 2000, status: RoomStatus.VACANT },

  // Second Floor
  { id: '201', number: '201', floor: 2, type: RoomType.BUDGET, price: 2000, status: RoomStatus.VACANT },
  { id: '202', number: '202', floor: 2, type: RoomType.BUDGET, price: 2000, status: RoomStatus.VACANT },
  { id: '203', number: '203', floor: 2, type: RoomType.BUDGET, price: 2000, status: RoomStatus.VACANT },
  { id: '204', number: '204', floor: 2, type: RoomType.BUDGET, price: 2000, status: RoomStatus.VACANT },
  { id: '205', number: '205', floor: 2, type: RoomType.STANDARD, price: 2500, status: RoomStatus.VACANT },
  { id: '206', number: '206', floor: 2, type: RoomType.STANDARD, price: 2500, status: RoomStatus.VACANT },
  { id: '207', number: '207', floor: 2, type: RoomType.STANDARD, price: 2500, status: RoomStatus.VACANT },
  { id: '208', number: '208', floor: 2, type: RoomType.BUDGET, price: 2000, status: RoomStatus.VACANT },
  { id: '209', number: '209', floor: 2, type: RoomType.STANDARD, price: 2500, status: RoomStatus.VACANT },
  { id: '210', number: '210', floor: 2, type: RoomType.DELUXE, price: 2900, status: RoomStatus.VACANT },
  { id: '211', number: '211', floor: 2, type: RoomType.STANDARD, price: 2500, status: RoomStatus.VACANT },

  // Third Floor
  { id: '301', number: '301', floor: 3, type: RoomType.BUDGET, price: 2000, status: RoomStatus.VACANT },
  { id: '302', number: '302', floor: 3, type: RoomType.BUDGET, price: 2000, status: RoomStatus.VACANT },
  { id: '303', number: '303', floor: 3, type: RoomType.BUDGET, price: 2000, status: RoomStatus.VACANT },
];
