import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/theme-toggle";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Shield, Menu, X, LogIn, LogOut } from "lucide-react";
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
    <header className={cn(
      "sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-sm transition-all duration-300",
      isMenuOpen && isMobile ? "pb-6" : ""
    )}>
      <div className="w-full px-4">
        {/* Top row with logo and hamburger menu */}
        <div className="flex h-16 items-center justify-between">
          <div className="flex-shrink-0">
            <Link 
              to={user ? "/monitor" : "/"} 
              className="flex items-center gap-2 font-bold text-xl"
              onClick={() => setIsMenuOpen(false)}
            >
              <Shield className="h-6 w-6 text-jsr-purple" />
              <span className="jsr-text-gradient">multisigmonitor</span>
            </Link>
          </div>

          {isMobile ? (
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
          ) : (
            <div className="flex items-center justify-end flex-shrink-0">
              <div className="flex items-center gap-6">
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

        {/* Mobile menu content inside the navbar */}
        {isMenuOpen && isMobile && (
          <div className="py-4">
            <nav className="flex flex-col gap-4">
              {user ? (
                <div className="flex justify-center">
                  <UserDropdownMenu />
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsLoginDialogOpen(true);
                    setIsMenuOpen(false);
                  }}
                  className="flex items-center gap-2 justify-center"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Login</span>
                </Button>
              )}
              <div className="flex justify-center">
                <ThemeToggle />
              </div>
            </nav>
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
