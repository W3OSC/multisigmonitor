
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { AddressInput } from "@/components/AddressInput";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react";

const Review = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<null | {
    safe: boolean;
    issues: string[];
  }>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const addressParam = searchParams.get("address");
    if (addressParam) {
      setAddress(addressParam);
      runChecks(addressParam);
    }
  }, [location.search]);

  const runChecks = async (addr: string) => {
    setLoading(true);
    setResults(null);
    
    // Simulate API call to the safe-or-unsafe.py script
    setTimeout(() => {
      // This is mock data, in a real app you would call your API
      const mockResults = {
        safe: Math.random() > 0.3, // Random result for demo purposes
        issues: Math.random() > 0.3 ? [] : [
          "Suspicious transaction pattern detected",
          "Contract interaction with potential high-risk address",
          "Unusual token transfer amount"
        ]
      };
      
      setResults(mockResults);
      setLoading(false);
    }, 2500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runChecks(address);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 container py-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Security Review</h1>
          
          <form onSubmit={handleSubmit} className="space-y-6 mb-8">
            <AddressInput
              value={address}
              onChange={setAddress}
            />
            
            <Button 
              type="submit" 
              disabled={loading || !address.match(/^0x[a-fA-F0-9]{40}$/)}
              className="jsr-button"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                "Run Security Check"
              )}
            </Button>
          </form>
          
          {loading && (
            <Card className="border-jsr-blue/50 bg-jsr-blue/5">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin text-jsr-blue" />
                  Analyzing Safe
                </CardTitle>
                <CardDescription>
                  Running comprehensive security checks on the provided Safe address...
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full animate-pulse bg-jsr-blue" style={{ width: "60%" }}></div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {results && (
            <Card className={results.safe ? "border-jsr-green/50 bg-jsr-green/5" : "border-destructive/50 bg-destructive/5"}>
              <CardHeader>
                <CardTitle className="flex items-center">
                  {results.safe ? (
                    <>
                      <CheckCircle className="mr-2 h-5 w-5 text-jsr-green" />
                      Safe Looks Secure
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="mr-2 h-5 w-5 text-destructive" />
                      Potential Security Issues Detected
                    </>
                  )}
                </CardTitle>
                <CardDescription>
                  {results.safe 
                    ? "Our analysis did not detect any concerning security issues with this Safe."
                    : "We've identified potential security concerns that require your attention."}
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                {!results.safe && results.issues.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-medium">Issues Found:</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {results.issues.map((issue, index) => (
                        <li key={index} className="text-destructive">{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {results.safe && (
                  <p>
                    The analysis checked for common security vulnerabilities, suspicious transaction patterns, 
                    and potential issues. No problems were found at this time.
                  </p>
                )}
              </CardContent>
              
              <CardFooter className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => navigate("/")}
                >
                  Back to Home
                </Button>
                
                <Button
                  className="jsr-button-alt"
                  onClick={() => navigate(`/monitor/new?address=${address}`)}
                >
                  Set Up Monitoring
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default Review;
