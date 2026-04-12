import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, Users, Clock, Plus, TrendingUp, ExternalLink, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, Link } from 'react-router-dom';
import { formatTime, formatDateRelative } from '@/utils/dateHelpers';
import { Appointment, Client, Employee } from '@/types';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const { activity } = useAuth();
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];

  const { data: todayAppts = [] } = useQuery({
    queryKey: ['appointments', 'today', activity?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('appointments')
        .select('*, client:clients(*), service:services(*)')
        .eq('activity_id', activity!.id)
        .eq('date', today)
        .order('start_time');
      return (data || []) as Appointment[];
    },
    enabled: !!activity,
  });

  const { data: upcomingAppts = [] } = useQuery({
    queryKey: ['appointments', 'upcoming', activity?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('appointments')
        .select('*, client:clients(*), service:services(*)')
        .eq('activity_id', activity!.id)
        .gt('date', today)
        .order('date')
        .order('start_time')
        .limit(5);
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

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', activity?.id],
    queryFn: async () => {
      const { data } = await supabase.from('employees').select('*').eq('activity_id', activity!.id).order('is_owner', { ascending: false });
      return (data || []) as Employee[];
    },
    enabled: !!activity,
  });

  const { data: weekAppts = [] } = useQuery({
    queryKey: ['appointments', 'week', activity?.id],
    queryFn: async () => {
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() + 7);
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

  if (!activity) return null;

  const stats = [
    { icon: Calendar, label: 'Oggi', value: todayAppts.length, color: 'text-primary' },
    { icon: TrendingUp, label: 'Questa settimana', value: weekAppts.length, color: 'text-success' },
    { icon: Users, label: 'Clienti totali', value: totalClients, color: 'text-accent' },
    { icon: UserPlus, label: 'Dipendenti', value: employees.length, color: 'text-warning' },
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
        <div className="flex gap-2">
          <Button onClick={() => navigate('/calendar')} variant="outline" size="sm"><Plus className="w-4 h-4" /> Nuovo appuntamento</Button>
          <Button onClick={() => navigate('/clients')} variant="outline" size="sm"><Plus className="w-4 h-4" /> Nuovo cliente</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-5 h-5 ${s.color}`} />
              <span className="text-sm text-muted-foreground">{s.label}</span>
            </div>
            <div className="text-2xl font-bold">{s.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Today */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Appuntamenti di oggi</h2>
            <Link to="/calendar" className="text-sm text-primary hover:underline">Vedi tutti</Link>
          </div>
          {todayAppts.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Nessun appuntamento oggi</p>
          ) : (
            <div className="space-y-3">
              {todayAppts.map(a => (
                <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-1 h-10 rounded-full" style={{ backgroundColor: a.color || a.service?.color || '#3b82f6' }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{a.client?.name || a.client_name || 'Cliente'}</div>
                    <div className="text-xs text-muted-foreground">{a.service?.name || 'Appuntamento'} • {formatTime(a.start_time)} - {formatTime(a.end_time)}</div>
                  </div>
                  <span className={`status-badge status-${a.status}`}>{statusLabel(a.status)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Prossimi appuntamenti</h2>
          {upcomingAppts.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Nessun appuntamento futuro</p>
          ) : (
            <div className="space-y-3">
              {upcomingAppts.map(a => (
                <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-1 h-10 rounded-full" style={{ backgroundColor: a.color || a.service?.color || '#3b82f6' }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{a.client?.name || a.client_name || 'Cliente'}</div>
                    <div className="text-xs text-muted-foreground">{formatDateRelative(a.date)} • {formatTime(a.start_time)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent clients */}
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
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.phone || c.email || ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Azioni rapide</h2>
          <div className="space-y-3">
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/calendar')}>
              <Calendar className="w-5 h-5 mr-2" /> Apri calendario
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/clients')}>
              <Users className="w-5 h-5 mr-2" /> Gestisci clienti
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <a href={`/${activity.slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-5 h-5 mr-2" /> Apri pagina prenotazione
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
