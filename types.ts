
export enum RoomStatus {
  VACANT = 'VACANT',
  OCCUPIED = 'OCCUPIED',
  RESERVED = 'RESERVED',
  DIRTY = 'DIRTY',
  REPAIR = 'REPAIR',
  MANAGEMENT = 'MANAGEMENT',
  STAFF_BLOCK = 'STAFF_BLOCK'
}

export enum RoomType {
  DELUXE = 'DELUXE ROOM',
  BUDGET = 'BUDGET ROOM',
  STANDARD = 'STANDARD ROOM',
  AC_FAMILY = 'AC FAMILY ROOM',
  SUITE = 'SUITE'
}

/* Added missing Charge interface */
export interface Charge {
  id: string;
  description: string;
  amount: number;
  date: string;
}

/* Added missing Payment interface */
export interface Payment {
  id: string;
  amount: number;
  date: string;
  method: string;
  remarks?: string;
}

/* Added missing Occupant interface */
export interface Occupant {
  id: string;
  name: string;
  gender: 'Male' | 'Female' | 'Other';
  idFront?: string;
  idBack?: string;
}

/* Added missing AgentConfig interface */
export interface AgentConfig {
  name: string;
  commission: number;
}

/* Updated CateringIngredient interface with unitCost */
export interface CateringIngredient {
  name: string;
  qtyPerPlate: number;
  unit: string;
  unitCost: number; // Cost per 1 unit (e.g., cost per KG)
}

/* Added missing EventCatering interface */
export interface EventCatering {
  items: { itemId: string, name: string, qty: number, price: number }[];
  plateCount: number;
  totalCateringCharge: number;
}

/* Added missing EventType type */
export type EventType = string;

/* Added missing Facility interface */
export interface Facility {
  id: string;
  name: string;
  type: 'GYM' | 'POOL' | 'LAUNDRY';
}

export interface Room {
  id: string;
  number: string;
  floor: number;
  type: RoomType | string;
  price: number;
  status: RoomStatus;
  currentBookingId?: string;
  block?: string;
  bedType?: string;
}

export type UserRole = 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'RECEPTIONIST' | 'ACCOUNTANT' | 'SUPERVISOR' | 'WAITER' | 'CHEF' | 'STOREKEEPER';

export interface StaffDocument {
  id: string;
  name: string;
  fileData: string;
  uploadDate: string;
}

export interface Supervisor {
  id: string;
  name: string;
  loginId: string;
  password?: string;
  role: UserRole;
  assignedRoomIds: string[]; // For cleaning/oversight assignment
  status: 'ACTIVE' | 'INACTIVE';
  lastActive?: string;
  phone?: string;
  
  // New HR Fields
  email?: string;
  address?: string;
  fatherName?: string;
  alternateNumber?: string;
  bloodGroup?: string;
  nomineeName?: string;
  nomineeRelation?: string;
  photo?: string;
  
  // Salary Structure (Slap)
  basicPay: number;
  hra: number;
  vehicleAllowance: number;
  otherAllowances: number;
  
  // Banking
  panNumber?: string;
  uanNumber?: string;
  esiNumber?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  
  // Documents
  documents?: StaffDocument[];
}

export interface PayrollRecord {
  id: string;
  staffId: string;
  month: string; // YYYY-MM
  daysInMonth: number;
  workedDays: number;
  lopDays: number;
  
  // Earnings
  basicPay: number;
  hra: number;
  vehicleAllowance: number;
  otherAllowances: number;
  bonus: number;
  grossEarnings: number;

  // Deductions
  epfEmployee: number;
  esiEmployee: number;
  tds: number;
  loanRecovery: number;
  otherDeductions: number;
  totalDeductions: number;

  /* Added missing employer contribution fields */
  epfEmployer: number;
  esiEmployer: number;

  netSalary: number;
  status: 'PENDING' | 'PAID';
  paymentDate?: string;
  paymentMethod?: string;
}

