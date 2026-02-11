import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  AlertCircle, 
  ArrowDownAZ,
  ArrowUpAZ,
  Bell,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  FileDown,
  Filter,
  HelpCircle,
  Home,
  Loader2,
  PlusCircle, 
  Settings, 
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  SortAsc,
  SortDesc,
  ToggleLeft, 
  ToggleRight, 
  Trash2
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { monitorsApi, transactionsApi, type TransactionRecord, type Monitor } from "@/lib/api";

interface MonitorSettings {
  active: boolean;
  notificationChannels?: {
    channelType: string;
    enabled: boolean;
    config: any;
  }[];
}

const parseMonitorSettings = (settingsJson: string): MonitorSettings => {
  try {
    return JSON.parse(settingsJson);
  } catch {
    return { active: true };
  }
};

interface HashVerification {
  verified: boolean;
  calculatedHashes?: {
    domainHash: string;
    messageHash: string;
    safeTxHash: string;
  };
  apiHashes?: {
    safeTxHash: string;
  };
  error?: string | null;
}

interface Transaction {
  id: string;
  safeAddress: string;
  network: string;
  safeTxHash: string;
  toAddress: string;
  value?: string;
  data?: string;
  operation?: number;
  nonce: number;
  isExecuted: boolean;
  submissionDate?: string;
  executionDate?: string;
  createdAt: string;
  updatedAt: string;
  transactionData?: {
    dataDecoded?: {
      method: string;
      parameters?: any[];
    };
    data_decoded?: {
      method: string;
      parameters?: any[];
    };
    [key: string]: any;
  };
  security_analysis?: {
    id: string;
    isSuspicious: boolean;
    riskLevel: string;
    warnings: string[];
    details?: Array<{
      type: string;
      severity: string;
      message: string;
      priority?: string;
      [key: string]: any;
    }>;
    hashVerification?: HashVerification;
    nonceCheck?: any;
  };
}

interface TransactionFilters {
  safe: string | null;
  network: string | null;
  state: string | null;
  securityStatus: string | null;
}

type SortField = 'safe' | 'network' | 'nonce' | 'type' | 'scanned_at';
type SortDirection = 'asc' | 'desc';

const STORAGE_KEYS = {
  FILTERS: 'monitor_filters',
  SORT_FIELD: 'monitor_sort_field',
  SORT_DIRECTION: 'monitor_sort_direction',
  ITEMS_PER_PAGE: 'monitor_items_per_page',
  SHOW_FILTERS: 'monitor_show_filters',
};

const loadFromStorage = <T,>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return defaultValue;
    return JSON.parse(stored) as T;
  } catch {
    return defaultValue;
  }
};

const saveToStorage = <T,>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage errors
  }
};

