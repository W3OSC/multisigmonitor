import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/context/AuthContext";
import { HelmetProvider } from 'react-helmet-async';

import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Scan from "./pages/Scan";
import Review from "./pages/Review";
import Monitor from "./pages/Monitor";
import NewMonitor from "./pages/NewMonitor";
import MonitorConfig from "./pages/MonitorConfig";
import Settings from "./pages/Settings";
import About from "./pages/About";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import LeftSidebar from "./components/LeftSidebar";
import { useLocation } from "react-router-dom";

const queryClient = new QueryClient();

function AppContent() {
  const location = useLocation();
  const showSidebar = !["/", "/login", "/about"].includes(location.pathname);

  return (
    <>
      {showSidebar && <LeftSidebar />}
      <div className={showSidebar ? "ml-20 md:ml-64 transition-all duration-300" : ""}>
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
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
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
