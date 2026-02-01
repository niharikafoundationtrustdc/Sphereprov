
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../services/db';
import { subscribeToTable } from '../services/supabase';
import { RestaurantOutlet, MenuItem, DiningTable, KOT, Room, Booking, DietaryType, Transaction, UserRole, Charge, Guest, DiningBill } from '../types';

interface DiningModuleProps {
  rooms: Room[];
  bookings: Booking[];
  guests: Guest[];
  settings: any;
  userRole: UserRole;
  onUpdateBooking?: (updated: Booking) => void;
}

const CATEGORIES = [
  "MOCKTAILS", "SOUPS", "PAPAD AND SALAD", "RAITA", "BREAKFAST", "PIZZA & SANDWICHS", 
  "CHINESE RICE & NOODLES", "TANDOOR STARTER", "INDIAN MAIN COURSE", "RICE AND BIRYANI", 
  "TANDOORI ROTI", "SWEETS", "PASTA", "CHINESE STARTER"
];

const DiningModule: React.FC<DiningModuleProps> = ({ rooms, bookings, guests, settings, userRole, onUpdateBooking }) => {
  const [activeTab, setActiveTab] = useState<'POS' | 'KITCHEN' | 'MENU' | 'TABLES' | 'QR' | 'OUTLETS'>('POS');
  const [outlets, setOutlets] = useState<RestaurantOutlet[]>([]);
  const [selectedOutlet, setSelectedOutlet] = useState<RestaurantOutlet | null>(null);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [allKots, setAllKots] = useState<KOT[]>([]);
  
  // Management States
  const [editingMenuItem, setEditingMenuItem] = useState<Partial<MenuItem> | null>(null);
  const [editingTable, setEditingTable] = useState<Partial<DiningTable> | null>(null);
  const [editingOutlet, setEditingOutlet] = useState<Partial<RestaurantOutlet> | null>(null);

  const [posCategory, setPosCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTable, setSelectedTable] = useState<DiningTable | null>(null);
  const [cart, setCart] = useState<{item: MenuItem, qty: number}[]>([]);
  const [showSettlement, setShowSettlement] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Audio for Kitchen
  const bellAudio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    bellAudio.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
  }, []);

  const playAlert = () => {
    if (soundEnabled && bellAudio.current) {
      bellAudio.current.play().catch(e => console.debug("Audio play blocked by browser."));
    }
  };

  const refreshData = async () => {
    const o = await db.restaurants.toArray();
    setOutlets(o);
    if (!selectedOutlet && o.length > 0) setSelectedOutlet(o[0]);

    const t = await db.diningTables.toArray();
    setTables(t);

    const m = await db.menuItems.toArray();
    setMenu(m);

    const k = await db.kots.toArray();
    setAllKots(k);
  };

  useEffect(() => {
    const init = async () => {
      // 1. Seed Outlets: Main Restaurant and Poolside Restaurant
      let currentOutlets = await db.restaurants.toArray();
      if (currentOutlets.length === 0) {
        const o1 = { id: 'rest-main', name: 'Main Restaurant', type: 'FineDine' };
        const o2 = { id: 'rest-pool', name: 'Poolside Restaurant', type: 'Cafe' };
        await db.restaurants.bulkPut([o1, o2]);
        currentOutlets = [o1, o2];
      }
      
      // 2. Seed Tables for both outlets
      let currentTables = await db.diningTables.toArray();
      if (currentTables.length === 0) {
        const seedTables: DiningTable[] = [];
        // Main Restaurant R1-R11
        for (let i = 1; i <= 11; i++) {
          seedTables.push({ id: `T-MAIN-R${i}`, number: `R${i}`, outletId: 'rest-main', status: 'VACANT' });
        }
        // Poolside P1-P10
        for (let i = 1; i <= 10; i++) {
          seedTables.push({ id: `T-POOL-P${i}`, number: `P${i}`, outletId: 'rest-pool', status: 'VACANT' });
        }
        await db.diningTables.bulkPut(seedTables);
      }

      // 3. Seed exhaustive menu from image if needed
      let currentMenu = await db.menuItems.toArray();
      if (currentMenu.length < 50) {
        const seedData: Partial<MenuItem>[] = [
          // MOCKTAILS
          { name: "MINERAL WATER", category: "MOCKTAILS", price: 30 },
          { name: "TEA", category: "MOCKTAILS", price: 30 },
          { name: "GREEN TEA", category: "MOCKTAILS", price: 40 },
          { name: "COFFEE", category: "MOCKTAILS", price: 40 },
          { name: "ICE TEA", category: "MOCKTAILS", price: 99 },
          { name: "HOT MILK", category: "MOCKTAILS", price: 50 },
          { name: "FRESH LINE SODA & WATER", category: "MOCKTAILS", price: 69 },
          { name: "LASSI (SWEET OR SALTY)", category: "MOCKTAILS", price: 89 },
          { name: "COLD DRINK", category: "MOCKTAILS", price: 30 },
          { name: "MASALA COLD DRINKS", category: "MOCKTAILS", price: 49 },
          { name: "COLD COFFEE", category: "MOCKTAILS", price: 129 },
          { name: "COLD COFFEE WITH ICE CREAM", category: "MOCKTAILS", price: 159 },
          { name: "CENDRELLA", category: "MOCKTAILS", price: 139 },
          { name: "VARJIN MOHITO (WATER MELON GUAVA)", category: "MOCKTAILS", price: 149 },
          { name: "BLUE LOOGAN", category: "MOCKTAILS", price: 149 },
          { name: "ORANGE BLOSOM", category: "MOCKTAILS", price: 149 },
          { name: "FRUIT PUNCH", category: "MOCKTAILS", price: 159 },
          { name: "SPECIAL SHAKE", category: "MOCKTAILS", price: 159 },
          // SOUPS
          { name: "CREAM OF TOMATO", category: "SOUPS", price: 129 },
          { name: "CREAM OF MASHROOM", category: "SOUPS", price: 129 },
          { name: "HOT SOUR SOUP", category: "SOUPS", price: 129 },
          { name: "MANCHOW SOUP", category: "SOUPS", price: 129 },
          { name: "SWEET CORN SOUP", category: "SOUPS", price: 129 },
          { name: "VEG TIKKA SOUP", category: "SOUPS", price: 129 },
          { name: "MAI-TAI SOUP", category: "SOUPS", price: 129 },
          { name: "CLEAR SOUP", category: "SOUPS", price: 129 },
          { name: "LEMAN CORIANDER SOUP", category: "SOUPS", price: 129 },
          // PAPAD AND SALAD
          { name: "ROAST PAPAD", category: "PAPAD AND SALAD", price: 29 },
          { name: "FRY PAPAD", category: "PAPAD AND SALAD", price: 39 },
          { name: "MASAL PAPAD", category: "PAPAD AND SALAD", price: 59 },
          { name: "SHUBHKAMNA SP PAPAD", category: "PAPAD AND SALAD", price: 69 },
          { name: "ONION SALAD", category: "PAPAD AND SALAD", price: 49 },
          { name: "GREEN SALAD", category: "PAPAD AND SALAD", price: 79 },
          { name: "RASIAN SALAD", category: "PAPAD AND SALAD", price: 99 },
          { name: "TOAST SALAD", category: "PAPAD AND SALAD", price: 89 },
          { name: "PAPADI CHANT SALAD", category: "PAPAD AND SALAD", price: 110 },
          { name: "KACHUMBER SALAD", category: "PAPAD AND SALAD", price: 89 },
          { name: "CURD SALAD", category: "PAPAD AND SALAD", price: 110 },
          { name: "SHUBHKAMNA SP SALAD", category: "PAPAD AND SALAD", price: 110 },
          // RAITA
          { name: "VEG RAITA", category: "RAITA", price: 119 },
          { name: "BOONDI RAITA", category: "RAITA", price: 149 },
          { name: "PINE APPLE RAITA", category: "RAITA", price: 149 },
          { name: "MINT RAITA", category: "RAITA", price: 119 },
          { name: "PLAIN CURD", category: "RAITA", price: 70 },
          // BREAKFAST
          { name: "DOSA (PLAIN)", category: "BREAKFAST", price: 79 },
          { name: "DOSA (MASALA)", category: "BREAKFAST", price: 99 },
          { name: "MYSUR DOSA", category: "BREAKFAST", price: 110 },
          { name: "RAVA DOSA", category: "BREAKFAST", price: 129 },
          { name: "MASALA CUT PIECE DOSA", category: "BREAKFAST", price: 109 },
          { name: "UTTAPAM (ONION/TOMATO)", category: "BREAKFAST", price: 119 },
          { name: "IDALY SAMBHAR (3PC)", category: "BREAKFAST", price: 59 },
          { name: "WADA SAMBAR (2PC)", category: "BREAKFAST", price: 69 },
          { name: "PANEER MASALA DOSA", category: "BREAKFAST", price: 139 },
          { name: "CHEESE MASALA DOSA", category: "BREAKFAST", price: 139 },
          { name: "BUTTER MASALA DOSA", category: "BREAKFAST", price: 109 },
          { name: "ALOO PARATHA", category: "BREAKFAST", price: 89 },
          { name: "PANEER PARATHA", category: "BREAKFAST", price: 119 },
          { name: "POORI BHAJI (4PC)", category: "BREAKFAST", price: 109 },
          { name: "CHOLE BHATURE", category: "BREAKFAST", price: 139 },
          { name: "EXTRA BHATURA", category: "BREAKFAST", price: 59 },
          { name: "FRENCH FRIES", category: "BREAKFAST", price: 129 },
          { name: "PERI PERI FRY", category: "BREAKFAST", price: 149 },
          { name: "VEG PAKODA", category: "BREAKFAST", price: 129 },
          { name: "ONION LACHHA PARATHA", category: "BREAKFAST", price: 129 },
          { name: "PANEER PAKODA", category: "BREAKFAST", price: 149 },
          { name: "CHANA ROAST", category: "BREAKFAST", price: 149 },
          { name: "VEG CUTTLET", category: "BREAKFAST", price: 119 },
          // PIZZA & SANDWICHS
          { name: "MARGRITA PIZZA", category: "PIZZA & SANDWICHS", price: 219 },
          { name: "FORSIZEN PIZZA", category: "PIZZA & SANDWICHS", price: 219 },
          { name: "CHEESE CORN PIZZA", category: "PIZZA & SANDWICHS", price: 219 },
          { name: "PANEER TIKKA PIZZA", category: "PIZZA & SANDWICHS", price: 239 },
          { name: "RAISAN SANDWICH", category: "PIZZA & SANDWICHS", price: 129 },
          { name: "MUMBAI MASALA SANDWICH", category: "PIZZA & SANDWICHS", price: 119 },
          { name: "VEG GRILL SANDWICH", category: "PIZZA & SANDWICHS", price: 119 },
          { name: "CHOCOLET SANDWICH", category: "PIZZA & SANDWICHS", price: 119 },
          { name: "VEG SANDWICH", category: "PIZZA & SANDWICHS", price: 99 },
          { name: "PANEER 65", category: "PIZZA & SANDWICHS", price: 259 },
          { name: "DRAGAN PANEER", category: "PIZZA & SANDWICHS", price: 259 },
          { name: "NOUNY CHILLY POTOTO", category: "PIZZA & SANDWICHS", price: 219 },
          { name: "SHUBHKAMNA SP. PANEER", category: "PIZZA & SANDWICHS", price: 259 },
          { name: "PANEER CRANCHI VEG", category: "PIZZA & SANDWICHS", price: 259 },
          // CHINESE RICE & NOODLES
          { name: "VEG NOODLES", category: "CHINESE RICE & NOODLES", price: 199 },
          { name: "VEG HAKKA NOODLES", category: "CHINESE RICE & NOODLES", price: 219 },
          { name: "SCHEZAWAN NOODLES", category: "CHINESE RICE & NOODLES", price: 239 },
          { name: "VEG TRIPLE SCHEZAWAN", category: "CHINESE RICE & NOODLES", price: 259 },
          { name: "SINGAPURI NOODLES", category: "CHINESE RICE & NOODLES", price: 249 },
          { name: "CHILLI GARLIC NOODLES", category: "CHINESE RICE & NOODLES", price: 229 },
          { name: "VEG FRIED RICE", category: "CHINESE RICE & NOODLES", price: 209 },
          { name: "SCHEZAWAN FRIED RICE", category: "CHINESE RICE & NOODLES", price: 219 },
          { name: "CHILLI GARLIC FRIED RICE", category: "CHINESE RICE & NOODLES", price: 219 },
          { name: "PANEER FRIED RICE", category: "CHINESE RICE & NOODLES", price: 249 },
          { name: "MACICAN FRIED RICE", category: "CHINESE RICE & NOODLES", price: 239 },
          // TANDOOR STARTER
          { name: "HARA BHARA KABAB", category: "TANDOOR STARTER", price: 229 },
          { name: "METHI CORN KABAB", category: "TANDOOR STARTER", price: 229 },
          { name: "KHASTA KABAB", category: "TANDOOR STARTER", price: 229 },
          { name: "VEG SHEEKH KABAB", category: "TANDOOR STARTER", price: 239 },
          { name: "BURSHI KABAB", category: "TANDOOR STARTER", price: 239 },
          { name: "DAHI KABAB", category: "TANDOOR STARTER", price: 239 },
          { name: "TANDOOR SOYA CHAP", category: "TANDOOR STARTER", price: 269 },
          { name: "MASHROOM TIKKA", category: "TANDOOR STARTER", price: 249 },
          { name: "PANEER TIKKA", category: "TANDOOR STARTER", price: 259 },
          { name: "PANEER MALAI TIKKA", category: "TANDOOR STARTER", price: 279 },
          { name: "PANEER PAHADI TIKKA", category: "TANDOOR STARTER", price: 259 },
          { name: "PANEER BANJARA TIKKA", category: "TANDOOR STARTER", price: 259 },
          { name: "PANEER SIKH KABAB", category: "TANDOOR STARTER", price: 279 },
          { name: "PANEER ACHARI TIKKA", category: "TANDOOR STARTER", price: 259 },
          { name: "VEG TANDOORI PLATER", category: "TANDOOR STARTER", price: 599 },
          // INDIAN MAIN COURSE
          { name: "BHINDI MASALA", category: "INDIAN MAIN COURSE", price: 199 },
          { name: "ALOO JEERA", category: "INDIAN MAIN COURSE", price: 199 },
          { name: "KADI PAKODA", category: "INDIAN MAIN COURSE", price: 199 },
          { name: "TOMATO CHATANI", category: "INDIAN MAIN COURSE", price: 199 },
          { name: "SEV TOMATO", category: "INDIAN MAIN COURSE", price: 219 },
          { name: "MIX VEG", category: "INDIAN MAIN COURSE", price: 219 },
          { name: "ALOO GOBHI MATAR", category: "INDIAN MAIN COURSE", price: 219 },
          { name: "VEG KADAI", category: "INDIAN MAIN COURSE", price: 219 },
          { name: "BEGAN BHARTA", category: "INDIAN MAIN COURSE", price: 219 },
          { name: "VEG KOLHAPURI", category: "INDIAN MAIN COURSE", price: 229 },
          { name: "VEG KEEMA KASTURI", category: "INDIAN MAIN COURSE", price: 239 },
          { name: "VEG PATIALA", category: "INDIAN MAIN COURSE", price: 249 },
          { name: "VEG KOFTA", category: "INDIAN MAIN COURSE", price: 249 },
          { name: "NAV RATAN KORMA", category: "INDIAN MAIN COURSE", price: 259 },
          { name: "CHANA MASALA", category: "INDIAN MAIN COURSE", price: 219 },
          { name: "DUM ALOO PUNJABI", category: "INDIAN MAIN COURSE", price: 239 },
          { name: "VEG ANGARA", category: "INDIAN MAIN COURSE", price: 269 },
          { name: "CORN PALAK", category: "INDIAN MAIN COURSE", price: 139 },
          { name: "LASUNI PALAK", category: "INDIAN MAIN COURSE", price: 139 },
          { name: "BABY CORN MASHROOM M/S", category: "INDIAN MAIN COURSE", price: 259 },
          { name: "MASHROOM MASALA", category: "INDIAN MAIN COURSE", price: 259 },
          { name: "KAJU CURRY", category: "INDIAN MAIN COURSE", price: 289 },
          { name: "KAJU MASALA", category: "INDIAN MAIN COURSE", price: 289 },
          { name: "PANEER BUTTER MASALA", category: "INDIAN MAIN COURSE", price: 279 },
          { name: "PANEER TIKKA MASALA", category: "INDIAN MAIN COURSE", price: 299 },
          { name: "PANEER MASALA", category: "INDIAN MAIN COURSE", price: 259 },
          { name: "PALAK PANEER", category: "INDIAN MAIN COURSE", price: 259 },
          { name: "PANEER PUNJAB", category: "INDIAN MAIN COURSE", price: 259 },
          { name: "MATTER PANEER", category: "INDIAN MAIN COURSE", price: 259 },
          { name: "PANEER BHURJI", category: "INDIAN MAIN COURSE", price: 299 },
          { name: "SHAHI PANEER", category: "INDIAN MAIN COURSE", price: 299 },
          { name: "PANEER ANGARA", category: "INDIAN MAIN COURSE", price: 299 },
          { name: "MALAI KOFTA", category: "INDIAN MAIN COURSE", price: 299 },
          { name: "PANEER KADAI", category: "INDIAN MAIN COURSE", price: 259 },
          { name: "SHUBHKAMNA SPECIAL PANEER", category: "INDIAN MAIN COURSE", price: 349 },
          { name: "DAL FRY", category: "INDIAN MAIN COURSE", price: 159 },
          { name: "DAL TADKA", category: "INDIAN MAIN COURSE", price: 179 },
          { name: "DAL MAKHANI", category: "INDIAN MAIN COURSE", price: 229 },
          { name: "DAL DHABA", category: "INDIAN MAIN COURSE", price: 179 },
          { name: "DAL KOLHAPURI", category: "INDIAN MAIN COURSE", price: 189 },
          // RICE AND BIRYANI
          { name: "STEAM RICE", category: "RICE AND BIRYANI", price: 119 },
          { name: "JEERA RICE", category: "RICE AND BIRYANI", price: 149 },
          { name: "LEMAN RICE", category: "RICE AND BIRYANI", price: 169 },
          { name: "VEG PULAO", category: "RICE AND BIRYANI", price: 199 },
          { name: "PEAS PULAO", category: "RICE AND BIRYANI", price: 199 },
          { name: "ONION TOMATO RICE", category: "RICE AND BIRYANI", price: 159 },
          { name: "PANEER PULAO", category: "RICE AND BIRYANI", price: 229 },
          { name: "KASHMIRI PULAO", category: "RICE AND BIRYANI", price: 229 },
          { name: "VEG BIRYANI", category: "RICE AND BIRYANI", price: 219 },
          { name: "VEG DUM BIRYANI", category: "RICE AND BIRYANI", price: 239 },
          { name: "VEG HYDRABADI BIRYANI", category: "RICE AND BIRYANI", price: 239 },
          { name: "PANEER TIKKA BIRYANI", category: "RICE AND BIRYANI", price: 269 },
          { name: "PANEER BIRYANI", category: "RICE AND BIRYANI", price: 259 },
          { name: "DAL KHICHADI", category: "RICE AND BIRYANI", price: 199 },
          { name: "MASALA KHICHADI", category: "RICE AND BIRYANI", price: 229 },
          { name: "CURD RICE", category: "RICE AND BIRYANI", price: 199 },
          // TANDOORI ROTI
          { name: "TANDOORI ROTI", category: "TANDOORI ROTI", price: 20 },
          { name: "TANDOORI BUTTER ROTI", category: "TANDOORI ROTI", price: 30 },
          { name: "PLAIN NAAN", category: "TANDOORI ROTI", price: 49 },
          { name: "BUTTER NAAN", category: "TANDOORI ROTI", price: 59 },
          { name: "GARLIC NAAN", category: "TANDOORI ROTI", price: 89 },
          { name: "KASHMIRI NAAN", category: "TANDOORI ROTI", price: 119 },
          { name: "MISI ROTI", category: "TANDOORI ROTI", price: 69 },
          { name: "GARLIC ROTI", category: "TANDOORI ROTI", price: 49 },
          { name: "LACHHA PARATHA", category: "TANDOORI ROTI", price: 79 },
          { name: "KULCHA PLAIN", category: "TANDOORI ROTI", price: 49 },
          { name: "MASALA KULCHA", category: "TANDOORI ROTI", price: 89 },
          { name: "ROTI BASKET", category: "TANDOORI ROTI", price: 349 },
          // SWEETS
          { name: "ICE CREAM", category: "SWEETS", price: 79 },
          { name: "HOT GULAB JAMUN", category: "SWEETS", price: 59 },
          { name: "MAWA WATI", category: "SWEETS", price: 69 },
          { name: "MUNG DAL HALWA", category: "SWEETS", price: 89 },
          { name: "GAJAR HALWA", category: "SWEETS", price: 89 },
          { name: "CHEESE CHILLI TOAST", category: "SWEETS", price: 139 },
          { name: "BREAD BUTTER TOAST", category: "SWEETS", price: 49 },
          { name: "VEG CHEESE GRILL S/W", category: "SWEETS", price: 129 },
          { name: "CHEESE CORN S/W", category: "SWEETS", price: 139 },
          // PASTA
          { name: "ALFREDO SOUCE (WHITE)", category: "PASTA", price: 189 },
          { name: "ARABIATA SOUCE (RED)", category: "PASTA", price: 199 },
          { name: "MAMA ROSA SOUCE (PINK)", category: "PASTA", price: 199 },
          { name: "SHUBHKAMNA SPECIAL PASTA", category: "PASTA", price: 219 },
          { name: "CHEESE CORN BALL", category: "PASTA", price: 229 },
          { name: "CHEESE BOLL", category: "PASTA", price: 229 },
          { name: "CHEESE CORN ROLL", category: "PASTA", price: 229 },
          { name: "CHEESE CIGAR ROLL", category: "PASTA", price: 239 },
          { name: "NACHHOS WITH CREAMY CHEESE SOUCE", category: "PASTA", price: 249 },
          // CHINESE STARTER
          { name: "CRISPY VEG", category: "CHINESE STARTER", price: 219 },
          { name: "CRISPY CORN", category: "CHINESE STARTER", price: 219 },
          { name: "VEG MANCHURIAN", category: "CHINESE STARTER", price: 219 },
          { name: "VEG SPRING ROLL", category: "CHINESE STARTER", price: 229 },
          { name: "SANGHAI ROLL", category: "CHINESE STARTER", price: 239 },
          { name: "CHINESE BHEL", category: "CHINESE STARTER", price: 219 },
          { name: "VEG LOLYPOP", category: "CHINESE STARTER", price: 239 },
          { name: "SCHEZWAN COLIFLOWER", category: "CHINESE STARTER", price: 219 },
          { name: "PANEER CHILLI", category: "CHINESE STARTER", price: 249 },
          { name: "MASHROOM CHILLI", category: "CHINESE STARTER", price: 249 },
          { name: "SHAHI PETRO", category: "CHINESE STARTER", price: 249 },
          { name: "PANEER MASITIK", category: "CHINESE STARTER", price: 259 },
          { name: "PANEER SATE", category: "CHINESE STARTER", price: 259 },
        ];

        const formattedMenu = seedData.map(item => ({
          ...item,
          id: `mi-${Math.random().toString(36).substr(2, 9)}`,
          outletId: 'rest-main',
          isAvailable: true,
          dietaryType: 'VEG' as DietaryType,
          subcategory: ''
        })) as MenuItem[];
        
        await db.menuItems.bulkPut(formattedMenu);
      }
      
      await refreshData();
      const sub = subscribeToTable('kots', (payload) => {
        if (payload.eventType === 'INSERT') {
          playAlert();
        }
        refreshData();
      });
      return () => sub.unsubscribe();
    };
    init();
  }, [soundEnabled]);

  // Management Handlers
  const handleSaveMenuItem = async () => {
    if (!editingMenuItem?.name || !editingMenuItem?.price || !selectedOutlet) return alert("Fill all fields.");
    const item: MenuItem = {
      ...editingMenuItem,
      id: editingMenuItem.id || `mi-${Math.random().toString(36).substr(2, 9)}`,
      outletId: selectedOutlet.id,
      category: editingMenuItem.category || CATEGORIES[0],
      isAvailable: true,
      dietaryType: editingMenuItem.dietaryType || 'VEG',
      subcategory: ''
    } as MenuItem;
    await db.menuItems.put(item);
    setEditingMenuItem(null);
    refreshData();
  };

  const handleSaveTable = async () => {
    if (!editingTable?.number || !selectedOutlet) return alert("Table number required.");
    const table: DiningTable = {
      ...editingTable,
      id: editingTable.id || `t-${Math.random().toString(36).substr(2, 9)}`,
      outletId: selectedOutlet.id,
      status: editingTable.status || 'VACANT'
    } as DiningTable;
    await db.diningTables.put(table);
    setEditingTable(null);
    refreshData();
  };

  const handleSaveOutlet = async () => {
    if (!editingOutlet?.name) return alert("Outlet name required.");
    const outlet: RestaurantOutlet = {
      ...editingOutlet,
      id: editingOutlet.id || `rest-${Math.random().toString(36).substr(2, 9)}`,
      type: editingOutlet.type || 'FineDine'
    } as RestaurantOutlet;
    await db.restaurants.put(outlet);
    setEditingOutlet(null);
    refreshData();
  };

  const handleGenerateKOT = async () => {
    if (!selectedTable || cart.length === 0 || !selectedOutlet) return;
    const kot: KOT = {
      id: `KOT-${Date.now()}`,
      tableId: selectedTable.id,
      outletId: selectedOutlet.id,
      waiterId: userRole || 'POS-STF',
      items: cart.map(c => ({ menuItemId: c.item.id, quantity: c.qty, notes: '' })),
      status: 'PENDING',
      timestamp: new Date().toISOString()
    };
    await db.kots.put(kot);
    const updatedTable = { ...selectedTable, status: 'OCCUPIED' as const };
    await db.diningTables.put(updatedTable);
    setSelectedTable(updatedTable);
    setCart([]);
    alert("KOT Transmitted to Kitchen 🚀");
    refreshData();
  };

  const tableSubtotal = useMemo(() => {
    if (!selectedTable) return 0;
    const servedTableKots = allKots.filter(k => k.tableId === selectedTable.id || k.tableId === `ROOM-${selectedTable.number}`);
    return servedTableKots.reduce((total, kot) => {
      return total + kot.items.reduce((kSum, it) => {
        const m = menu.find(mi => mi.id === it.menuItemId);
        return kSum + ((m?.price || 0) * it.quantity);
      }, 0);
    }, 0);
  }, [allKots, selectedTable, menu]);

  const filteredMenu = useMemo(() => {
    return menu.filter(m => 
      m.outletId === selectedOutlet?.id && 
      m.isAvailable && 
      (posCategory === 'All' || m.category === posCategory) &&
      (m.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [menu, selectedOutlet, posCategory, searchQuery]);

  const filteredTables = useMemo(() => {
    return tables.filter(t => t.outletId === selectedOutlet?.id);
  }, [tables, selectedOutlet]);

  return (
    <div className="h-full flex flex-col bg-white text-slate-900 overflow-hidden font-sans">
      {/* Top Header Node */}
      <div className="bg-white p-6 border-b-2 border-blue-900 flex flex-col md:flex-row justify-between items-center gap-6 shrink-0 shadow-md">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 bg-orange-600 rounded-2xl flex items-center justify-center text-2xl shadow-lg border-2 border-white">🍽️</div>
           <div>
             <h1 className="text-xl font-black uppercase tracking-tighter leading-none text-blue-900">Dining Command Terminal</h1>
             <div className="flex items-center gap-2 mt-1">
                <select 
                  className="bg-blue-50 text-blue-900 text-[9px] font-black uppercase border-none rounded-lg px-2 py-1 outline-none cursor-pointer"
                  value={selectedOutlet?.id || ''}
                  onChange={(e) => setSelectedOutlet(outlets.find(o => o.id === e.target.value) || null)}
                >
                   {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                   {outlets.length === 0 && <option>No Outlets</option>}
                </select>
                <button onClick={() => setActiveTab('OUTLETS')} className="text-[9px] font-bold text-slate-400 uppercase underline ml-2">Manage Venues</button>
             </div>
           </div>
        </div>
        <div className="flex gap-1.5 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 shadow-inner no-print overflow-x-auto max-w-full scrollbar-hide">
           <TabBtn active={activeTab === 'POS'} label="ORDERING" onClick={() => setActiveTab('POS')} />
           <TabBtn active={activeTab === 'KITCHEN'} label="KITCHEN VIEW" onClick={() => setActiveTab('KITCHEN')} />
           <TabBtn active={activeTab === 'QR'} label="QR GENERATOR" onClick={() => setActiveTab('QR')} />
           <TabBtn active={activeTab === 'MENU'} label="PRICE LIST" onClick={() => setActiveTab('MENU')} />
           <TabBtn active={activeTab === 'TABLES'} label="FLOOR PLAN" onClick={() => setActiveTab('TABLES')} />
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'POS' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 h-full overflow-hidden animate-in fade-in duration-500 bg-white">
            {/* Left Sidebar: Select Area */}
            <div className="lg:col-span-2 bg-slate-50 border-r border-slate-200 p-6 flex flex-col gap-6 overflow-hidden">
               <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] shrink-0 border-b pb-3">Tables ({selectedOutlet?.name})</h3>
               <div className="grid grid-cols-2 gap-3 overflow-y-auto custom-scrollbar pr-1 pb-4">
                  {filteredTables.map(t => (
                    <button 
                      key={t.id} 
                      onClick={() => setSelectedTable(t)} 
                      className={`aspect-square rounded-[1.8rem] border-2 transition-all flex flex-col items-center justify-center gap-1.5 relative overflow-hidden ${
                        selectedTable?.id === t.id 
                          ? 'bg-blue-900 border-blue-900 text-white shadow-xl scale-105 z-10' 
                          : t.status === 'OCCUPIED' 
                            ? 'bg-orange-50 border-orange-500 text-orange-600 shadow-sm' 
                            : 'bg-white border-blue-900/10 text-slate-400 hover:border-blue-900'
                      }`}
                    >
                      <span className="text-xl font-black tracking-tighter leading-none uppercase">{t.number}</span>
                      <span className="text-[8px] font-black uppercase opacity-60 tracking-widest">{t.status}</span>
                    </button>
                  ))}
               </div>
            </div>

            {/* Middle Section: Categories & Menu Items */}
            <div className="lg:col-span-7 p-6 flex flex-col gap-6 overflow-hidden bg-white">
               <div className="flex flex-col gap-4 shrink-0">
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 border-b border-slate-100">
                    <CatBtn active={posCategory === 'All'} label="ALL ITEMS" onClick={() => setPosCategory('All')} />
                    {CATEGORIES.map(c => <CatBtn key={c} active={posCategory === c} label={c} onClick={() => setPosCategory(c)} />)}
                  </div>
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="Quick Search Menu..." 
                      className="w-full bg-slate-50 border-2 border-slate-100 p-3.5 rounded-2xl font-bold text-xs outline-none focus:bg-white focus:border-blue-900 transition-all shadow-inner text-slate-900"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
                  </div>
               </div>

               <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto custom-scrollbar flex-1 pr-2 pb-10">
                  {filteredMenu.map(item => (
                    <button 
                      key={item.id} 
                      onClick={() => {
                        const exist = cart.find(c => c.item.id === item.id);
                        if (exist) setCart(cart.map(c => c.item.id === item.id ? {...c, qty: c.qty+1} : c));
                        else setCart([...cart, {item, qty: 1}]);
                      }} 
                      className="p-5 bg-white border-2 border-slate-100 rounded-[2rem] text-left hover:border-orange-500 hover:shadow-xl transition-all group relative overflow-hidden h-fit"
                    >
                      <div className="flex justify-between items-start mb-4">
                         <div className={`w-2.5 h-2.5 rounded-full ${item.dietaryType === 'VEG' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                         <span className="text-[12px] font-black text-orange-600">₹{item.price}</span>
                      </div>
                      <p className="text-[11px] font-black uppercase text-slate-800 leading-tight group-hover:text-blue-900 transition-colors">{item.name}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-2">{item.category}</p>
                    </button>
                  ))}
               </div>
            </div>

            {/* Right Sidebar: Active Check / Cart */}
            <div className="lg:col-span-3 bg-white p-8 flex flex-col overflow-hidden border-l-4 border-blue-900 shadow-2xl">
               <div className="border-b-2 border-slate-100 pb-6 mb-8 flex justify-between items-end">
                  <div>
                    <h3 className="font-black text-[10px] uppercase text-orange-500 tracking-[0.4em] mb-2">Active Check</h3>
                    <p className="text-4xl font-black tracking-tighter uppercase leading-none text-blue-900">
                      {selectedTable ? `${selectedTable.number}` : 'STANDBY'}
                    </p>
                  </div>
                  {selectedTable?.status === 'OCCUPIED' && (
                    <div className="bg-emerald-50 px-4 py-1.5 rounded-full text-[9px] font-black text-emerald-600 uppercase border border-emerald-100">RUNNING</div>
                  )}
               </div>

               <div className="flex-1 overflow-y-auto space-y-4 mb-8 custom-scrollbar pr-2">
                  {cart.length > 0 || tableSubtotal > 0 ? (
                    <div className="space-y-3">
                      {cart.map((c, idx) => (
                        <div key={idx} className="bg-slate-50 rounded-2xl p-4 flex flex-col gap-2 border border-slate-100 group">
                           <div className="flex justify-between items-start">
                              <p className="text-[11px] font-black uppercase leading-tight text-slate-800 group-hover:text-blue-900">{c.item.name}</p>
                              <div className="flex items-center gap-3">
                                 <button onClick={() => setCart(cart.map(x => x.item.id === c.item.id ? {...x, qty: Math.max(0, x.qty-1)} : x).filter(x => x.qty > 0))} className="w-6 h-6 bg-white border rounded-lg flex items-center justify-center font-black text-orange-600 shadow-sm">-</button>
                                 <span className="text-[11px] font-black text-slate-900">{c.qty}</span>
                                 <button onClick={() => setCart(cart.map(x => x.item.id === c.item.id ? {...x, qty: x.qty+1} : x))} className="w-6 h-6 bg-white border rounded-lg flex items-center justify-center font-black text-orange-600 shadow-sm">+</button>
                              </div>
                           </div>
                           <p className="text-[10px] font-bold text-orange-600">₹{c.item.price * c.qty}</p>
                        </div>
                      ))}
                      {tableSubtotal > 0 && cart.length === 0 && (
                        <div className="p-8 border-2 border-dashed border-slate-200 rounded-[2.5rem] text-center bg-blue-50/50">
                           <p className="text-[10px] font-black text-blue-900 uppercase">Existing Table Balance</p>
                           <p className="text-2xl font-black text-blue-900 mt-2">₹{tableSubtotal}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                     <div className="h-full flex flex-col items-center justify-center opacity-10 py-20 text-center gap-4">
                        <span className="text-7xl">🥘</span>
                        <p className="font-black uppercase tracking-widest text-[11px] text-slate-900">No items in check</p>
                     </div>
                  )}
               </div>

               <div className="border-t-2 border-slate-100 pt-8 space-y-6">
                  <div className="flex justify-between items-end px-1">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">NET PAYABLE</span>
                     <span className="text-5xl font-black text-blue-900 tracking-tighter">
                       ₹{(tableSubtotal + cart.reduce((s, c) => s + (c.item.price * c.qty), 0)).toFixed(0)}
                     </span>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      disabled={!selectedTable || cart.length === 0} 
                      onClick={handleGenerateKOT} 
                      className="flex-1 bg-blue-900 text-white py-5 rounded-[1.8rem] font-black uppercase text-xs shadow-xl disabled:opacity-20 hover:bg-black transition-all transform active:scale-95"
                    >
                      SEND KOT 🚀
                    </button>
                    {selectedTable?.status === 'OCCUPIED' && (
                      <button onClick={() => setShowSettlement(true)} className="bg-orange-600 text-white px-8 py-5 rounded-[1.8rem] font-black uppercase text-xs shadow-xl hover:bg-black transition-all">BILL</button>
                    )}
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* --- MENU MANAGEMENT TAB --- */}
        {activeTab === 'MENU' && (
           <div className="h-full bg-slate-50 flex flex-col p-8 overflow-hidden animate-in fade-in">
              <div className="flex justify-between items-center bg-white p-8 rounded-[3rem] border shadow-sm shrink-0 mb-8">
                 <div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter text-blue-900">Exhaustive Price List</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Full Menu Management for {selectedOutlet?.name}</p>
                 </div>
                 <button onClick={() => setEditingMenuItem({ name: '', price: 0, category: CATEGORIES[0], dietaryType: 'VEG' })} className="bg-orange-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-black transition-all">+ Add Menu Item</button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
                    {menu.filter(m => m.outletId === selectedOutlet?.id).map(item => (
                       <div key={item.id} className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-8 flex flex-col justify-between hover:border-blue-900 transition-all shadow-sm">
                          <div>
                             <div className="flex justify-between items-start mb-4">
                                <span className={`w-3 h-3 rounded-full ${item.dietaryType === 'VEG' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                <span className="text-[12px] font-black text-orange-600">₹{item.price}</span>
                             </div>
                             <h4 className="text-lg font-black text-slate-900 uppercase leading-tight">{item.name}</h4>
                             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2">{item.category}</p>
                          </div>
                          <div className="mt-8 pt-6 border-t flex gap-4">
                             <button onClick={() => setEditingMenuItem(item)} className="flex-1 bg-slate-100 text-slate-600 py-2.5 rounded-xl font-black text-[9px] uppercase hover:bg-blue-900 hover:text-white transition-all">Edit Rate/Detail</button>
                             <button onClick={async () => { if(confirm('Permanently remove this item?')) { await db.menuItems.delete(item.id); refreshData(); }}} className="px-4 text-red-300 hover:text-red-500 transition-colors">×</button>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        )}

        {/* --- TABLES MANAGEMENT TAB --- */}
        {activeTab === 'TABLES' && (
           <div className="h-full bg-slate-50 flex flex-col p-8 overflow-hidden animate-in fade-in">
              <div className="flex justify-between items-center bg-white p-8 rounded-[3rem] border shadow-sm shrink-0 mb-8">
                 <div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter text-blue-900">Floor Plan Layout</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Configure service tables for {selectedOutlet?.name}</p>
                 </div>
                 <button onClick={() => setEditingTable({ number: '', status: 'VACANT' })} className="bg-orange-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-black transition-all">+ Register New Table</button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                 <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-6 pb-20">
                    {filteredTables.map(t => (
                       <div key={t.id} className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-8 flex flex-col items-center justify-center gap-4 hover:border-blue-900 transition-all shadow-sm group relative">
                          <span className="text-3xl font-black text-slate-900 tracking-tighter uppercase">{t.number}</span>
                          <div className="flex gap-2">
                             <button onClick={() => setEditingTable(t)} className="text-[9px] font-black text-blue-500 uppercase underline">Edit</button>
                             <button onClick={async () => { if(confirm('Delete?')) { await db.diningTables.delete(t.id); refreshData(); }}} className="text-[9px] font-black text-red-400 uppercase underline">Remove</button>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        )}

        {/* --- OUTLETS MANAGEMENT TAB --- */}
        {activeTab === 'OUTLETS' && (
           <div className="h-full bg-slate-50 flex flex-col p-8 overflow-hidden animate-in fade-in">
              <div className="flex justify-between items-center bg-white p-8 rounded-[3rem] border shadow-sm shrink-0 mb-8">
                 <div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter text-blue-900">Multi-Venue Registry</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Configure independent dining outlets (Restaurants, Cafes, Bars)</p>
                 </div>
                 <button onClick={() => setEditingOutlet({ name: '', type: 'FineDine' })} className="bg-orange-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-black transition-all">+ Add Restaurant Outlet</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 overflow-y-auto custom-scrollbar pb-20">
                 {outlets.map(o => (
                    <div key={o.id} className="bg-white border-4 border-slate-50 rounded-[3rem] p-10 flex flex-col justify-between hover:border-blue-900 transition-all shadow-xl group">
                       <div>
                          <div className="w-20 h-20 bg-blue-50 rounded-[2rem] flex items-center justify-center text-4xl mb-6 shadow-inner border border-blue-100 group-hover:scale-110 transition-transform">🏘️</div>
                          <h3 className="text-2xl font-black text-blue-900 uppercase tracking-tighter leading-none">{o.name}</h3>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-3">{o.type}</p>
                       </div>
                       <div className="mt-10 pt-6 border-t border-slate-50 flex justify-between items-center">
                          <button onClick={() => setEditingOutlet(o)} className="text-[10px] font-black text-blue-600 uppercase underline">Configure Settings</button>
                          <button onClick={async () => { if(confirm('Delete?')) { await db.restaurants.delete(o.id); refreshData(); }}} className="text-[10px] font-black text-red-300 hover:text-red-500 transition-colors uppercase underline">Delete</button>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        )}

        {/* --- KITCHEN TAB --- */}
        {activeTab === 'KITCHEN' && (
           <div className="h-full p-8 overflow-y-auto custom-scrollbar flex flex-col gap-8 bg-slate-50">
              <div className="flex justify-between items-center bg-white p-8 rounded-[3rem] border shadow-sm">
                 <h3 className="text-3xl font-black uppercase tracking-tighter text-blue-900">KDS: Live Production Stream</h3>
                 <button onClick={() => setSoundEnabled(!soundEnabled)} className={`px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest border-2 transition-all ${soundEnabled ? 'bg-orange-50 border-orange-500 text-orange-600' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                    {soundEnabled ? '🔔 AUDIO ON' : '🔕 AUDIO MUTED'}
                 </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
                 {allKots.filter(k => k.status !== 'SERVED').map(kot => (
                    <div key={kot.id} className={`bg-white border-4 rounded-[3.5rem] overflow-hidden flex flex-col transition-all shadow-lg ${kot.status === 'PENDING' ? 'border-orange-500 animate-pulse' : 'border-blue-900'}`}>
                       <div className={`p-6 text-white flex justify-between items-center ${kot.status === 'PENDING' ? 'bg-orange-600' : 'bg-blue-900'}`}>
                          <h4 className="text-2xl font-black tracking-tighter uppercase">{kot.tableId.includes('ROOM-') ? kot.tableId.replace('ROOM-', 'RM ') : `${tables.find(t => t.id === kot.tableId)?.number || '?'}`}</h4>
                          <span className="text-[8px] font-black opacity-60 uppercase">{new Date(kot.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                       </div>
                       <div className="p-8 flex-1 space-y-4">
                          {kot.items.map((it, idx) => (
                             <div key={idx} className="flex justify-between border-b pb-2">
                                <span className="text-[11px] font-black text-slate-800 uppercase leading-tight">{menu.find(m => m.id === it.menuItemId)?.name || 'Product'}</span>
                                <span className="text-orange-600 font-black">x{it.quantity}</span>
                             </div>
                          ))}
                       </div>
                       <div className="p-6 pt-0">
                          <button 
                            onClick={async () => {
                              const nextStatus = kot.status === 'PENDING' ? 'PREPARING' : 'SERVED';
                              await db.kots.update(kot.id, { status: nextStatus });
                              refreshData();
                            }} 
                            className="w-full bg-blue-900 text-white py-4 rounded-2xl font-black uppercase text-[10px] shadow-md"
                          >
                             {kot.status === 'PENDING' ? 'START PRODUCTION' : 'MARK SERVED'}
                          </button>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        )}

        {activeTab === 'QR' && (
           <div className="h-full bg-white flex items-center justify-center p-20 text-center opacity-20">
              <div className="space-y-4">
                 <span className="text-8xl">🤳</span>
                 <p className="text-3xl font-black uppercase tracking-[0.4em]">QR Generation Logic: Standby</p>
              </div>
           </div>
        )}
      </div>

      {/* --- EDIT MODALS --- */}
      {editingMenuItem && (
        <ManagementModal title={editingMenuItem.id ? 'Modify Menu Item' : 'New Menu Protocol'} onClose={() => setEditingMenuItem(null)}>
           <div className="space-y-6">
              <ManageInp label="Item Name / Product" value={editingMenuItem.name || ''} onChange={v => setEditingMenuItem({...editingMenuItem, name: v})} />
              <div className="grid grid-cols-2 gap-4">
                 <ManageInp label="Plate Price (₹)" type="number" value={editingMenuItem.price?.toString() || ''} onChange={v => setEditingMenuItem({...editingMenuItem, price: parseFloat(v) || 0})} />
                 <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Dietary</label>
                    <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 outline-none" value={editingMenuItem.dietaryType} onChange={e => setEditingMenuItem({...editingMenuItem, dietaryType: e.target.value as any})}>
                       <option value="VEG">🟢 VEG</option>
                       <option value="NON-VEG">🔴 NON-VEG</option>
                       <option value="EGG">🟡 EGG</option>
                    </select>
                 </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Assign Category</label>
                <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 outline-none" value={editingMenuItem.category} onChange={e => setEditingMenuItem({...editingMenuItem, category: e.target.value})}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button onClick={handleSaveMenuItem} className="w-full bg-orange-600 text-white py-6 rounded-[2rem] font-black uppercase text-xs shadow-xl">Commit Menu Item ✅</button>
           </div>
        </ManagementModal>
      )}

      {editingTable && (
        <ManagementModal title={editingTable.id ? 'Modify Table' : 'New Table Protocol'} onClose={() => setEditingTable(null)}>
           <div className="space-y-6">
              <ManageInp label="Table Reference (e.g. T1, R10)" value={editingTable.number || ''} onChange={v => setEditingTable({...editingTable, number: v})} />
              <button onClick={handleSaveTable} className="w-full bg-orange-600 text-white py-6 rounded-[2rem] font-black uppercase text-xs shadow-xl">Commit Table Registry ✅</button>
           </div>
        </ManagementModal>
      )}

      {editingOutlet && (
        <ManagementModal title={editingOutlet.id ? 'Modify Outlet' : 'New Outlet Protocol'} onClose={() => setEditingOutlet(null)}>
           <div className="space-y-6">
              <ManageInp label="Outlet Name (e.g. Rooftop Bar)" value={editingOutlet.name || ''} onChange={v => setEditingOutlet({...editingOutlet, name: v})} />
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Service Type</label>
                <select className="w-full border-2 p-4 rounded-2xl font-black text-xs bg-slate-50 outline-none" value={editingOutlet.type} onChange={e => setEditingOutlet({...editingOutlet, type: e.target.value})}>
                    <option value="FineDine">Premium Restaurant</option>
                    <option value="Cafe">Casual Cafe</option>
                    <option value="Bar">Liquor Bar</option>
                    <option value="RoomService">In-Room Dining Node</option>
                </select>
              </div>
              <button onClick={handleSaveOutlet} className="w-full bg-orange-600 text-white py-6 rounded-[2rem] font-black uppercase text-xs shadow-xl">Commit Outlet ✅</button>
           </div>
        </ManagementModal>
      )}

    </div>
  );
};

const TabBtn = ({ active, label, onClick }: any) => (
  <button onClick={onClick} className={`px-8 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all shrink-0 ${active ? 'bg-orange-600 text-white shadow-xl scale-105' : 'text-slate-400 hover:text-blue-900'}`}>{label}</button>
);

const CatBtn = ({ active, label, onClick }: any) => (
  <button onClick={onClick} className={`px-6 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest border-2 transition-all shrink-0 whitespace-nowrap ${active ? 'bg-blue-900 border-blue-900 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-blue-900'}`}>{label}</button>
);

const ManagementModal = ({ title, children, onClose }: any) => (
  <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
     <div className="bg-white w-full max-w-md rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300 border-4 border-blue-900">
        <div className="bg-blue-900 p-8 text-white flex justify-between items-center">
           <h3 className="text-xl font-black uppercase tracking-tighter leading-none">{title}</h3>
           <button onClick={onClose} className="text-[10px] font-black uppercase opacity-60">Cancel</button>
        </div>
        <div className="p-10">{children}</div>
     </div>
  </div>
);

const ManageInp = ({ label, value, onChange, type = "text" }: any) => (
  <div className="space-y-1.5 w-full text-left">
    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">{label}</label>
    <input type={type} className="w-full border-2 p-4 rounded-2xl font-black text-[12px] bg-slate-50 outline-none focus:bg-white focus:border-orange-500 transition-all text-black shadow-inner" value={value || ''} onChange={e => onChange(e.target.value)} />
  </div>
);

export default DiningModule;
