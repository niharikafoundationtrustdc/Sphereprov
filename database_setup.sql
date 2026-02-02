-- HOTEL SPHERE PRO: COMPREHENSIVE MASTER DATABASE SETUP
-- VERSION: 5.4.0 (Fix: Schema Mismatch & Missing Columns)
-- TARGET: SUPABASE POSTGRESQL

-- 1. PROPERTY BLUEPRINT
CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    number TEXT NOT NULL,
    floor TEXT NOT NULL DEFAULT '1',
    block TEXT DEFAULT 'Main',
    type TEXT NOT NULL,
    price NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'VACANT',
    "currentBookingId" TEXT,
    "bedType" TEXT DEFAULT 'Double Bed',
    "defaultMealPlan" TEXT,
    "mealPlanRate" NUMERIC DEFAULT 0
);

CREATE TABLE IF NOT EXISTS guests (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    nationality TEXT DEFAULT 'Indian',
    "idType" TEXT DEFAULT 'Aadhar',
    "idNumber" TEXT,
    adults INT DEFAULT 1,
    children INT DEFAULT 0,
    kids INT DEFAULT 0,
    others INT DEFAULT 0,
    documents JSONB DEFAULT '{}'::jsonb,
    "arrivalFrom" TEXT,
    "nextDestination" TEXT,
    "purposeOfVisit" TEXT,
    remarks TEXT,
    "surName" TEXT,
    "givenName" TEXT,
    dob TEXT,
    country TEXT,
    gender TEXT,
    "passportNo" TEXT,
    "passportPlaceOfIssue" TEXT,
    "passportDateOfIssue" TEXT,
    "passportDateOfExpiry" TEXT,
    "visaNo" TEXT,
    "visaType" TEXT,
    "visaPlaceOfIssue" TEXT,
    "visaDateOfIssue" TEXT,
    "visaDateOfExpiry" TEXT
);

-- 2. OPERATIONAL FLOW
CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    "bookingNo" TEXT NOT NULL,
    "roomId" TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    "guestId" TEXT NOT NULL REFERENCES guests(id),
    "groupId" TEXT,
    "checkInDate" DATE NOT NULL DEFAULT CURRENT_DATE,
    "checkInTime" TIME NOT NULL DEFAULT CURRENT_TIME,
    "checkOutDate" DATE NOT NULL,
    "checkOutTime" TIME DEFAULT '11:00',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    charges JSONB DEFAULT '[]'::jsonb,
    payments JSONB DEFAULT '[]'::jsonb,
    "basePrice" NUMERIC NOT NULL DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    "mealPlan" TEXT DEFAULT 'EP (Room Only)',
    "secondaryGuest" JSONB,
    purpose TEXT
);

-- 3. HUMAN RESOURCES & PAYROLL
CREATE TABLE IF NOT EXISTS supervisors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    "loginId" TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL DEFAULT 'admin',
    role TEXT DEFAULT 'RECEPTIONIST',
    "assignedRoomIds" JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'ACTIVE',
    photo TEXT,
    phone TEXT,
    "basicPay" NUMERIC DEFAULT 0,
    hra NUMERIC DEFAULT 0,
    "vehicleAllowance" NUMERIC DEFAULT 0,
    "otherAllowances" NUMERIC DEFAULT 0,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "uanNumber" TEXT
);

CREATE TABLE IF NOT EXISTS payroll (
    id TEXT PRIMARY KEY,
    "staffId" TEXT REFERENCES supervisors(id),
    month TEXT NOT NULL,
    "daysInMonth" INT DEFAULT 30,
    "workedDays" NUMERIC DEFAULT 30,
    "lopDays" NUMERIC DEFAULT 0,
    "basicPay" NUMERIC DEFAULT 0,
    hra NUMERIC DEFAULT 0,
    "vehicleAllowance" NUMERIC DEFAULT 0,
    "otherAllowances" NUMERIC DEFAULT 0,
    bonus NUMERIC DEFAULT 0,
    "grossEarnings" NUMERIC DEFAULT 0,
    "epfEmployee" NUMERIC DEFAULT 0,
    "esiEmployee" NUMERIC DEFAULT 0,
    tds NUMERIC DEFAULT 0,
    "loanRecovery" NUMERIC DEFAULT 0,
    "otherDeductions" NUMERIC DEFAULT 0,
    "totalDeductions" NUMERIC DEFAULT 0,
    "epfEmployer" NUMERIC DEFAULT 0,
    "esiEmployer" NUMERIC DEFAULT 0,
    "netSalary" NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'PENDING',
    "paymentDate" TIMESTAMP WITH TIME ZONE,
    "paymentMethod" TEXT
);

-- 4. FINANCIAL LEDGERS
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    type TEXT NOT NULL,
    "accountGroup" TEXT NOT NULL,
    ledger TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    "entityName" TEXT,
    description TEXT,
    "referenceId" TEXT
);

CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    "groupName" TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    "headName" TEXT NOT NULL,
    status TEXT DEFAULT 'ACTIVE',
    "billingPreference" TEXT DEFAULT 'Single',
    "groupType" TEXT,
    "orgName" TEXT,
    documents JSONB DEFAULT '{}'::jsonb
);

-- 5. BANQUETS & CATERING
CREATE TABLE IF NOT EXISTS banquet_halls (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    capacity INT DEFAULT 100,
    "basePrice" NUMERIC DEFAULT 0,
    type TEXT DEFAULT 'HALL'
);

CREATE TABLE IF NOT EXISTS event_bookings (
    id TEXT PRIMARY KEY,
    "hallId" TEXT REFERENCES banquet_halls(id),
    "guestName" TEXT NOT NULL,
    "guestPhone" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "eventType" TEXT,
    date DATE NOT NULL,
    "startTime" TIME,
    "endTime" TIME,
    "totalAmount" NUMERIC DEFAULT 0,
    "advancePaid" NUMERIC DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    "paymentMode" TEXT DEFAULT 'Cash',
    status TEXT DEFAULT 'TENTATIVE',
    catering JSONB,
    "guestCount" INT DEFAULT 50
);

CREATE TABLE IF NOT EXISTS catering_menu (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    "pricePerPlate" NUMERIC DEFAULT 0,
    ingredients JSONB DEFAULT '[]'::jsonb
);

-- 6. SYSTEM CONFIG (Updated for miscellaneous module storage)
CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY DEFAULT 'primary',
    name TEXT NOT NULL DEFAULT 'Hotel Sphere Pro',
    address TEXT,
    agents JSONB DEFAULT '[]'::jsonb,
    "roomTypes" JSONB DEFAULT '[]'::jsonb,
    "mealPlans" JSONB DEFAULT '[]'::jsonb,
    "mealPlanRates" JSONB DEFAULT '[]'::jsonb,
    floors JSONB DEFAULT '[]'::jsonb,
    blocks JSONB DEFAULT '[]'::jsonb,
    "taxRate" NUMERIC DEFAULT 12,
    "gstNumber" TEXT,
    "upiId" TEXT,
    logo TEXT,
    signature TEXT,
    wallpaper TEXT,
    "hsnCode" TEXT DEFAULT '9963',
    "adminPassword" TEXT DEFAULT 'admin',
    "receptionistPassword" TEXT DEFAULT 'admin',
    "accountantPassword" TEXT DEFAULT 'admin',
    "supervisorPassword" TEXT DEFAULT 'admin',
    "list" JSONB, -- For module collections like Facility Packages
    "config" JSONB -- For module specific configs
);

-- REFRESH CACHE
NOTIFY pgrst, 'reload schema';