export interface NonceResponse {
  nonce: string;
}

export interface VerifyResponse {
  token: string;
  user: {
    id: string;
    email: string;
    username: string;
    ethereum_address?: string;
  };
}

const API_URL = import.meta.env.VITE_API_URL;

export async function getNonce(address: string): Promise<{ message: string; nonce: string }> {
  const response = await fetch(`${API_URL}/auth/ethereum/nonce`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: address.toLowerCase() }),
  });

  if (!response.ok) {
    throw new Error('Failed to get nonce');
  }

  const { nonce } = await response.json();
  
  const domain = import.meta.env.VITE_SIWE_DOMAIN || window.location.host;
  const uri = `${window.location.protocol}//${window.location.host}`;
  const issuedAt = new Date().toISOString();
  
  const message = `${domain} wants you to sign in with your Ethereum account:
${address}

Sign in to Multisig Monitor

URI: ${uri}
Version: 1
Chain ID: 1
Nonce: ${nonce}
Issued At: ${issuedAt}`;

  return { message, nonce };
}

export async function verifySignature(
  message: string,
  signature: string
): Promise<VerifyResponse> {
  const response = await fetch(`${API_URL}/auth/ethereum/verify`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, signature }),
  });

  if (!response.ok) {
    throw new Error('Failed to verify signature');
  }

  return response.json();
}
