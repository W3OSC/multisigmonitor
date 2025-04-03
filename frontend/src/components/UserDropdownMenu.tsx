import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

export function UserDropdownMenu({ className }: { className?: string }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  
  if (!user) return null;
  
  // Get user's email or fallback to 'User'
  const email = user.email || 'User';
  // Get user's name or fallback to email
  const name = user.user_metadata?.full_name || user.user_metadata?.name || email;
  // Get user's avatar or fallback to first letter of name
  const avatarUrl = user.user_metadata?.avatar_url || null;
  // Get the first letter of the name for the avatar fallback
  const initials = name.charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn("focus:outline-none", className)}>
        <div className="flex items-center gap-2 hover:bg-muted/50 rounded-full px-2 py-1 cursor-pointer">
          <Avatar>
            <AvatarImage src={avatarUrl || undefined} alt={name} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className="font-medium text-sm hidden sm:inline">{name}</span>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="flex flex-col px-2 py-1.5">
          <span className="font-semibold">{name}</span>
          <span className="text-xs text-muted-foreground">{email}</span>
        </div>
        <DropdownMenuItem 
          onClick={() => {
            signOut().then(() => {
              navigate('/');
            });
          }} 
          className="text-destructive focus:text-destructive cursor-pointer"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
