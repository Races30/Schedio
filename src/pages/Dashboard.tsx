import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, Users, Clock, Plus, TrendingUp, ExternalLink, UserPlus, Scissors, Contact, Package, AlertTriangle, Dumbbell, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, Link } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatTime, formatDateRelative } from '@/utils/dateHelpers';
import { Appointment, Client, Employee, Package as PackageType } from '@/types';
import { motion } from 'framer-motion';
import { filterBookableEmployees, employeeDisplayLabel } from '@/utils/salonEmployees';

export default function Dashboard() {
  const { activity } = useAuth();
  const navigate = useNavigate();
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('all');
  const today = new Date().toISOString().split('T')[0];

  const isSalone = activity?.category === 'salone';
  const isCoach = activity?.category === 'coach';

  const { data: todayAppts = [] } = useQuery({
    queryKey: ['appointments', 'today', activity?.id],
    queryFn: async () => {
      const { data } = await supabase.from('appointments').select('*, client:clients(*), service:services(*)').eq('activity_id', activity!.id).eq('date', today).order('start_time');
      return (data || []) as Appointment[];
    },
    enabled: !!activity,
  });

  const { data: upcomingAppts = [] } = useQuery({
    queryKey: ['appointments', 'upcoming', activity?.id],
    queryFn: async () => {
      const { data } = await supabase.from('appointments').select('*, client:clients(*), service:services(*)').eq('activity_id', activity!.id).gt('date', today).order('date').order('start_time').limit(5);
      return (data || []) as Appointment[];
    },
    enabled: !!activity,
  });

  const { data: recentClients = [] } = useQuery({
    queryKey: ['clients', 'recent', activity?.id],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('*').eq('activity_id', activity!.id).order('created_at', { ascending: false }).limit(5);
      return (data || []) as Client[];
    },
    enabled: !!activity,
  });

  const { data: employeesRaw = [] } = useQuery({
    queryKey: ['employees', activity?.id],
    queryFn: async () => {
      const { data } = await supabase.from('employees').select('*').eq('activity_id', activity!.id).order('is_owner', { ascending: false });
      return (data || []) as Employee[];
    },
    enabled: !!activity && isSalone,
  });

  const { data: weekAppts = [] } = useQuery({
    queryKey: ['appointments', 'week', activity?.id],
    queryFn: async () => {
      const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
      const { data } = await supabase.from('appointments').select('id, status').eq('activity_id', activity!.id).gte('date', today).lte('date', weekEnd.toISOString().split('T')[0]);
      return data || [];
    },
    enabled: !!activity,
  });

  const { data: totalClients = 0 } = useQuery({
    queryKey: ['clients', 'count', activity?.id],
    queryFn: async () => {
      const { count } = await supabase.from('clients').select('*', { count: 'exact', head: true }).eq('activity_id', activity!.id);
      return count || 0;
    },
    enabled: !!activity,
  });

  // Coach-specific queries
  const { data: packages = [] } = useQuery({
    queryKey: ['packages', activity?.id],
    queryFn: async () => {
      const { data } = await supabase.from('packages').select('*, client:clients(name)').eq('activity_id', activity!.id).eq('status', 'active');
      return (data || []) as (PackageType & { client?: { name: string } })[];
    },
    enabled: !!activity && isCoach,
  });

  // Inactive clients (no appointment in last 14 days) — coach only
  const { data: allClients = [] } = useQuery({
    queryKey: ['clients', 'all', activity?.id],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('*').eq('activity_id', activity!.id);
      return (data || []) as Client[];
    },
    enabled: !!activity && isCoach,
  });

  const { data: recentApptClientIds = [] } = useQuery({
    queryKey: ['appointments', 'recent-clients', activity?.id],
    queryFn: async () => {
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 14);
      const { data } = await supabase.from('appointments').select('client_id').eq('activity_id', activity!.id).gte('date', cutoff.toISOString().split('T')[0]).neq('status', 'cancelled');
      return [...new Set((data || []).map(a => a.client_id).filter(Boolean))] as string[];
    },
    enabled: !!activity && isCoach,
  });

  const inactiveClients = useMemo(() => {
    if (!isCoach) return [];
    return allClients.filter(c => !recentApptClientIds.includes(c.id));
  }, [allClients, recentApptClientIds, isCoach]);

  const bookableEmployees = useMemo(() => filterBookableEmployees(employeesRaw, activity), [employeesRaw, activity]);

  const filterByEmployee = (list: Appointment[]) => filterEmployeeId === 'all' ? list : list.filter((a) => a.employee_id === filterEmployeeId);
  const todayFiltered = useMemo(() => filterByEmployee(todayAppts), [todayAppts, filterEmployeeId]);
  const upcomingFiltered = useMemo(() => filterByEmployee(upcomingAppts), [upcomingAppts, filterEmployeeId]);
  const getEmp = (id: string | null) => employeesRaw.find((e) => e.id === id);

  if (!activity) return null;

  const expiringPackages = packages.filter(p => {
    if (!p.end_date) return false;
    const daysLeft = Math.ceil((new Date(p.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysLeft <= 7 && daysLeft >= 0;
  });

  const lowSessionPackages = packages.filter(p => (p.total_sessions - p.used_sessions) <= 2 && (p.total_sessions - p.used_sessions) > 0);

  const totalRemainingSessions = packages.reduce((sum, p) => sum + (p.total_sessions - p.used_sessions), 0);

  const stats = isSalone ? [
    { icon: Calendar, label: 'Oggi', value: todayFiltered.length, color: 'text-primary' },
    { icon: TrendingUp, label: 'Questa settimana', value: weekAppts.length, color: 'text-success' },
    { icon: Users, label: 'Clienti totali', value: totalClients, color: 'text-accent' },
    { icon: UserPlus, label: 'Operatori attivi', value: bookableEmployees.length, color: 'text-warning' },
  ] : [
    { icon: Calendar, label: 'Sessioni oggi', value: todayAppts.length, color: 'text-primary' },
    { icon: Package, label: 'Pacchetti attivi', value: packages.length, color: 'text-success' },
    { icon: Users, label: 'Clienti totali', value: totalClients, color: 'text-accent' },
    { icon: TrendingUp, label: 'Sedute rimanenti', value: totalRemainingSessions, color: 'text-warning' },
  ];

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { confirmed: 'Confermato', pending: 'In attesa', cancelled: 'Cancellato', completed: 'Completato' };
    return map[s] || s;
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold">Ciao, {activity.owner_name} 👋</h1>
          <p className="text-muted-foreground">{activity.name}</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {isSalone && bookableEmployees.length > 0 && (
            <Select value={filterEmployeeId} onValueChange={setFilterEmployeeId}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filtra per operatore" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli operatori</SelectItem>
                {bookableEmployees.map((e) => <SelectItem key={e.id} value={e.id}>{employeeDisplayLabel(e, activity)}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button onClick={() => navigate('/calendar')} variant="outline" size="sm"><Plus className="w-4 h-4" /> {isSalone ? 'Nuovo appuntamento' : 'Nuova sessione'}</Button>
          <Button onClick={() => navigate('/clients')} variant="outline" size="sm"><Plus className="w-4 h-4" /> Nuovo cliente</Button>
        </div>
      </div>

      {/* Coach alerts */}
      {isCoach && (expiringPackages.length > 0 || lowSessionPackages.length > 0 || inactiveClients.length > 0) && (
        <div className="mb-6 space-y-2">
          {expiringPackages.map(p => (
            <div key={`exp-${p.id}`} className="flex items-center gap-3 p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm">
              <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
              <span>Pacchetto <strong>{p.name}</strong>{(p as any).client?.name ? ` di ${(p as any).client.name}` : ''} in scadenza il {p.end_date}</span>
            </div>
          ))}
          {lowSessionPackages.map(p => (
            <div key={`low-${p.id}`} className="flex items-center gap-3 p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm">
              <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
              <span>Pacchetto <strong>{p.name}</strong>{(p as any).client?.name ? ` di ${(p as any).client.name}` : ''}: solo {p.total_sessions - p.used_sessions} sedute rimanenti</span>
            </div>
          ))}
          {inactiveClients.length > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted border border-border text-sm">
              <UserX className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span><strong>{inactiveClients.length}</strong> client{inactiveClients.length > 1 ? 'i' : 'e'} inattiv{inactiveClients.length > 1 ? 'i' : 'o'} (nessuna sessione negli ultimi 14 giorni): {inactiveClients.slice(0, 3).map(c => c.name).join(', ')}{inactiveClients.length > 3 ? '...' : ''}</span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2"><s.icon className={`w-5 h-5 ${s.color}`} /><span className="text-sm text-muted-foreground">{s.label}</span></div>
            <div className="text-2xl font-bold">{s.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{isSalone ? 'Appuntamenti di oggi' : 'Sessioni di oggi'}</h2>
            <Link to="/calendar" className="text-sm text-primary hover:underline">Vedi tutti</Link>
          </div>
          {todayFiltered.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Nessun {isSalone ? 'appuntamento' : 'sessione'} oggi</p>
          ) : (
            <div className="space-y-3">
              {todayFiltered.map(a => {
                const emp = getEmp(a.employee_id);
                return (
                  <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="w-1 h-10 rounded-full" style={{ backgroundColor: a.color || a.service?.color || '#3b82f6' }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{a.client?.name || a.client_name || 'Cliente'}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.service?.name || (isCoach ? 'Sessione' : 'Appuntamento')} • {formatTime(a.start_time)} - {formatTime(a.end_time)}
                        {emp && <span> • {emp.name}</span>}
                      </div>
                    </div>
                    <span className={`status-badge status-${a.status}`}>{statusLabel(a.status)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">{isSalone ? 'Prossimi appuntamenti' : 'Prossime sessioni'}</h2>
          {upcomingFiltered.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Nessun {isSalone ? 'appuntamento' : 'sessione'} futura</p>
          ) : (
            <div className="space-y-3">
              {upcomingFiltered.map(a => {
                const emp = getEmp(a.employee_id);
                return (
                  <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="w-1 h-10 rounded-full" style={{ backgroundColor: a.color || a.service?.color || '#3b82f6' }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{a.client?.name || a.client_name || 'Cliente'}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateRelative(a.date)} • {formatTime(a.start_time)}
                        {emp && <span> • {emp.name}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Clienti recenti</h2>
            <Link to="/clients" className="text-sm text-primary hover:underline">Vedi tutti</Link>
          </div>
          {recentClients.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Nessun cliente registrato</p>
          ) : (
            <div className="space-y-3">
              {recentClients.map(c => (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">{c.name.charAt(0).toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.phone || c.email || ''}</div>
                  </div>
                  {isCoach && c.objective && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{c.objective}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Azioni rapide</h2>
          <div className="space-y-3">
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/calendar')}>
              <Calendar className="w-5 h-5 mr-2" /> Apri calendario
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/clients')}>
              <Users className="w-5 h-5 mr-2" /> Gestisci clienti
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/services')}>
              {isSalone ? <Scissors className="w-5 h-5 mr-2" /> : <Dumbbell className="w-5 h-5 mr-2" />}
              {isSalone ? 'Servizi' : 'Sessioni'}
            </Button>
            {isSalone && (
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/employees')}>
                <Contact className="w-5 h-5 mr-2" /> Dipendenti
              </Button>
            )}
            {isCoach && (
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/packages')}>
                <Package className="w-5 h-5 mr-2" /> Pacchetti
              </Button>
            )}
            <Button variant="outline" className="w-full justify-start" asChild>
              <a href={`/${activity.slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-5 h-5 mr-2" /> Pagina prenotazione
              </a>
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/settings')}>
              <Clock className="w-5 h-5 mr-2" /> Impostazioni
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
