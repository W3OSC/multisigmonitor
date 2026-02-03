
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, AlertTriangle, Eye, Bell, Code, Server } from "lucide-react";

const About = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 container py-12">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">About multisigmonitor</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Protecting your multisignature wallets with advanced monitoring and security analysis
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="mr-2 h-5 w-5 text-jsr-lime" />
                  Our Mission
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p>
                  multisigmonitor was created to provide enhanced security for Safe.global multisignature 
                  wallets. Our mission is to detect and alert users to suspicious activity before it 
                  becomes a problem, protecting digital assets and providing peace of mind.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="mr-2 h-5 w-5 text-jsr-orange" />
                  Why It Matters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p>
                  Multisig wallets are excellent for security, but they can still be vulnerable to 
                  sophisticated attacks. By monitoring transaction patterns and contract interactions, 
                  we help identify potential risks before they can be executed.
                </p>
              </CardContent>
            </Card>
          </div>
          
          <div>
            <h2 className="text-2xl font-bold mb-6 text-center">How It Works</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <div className="mb-4 bg-jsr-blue/30 rounded-full w-12 h-12 flex items-center justify-center">
                    <Eye className="h-6 w-6 text-jsr-blue" />
                  </div>
                  <CardTitle>Continuous Monitoring</CardTitle>
                  <CardDescription>
                    24/7 monitoring of your multisignature wallets
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Our systems continuously check your monitored multisignature wallets for new pending 
                    transactions and queue items, ensuring you never miss suspicious activity.
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <div className="mb-4 bg-jsr-purple/30 rounded-full w-12 h-12 flex items-center justify-center">
                    <Code className="h-6 w-6 text-jsr-purple" />
                  </div>
                  <CardTitle>Smart Analysis</CardTitle>
                  <CardDescription>
                    Advanced transaction inspection
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    We analyze transaction data using specialized security tools to identify
                    potential risks, unusual patterns, and interactions with suspicious contracts.
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <div className="mb-4 bg-jsr-orange/30 rounded-full w-12 h-12 flex items-center justify-center">
                    <Bell className="h-6 w-6 text-jsr-orange" />
                  </div>
                  <CardTitle>Instant Alerts</CardTitle>
                  <CardDescription>
                    Multi-channel notifications
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Choose how you want to be notified: email, Telegram, Discord, Slack, or 
                    custom webhooks. Get immediate alerts when we detect suspicious activity.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Server className="mr-2 h-5 w-5 text-jsr-pink" />
                Technical Architecture
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                multisigmonitor is built on modern, reliable technology:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>React.js and Tailwind CSS for a responsive, intuitive frontend experience</li>
                <li>Supabase for secure authentication, database storage, and backend functionality</li>
                <li>Safe Global API Kit for interacting with multisignature wallets</li>
                <li>Specialized security tools for transaction analysis and threat detection</li>
                <li>Automated background jobs for continuous monitoring without manual intervention</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
      
      <footer className="border-t py-6 md:py-0">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4 md:h-16">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} multisigmonitor. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default About;
