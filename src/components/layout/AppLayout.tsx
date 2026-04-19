import { useAuth } from '@/contexts/AuthContext';
import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { Calendar, Users, LayoutDashboard, Settings, ExternalLink, LogOut, Menu, X, Scissors, Contact, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { NotificationBell } from './NotificationBell';

export default function AppLayout() {
  const { user, activity, loading, signOut } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!activity) return <Navigate to="/register" replace />;

  const isSalone = activity.category === 'salone';
  const isCoach = activity.category === 'coach';

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', show: true },
    { to: '/calendar', icon: Calendar, label: 'Calendario', show: true },
    { to: '/clients', icon: Users, label: 'Clienti', show: true },
    { to: '/services', icon: Scissors, label: isCoach ? 'Sessioni' : 'Servizi', show: true },
    { to: '/employees', icon: Contact, label: 'Dipendenti', show: isSalone },
    { to: '/packages', icon: Package, label: 'Pacchetti', show: isCoach },
    { to: '/settings', icon: Settings, label: 'Impostazioni', show: true },
  ].filter(item => item.show);

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden md:flex w-64 bg-card border-r border-border flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <span className="font-display text-lg font-bold">Schedio</span>
            <div className="text-xs text-muted-foreground mt-1 truncate">{activity.name}</div>
          </div>
          <NotificationBell />
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <Link key={item.to} to={item.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${location.pathname === item.to ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          ))}
          <a href={`/${activity.slug}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
            <ExternalLink className="w-5 h-5" />
            Pagina pubblica
          </a>
        </nav>
        <div className="p-3 border-t border-border">
          <Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={signOut}>
            <LogOut className="w-5 h-5 mr-2" /> Esci
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card">
          <span className="font-display text-lg font-bold">Prenota<span className="text-primary">Pro</span></span>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </header>

        {mobileOpen && (
          <div className="md:hidden bg-card border-b border-border p-3 space-y-1">
            {navItems.map(item => (
              <Link key={item.to} to={item.to} onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${location.pathname === item.to ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}>
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            ))}
            <Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={signOut}>
              <LogOut className="w-5 h-5 mr-2" /> Esci
            </Button>
          </div>
        )}

        <main className="flex-1 overflow-auto"><Outlet /></main>
      </div>
    </div>
  );
}
