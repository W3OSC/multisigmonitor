import { Helmet } from 'react-helmet-async'
import { Search as SearchIcon, Shield, AlertCircle, Network, Loader2, AlertTriangle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { AddressInput } from '@/components/AddressInput'
import { useToast } from '@/hooks/use-toast'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function Scan() {
  const [address, setAddress] = useState('')
  const [network, setNetwork] = useState('ethereum')
  const [safeExists, setSafeExists] = useState<boolean | null>(null)
  const [isValidatingSafe, setIsValidatingSafe] = useState(false)
  const navigate = useNavigate()
  const { toast } = useToast()

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

      const response = await fetch(`${safeApiUrl}/api/v1/safes/${safeAddress}/`)
      
      if (response.ok) {
        setSafeExists(true)
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
          description: "Unable to validate Safe existence. Please try again.",
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
    <div className="h-full bg-gradient-to-br from-background via-background to-secondary/20 p-8 overflow-auto">
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
              <label className="text-sm font-medium mb-2 block flex items-center gap-2">
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
            
            <div className="flex gap-3 pt-2">
              <Button 
                onClick={handleScan} 
                disabled={!address || !safeExists}
                className="flex-1 bg-[#8052ff] hover:bg-[#6941d9]"
              >
                <SearchIcon className="h-4 w-4 mr-2" />
                Scan Address
              </Button>
              
              <Button 
                onClick={handleReview}
                disabled={!address || !safeExists}
                variant="outline"
                className="flex-1"
              >
                <Shield className="h-4 w-4 mr-2" />
                Security Review
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
