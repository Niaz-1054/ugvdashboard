import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Users, Trash2, GraduationCap, BookOpen, Shield } from 'lucide-react';

interface User {
  id: string;
  full_name: string;
  email: string;
  student_id: string | null;
  user_roles?: { role: string }[];
}

interface UserManagementPanelProps {
  users: User[];
  onDeleteUser: (userId: string) => void;
}

type RoleFilter = 'all' | 'student' | 'teacher' | 'admin';

const getRoleIcon = (role: string) => {
  switch (role) {
    case 'student': return <GraduationCap className="h-3.5 w-3.5" />;
    case 'teacher': return <BookOpen className="h-3.5 w-3.5" />;
    case 'admin': return <Shield className="h-3.5 w-3.5" />;
    default: return null;
  }
};

const getRoleBadgeVariant = (role: string): "default" | "secondary" | "outline" => {
  switch (role) {
    case 'admin': return 'default';
    case 'teacher': return 'secondary';
    default: return 'outline';
  }
};

export function UserManagementPanel({ users, onDeleteUser }: UserManagementPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  // Filter users based on search and role
  const filteredUsers = useMemo(() => {
    let result = users;

    // Role filter
    if (roleFilter !== 'all') {
      result = result.filter(user => 
        user.user_roles?.some(r => r.role === roleFilter)
      );
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(user =>
        user.full_name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        (user.student_id && user.student_id.toLowerCase().includes(query))
      );
    }

    return result;
  }, [users, searchQuery, roleFilter]);

  // Count by role
  const roleCounts = useMemo(() => {
    const counts = { all: users.length, student: 0, teacher: 0, admin: 0 };
    users.forEach(user => {
      const role = user.user_roles?.[0]?.role;
      if (role === 'student') counts.student++;
      else if (role === 'teacher') counts.teacher++;
      else if (role === 'admin') counts.admin++;
    });
    return counts;
  }, [users]);

  return (
    <Card className="bg-card border-border/50">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            All Users
            <Badge variant="secondary" className="ml-2 text-xs">
              {filteredUsers.length} of {users.length}
            </Badge>
          </CardTitle>
          
          {/* Filters */}
          <div className="flex items-center gap-2">
            {/* Role Filter */}
            <Select value={roleFilter} onValueChange={(v: RoleFilter) => setRoleFilter(v)}>
              <SelectTrigger className="w-[140px] h-9 bg-background">
                <SelectValue placeholder="Filter role" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">
                  All Roles ({roleCounts.all})
                </SelectItem>
                <SelectItem value="student">
                  <span className="flex items-center gap-2">
                    <GraduationCap className="h-3.5 w-3.5" />
                    Students ({roleCounts.student})
                  </span>
                </SelectItem>
                <SelectItem value="teacher">
                  <span className="flex items-center gap-2">
                    <BookOpen className="h-3.5 w-3.5" />
                    Teachers ({roleCounts.teacher})
                  </span>
                </SelectItem>
                <SelectItem value="admin">
                  <span className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5" />
                    Admins ({roleCounts.admin})
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-[200px] h-9 bg-background"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <ScrollArea className="h-[480px]">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow className="border-b border-border/50 hover:bg-transparent">
                <TableHead className="font-medium text-xs uppercase tracking-wider text-muted-foreground">Name</TableHead>
                <TableHead className="font-medium text-xs uppercase tracking-wider text-muted-foreground">Email / ID</TableHead>
                <TableHead className="font-medium text-xs uppercase tracking-wider text-muted-foreground">Role</TableHead>
                <TableHead className="font-medium text-xs uppercase tracking-wider text-muted-foreground w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => {
                const role = user.user_roles?.[0]?.role || 'unknown';
                
                return (
                  <TableRow 
                    key={user.id} 
                    className="border-b border-border/30 hover:bg-muted/30 transition-colors"
                  >
                    <TableCell className="py-3">
                      <p className="font-medium text-sm">{user.full_name}</p>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="space-y-0.5">
                        <p className="text-sm text-foreground">{user.email}</p>
                        {user.student_id && (
                          <p className="text-xs text-muted-foreground font-mono">
                            ID: {user.student_id}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge 
                        variant={getRoleBadgeVariant(role)} 
                        className="capitalize gap-1.5"
                      >
                        {getRoleIcon(role)}
                        {role}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => onDeleteUser(user.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Users className="h-8 w-8 opacity-50" />
                      <p className="text-sm">
                        {searchQuery || roleFilter !== 'all' 
                          ? 'No users match your filters' 
                          : 'No users registered yet'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