export interface LeaveRequest {
  id: string;
  staffId: string;
  startDate: string;
  endDate: string;
  type: 'SL' | 'CL' | 'EL' | 'LWP';
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface Guest {
  id: string;
  name: string; 
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  nationality: string;
  idType: 'Aadhar' | 'Passport' | 'PAN' | 'VoterId' | 'License' | 'Other';
  idNumber: string;
  adults: number;
  children: number;
  kids: number;
  others: number;
  documents: any;
  arrivalFrom?: string;
  nextDestination?: string;
  purposeOfVisit?: string;
  remarks?: string;
  gender?: 'Male' | 'Female' | 'Other';

  /* Added missing GRC fields used in GRCFormView */
  surName?: string;
  givenName?: string;
  dob?: string;
  country?: string;
  passportNo?: string;
  passportPlaceOfIssue?: string;
  passportDateOfExpiry?: string;
  visaNo?: string;
  visaType?: string;
  visaDateOfExpiry?: string;
}

export interface BanquetHall {
  id: string;
  name: string;
  capacity: number;
  basePrice: number;
  type: 'HALL' | 'LAWN';
}

export interface EventBooking {
  id: string;
  hallId: string;
  guestName: string;
  guestPhone: string;
  eventName: string;
  eventType: string;
  date: string;
  startTime: string;
  endTime: string;
  totalAmount: number;
  advancePaid: number;
  discount: number;
  paymentMode: string;
  status: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED' | 'COMPLETED' | 'SETTLED';
  /* Updated catering type to use proper interface */
  catering?: EventCatering;
  guestCount: number;
  decorationCharge: number;
  lightingCharge: number;
  musicCharge: number;
  otherCharges: number;
}

export interface DiningBill {
  id: string;
  billNo: string;
  date: string;
  outletId: string;
  tableNumber: string;
  items: any[];
  subTotal: number;
  taxAmount: number;
  grandTotal: number;
  paymentMode: string;
  guestName: string;
  guestPhone: string;
  roomBookingId?: string;
}

export interface Booking {
  id: string;
  bookingNo: string;
  roomId: string;
  guestId: string;
  groupId?: string; 
  checkInDate: string;
  checkInTime: string;
  checkOutDate: string;
  checkOutTime: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'RESERVED';
  /* Updated any types to concrete types */
  charges: Charge[];
  payments: Payment[];
  basePrice: number;
  discount: number;
  mealPlan?: string;
  /* Added optional fields used across components */
  secondaryGuest?: any;
  purpose?: string;
}

export type TransactionType = 'RECEIPT' | 'PAYMENT' | 'JOURNAL';
export type AccountGroupName = 'Capital' | 'Fixed Asset' | 'Current Asset' | 'Direct Expense' | 'Indirect Expense' | 'Direct Income' | 'Indirect Income' | 'Current Liability' | 'Operating';

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  accountGroup: AccountGroupName;
  ledger: string;
  amount: number;
  entityName?: string;
  description: string;
  referenceId?: string;
}

export interface HostelSettings {
  name: string;
  address: string;
  /* Updated agents to use proper type */
  agents: AgentConfig[];
  roomTypes: string[];
  mealPlans: string[];
  taxRate: number;
  wifiPassword?: string;
  receptionPhone?: string;
  roomServicePhone?: string;
  logo?: string;
  wallpaper?: string;
  signature?: string;
  gstNumber?: string;
  upiId?: string;
  /* Added missing configuration properties */
  floors: number[];
  hsnCode?: string;
  adminPassword?: string;
  receptionistPassword?: string;
  accountantPassword?: string;
  supervisorPassword?: string;
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
  epfRateEmployee?: number;
  epfRateEmployer?: number;
  esiRateEmployee?: number;
  esiRateEmployer?: number;
}

export interface GroupProfile {
  id: string;
  groupName: string;
  phone: string;
  email: string;
  headName: string;
  status: string;
  billingPreference: string;
  groupType?: string;
  orgName?: string;
}

export interface Quotation { id: string; date: string; guestName: string; amount: number; remarks: string; }
export interface RoomShiftLog { id: string; date: string; bookingId: string; guestName?: string; fromRoom?: string; toRoom?: string; reason?: string; }
export interface RoomShiftLog { id: string; date: string; bookingId: string; guestName?: string; fromRoom?: string; toRoom?: string; reason?: string; }
export interface CleaningLog { id: string; date: string; roomId: string; staffName?: string; }
export interface CateringItem { id: string; name: string; category: string; pricePerPlate: number; /* Added missing ingredients field */ ingredients?: CateringIngredient[]; }
export interface RestaurantOutlet { id: string; name: string; type: string; }
export type DietaryType = 'VEG' | 'NON-VEG' | 'EGG';
export interface MenuItem { id: string; name: string; category: string; subcategory: string; price: number; outletId: string; isAvailable: boolean; dietaryType: DietaryType; }
export interface DiningTable { id: string; number: string; outletId: string; status: 'VACANT' | 'OCCUPIED'; }
export interface KOT { id: string; tableId: string; outletId: string; waiterId: string; items: any[]; status: 'PENDING' | 'PREPARING' | 'SERVED'; timestamp: string; bookingId?: string; }
export interface InventoryItem { id: string; name: string; category: string; unit: string; currentStock: number; minStockLevel: number; lastPurchasePrice: number; }
export interface Vendor { id: string; name: string; contact: string; gstin?: string; category: string; }
export interface FacilityUsage { 
  id: string; 
  facilityId: string; 
  guestId: string; 
  startTime: string; 
  endTime?: string; 
  amount: number; 
  isBilledToRoom: boolean; 
  items?: any[];
  /* Added missing field for walk-in guest information */
  outsiderInfo?: {
    name: string;
    phone: string;
    email: string;
  };
}
export interface TravelBooking { id: string; guestId: string; guestName: string; vehicleType: string; vehicleNumber: string; driverName: string; pickupLocation: string; dropLocation: string; date: string; time: string; kmUsed: number; daysOfTravelling: number; amount: number; status: string; roomBookingId?: string; }
export interface TravelBooking { id: string; guestId: string; guestName: string; vehicleType: string; vehicleNumber: string; driverName: string; pickupLocation: string; dropLocation: string; date: string; time: string; kmUsed: number; daysOfTravelling: number; amount: number; status: string; roomBookingId?: string; }
export interface StockReceipt { id: string; itemId: string; vendorId: string; quantity: number; unitPrice: number; totalAmount: number; paymentMade: number; paymentMode: string; date: string; billNumber: string; }
