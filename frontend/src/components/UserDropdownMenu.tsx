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

  const getDisplayName = () => {
    if (user.username) return user.username;
    if (user.user_metadata?.full_name) return user.user_metadata.full_name;
    if (user.user_metadata?.name) return user.user_metadata.name;
    if (user.email) return user.email.split('@')[0];
    return 'User';
  };

  const getInitials = () => {
    const name = getDisplayName();
    return name.charAt(0).toUpperCase();
  };

  const getAvatarUrl = () => {
    return user.user_metadata?.avatar_url || null;
  };

  const displayName = getDisplayName();
  const initials = getInitials();
  const avatarUrl = getAvatarUrl();
  const email = user.email || '';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn("focus:outline-none", className)}>
        <div className="flex items-center gap-2 hover:bg-muted/50 rounded-full transition-colors">
          <Avatar className="h-8 w-8">
            <AvatarImage src={avatarUrl || undefined} alt={displayName} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="flex flex-col px-2 py-1.5">
          <span className="font-semibold">{displayName}</span>
          {email && <span className="text-xs text-muted-foreground">{email}</span>}
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
