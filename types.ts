
export enum RoomStatus {
  VACANT = 'VACANT',
  OCCUPIED = 'OCCUPIED',
  RESERVED = 'RESERVED',
  DIRTY = 'DIRTY',
  REPAIR = 'REPAIR',
  MANAGEMENT = 'MANAGEMENT',
  STAFF_BLOCK = 'STAFF_BLOCK'
}

export interface Charge {
  id: string;
  description: string;
  amount: number;
  date: string;
}

export interface Payment {
  id: string;
  amount: number;
  date: string;
  method: string;
  remarks?: string;
}

export interface Occupant {
  id: string;
  name: string;
  gender: 'Male' | 'Female' | 'Other';
  idFront?: string;
  idBack?: string;
}

export interface MealPlanConfig {
  name: string;
  rate: number;
}

export interface AgentConfig {
  name: string;
  commission: number;
}

export interface BlockConfig {
  id: string;
  name: string;
  prefix: string;
  color: string;
}

export interface Room {
  id: string;
  number: string;
  floor: string;
  type: string;
  price: number;
  status: RoomStatus;
  currentBookingId?: string;
  block: string;
  bedType: string;
  defaultMealPlan?: string;
  mealPlanRate?: number;
}

export type UserRole = 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'RECEPTIONIST' | 'ACCOUNTANT' | 'SUPERVISOR' | 'WAITER' | 'CHEF' | 'STOREKEEPER';

export interface Supervisor {
  id: string;
  name: string;
  loginId: string;
  password?: string;
  role: UserRole;
  assignedRoomIds: string[];
  status: 'ACTIVE' | 'INACTIVE';
  photo?: string;
  phone?: string;
  basicPay?: number;
  hra?: number;
  vehicleAllowance?: number;
  otherAllowances?: number;
  bankName?: string;
  accountNumber?: string;
  bankIfsc?: string;
  bankBranch?: string;
  uanNumber?: string;
  dob?: string;
  fatherName?: string;
  address?: string;
  familyAddress?: string;
  alternatePhone?: string;
  gender?: 'Male' | 'Female' | 'Other';
  relationshipStatus?: string;
  nominee?: string;
  idDocument?: string;
  additionalDocs?: string[]; // Array for 5 documents
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
  idType: string;
  idNumber: string;
  documents: any;
  gender?: 'Male' | 'Female' | 'Other';
  adults?: number;
  children?: number;
  kids?: number;
  others?: number;
  purposeOfVisit?: string;
  arrivalFrom?: string;
  nextDestination?: string;
  remarks?: string;
  surName?: string;
  givenName?: string;
  dob?: string;
  country?: string;
  passportNo?: string;
  passportPlaceOfIssue?: string;
  passportDateOfIssue?: string;
  passportDateOfExpiry?: string;
  visaNo?: string;
  visaType?: string;
  visaPlaceOfIssue?: string;
  visaDateOfIssue?: string;
  visaDateOfExpiry?: string;
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
  charges: Charge[];
  payments: Payment[];
  basePrice: number;
  discount: number;
  mealPlan?: string;
  secondaryGuest?: any;
  purpose?: string;
}

export type TransactionType = 'RECEIPT' | 'PAYMENT' | 'JOURNAL';
export type AccountGroupName = 'Capital' | 'Fixed Asset' | 'Current Asset' | 'Direct Expense' | 'Indirect Expense' | 'Direct Income' | 'Indirect Income' | 'Current Liability' | 'Operating';

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  accountGroup: AccountGroupName | string;
  ledger: string;
  amount: number;
  entityName?: string;
  description: string;
}

export interface HostelSettings {
  id: string;
  name: string;
  address: string;
  agents: AgentConfig[];
  roomTypes: string[];
  mealPlans: string[];
  mealPlanRates: MealPlanConfig[];
  floors: string[];
  blocks: BlockConfig[];
  bedTypes: string[];
  taxRate: number;
  wifiPassword?: string;
  receptionPhone?: string;
  roomServicePhone?: string;
  logo?: string;
  wallpaper?: string;
  signature?: string;
  gstNumber?: string;
  upiId?: string;
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
  guestAppWelcome?: string;
  guestAppPersona?: string;
  externalApiKey?: string;
}

