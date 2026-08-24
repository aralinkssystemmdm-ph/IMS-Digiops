import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { syncSchoolMonitoringWithDRs } from './monitoringSync';
import { 
  ArrowLeft, 
  ArrowRight,
  Save, 
  Trash2, 
  Plus, 
  FileText, 
  User, 
  Building2, 
  Tag, 
  Briefcase, 
  Calendar, 
  Settings, 
  Check, 
  ChevronDown, 
  AlertCircle, 
  Eye, 
  Info, 
  Fingerprint, 
  Printer, 
  CheckCircle2, 
  PenTool, 
  Sparkles, 
  X,
  FileCheck,
  ListPlus,
  Compass,
  Upload,
  Image as ImageIcon
} from 'lucide-react';
import { useNotification } from './NotificationProvider';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Local storage key
const STORAGE_KEY = 'aralinks_delivery_receipts';

interface DRHardwareItem {
  id: string;
  qty: number;
  unit: string;
  description: string;
  specifications: string;
  remarks: string;
  item_code?: string;
}

interface DRServiceItem {
  id: string;
  qty: number;
  unit: string;
  serviceDetails: string;
}

interface DRSignatory {
  name: string;
  date: string;
  signatureImage?: string; // Data URL
  type: 'drawn' | 'typed' | 'uploaded' | 'pending';
}

interface DeliveryReceiptData {
  id: string; // DR number
  date: string;
  deliveredTo: string;
  clientCode: string;
  address: string;
  agent: string;
  contactPerson: string;
  contactNo: string;
  project: string;
  moa: string;
  status: 'Ready for delivery' | 'In Transit' | 'Delivered';
  inTransitDate?: string;
  deliveredDate?: string;
  hardwareItems: DRHardwareItem[];
  serviceItems: DRServiceItem[];
  signatoryPrepared: DRSignatory;
  signatoryApproved: DRSignatory;
  signatoryDelivered: DRSignatory;
  signatoryCheckedReceived: DRSignatory;
  remarks?: string;
}

// Prefilled seed pools
const MOCK_SCHOOLS = [
  { name: 'ST. LOUIS SCHOOL (CENTER), INC.', customer_code: 'C00000231(GS)', location: 'ASSUMPTION ROAD, 2600 BAGUIO CITY, BEN', sales_team: 'Team Gina', moa: 'S.Y. 2023 TO S.Y. 2024 TO S.Y. 2025-26' },
  { name: 'Ateneo de Manila University', customer_code: 'ATC-2201_ADMU', location: 'Katipunan Ave, Quezon City', sales_team: 'John Doe', moa: 'S.Y. 2025 TO S.Y. 2026-27' },
  { name: 'De La Salle University', customer_code: 'DLC-3401_DLSU', location: 'Taft Ave, Manila', sales_team: 'Jane Smith', moa: 'S.Y. 2024 TO S.Y. 2025-26' },
  { name: 'University of Santo Tomas', customer_code: 'UST-5109_UST', location: 'España Blvd, Sampaloc, Manila', sales_team: 'Robert Johnson', moa: 'S.Y. 2024 TO S.Y. 2026-27' },
  { name: 'Far Eastern University', customer_code: 'FEU-4202_FEU', location: 'Nicanor Reyes St, Sampaloc, Manila', sales_team: 'John Doe', moa: 'S.Y. 2025-2026' },
  { name: 'Mapua University', customer_code: 'MAP-1105_MAP', location: 'Muralla St, Intramuros, Manila', sales_team: 'Michael Garibaldi', moa: 'S.Y. 2026-2027' }
];

const MOCK_HARDWARE_CATALOG = [
  { code: 'INVD0000336', name: 'LAPTOP-Acer A15-51M-56E2 Steel Gray', spec: 'NXKS7SP00141509F333400', unit: 'unit' },
  { code: 'EQ-CHG-ACER', name: 'ACER LAPTOP CHARGER (THIN PIN)', spec: 'Standard 45W 4.0mm Pin', unit: 'pcs' },
  { code: 'EQ-TAB-A10', name: 'Aralinks Tablet Book Lite', spec: 'A10 Pro 10.4" Quadcore 4G/128G', unit: 'pcs' },
  { code: 'EQ-SIB-H75', name: 'Aralinks Smart Interactive Board 75"', spec: 'UHD 4K Quad Pen Dual OS Win11', unit: 'pcs' },
  { code: 'EQ-VR-G02', name: 'Aralinks VR Headset G2', spec: 'OpticX Virtual Reality Box with Controllers', unit: 'pcs' }
];

interface CreateDeliveryReceiptPageProps {
  isDarkMode?: boolean;
  userRole?: string | null;
}

