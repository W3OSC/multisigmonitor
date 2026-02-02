import { Helmet } from 'react-helmet-async'
import { Search as SearchIcon, Shield, AlertCircle, Network, Loader2, AlertTriangle, Clock, ExternalLink, Trash2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { AddressInput } from '@/components/AddressInput'
import { useToast } from '@/hooks/use-toast'
import { securityApi, SecurityAnalysisResult } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export default function Scan() {
  const [address, setAddress] = useState('')
  const [network, setNetwork] = useState('ethereum')
  const [safeExists, setSafeExists] = useState<boolean | null>(null)
  const [isValidatingSafe, setIsValidatingSafe] = useState(false)
  const [pastScans, setPastScans] = useState<SecurityAnalysisResult[]>([])
  const [loadingScans, setLoadingScans] = useState(false)
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [isClearingScans, setIsClearingScans] = useState(false)
  const navigate = useNavigate()
  const { toast } = useToast()
  const { isAuthenticated } = useAuth()

  const getSafeApiUrl = (network: string): string | null => {
    const apiUrls: { [key: string]: string } = {
      'ethereum': 'https://safe-transaction-mainnet.safe.global',
      'sepolia': 'https://safe-transaction-sepolia.safe.global',
      'polygon': 'https://safe-transaction-polygon.safe.global',
      'arbitrum': 'https://safe-transaction-arbitrum.safe.global',
      'optimism': 'https://safe-transaction-optimism.safe.global',
      'base': 'https://safe-transaction-base.safe.global'
    }
    
    return apiUrls[network.toLowerCase()] || null
  }

  useEffect(() => {
    if (address && address.match(/^0x[a-fA-F0-9]{40}$/) && network) {
      validateSafeExists(address, network)
    } else {
      setSafeExists(null)
    }
  }, [address, network])

  useEffect(() => {
    if (isAuthenticated) {
      loadPastScans()
    }
  }, [isAuthenticated])

  const loadPastScans = async () => {
    setLoadingScans(true)
    try {
      const analyses = await securityApi.listAnalyses()
      const formattedScans = analyses
        .filter(a => a.assessment)
        .map(analysis => ({
          id: analysis.id,
          safeAddress: analysis.safe_address || analysis.safeAddress,
          network: analysis.network,
          analyzedAt: analysis.analyzed_at || analysis.analyzedAt,
          isSuspicious: analysis.is_suspicious,
          riskLevel: analysis.risk_level || analysis.riskLevel,
        }))
      setPastScans(formattedScans.slice(0, 10))
    } catch (error) {
      console.error('Failed to load past scans:', error)
      setPastScans([])
    } finally {
      setLoadingScans(false)
    }
  }

  const handleClearAllScans = async () => {
    setIsClearingScans(true)
    try {
      await securityApi.deleteAllAnalyses()
      setPastScans([])
      setShowClearDialog(false)
      toast({
        title: 'Success',
        description: 'All scan history has been cleared',
      })
    } catch (error) {
      console.error('Failed to clear scans:', error)
      toast({
        title: 'Error',
        description: 'Failed to clear scan history',
        variant: 'destructive',
      })
    } finally {
      setIsClearingScans(false)
    }
  }

  const validateSafeExists = async (safeAddress: string, selectedNetwork: string) => {
    setIsValidatingSafe(true)
    setSafeExists(null)

    try {
      const safeApiUrl = getSafeApiUrl(selectedNetwork)
      if (!safeApiUrl) {
        setSafeExists(false)
        toast({
          title: "Unsupported Network",
          description: "This network is not supported for Safe validation",
          variant: "destructive",
        })
        return
      }

      const response = await fetch(`${safeApiUrl}/api/v1/safes/${safeAddress}/`, {
        redirect: 'follow',
        headers: {
          'Accept': 'application/json',
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.address) {
          setSafeExists(true)
        } else {
          setSafeExists(false)
          toast({
            title: "Validation Error",
            description: "Unexpected response from Safe API",
            variant: "destructive",
          })
        }
      } else if (response.status === 404) {
        setSafeExists(false)
        toast({
          title: "Safe Not Found",
          description: "No Safe wallet found at this address on the selected network",
          variant: "destructive",
        })
      } else {
        setSafeExists(false)
        toast({
          title: "Validation Error",
          description: `Unable to validate Safe existence (HTTP ${response.status})`,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error validating Safe:', error)
      setSafeExists(false)
      toast({
        title: "Network Error",
        description: "Unable to connect to Safe API for validation",
        variant: "destructive",
      })
    } finally {
      setIsValidatingSafe(false)
    }
  }

  const validateInputs = () => {
    if (!address) {
      toast({
        title: "Address Required",
        description: "Please enter a Safe address",
        variant: "destructive",
      })
      return false
    }
    
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      toast({
        title: "Invalid Address",
        description: "Please enter a valid Ethereum address",
        variant: "destructive",
      })
      return false
    }
    
    return true
  }

  const handleReview = () => {
    if (!validateInputs()) return
    navigate(`/review?address=${address}&network=${network}`)
  }

  const handleScan = () => {
    if (!validateInputs()) return
    toast({
      title: "Scan Complete",
      description: "Address validation successful",
    })
  }

  return (
    <div className="p-8">
      <Helmet>
        <title>Scan - Multisig Monitor</title>
        <meta name="description" content="Scan addresses to check if they are multisig wallets." />
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 animate-slide-down">
          <h1 className="text-4xl font-bold text-foreground mb-2">Scan Address</h1>
          <p className="text-muted-foreground">
            Analyze any Safe multisig address for security insights
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-8 animate-slide-up">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 flex items-center gap-2">
                <Network className="h-4 w-4" />
                Network
              </label>
              <Select value={network} onValueChange={setNetwork}>
                <SelectTrigger>
                  <SelectValue placeholder="Select network" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ethereum">Ethereum Mainnet</SelectItem>
                  <SelectItem value="sepolia">Sepolia Testnet</SelectItem>
                  <SelectItem value="polygon">Polygon</SelectItem>
                  <SelectItem value="arbitrum">Arbitrum</SelectItem>
                  <SelectItem value="optimism">Optimism</SelectItem>
                  <SelectItem value="base">Base</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Safe Address</label>
              <AddressInput 
                value={address} 
                onChange={setAddress}
                placeholder="Enter Safe address (0x...)"
              />
              {isValidatingSafe && (
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Validating Safe...</span>
                </div>
              )}
              {!isValidatingSafe && safeExists === false && address.match(/^0x[a-fA-F0-9]{40}$/) && (
                <div className="flex items-center gap-2 mt-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Not a Safe wallet on {network}</span>
                </div>
              )}
              {!isValidatingSafe && safeExists === true && (
                <div className="flex items-center gap-2 mt-2 text-sm text-green-500">
                  <Shield className="h-4 w-4" />
                  <span>Valid Safe wallet found</span>
                </div>
              )}
            </div>
            
            <Button 
              onClick={handleReview}
              disabled={!address || !safeExists}
              className="w-full bg-[#8052ff] hover:bg-[#6941d9] mt-2"
            >
              <Shield className="h-4 w-4 mr-2" />
              Security Review
            </Button>
          </div>
        </div>

        {isAuthenticated && (
          <div className="mt-8 animate-slide-up" style={{ animationDelay: '100ms' }}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Recent Scans
                  </CardTitle>
                  {pastScans.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowClearDialog(true)}
                      disabled={isClearingScans}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear All
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loadingScans ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : pastScans.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Shield className="h-12 w-12 text-muted-foreground/50 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      No scans yet
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      Perform a security review to see your scan history here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pastScans.map((scan) => (
                      <div
                        key={scan.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/review?address=${scan.safeAddress}&network=${scan.network}&analysisId=${scan.id}`)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-sm truncate">
                              {scan.safeAddress.slice(0, 6)}...{scan.safeAddress.slice(-4)}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {scan.network}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(scan.analyzedAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge 
                            variant={scan.isSuspicious ? 'destructive' : 'default'}
                            className="capitalize"
                          >
                            {scan.riskLevel}
                          </Badge>
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Scan History?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all your past security scans. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearingScans}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAllScans}
              disabled={isClearingScans}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isClearingScans ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Clearing...
                </>
              ) : (
                'Clear All'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
