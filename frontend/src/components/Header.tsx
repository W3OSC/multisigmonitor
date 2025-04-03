import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/theme-toggle";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Shield, Menu, X, LogIn } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { LoginDialog } from "@/components/LoginDialog";
import { UserDropdownMenu } from "@/components/UserDropdownMenu";

export function Header() {
  const isMobile = useIsMobile();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, isLoginDialogOpen, setIsLoginDialogOpen, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-sm">
      <div className="w-full px-4 flex h-16 items-center justify-between">
        <div className="flex-shrink-0">
          <Link 
            to="/" 
            className="flex items-center gap-2 font-bold text-xl"
            onClick={() => setIsMenuOpen(false)}
          >
            <Shield className="h-6 w-6 text-jsr-purple" />
            <span className="jsr-text-gradient">SafeWatch</span>
          </Link>
        </div>

        {isMobile ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>

            <div
              className={cn(
                "fixed inset-0 top-16 z-50 grid h-[calc(100vh-4rem)] grid-flow-row auto-rows-max overflow-auto bg-background/95 p-6 backdrop-blur-sm transition-all duration-300",
                isMenuOpen ? "translate-y-0" : "-translate-y-full"
              )}
            >
              <nav className="flex flex-col gap-4">
                <Link 
                  to="/monitor" 
                  className="flex items-center px-4 py-2 text-lg font-medium hover:text-primary"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Dashboard
                </Link>
                {user ? (
                  <div className="px-4 py-2">
                    <UserDropdownMenu />
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsLoginDialogOpen(true)}
                    className="flex items-center gap-1 mx-4"
                  >
                    <LogIn className="h-4 w-4" />
                    <span>Login</span>
                  </Button>
                )}
                <ThemeToggle />
              </nav>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-end flex-shrink-0">
            <div className="flex items-center gap-6">
              <Link to="/monitor" className="hover:text-primary text-sm font-medium">
                Dashboard
              </Link>
              <Link to="/about" className="hover:text-primary">
                About
              </Link>
              <div className="flex items-center gap-4">
                {user ? (
                  <UserDropdownMenu />
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsLoginDialogOpen(true)}
                    className="flex items-center gap-1"
                  >
                    <LogIn className="h-4 w-4" />
                    <span>Login</span>
                  </Button>
                )}
                <ThemeToggle />
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

// Rendering the login dialog outside the main component to avoid nesting issues
export function HeaderWithLoginDialog() {
  const { isLoginDialogOpen, setIsLoginDialogOpen } = useAuth();
  
  return (
    <>
      <Header />
      <LoginDialog 
        isOpen={isLoginDialogOpen} 
        onClose={() => setIsLoginDialogOpen(false)} 
      />
    </>
  );
}
