import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { HeaderWithLoginDialog } from "@/components/Header";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  AlertCircle, 
  ArrowDownAZ,
  ArrowUpAZ,
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
import { supabase } from "@/integrations/supabase/client";

interface Monitor {
  id: string;
  safe_address: string;
  network: string;
  alias?: string;
  active: boolean;
  notify: boolean;
  notificationMethod?: string;
  notificationTarget?: string;
  lastChecked?: number;
  alertCount?: number;
  settings: any;
  created_at: string;
}

interface Transaction {
  id: string;
  safe_address: string;
  network: string;
  scanned_at: string;
  type: 'normal' | 'suspicious';
  description: string;
  transaction_hash: string;
  safeTxHash?: string;
  nonce?: number;
  isExecuted?: boolean;
  executionTxHash?: string;
  submissionDate?: string;
  result: any;
}

interface TransactionFilters {
  safe: string | null;
  network: string | null;
  type: string | null;
  transactionType: string | null;
}

type SortField = 'safe' | 'network' | 'nonce' | 'type' | 'scanned_at';
type SortDirection = 'asc' | 'desc';

const Monitor = () => {
  const navigate = useNavigate();
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
  
  // Filtering state
  const [filters, setFilters] = useState<TransactionFilters>({
    safe: null,
    network: null,
    type: null,
    transactionType: null
  });
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>('scanned_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  
  // Transaction detail modal
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  
  // Get txHash from URL parameter
  const { txHash } = params;
  
  // Update URL when transaction modal opens/closes
  useEffect(() => {
    if (selectedTransaction && detailModalOpen) {
      // Update URL with transaction hash when modal opens
      navigate(`/monitor/${selectedTransaction.transaction_hash}`, { replace: true });
    } else if (!detailModalOpen && txHash) {
      // Remove transaction hash from URL when modal closes
      navigate(`/monitor`, { replace: true });
    }
  }, [detailModalOpen, selectedTransaction, navigate, txHash]);
  
  // Load transaction by hash from URL parameter
  useEffect(() => {
    if (!txHash || !user || monitors.length === 0 || isLoadingDirectTransaction) return;
    
    const fetchTransactionByHash = async () => {
      setIsLoadingDirectTransaction(true);
      
      try {
        // Get the transaction from the database
        const { data, error } = await supabase
          .from('results')
          .select('id, safe_address, network, scanned_at, result')
          .filter('result', 'cs', `{"transaction_hash":"${txHash}"}`)
          .limit(1)
          .single();
        
        if (error) {
          if (error.code === 'PGRST116') { // No rows returned
            toast({
              title: "Transaction Not Found",
              description: "The requested transaction could not be found",
              variant: "destructive",
            });
          } else {
            console.error('Error fetching transaction by hash:', error);
            toast({
              title: "Error Loading Transaction",
              description: error.message,
              variant: "destructive",
            });
          }
          return;
        }
        
        // Format the transaction
        const txData = data.result.transaction_data || {};
        const transaction: Transaction = {
          id: data.id,
          safe_address: data.safe_address,
          network: data.network,
          scanned_at: data.scanned_at,
          type: data.result.type || 'normal',
          description: data.result.description || 'Unknown transaction',
          transaction_hash: data.result.transaction_hash,
          safeTxHash: txData.safeTxHash,
          nonce: txData.nonce !== undefined ? parseInt(txData.nonce) : undefined,
          isExecuted: txData.isExecuted,
          executionTxHash: txData.transactionHash,
          submissionDate: txData.submissionDate,
          result: data.result
        };
        
        // Set the selected transaction and open the modal
        setSelectedTransaction(transaction);
        setDetailModalOpen(true);
      } catch (error) {
        console.error('Unexpected error fetching transaction:', error);
      } finally {
        setIsLoadingDirectTransaction(false);
      }
    };
    
    fetchTransactionByHash();
  }, [txHash, user, monitors, toast, isLoadingDirectTransaction]);
  
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
        // First fetch the monitors
        const { data, error } = await supabase
          .from('monitors')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching monitors:', error);
          toast({
            title: "Error Fetching Monitors",
            description: error.message,
            variant: "destructive",
          });
          return;
        }
        
        // Fetch the latest check time from the last_checks table
        const lastChecksPromises = data.map(monitor => 
          supabase
            .from('last_checks')
            .select('checked_at, unix_timestamp')
            .eq('safe_address', monitor.safe_address)
            .eq('network', monitor.network)
            .single()
        );
        
        const lastChecksResponses = await Promise.all(lastChecksPromises);
        
        // Create a map of the latest check time for each monitor's safe_address+network
        const latestScans = {};
        lastChecksResponses.forEach((response, index) => {
          if (response.error && response.error.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
            console.error('Error fetching last checks:', response.error);
            return;
          }
          
          if (response.data) {
            const monitor = data[index];
            const key = `${monitor.safe_address.toLowerCase()}-${monitor.network.toLowerCase()}`;
            // Store the unix timestamp for more accurate time difference calculation
            latestScans[key] = response.data.unix_timestamp || Date.parse(response.data.checked_at);
          }
        });

        // Get suspicious transaction counts for each address+network pair
        const alertPromises = data.map(monitor =>
          supabase
            .from('results')
            .select('id', { count: 'exact' })
            .eq('safe_address', monitor.safe_address)
            .eq('network', monitor.network)
            .eq('result->type', 'suspicious')
            .not('result->transaction_hash', 'is', null)
        );
        
        const alertResponses = await Promise.all(alertPromises);
        
        // Create a map of alert counts for each address+network pair
        const alertCountMap = {};
        alertResponses.forEach((response, index) => {
          if (response.error) {
            console.error('Error fetching alert counts:', response.error);
            return;
          }
          
          const monitor = data[index];
          const key = `${monitor.safe_address.toLowerCase()}-${monitor.network.toLowerCase()}`;
          alertCountMap[key] = response.count || 0;
        });

        const formattedMonitors = data.map(monitor => {
          const key = `${monitor.safe_address.toLowerCase()}-${monitor.network.toLowerCase()}`;
          return {
            id: monitor.id,
            safe_address: monitor.safe_address,
            network: monitor.network,
            active: monitor.settings?.active !== false, // Default to true if not specified
            notify: monitor.settings?.notify || false,
            settings: monitor.settings || {},
            created_at: monitor.created_at,
            alias: monitor.settings?.alias,
            notificationMethod: monitor.settings?.notificationMethod,
            notificationTarget: monitor.settings?.notificationTarget,
            lastChecked: latestScans[key] || null, // Use actual last checked time or null
            alertCount: alertCountMap[key] || 0 // Real alert count from database
          };
        });

        setMonitors(formattedMonitors);
      } catch (error) {
        console.error('Unexpected error:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchMonitors();
  }, [user, toast]);
  
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
        // Get safe addresses and networks from user's monitors
        const addressNetworkPairs = monitors.map(m => ({
          safe_address: m.safe_address,
          network: m.network
        }));
        
        // Build the query from results table for transactions
        let query = supabase
          .from('results')
          .select('id, safe_address, network, scanned_at, result', { count: 'exact' });
        
        // Apply safe address filter if selected
        if (filters.safe) {
          const selectedMonitor = monitors.find(m => m.id === filters.safe);
          if (selectedMonitor) {
            query = query
              .eq('safe_address', selectedMonitor.safe_address)
              .eq('network', selectedMonitor.network);
          }
        } else {
          // Otherwise filter to only include the user's monitored addresses
          const orConditions = addressNetworkPairs.map(pair => 
            `safe_address.eq.${pair.safe_address},network.eq.${pair.network}`
          ).join(',');
          
          if (orConditions) {
            query = query.or(orConditions);
          }
        }
        
        // Apply network filter if selected
        if (filters.network) {
          query = query.eq('network', filters.network);
        }
        
        // Apply transaction type filter if selected
        if (filters.type) {
          // When filtering by transaction type, we need to use a raw contains query
          // since we're dealing with a JSON field structure
          query = query.filter('result', 'cs', `{"type":"${filters.type}"}`);
        }
        
        // Get all results before we do further client-side filtering/sorting
        const { data: allResults, error, count } = await query;
        
        if (error) {
          console.error('Error fetching transactions:', error);
          throw error;
        }
        
        // Filter for transactions with transaction_hash
        let filteredTransactions = allResults.filter(item => 
          item.result && item.result.transaction_hash
        ).map(item => {
          const txData = item.result.transaction_data || {};
          return {
            id: item.id,
            safe_address: item.safe_address,
            network: item.network,
            scanned_at: item.scanned_at,
            type: item.result.type || 'normal',
            description: item.result.description || 'Unknown transaction',
            transaction_hash: item.result.transaction_hash,
            safeTxHash: txData.safeTxHash,
            nonce: txData.nonce !== undefined ? parseInt(txData.nonce) : undefined,
            isExecuted: txData.isExecuted,
            executionTxHash: txData.transactionHash,
            submissionDate: txData.submissionDate,
            result: item.result
          };
        });
        
        // Apply transaction method/operation filter
        if (filters.transactionType) {
          filteredTransactions = filteredTransactions.filter(tx => {
            const txData = tx.result.transaction_data || {};
            const dataDecoded = txData.dataDecoded || {};
            return dataDecoded.method === filters.transactionType;
          });
        }
        
        // Calculate total after all filters
        setTotalItems(filteredTransactions.length);
        
        // Sort the transactions
        filteredTransactions.sort((a, b) => {
          let valueA, valueB;
          
          switch (sortField) {
            case 'safe':
              valueA = a.safe_address.toLowerCase();
              valueB = b.safe_address.toLowerCase();
              break;
            case 'network':
              valueA = a.network.toLowerCase();
              valueB = b.network.toLowerCase();
              break;
            case 'nonce':
              valueA = a.nonce !== undefined ? a.nonce : Infinity;
              valueB = b.nonce !== undefined ? b.nonce : Infinity;
              break;
            case 'type':
              valueA = a.type.toLowerCase();
              valueB = b.type.toLowerCase();
              break;
            case 'scanned_at':
            default:
              // Use submissionDate if available, fall back to scanned_at
              valueA = a.submissionDate ? new Date(a.submissionDate).getTime() : new Date(a.scanned_at).getTime();
              valueB = b.submissionDate ? new Date(b.submissionDate).getTime() : new Date(b.scanned_at).getTime();
              break;
          }
          
          if (valueA === valueB) {
            // Secondary sort by scanned_at
            return sortDirection === 'asc' 
              ? new Date(a.scanned_at).getTime() - new Date(b.scanned_at).getTime()
              : new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime();
          }
          
          if (sortDirection === 'asc') {
            return valueA < valueB ? -1 : 1;
          } else {
            return valueA > valueB ? -1 : 1;
          }
        });
        
        // Apply pagination
        const paginatedTransactions = filteredTransactions.slice(
          (currentPage - 1) * itemsPerPage,
          currentPage * itemsPerPage
        );
        
        setTransactions(paginatedTransactions);
      } catch (error) {
        console.error('Error processing transactions:', error);
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
    
    const newActiveState = !monitor.active;
    
    try {
      // Update locally first for immediate UI feedback
      setMonitors(monitors.map(m => 
        m.id === id ? { ...m, active: newActiveState } : m
      ));

      // Then update in the database
      const { error } = await supabase
        .from('monitors')
        .update({ 
          settings: {
            ...monitor.settings,
            active: newActiveState
          }
        })
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: newActiveState ? "Monitor Activated" : "Monitor Paused",
        description: newActiveState
          ? `Activated monitoring for ${monitor.alias || monitor.safe_address}` 
          : `Paused monitoring for ${monitor.alias || monitor.safe_address}`,
      });
    } catch (error: any) {
      console.error('Error toggling monitor:', error);
      
      // Revert the local state change on error
      setMonitors(monitors.map(m => 
        m.id === id ? { ...m, active: !newActiveState } : m
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
    
    // Get the confirmation expected text
    const expectedConfirmText = `sudo rm ${monitorToDelete.alias || monitorToDelete.safe_address}`;
    
    // Check if confirmation text matches
    if (deleteConfirmText !== expectedConfirmText) {
      toast({
        title: "Deletion Cancelled",
        description: "The confirmation text is incorrect",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Update UI first for responsiveness
      setMonitors(monitors.filter(m => m.id !== monitorToDelete.id));
      
      // Close the modal
      setDeleteConfirmModalOpen(false);
      
      // Then delete from database
      const { error } = await supabase
        .from('monitors')
        .delete()
        .eq('id', monitorToDelete.id);

      if (error) throw error;
      
      toast({
        title: "Monitor Deleted",
        description: `Successfully removed monitoring for ${monitorToDelete.alias || monitorToDelete.safe_address}`,
      });
    } catch (error: any) {
      console.error('Error deleting monitor:', error);
      
      // Restore the monitor in the UI on error
      setMonitors(prev => [...prev, monitorToDelete]);
      
      toast({
        title: "Error Deleting Monitor",
        description: error.message || "Failed to delete monitor",
        variant: "destructive",
      });
    } finally {
      setMonitorToDelete(null);
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
      case 'sepolia':
        baseUrl = 'https://sepolia.etherscan.io';
        break;
      default:
        baseUrl = 'https://etherscan.io';
    }
    
    return `${baseUrl}/tx/${transaction.executionTxHash || transaction.transaction_hash}`;
  };

  const truncateAddress = (address: string) => {
    const middleStartIndex = Math.floor((address.length - 6) / 2);
    return `${address.substring(0, 6)}...${address.substring(middleStartIndex, middleStartIndex + 6)}...${address.substring(address.length - 6)}`;
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        <HeaderWithLoginDialog />
        
        <main className="flex-1 container py-12 flex flex-col items-center justify-center">
          <Card className="w-full max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Sign In Required</CardTitle>
              <CardDescription>
                You need to sign in to view your monitors
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Please sign in to access your Safe monitoring dashboard.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <HeaderWithLoginDialog />
      
      {/* Delete Confirmation Modal */}
      <Dialog open={deleteConfirmModalOpen} onOpenChange={setDeleteConfirmModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Monitor</DialogTitle>
            <DialogDescription>
              This will permanently delete the monitor for {monitorToDelete?.alias || monitorToDelete?.safe_address}. 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              To confirm deletion, please type:
              <span className="font-mono ml-1 font-bold">
                sudo rm {monitorToDelete?.alias || monitorToDelete?.safe_address}
              </span>
            </p>
            
            <Input
              placeholder="Type confirmation text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="font-mono"
            />
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteConfirmModalOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={deleteMonitor} 
              variant="destructive"
              disabled={deleteConfirmText !== `sudo rm ${monitorToDelete?.alias || monitorToDelete?.safe_address}`}
            >
              Delete Monitor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Transaction Details Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>
              {selectedTransaction?.description}
            </DialogDescription>
          </DialogHeader>
          
          {selectedTransaction && (
            <div className="space-y-6 py-4">
              {/* Basic Transaction Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Safe</h3>
                  <p className="text-sm font-mono">
                    <a 
                      href={`https://app.safe.global/home?safe=${selectedTransaction.network}:${selectedTransaction.safe_address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600"
                    >
                      {selectedTransaction.safe_address}
                    </a>
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Network</h3>
                  <p className="text-sm">{selectedTransaction.network.charAt(0).toUpperCase() + selectedTransaction.network.slice(1)}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">To Address</h3>
                  <p className="text-sm font-mono break-all">
                    {selectedTransaction.result.transaction_data?.to ? (
                      <a 
                        href={`${getEtherscanTxUrl(selectedTransaction).split('/tx/')[0]}/address/${selectedTransaction.result.transaction_data.to}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-600"
                      >
                        {selectedTransaction.result.transaction_data.to}
                      </a>
                    ) : "—"}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Value</h3>
                  <p className="text-sm">
                    {selectedTransaction.result.transaction_data?.value ? 
                      `${parseFloat(selectedTransaction.result.transaction_data.value) / 1e18} ETH` 
                      : "0 ETH"}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Nonce</h3>
                  <p className="text-sm">{selectedTransaction.nonce !== undefined ? selectedTransaction.nonce : '—'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Type</h3>
                  <p className="text-sm flex items-center">
                    {selectedTransaction.type === 'suspicious' ? (
                      <><AlertCircle className="text-destructive h-4 w-4 mr-1" /> Suspicious</>
                    ) : (
                      <>Normal</>
                    )}
                  </p>
                </div>
              </div>
              
              {/* Execution Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium border-b pb-2">Execution Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Execution Status</h3>
                    <p className="text-sm">
                      <Badge variant={selectedTransaction.isExecuted ? "default" : "secondary"} 
                        className={selectedTransaction.isExecuted ? "bg-green-600" : ""}>
                        {selectedTransaction.isExecuted ? 'Executed' : 'Pending'}
                      </Badge>
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Safe Transaction Hash</h3>
                    <p className="text-sm font-mono break-all">
                      {selectedTransaction.result.transaction_data?.safeTxHash ? (
                        <a 
                          href={`https://app.safe.global/transactions/tx?safe=${selectedTransaction.network}:${selectedTransaction.safe_address}&id=multisig_${selectedTransaction.safe_address}_${selectedTransaction.safeTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-600"
                        >
                          {selectedTransaction.result.transaction_data.safeTxHash}
                        </a>
                      ) : "—"}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Execution Transaction Hash</h3>
                    <p className="text-sm font-mono break-all">
                      {selectedTransaction.result.transaction_data?.transactionHash ? (
                        <a 
                          href={getEtherscanTxUrl(selectedTransaction)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-600"
                        >
                          {selectedTransaction.result.transaction_data.transactionHash}
                        </a>
                      ) : "—"}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Submission Date</h3>
                    <p className="text-sm">
                      {selectedTransaction.result.transaction_data?.submissionDate ? 
                        new Date(selectedTransaction.result.transaction_data.submissionDate).toLocaleString() :
                        "—"}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Execution Date</h3>
                    <p className="text-sm">
                      {selectedTransaction.result.transaction_data?.executionDate ? 
                        new Date(selectedTransaction.result.transaction_data.executionDate).toLocaleString() :
                        "—"}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* External Links */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium mb-1">View Transaction</h3>
                <div className="flex flex-wrap gap-2">
                  <a 
                    href={`https://app.safe.global/transactions/tx?safe=${selectedTransaction.network}:${selectedTransaction.safe_address}&id=multisig_${selectedTransaction.safe_address}_${selectedTransaction.safeTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-600 text-sm"
                  >
                    <Button size="sm" variant="outline">
                      View in Safe App <ExternalLink className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </a>
                  
                  {selectedTransaction.isExecuted && (
                    <a 
                      href={getEtherscanTxUrl(selectedTransaction)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-600 text-sm"
                    >
                      <Button size="sm" variant="outline">
                        View on Etherscan <ExternalLink className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      <main className="flex-1 container py-12">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Your Monitors</h1>
          
          <div className="flex gap-2">            
            <Button 
              onClick={() => navigate("/monitor/new")}
              className="jsr-button flex items-center gap-2"
            >
              <PlusCircle className="h-5 w-5" />
              Add Monitor
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
              {monitors.map(monitor => (
                <Card key={monitor.id} className={monitor.active ? "" : "opacity-70"}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="truncate">{monitor.alias || truncateAddress(monitor.safe_address)}</CardTitle>
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
                            {monitor.active ? (
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
                      <span className={`inline-block w-2 h-2 rounded-full ${monitor.active ? "bg-jsr-green" : "bg-muted-foreground"}`}></span>
                      {monitor.network.charAt(0).toUpperCase() + monitor.network.slice(1)} • {monitor.active ? "Active" : "Paused"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Address:</span>
                        <span className="font-mono">{truncateAddress(monitor.safe_address)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Notifications:</span>
                        <span>{monitor.notify ? (monitor.notificationMethod || 'Enabled') : 'Disabled'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last checked:</span>
                        <span>{formatTimeAgo(monitor.lastChecked)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Alerts:</span>
                        <span className="flex items-center">
                          {(monitor.alertCount || 0) > 0 && (
                            <AlertCircle className="mr-1 h-3.5 w-3.5 text-destructive" />
                          )}
                          {monitor.alertCount || 0}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <CardTitle>Transaction History</CardTitle>
                    <CardDescription>
                      View and manage transactions from your monitored Safe vaults
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
                            m.safe_address === tx.safe_address && 
                            m.network === tx.network
                          );
                          const safeName = monitor?.alias || truncateAddress(tx.safe_address);
                          const txDescription = tx.description.replace(/,/g, ';'); // Replace commas to avoid CSV issues
                          const executionState = tx.isExecuted ? 'Executed' : 'Proposed';
                          const time = tx.submissionDate ? new Date(tx.submissionDate).toLocaleString() : new Date(tx.scanned_at).toLocaleString();
                          return [
                            safeName,
                            tx.network.charAt(0).toUpperCase() + tx.network.slice(1),
                            tx.nonce !== undefined ? tx.nonce : '',
                            txDescription,
                            executionState,
                            time,
                            tx.type
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
                        Object.values(filters).some(v => v !== null) ? 'bg-primary/10' : ''
                      }`}
                      onClick={() => {
                        setFilters({
                          safe: null,
                          network: null,
                          type: null,
                          transactionType: null
                        });
                        setCurrentPage(1);
                      }}
                    >
                      <Filter className="h-3.5 w-3.5" />
                      {Object.values(filters).some(v => v !== null) ? 'Reset Filters' : 'Filters'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
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
                      <SelectItem value="all">All Safes</SelectItem>
                      {monitors.map(monitor => (
                        <SelectItem key={monitor.id} value={monitor.id}>
                          {monitor.alias || truncateAddress(monitor.safe_address)}
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
                    value={filters.type || "all"} 
                    onValueChange={(value) => {
                      setFilters(prev => ({ ...prev, type: value === "all" ? null : value }));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs min-w-[140px] w-fit">
                      <SelectValue placeholder="Transaction Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="suspicious">Suspicious</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select 
                    value={filters.transactionType || "all"} 
                    onValueChange={(value) => {
                      setFilters(prev => ({ ...prev, transactionType: value === "all" ? null : value }));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs min-w-[160px] w-fit">
                      <SelectValue placeholder="Transaction Method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      {Array.from(new Set(transactions.map(tx => {
                        const txData = tx.result.transaction_data || {};
                        const dataDecoded = txData.dataDecoded || {};
                        return dataDecoded.method;
                      }).filter(Boolean))).sort().map(method => (
                        <SelectItem key={method} value={method}>
                          {method}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Pagination controls above the table */}
                {totalItems > 0 && (
                  <div className="flex items-center justify-between pb-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Showing {transactions.length} of {totalItems} results</span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                      >
                        First
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="flex items-center gap-1 text-sm px-2">
                        <span>Page {currentPage} of {totalPages}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                      >
                        Last
                      </Button>
                    </div>
                  </div>
                )}
                
                <div>
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
                              Safe
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
                          <TableHead>Transaction</TableHead>
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
                              Type
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
                            <TableCell colSpan={8} className="h-24 text-center">
                              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                            </TableCell>
                          </TableRow>
                        ) : transactions.length > 0 ? (
                          transactions.map((tx) => (
                            <TableRow key={tx.id} className="cursor-pointer hover:bg-muted/50" onClick={() => {
                              setSelectedTransaction(tx);
                              setDetailModalOpen(true);
                            }}>
                              <TableCell className="font-medium">
                                {monitors.find(m => 
                                  m.safe_address === tx.safe_address && 
                                  m.network === tx.network
                                )?.alias || truncateAddress(tx.safe_address)}
                              </TableCell>
                              <TableCell>{tx.network.charAt(0).toUpperCase() + tx.network.slice(1)}</TableCell>
                              <TableCell>{tx.nonce !== undefined ? tx.nonce : '—'}</TableCell>
                              <TableCell>
                                <div className="max-w-xs truncate">
                                  {tx.description}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={tx.isExecuted ? "default" : "secondary"} className={tx.isExecuted ? "bg-green-600" : ""}>
                                  {tx.isExecuted ? 'Executed' : 'Proposed'}
                                </Badge>
                              </TableCell>
                              <TableCell>{formatTimeAgo(tx.submissionDate ? new Date(tx.submissionDate).getTime() : new Date(tx.scanned_at).getTime())}</TableCell>
                              <TableCell>
                                {tx.type === 'suspicious' ? (
                                  <Badge variant="destructive">Suspicious</Badge>
                                ) : (
                                  <Badge variant="outline">Normal</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1.5">
                                  <a 
                                    href={`https://app.safe.global/transactions/tx?safe=${tx.network}:${tx.safe_address}&id=multisig_${tx.safe_address}_${tx.safeTxHash}`} 
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
                            <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                              No transactions found with the current filters
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-4">
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
                  
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                    >
                      First
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-1 text-sm px-2">
                      <span>Page {currentPage} of {totalPages}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      Last
                    </Button>
                  </div>
                </div>
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
                Get started by clicking "Add Monitor" to set up your first Safe vault monitoring.
              </p>
              <Button onClick={() => navigate("/monitor/new")} className="jsr-button">
                <PlusCircle className="mr-2 h-5 w-5" />
                Add Monitor
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Monitor;
