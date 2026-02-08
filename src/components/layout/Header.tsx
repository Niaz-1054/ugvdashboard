import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, User } from 'lucide-react';
import ugvLogo from '@/assets/ugv-logo.png';

export const Header = () => {
  const { profile, role, signOut } = useAuth();

  const getRoleBadgeColor = () => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-700';
      case 'teacher': return 'bg-blue-100 text-blue-700';
      case 'student': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-3">
          <img 
            src={ugvLogo} 
            alt="University of Global Village Logo" 
            className="h-10 w-auto"
          />
          <div>
            <h1 className="text-lg font-semibold text-foreground">UGV Result Analysis & GPA Dashboard</h1>
            <p className="text-xs text-muted-foreground">University of Global Village</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-full">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{profile?.full_name}</span>
            </div>
            <span className={`px-3 py-1 text-xs font-medium rounded-full capitalize ${getRoleBadgeColor()}`}>
              {role}
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={signOut}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  );
};
