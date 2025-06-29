import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link, useParams } from "react-router-dom";
import { HeaderWithLoginDialog } from "@/components/Header";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertCircle,
  ArrowDownAZ,
  ArrowUpAZ,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileDown,
  Filter,
  Home,
  Loader2,
  SortAsc,
  SortDesc,
  HelpCircle
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Monitor {
  id: string;
  safe_address: string;
  network: string;
  alias?: string;
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

const TransactionMonitor = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { txHash } = useParams();
  
  // State for monitors
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
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
        const { data, error } = await supabase
          .from('monitors')
          .select('id, safe_address, network, settings, created_at')
          .eq('user_id', user.id);

        if (error) {
          console.error('Error fetching monitors:', error);
          toast({
            title: "Error Fetching Monitors",
            description: error.message,
            variant: "destructive",
          });
          return;
        }
        
        const formattedMonitors = data.map(monitor => ({
          id: monitor.id,
          safe_address: monitor.safe_address,
          network: monitor.network,
          alias: monitor.settings?.alias,
          created_at: monitor.created_at
        }));

        setMonitors(formattedMonitors);
      } catch (error) {
        console.error('Unexpected error:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchMonitors();
  }, [user, toast]);

  // Look for a specific transaction hash if provided in URL
  useEffect(() => {
    if (txHash && !isLoading && transactions.length > 0) {
      // Try to find the transaction in already loaded data
      const matchingTx = transactions.find(tx => tx.transaction_hash === txHash);
      if (matchingTx) {
        showTransactionDetails(matchingTx);
      } else {
        // If not found in current page, we need to search for it in database
        fetchTransactionByHash(txHash);
      }
    }
  }, [txHash, transactions, isLoading]);

  // Function to fetch a specific transaction by hash
  const fetchTransactionByHash = async (hash: string) => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('results')
        .select('id, safe_address, network, scanned_at, result')
        .eq('transaction_hash', hash);
      
      if (error) {
        console.error('Error fetching transaction by hash:', error);
        return;
      }
      
      if (data && data.length > 0) {
        // Format the transaction
        const item = data[0];
        const txData = item.result.transaction_data || {};
        const transaction = {
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
        
        // Show the transaction details
        showTransactionDetails(transaction);
      } else {
        toast({
          title: "Transaction Not Found",
          description: `Could not find transaction with hash ${hash}`,
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error('Error searching for transaction:', err);
    }
  };

  // Fetch full transaction details when clicking on a transaction from the list
  const fetchTransactionDetails = async (transactionId: string) => {
    try {
      const { data, error } = await supabase
        .from('results')
        .select('id, safe_address, network, scanned_at, result')
        .eq('id', transactionId)
        .single();
      
      if (error) {
        console.error('Error fetching transaction details:', error);
        return;
      }
      
      // Format the transaction with full detail
      const txData = data.result.transaction_data || {};
      const transaction = {
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
      
      showTransactionDetails(transaction);
    } catch (error) {
      console.error('Error in fetchTransactionDetails:', error);
    }
  };

  // Fetch transactions when filters, sorting, or pagination changes
  useEffect(() => {
    async function fetchTransactions() {
      if (!user || monitors.length === 0) {
        setTransactions([]);
        setTotalItems(0);
        setIsLoadingTransactions(false);
        return;
      }
      
      setIsLoadingTransactions(true);
      
      try {
        // Get safe addresses and networks from user's monitors
        const addressNetworkPairs = monitors.map(m => ({
          safe_address: m.safe_address,
          network: m.network
        }));
        
        // Build the optimized query from results table for transactions (list view)
        let query = supabase
          .from('results')
          .select(`
            id, 
            transaction_hash,
            safe_address, 
            network, 
            nonce,
            description,
            transaction_type,
            is_executed,
            execution_tx_hash,
            submission_date,
            scanned_at
          `, { count: 'exact' });
        
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
          query = query.eq('transaction_type', filters.type);
        }
        
        // Get all results before we do further client-side filtering/sorting
        const { data: allResults, error, count } = await query;
        
        if (error) {
          console.error('Error fetching transactions:', error);
          throw error;
        }
        
        // Filter for transactions with transaction_hash and map to optimized structure
        const filteredTransactions = allResults.filter(item => 
          item.transaction_hash
        ).map(item => {
          return {
            id: item.id,
            safe_address: item.safe_address,
            network: item.network,
            scanned_at: item.scanned_at,
            type: item.transaction_type || 'normal',
            description: item.description || 'Unknown transaction',
            transaction_hash: item.transaction_hash,
            safeTxHash: item.transaction_hash, // Use transaction_hash as safeTxHash
            nonce: item.nonce,
            isExecuted: item.is_executed,
            executionTxHash: item.execution_tx_hash,
            submissionDate: item.submission_date
          };
        });
        
        
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

  // Unique transaction types for filtering - temporarily disabled
  const uniqueTransactionTypes = useMemo(() => {
    // Transaction method filtering requires full JSON data
    // Temporarily disabled for optimized list view
    return [];
  }, [transactions]);
  
  // Unique networks for filtering
  const uniqueNetworks = useMemo(() => {
    return Array.from(new Set(monitors.map(m => m.network))).sort();
  }, [monitors]);

  // Handle sorting change
  const handleSortChange = (field: SortField) => {
    if (field === sortField) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
    // Reset to first page when sorting changes
    setCurrentPage(1);
  };

  // Handle filter changes
  const handleFilterChange = (key: keyof TransactionFilters, value: string | null) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  // Show transaction details and update URL
  const showTransactionDetails = (transaction: Transaction) => {
    // Update the URL to include the transaction hash
    navigate(`/monitor/${transaction.transaction_hash}`, { replace: false });
    setSelectedTransaction(transaction);
    setDetailModalOpen(true);
  };

  // Handle modal close to update URL
  const handleModalClose = (open: boolean) => {
    if (!open) {
      // When closing the modal, revert URL to base transactions URL
      navigate('/monitor', { replace: true });
    }
    setDetailModalOpen(open);
  };

  // Helpers
  const truncateAddress = (address: string) => {
    const middleStartIndex = Math.floor((address.length - 6) / 2);
    return `${address.substring(0, 6)}...${address.substring(middleStartIndex, middleStartIndex + 6)}...${address.substring(address.length - 6)}`;
  };

  const formatTimeAgo = (timestampOrDateString: number | string | null) => {
    if (!timestampOrDateString) return 'Unknown';
    
    // Handle both timestamp (number) and date string formats
    const timestamp = typeof timestampOrDateString === 'number' 
      ? timestampOrDateString 
      : Date.parse(timestampOrDateString);
    
    // Use timestamp directly (in milliseconds since unix epoch)
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

  // Generate Safe transaction URL
  const getSafeTxUrl = (transaction: Transaction) => {
    return `https://app.safe.global/transactions/tx?safe=${getSafeAppNetwork(transaction.network)}:${transaction.safe_address}&id=multisig_${transaction.safe_address}_${transaction.safeTxHash}`;
  };

  // Generate Safe home URL
  const getSafeHomeUrl = (transaction: Transaction) => {
    return `https://app.safe.global/home?safe=${getSafeAppNetwork(transaction.network)}:${transaction.safe_address}`;
  };

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

  // Generate Etherscan address URL
  const getEtherscanAddressUrl = (transaction: Transaction, address: string) => {
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
    
    return `${baseUrl}/address/${address}`;
  };

  // Function to generate and download CSV data
  const downloadCsv = () => {
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
  };

  // Reset all filters
  const resetFilters = () => {
    setFilters({
      safe: null,
      network: null,
      type: null,
      transactionType: null
    });
    setCurrentPage(1);
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
                You need to sign in to view transactions
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
      <HeaderWithLoginDialog />
      
      <main className="flex-1 container py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Transactions</h1>
            <p className="text-muted-foreground mt-1">
              Monitoring transactions from {monitors.length} Safe{monitors.length !== 1 ? 's' : ''}
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => navigate("/monitor")}
              className="flex items-center gap-1"
            >
              <Home className="h-4 w-4" />
              Monitors Dashboard
            </Button>
          </div>
        </div>
        
        {isLoading ? (
          <Card className="mb-8">
            <CardContent className="p-8 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
            </CardContent>
          </Card>
        ) : monitors.length === 0 ? (
          <Card className="mb-8">
            <CardContent className="p-8">
              <div className="text-center">
                <h2 className="text-xl font-semibold">No wallets set up</h2>
                <p className="text-muted-foreground mt-2">
                  You need to add a multisignature wallet to view transactions
                </p>
                <Button 
                  className="mt-4" 
                  onClick={() => navigate("/monitor/new")}
                >
                  Add Wallet
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-8">
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
                    onClick={downloadCsv}
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
                    onClick={resetFilters}
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
                  onValueChange={(value) => handleFilterChange('safe', value === "all" ? null : value)}
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
                  onValueChange={(value) => handleFilterChange('network', value === "all" ? null : value)}
                >
                  <SelectTrigger className="h-8 text-xs min-w-[140px] w-fit">
                    <SelectValue placeholder="Network" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Networks</SelectItem>
                    {uniqueNetworks.map(network => (
                      <SelectItem key={network} value={network}>
                        {network}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select 
                  value={filters.type || "all"} 
                  onValueChange={(value) => handleFilterChange('type', value === "all" ? null : value)}
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
                  onValueChange={(value) => handleFilterChange('transactionType', value === "all" ? null : value)}
                >
                  <SelectTrigger className="h-8 text-xs min-w-[160px] w-fit">
                    <SelectValue placeholder="Transaction Method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    {uniqueTransactionTypes.map(method => (
                      <SelectItem key={method} value={method}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Pagination controls below filter buttons */}
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
                          onClick={() => handleSortChange('safe')}
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
                          onClick={() => handleSortChange('network')}
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
                          onClick={() => handleSortChange('nonce')}
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
                          onClick={() => handleSortChange('scanned_at')}
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
                          onClick={() => handleSortChange('type')}
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
                          <TableCell colSpan={7} className="h-24 text-center">
                            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                          </TableCell>
                        </TableRow>
                      ) : transactions.length > 0 ? (
                        transactions.map((tx) => (
                          <TableRow key={tx.id} className="cursor-pointer hover:bg-muted/50" onClick={() => fetchTransactionDetails(tx.id)}>
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
                            <TableCell>{formatTimeAgo(tx.submissionDate || tx.scanned_at)}</TableCell>
                            <TableCell>
                              {tx.type === 'suspicious' ? (
                                <Badge variant="destructive">Suspicious</Badge>
                              ) : (
                                <Badge variant="outline">Normal</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1.5">
                                <Link 
                                  to={getSafeTxUrl(tx)} 
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"
                                >
                                  <Badge variant="secondary" className="cursor-pointer">
                                    Safe
                                  </Badge>
                                </Link>
                                
                                {tx.isExecuted && (
                                  <Link 
                                    to={getEtherscanTxUrl(tx)} 
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"
                                  >
                                    <Badge variant="secondary" className="cursor-pointer">
                                      Etherscan
                                    </Badge>
                                  </Link>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
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
        )}
      </main>
      
      {/* Transaction Details Modal */}
      <Dialog open={detailModalOpen} onOpenChange={handleModalClose}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>
              {selectedTransaction?.description}
            </DialogDescription>
          </DialogHeader>
          
          {selectedTransaction && selectedTransaction.result && selectedTransaction.result.transaction_data && (
            <div className="space-y-6 py-4">
              {/* Basic Transaction Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Safe</h3>
                  <p className="text-sm font-mono">
                    <Link 
                      to={getSafeHomeUrl(selectedTransaction)} 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600"
                    >
                      {selectedTransaction.safe_address}
                    </Link>
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
                      <Link 
                        to={getEtherscanAddressUrl(selectedTransaction, selectedTransaction.result.transaction_data.to)} 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-600"
                      >
                        {selectedTransaction.result.transaction_data.to}
                      </Link>
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
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Trusted</h3>
                  <p className="text-sm flex items-center">
                    {selectedTransaction.result.transaction_data?.trusted ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1">
                              <Badge variant="default">Yes</Badge>
                              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="right" align="start" className="z-50">
                            <p className="max-w-xs text-xs">Indexed, added by a delegate, or with at least one confirmation.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <Badge variant="outline">No</Badge>
                    )}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Operation</h3>
                  <p className="text-sm">
                    {selectedTransaction.result.transaction_data?.operation === 0 ? "Call (0)" : 
                     selectedTransaction.result.transaction_data?.operation === 1 ? "Delegate Call (1)" : 
                     selectedTransaction.result.transaction_data?.operation === 2 ? "Contract Creation (2)" : 
                     selectedTransaction.result.transaction_data?.operation || "—"}
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
                        <Link 
                          to={getSafeTxUrl(selectedTransaction)} 
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-600"
                        >
                          {selectedTransaction.result.transaction_data.safeTxHash}
                        </Link>
                      ) : "—"}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Execution Transaction Hash</h3>
                    <p className="text-sm font-mono break-all">
                      {selectedTransaction.result.transaction_data?.transactionHash ? (
                        <Link 
                          to={getEtherscanTxUrl(selectedTransaction)} 
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-600"
                        >
                          {selectedTransaction.result.transaction_data.transactionHash}
                        </Link>
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
              
              {/* Confirmations */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium border-b pb-2">Confirmation Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Confirmations</h3>
                    <p className="text-sm">
                      {selectedTransaction.result.transaction_data?.confirmations?.length || 0} of {selectedTransaction.result.transaction_data?.confirmationsRequired || "—"} required
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Proposer</h3>
                    <p className="text-sm font-mono break-all">
                      {selectedTransaction.result.transaction_data?.proposer ? (
                        <Link 
                          to={getEtherscanAddressUrl(selectedTransaction, selectedTransaction.result.transaction_data.proposer)} 
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-600"
                        >
                          {selectedTransaction.result.transaction_data.proposer}
                        </Link>
                      ) : "—"}
                    </p>
                  </div>
                </div>
                
                {selectedTransaction.result.transaction_data?.confirmations && 
                 selectedTransaction.result.transaction_data.confirmations.length > 0 && (
                  <div className="mt-2">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Signers</h4>
                    <div className="bg-muted rounded-md p-2 max-h-[150px] overflow-y-auto">
                      {selectedTransaction.result.transaction_data.confirmations.map((confirmation: any, index: number) => (
                        <div key={index} className="text-xs py-1 flex justify-between border-b last:border-0">
                          <span className="font-mono">{confirmation.owner}</span>
                          <span>{new Date(confirmation.submissionDate).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Gas Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium border-b pb-2">Gas Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Gas Used</h3>
                    <p className="text-sm">
                      {selectedTransaction.result.transaction_data?.gasUsed || "—"}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Gas Price</h3>
                    <p className="text-sm">
                      {selectedTransaction.result.transaction_data?.gasPrice ? 
                        selectedTransaction.result.transaction_data.gasPrice :
                        selectedTransaction.result.transaction_data?.ethGasPrice ? 
                        `${parseInt(selectedTransaction.result.transaction_data.ethGasPrice) / 1e9} Gwei` :
                        "—"}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Gas Token</h3>
                    <p className="text-sm">
                      {selectedTransaction.result.transaction_data?.gasToken === "0x0000000000000000000000000000000000000000" ? 
                        "Native Token" :
                        selectedTransaction.result.transaction_data?.gasToken || "—"}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Max Fee Per Gas</h3>
                    <p className="text-sm">
                      {selectedTransaction.result.transaction_data?.maxFeePerGas ? 
                        `${parseInt(selectedTransaction.result.transaction_data.maxFeePerGas) / 1e9} Gwei` :
                        "—"}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Max Priority Fee</h3>
                    <p className="text-sm">
                      {selectedTransaction.result.transaction_data?.maxPriorityFeePerGas ? 
                        `${parseInt(selectedTransaction.result.transaction_data.maxPriorityFeePerGas) / 1e9} Gwei` :
                        "—"}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* External Links */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium mb-1">View Transaction</h3>
                <div className="flex flex-wrap gap-2">
                  <Link 
                    to={getSafeTxUrl(selectedTransaction)} 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-600 text-sm"
                  >
                    <Button size="sm" variant="outline">
                      View in Safe App <ExternalLink className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </Link>
                  
                  {selectedTransaction.isExecuted && (
                    <Link 
                      to={getEtherscanTxUrl(selectedTransaction)} 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-600 text-sm"
                    >
                      <Button size="sm" variant="outline">
                        View on Etherscan <ExternalLink className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
              
              {/* Raw Transaction Data Section */}
              <div className="space-y-2 pt-2">
                <div className="flex flex-wrap justify-between items-center border-b pb-2">
                  <h3 className="text-sm font-medium">Raw Transaction Data</h3>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="whitespace-normal text-xs px-2 py-1 h-auto min-h-[28px]"
                    onClick={() => {
                      // Toggle showing the raw data
                      const dataEl = document.getElementById('raw-transaction-data');
                      if (dataEl) {
                        const isHidden = dataEl.classList.contains('hidden');
                        if (isHidden) {
                          dataEl.classList.remove('hidden');
                        } else {
                          dataEl.classList.add('hidden');
                        }
                      }
                    }}
                  >
                    View Raw Transaction Data
                  </Button>
                </div>
                <pre id="raw-transaction-data" className="hidden bg-muted p-4 rounded-md text-xs overflow-auto max-h-[300px]">
                  {JSON.stringify(selectedTransaction.result.transaction_data, null, 2)}
                </pre>
              </div>
            </div>
          )}
          
          {selectedTransaction && (!selectedTransaction.result || !selectedTransaction.result.transaction_data) && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading transaction details...</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TransactionMonitor;