export interface GroupProfile {
  id: string;
  groupName: string;
  groupType: string;
  headName: string;
  phone: string;
  email: string;
  billingPreference: 'Single' | 'Split' | string;
  orgName?: string;
  status: 'ACTIVE' | 'INACTIVE';
  documents?: any;
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
  guestId?: string;
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
  status: 'TENTATIVE' | 'CONFIRMED' | 'SETTLED' | 'CANCELLED';
  guestCount: number;
  decorationCharge?: number;
  lightingCharge?: number;
  musicCharge?: number;
  otherCharges?: number;
  catering?: EventCatering;
}

export interface EventCatering {
  items: { itemId: string; name: string; qty: number; price: number }[];
  plateCount: number;
  totalCateringCharge: number;
}

export interface CateringIngredient {
  name: string;
  qtyPerPlate: number;
  unit: string;
  unitCost: number;
}

export type EventType = 'Birthday' | 'Wedding' | 'Corporate' | 'Other';
export type DietaryType = 'VEG' | 'NON-VEG' | 'EGG';
export type Facility = 'GYM' | 'POOL' | 'LAUNDRY';

export interface Quotation { id: string; date: string; guestName: string; amount: number; remarks: string; }
export interface RoomShiftLog { id: string; date: string; bookingId: string; guestName?: string; fromRoom?: string; toRoom?: string; reason?: string; }
export interface CleaningLog { id: string; date: string; roomId: string; staffName?: string; }
export interface CateringItem { id: string; name: string; category: string; pricePerPlate: number; ingredients?: CateringIngredient[]; }
export interface RestaurantOutlet { id: string; name: string; type: string; }
export interface MenuItem { id: string; name: string; category: string; subcategory: string; price: number; outletId: string; isAvailable: boolean; dietaryType: DietaryType; photo?: string; }
export interface DiningTable { id: string; number: string; outletId: string; status: 'VACANT' | 'OCCUPIED'; }
export interface KOT { id: string; tableId: string; outletId: string; waiterId: string; items: any[]; status: 'PENDING' | 'PREPARING' | 'SERVED'; timestamp: string; bookingId?: string; }
export interface DiningBill { id: string; billNo: string; date: string; outletId: string; tableNumber: string; items: any[]; subTotal: number; taxAmount: number; grandTotal: number; paymentMode: string; guestName: string; guestPhone: string; roomBookingId?: string; }
export interface InventoryItem { id: string; name: string; category: string; unit: string; currentStock: number; minStockLevel: number; lastPurchasePrice: number; }
export interface Vendor { id: string; name: string; contact: string; gstin?: string; category: string; }
export interface FacilityUsage { id: string; facilityId: Facility | string; guestId: string; startTime: string; endTime?: string; amount: number; isBilledToRoom: boolean; items?: any[]; outsiderInfo?: any; }
export interface TravelBooking { id: string; guestId: string; guestName: string; vehicleType: string; vehicleNumber: string; driverName: string; pickupLocation: string; dropLocation: string; date: string; time: string; kmUsed: number; daysOfTravelling: number; amount: number; status: string; roomBookingId?: string; }
export interface StockReceipt { id: string; itemId: string; vendorId: string; quantity: number; unitPrice: number; totalAmount: number; paymentMade: number; paymentMode: string; date: string; billNumber: string; }

export interface PayrollRecord { 
  id: string; 
  staffId: string; 
  month: string; 
  workedDays: number; 
  lopDays: number; 
  basicPay: number; 
  netSalary: number; 
  status: 'PENDING' | 'PAID'; 
  paymentDate?: string; 
  paymentMethod?: string;
  daysInMonth: number;
  hra: number;
  vehicleAllowance: number;
  otherAllowances: number;
  bonus: number;
  grossEarnings: number;
  epfEmployee: number;
  esiEmployee: number;
  tds: number;
  loanRecovery: number;
  otherDeductions: number;
  totalDeductions: number;
  epfEmployer: number;
  esiEmployer: number;
}
export interface LeaveRequest { id: string; staffId: string; startDate: string; endDate: string; type: 'SL' | 'CL' | 'EL' | 'LWP'; reason: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; }
