import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/context/AuthContext";
import { HelmetProvider } from 'react-helmet-async';
import { useEffect, useState } from "react";
import { Shield } from "lucide-react";

import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Scan from "./pages/Scan";
import Review from "./pages/Review";
import Monitor from "./pages/Monitor";
import NewMonitor from "./pages/NewMonitor";
import MonitorConfig from "./pages/MonitorConfig";
import Settings from "./pages/Settings";
import Alerts from "./pages/Alerts";
import About from "./pages/About";
import VerifyEmail from "./pages/VerifyEmail";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import LeftSidebar from "./components/LeftSidebar";
import { useLocation } from "react-router-dom";

const queryClient = new QueryClient();

function AppContent() {
  const location = useLocation();
  const showSidebar = !["/", "/login", "/about"].includes(location.pathname);
  const [floatingShields, setFloatingShields] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([]);

  useEffect(() => {
    const shields = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 2,
    }));
    setFloatingShields(shields);
  }, []);

  return (
    <>
      {showSidebar && <LeftSidebar />}
      <div className={showSidebar ? "ml-20 md:ml-64 transition-all duration-300 min-h-screen bg-gradient-to-br from-background via-background to-muted relative" : "min-h-screen bg-gradient-to-br from-background via-background to-muted relative"}>
        <div className="fixed inset-0 w-full h-full z-0" style={{ left: showSidebar ? '5rem' : '0' }}>
          {floatingShields.map((shield) => (
            <div
              key={shield.id}
              className="absolute transition-all duration-300 hover:scale-125 opacity-20 hover:opacity-60 cursor-pointer"
              style={{
                left: `${shield.x}%`,
                top: `${shield.y}%`,
                animation: `float ${3 + shield.delay}s ease-in-out infinite`,
                animationDelay: `${shield.delay}s`,
              }}
            >
              <Shield className="w-8 h-8 text-primary" />
            </div>
          ))}
        </div>
        <div className="relative z-10">
          <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/scan" element={<ProtectedRoute><Scan /></ProtectedRoute>} />
          <Route path="/review" element={<ProtectedRoute><Review /></ProtectedRoute>} />
          <Route path="/monitor/new" element={<ProtectedRoute><NewMonitor /></ProtectedRoute>} />
          <Route path="/monitor/config/:id" element={<ProtectedRoute><MonitorConfig /></ProtectedRoute>} />
          <Route path="/monitor/:txHash" element={<ProtectedRoute><Monitor /></ProtectedRoute>} />
          <Route path="/monitor" element={<ProtectedRoute><Monitor /></ProtectedRoute>} />
          <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
        <style>
          {`
            @keyframes float {
              0%, 100% { transform: translateY(0px) rotate(0deg); }
              50% { transform: translateY(-20px) rotate(180deg); }
            }
          `}
        </style>
      </div>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <AuthProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppContent />
            </BrowserRouter>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </HelmetProvider>
  </QueryClientProvider>
);

export default App;