const Monitor = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDirectTransaction, setIsLoadingDirectTransaction] = useState(false);
  
  // Delete confirmation modal state
  const [deleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState(false);
  const [monitorToDelete, setMonitorToDelete] = useState<Monitor | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  
  // Transaction state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  
  // Filtering state (persisted to localStorage)
  const [filters, setFiltersState] = useState<TransactionFilters>(() =>
    loadFromStorage(STORAGE_KEYS.FILTERS, {
      safe: null,
      network: null,
      state: null,
      securityStatus: null
    })
  );
  
  const setFilters: React.Dispatch<React.SetStateAction<TransactionFilters>> = (value) => {
    setFiltersState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value;
      saveToStorage(STORAGE_KEYS.FILTERS, newValue);
      return newValue;
    });
  };
  
  // Sorting state (persisted to localStorage)
  const [sortField, setSortFieldState] = useState<SortField>(() =>
    loadFromStorage(STORAGE_KEYS.SORT_FIELD, 'scanned_at')
  );
  const [sortDirection, setSortDirectionState] = useState<SortDirection>(() =>
    loadFromStorage(STORAGE_KEYS.SORT_DIRECTION, 'desc')
  );
  
  const setSortField = (value: SortField) => {
    setSortFieldState(value);
    saveToStorage(STORAGE_KEYS.SORT_FIELD, value);
  };
  
  const setSortDirection = (value: SortDirection) => {
    setSortDirectionState(value);
    saveToStorage(STORAGE_KEYS.SORT_DIRECTION, value);
  };
  
  // Pagination state (items per page persisted)
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPageState, setItemsPerPageState] = useState<number>(() =>
    loadFromStorage(STORAGE_KEYS.ITEMS_PER_PAGE, 10)
  );
  const itemsPerPage = itemsPerPageState;
  const setItemsPerPage = (value: number) => {
    setItemsPerPageState(value);
    saveToStorage(STORAGE_KEYS.ITEMS_PER_PAGE, value);
  };
  const [totalItems, setTotalItems] = useState(0);
  
  // Transaction detail modal
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  
  // Track if we're handling a direct transaction link
  const isDirectTransactionLink = useRef(false);
  
  // Filter visibility state (persisted to localStorage)
  const [showFiltersState, setShowFiltersState] = useState<boolean>(() =>
    loadFromStorage(STORAGE_KEYS.SHOW_FILTERS, false)
  );
  const showFilters = showFiltersState;
  const setShowFilters = (value: boolean | ((prev: boolean) => boolean)) => {
    setShowFiltersState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value;
      saveToStorage(STORAGE_KEYS.SHOW_FILTERS, newValue);
      return newValue;
    });
  };
  
  // Get txHash from URL parameter
  const { txHash } = params;
  
  
  // Update URL when transaction modal opens/closes (but not when loading from URL)
  useEffect(() => {
    // Don't modify URL if we have a transaction hash from URL (direct link)
    if (txHash) return;
    
    // Don't modify URL if we're currently loading a transaction from a direct link
    if (isLoadingDirectTransaction) return;
    
    if (selectedTransaction && detailModalOpen && !isDirectTransactionLink.current) {
      // Only update URL with transaction hash when modal opens from clicking a transaction in the list
      // Don't update if this is from a direct transaction link
      navigate(`/monitor/${selectedTransaction.safeTxHash}`, { replace: true });
    } else if (!detailModalOpen && selectedTransaction && !isDirectTransactionLink.current) {
      // Remove transaction hash from URL when modal closes from list click
      navigate(`/monitor`, { replace: true });
    }
  }, [detailModalOpen, selectedTransaction, navigate, txHash, isLoadingDirectTransaction]);
  
  // Load transaction by hash from URL parameter
  useEffect(() => {
    // Wait for monitors to load before checking permissions
    if (!txHash || !user || isLoading || isLoadingDirectTransaction || detailModalOpen) {
      return;
    }
    
    // Mark that we're handling a direct transaction link
    isDirectTransactionLink.current = true;
    
    const fetchTransactionByHash = async () => {
      setIsLoadingDirectTransaction(true);
      
      try {
        // Get all transactions and find by hash
        const transactions = await transactionsApi.list();
        const transaction = transactions.find(t => t.safeTxHash === txHash);
        
        if (!transaction) {
          toast({
            title: "Transaction Not Found",
            description: "The requested transaction could not be found or you don't have access to it",
            variant: "destructive",
          });
          return;
        }
        
        // Check if user has access to this transaction (must be monitoring the safe)
        const hasAccess = monitors.some(m => 
          m.safeAddress.toLowerCase() === transaction.safeAddress.toLowerCase() && 
          m.network.toLowerCase() === transaction.network.toLowerCase()
        );
        
        if (!hasAccess) {
          toast({
            title: "Access Denied",
            description: "You don't have permission to view this transaction",
            variant: "destructive",
          });
          return;
        }
        
        // Set the selected transaction and open the modal
        setSelectedTransaction(transaction);
        setDetailModalOpen(true);
      } catch (error) {
        toast({
          title: "Error Loading Transaction",
          description: "An unexpected error occurred while loading the transaction",
          variant: "destructive",
        });
      } finally {
        setIsLoadingDirectTransaction(false);
      }
    };
    
    fetchTransactionByHash();
  }, [txHash, user, toast, isLoading, monitors, isLoadingDirectTransaction, detailModalOpen]);
  
  // Check access to transaction after monitors load
  useEffect(() => {
    if (!selectedTransaction || !monitors.length || !txHash) return;
    
    // Check if user has access to this transaction (must be monitoring the safe)
    const hasAccess = monitors.some(monitor => 
      monitor.safeAddress.toLowerCase() === selectedTransaction.safeAddress.toLowerCase() &&
      monitor.network.toLowerCase() === selectedTransaction.network.toLowerCase()
    );
    
    if (!hasAccess) {
      toast({
        title: "Access Denied",
        description: "You don't have access to this transaction. You must be monitoring this Safe to view its transactions.",
        variant: "destructive",
      });
      setSelectedTransaction(null);
      setDetailModalOpen(false);
      navigate('/monitor', { replace: true });
    }
  }, [selectedTransaction, monitors, txHash, toast, navigate]);
  
  // Fetch full transaction details when clicking on a transaction from the list
  const fetchTransactionDetails = async (transactionId: string) => {
    try {
      // Reset the direct transaction link flag since this is from the list
      isDirectTransactionLink.current = false;
      
      const transaction = await transactionsApi.get(transactionId);
      
      setSelectedTransaction(transaction);
      setDetailModalOpen(true);
    } catch (error) {
      toast({
        title: "Error Loading Transaction Details",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };
  
  // Calculate total pages
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  // Fetch monitors on load
  useEffect(() => {
    async function fetchMonitors() {
      if (!user) {
        setMonitors([]);
        setIsLoading(false);
        return;
      }

      try {
        // First fetch the monitors via Rust API
        const data = await monitorsApi.list();

        if (!data || data.length === 0) {
          setMonitors([]);
          setIsLoading(false);
          return;
        }
        
        setMonitors(data);
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    }

    fetchMonitors();
  }, [user, toast, location]);
  
  // Fetch transactions when filters, sorting, or pagination changes
  useEffect(() => {
    if (!user || monitors.length === 0) {
      setTransactions([]);
      setTotalItems(0);
      setIsLoadingTransactions(false);
      return;
    }
    
    async function fetchTransactions() {
      setIsLoadingTransactions(true);
      
      try {
        // Build query parameters
        const queryParams: any = {};
        
        // Apply safe address filter if selected
        if (filters.safe) {
          const selectedMonitor = monitors.find(m => m.id === filters.safe);
          if (selectedMonitor) {
            queryParams.safeAddress = selectedMonitor.safeAddress;
            queryParams.network = selectedMonitor.network;
          }
        }
        
        // Apply network filter if selected (but not if safe filter already applied)
        if (filters.network && !filters.safe) {
          queryParams.network = filters.network;
        }
        
        // Fetch from API
        let allResults = await transactionsApi.list(queryParams);
        
        // Apply client-side filters
        if (filters.state) {
          if (filters.state === 'executed') {
            allResults = allResults.filter(t => t.isExecuted);
          } else if (filters.state === 'proposed') {
            allResults = allResults.filter(t => !t.isExecuted);
          }
        }
        
        if (filters.securityStatus) {
          allResults = allResults.filter(t => 
            t.securityAnalysis?.riskLevel === filters.securityStatus
          );
        }
        
        const count = allResults.length;
        
        // Calculate total after all filters
        setTotalItems(count);
        
        // Sort the transactions
        allResults.sort((a, b) => {
          let valueA, valueB;
          
          switch (sortField) {
            case 'safe':
              valueA = a.safeAddress.toLowerCase();
              valueB = b.safeAddress.toLowerCase();
              break;
            case 'network':
              valueA = a.network.toLowerCase();
              valueB = b.network.toLowerCase();
              break;
            case 'nonce':
              valueA = a.nonce;
              valueB = b.nonce;
              break;
            case 'type':
              valueA = (a.securityAnalysis?.isSuspicious ? 'suspicious' : 'normal').toLowerCase();
              valueB = (b.securityAnalysis?.isSuspicious ? 'suspicious' : 'normal').toLowerCase();
              break;
            case 'scanned_at':
            default:
              valueA = a.submissionDate ? new Date(a.submissionDate).getTime() : new Date(a.createdAt).getTime();
              valueB = b.submissionDate ? new Date(b.submissionDate).getTime() : new Date(b.createdAt).getTime();
              break;
          }
          
          if (valueA === valueB) {
            return sortDirection === 'asc' 
              ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
              : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          }
          
          if (sortDirection === 'asc') {
            return valueA < valueB ? -1 : 1;
          } else {
            return valueA > valueB ? -1 : 1;
          }
        });
        
        // Apply pagination
        const paginatedTransactions = allResults.slice(
          (currentPage - 1) * itemsPerPage,
          currentPage * itemsPerPage
        );
        
        setTransactions(paginatedTransactions);
      } catch (error) {
        toast({
          title: "Error Loading Transactions",
          description: "There was a problem retrieving transaction data",
          variant: "destructive",
        });
      } finally {
        setIsLoadingTransactions(false);
      }
    }
    
    fetchTransactions();
  }, [user, monitors, filters, sortField, sortDirection, currentPage, itemsPerPage, toast]);

  const toggleMonitor = async (id: string) => {
    const monitor = monitors.find(m => m.id === id);
    if (!monitor) return;
    
    const currentSettings = parseMonitorSettings(monitor.settings);
    const newActiveState = !currentSettings.active;
    
    try {
      const updatedSettings = {
        ...currentSettings,
        active: newActiveState
      };
      const updatedSettingsJson = JSON.stringify(updatedSettings);
      
      // Update locally first for immediate UI feedback
      setMonitors(monitors.map(m => 
        m.id === id ? { ...m, settings: updatedSettingsJson } : m
      ));

      // Then update in the database
      await monitorsApi.update(id, {
        settings: updatedSettings
      });
      
      toast({
        title: newActiveState ? "Monitor Activated" : "Monitor Paused",
        description: newActiveState
          ? `Activated monitoring for ${monitor.safeAddress}` 
          : `Paused monitoring for ${monitor.safeAddress}`,
      });
    } catch (error: any) {
      
      // Revert the local state change on error
      const revertedSettings = {
        ...currentSettings,
        active: !newActiveState
      };
      setMonitors(monitors.map(m => 
        m.id === id ? { ...m, settings: JSON.stringify(revertedSettings) } : m
      ));
      
      toast({
        title: "Error Updating Monitor",
        description: error.message || "Failed to update monitor status",
        variant: "destructive",
      });
    }
  };

  const openDeleteConfirmation = (id: string) => {
    const monitor = monitors.find(m => m.id === id);
    if (!monitor) return;

    setMonitorToDelete(monitor);
    setDeleteConfirmText("");
    setDeleteConfirmModalOpen(true);
  };

  const deleteMonitor = async () => {
    if (!monitorToDelete) return;
    
    try {
      // Update UI first for responsiveness
      setMonitors(monitors.filter(m => m.id !== monitorToDelete.id));
      
      // Close the modal
      setDeleteConfirmModalOpen(false);
      
      // Then delete from database
      await monitorsApi.delete(monitorToDelete.id);
      
      toast({
        title: "Monitor Deleted",
        description: `Successfully removed monitoring for ${monitorToDelete.safeAddress}`,
      });
    } catch (error: any) {
      
      // Restore the monitor in the UI on error
      setMonitors(prev => [...prev, monitorToDelete]);
      
      toast({
        title: "Error Deleting Monitor",
        description: error.message || "Failed to delete monitor",
        variant: "destructive",
      });
    } finally {
      setMonitorToDelete(null);
      setDeleteConfirmText("");
    }
  };

  const formatTimeAgo = (timestamp: number | null) => {
    if (!timestamp) return 'Waiting for first check';
    
    // Use timestamp directly (already in milliseconds since unix epoch)
    const now = Date.now();
    
    // Calculate time difference in milliseconds
    const diffMs = now - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  // Removed downloadCsv function since it's handled in TransactionMonitor.tsx
  
  // Generate Etherscan transaction URL
  const getEtherscanTxUrl = (transaction: Transaction) => {
    let baseUrl;
    
    // Set the correct explorer URL based on network
    switch(transaction.network.toLowerCase()) {
      case 'ethereum':
        baseUrl = 'https://etherscan.io';
        break;
      case 'sepolia':
        baseUrl = 'https://sepolia.etherscan.io';
        break;
      case 'polygon':
        baseUrl = 'https://polygonscan.com';
        break;
      case 'arbitrum':
        baseUrl = 'https://arbiscan.io';
        break;
      case 'optimism':
        baseUrl = 'https://optimistic.etherscan.io';
        break;
      case 'goerli':
        baseUrl = 'https://goerli.etherscan.io';
        break;
      default:
        baseUrl = 'https://etherscan.io';
    }
    
    const txHash = transaction.transactionData?.transactionHash || transaction.safeTxHash;
    return `${baseUrl}/tx/${txHash}`;
  };

  const generateTransactionDescription = (tx: Transaction): string => {
    const valueEth = tx.value ? parseFloat(tx.value) / 1e18 : 0;
    const operation = tx.operation === 1 ? 'DelegateCall' : tx.operation === 2 ? 'Create' : 'Call';
    const executed = tx.isExecuted ? 'Executed' : 'Pending';
    const riskLevel = tx.securityAnalysis?.riskLevel || 'unknown';
    
    let desc = `${operation} to ${tx.toAddress}`;
    if (valueEth > 0) desc += ` - ${valueEth} ETH`;
    desc += ` [${executed}]`;
    if (tx.securityAnalysis?.isSuspicious) desc += ` [RISK: ${riskLevel.toUpperCase()}]`;
    
    return desc;
  };

  const generateDescription = (tx: Transaction) => {
    let description = '';
    
    // Check if we have decoded data with method name (support both camelCase and snake_case)
    const decodedData = tx.transactionData?.dataDecoded || tx.transactionData?.data_decoded;
    if (decodedData?.method) {
      const method = decodedData.method;
      
      // Map of known Safe operations to human-readable names
      const operationNames: { [key: string]: string } = {
        'addOwner': 'addOwner',
        'AddedOwner': 'addOwner',
        'removeOwner': 'removeOwner',
        'RemovedOwner': 'removeOwner',
        'swapOwner': 'swapOwner',
        'addOwnerWithThreshold': 'addOwnerWithThreshold',
        'changeThreshold': 'changeThreshold',
        'ChangedThreshold': 'changeThreshold',
        'enableModule': 'enableModule',
        'EnabledModule': 'enableModule',
        'disableModule': 'disableModule',
        'DisabledModule': 'disableModule',
        'setGuard': 'setGuard',
        'ChangedGuard': 'setGuard',
        'setFallbackHandler': 'setFallbackHandler',
        'ChangedFallbackHandler': 'setFallbackHandler',
        'changeMasterCopy': 'changeMasterCopy',
        'ChangedMasterCopy': 'changeMasterCopy',
        'setup': 'setup',
        'signMessage': 'signMessage',
        'SignMsg': 'signMessage',
        'approveHash': 'approveHash',
        'ApproveHash': 'approveHash',
        'execTransaction': 'execTransaction',
        'ExecutionSuccess': 'execTransaction',
        'ExecutionFailure': 'execTransaction',
        'execTransactionFromModule': 'execTransactionFromModule',
      };
      
      // Use mapped name if available, otherwise use original method
      const methodName = operationNames[method] || method;
      description = `${methodName} operation`;
    } else if (tx.value && tx.value !== '0') {
      // Value transfer
      const ethValue = parseFloat(tx.value) / 1e18;
      description = `Transfer of ${ethValue} ETH`;
    } else {
      // Unknown transaction
      description = 'Unknown transaction';
    }
    
    return description;
  };

  // Map network names to Safe App network identifiers
  const getSafeAppNetwork = (network: string) => {
    const networkMap: { [key: string]: string } = {
      'ethereum': 'eth',
      'sepolia': 'sep',
      'polygon': 'matic',
      'arbitrum': 'arb1',
      'optimism': 'oeth',
      'base': 'base'
    };
    return networkMap[network.toLowerCase()] || network;
  };

  // Get risk level badge with appropriate styling
  const getRiskLevelBadge = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical':
        return (
          <Badge variant="destructive" className="bg-red-600 text-white">
            <ShieldX className="w-3 h-3 mr-1" />
            Critical
          </Badge>
        );
      case 'high':
        return (
          <Badge variant="destructive" className="bg-orange-600 text-white">
            <ShieldAlert className="w-3 h-3 mr-1" />
            High
          </Badge>
        );
      case 'medium':
        return (
          <Badge variant="secondary" className="bg-yellow-500 text-white">
            <Shield className="w-3 h-3 mr-1" />
            Medium
          </Badge>
        );
      case 'low':
      default:
        return (
          <Badge variant="outline" className="border-green-400 text-green-600">
            <ShieldCheck className="w-3 h-3 mr-1" />
            Low
          </Badge>
        );
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        <main className="flex-1 container py-12 flex flex-col items-center justify-center">
          <Card className="w-full max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Sign In Required</CardTitle>
              <CardDescription>
                You need to sign in to view your multisignature wallets
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Please sign in to access your multisignature wallet dashboard.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      
      {/* Delete Confirmation Modal */}
      <Dialog open={deleteConfirmModalOpen} onOpenChange={setDeleteConfirmModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Monitor</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the monitor for {monitorToDelete?.safeAddress || ''}? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter className="mt-4">
            <Button 
              variant="outline" 
              onClick={() => setDeleteConfirmModalOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={deleteMonitor} 
              variant="destructive"
            >
              Delete Monitor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Transaction Details Modal */}
      <Dialog open={detailModalOpen} onOpenChange={(open) => {
        if (!open) {
          // If closing the modal, handle URL cleanup
          if (isDirectTransactionLink.current && txHash) {
            // Direct transaction link - navigate back to /monitor
            isDirectTransactionLink.current = false;
            setSelectedTransaction(null);
            setDetailModalOpen(false);
            navigate('/monitor', { replace: true });
          } else if (!isDirectTransactionLink.current && selectedTransaction) {
            // List transaction - navigate back to /monitor and clear state
            setSelectedTransaction(null);
            setDetailModalOpen(false);
            navigate('/monitor', { replace: true });
          } else {
            setDetailModalOpen(false);
          }
        } else {
          setDetailModalOpen(open);
        }
      }}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto [&>button]:h-7 [&>button]:w-7 [&>button]:p-1.5">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Transaction Details</DialogTitle>
            <DialogDescription className="text-sm mt-1">
              {selectedTransaction && generateDescription(selectedTransaction)}
            </DialogDescription>
          </DialogHeader>
          
          {selectedTransaction && (
            <div className="space-y-6 py-4">
              {/* Quick Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <a 
                  href={`https://app.safe.global/transactions/tx?safe=${getSafeAppNetwork(selectedTransaction.network)}:${selectedTransaction.safeAddress}&id=multisig_${selectedTransaction.safeAddress}_${selectedTransaction.safeTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button size="sm" variant="outline" className="w-full">
                    View in Safe App <ExternalLink className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </a>
                
                {selectedTransaction.isExecuted && (
                  <a 
                    href={getEtherscanTxUrl(selectedTransaction)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <Button size="sm" variant="outline" className="w-full">
                      View on Etherscan <ExternalLink className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </a>
                )}
              </div>

              {/* Security Analysis Section */}
              {selectedTransaction.securityAnalysis && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Security Analysis</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground">Risk Assessment</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Risk Level</h3>
                          {getRiskLevelBadge(selectedTransaction.securityAnalysis.riskLevel)}
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</h3>
                          <Badge variant={selectedTransaction.securityAnalysis.isSuspicious ? "destructive" : "default"}>
                            {selectedTransaction.securityAnalysis.isSuspicious ? 'Suspicious' : 'Normal'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Security Findings */}
                    {selectedTransaction.securityAnalysis?.details && selectedTransaction.securityAnalysis.details.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground">Security Findings</h4>
                        <div className="space-y-3 max-h-[500px] overflow-y-auto">
                          {[...selectedTransaction.securityAnalysis.details]
                            .sort((a: any, b: any) => {
                              const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
                              
                              const aSeverity = severityOrder[a.severity?.toLowerCase()] ?? 999;
                              const bSeverity = severityOrder[b.severity?.toLowerCase()] ?? 999;
                              if (aSeverity !== bSeverity) return aSeverity - bSeverity;
                              
                              const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
                              const aPriority = priorityOrder[a.priority] ?? 999;
                              const bPriority = priorityOrder[b.priority] ?? 999;
                              return aPriority - bPriority;
                            })
                            .map((detail: any, index: number) => (
                            <div key={index} className={`p-3 rounded-lg border-l-4 ${
                              detail.severity === 'critical' ? 'bg-red-50 dark:bg-red-950/30 border-l-red-500 dark:border-l-red-400' :
                              detail.severity === 'high' ? 'bg-orange-50 dark:bg-orange-950/30 border-l-orange-500 dark:border-l-orange-400' :
                              detail.severity === 'medium' ? 'bg-yellow-50 dark:bg-yellow-950/30 border-l-yellow-500 dark:border-l-yellow-400' :
                              detail.severity === 'low' ? 'bg-blue-50 dark:bg-blue-950/30 border-l-blue-500 dark:border-l-blue-400' :
                              'bg-slate-50 dark:bg-slate-950/30 border-l-slate-400 dark:border-l-slate-500'
                            }`}>
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline" className={`text-xs ${
                                    detail.severity === 'critical' ? 'border-red-400 dark:border-red-500 text-red-700 dark:text-red-400' :
                                    detail.severity === 'high' ? 'border-orange-400 dark:border-orange-500 text-orange-700 dark:text-orange-400' :
                                    detail.severity === 'medium' ? 'border-yellow-400 dark:border-yellow-500 text-yellow-700 dark:text-yellow-400' :
                                    detail.severity === 'low' ? 'border-blue-400 dark:border-blue-500 text-blue-700 dark:text-blue-400' :
                                    'border-slate-400 dark:border-slate-500 text-slate-600 dark:text-slate-400'
                                  }`}>
                                    {detail.severity?.toUpperCase()}
                                  </Badge>
                                  {detail.category && (
                                    <Badge variant="secondary" className="text-xs capitalize">
                                      {detail.category}
                                    </Badge>
                                  )}
                                  {detail.priority === 'P0' && (
                                    <Badge variant="destructive" className="text-xs">P0</Badge>
                                  )}
                                </div>
                                <div className="font-medium text-sm">
                                  {detail.title || detail.type?.replace(/_/g, ' ')}
                                </div>
                                <p className="text-sm text-muted-foreground">{detail.message}</p>
                                
                                {/* Additional detail fields */}
                                {(detail.toAddress || detail.trustedName || detail.gasToken || detail.refundReceiver || detail.valueEth) && (
                                  <div className="space-y-1 text-xs text-muted-foreground border-t pt-2 mt-2">
                                    {detail.toAddress && (
                                      <div><span className="font-medium">Target Address:</span> <span className="font-mono">{detail.toAddress}</span></div>
                                    )}
                                    {detail.trustedName && (
                                      <div><span className="font-medium">Contract:</span> {detail.trustedName}</div>
                                    )}
                                    {detail.refundReceiver && detail.refundReceiver !== '0x0000000000000000000000000000000000000000' && (
                                      <div><span className="font-medium">Refund Receiver:</span> <span className="font-mono">{detail.refundReceiver}</span></div>
                                    )}
                                    {detail.valueEth && (
                                      <div><span className="font-medium">Value:</span> {detail.valueEth} ETH</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Transaction Hashes */}
              {selectedTransaction.securityAnalysis?.hashVerification && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Transaction Hashes</CardTitle>
                      <Badge variant={selectedTransaction.securityAnalysis.hashVerification.verified ? "default" : "destructive"}
                        className={selectedTransaction.securityAnalysis.hashVerification.verified ? "bg-green-600 dark:bg-green-700" : ""}>
                        {selectedTransaction.securityAnalysis.hashVerification.verified ? "✓ Verified" : "✗ Mismatch"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1">
                        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Domain Hash</h3>
                        <p className="text-sm font-mono break-all bg-muted/30 p-2 rounded">
                          {selectedTransaction.securityAnalysis.hashVerification.calculatedHashes?.domainHash || "Not calculated"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Message Hash</h3>
                        <p className="text-sm font-mono break-all bg-muted/30 p-2 rounded">
                          {selectedTransaction.securityAnalysis.hashVerification.calculatedHashes?.messageHash || "Not calculated"}
                        </p>
                      </div>
                      
                      {/* Comparison Section */}
                      <div className={`relative border-2 rounded-lg p-4 ${
                        selectedTransaction.securityAnalysis.hashVerification.verified 
                          ? 'border-green-500 dark:border-green-600 bg-green-50 dark:bg-green-950/20' 
                          : 'border-red-500 dark:border-red-600 bg-red-50 dark:bg-red-950/20'
                      }`}>
                        <div className="absolute -top-3 left-4 px-2 bg-background">
                          <span className="text-xs font-semibold uppercase tracking-wide flex items-center gap-1">
                            {selectedTransaction.securityAnalysis.hashVerification.verified ? (
                              <>
                                <ShieldCheck className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                                <span className="text-green-700 dark:text-green-400">Hashes Match</span>
                              </>
                            ) : (
                              <>
                                <ShieldX className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                                <span className="text-red-700 dark:text-red-400">Hashes Mismatch</span>
                              </>
                            )}
                          </span>
                        </div>
                        
                        <div className="space-y-3 mt-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Calculated Hash</h3>
                              {selectedTransaction.securityAnalysis.hashVerification.verified && (
                                <Badge variant="outline" className="text-xs border-green-500 dark:border-green-600 text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-950/40">
                                  ✓
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm font-mono break-all bg-background p-2 rounded border">
                              {selectedTransaction.securityAnalysis.hashVerification.calculatedHashes?.safeTxHash || "Not calculated"}
                            </p>
                          </div>
                          
                          <div className="flex items-center justify-center py-1">
                            <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                              selectedTransaction.securityAnalysis.hashVerification.verified
                                ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400'
                                : 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400'
                            }`}>
                              {selectedTransaction.securityAnalysis.hashVerification.verified ? (
                                <>
                                  <span className="text-xl">↕</span>
                                  <span className="text-xs font-semibold">MATCH</span>
                                </>
                              ) : (
                                <>
                                  <span className="text-xl">≠</span>
                                  <span className="text-xs font-semibold">DIFFERENT</span>
                                </>
                              )}
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">API Response Hash</h3>
                              {selectedTransaction.securityAnalysis.hashVerification.verified && (
                                <Badge variant="outline" className="text-xs border-green-500 dark:border-green-600 text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-950/40">
                                  ✓
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm font-mono break-all bg-background p-2 rounded border">
                              {selectedTransaction.securityAnalysis.hashVerification.apiHashes?.safeTxHash || selectedTransaction.safeTxHash || "Not available"}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {selectedTransaction.securityAnalysis.hashVerification.error && (
                        <div className="space-y-1">
                          <h3 className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wide">Error</h3>
                          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 p-2 rounded border border-red-200 dark:border-red-800">
                            {selectedTransaction.securityAnalysis.hashVerification.error}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Transaction Information */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Transaction Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Safe Address</h3>
                      <p className="text-sm font-mono break-all">
                        <a 
                          href={`https://app.safe.global/home?safe=${getSafeAppNetwork(selectedTransaction.network)}:${selectedTransaction.safeAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-600"
                        >
                          {selectedTransaction.safeAddress}
                        </a>
                      </p>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Network</h3>
                      <p className="text-sm">{selectedTransaction.network.charAt(0).toUpperCase() + selectedTransaction.network.slice(1)}</p>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nonce</h3>
                      <p className="text-sm">{selectedTransaction.nonce}</p>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Execution Status</h3>
                      <Badge variant={selectedTransaction.isExecuted ? "default" : "secondary"} 
                        className={selectedTransaction.isExecuted ? "bg-green-600" : ""}>
                        {selectedTransaction.isExecuted ? 'Executed' : 'Pending'}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">To Address</h3>
                      <p className="text-sm font-mono break-all">
                        {selectedTransaction.toAddress ? (
                          <a 
                            href={`${getEtherscanTxUrl(selectedTransaction).split('/tx/')[0]}/address/${selectedTransaction.toAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-600"
                          >
                            {selectedTransaction.toAddress}
                          </a>
                        ) : "—"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Value</h3>
                      <p className="text-sm">{selectedTransaction.value ? `${parseFloat(selectedTransaction.value) / 1e18} ETH` : '0 ETH'}</p>
                    </div>
                    {selectedTransaction.data && selectedTransaction.data !== "0x" && (
                      <div className="space-y-1 sm:col-span-2">
                        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Data</h3>
                        <p className="text-sm font-mono break-all bg-muted/50 p-2 rounded max-h-32 overflow-y-auto">
                          {selectedTransaction.data}
                        </p>
                      </div>
                    )}
                    {selectedTransaction.operation !== undefined && (
                      <div className="space-y-1">
                        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Operation Type</h3>
                        <div className="flex items-center gap-2">
                          {selectedTransaction.operation === 0 ? (
                            <Badge variant="outline">Call (0)</Badge>
                          ) : selectedTransaction.operation === 1 ? (
                            <Badge variant="destructive">Delegate Call (1)</Badge>
                          ) : selectedTransaction.operation === 2 ? (
                            <Badge variant="secondary">Contract Creation (2)</Badge>
                          ) : (
                            <Badge variant="outline">Unknown</Badge>
                          )}
                        </div>
                      </div>
                    )}
                    {selectedTransaction.submissionDate && (
                      <div className="space-y-1">
                        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Submission Date</h3>
                        <p className="text-sm">{new Date(selectedTransaction.submissionDate).toLocaleString()}</p>
                      </div>
                    )}
                    {selectedTransaction.executionDate && (
                      <div className="space-y-1">
                        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Execution Date</h3>
                        <p className="text-sm">{new Date(selectedTransaction.executionDate).toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Gas Parameters */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Gas Parameters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Safe Tx Gas</h3>
                      <p className={`text-sm ${selectedTransaction.transactionData?.safeTxGas !== "0" ? 'text-orange-600 dark:text-orange-400 font-medium' : 'text-green-600 dark:text-green-400'}`}>
                        {selectedTransaction.transactionData?.safeTxGas || "0"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Base Gas</h3>
                      <p className={`text-sm ${selectedTransaction.transactionData?.baseGas !== "0" ? 'text-orange-600 dark:text-orange-400 font-medium' : 'text-green-600 dark:text-green-400'}`}>
                        {selectedTransaction.transactionData?.baseGas || "0"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Gas Price</h3>
                      <p className={`text-sm ${selectedTransaction.transactionData?.gasPrice !== "0" ? 'text-orange-600 dark:text-orange-400 font-medium' : 'text-green-600 dark:text-green-400'}`}>
                        {selectedTransaction.transactionData?.gasPrice || "0"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Gas Token</h3>
                      <p className={`text-sm font-mono break-all ${selectedTransaction.transactionData?.gasToken !== "0x0000000000000000000000000000000000000000" ? 'text-orange-600 dark:text-orange-400 font-medium' : 'text-green-600 dark:text-green-400'}`}>
                        {selectedTransaction.transactionData?.gasToken === "0x0000000000000000000000000000000000000000" ?
                          "0x0000000000000000000000000000000000000000 (Native)" :
                          selectedTransaction.transactionData?.gasToken || "0x0000000000000000000000000000000000000000"}
                      </p>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Refund Receiver</h3>
                      <p className={`text-sm font-mono break-all ${selectedTransaction.transactionData?.refundReceiver !== "0x0000000000000000000000000000000000000000" ? 'text-orange-600 dark:text-orange-400 font-medium' : 'text-green-600 dark:text-green-400'}`}>
                        {selectedTransaction.transactionData?.refundReceiver === "0x0000000000000000000000000000000000000000" ?
                          "0x0000000000000000000000000000000000000000 (None)" :
                          selectedTransaction.transactionData?.refundReceiver || "0x0000000000000000000000000000000000000000"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Execution Details */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Execution Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Execution Status</h3>
                      <Badge variant={selectedTransaction.isExecuted ? "default" : "secondary"}
                        className={selectedTransaction.isExecuted ? "bg-green-600" : ""}>
                        {selectedTransaction.isExecuted ? 'Executed' : 'Pending'}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Confirmations</h3>
                      <p className="text-sm">
                        {selectedTransaction.transactionData?.confirmations?.length || 0} of {selectedTransaction.transactionData?.confirmationsRequired || "—"} required
                      </p>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Proposer</h3>
                      <p className="text-sm font-mono break-all">
                        {selectedTransaction.transactionData?.proposer ? (
                          <a 
                            href={`${getEtherscanTxUrl(selectedTransaction).split('/tx/')[0]}/address/${selectedTransaction.transactionData.proposer}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-600"
                          >
                            {selectedTransaction.transactionData.proposer}
                          </a>
                        ) : "—"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Execution Transaction Hash</h3>
                      <p className="text-sm font-mono break-all">
                        {selectedTransaction.transactionData?.transactionHash ? (
                          <a 
                            href={getEtherscanTxUrl(selectedTransaction)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-600"
                          >
                            {selectedTransaction.transactionData.transactionHash}
                          </a>
                        ) : "—"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Submission Date</h3>
                      <p className="text-sm">
                        {selectedTransaction.transactionData?.submissionDate ?
                          new Date(selectedTransaction.transactionData.submissionDate).toLocaleString() :
                          "—"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Execution Date</h3>
                      <p className="text-sm">
                        {selectedTransaction.transactionData?.executionDate ?
                          new Date(selectedTransaction.transactionData.executionDate).toLocaleString() :
                          "—"}
                      </p>
                    </div>
                  </div>
                  
                  {/* Confirmations Details */}
                  {selectedTransaction.transactionData?.confirmations &&
                    selectedTransaction.transactionData.confirmations.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground">Signers</h4>
                      <div className="bg-muted/50 rounded-lg p-3 max-h-48 overflow-y-auto">
                        {selectedTransaction.transactionData.confirmations.map((confirmation: any, index: number) => (
                          <div key={index} className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 border-b last:border-0 gap-2">
                            <a 
                              href={`${getEtherscanTxUrl(selectedTransaction).split('/tx/')[0]}/address/${confirmation.owner}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:text-blue-600 font-mono text-sm break-all"
                            >
                              {confirmation.owner}
                            </a>
                            <div className="text-xs text-muted-foreground">
                              {new Date(confirmation.submissionDate).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>


            </div>
          )}
          
          {selectedTransaction && !selectedTransaction.transactionData && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading transaction details...</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      <main className="flex-1 container py-12">
        <div className="flex items-center gap-2 mb-6 text-sm text-muted-foreground">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <Home className="h-4 w-4 mr-1" />
            Dashboard
          </Button>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">Monitored Wallets</span>
        </div>

        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">Monitored Wallets</h1>          
          <div className="flex gap-2">            
            <Button 
              onClick={() => navigate("/monitor/new")}
              className="jsr-button flex items-center gap-2"
            >
              <PlusCircle className="h-5 w-5" />
              Add Wallet
            </Button>
          </div>
        </div>
        
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Card key={i} className="opacity-70 animate-pulse">
                <CardHeader>
                  <div className="h-6 w-3/4 bg-muted rounded mb-2"></div>
                  <div className="h-4 w-1/2 bg-muted rounded"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-4 w-full bg-muted rounded mb-2"></div>
                  <div className="h-4 w-2/3 bg-muted rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : monitors.length > 0 ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {monitors.map(monitor => {
                const settings = parseMonitorSettings(monitor.settings);
                return (
                <Card key={monitor.id} className={settings.active ? "" : "opacity-70"}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-xs font-mono break-all leading-relaxed">{monitor.safeAddress}</CardTitle>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/monitor/config/${monitor.id}`)}>
                            <Settings className="mr-2 h-4 w-4" />
                            <span>Edit Settings</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleMonitor(monitor.id)}>
                            {settings.active ? (
                              <>
                                <ToggleLeft className="mr-2 h-4 w-4" />
                                <span>Pause Monitor</span>
                              </>
                            ) : (
                              <>
                                <ToggleRight className="mr-2 h-4 w-4" />
                                <span>Activate Monitor</span>
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive" 
                            onClick={() => openDeleteConfirmation(monitor.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <CardDescription className="flex items-center gap-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${settings.active ? "bg-jsr-green" : "bg-muted-foreground"}`}></span>
                      {monitor.network.charAt(0).toUpperCase() + monitor.network.slice(1)} • {settings.active ? "Active" : "Paused"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm space-y-1 mb-4">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last checked:</span>
                        <span className="cursor-pointer">
                          {monitor.lastCheckedAt ? formatTimeAgo(new Date(monitor.lastCheckedAt).getTime()) : 'Never'}
                        </span>
                      </div>
                      {/* <div className="flex justify-between">
                        <span className="text-muted-foreground">Alerts:</span>
                        <span className="flex items-center">
                          {(monitor.alertCount || 0) > 0 && (
                            <AlertCircle className="mr-1 h-3.5 w-3.5 text-destructive" />
                          )}
                          {monitor.alertCount || 0}
                        </span>
                      </div> */}
                    </div>
                    
                    <Button 
                      onClick={() => navigate(`/review?address=${monitor.safeAddress}&network=${monitor.network}`)}
                      variant="outline"
                      size="sm"
                      className="w-full flex items-center gap-2"
                    >
                      <Shield className="h-4 w-4" />
                      Security Review
                    </Button>
                  </CardContent>
                </Card>
              );
              })}
            </div>
            
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <CardTitle>Transaction History</CardTitle>
                    <CardDescription>
                      View and manage transactions from your monitored multisignature wallets
                    </CardDescription>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 items-center">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-xs flex items-center gap-1 h-8 px-2"
                      onClick={() => {
                        // Create CSV header
                        const header = ['Safe', 'Network', 'Nonce', 'Transaction', 'State', 'Time', 'Type'].join(',');
                        
                        // Convert transactions to CSV rows
                        const rows = transactions.map(tx => {
                          // Find the monitor that matches this safe address
                          const monitor = monitors.find(m => 
                            m.safeAddress === tx.safeAddress && 
                            m.network === tx.network
                          );
                          const safeName = tx.safeAddress;
                          const txDescription = generateDescription(tx).replace(/,/g, ';'); // Replace commas to avoid CSV issues
                          const executionState = tx.isExecuted ? 'Executed' : 'Proposed';
                          const time = tx.submission_date ? new Date(tx.submission_date).toLocaleString() : new Date(tx.created_at).toLocaleString();
                          return [
                            safeName,
                            tx.network.charAt(0).toUpperCase() + tx.network.slice(1),
                            tx.nonce,
                            txDescription,
                            executionState,
                            time,
                            tx.securityAnalysis?.isSuspicious ? 'suspicious' : 'normal'
                          ].join(',');
                        });
                        
                        // Combine header and rows
                        const csvContent = [header, ...rows].join('\n');
                        
                        // Create a Blob with the CSV content
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        
                        // Create a download link and trigger it
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.setAttribute('download', `safe-transactions-${new Date().toISOString().split('T')[0]}.csv`);
                        document.body.appendChild(link);
                        link.click();
                        
                        // Clean up
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                        
                        toast({
                          title: "CSV Export Complete",
                          description: `${transactions.length} transactions exported successfully`
                        });
                      }}
                    >
                      <FileDown className="h-3 w-3" />
                      CSV Export
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className={`h-8 gap-1 ${
                        Object.values(filters).some(v => v !== null) || showFilters ? 'bg-primary/10' : ''
                      }`}
                      onClick={() => {
                        if (Object.values(filters).some(v => v !== null)) {
                          // If filters are active, reset them
                          setFilters({
                            safe: null,
                            network: null,
                            state: null,
                            securityStatus: null
                          });
                          setCurrentPage(1);
                        } else {
                          // Toggle filter visibility
                          setShowFilters(!showFilters);
                        }
                      }}
                    >
                      <Filter className="h-3.5 w-3.5" />
                      {Object.values(filters).some(v => v !== null) ? 'Reset Filters' : 'Filters'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {showFilters && (
                  <div className="flex flex-wrap gap-3 pb-4">
                    <Select 
                      value={filters.safe || "all"} 
                      onValueChange={(value) => {
                        setFilters(prev => ({ ...prev, safe: value === "all" ? null : value }));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs min-w-[140px] w-fit">
                        <SelectValue placeholder="Filter by Safe" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Wallets</SelectItem>
                        {monitors.map(monitor => (
                          <SelectItem key={monitor.id} value={monitor.id}>
                            {monitor.safeAddress}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select 
                      value={filters.network || "all"} 
                      onValueChange={(value) => {
                        setFilters(prev => ({ ...prev, network: value === "all" ? null : value }));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs min-w-[140px] w-fit">
                        <SelectValue placeholder="Network" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Networks</SelectItem>
                        {Array.from(new Set(monitors.map(m => m.network))).sort().map(network => (
                          <SelectItem key={network} value={network}>
                            {network}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select 
                      value={filters.state || "all"} 
                      onValueChange={(value) => {
                        setFilters(prev => ({ ...prev, state: value === "all" ? null : value }));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs min-w-[140px] w-fit">
                        <SelectValue placeholder="State" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All States</SelectItem>
                        <SelectItem value="executed">Executed</SelectItem>
                        <SelectItem value="proposed">Proposed</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Select 
                      value={filters.securityStatus || "all"} 
                      onValueChange={(value) => {
                        setFilters(prev => ({ ...prev, securityStatus: value === "all" ? null : value }));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs min-w-[160px] w-fit">
                        <SelectValue placeholder="Security Risk" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Security Risks</SelectItem>
                        <SelectItem value="low">No Risk Detected</SelectItem>
                        <SelectItem value="medium">Medium Risk</SelectItem>
                        <SelectItem value="high">High Risk</SelectItem>
                        <SelectItem value="critical">Critical Risk</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                {/* Pagination controls above the table */}
                {totalItems > 0 && (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Showing {transactions.length} of {totalItems} results</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="h-8 px-2"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="flex items-center gap-1 text-sm px-3 py-1 bg-muted rounded-md">
                        <span>{currentPage} of {totalPages}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="h-8 px-2"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Desktop Table View */}
                <div className="hidden lg:block">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead 
                            className="cursor-pointer"
                            onClick={() => {
                              if (sortField === 'safe') {
                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortField('safe');
                                setSortDirection('asc');
                              }
                              setCurrentPage(1);
                            }}
                          >
                            <div className="flex items-center">
                              Wallet
                              {sortField === 'safe' && (
                                sortDirection === 'asc' ? 
                                <ArrowUpAZ className="ml-1 h-3.5 w-3.5" /> : 
                                <ArrowDownAZ className="ml-1 h-3.5 w-3.5" />
                              )}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer"
                            onClick={() => {
                              if (sortField === 'network') {
                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortField('network');
                                setSortDirection('asc');
                              }
                              setCurrentPage(1);
                            }}
                          >
                            <div className="flex items-center">
                              Network
                              {sortField === 'network' && (
                                sortDirection === 'asc' ? 
                                <ArrowUpAZ className="ml-1 h-3.5 w-3.5" /> : 
                                <ArrowDownAZ className="ml-1 h-3.5 w-3.5" />
                              )}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer"
                            onClick={() => {
                              if (sortField === 'nonce') {
                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortField('nonce');
                                setSortDirection('asc');
                              }
                              setCurrentPage(1);
                            }}
                          >
                            <div className="flex items-center">
                              Nonce
                              {sortField === 'nonce' && (
                                sortDirection === 'asc' ? 
                                <SortAsc className="ml-1 h-3.5 w-3.5" /> : 
                                <SortDesc className="ml-1 h-3.5 w-3.5" />
                              )}
                            </div>
                          </TableHead>
                          <TableHead>Tx Hash</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>State</TableHead>
                          <TableHead 
                            className="cursor-pointer"
                            onClick={() => {
                              if (sortField === 'scanned_at') {
                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortField('scanned_at');
                                setSortDirection('asc');
                              }
                              setCurrentPage(1);
                            }}
                          >
                            <div className="flex items-center">
                              Time
                              {sortField === 'scanned_at' && (
                                sortDirection === 'asc' ? 
                                <SortAsc className="ml-1 h-3.5 w-3.5" /> : 
                                <SortDesc className="ml-1 h-3.5 w-3.5" />
                              )}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer"
                            onClick={() => {
                              if (sortField === 'type') {
                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortField('type');
                                setSortDirection('asc');
                              }
                              setCurrentPage(1);
                            }}
                          >
                            <div className="flex items-center">
                              Security Status
                              {sortField === 'type' && (
                                sortDirection === 'asc' ? 
                                <ArrowUpAZ className="ml-1 h-3.5 w-3.5" /> : 
                                <ArrowDownAZ className="ml-1 h-3.5 w-3.5" />
                              )}
                            </div>
                          </TableHead>
                          <TableHead>View</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoadingTransactions ? (
                          <TableRow>
                            <TableCell colSpan={9} className="h-24 text-center">
                              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                            </TableCell>
                          </TableRow>
                        ) : transactions.length > 0 ? (
                          transactions.map((tx) => (
                            <TableRow key={tx.id} className="cursor-pointer hover:bg-muted/50" onClick={() => {
                              fetchTransactionDetails(tx.id);
                            }}>
                              <TableCell className="font-mono text-xs">
                                {tx.safeAddress}
                              </TableCell>
                              <TableCell>{tx.network.charAt(0).toUpperCase() + tx.network.slice(1)}</TableCell>
                              <TableCell>{tx.nonce}</TableCell>
                              <TableCell className="font-mono text-xs max-w-[120px] truncate" title={tx.safeTxHash}>
                                {tx.safeTxHash}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="max-w-xs truncate">
                                    {generateDescription(tx)}
                                  </div>
                                  {(() => {
                                    const significantFindings = tx.securityAnalysis?.details?.filter((d: any) => d.severity !== 'info') || [];
                                    return significantFindings.length > 0 && (
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        {tx.securityAnalysis?.details?.some((d: any) => d.priority === 'P0') && (
                                          <Badge variant="destructive" className="text-xs px-1 py-0 h-5">
                                            P0
                                          </Badge>
                                        )}
                                        <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 border-amber-400 dark:border-amber-500 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30">
                                          {significantFindings.length}
                                        </Badge>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={tx.isExecuted ? "default" : "secondary"} className={tx.isExecuted ? "bg-green-600" : ""}>
                                  {tx.isExecuted ? 'Executed' : 'Proposed'}
                                </Badge>
                              </TableCell>
                              <TableCell>{formatTimeAgo(new Date(tx.submissionDate || tx.executionDate || tx.createdAt).getTime())}</TableCell>
                              <TableCell>
                                {tx.securityAnalysis && getRiskLevelBadge(tx.securityAnalysis.riskLevel)}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1.5">
                                  <a 
                                    href={`https://app.safe.global/transactions/tx?safe=${getSafeAppNetwork(tx.network)}:${tx.safeAddress}&id=multisig_${tx.safeAddress}_${tx.safeTxHash}`} 
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"
                                  >
                                    <Badge variant="secondary" className="cursor-pointer">
                                      Safe
                                    </Badge>
                                  </a>
                                  
                                  {tx.isExecuted && (
                                    <a 
                                      href={getEtherscanTxUrl(tx)} 
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"
                                    >
                                      <Badge variant="secondary" className="cursor-pointer">
                                        Etherscan
                                      </Badge>
                                    </a>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                              No transactions found with the current filters
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden space-y-4">
                  {isLoadingTransactions ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : transactions.length > 0 ? (
                    transactions.map((tx) => (
                      <Card key={tx.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => {
                        fetchTransactionDetails(tx.id);
                      }}>
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            {/* Header with wallet and network */}
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                                <span className="font-mono text-xs break-all">
                                  {tx.safeAddress}
                                </span>
                                <Badge variant="outline" className="text-xs w-fit">
                                  {tx.network.charAt(0).toUpperCase() + tx.network.slice(1)}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                {tx.nonce !== undefined && (
                                  <span className="text-xs text-muted-foreground">#{tx.nonce}</span>
                                )}
                                <Badge variant={tx.isExecuted ? "default" : "secondary"} className={`text-xs ${tx.isExecuted ? "bg-green-600" : ""}`}>
                                  {tx.isExecuted ? 'Executed' : 'Proposed'}
                                </Badge>
                              </div>
                            </div>

                            {/* Transaction description */}
                            <div className="space-y-2">
                              <div className="text-sm text-muted-foreground">
                                {generateDescription(tx)}
                              </div>
                              {(() => {
                                const significantFindings = tx.securityAnalysis?.details?.filter((d: any) => d.severity !== 'info') || [];
                                return significantFindings.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {tx.securityAnalysis?.details?.some((d: any) => d.priority === 'P0') && (
                                      <Badge variant="destructive" className="text-xs">
                                        P0 CRITICAL
                                      </Badge>
                                    )}
                                    {significantFindings.slice(0, 2).map((finding: any, idx: number) => (
                                      <Badge key={idx} variant="outline" className={`text-xs ${
                                        finding.severity === 'critical' ? 'border-red-400 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30' :
                                        finding.severity === 'high' ? 'border-orange-400 text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30' :
                                        finding.severity === 'medium' ? 'border-yellow-400 text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/30' :
                                        'border-blue-400 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30'
                                      }`}>
                                        {finding.title}
                                      </Badge>
                                    ))}
                                    {significantFindings.length > 2 && (
                                      <Badge variant="outline" className="text-xs border-slate-400 text-slate-600 dark:text-slate-400">
                                        +{significantFindings.length - 2} more
                                      </Badge>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>

                            {/* Security status and time */}
                            <div className="flex items-center justify-between">
                              <div>
                                {tx.securityAnalysis && getRiskLevelBadge(tx.securityAnalysis.riskLevel)}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {formatTimeAgo(new Date(tx.submissionDate || tx.executionDate || tx.createdAt).getTime())}
                              </span>
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-2 pt-2">
                              <a 
                                href={`https://app.safe.global/transactions/tx?safe=${getSafeAppNetwork(tx.network)}:${tx.safeAddress}&id=multisig_${tx.safeAddress}_${tx.safeTxHash}`} 
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex-1"
                              >
                                <Button variant="outline" size="sm" className="w-full text-xs">
                                  View in Safe
                                </Button>
                              </a>
                              
                              {tx.isExecuted && (
                                <a 
                                  href={getEtherscanTxUrl(tx)} 
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex-1"
                                >
                                  <Button variant="outline" size="sm" className="w-full text-xs">
                                    Etherscan
                                  </Button>
                                </a>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      No transactions found with the current filters
                    </div>
                  )}
                </div>
                
                {/* Bottom pagination and items per page */}
                {totalItems > 0 && (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Select
                        value={itemsPerPage.toString()}
                        onValueChange={(value) => {
                          setItemsPerPage(parseInt(value));
                          setCurrentPage(1);
                        }}
                      >
                        <SelectTrigger className="h-8 w-[70px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                      <span>per page</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="h-8 px-2"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="flex items-center gap-1 text-sm px-3 py-1 bg-muted rounded-md">
                        <span>{currentPage} of {totalPages}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="h-8 px-2"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No Monitors</CardTitle>
              <CardDescription>
                You haven't set up any Safe monitors yet.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Get started by clicking "Add Wallet" to set up your first multisignature wallet monitor.
              </p>
              <Button onClick={() => navigate("/monitor/new")} className="jsr-button">
                <PlusCircle className="mr-2 h-5 w-5" />
                Add Wallet
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Monitor;
