import { Link, useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Menu, X, LogIn, Github } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { UserDropdownMenu } from "@/components/UserDropdownMenu";

export function Header() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user } = useAuth();
  const headerRef = useRef<HTMLElement>(null);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isMenuOpen && 
        isMobile && 
        headerRef.current && 
        !headerRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen && isMobile) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isMenuOpen, isMobile]);

  if (user) {
    return null;
  }

  return (
    <header 
      ref={headerRef}
      className={cn(
      "sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-sm transition-all duration-300",
      isMenuOpen && isMobile ? "pb-6" : ""
    )}>
      <div className="w-full px-4">
        <div className="flex h-20 items-center justify-end">
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
            <div className="flex items-center gap-2 justify-end flex-shrink-0">
              {user ? (
                <UserDropdownMenu />
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/login')}
                    className="flex items-center gap-1"
                  >
                    <LogIn className="h-4 w-4" />
                    <span>Login</span>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                  >
                    <a 
                      href="https://github.com/W3OSC/multisigmonitor" 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1"
                    >
                      <Github className="h-4 w-4" />
                      <span>Contribute</span>
                    </a>
                  </Button>
                </>
              )}
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
                    navigate('/login');
                    setIsMenuOpen(false);
                  }}
                  className="flex items-center gap-2 justify-center"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Login</span>
                </Button>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