export const CreateDeliveryReceiptPage: React.FC<CreateDeliveryReceiptPageProps> = ({ isDarkMode = false, userRole = 'Staff' }) => {
  const { drId } = useParams<{ drId?: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError, showInfo } = useNotification();

  useEffect(() => {
    if (userRole === 'Staff') {
      navigate('/delivery-receipt', { replace: true });
    }
  }, [userRole, navigate]);

  const isEditMode = !!drId;

  // Form Fields
  const [drNo, setDrNo] = useState('');
  const [dateOfAcceptance, setDateOfAcceptance] = useState('');
  const [deliveredTo, setDeliveredTo] = useState('');
  const [clientCode, setClientCode] = useState('');
  const [address, setAddress] = useState('');
  const [agent, setAgent] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactNo, setContactNo] = useState('');
  const [project, setProject] = useState('');
  const [moa, setMoa] = useState('');
  const [status, setStatus] = useState<DeliveryReceiptData['status']>('Ready for delivery');
  const [initialStatus, setInitialStatus] = useState<DeliveryReceiptData['status'] | null>(null);
  const [inTransitDate, setInTransitDate] = useState('');
  const [deliveredDate, setDeliveredDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [schoolMonitoringId, setSchoolMonitoringId] = useState('');

  // Items Tables states
  const [hardwareItems, setHardwareItems] = useState<DRHardwareItem[]>([]);
  const [serviceItems, setServiceItems] = useState<DRServiceItem[]>([]);

  // Signatories - Prepared by defaults to 'Bianca Aguinaldo', Approved by defaults to 'Jerald Dela Cruz'
  const [signatoryPrepared, setSignatoryPrepared] = useState<DRSignatory>({ name: 'Bianca Aguinaldo', date: '', type: 'typed' });
  const [signatoryApproved, setSignatoryApproved] = useState<DRSignatory>({ name: 'Jerald Dela Cruz', date: '', type: 'typed' });
  const [signatoryDelivered, setSignatoryDelivered] = useState<DRSignatory>({ name: '', date: '', type: 'typed' });
  const [signatoryCheckedReceived, setSignatoryCheckedReceived] = useState<DRSignatory>({ name: '', date: '', type: 'pending' });

  // 2-Step Workflow state: Step 1 (Data Entry & Items), Step 2 (Document Print Preview & Publish)
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Hidden File input refs for uploading e-signature images
  const preparedFileInputRef = useRef<HTMLInputElement | null>(null);
  const approvedFileInputRef = useRef<HTMLInputElement | null>(null);
  const deliveredFileInputRef = useRef<HTMLInputElement | null>(null);
  const checkedReceivedFileInputRef = useRef<HTMLInputElement | null>(null);

  // Autocomplete UI controllers
  const [schoolSearchQuery, setSchoolSearchQuery] = useState('');
  const [isSchoolDropdownOpen, setIsSchoolDropdownOpen] = useState(false);
  const [monitoringRecords, setMonitoringRecords] = useState<any[]>([]);

  useEffect(() => {
    const fetchMonitoring = async () => {
      let loaded: any[] = [];
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from('school_monitoring')
            .select('*')
            .order('school_name', { ascending: true });
          if (!error && data && data.length > 0) {
            loaded = data.map((row: any) => ({
              ...row,
              id: row.id,
              school_name: row.school_name,
              school_monitoring_id: row.school_monitoring_id || '',
              customer_code: row.customer_code,
              program: row.program,
              sales_team: row.sales_team,
              class_opening: row.class_opening,
              target_deployment_date: row.target_deployment_date,
              status: row.status,
              items: row.items || []
            }));
          }
        } catch (e) {
          console.error('Failed to fetch school_monitoring from Supabase', e);
        }
      }

      if (loaded.length === 0) {
        const raw = localStorage.getItem('aralinks_school_monitoring');
        if (raw) {
          try {
            loaded = JSON.parse(raw);
          } catch (e) {
            console.error('Failed to parse aralinks_school_monitoring', e);
          }
        }
      }
      
      if (!loaded || loaded.length === 0) {
        // Use fallback matching SchoolMonitoring.tsx mock
        loaded = [
          {
            id: 'mock-1',
            school_monitoring_id: 'SM-2026-001',
            customer_code: 'SCH-2026-001',
            school_name: 'St. Mary Polytechnic College',
            program: 'ACE',
            sales_team: 'Luzon Elite Sales Force',
            class_opening: '2026-06-15',
            target_deployment_date: '2026-06-08',
            status: 5,
            items: [
              { item_code: 'INVD0000336', item_name: 'Acer A15 Laptop Steel Gray', quantity: 15 },
              { item_code: 'INVD0000344', item_name: 'Acer Laptop Charger Thin Pin', quantity: 15 }
            ]
          },
          {
            id: 'mock-2',
            school_monitoring_id: 'SM-2026-042',
            customer_code: 'SCH-2026-042',
            school_name: 'Quezon Science High School',
            program: 'NGS',
            sales_team: 'NCR Academic Alliance',
            class_opening: '2026-07-20',
            target_deployment_date: '2026-07-10',
            status: 3,
            items: [
              { item_code: 'INVD0000410', item_name: 'Smart Interactive Board (SIB) 65"', quantity: 1 }
            ]
          }
        ];
      }
      setMonitoringRecords(loaded);
    };

    fetchMonitoring();
  }, []);

  const [hardwareSearchQueries, setHardwareSearchQueries] = useState<{ [rowId: string]: string }>({});
  const [hardwareDropdownOpens, setHardwareDropdownOpens] = useState<{ [rowId: string]: boolean }>({});

  // Signatory Scribbling Overlay state
  const [drawingSignatoryKey, setDrawingSignatoryKey] = useState<'prepared' | 'approved' | 'delivered' | 'checkedReceived' | null>(null);
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [typedSignName, setTypedSignName] = useState('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isScribbling, setIsScribbling] = useState(false);

  // Print Mode State
  const [isPrintPreviewActive, setIsPrintPreviewActive] = useState(false);

  // Bundle and equipment list states for dynamic bundle loading
  const [equipmentList, setEquipmentList] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [schoolsList, setSchoolsList] = useState<any[]>([]);
  const [bundleItemsCatalog, setBundleItemsCatalog] = useState<any[]>([]);
  const [availableBundles, setAvailableBundles] = useState<string[]>([]);
  const [isLoadingBundles, setIsLoadingBundles] = useState(false);
  const [isBundleDropdownOpen, setIsBundleDropdownOpen] = useState(false);
  const [selectedBundleDropdown, setSelectedBundleDropdown] = useState('');
  const [pendingBundle, setPendingBundle] = useState<string | null>(null);
  const [bundleQuantity, setBundleQuantity] = useState('1');
  const bundleDropdownRef = useRef<HTMLDivElement>(null);

  // Initialize Dates and DR info
  useEffect(() => {
    const today = new Date().toISOString().substring(0, 10);
    setDateOfAcceptance(today);
    setSignatoryPrepared(prev => ({ ...prev, name: prev.name || 'Bianca Aguinaldo', date: today }));
    setSignatoryApproved(prev => ({ ...prev, name: prev.name || 'Jerald Dela Cruz', date: today }));
    setSignatoryDelivered(prev => ({ ...prev, date: '' }));
    setSignatoryCheckedReceived(prev => ({ ...prev, name: '', date: '' }));

    // Generate random DR No in Create Mode
    if (!isEditMode) {
      const randNo = Math.floor(10000 + Math.random() * 90000);
      const randYearPart = today.substring(2, 4) + today.substring(5, 7);
      setDrNo(`00${randYearPart}-${randNo}`);
    }
  }, [isEditMode]);

  // Load existing DR record if edit mode
  useEffect(() => {
    const loadRecord = async () => {
      if (isEditMode && drId) {
        try {
          let found: any = null;

          if (isSupabaseConfigured) {
            try {
              const { data, error } = await supabase
                .from('delivery_receipts')
                .select('*')
                .eq('id', drId)
                .maybeSingle();
              if (!error && data) {
                found = {
                  id: data.id,
                  schoolName: data.school_name,
                  schoolMonitoringId: data.school_monitoring_id,
                  school_monitoring_id: data.school_monitoring_id,
                  clientCode: data.client_code,
                  agent: data.agent,
                  project: data.project,
                  date: data.date,
                  status: data.status,
                  inTransitDate: data.in_transit_date,
                  deliveredDate: data.delivered_date,
                  totalItems: data.total_items,
                  issuedBy: data.issued_by,
                  deliveredBy: data.delivered_by,
                  receivedBy: data.received_by,
                  remarks: data.remarks,
                  hardwareItems: typeof data.hardware_items === 'string' ? JSON.parse(data.hardware_items) : (data.hardware_items || []),
                  serviceItems: typeof data.service_items === 'string' ? JSON.parse(data.service_items) : (data.service_items || []),
                  signatoryPrepared: typeof data.signatory_prepared === 'string' ? JSON.parse(data.signatory_prepared) : data.signatory_prepared,
                  signatoryApproved: typeof data.signatory_approved === 'string' ? JSON.parse(data.signatory_approved) : data.signatory_approved,
                  signatoryDelivered: typeof data.signatory_delivered === 'string' ? JSON.parse(data.signatory_delivered) : data.signatory_delivered,
                  signatoryCheckedReceived: typeof data.signatory_checked_received === 'string' ? JSON.parse(data.signatory_checked_received) : data.signatory_checked_received,
                  address: data.address,
                  contactPerson: data.contact_person,
                  contactNo: data.contact_no,
                  moa: data.moa,
                  deliveryHistory: typeof data.delivery_history === 'string' ? JSON.parse(data.delivery_history) : (data.delivery_history || [])
                };
              }
            } catch (err) {
              console.warn('Failed to load edit details from Supabase:', err);
            }
          }

          if (!found) {
            const localData = localStorage.getItem(STORAGE_KEY);
            if (localData) {
              const receipts: any[] = JSON.parse(localData);
              found = receipts.find(r => r.id === drId || r.drNo === drId);
            }
          }

          if (found) {
            // Found existing receipt. Fill state
            setDrNo(found.id || found.drNo);
            setDateOfAcceptance(found.date);
            setDeliveredTo(found.schoolName || found.deliveredTo || '');
            setSchoolSearchQuery(found.schoolName || found.deliveredTo || '');
            setSchoolMonitoringId(found.school_monitoring_id || found.schoolMonitoringId || '');
            setClientCode(found.clientCode || '');
            setAddress(found.address || '');
            setAgent(found.agent || '');
            setContactPerson(found.contactPerson || '');
            setContactNo(found.contactNo || '');
            setProject(found.project || '');
            setMoa(found.moa || '');
            setStatus(found.status || 'Ready for delivery');
            setInitialStatus(found.status || 'Ready for delivery');
            setInTransitDate(found.inTransitDate || '');
            setDeliveredDate(found.deliveredDate || '');
            setRemarks(found.remarks || '');

            // Load items
            if (found.hardwareItems && found.hardwareItems.length > 0) {
              setHardwareItems(found.hardwareItems);
            } else if (found.items) {
              // Convert basic schema
              const convertedHardware = found.items.map((it: any, index: number) => ({
                id: it.id || `hw-${index}-${Date.now()}`,
                qty: it.qty,
                unit: it.uom || 'pcs',
                description: it.description,
                specifications: it.serialNumber || '',
                remarks: it.remarks || ''
              }));
              setHardwareItems(convertedHardware);
            } else {
              setHardwareItems([]);
            }

            // Load services
            if (found.serviceItems) {
              setServiceItems(found.serviceItems);
            } else {
              setServiceItems([]);
            }

            // Load signatories
            if (found.signatoryPrepared) setSignatoryPrepared(found.signatoryPrepared);
            if (found.signatoryApproved) setSignatoryApproved(found.signatoryApproved);
            if (found.signatoryDelivered) setSignatoryDelivered(found.signatoryDelivered);
            if (found.signatoryCheckedReceived) setSignatoryCheckedReceived(found.signatoryCheckedReceived);
          }
        } catch (e) {
          console.error('Error loading delivery receipt edit details', e);
        }
      } else {
        // Seed default items in CREATE MODE to replicate the template exactly!
        setHardwareItems([]);

        // Seed default service items to match the layout
        setServiceItems([
          {
            id: `srv-default-1`,
            qty: 1,
            unit: 'service',
            serviceDetails: 'Standard Configuration, Enrollment, and Domain Deployment of Student Units'
          }
        ]);
      }
    };

    loadRecord();
  }, [isEditMode, drId]);

  // Fetch equipment, actual inventory summary and schools list on mount
  useEffect(() => {
    const fetchEquipmentAndDbRecords = async () => {
      if (!isSupabaseConfigured) return;
      try {
        const { data, error } = await supabase
          .from('equipment')
          .select('item_code, description, is_serialized, uom, specifications, status')
          .is('archived_at', null)
          .order('description', { ascending: true });
        
        if (data) {
          const activeItems = (data as any[]).filter(item => {
            const s = (item.status || '').toUpperCase();
            return s === 'ACTIVE' || s === 'ENABLE' || s === 'AVAILABLE' || s === '';
          });
          setEquipmentList(activeItems);
        }

        // Fetch actual inventory summary, schools list, and bundle items concurrently
        const [invRes, schoolsRes, bundlesRes] = await Promise.all([
          supabase.from('view_inventory_summary').select('*'),
          supabase.from('schools').select('name, customer_code, location, sales_team, is_buffer').order('name'),
          supabase.from('bundle_items').select('bundle, item_code, description, program').is('archived_at', null)
        ]);
        
        if (invRes && invRes.data) {
          setInventoryItems(invRes.data);
        }
        if (schoolsRes && schoolsRes.data) {
          setSchoolsList(schoolsRes.data);
        }
        if (bundlesRes && bundlesRes.data) {
          setBundleItemsCatalog(bundlesRes.data);
        }
      } catch (err) {
        console.error('Error fetching database records:', err);
      }
    };
    fetchEquipmentAndDbRecords();
  }, []);

  // Fetch unique bundle names when project changes
  useEffect(() => {
    const fetchBundlesForProject = async () => {
      if (!project || !isSupabaseConfigured) {
        setAvailableBundles([]);
        return;
      }
      setIsLoadingBundles(true);
      try {
        const { data, error } = await supabase
          .from('bundle_items')
          .select('bundle, item_code')
          .eq('program', project)
          .is('archived_at', null);

        if (data) {
          const uniqueBundles = Array.from(new Set((data as any[]).map(item => String(item.bundle || ''))));
          setAvailableBundles(uniqueBundles.filter(Boolean).sort());
        }
      } catch (err) {
        console.error('Error fetching bundles for project:', err);
      } finally {
        setIsLoadingBundles(false);
      }
    };
    fetchBundlesForProject();
  }, [project]);

  // Click outside listener for bundle dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bundleDropdownRef.current && !bundleDropdownRef.current.contains(event.target as Node)) {
        setIsBundleDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle school suggestion selections
  const handleSelectSchool = (school: any) => {
    const schoolName = school.school_name || school.name || '';
    setDeliveredTo(schoolName);
    setSchoolSearchQuery(schoolName);
    const smId = school.school_monitoring_id || school.id || '';
    setSchoolMonitoringId(smId);
    setClientCode(school.customer_code || school.customerCode || '');
    setAddress(school.location || school.address || 'BAGUIO CITY, BEN');
    setAgent(school.sales_team || school.salesTeam || 'Team Gina');
    
    // Auto populate the project as program
    const programName = school.program || '';
    setProject(programName);

    if (school.moa) {
      setMoa(school.moa);
    } else {
      setMoa('S.Y. 2023 TO S.Y. 2024 TO S.Y. 2025-26');
    }

    // Auto populate all hardware items from school monitoring
    if (school.items && school.items.length > 0) {
      const populatedHardware = school.items.map((it: any, index: number) => {
        const itemCode = it.item_code || '';
        const matched = MOCK_HARDWARE_CATALOG.find(c => c.code === itemCode);
        return {
          id: `hw-${itemCode}-${index}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          qty: it.quantity || it.qty || 1,
          unit: it.unit || it.uom || matched?.unit || 'pcs',
          description: it.item_name || it.description || '',
          specifications: it.specifications || matched?.spec || '',
          remarks: it.remarks || '',
          item_code: itemCode
        };
      });
      setHardwareItems(populatedHardware);
      showInfo('Hardware Populated', `Loaded ${populatedHardware.length} items from ${schoolName}'s monitoring record.`);
    } else {
      setHardwareItems([]);
    }

    setIsSchoolDropdownOpen(false);
  };

  // Filtered Schools list based on School Monitoring database
  const filteredSchools = useMemo(() => {
    if (!schoolSearchQuery) return monitoringRecords;
    return monitoringRecords.filter(s => 
      (s.school_name || s.name || '').toLowerCase().includes(schoolSearchQuery.toLowerCase()) ||
      (s.customer_code || s.customerCode || '').toLowerCase().includes(schoolSearchQuery.toLowerCase())
    );
  }, [schoolSearchQuery, monitoringRecords]);

  const resolvedInventoryItems = useMemo(() => {
    if (inventoryItems && inventoryItems.length > 0) {
      return inventoryItems;
    }
    return MOCK_HARDWARE_CATALOG.map(item => ({
      item_code: item.code,
      item_name: item.name,
      total_quantity: 10,
      is_serialized: false
    }));
  }, [inventoryItems]);

  // Hardware items table management
  const addHardwareRow = () => {
    const newId = `hw-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setHardwareItems([
      ...hardwareItems,
      {
        id: newId,
        qty: 1,
        unit: 'pcs',
        description: '',
        specifications: '',
        remarks: ''
      }
    ]);
  };

  const addAceBundle = (bundleType: 'classroom' | 'sib') => {
    const timestamp = Date.now();
    let newItems: DRHardwareItem[] = [];

    if (bundleType === 'classroom') {
      newItems = [
        {
          id: `hw-bundle-tablet-${timestamp}-1`,
          qty: 50,
          unit: 'pcs',
          description: 'Aralinks Tablet Book Lite',
          specifications: 'A10 Pro 10.4" Quadcore 4G/128G',
          remarks: 'ACE Program Tablet Classroom Package'
        },
        {
          id: `hw-bundle-sib-${timestamp}-2`,
          qty: 1,
          unit: 'pcs',
          description: 'Aralinks Smart Interactive Board 75"',
          specifications: 'UHD 4K Quad Pen Dual OS Win11',
          remarks: 'ACE Program Tablet Classroom Package'
        }
      ];
      showSuccess('ACE Classroom Bundle Added', 'Added 50 Tablet Books + 1 Smart Interactive Board to hardware list.');
    } else {
      newItems = [
        {
          id: `hw-bundle-sib-only-${timestamp}-1`,
          qty: 1,
          unit: 'pcs',
          description: 'Aralinks Smart Interactive Board 75"',
          specifications: 'UHD 4K Quad Pen Dual OS Win11',
          remarks: 'ACE Interactive Board Package'
        }
      ];
      showSuccess('ACE SIB Bundle Added', 'Added 1 Smart Interactive Board to hardware list.');
    }

    setHardwareItems(prev => [...prev, ...newItems]);
  };

  const handleApplyBundle = (bundleName: string) => {
    if (!bundleName) return;
    setPendingBundle(bundleName);
    setBundleQuantity('1');
  };

  const confirmApplyBundle = async () => {
    if (!project || !isSupabaseConfigured || !pendingBundle) return;

    const multiplier = parseInt(bundleQuantity) || 1;

    try {
      const { data, error } = await supabase
        .from('bundle_items')
        .select('*')
        .eq('program', project)
        .eq('bundle', pendingBundle)
        .is('archived_at', null);

      if (error) throw error;
      
      if (data && data.length > 0) {
        const nextItems = [...hardwareItems];
        
        (data as any[]).forEach(bundleItem => {
          // Align UOM and specifications using equipmentList
          const equip = equipmentList.find(e => e.item_code === bundleItem.item_code);
          const bundleItemUom = equip && equip.uom ? equip.uom : 'pcs';
          const spec = equip && equip.specifications ? equip.specifications : '';
          
          let addQtyValue = (bundleItem.quantity || bundleItem.qty || 1) * multiplier;
          
          // Special formula for Brass Fastener: 1-10 = 1, 11-20 = 2, etc.
          if (bundleItem.description?.toUpperCase().includes('BRASS FASTENER')) {
            addQtyValue = Math.max(1, Math.ceil(multiplier / 10));
          }
          
          nextItems.push({
            id: `hw-bundle-item-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            qty: addQtyValue,
            unit: bundleItemUom,
            description: bundleItem.description || '',
            specifications: spec,
            remarks: `Bundle: ${pendingBundle}`,
            item_code: bundleItem.item_code
          });
        });
        
        setHardwareItems(nextItems);
        showSuccess('Bundle Applied', `Successfully added bundle "${pendingBundle}" (x${multiplier}) to hardware list.`);
      } else {
        showError('No Items Found', `Selected bundle "${pendingBundle}" does not have any items defined in the database.`);
      }
      setPendingBundle(null);
      setSelectedBundleDropdown('');
    } catch (err) {
      console.error('Error applying bundle:', err);
      showError('Error', 'Failed to load bundle items from database.');
    }
  };

  const removeHardwareRow = (id: string) => {
    setHardwareItems(hardwareItems.filter(item => item.id !== id));
  };

  const updateHardwareRow = (id: string, updates: Partial<DRHardwareItem>) => {
    setHardwareItems(
      hardwareItems.map(item => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  // Services table management
  const addServiceRow = () => {
    const newId = `srv-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setServiceItems([
      ...serviceItems,
      {
        id: newId,
        qty: 1,
        unit: 'job',
        serviceDetails: ''
      }
    ]);
  };

  const removeServiceRow = (id: string) => {
    setServiceItems(serviceItems.filter(item => item.id !== id));
  };

  const updateServiceRow = (id: string, updates: Partial<DRServiceItem>) => {
    setServiceItems(
      serviceItems.map(item => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  // Handle Autocomplete hardware catalog trigger
  const handleSelectHardwareItem = (rowId: string, hItem: any) => {
    const code = hItem.item_code || hItem.code;
    const nameStr = hItem.item_name || hItem.name;
    const resolvedUnit = hItem.unit || 'pcs';
    const resolvedSpecifications = hItem.spec || '';

    updateHardwareRow(rowId, {
      description: nameStr,
      unit: resolvedUnit,
      specifications: resolvedSpecifications,
      item_code: code
    });
    
    // Clear searches
    setHardwareSearchQueries(prev => ({ ...prev, [rowId]: nameStr }));
    setHardwareDropdownOpens(prev => ({ ...prev, [rowId]: false }));
  };

  // Canvas drawing signatories controllers
  const openSignatureModal = (key: 'prepared' | 'approved' | 'delivered' | 'checkedReceived') => {
    setDrawingSignatoryKey(key);
    let currentSignatory: DRSignatory;
    if (key === 'prepared') currentSignatory = signatoryPrepared;
    else if (key === 'approved') currentSignatory = signatoryApproved;
    else if (key === 'delivered') currentSignatory = signatoryDelivered;
    else currentSignatory = signatoryCheckedReceived;

    setTypedSignName(currentSignatory.name);
    setIsSignModalOpen(true);

    // Give time for layout rendering and establish strokes
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.strokeStyle = '#ea580c'; // Brand orange accent
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
        }
      }
    }, 150);
  };

  // Core Drawing logic
  const startScribble = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsScribbling(true);
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const drawScribbling = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isScribbling) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  // Close signature and draw
  const stopScribbling = () => {
    setIsScribbling(false);
  };

  const clearSignatureCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSignatureFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    targetKey: 'prepared' | 'approved' | 'delivered' | 'checkedReceived'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showError('Invalid File Type', 'Please upload a valid image file (PNG, JPG, WebP, SVG).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showError('File Too Large', 'Signature image size must be under 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        const today = new Date().toISOString().substring(0, 10);
        const updateSig = (prev: DRSignatory): DRSignatory => ({
          ...prev,
          signatureImage: dataUrl,
          type: 'uploaded',
          date: prev.date || today
        });

        if (targetKey === 'prepared') setSignatoryPrepared(updateSig);
        else if (targetKey === 'approved') setSignatoryApproved(updateSig);
        else if (targetKey === 'delivered') setSignatoryDelivered(updateSig);
        else if (targetKey === 'checkedReceived') setSignatoryCheckedReceived(updateSig);

        showSuccess('E-Signature Uploaded', 'Electronic signature image uploaded successfully.');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleProceedToStep2 = () => {
    if (!deliveredTo.trim()) {
      showError('Validation Failed', 'Please search and select or input a School Client name before proceeding to print preview.');
      return;
    }

    if (hardwareItems.length === 0) {
      showError('Validation Failed', 'Please input at least one Hardware Item before proceeding to print preview.');
      return;
    }

    // Validate Section 2: Hardware Delivered Items - Ensure stock availability and item catalog existence
    for (let i = 0; i < hardwareItems.length; i++) {
      const item = hardwareItems[i];
      const desc = (item.description || '').trim();
      if (!desc) {
        showError('Validation Failed', `Section 2 Hardware Item #${i + 1} has no item description. Please select an item or remove the empty row.`);
        return;
      }

      const itemCode = item.item_code || (() => {
        const matched = resolvedInventoryItems.find(it => 
          (it.item_name || '').toLowerCase() === desc.toLowerCase() ||
          (it.item_code || '').toLowerCase() === desc.toLowerCase()
        );
        return matched?.item_code;
      })();

      const invItem = itemCode 
        ? resolvedInventoryItems.find(it => it.item_code === itemCode) 
        : resolvedInventoryItems.find(it => (it.item_name || '').toLowerCase() === desc.toLowerCase());

      if (!invItem) {
        showError(
          'Item Not Found in Inventory',
          `Cannot proceed to Print Preview: Hardware Item #${i + 1} "${desc}" was not found in the inventory catalog.`
        );
        return;
      }

      const availableStock = Number(invItem.total_quantity || 0);
      const requestedQty = Number(item.qty || 0);

      if (requestedQty <= 0) {
        showError(
          'Invalid Quantity',
          `Cannot proceed to Print Preview: Hardware Item #${i + 1} "${desc}" must have a quantity of at least 1.`
        );
        return;
      }

      if (availableStock < requestedQty) {
        showError(
          'Insufficient Stock',
          `Cannot proceed to Print Preview: Hardware Item #${i + 1} "${desc}" has insufficient stock! Available: ${availableStock}, Requested: ${requestedQty}.`
        );
        return;
      }
    }

    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Helper to determine the bundle group type for pagination
  const getItemBundleGroup = (item: DRHardwareItem): 'ARDUINO' | 'RASPBERRY' | 'COMBINED_STEM' | 'GENERAL' => {
    const textToMatch = `${item.remarks || ''} ${item.description || ''} ${item.specifications || ''}`.toUpperCase();

    // 1. Check for specific Bundle markers
    if (textToMatch.includes('ARDUINO')) return 'ARDUINO';
    if (textToMatch.includes('RASPBERRY')) return 'RASPBERRY';
    if (
      textToMatch.includes('LITTLE BITS') ||
      textToMatch.includes('LITTLEBITS') ||
      textToMatch.includes('MICRO:BIT') ||
      textToMatch.includes('MICROBIT') ||
      textToMatch.includes('MICRO BIT') ||
      textToMatch.includes('MAKEY-MAKEY') ||
      textToMatch.includes('MAKEY MAKEY') ||
      textToMatch.includes('MAKEY') ||
      textToMatch.includes('AF TOOLS') ||
      textToMatch.includes('AF TOOL')
    ) {
      return 'COMBINED_STEM';
    }

    // 2. Lookup against loaded bundle_items catalog from database
    if (bundleItemsCatalog && bundleItemsCatalog.length > 0) {
      const match = bundleItemsCatalog.find((b: any) => {
        if (item.item_code && b.item_code && String(b.item_code).trim().toLowerCase() === String(item.item_code).trim().toLowerCase()) {
          return true;
        }
        if (item.description && b.description && String(b.description).trim().toLowerCase() === String(item.description).trim().toLowerCase()) {
          return true;
        }
        return false;
      });

      if (match && match.bundle) {
        const bName = String(match.bundle).toUpperCase();
        if (bName.includes('ARDUINO')) return 'ARDUINO';
        if (bName.includes('RASPBERRY')) return 'RASPBERRY';
        if (
          bName.includes('LITTLE BITS') ||
          bName.includes('LITTLEBITS') ||
          bName.includes('MICRO:BIT') ||
          bName.includes('MICROBIT') ||
          bName.includes('MICRO BIT') ||
          bName.includes('MAKEY') ||
          bName.includes('AF TOOLS') ||
          bName.includes('AF TOOL')
        ) {
          return 'COMBINED_STEM';
        }
      }
    }

    return 'GENERAL';
  };

  // Group hardware items into paginated sheets based on bundle rules
  const printPages = useMemo(() => {
    if (hardwareItems.length === 0) return [];

    const generalList: DRHardwareItem[] = [];
    const arduinoList: DRHardwareItem[] = [];
    const raspberryList: DRHardwareItem[] = [];
    const combinedStemList: DRHardwareItem[] = [];

    hardwareItems.forEach((item) => {
      const g = getItemBundleGroup(item);
      if (g === 'ARDUINO') arduinoList.push(item);
      else if (g === 'RASPBERRY') raspberryList.push(item);
      else if (g === 'COMBINED_STEM') combinedStemList.push(item);
      else generalList.push(item);
    });

    const pages: { id: string; categoryTitle: string; pageLabel: string; items: DRHardwareItem[] }[] = [];

    // General / non-STEM bundle items page (e.g. Tablets, Interactive Boards, Chargers)
    if (generalList.length > 0) {
      pages.push({
        id: 'general',
        categoryTitle: 'Hardware',
        pageLabel: 'General Equipment',
        items: generalList
      });
    }

    // Separate page for ARDUINO
    if (arduinoList.length > 0) {
      pages.push({
        id: 'arduino',
        categoryTitle: 'Hardware — ARDUINO',
        pageLabel: 'ARDUINO Bundle',
        items: arduinoList
      });
    }

    // Separate page for RASPBERRY
    if (raspberryList.length > 0) {
      pages.push({
        id: 'raspberry',
        categoryTitle: 'Hardware — RASPBERRY',
        pageLabel: 'RASPBERRY Bundle',
        items: raspberryList
      });
    }

    // Same page for bundles LITTLE BITS, MICRO:BIT, MAKEY-MAKEY & AF TOOLS
    if (combinedStemList.length > 0) {
      pages.push({
        id: 'combined_stem',
        categoryTitle: 'Hardware — LITTLE BITS, MICRO:BIT, MAKEY-MAKEY & AF TOOLS',
        pageLabel: 'STEM Toolkits (Little Bits, Micro:bit, Makey-Makey, AF Tools)',
        items: combinedStemList
      });
    }

    // Fallback if none of above
    if (pages.length === 0) {
      pages.push({
        id: 'fallback',
        categoryTitle: 'Hardware',
        pageLabel: 'Hardware Items',
        items: hardwareItems
      });
    }

    return pages;
  }, [hardwareItems, bundleItemsCatalog]);

  const saveSignatureDetails = (method: 'drawn' | 'typed') => {
    if (!drawingSignatoryKey) return;
    let dataUrlImage: string | undefined = undefined;

    if (method === 'drawn') {
      const canvas = canvasRef.current;
      if (canvas) {
        dataUrlImage = canvas.toDataURL('image/png');
      }
    }

    const sigUpdate: DRSignatory = {
      name: typedSignName,
      date: new Date().toISOString().substring(0, 10),
      signatureImage: dataUrlImage,
      type: method
    };

    if (drawingSignatoryKey === 'prepared') setSignatoryPrepared(sigUpdate);
    else if (drawingSignatoryKey === 'approved') setSignatoryApproved(sigUpdate);
    else if (drawingSignatoryKey === 'delivered') setSignatoryDelivered(sigUpdate);
    else if (drawingSignatoryKey === 'checkedReceived') setSignatoryCheckedReceived(sigUpdate);

    setIsSignModalOpen(false);
    setDrawingSignatoryKey(null);
    showSuccess('Signature Captured', 'The document has been digitally certified successfully.');
  };

  // Submit and save handler
  const handleSaveDeliveryReceipt = async () => {
    if (!deliveredTo.trim()) {
      showError('Validation Failed', 'Please search and select or input a School Client name.');
      return;
    }

    if (hardwareItems.length === 0) {
      showError('Validation Failed', 'Please input at least one Hardware Item.');
      return;
    }

    try {
      // Validate stock levels before proceeding (especially if status is 'In Transit' or 'Delivered')
      if (status === 'In Transit' || status === 'Delivered') {
        for (const item of hardwareItems) {
          let itemCode = item.item_code;
          if (!itemCode) {
            const matched = resolvedInventoryItems.find(it => 
              (it.item_name || '').toLowerCase() === (item.description || '').toLowerCase()
            );
            if (matched) {
              itemCode = matched.item_code;
            }
          }

          if (itemCode) {
            const invItem = resolvedInventoryItems.find(it => it.item_code === itemCode);
            const availableStock = invItem ? Number(invItem.total_quantity || 0) : 0;
            if (availableStock < Number(item.qty || 0)) {
              showError(
                'Insufficient Stock Trigger',
                `Cannot save as "${status}" because item "${item.description}" has insufficient stock! Available: ${availableStock}, Requested: ${item.qty}`
              );
              return;
            }
          } else {
            showError(
              'Item Unmapped Trigger',
              `Cannot proceed with "${status}" because "${item.description || 'Unknown Item'}" is not found in the active inventory catalog.`
            );
            return;
          }
        }
      }

      const computedTotalItems = hardwareItems.reduce((sum, item) => sum + Number(item.qty || 0), 0);

      // Map back to global management schema so that listings automatically integrate
      const newDRRecord = {
        id: drNo,
        schoolName: deliveredTo,
        schoolMonitoringId: schoolMonitoringId,
        school_monitoring_id: schoolMonitoringId,
        clientCode: clientCode || 'CL-GEN-999',
        agent: agent || 'Direct Store',
        project: project || 'ACE',
        date: dateOfAcceptance,
        status: status,
        inTransitDate: status === 'In Transit' || status === 'Delivered' ? inTransitDate : undefined,
        deliveredDate: status === 'Delivered' ? deliveredDate : undefined,
        totalItems: computedTotalItems,
        issuedBy: signatoryPrepared.name || '',
        deliveredBy: signatoryDelivered.name || '',
        receivedBy: signatoryCheckedReceived.name || '',
        remarks: remarks || '',
        // Full local metadata
        hardwareItems,
        serviceItems,
        signatoryPrepared,
        signatoryApproved,
        signatoryDelivered,
        signatoryCheckedReceived,
        address,
        contactPerson,
        contactNo,
        moa
      };

      // Always update localStorage
      const dbStr = localStorage.getItem(STORAGE_KEY) || '[]';
      const existingReceipts: any[] = JSON.parse(dbStr);
      let updatedList: any[] = [];
      if (isEditMode) {
        updatedList = existingReceipts.map(r => (r.id === drNo || r.drNo === drNo) ? newDRRecord : r);
      } else {
        updatedList = [newDRRecord, ...existingReceipts];
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));

      // Try saving to Supabase if configured
      if (isSupabaseConfigured) {
        try {
          const dbPayload = {
            id: drNo,
            school_name: deliveredTo,
            school_monitoring_id: schoolMonitoringId,
            client_code: clientCode || 'CL-GEN-999',
            agent: agent || 'Direct Store',
            project: project || 'ACE',
            date: dateOfAcceptance,
            status: status,
            in_transit_date: status === 'In Transit' || status === 'Delivered' ? inTransitDate : null,
            delivered_date: status === 'Delivered' ? deliveredDate : null,
            total_items: computedTotalItems,
            issued_by: signatoryPrepared.name || '',
            delivered_by: signatoryDelivered.name || '',
            received_by: signatoryCheckedReceived.name || '',
            remarks: remarks || '',
            hardware_items: hardwareItems,
            service_items: serviceItems,
            signatory_prepared: signatoryPrepared,
            signatory_approved: signatoryApproved,
            signatory_delivered: signatoryDelivered,
            signatory_checked_received: signatoryCheckedReceived,
            address: address || '',
            contact_person: contactPerson || '',
            contact_no: contactNo || '',
            moa: moa || '',
            updated_at: new Date().toISOString()
          };

          const { error } = await supabase
            .from('delivery_receipts')
            .upsert(dbPayload, { onConflict: 'id' });

          if (error) throw error;

          // Once status is 'In Transit' or 'Delivered' (and transitioning from a non-transit status),
          // deduct stock from item_location_stocks and log to stock_transactions
          const isTransitioningToTransit = 
            (status === 'In Transit' || status === 'Delivered') && 
            (initialStatus !== 'In Transit' && initialStatus !== 'Delivered');

          if (isTransitioningToTransit) {
            const currentUser = localStorage.getItem('aralinks_user') || 'System';

            for (const item of hardwareItems) {
              let itemCode = item.item_code;
              let itemName = item.description;

              if (!itemCode) {
                const matched = resolvedInventoryItems.find(it => 
                  (it.item_name || '').toLowerCase() === (item.description || '').toLowerCase()
                );
                if (matched) {
                  itemCode = matched.item_code;
                  itemName = matched.item_name;
                }
              }

              if (!itemCode) continue;

              let qtyToDeduct = Number(item.qty || 0);
              if (qtyToDeduct <= 0) continue;

              // Fetch location stocks to deduct from
              const { data: stockRecords, error: fetchErr } = await supabase
                .from('item_location_stocks')
                .select('id, location, quantity')
                .eq('item_code', itemCode)
                .order('quantity', { ascending: false });

              if (fetchErr) throw fetchErr;

              let deductedLocations: Array<{ location: string, qty: number }> = [];

              if (stockRecords && stockRecords.length > 0) {
                for (const record of stockRecords) {
                  if (qtyToDeduct <= 0) break;

                  const availableRecordQty = Number(record.quantity || 0);
                  if (availableRecordQty <= 0) continue;

                  const toDeductNow = Math.min(availableRecordQty, qtyToDeduct);
                  const newRecordQty = availableRecordQty - toDeductNow;

                  const { error: updateErr } = await supabase
                    .from('item_location_stocks')
                    .update({ quantity: newRecordQty })
                    .eq('id', record.id);

                  if (updateErr) throw updateErr;

                  qtyToDeduct -= toDeductNow;
                  deductedLocations.push({ location: record.location, qty: toDeductNow });
                }
              }

              // Fallback if needed (though our UI validation prevents this)
              if (qtyToDeduct > 0) {
                const fallbackLoc = stockRecords?.[0]?.location || 'Main Depot';
                const fallbackRecord = stockRecords?.[0];

                if (fallbackRecord) {
                  const { error: updateErr } = await supabase
                    .from('item_location_stocks')
                    .update({ quantity: Number(fallbackRecord.quantity || 0) - qtyToDeduct })
                    .eq('id', fallbackRecord.id);
                  if (updateErr) throw updateErr;
                } else {
                  const { error: insertErr } = await supabase
                    .from('item_location_stocks')
                    .insert([{
                      item_code: itemCode,
                      item_name: itemName,
                      location: fallbackLoc,
                      quantity: -qtyToDeduct
                    }]);
                  if (insertErr) throw insertErr;
                }
                deductedLocations.push({ location: fallbackLoc, qty: qtyToDeduct });
              }

              // Write transactions to stock_transactions for history log
              for (const dLoc of deductedLocations) {
                const { error: txError } = await supabase
                  .from('stock_transactions')
                  .insert([{
                    item_code: itemCode,
                    from_location: dLoc.location,
                    to_location: deliveredTo,
                    quantity: dLoc.qty,
                    transaction_type: 'Delivery',
                    reference_id: drNo,
                    created_by: currentUser,
                    reason: `Delivered to School: ${deliveredTo} via DR ${drNo}`
                  }]);

                if (txError) throw txError;
              }
            }
          }
        } catch (dbErr) {
          console.warn('Failed to persist to Supabase delivery_receipts table. Saved locally.', dbErr);
        }
      }

      if (isEditMode) {
        showSuccess('Receipt Modified', `Delivery Receipt ${drNo} of client ${deliveredTo} updated.`);
      } else {
        showSuccess('Receipt Submitted', `Delivery Receipt ${drNo} created successfully with ${computedTotalItems} logs.`);
      }

      await syncSchoolMonitoringWithDRs();
      navigate('/delivery-receipt');
    } catch (e) {
      console.error('Error saving record', e);
      showError('Database Write Error', 'Failed to save delivery receipt metadata securely.');
    }
  };

  return (
    <div className={`w-full h-full p-4 lg:p-6 overflow-y-auto no-scrollbar font-sans ${isDarkMode ? 'text-slate-100 bg-slate-950' : 'text-slate-800 bg-slate-50'}`}>
      
      {/* HEADER CONTROLS */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/delivery-receipt')}
            className={`p-2.5 rounded-xl border transition-all hover:scale-105 cursor-pointer ${
              isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'
            }`}
            title="Go Back"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 px-2.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-brand-orange/10 text-brand-orange border border-brand-orange/20">
                {isEditMode ? 'Modify Mode' : 'New Form Draft'}
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                {currentStep === 1 ? 'Step 1 of 2: Form Details & Items' : 'Step 2 of 2: Print Preview & Verification'}
              </span>
            </div>
            <h1 className="text-xl font-black mt-1 leading-tight tracking-tight">
              {isEditMode ? `Edit Delivery Acceptance: ${drNo}` : 'Create Delivery Acceptance Form'}
            </h1>
          </div>
        </div>

        {/* WORKFLOW STEPPER CONTROLS */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Stepper tabs */}
          <div className={`flex items-center p-1 rounded-xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                currentStep === 1
                  ? 'bg-brand-orange text-white shadow-xs'
                  : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white/20 text-[10px] flex items-center justify-center font-black">1</span>
              <span>Form Details</span>
            </button>
            <button
              type="button"
              onClick={handleProceedToStep2}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                currentStep === 2
                  ? 'bg-brand-orange text-white shadow-xs'
                  : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white/20 text-[10px] flex items-center justify-center font-black">2</span>
              <span>Print Preview</span>
            </button>
          </div>

          {/* Action button corresponding to active step */}
          {currentStep === 1 ? (
            <button
              type="button"
              onClick={handleProceedToStep2}
              className="px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider text-white shadow-md active:scale-95 flex items-center gap-2 cursor-pointer transition-all hover:opacity-90 bg-brand-orange"
            >
              <span>Proceed to Print Preview</span>
              <ArrowRight size={15} strokeWidth={2.5} />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                  isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Printer size={14} />
                <span>Print / Save PDF</span>
              </button>

              <button
                type="button"
                onClick={handleSaveDeliveryReceipt}
                className="px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider text-white shadow-md active:scale-95 flex items-center gap-2 cursor-pointer transition-all hover:opacity-90 bg-brand-orange"
              >
                <Save size={14} strokeWidth={2.5} />
                <span>{isEditMode ? 'Update Record' : 'Save & Publish'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* INTERACTIVE FORM SECTION (STEP 1) */}
        <div className={`lg:col-span-12 space-y-6 ${currentStep === 1 ? 'block' : 'hidden'} print:hidden`}>
          
          {/* SECTION 1: CORE CLIENT & METADATA */}
          <div className={`p-4 rounded-xl border shadow-xs space-y-3.5 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-150'}`}>
            <div className="flex items-center gap-2 border-b dark:border-slate-800 pb-2">
              <Building2 size={16} className="text-brand-orange" />
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Section 1: Client & Document Information</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              
              {/* DR NO CARD */}
              <div className="flex flex-col gap-0.5 relative">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">DR No. (Receipt Number)</label>
                <input
                  type="text"
                  placeholder="e.g., 00014-2627"
                  value={drNo}
                  onChange={(e) => setDrNo(e.target.value)}
                  className={`px-3 py-1 rounded-lg border text-sm font-semibold tracking-wider font-mono focus:outline-none focus:ring-1 focus:ring-brand-orange ${
                    isDarkMode ? 'bg-slate-950 border-slate-805 text-amber-500' : 'bg-slate-50 border-slate-200 text-brand-orange'
                  }`}
                />
              </div>

              {/* Date Box */}
              <div className="flex flex-col gap-0.5">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Date Created</label>
                <div className="relative">
                  <Calendar size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    value={dateOfAcceptance}
                    onChange={(e) => setDateOfAcceptance(e.target.value)}
                    className={`w-full px-3 py-1 rounded-lg border text-sm focus:outline-none ${
                      isDarkMode ? 'bg-slate-950 border-slate-805 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>
              </div>

              {/* Delivered To Dropdown & Input */}
              <div className="flex flex-col gap-0.5 sm:col-span-2 relative">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Delivered To (School Client / Center)</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search standard schools or type manually..."
                    value={schoolSearchQuery}
                    onChange={(e) => {
                      setSchoolSearchQuery(e.target.value);
                      setDeliveredTo(e.target.value);
                      setIsSchoolDropdownOpen(true);
                    }}
                    onFocus={() => setIsSchoolDropdownOpen(true)}
                    className={`w-full px-3 py-1 rounded-lg border text-sm focus:outline-none ${
                      isDarkMode ? 'bg-slate-955 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                  {schoolSearchQuery && (
                    <button
                      onClick={() => {
                        setSchoolSearchQuery('');
                        setDeliveredTo('');
                        setSchoolMonitoringId('');
                        setClientCode('');
                        setAddress('');
                        setAgent('');
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 border-none bg-transparent"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {schoolMonitoringId && (
                  <div className="text-[11px] font-mono font-extrabold text-brand-orange mt-1 select-all">
                    School Monitoring ID: {schoolMonitoringId}
                  </div>
                )}

                {isSchoolDropdownOpen && filteredSchools.length > 0 && (
                  <div className={`absolute left-0 right-0 top-full mt-1 rounded-xl border shadow-xl z-50 p-1.5 max-h-56 overflow-y-auto ${
                    isDarkMode ? 'bg-slate-900 border-slate-850 text-white' : 'bg-white border-slate-200 text-slate-800'
                  }`}>
                    <p className="text-[10px] font-bold text-brand-orange uppercase p-1.5 tracking-wide border-b border-b-slate-100 dark:border-b-indigo-950/20 mb-1">
                      Matched School Database Records
                    </p>
                    {filteredSchools.map((s, i) => (
                      <button
                        key={`${s.school_name || s.name || 'school'}-${i}`}
                        type="button"
                        onClick={() => handleSelectSchool(s)}
                        className={`w-full text-left p-2 rounded-lg text-sm leading-tight transition-all flex flex-col gap-0.5 ${
                          isDarkMode ? 'hover:bg-slate-950 hover:text-amber-400' : 'hover:bg-amber-50 hover:text-brand-orange'
                        }`}
                      >
                        <span className="font-bold">{s.school_name || s.name}</span>
                        <span className="text-[11px] text-brand-orange font-mono font-extrabold">School Monitoring ID: {s.school_monitoring_id || s.id || '-'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Client Code Box */}
              <div className="flex flex-col gap-0.5">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Client Code</label>
                <div className="relative">
                  <Tag size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold" />
                  <input
                    type="text"
                    placeholder="e.g., C00000231(GS)"
                    value={clientCode}
                    onChange={(e) => setClientCode(e.target.value)}
                    className={`w-full px-3 py-1 rounded-lg border text-sm focus:outline-none ${
                      isDarkMode ? 'bg-slate-950 border-slate-805 text-mono' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>
              </div>

              {/* Address input */}
              <div className="flex flex-col gap-0.5 sm:col-span-2">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Address Location</label>
                <input
                  type="text"
                  placeholder="ASSUMPTION ROAD, 2600 BAGUIO CITY, BEN"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className={`px-3 py-1 rounded-lg border text-sm focus:outline-none ${
                    isDarkMode ? 'bg-slate-950 border-slate-805 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                />
              </div>

              {/* Agent Representative Selection */}
              <div className="flex flex-col gap-0.5">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Sales Representative / Agent</label>
                <input
                  type="text"
                  placeholder="Team Gina"
                  value={agent}
                  onChange={(e) => setAgent(e.target.value)}
                  className={`px-3 py-1 rounded-lg border text-sm focus:outline-none ${
                    isDarkMode ? 'bg-slate-950 border-slate-805 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                />
              </div>

              {/* Contact Person */}
              <div className="flex flex-col gap-0.5">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Contact Person</label>
                <div className="relative">
                  <User size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Principal or IT Admin"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className={`w-full px-3 py-1 rounded-lg border text-sm focus:outline-none ${
                      isDarkMode ? 'bg-slate-950 border-slate-805 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>
              </div>

              {/* Contact Number */}
              <div className="flex flex-col gap-0.5">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Contact No.</label>
                <input
                  type="text"
                  placeholder="0917-XXX-YYYY"
                  value={contactNo}
                  onChange={(e) => setContactNo(e.target.value)}
                  className={`px-3 py-1 rounded-lg border text-sm focus:outline-none ${
                    isDarkMode ? 'bg-slate-950 border-slate-805 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                />
              </div>

              {/* Project Name */}
              <div className="flex flex-col gap-0.5">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Project</label>
                <div className="relative">
                  <select
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    className={`w-full px-3 py-1 rounded-lg border text-sm focus:outline-none appearance-none pr-8 cursor-pointer ${
                      isDarkMode ? 'bg-slate-950 border-slate-805 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <option value="">Select Project...</option>
                    <option value="NGS">NGS</option>
                    <option value="HUB">HUB</option>
                    <option value="TNL">TNL</option>
                    <option value="ACE">ACE</option>
                    <option value="NGS+ACE">NGS+ACE</option>
                    <option value="HUB+ACE">HUB+ACE</option>
                    <option value="PELS NGS">PELS NGS</option>
                    <option value="PELS NGS+ACE">PELS NGS+ACE</option>
                    <option value="ACE+PELS">ACE+PELS</option>
                    <option value="ABDL">ABDL</option>
                    <option value="ACE+ABDL">ACE+ABDL</option>
                    <option value="HUB+NGS">HUB+NGS</option>
                    <option value="ABDL (PELS)">ABDL (PELS)</option>
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* MOA Period range */}
              <div className="flex flex-col gap-0.5 sm:col-span-2">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Memorandum of Agreement MOA (School Years)</label>
                <input
                  type="text"
                  placeholder="S.Y. 2023 TO S.Y. 2024 TO S.Y. 2025-26"
                  value={moa}
                  onChange={(e) => setMoa(e.target.value)}
                  className={`px-3 py-1 rounded-lg border text-sm focus:outline-none ${
                    isDarkMode ? 'bg-slate-950 border-slate-805 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                />
              </div>

            </div>
          </div>

          {/* SECTION 2: HARDWARE CARDS SPECIFICATION */}
          <div className={`p-4 rounded-xl border shadow-xs space-y-3.5 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-150'}`}>
            <div className="flex items-center justify-between border-b dark:border-slate-800 pb-2.5 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <ListPlus size={16} className="text-brand-orange" />
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Section 2: Hardware Delivered Items</h2>
              </div>
              <div className="flex gap-1.5 relative">
                {project && (availableBundles.length > 0 || project === 'ACE') && (
                  <div className="relative" ref={bundleDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsBundleDropdownOpen(!isBundleDropdownOpen)}
                      className="px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles size={12} />
                      {isLoadingBundles ? 'Loading...' : selectedBundleDropdown || 'Add Bundle'}
                      <ChevronDown size={10} className="transition-transform duration-200" style={{ transform: isBundleDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                    </button>
                    {isBundleDropdownOpen && (
                      <div className="absolute right-0 top-full mt-1 w-60 rounded-xl border border-slate-100 bg-white p-1 shadow-lg dark:bg-slate-900 dark:border-slate-800 z-50 text-left max-h-60 overflow-y-auto">
                        <div className="px-2 py-1 text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 mb-1">
                          Database Bundles
                        </div>
                        {availableBundles.map((bName) => (
                          <button
                            key={bName}
                            type="button"
                            onClick={() => {
                              setSelectedBundleDropdown(bName);
                              handleApplyBundle(bName);
                              setIsBundleDropdownOpen(false);
                            }}
                            className="w-full text-left px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                          >
                            {bName}
                          </button>
                        ))}
                        {availableBundles.length === 0 && (
                          <div className="px-2.5 py-1.5 text-[10px] text-slate-400 italic">
                            No synced bundles found
                          </div>
                        )}
                        {project === 'ACE' && (
                          <>
                            <div className="px-2 py-1 mt-1.5 text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider border-t border-b border-slate-100 dark:border-slate-800 mb-1 pt-1">
                              Standard Packages
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBundleDropdown('Tablet Classroom Bundle');
                                addAceBundle('classroom');
                                setIsBundleDropdownOpen(false);
                              }}
                              className="w-full text-left px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                            >
                              Tablet Classroom (50 + 1)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBundleDropdown('SIB Bundle');
                                addAceBundle('sib');
                                setIsBundleDropdownOpen(false);
                              }}
                              className="w-full text-left px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                            >
                              Interactive Board (1 SIB)
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {hardwareItems.map((row, index) => (
                <div 
                  key={row.id} 
                  className={`p-3 rounded-xl border flex flex-col gap-2 relative transition-all duration-200 ${
                    isDarkMode ? 'bg-slate-950/20 border-slate-801 hover:border-slate-700' : 'bg-slate-50/50 border-slate-105 hover:border-slate-200'
                  }`}
                >
                  {/* Delete Hardware row button top-right */}
                  <button
                    type="button"
                    onClick={() => removeHardwareRow(row.id)}
                    className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 border-none bg-transparent cursor-pointer transition-colors"
                    title="Remove Hardware row"
                  >
                    <Trash2 size={13} />
                  </button>

                  {/* Real-time Stock Connection & Warnings */}
                  {(() => {
                    const rowItemCode = row.item_code || (() => {
                      const matched = resolvedInventoryItems.find(it => 
                        (it.item_name || '').toLowerCase() === (row.description || '').toLowerCase()
                      );
                      return matched?.item_code;
                    })();
                    const invItem = rowItemCode ? resolvedInventoryItems.find(it => it.item_code === rowItemCode) : null;
                    const availableStock = invItem ? Number(invItem.total_quantity || 0) : 0;
                    const hasInsufficientStock = availableStock < Number(row.qty || 0);

                    return (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <div className="text-xs font-extrabold text-brand-orange font-mono select-none flex items-center gap-2">
                          Hardware Unit #{index + 1}
                          {rowItemCode && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono font-normal">
                              Code: {rowItemCode}
                            </span>
                          )}
                        </div>

                        <div className="text-xs font-bold sm:mr-8">
                          {invItem ? (
                            hasInsufficientStock ? (
                              <span className="text-red-500 font-black animate-pulse flex items-center gap-1 bg-red-50 dark:bg-red-950/20 px-2 py-0.5 rounded-md">
                                <AlertCircle size={12} /> Insufficient Stock! Available: {availableStock}
                              </span>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-md">
                                ✓ Stock Available: {availableStock}
                              </span>
                            )
                          ) : row.description ? (
                            <span className="text-amber-500 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-md">
                              ⚠ Not found in Inventory Catalog
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                    
                    {/* Quantity Box */}
                    <div className="sm:col-span-2 flex flex-col gap-0.5">
                      <label className="text-xs font-bold text-slate-500 uppercase">Qty</label>
                      <input
                        type="number"
                        min="1"
                        value={row.qty}
                        onChange={(e) => updateHardwareRow(row.id, { qty: Number(e.target.value) })}
                        className={`w-full px-2.5 py-1 rounded-lg border text-sm text-center font-bold font-mono focus:outline-none ${
                          isDarkMode ? 'bg-slate-955 border-slate-800 text-white' : 'bg-white border-slate-205 text-slate-800'
                        }`}
                      />
                    </div>

                    {/* Unit Box */}
                    <div className="sm:col-span-2 flex flex-col gap-0.5">
                      <label className="text-xs font-bold text-slate-500 uppercase">Unit</label>
                      <input
                        type="text"
                        placeholder="unit/pcs"
                        value={row.unit}
                        onChange={(e) => updateHardwareRow(row.id, { unit: e.target.value })}
                        className={`w-full px-2 py-1 rounded-lg border text-sm text-center font-bold focus:outline-none ${
                          isDarkMode ? 'bg-slate-955 border-slate-800 text-white' : 'bg-white border-slate-205 text-slate-800'
                        }`}
                      />
                    </div>

                    {/* Description autocomplete input */}
                    <div className="sm:col-span-8 flex flex-col gap-0.5 relative text-left">
                      <label className="text-xs font-bold text-slate-500 uppercase">Item Description Specification</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search actual inventory stock or input manually"
                          value={hardwareSearchQueries[row.id] !== undefined ? hardwareSearchQueries[row.id] : row.description}
                          onChange={(e) => {
                            const val = e.target.value;
                            setHardwareSearchQueries(prev => ({ ...prev, [row.id]: val }));
                            updateHardwareRow(row.id, { description: val });
                            setHardwareDropdownOpens(prev => ({ ...prev, [row.id]: true }));
                          }}
                          onFocus={() => setHardwareDropdownOpens(prev => ({ ...prev, [row.id]: true }))}
                          className={`w-full px-2.5 py-1 rounded-lg border text-sm focus:outline-none pr-8 ${
                            isDarkMode ? 'bg-slate-955 border-slate-800 text-white' : 'bg-white border-slate-205 text-slate-800'
                          }`}
                        />
                        {row.description && (
                          <button
                            onClick={() => {
                              updateHardwareRow(row.id, { description: '', specifications: '', unit: 'pcs' });
                              setHardwareSearchQueries(prev => ({ ...prev, [row.id]: '' }));
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 border-none bg-transparent"
                          >
                            <X size={11} />
                          </button>
                        )}
                      </div>

                      {/* Dropdown catalog */}
                      {hardwareDropdownOpens[row.id] && (() => {
                        const searchQueryInput = (hardwareSearchQueries[row.id] !== undefined ? hardwareSearchQueries[row.id] : row.description || '').toLowerCase();
                        const matchedInventoryOptions = resolvedInventoryItems.filter(item => 
                          (item.item_name || '').toLowerCase().includes(searchQueryInput) ||
                          (item.item_code || '').toLowerCase().includes(searchQueryInput)
                        );

                        return (
                          <div className={`absolute left-0 right-0 top-full mt-1 rounded-xl border shadow-xl z-30 p-1 max-h-40 overflow-y-auto ${
                            isDarkMode ? 'bg-slate-955 border-slate-800 text-white' : 'bg-white border-slate-205 text-slate-800'
                          }`}>
                            {matchedInventoryOptions.map((hc, codeIdx) => (
                              <button
                                key={`${hc.item_code}-${codeIdx}`}
                                type="button"
                                onClick={() => handleSelectHardwareItem(row.id, hc)}
                                className={`w-full text-left p-2 rounded-lg text-xs leading-normal transition-all flex flex-col gap-0.5 ${
                                  isDarkMode ? 'hover:bg-slate-900 hover:text-amber-400' : 'hover:bg-amber-50 hover:text-brand-orange'
                                }`}
                              >
                                <span className="font-bold text-slate-800 dark:text-slate-100">{hc.item_name}</span>
                                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mt-0.5">
                                  <span>Code: {hc.item_code}</span>
                                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">Available Stock: {hc.total_quantity}</span>
                                </div>
                              </button>
                            ))}
                            {matchedInventoryOptions.length === 0 && (
                              <p className="p-3 text-xs italic text-slate-400 text-center">No inventory items found</p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1 text-left">
                    {/* Item Specifications (Serial no) */}
                    <div className="flex flex-col gap-0.5">
                      <label className="text-xs font-bold text-slate-500 uppercase">Item Specifications / Serial Numbers (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g., NXKS7SP00141509F333400, Core i7 16G"
                        value={row.specifications}
                        onChange={(e) => updateHardwareRow(row.id, { specifications: e.target.value })}
                        className={`px-3 py-1 rounded-lg border text-sm font-mono focus:outline-none ${
                          isDarkMode ? 'bg-slate-955 border-slate-808 text-white' : 'bg-white border-slate-205 text-slate-800'
                        }`}
                      />
                    </div>

                    {/* Remarks field */}
                    <div className="flex flex-col gap-0.5">
                      <label className="text-xs font-bold text-slate-500 uppercase">Specific Target Remarks</label>
                      <input
                        type="text"
                        placeholder="e.g., ELEM DEPT. Replacement 6-6573"
                        value={row.remarks}
                        onChange={(e) => updateHardwareRow(row.id, { remarks: e.target.value })}
                        className={`px-3 py-1 rounded-lg border text-sm focus:outline-none ${
                          isDarkMode ? 'bg-slate-955 border-slate-808 text-white' : 'bg-white border-slate-205 text-slate-805'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {hardwareItems.length === 0 && (
              <p className="text-xs p-4 italic text-slate-400 text-center dark:bg-slate-950/20 rounded-xl">
                No hardware units drafted. Click "Add Hardware Row" to populate equipment.
              </p>
            )}
          </div>

          {/* HIDDEN FILE INPUTS FOR E-SIGNATURE UPLOAD */}
          <input
            type="file"
            ref={preparedFileInputRef}
            accept="image/*"
            className="hidden"
            onChange={(e) => handleSignatureFileUpload(e, 'prepared')}
          />
          <input
            type="file"
            ref={deliveredFileInputRef}
            accept="image/*"
            className="hidden"
            onChange={(e) => handleSignatureFileUpload(e, 'delivered')}
          />
          <input
            type="file"
            ref={approvedFileInputRef}
            accept="image/*"
            className="hidden"
            onChange={(e) => handleSignatureFileUpload(e, 'approved')}
          />
          <input
            type="file"
            ref={checkedReceivedFileInputRef}
            accept="image/*"
            className="hidden"
            onChange={(e) => handleSignatureFileUpload(e, 'checkedReceived')}
          />

          {/* SECTION 3: SIGNATORIES & AUTHORIZATIONS */}
          <div className={`p-4 rounded-xl border shadow-xs space-y-4 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-150'}`}>
            <div className="flex items-center justify-between border-b dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <PenTool size={16} className="text-brand-orange" />
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Section 3: Signatories & Authorizations</h2>
              </div>
              <span className="text-[10px] text-slate-400 font-medium italic">Configured with official defaults (Prepared & Approved), fully editable with optional e-signature uploads</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              
              {/* 1. Prepared by */}
              <div className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 ${
                isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50/80 border-slate-200'
              }`}>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase text-brand-orange tracking-wider">Prepared By</span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-brand-orange/10 text-brand-orange">Signatory 1</span>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">Full Name</label>
                      <input
                        type="text"
                        placeholder="Bianca Aguinaldo"
                        value={signatoryPrepared.name}
                        onChange={(e) => setSignatoryPrepared(prev => ({ ...prev, name: e.target.value }))}
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-medium focus:outline-none ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">Date</label>
                      <input
                        type="date"
                        value={signatoryPrepared.date}
                        onChange={(e) => setSignatoryPrepared(prev => ({ ...prev, date: e.target.value }))}
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-medium focus:outline-none ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* E-Signature Area */}
                <div className="pt-2 border-t dark:border-slate-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase text-slate-400">E-Signature</span>
                    {signatoryPrepared.signatureImage && (
                      <button
                        type="button"
                        onClick={() => setSignatoryPrepared(prev => ({ ...prev, signatureImage: undefined, type: 'typed' }))}
                        className="text-[9px] text-rose-500 font-bold hover:underline cursor-pointer border-none bg-transparent"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {signatoryPrepared.signatureImage ? (
                    <div className="p-2 rounded-lg border bg-white flex items-center justify-center h-16 relative group">
                      <img src={signatoryPrepared.signatureImage} alt="Prepared Signature" className="max-h-full max-w-full object-contain" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => preparedFileInputRef.current?.click()}
                        className={`flex-1 py-1.5 px-2 rounded-lg border text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-250 text-slate-700 hover:bg-slate-100'
                        }`}
                        title="Upload signature image (PNG, JPG, WebP)"
                      >
                        <Upload size={12} className="text-brand-orange" />
                        <span>Upload</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openSignatureModal('prepared')}
                        className={`flex-1 py-1.5 px-2 rounded-lg border text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-250 text-slate-700 hover:bg-slate-100'
                        }`}
                        title="Draw signature on canvas"
                      >
                        <PenTool size={12} className="text-brand-orange" />
                        <span>Draw</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Delivered / Installed by */}
              <div className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 ${
                isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50/80 border-slate-200'
              }`}>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase text-brand-orange tracking-wider">Delivered / Installed</span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-brand-orange/10 text-brand-orange">Signatory 2</span>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">Full Name</label>
                      <input
                        type="text"
                        placeholder="Enter staff or driver name..."
                        value={signatoryDelivered.name}
                        onChange={(e) => setSignatoryDelivered(prev => ({ ...prev, name: e.target.value }))}
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-medium focus:outline-none ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Approved by */}
              <div className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 ${
                isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50/80 border-slate-200'
              }`}>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase text-brand-orange tracking-wider">Approved By</span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-brand-orange/10 text-brand-orange">Signatory 3</span>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">Full Name</label>
                      <input
                        type="text"
                        placeholder="Jerald Dela Cruz"
                        value={signatoryApproved.name}
                        onChange={(e) => setSignatoryApproved(prev => ({ ...prev, name: e.target.value }))}
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-medium focus:outline-none ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">Date</label>
                      <input
                        type="date"
                        value={signatoryApproved.date}
                        onChange={(e) => setSignatoryApproved(prev => ({ ...prev, date: e.target.value }))}
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-medium focus:outline-none ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* E-Signature Area */}
                <div className="pt-2 border-t dark:border-slate-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase text-slate-400">E-Signature</span>
                    {signatoryApproved.signatureImage && (
                      <button
                        type="button"
                        onClick={() => setSignatoryApproved(prev => ({ ...prev, signatureImage: undefined, type: 'typed' }))}
                        className="text-[9px] text-rose-500 font-bold hover:underline cursor-pointer border-none bg-transparent"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {signatoryApproved.signatureImage ? (
                    <div className="p-2 rounded-lg border bg-white flex items-center justify-center h-16 relative group">
                      <img src={signatoryApproved.signatureImage} alt="Approved Signature" className="max-h-full max-w-full object-contain" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => approvedFileInputRef.current?.click()}
                        className={`flex-1 py-1.5 px-2 rounded-lg border text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-250 text-slate-700 hover:bg-slate-100'
                        }`}
                        title="Upload signature image (PNG, JPG, WebP)"
                      >
                        <Upload size={12} className="text-brand-orange" />
                        <span>Upload</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openSignatureModal('approved')}
                        className={`flex-1 py-1.5 px-2 rounded-lg border text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-250 text-slate-700 hover:bg-slate-100'
                        }`}
                        title="Draw signature on canvas"
                      >
                        <PenTool size={12} className="text-brand-orange" />
                        <span>Draw</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* GENERAL REMARKS */}
          <div className={`p-4 rounded-xl border shadow-xs text-left ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-150'}`}>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Additional Receipt Instructions or Dispatch notes</label>
            <textarea
              rows={3}
              placeholder="Provide delivery routing conditions or remarks for Logistics drivers..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className={`w-full p-2.5 rounded-lg border text-sm focus:outline-none mt-2 ${
                isDarkMode ? 'bg-slate-955 border-slate-800 text-white' : 'bg-slate-50 border-slate-150 text-slate-800'
              }`}
            />
          </div>

          {/* STEP 1 NAVIGATION FOOTER */}
          <div className="flex items-center justify-between pt-2 border-t dark:border-slate-800">
            <button
              type="button"
              onClick={() => navigate('/delivery-receipt')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Cancel & Return
            </button>
            <button
              type="button"
              onClick={handleProceedToStep2}
              className="px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider text-white shadow-md active:scale-95 flex items-center gap-2 cursor-pointer transition-all hover:opacity-90 bg-brand-orange"
            >
              <span>Proceed to Step 2: Print Preview & Review</span>
              <ArrowRight size={16} strokeWidth={2.5} />
            </button>
          </div>

        </div>

        {/* STEP 2: PRINT PREVIEW & VERIFICATION (DOCUMENT RENDER MATCHING PHOENIX LAYOUT) */}
        <div className={`lg:col-span-12 print:block ${currentStep === 2 ? 'block' : 'hidden'}`}>
          {/* Top Step 2 Verification Banner */}
          <div className="mb-5 p-4 rounded-2xl border flex items-center justify-between flex-wrap gap-3 bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200 print:hidden shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-brand-orange text-white">
                <Eye size={18} />
              </div>
              <div className="text-left">
                <p className="text-xs font-black uppercase tracking-wider text-brand-orange">Step 2: Print Preview & Document Review</p>
                <p className="text-[11px] opacity-80 mt-0.5">Please review the delivery acceptance layout, item breakdown, and signatures below before finalizing and publishing.</p>
              </div>
            </div>
          </div>
          {/* Multi-Page Paginated Document Sheets for Bundles */}
          <div className="space-y-8 print:space-y-0">
            {printPages.map((pageGroup, pageIndex) => {
              const isLastPage = pageIndex === printPages.length - 1;
              const pageItems = pageGroup.items;

              return (
                <div key={pageGroup.id || pageIndex} className="print:break-after-page print:page-break-after-always">
                  {/* Page indicator in web preview mode */}
                  {printPages.length > 1 && (
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 px-1 max-w-4xl mx-auto print:hidden">
                      <span className="flex items-center gap-1.5 uppercase font-mono tracking-wider">
                        <span className="px-2 py-0.5 rounded bg-brand-orange text-white text-[10px] font-black">
                          Page {pageIndex + 1} of {printPages.length}
                        </span>
                        <span className="text-slate-700 dark:text-slate-200">{pageGroup.pageLabel}</span>
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {pageItems.length} item{pageItems.length !== 1 ? 's' : ''} on this page
                      </span>
                    </div>
                  )}

                  <div 
                    className={`border bg-white text-zinc-900 p-8 shadow-md rounded-2xl relative select-none print:shadow-none print:border-none print:p-0 max-w-4xl mx-auto font-sans ${
                      !isLastPage ? 'print:break-after-page print:page-break-after-always' : ''
                    }`}
                    style={{ pageBreakAfter: !isLastPage ? 'always' : 'auto' }}
                  >
                    {/* Header branding logo section */}
                    <div className="flex items-center justify-center mb-1 pb-1">
                      <img 
                        src="https://www.phoenix.com.ph/wp-content/uploads/2026/06/Screenshot-2026-06-04-093703.png"
                        alt="Phoenix Publishing House Logo Header"
                        className="w-full object-contain max-h-[85px]"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    {/* Document title & top right date blocks */}
                    <div className="flex items-center justify-between mt-2.5">
                      <div className="w-1/4" />
                      <div className="w-2/4 text-center">
                        <h2 className="text-[14px] font-black tracking-widest text-zinc-900 uppercase font-sans">
                          DELIVERY ACCEPTANCE
                        </h2>
                      </div>

                      {/* Box container for Date and DR No. matching paper sketch */}
                      <div className="w-1/4 flex justify-end">
                        <div className="border border-zinc-500 rounded-sm overflow-hidden shrink-0 text-center text-[10px] w-[165px] leading-tight">
                          <div className="border-b border-zinc-500 p-1 flex items-center justify-between px-2 bg-zinc-50">
                            <span className="font-bold text-zinc-500 uppercase">Date:</span>
                            <span className="font-mono font-bold text-zinc-800">
                              {dateOfAcceptance ? new Date(dateOfAcceptance).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '--/--/----'}
                            </span>
                          </div>
                          <div className="p-1 flex items-center justify-between px-2 bg-zinc-100/50">
                            <span className="font-bold text-zinc-500 uppercase">DR No.</span>
                            <span className="font-mono font-bold text-zinc-900 tracking-wider">
                              {drNo || '00014-2627'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Client information fields grid */}
                    <div className="grid grid-cols-12 gap-y-2 text-[10px] text-left mt-4 pb-4 border-b border-zinc-300">
                      
                      <div className="col-span-7 flex flex-col pr-4 justify-end">
                        <div className="flex items-end">
                          <span className="w-24 shrink-0 font-bold text-zinc-700">Delivered to</span>
                          <span className="font-semibold text-zinc-500 mr-1.5">:</span>
                          <span className="font-black text-zinc-900 border-b border-zinc-300 flex-grow pb-0.5 truncate pl-1">
                            {deliveredTo || 'ST. LOUIS SCHOOL (CENTER), INC.'}
                          </span>
                        </div>
                        {schoolMonitoringId && (
                          <div className="flex items-end mt-1 font-mono text-[9px] text-brand-orange pl-[102px]">
                            <span className="font-bold text-zinc-500 mr-1.5">ID:</span>
                            <span className="font-black text-zinc-900">{schoolMonitoringId}</span>
                          </div>
                        )}
                      </div>
                      <div className="col-span-5 flex items-end">
                        <span className="w-20 shrink-0 font-bold text-zinc-700">Client Code</span>
                        <span className="font-semibold text-zinc-500 mr-1.5">:</span>
                        <span className="font-mono font-bold text-zinc-900 border-b border-zinc-300 flex-grow pb-0.5 pl-1">
                          {clientCode || 'C00000231(GS)'}
                        </span>
                      </div>

                      <div className="col-span-7 flex items-end pr-4">
                        <span className="w-24 shrink-0 font-bold text-zinc-700">Address</span>
                        <span className="font-semibold text-zinc-500 mr-1.5">:</span>
                        <span className="font-medium text-zinc-800 border-b border-zinc-300 flex-grow pb-0.5 truncate pl-1">
                          {address || 'ASSUMPTION ROAD, 2600 BAGUIO CITY, BEN'}
                        </span>
                      </div>
                      <div className="col-span-5 flex items-end">
                        <span className="w-20 shrink-0 font-bold text-zinc-700">Agent</span>
                        <span className="font-semibold text-zinc-500 mr-1.5">:</span>
                        <span className="font-semibold text-zinc-850 border-b border-zinc-300 flex-grow pb-0.5 pl-1">
                          {agent || 'Team Gina'}
                        </span>
                      </div>

                      <div className="col-span-7 flex items-end pr-4">
                        <span className="w-24 shrink-0 font-bold text-zinc-700">Contact Person</span>
                        <span className="font-semibold text-zinc-500 mr-1.5">:</span>
                        <span className="font-medium text-zinc-800 border-b border-zinc-350 flex-grow pb-0.5 pl-1 truncate">
                          {contactPerson || <span className="text-zinc-300">__________________________________________</span>}
                        </span>
                      </div>
                      <div className="col-span-5 flex items-end">
                        <span className="w-20 shrink-0 font-bold text-zinc-700">Project</span>
                        <span className="font-semibold text-zinc-500 mr-1.5">:</span>
                        <span className="font-bold text-zinc-950 border-b border-zinc-300 flex-grow pb-0.5 pl-1 truncate">
                          {project || 'ARALINKS ACE'}
                        </span>
                      </div>

                      <div className="col-span-7 flex items-end pr-4">
                        <span className="w-24 shrink-0 font-bold text-zinc-700">Contact No.</span>
                        <span className="font-semibold text-zinc-500 mr-1.5">:</span>
                        <span className="font-medium text-zinc-800 border-b border-zinc-300 flex-grow pb-0.5 pl-1">
                          {contactNo || <span className="text-zinc-300">__________________________________________</span>}
                        </span>
                      </div>
                      <div className="col-span-5 flex items-end">
                        <span className="w-20 shrink-0 font-bold text-zinc-700">MOA</span>
                        <span className="font-semibold text-zinc-500 mr-1.5">:</span>
                        <span className="font-semibold text-zinc-805 border-b border-zinc-300 flex-grow pb-0.5 pl-1 truncate">
                          {moa || 'S.Y. 2023 TO S.Y. 2024 TO S.Y. 2025-26'}
                        </span>
                      </div>

                    </div>

                    {/* HARDWARE ITEMS TABLE FOR THIS PAGE */}
                    <div className="mt-4 text-[9.5px] text-left">
                      <table className="w-full border-collapse border border-zinc-400">
                        <thead>
                          <tr className="bg-zinc-100 text-[8.5px] font-black uppercase text-zinc-650 border-b border-zinc-400">
                            <th className="border-r border-zinc-400 px-2.5 py-1.5 text-center w-14">Quantity</th>
                            <th className="border-r border-zinc-400 px-2.5 py-1.5 text-center w-14">Unit</th>
                            <th className="border-r border-zinc-400 px-3 py-1.5 text-left w-1/2">Description</th>
                            <th className="border-r border-zinc-400 px-3 py-1.5 text-left">Specifications</th>
                            <th className="px-3 py-1.5 text-left">Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="text-[9.5px]">
                          {/* Category Indicator Row */}
                          <tr className="border-b border-zinc-300 font-bold text-zinc-800 bg-zinc-50/70">
                            <td className="border-r border-zinc-300 py-1 text-center"></td>
                            <td className="border-r border-zinc-300 py-1 text-center"></td>
                            <td colSpan={3} className="px-3 py-1 font-black uppercase tracking-wider text-[8.5px] text-zinc-700">
                              {pageGroup.categoryTitle}
                            </td>
                          </tr>

                          {pageItems.map((hw, idx) => (
                            <tr key={hw.id || idx} className="border-b border-zinc-200">
                              <td className="border-r border-zinc-400 px-2 py-1 text-center font-bold font-mono text-zinc-900">{hw.qty}</td>
                              <td className="border-r border-zinc-400 px-2 py-1 text-center text-zinc-600 font-sans">{hw.unit}</td>
                              <td className="border-r border-zinc-400 px-3 py-1 font-black text-zinc-900 truncate max-w-[210px]" title={hw.description}>{hw.description || '------'}</td>
                              <td className="border-r border-zinc-400 px-3 py-1 font-mono text-[9px] text-zinc-650 truncate max-w-[150px]" title={hw.specifications}>{hw.specifications || '------'}</td>
                              <td className="px-3 py-1 text-zinc-600 truncate max-w-[140px]" title={hw.remarks}>{hw.remarks || '------'}</td>
                            </tr>
                          ))}
                          {/* Fill empty lines up to 8 rows for consistent notebook layout */}
                          {Array.from({ length: Math.max(0, 8 - pageItems.length) }).map((_, i) => (
                            <tr key={`empty-hw-${pageIndex}-${i}`} className="h-[21px] border-b border-zinc-200">
                              <td className="border-r border-zinc-400"></td>
                              <td className="border-r border-zinc-400"></td>
                              <td className="border-r border-zinc-400"></td>
                              <td className="border-r border-zinc-400"></td>
                              <td></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Document Remarks/Footnotes */}
                    {remarks && (
                      <div className="mt-3.5 p-2 rounded border border-zinc-200 text-left text-[8.5px] leading-relaxed text-zinc-500 font-sans">
                        <span className="font-extrabold text-[#FF6A00] uppercase block mb-0.5">Dispatcher / Routing Notes:</span>
                        {remarks}
                      </div>
                    )}

                    {/* SIGNATURE FIELDS AT THE BOTTOM (Standard across all pages) */}
                    <div className="mt-6 pt-4 border-t border-zinc-300 grid grid-cols-2 gap-x-12 gap-y-5 text-left leading-snug text-[10px]">
                      
                      {/* Row 1 Column 1: Prepared */}
                      <div className="space-y-1.5 flex flex-col justify-between">
                        <div>
                          <span className="text-[9px] font-bold uppercase text-zinc-600 block">
                            Prepared by/ Date: {signatoryPrepared.date ? new Date(signatoryPrepared.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : ''}
                          </span>
                        </div>
                        <div 
                          onClick={() => openSignatureModal('prepared')}
                          className="h-14 border border-dashed border-zinc-200 rounded hover:bg-zinc-50 cursor-pointer relative overflow-hidden flex items-center justify-center transition-all"
                          title="Click to sign or upload e-signature"
                        >
                          {signatoryPrepared.signatureImage ? (
                            <img src={signatoryPrepared.signatureImage} alt="Prepared Sig" className="object-contain h-full w-44 opacity-95 scale-100" />
                          ) : signatoryPrepared.name ? (
                            <div className="text-zinc-400 text-center font-mono opacity-50 flex items-center gap-1">
                              <PenTool size={10} className="text-brand-orange" />
                              <span className="text-[7.5px] font-bold uppercase">Click to Sign</span>
                            </div>
                          ) : (
                            <span className="text-zinc-300 text-[9px] italic">Sign here</span>
                          )}
                        </div>
                        <div className="text-center font-sans">
                          <span className="font-extrabold text-zinc-900 border-b border-zinc-400 block pb-0.5 max-w-[200px] mx-auto text-[10px] uppercase tracking-wide leading-none min-h-[14px]">
                            {signatoryPrepared.name || '__________________________'}
                          </span>
                          <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider mt-1 block">Printed Name/Signature</span>
                        </div>
                      </div>

                      {/* Row 1 Column 2: Delivered/Installed */}
                      <div className="space-y-1.5 flex flex-col justify-between">
                        <div>
                          <span className="text-[9px] font-bold uppercase text-zinc-600 block">
                            Delivered/Installed by:
                          </span>
                        </div>
                        <div className="h-14 flex items-center justify-center">
                          {/* Space reserved for physical signature */}
                        </div>
                        <div className="text-center font-sans">
                          <span className="font-extrabold text-zinc-900 border-b border-zinc-400 block pb-0.5 max-w-[240px] mx-auto text-[10px] uppercase tracking-wide leading-none min-h-[14px]">
                            {signatoryDelivered.name || '__________________________'}
                          </span>
                          <span className="text-[8px] text-zinc-440 font-bold uppercase tracking-wider mt-1 block">Printed Name/Signature</span>
                        </div>
                      </div>

                      {/* Row 2 Column 1: Approved */}
                      <div className="space-y-1.5 flex flex-col justify-between">
                        <div>
                          <span className="text-[9px] font-bold uppercase text-zinc-600 block">
                            Approved by/ Date: {signatoryApproved.date ? new Date(signatoryApproved.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : ''}
                          </span>
                        </div>
                        <div 
                          onClick={() => openSignatureModal('approved')}
                          className="h-14 border border-dashed border-zinc-200 rounded hover:bg-zinc-50 cursor-pointer relative overflow-hidden flex items-center justify-center transition-all"
                          title="Click to sign or upload e-signature"
                        >
                          {signatoryApproved.signatureImage ? (
                            <img src={signatoryApproved.signatureImage} alt="Approved Sig" className="object-contain h-full w-44 opacity-95 scale-100" />
                          ) : signatoryApproved.name ? (
                            <div className="text-zinc-400 text-center font-mono opacity-50 flex items-center gap-1">
                              <PenTool size={10} className="text-brand-orange" />
                              <span className="text-[7.5px] font-bold uppercase">Click to Sign</span>
                            </div>
                          ) : (
                            <span className="text-zinc-300 text-[9px] italic">Sign here</span>
                          )}
                        </div>
                        <div className="text-center font-sans">
                          <span className="font-extrabold text-zinc-900 border-b border-zinc-400 block pb-0.5 max-w-[200px] mx-auto text-[10px] uppercase tracking-wide leading-none min-h-[14px]">
                            {signatoryApproved.name || '__________________________'}
                          </span>
                          <span className="text-[8px] text-zinc-440 font-bold uppercase tracking-wider mt-1 block">Printed Name/Signature</span>
                        </div>
                      </div>

                      {/* Row 2 Column 2: Checked and Received */}
                      <div className="space-y-1.5 flex flex-col justify-between">
                        <div>
                          <span className="text-[9px] font-bold uppercase text-zinc-650 block">
                            CHECKED and Received the above articles in good order and condition:
                          </span>
                        </div>
                        <div 
                          onClick={() => openSignatureModal('checkedReceived')}
                          className="h-14 border border-dashed border-zinc-250 rounded bg-orange-50/5 hover:bg-orange-50/15 cursor-pointer relative overflow-hidden flex items-center justify-center transition-all"
                          title="Click to sign or upload e-signature"
                        >
                          {signatoryCheckedReceived.signatureImage ? (
                            <img src={signatoryCheckedReceived.signatureImage} alt="Received Sig" className="object-contain h-full w-44 opacity-95 scale-100" />
                          ) : signatoryCheckedReceived.name ? (
                            <div className="text-zinc-400 text-center font-mono opacity-50 flex items-center gap-1">
                              <PenTool size={10} className="text-brand-orange" />
                              <span className="text-[7.5px] font-bold uppercase">Click to Sign</span>
                            </div>
                          ) : (
                            <div className="text-center font-mono flex items-center justify-center gap-1">
                              <PenTool size={10} className="text-brand-orange animate-bounce" />
                              <span className="text-[7.5px] text-brand-orange font-bold uppercase tracking-wider">Receiver Sign</span>
                            </div>
                          )}
                        </div>
                        <div className="text-center font-sans">
                          <span className="font-extrabold text-zinc-900 border-b border-zinc-400 block pb-0.5 max-w-[200px] mx-auto text-[10px] uppercase tracking-wide leading-none min-h-[14px]">
                            {signatoryCheckedReceived.name || '__________________________'}
                          </span>
                          <span className="text-[8px] text-zinc-440 font-bold uppercase tracking-wider mt-1 block">Printed Name/Signature/Date</span>
                        </div>
                      </div>

                    </div>

                    {/* Document Footnote standard alignment with dynamic page numbering */}
                    <div className="mt-8 border-t border-zinc-300 pt-3.5 flex items-center justify-between text-[8px] text-zinc-400 font-mono">
                      <span>* Please fill up remarks field if necessary</span>
                      <span className="font-bold">page {pageIndex + 1} of {printPages.length}</span>
                      <span>cc: FPH I.T. Dept., Customer</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* STEP 2 BOTTOM ACTIONS (PRINT HIDDEN) */}
          <div className="mt-6 flex items-center justify-between pt-4 border-t dark:border-slate-800 print:hidden max-w-4xl mx-auto">
            <button
              type="button"
              onClick={() => {
                setCurrentStep(1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <ArrowLeft size={14} />
              <span>Back to Form Details</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                  isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Printer size={14} />
                <span>Print / Save PDF</span>
              </button>
              <button
                type="button"
                onClick={handleSaveDeliveryReceipt}
                className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white shadow-md active:scale-95 flex items-center gap-2 cursor-pointer transition-all hover:opacity-90 bg-brand-orange"
              >
                <Save size={14} strokeWidth={2.5} />
                <span>{isEditMode ? 'Update Record' : 'Save & Publish'}</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* CORE DRIVER CANVAS MODAL FOR SCRIBBLED SIGNATURES */}
      {isSignModalOpen && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-xs z-[2000] flex items-center justify-center p-4">
          <div className={`p-6 rounded-2xl border shadow-2xl max-w-md w-full text-left font-sans ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-150 text-slate-800'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 mb-4.5 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <PenTool size={15} className="text-brand-orange" />
                <h3 className="text-sm font-black uppercase tracking-wider">
                  Scribble Smart Signature
                </h3>
              </div>
              <button
                onClick={() => setIsSignModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-4">
              
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400">Printed Signatory Name</label>
                <input
                  type="text"
                  placeholder="Enter Signee printed name..."
                  value={typedSignName}
                  onChange={(e) => setTypedSignName(e.target.value)}
                  className={`px-3 py-1.5 rounded-lg border text-xs focus:outline-none ${
                    isDarkMode ? 'bg-slate-950 border-slate-805 text-white animate-pulse' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 flex items-center justify-between">
                  <span>Draw Signature Area</span>
                  <button
                    type="button"
                    onClick={clearSignatureCanvas}
                    className="text-[9px] text-[#FF6A00] uppercase font-black hover:underline cursor-pointer border-none bg-transparent"
                  >
                    Clear Slate
                  </button>
                </label>

                {/* Sign Canvas block */}
                <canvas
                  ref={canvasRef}
                  width={380}
                  height={150}
                  onMouseDown={startScribble}
                  onMouseMove={drawScribbling}
                  onMouseUp={stopScribbling}
                  onMouseLeave={stopScribbling}
                  onTouchStart={startScribble}
                  onTouchMove={drawScribbling}
                  onTouchEnd={stopScribbling}
                  className="w-full bg-zinc-50 dark:bg-slate-950/40 border border-zinc-250 dark:border-slate-800 rounded-xl cursor-[url(pencil.png),_pointer] h-[150px] touch-none"
                />
              </div>

              <p className="text-[9.5px] text-slate-400 leading-normal italic text-center">
                * Drag mouse or finger draw signature onto the white canvas correctly. Electronic signatures hold equal priority weights.
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => saveSignatureDetails('typed')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    isDarkMode ? 'bg-slate-800 text-slate-350 hover:text-white' : 'bg-slate-100 text-slate-650 hover:bg-slate-200'
                  }`}
                >
                  Use Printed Name Only
                </button>

                <button
                  type="button"
                  onClick={() => saveSignatureDetails('drawn')}
                  className="px-4.5 py-2 rounded-xl text-xs font-black uppercase text-white shadow bg-brand-orange inline-flex items-center gap-1.5 active:scale-95 cursor-pointer transition-all hover:opacity-90"
                >
                  <Check size={14} strokeWidth={3} />
                  Authorize & Apply
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* PENDING BUNDLE MULTIPLIER MODAL */}
      {pendingBundle && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-xs z-[2000] flex items-center justify-center p-4">
          <div className={`p-6 rounded-2xl border shadow-2xl max-w-sm w-full text-left font-sans ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-150 text-slate-800'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 mb-4.5 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-amber-500" />
                <h3 className="text-sm font-black uppercase tracking-wider">
                  Apply Bundle Configuration
                </h3>
              </div>
              <button
                onClick={() => setPendingBundle(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-4 font-medium">
              You are applying the bundle configuration <span className="font-bold text-slate-700 dark:text-white uppercase">"{pendingBundle}"</span> to your active hardware delivery.
            </p>

            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400">Multiplier (Number of Bundles)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={bundleQuantity || ''}
                  onChange={(e) => setBundleQuantity(e.target.value.replace(/[^0-9]/g, ''))}
                  autoFocus
                  className={`px-3 py-2 rounded-lg border text-sm font-bold font-mono focus:outline-none ${
                    isDarkMode ? 'bg-slate-950 border-slate-805 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                  placeholder="1"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setPendingBundle(null)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    isDarkMode ? 'bg-slate-800 text-slate-350 hover:text-white' : 'bg-slate-100 text-slate-650 hover:bg-slate-200'
                  }`}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={confirmApplyBundle}
                  className="px-4.5 py-2 rounded-xl text-xs font-black uppercase text-white shadow bg-brand-orange inline-flex items-center gap-1.5 active:scale-95 cursor-pointer transition-all hover:opacity-90"
                >
                  <Check size={14} strokeWidth={3} />
                  Confirm & Apply
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CreateDeliveryReceiptPage;
