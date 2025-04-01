
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AddressInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

export function AddressInput({ 
  value, 
  onChange, 
  placeholder = "Enter Safe address (0x...)", 
  label = "Safe Address" 
}: AddressInputProps) {
  const [isValid, setIsValid] = useState<boolean | null>(null);
  
  // Simple Ethereum address validation
  const validateAddress = (address: string) => {
    if (!address) return null;
    const regex = /^0x[a-fA-F0-9]{40}$/;
    return regex.test(address);
  };

  useEffect(() => {
    if (value) {
      setIsValid(validateAddress(value));
    } else {
      setIsValid(null);
    }
  }, [value]);

  return (
    <div className="space-y-2">
      {label && <Label htmlFor="address">{label}</Label>}
      <div className="relative">
        <Input
          id="address"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`pr-10 ${
            isValid === false
              ? "border-destructive focus-visible:ring-destructive"
              : isValid === true
              ? "border-jsr-green focus-visible:ring-jsr-green"
              : ""
          }`}
        />
        {isValid !== null && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            {isValid ? (
              <svg
                className="w-5 h-5 text-jsr-green"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5 text-destructive"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
        )}
      </div>
      {isValid === false && (
        <p className="text-sm text-destructive">
          Please enter a valid Ethereum address
        </p>
      )}
    </div>
  );
}
