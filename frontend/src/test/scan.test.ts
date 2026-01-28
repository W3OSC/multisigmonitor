import { describe, it, expect } from 'vitest'

export const getSafeApiUrl = (network: string): string | null => {
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

export const isValidEthereumAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

describe('Safe Address Validation', () => {
  it('returns correct API URL for supported networks', () => {
    expect(getSafeApiUrl('ethereum')).toBe('https://safe-transaction-mainnet.safe.global')
    expect(getSafeApiUrl('sepolia')).toBe('https://safe-transaction-sepolia.safe.global')
    expect(getSafeApiUrl('polygon')).toBe('https://safe-transaction-polygon.safe.global')
  })

  it('returns null for unsupported networks', () => {
    expect(getSafeApiUrl('unknown')).toBeNull()
    expect(getSafeApiUrl('')).toBeNull()
  })

  it('validates correct Ethereum addresses', () => {
    expect(isValidEthereumAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0')).toBe(true)
    expect(isValidEthereumAddress('0x0000000000000000000000000000000000000000')).toBe(true)
  })

  it('rejects invalid Ethereum addresses', () => {
    expect(isValidEthereumAddress('0x742d35Cc')).toBe(false)
    expect(isValidEthereumAddress('742d35Cc6634C0532925a3b844Bc9e7595f0bEb0')).toBe(false)
    expect(isValidEthereumAddress('0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG')).toBe(false)
    expect(isValidEthereumAddress('')).toBe(false)
  })
})
