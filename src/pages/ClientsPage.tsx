import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Search, Phone, Mail, Edit, Target, TrendingUp, Package, Weight, Ruler, CheckCircle2, Copy, MailCheck, MailX, Send, Clock, Dumbbell, BarChart2 } from 'lucide-react';
import { Client, Appointment, Package as PackageType, ProgressEntry, ExerciseProgress, MEASURE_UNIT } from '@/types';
import { toast } from 'sonner';
import { formatDate, formatTime } from '@/utils/dateHelpers';
import { CompleteSessionDialog } from '@/components/coach/CompleteSessionDialog';
import { ProgressIndicator } from '@/components/coach/ProgressIndicator';
import { MuscleSelector } from '@/components/coach/MuscleSelector';
import { WorkoutPlanEditor } from '@/components/coach/WorkoutPlanEditor';

const OBJECTIVES = ['Dimagrimento', 'Aumento massa', 'Tonificazione', 'Postura', 'Performance', 'Recupero forma', 'Mobilità', 'Preparazione atletica'];
const LEVELS = ['Principiante', 'Intermedio', 'Avanzato', 'Esperto'];

export default function ClientsPage() {
  const { activity } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'last' | 'created' | 'sessions'>('last');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [detailClient, setDetailClient] = useState<Client | null>(null);

  const isCoach = activity?.category === 'coach';

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', activity?.id],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('*').eq('activity_id', activity!.id).order('name');
      return (data || []) as Client[];
    },
    enabled: !!activity,
  });

  const filtered = clients
    .filter((c) => {
      const query = search.toLowerCase();
      const fullName = (c.first_name || c.last_name) 
        ? `${c.first_name || ''} ${c.last_name || ''}`.trim().toLowerCase()
        : c.name.toLowerCase();
      const matchesSearch =
        c.name.toLowerCase().includes(query) ||
        fullName.includes(query) ||
        c.email?.toLowerCase().includes(query) ||
        c.phone?.includes(search);
      const matchesStatus = statusFilter === 'all' || (c.activity_status || c.status || 'attivo') === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'created') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'sessions') return (b.sessions_remaining || 0) - (a.sessions_remaining || 0);
      return new Date(b.last_completed_at || b.updated_at).getTime() - new Date(a.last_completed_at || a.updated_at).getTime();
    });

  const openNew = () => { setEditClient(null); setDialogOpen(true); };
  const openEdit = (c: Client) => { setEditClient(c); setDialogOpen(true); };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Clienti</h1>
        <Button onClick={openNew} variant="hero"><Plus className="w-4 h-4" /> Nuovo cliente</Button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca clienti..." className="pl-10" />
      </div>
      <div className="grid sm:grid-cols-2 gap-3 mb-6">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger><SelectValue placeholder="Filtra stato" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            <SelectItem value="attivo">Attivo</SelectItem>
            <SelectItem value="inattivo">Inattivo</SelectItem>
            <SelectItem value="da ricontattare">Da ricontattare</SelectItem>
            <SelectItem value="no-show">No-show</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger><SelectValue placeholder="Ordina per" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="last">Ultima attività</SelectItem>
            <SelectItem value="name">Nome</SelectItem>
            <SelectItem value="created">Più recenti</SelectItem>
            {isCoach && <SelectItem value="sessions">Sessioni rimanenti</SelectItem>}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-muted-foreground">{search ? 'Nessun risultato' : 'Nessun cliente registrato'}</p>
          {!search && <Button variant="outline" className="mt-4" onClick={openNew}>Aggiungi il primo cliente</Button>}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(c => (
            <div key={c.id} className="glass-card p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailClient(c)}>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary flex-shrink-0">
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium flex items-center gap-2 flex-wrap">
                  {c.name}
                  {c.status && c.status !== 'attivo' && (
                    <span className={`text-[10px] px-2 py-0.5 flex-shrink-0 rounded-full ${c.status === 'no-show' ? 'bg-destructive/10 text-destructive font-semibold' : 'bg-warning/10 text-warning font-semibold cursor-help'}`} title={c.status_reason || ''}>
                      {c.status.toUpperCase()}
                    </span>
                  )}
                  {isCoach && c.invite_accepted && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold flex items-center gap-1 flex-shrink-0">
                      <MailCheck className="w-2.5 h-2.5" /> Attivo
                    </span>
                  )}
                  {isCoach && !c.invite_accepted && c.invite_sent && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold flex items-center gap-1 flex-shrink-0">
                      <Clock className="w-2.5 h-2.5" /> Invito inviato
                    </span>
                  )}
                  {isCoach && !c.invite_accepted && !c.invite_sent && c.invite_token && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold flex items-center gap-1 flex-shrink-0">
                      <MailX className="w-2.5 h-2.5" /> Non invitato
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap">
                  {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</span>}
                  {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</span>}
                  {isCoach && c.objective && <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {c.objective}</span>}
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                  {!isCoach && c.last_service_name && <span>Ultimo servizio: {c.last_service_name}</span>}
                  {c.visit_frequency_days ? <span>Frequenza: ~{Math.round(c.visit_frequency_days)} giorni</span> : null}
                  {isCoach && typeof c.sessions_remaining === 'number' && <span>Sessioni rimanenti: {c.sessions_remaining}</span>}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); openEdit(c); }}>
                <Edit className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <ClientDialog open={dialogOpen} onClose={() => setDialogOpen(false)} client={editClient} activityId={activity?.id || ''} isCoach={isCoach} />

      {detailClient && (
        <ClientDetailDialog client={detailClient} onClose={() => setDetailClient(null)} activityId={activity?.id || ''} isCoach={isCoach} />
      )}
    </div>
  );
}

/* ─── Client Create/Edit Dialog ─── */
function ClientDialog({ open, onClose, client, activityId, isCoach }: {
  open: boolean; onClose: () => void; client: Client | null; activityId: string; isCoach?: boolean;
}) {
  const queryClient = useQueryClient();
  const { activity } = useAuth();
  const [name, setName]               = useState(client?.name || '');
  const [phone, setPhone]             = useState(client?.phone || '');
  const [email, setEmail]             = useState(client?.email || '');
  const [notes, setNotes]             = useState(client?.notes || '');
  const [importantNotes, setImportantNotes] = useState(client?.important_notes || '');
  const [objective, setObjective]     = useState(client?.objective || '');
  const [goal, setGoal]               = useState((client as Client & { goal?: string })?.goal || '');
  const [targetArea, setTargetArea]   = useState((client as Client & { target_area?: string })?.target_area || '');
  const [targetMuscles, setTargetMuscles] = useState<string[]>([]);
  const [level, setLevel]             = useState(client?.level || '');
  const [frequency, setFrequency]     = useState(client?.frequency || '');
  const [loading, setLoading]         = useState(false);
  const [inviteLink, setInviteLink]   = useState<string | null>(null);

  const normalizePhone = (v: string) => v.trim().replace(/[^\d+]/g, '') || null;
  const normalizeEmail = (v: string) => v.trim().toLowerCase() || null;

  const generateToken = () => crypto.randomUUID();

  const sendInviteEmail = async (token: string, clientName: string, clientEmail: string, clientId: string) => {
    const { error: funcError } = await supabase.functions.invoke('send-client-invite', {
      body: {
        email: clientEmail,
        clientName,
        trainerName: activity?.name || 'Il tuo trainer',
        token,
      },
    });
    if (!funcError) {
      await supabase.from('clients').update({ invite_sent: true, invited_at: new Date().toISOString() } as never).eq('id', clientId);
      return true;
    } else {
      console.error('Error sending invite email:', funcError);
      toast.error(`Errore nell'invio dell'email: ${funcError.message || 'Errore sconosciuto'}`);
      return false;
    }
  };

  const save = async () => {
    if (!name.trim()) { toast.error('Il nome è obbligatorio'); return; }
    setLoading(true);
    try {
      const inviteToken = !client ? generateToken() : undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = {
        activity_id: activityId,
        name: name.trim(),
        first_name: name.trim().split(' ')[0] || null,
        last_name: name.trim().split(' ').slice(1).join(' ') || null,
        full_name_normalized: name.trim().toLowerCase().replace(/\s+/g, ' '),
        phone: phone || null,
        phone_normalized: phone ? normalizePhone(phone) : null,
        email: email || null,
        email_normalized: email ? normalizeEmail(email) : null,
        notes: notes || null,
        important_notes: importantNotes || null,
        ...(isCoach ? {
          objective: objective || null,
          goal: goal || null,
          target_area: targetArea || null,
          target_muscles: targetMuscles,
          level: level || null,
          frequency: frequency || null,
          training_frequency: frequency || null,
          ...(inviteToken ? { invite_token: inviteToken, invite_sent: false } : {}),
        } : {})
      };
      let savedId = client?.id;
      if (client) {
        const { error } = await supabase.from('clients').update(payload).eq('id', client.id);
        if (error) throw error;
        toast.success('Cliente aggiornato');
      } else {
        const { data, error } = await supabase.from('clients').insert(payload).select('id').single();
        if (error) throw error;
        savedId = data?.id;
        toast.success('Cliente creato');
        // Send invite email via Edge Function
        if (inviteToken && email) {
          await sendInviteEmail(inviteToken, name.trim(), email.trim().toLowerCase(), data.id);
          const link = `${window.location.origin}/setup-account?token=${inviteToken}`;
          setInviteLink(link);
        }
      }
      void savedId;
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      if (!inviteLink) onClose();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : String(err)); } finally { setLoading(false); }
  };

  const deleteClient = async () => {
    if (!client) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('clients').delete().eq('id', client.id);
      if (error) throw error;
      toast.success('Cliente eliminato');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      onClose();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : String(err)); } finally { setLoading(false); }
  };

  // Invite link confirmation screen
  if (inviteLink) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-500" /> Cliente creato!</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Invia questo link al cliente per permettergli di creare il suo account:
            </p>
            <div className="bg-muted rounded-lg p-3 break-all text-xs font-mono">{inviteLink}</div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => { navigator.clipboard.writeText(inviteLink); toast.success('Link copiato!'); }}
            >
              <Copy className="w-4 h-4 mr-2" /> Copia link
            </Button>
            <Button variant="hero" className="w-full" onClick={onClose}>Chiudi</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{client ? 'Modifica cliente' : 'Nuovo cliente'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Nome e cognome *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="es. Mario Rossi" /></div>
          <div><Label>Telefono</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+39 123 456 7890" /></div>
          <div>
            <Label>Email{!client && isCoach ? ' (per link invito)' : ''}</Label>
            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@esempio.com" type="email" />
          </div>

          {isCoach && (
            <>
              <div>
                <Label>Obiettivo finale</Label>
                <Textarea value={goal} onChange={e => setGoal(e.target.value)} placeholder="Descrivi l'obiettivo del cliente in modo libero..." rows={2} />
              </div>
              <div>
                <Label>Obiettivo</Label>
                <Select value={objective} onValueChange={setObjective}>
                  <SelectTrigger><SelectValue placeholder="Seleziona obiettivo" /></SelectTrigger>
                  <SelectContent>{OBJECTIVES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-2 block">Parte del corpo e muscoli target</Label>
                <MuscleSelector
                  macroArea={targetArea as 'upper' | 'lower' | 'full' | null}
                  onMacroAreaChange={(area) => setTargetArea(area || '')}
                  selected={targetMuscles}
                  onChange={setTargetMuscles}
                />
              </div>
              <div>
                <Label>Livello</Label>
                <Select value={level} onValueChange={setLevel}>
                  <SelectTrigger><SelectValue placeholder="Seleziona livello" /></SelectTrigger>
                  <SelectContent>{LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Frequenza allenamenti</Label><Input value={frequency} onChange={e => setFrequency(e.target.value)} placeholder="es. 3 volte a settimana" /></div>
            </>
          )}
          <div><Label>Note</Label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Note opzionali" /></div>
          <div><Label>Note importanti</Label><Textarea value={importantNotes} onChange={e => setImportantNotes(e.target.value)} placeholder="Allergie, preferenze forti, indicazioni operative..." /></div>
          <div className="flex gap-2">
            {client && <Button variant="destructive" onClick={deleteClient} disabled={loading}>Elimina</Button>}
            <Button variant="hero" onClick={save} disabled={loading} className="flex-1">
              {loading ? 'Salvataggio...' : client ? 'Aggiorna' : 'Crea e genera link invito'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Client Detail Dialog ─── */
function ClientDetailDialog({ client, onClose, activityId, isCoach }: {
  client: Client; onClose: () => void; activityId: string; isCoach?: boolean;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'info' | 'progress' | 'exercises'>('info');
  const [showProgressForm, setShowProgressForm] = useState(false);
  const [completeAppt, setCompleteAppt] = useState<Appointment | null>(null);
  const [resendingInvite, setResendingInvite] = useState(false);
  const [planEditorOpen, setPlanEditorOpen] = useState(false);
  const { activity } = useAuth();

  const { data: appointments = [] } = useQuery({
    queryKey: ['client-appointments', client.id],
    queryFn: async () => {
      const { data } = await supabase.from('appointments').select('*, service:services(*)').eq('client_id', client.id).order('date', { ascending: false }).limit(10);
      return (data || []) as Appointment[];
    },
  });

  const { data: clientPackages = [] } = useQuery({
    queryKey: ['client-packages', client.id],
    queryFn: async () => {
      const { data } = await supabase.from('packages').select('*').eq('client_id', client.id).order('created_at', { ascending: false });
      return (data || []) as PackageType[];
    },
    enabled: !!isCoach,
  });

  const { data: progressEntries = [] } = useQuery({
    queryKey: ['client-progress', client.id],
    queryFn: async () => {
      const { data } = await supabase.from('progress_entries').select('*').eq('client_id', client.id).order('measurement_date', { ascending: false });
      return (data || []) as ProgressEntry[];
    },
    enabled: !!isCoach,
  });

  // Exercise-based progress for coach — grouped by exercise
  const { data: exerciseProgressRaw = [] } = useQuery({
    queryKey: ['exercise-progress', client.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('exercise_progress')
        .select('*, exercise:exercises(name, measure_type)')
        .eq('client_id', client.id)
        .order('recorded_at', { ascending: false });
      return (data || []) as ExerciseProgress[];
    },
    enabled: !!isCoach,
  });

  // Group by exercise_id, sorted by most recent
  const exerciseGroups = isCoach
    ? Object.values(
        exerciseProgressRaw.reduce<Record<string, ExerciseProgress[]>>((acc, ep) => {
          if (!acc[ep.exercise_id]) acc[ep.exercise_id] = [];
          acc[ep.exercise_id].push(ep);
          return acc;
        }, {})
      ).sort((a, b) => new Date(b[0].recorded_at).getTime() - new Date(a[0].recorded_at).getTime())
    : [];


  const activePackage = clientPackages.find(p => p.status === 'active');
  const futureAppointments = appointments.filter((a) => new Date(a.date) >= new Date()).sort((a, b) => a.date.localeCompare(b.date));
  const pastAppointments = appointments.filter((a) => new Date(a.date) < new Date()).sort((a, b) => b.date.localeCompare(a.date));

  const handleResendInvite = async () => {
    if (!client.invite_token || !client.email) {
      toast.error('Il cliente non ha un token o email valida.');
      return;
    }
    setResendingInvite(true);
    try {
      const { error: funcError } = await supabase.functions.invoke('send-client-invite', {
        body: {
          email: client.email,
          clientName: client.name,
          trainerName: activity?.name || 'Il tuo trainer',
          token: client.invite_token,
        },
      });
      if (funcError) throw funcError;
      await supabase.from('clients')
        .update({ invite_sent: true, invited_at: new Date().toISOString() } as never)
        .eq('id', client.id);
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Invito re-inviato con successo!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Errore durante il re-invio');
    } finally {
      setResendingInvite(false);
    }
  };

  return (
    <>
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div>{client.name}</div>
              {isCoach && client.objective && <div className="text-xs font-normal text-muted-foreground flex items-center gap-1"><Target className="w-3 h-3" /> {client.objective}</div>}
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Tabs for coach */}
        {isCoach && (
          <div className="flex gap-1 border-b border-border pb-2">
            <button onClick={() => setActiveTab('info')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'info' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>Info & Storico</button>
            <button onClick={() => setActiveTab('exercises')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${activeTab === 'exercises' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              <TrendingUp className="w-3.5 h-3.5" />Esercizi
              {exerciseProgressRaw.length > 0 && <span className="ml-1 bg-primary text-primary-foreground text-[10px] px-1.5 rounded-full">{exerciseProgressRaw.length}</span>}
            </button>
            <button onClick={() => setActiveTab('progress')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'progress' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>Misure</button>
          </div>
        )}

        {activeTab === 'info' && (
          <div className="space-y-6">
            {/* Contact info */}
            <div className="space-y-2">
              {client.phone && <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-muted-foreground" /> {client.phone}</div>}
              {client.email && <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-muted-foreground" /> {client.email}</div>}
              {isCoach && client.level && <div className="flex items-center gap-2 text-sm"><TrendingUp className="w-4 h-4 text-muted-foreground" /> Livello: {client.level}</div>}
              {isCoach && client.frequency && <div className="flex items-center gap-2 text-sm"><Target className="w-4 h-4 text-muted-foreground" /> Frequenza: {client.frequency}</div>}
              {!isCoach && client.last_service_name && <div className="flex items-center gap-2 text-sm"><Target className="w-4 h-4 text-muted-foreground" /> Ultimo servizio: {client.last_service_name}</div>}
              {client.visit_frequency_days && <div className="flex items-center gap-2 text-sm"><Target className="w-4 h-4 text-muted-foreground" /> Frequenza media: {Math.round(client.visit_frequency_days)} giorni</div>}
              
              {/* Target Body Area visualization (coach only) */}
              {isCoach && (client.target_area || (client.target_muscles && client.target_muscles.length > 0)) && (
                <div className="mt-4 p-4 border rounded-xl bg-muted/20">
                  <div className="text-sm font-semibold mb-2">Area di lavoro target</div>
                  <MuscleSelector
                    readOnly={true}
                    selected={client.target_muscles || []}
                    macroArea={client.target_area as 'upper' | 'lower' | 'full' | null}
                    onChange={() => {}}
                    className="scale-90 origin-top"
                  />
                </div>
              )}

              {/* Invite status block (coach only) */}
              {isCoach && client.invite_token && !client.invite_accepted && (
                <div className={`mt-2 p-3 rounded-lg border text-sm ${
                  client.invite_sent
                    ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:border-amber-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-900/30 dark:border-slate-700'
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-medium">
                      {client.invite_sent ? <Clock className="w-4 h-4" /> : <MailX className="w-4 h-4" />}
                      {client.invite_sent ? 'Invito inviato — in attesa' : 'Invito non ancora inviato'}
                    </div>
                    <div className="flex gap-2">
                      {client.email && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={resendingInvite}
                          onClick={handleResendInvite}
                        >
                          <Send className="w-3 h-3 mr-1" />
                          {resendingInvite ? '...' : client.invite_sent ? 'Reinvia' : 'Invia ora'}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => {
                          const link = `${window.location.origin}/setup-account?token=${client.invite_token}`;
                          navigator.clipboard.writeText(link);
                          toast.success('Link copiato!');
                        }}
                      >
                        <Copy className="w-3 h-3 mr-1" /> Copia link
                      </Button>
                    </div>
                  </div>
                  {client.invited_at && (
                    <div className="text-xs mt-1 opacity-70">
                      Inviato il {new Date(client.invited_at).toLocaleDateString('it-IT')}
                    </div>
                  )}
                </div>
              )}
              {isCoach && client.invite_accepted && (
                <div className="mt-2 p-3 rounded-lg border bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800 text-sm flex items-center gap-2">
                  <MailCheck className="w-4 h-4" />
                  <span className="font-medium">Account attivo</span>
                  {client.accepted_at && <span className="text-xs opacity-70 ml-auto">dal {new Date(client.accepted_at).toLocaleDateString('it-IT')}</span>}
                </div>
              )}

              {isCoach && client.next_recommended_at && <div className="flex items-center gap-2 text-sm"><Target className="w-4 h-4 text-muted-foreground" /> Prossima consigliata: {formatDate(client.next_recommended_at)}</div>}
              {client.notes && <p className="text-sm text-muted-foreground">{client.notes}</p>}
              {client.important_notes && <p className="text-sm text-destructive">{client.important_notes}</p>}
            </div>

            {/* Coach quick actions */}
            {isCoach && (
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => { onClose(); navigate(`/clients/${client.id}/progress`); }}
                >
                  <BarChart2 className="w-3.5 h-3.5 mr-1" /> Progressi
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-violet-300 text-violet-700 hover:bg-violet-50"
                  onClick={() => setPlanEditorOpen(true)}
                >
                  <Dumbbell className="w-3.5 h-3.5 mr-1" /> Scheda allenamento
                </Button>
              </div>
            )}

            {/* Status info */}
            {client.status && client.status !== 'attivo' && (
              <div className={`p-3 rounded-lg border text-sm ${client.status === 'no-show' ? 'bg-destructive/10 border-destructive/20 text-destructive' : 'bg-warning/10 border-warning/20 text-warning'}`}>
                <div className="font-bold flex items-center gap-2">
                  <Target className="w-4 h-4" /> 
                  Stato: {client.status.toUpperCase()}
                </div>
                {client.status_reason && <p className="mt-1 text-xs opacity-90">{client.status_reason}</p>}
              </div>
            )}

            {/* Active package for coach */}
            {isCoach && activePackage && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm">Pacchetto attivo: {activePackage.name}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><div className="text-lg font-bold text-primary">{activePackage.total_sessions - activePackage.used_sessions}</div><div className="text-xs text-muted-foreground">Rimanenti</div></div>
                  <div><div className="text-lg font-bold">{activePackage.used_sessions}</div><div className="text-xs text-muted-foreground">Usate</div></div>
                  <div><div className="text-lg font-bold">{activePackage.total_sessions}</div><div className="text-xs text-muted-foreground">Totali</div></div>
                </div>
                {activePackage.end_date && <div className="text-xs text-muted-foreground mt-2">Scadenza: {formatDate(activePackage.end_date)}</div>}
              </div>
            )}

            {/* Appointment history */}
            <div>
              <h3 className="font-semibold mb-2">{isCoach ? 'Sessioni future' : 'Appuntamenti futuri'}</h3>
              {futureAppointments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nessun appuntamento futuro</p>
              ) : (
                <div className="space-y-2">
                  {futureAppointments.map(a => (
                    <div key={a.id} className="flex items-center gap-3 bg-muted/50 rounded-lg p-3">
                      <div className="w-1 h-8 rounded-full" style={{ backgroundColor: a.color || a.service?.color || '#3b82f6' }} />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{a.service?.name || (isCoach ? 'Sessione' : 'Appuntamento')}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(a.date)} • {formatTime(a.start_time)}</div>
                      </div>
                      <span className={`status-badge status-${a.status}`}>
                        {a.status === 'confirmed' ? 'Conf.' : a.status === 'completed' ? 'Fatto' : a.status === 'cancelled' ? 'Ann.' : 'Attesa'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h3 className="font-semibold mb-2">{isCoach ? 'Storico sessioni' : 'Storico appuntamenti'}</h3>
              {pastAppointments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nessun appuntamento passato</p>
              ) : (
                <div className="space-y-2">
                  {pastAppointments.map(a => {
                    const canComplete = isCoach && a.status === 'confirmed';
                    return (
                      <div key={a.id} className="flex items-center gap-3 bg-muted/50 rounded-lg p-3">
                        <div className="w-1 h-8 rounded-full" style={{ backgroundColor: a.color || a.service?.color || '#3b82f6' }} />
                        <div className="flex-1">
                          <div className="text-sm font-medium">{a.service?.name || (isCoach ? 'Sessione' : 'Appuntamento')}</div>
                          <div className="text-xs text-muted-foreground">{formatDate(a.date)} • {formatTime(a.start_time)}</div>
                        </div>
                        {canComplete ? (
                          <Button size="sm" variant="outline"
                            className="text-emerald-600 border-emerald-300 hover:bg-emerald-50 text-xs h-7"
                            onClick={() => setCompleteAppt(a)}>
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Completa
                          </Button>
                        ) : (
                          <span className={`status-badge status-${a.status}`}>
                            {a.status === 'confirmed' ? 'Conf.' : a.status === 'completed' ? 'Fatto' : a.status === 'cancelled' ? 'Ann.' : 'Attesa'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Progress tab (coach only) */}
        {activeTab === 'progress' && isCoach && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Progressi</h3>
              <Button variant="outline" size="sm" onClick={() => setShowProgressForm(!showProgressForm)}>
                <Plus className="w-4 h-4" /> Nuova misurazione
              </Button>
            </div>

            {showProgressForm && (
              <ProgressForm clientId={client.id} activityId={activityId} onDone={() => { setShowProgressForm(false); queryClient.invalidateQueries({ queryKey: ['client-progress', client.id] }); }} />
            )}

            {/* Weight chart (simple bar) */}
            {progressEntries.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1"><Weight className="w-4 h-4" /> Andamento peso</h4>
                <div className="flex items-end gap-1 h-24">
                  {progressEntries.slice(0, 12).reverse().map((entry) => {
                    if (!entry.weight) return null;
                    const weights = progressEntries.filter(e => e.weight).map(e => e.weight!);
                    const min = Math.min(...weights) * 0.95;
                    const max = Math.max(...weights) * 1.05;
                    const range = max - min || 1;
                    const height = ((entry.weight - min) / range) * 100;
                    return (
                      <div key={entry.id} className="flex-1 flex flex-col items-center gap-1" title={`${entry.measurement_date}: ${entry.weight} kg`}>
                        <div className="w-full bg-primary/70 rounded-t" style={{ height: `${Math.max(height, 5)}%` }} />
                        <span className="text-[10px] text-muted-foreground">{entry.weight}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Entries list */}
            {progressEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nessun progresso registrato</p>
            ) : (
              <div className="space-y-3">
                {progressEntries.map(entry => (
                  <div key={entry.id} className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{formatDate(entry.measurement_date)}</span>
                      {entry.weight && <span className="text-sm font-bold">{entry.weight} kg</span>}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {entry.waist && <span className="flex items-center gap-0.5"><Ruler className="w-3 h-3" /> Vita: {entry.waist}cm</span>}
                      {entry.hips && <span>Fianchi: {entry.hips}cm</span>}
                      {entry.chest && <span>Petto: {entry.chest}cm</span>}
                      {entry.arms && <span>Braccia: {entry.arms}cm</span>}
                      {entry.thighs && <span>Cosce: {entry.thighs}cm</span>}
                    </div>
                    {entry.notes && <p className="text-xs text-muted-foreground mt-1">{entry.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Exercises progress tab (coach only) */}
        {activeTab === 'exercises' && isCoach && (
          <div className="space-y-4">
            {exerciseGroups.length === 0 ? (
              <div className="text-center py-10">
                <TrendingUp className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nessun progresso registrato.</p>
                <p className="text-xs text-muted-foreground mt-1">Completa una sessione per iniziare il tracking.</p>
              </div>
            ) : (
              exerciseGroups.map(entries => {
                const ex = entries[0].exercise;
                const exName = ex?.name ?? 'Esercizio';
                const measureType = entries[0].measure_type;
                const unit = MEASURE_UNIT[measureType as keyof typeof MEASURE_UNIT] ?? '';
                return (
                  <div key={entries[0].exercise_id} className="border border-border rounded-xl p-4 space-y-3">
                    {/* Exercise header with last vs previous comparison */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-sm">{exName}</div>
                        <div className="text-xs text-muted-foreground capitalize">{measureType}</div>
                      </div>
                      {/* Best vs previous */}
                      <div className="text-right">
                        <div className="text-lg font-bold">{entries[0].value} <span className="text-sm font-normal text-muted-foreground">{unit}</span></div>
                        <ProgressIndicator
                          current={entries[0].value}
                          previous={entries[1]?.value ?? null}
                          measureType={measureType}
                          showDiff={true}
                          size="sm"
                        />
                      </div>
                    </div>

                    {/* History list */}
                    <div className="space-y-1.5">
                      {entries.map((ep, idx) => (
                        <div key={ep.id} className="flex items-center gap-3 text-xs py-1.5 border-b border-border/50 last:border-0">
                          <span className="text-muted-foreground w-20 flex-shrink-0">
                            {new Date(ep.recorded_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                          </span>
                          <span className="font-semibold">{ep.value} {unit}</span>
                          <ProgressIndicator
                            current={ep.value}
                            previous={entries[idx + 1]?.value ?? null}
                            measureType={measureType}
                            showDiff={true}
                            size="sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* CompleteSession dialog (opened from appointment history) */}
        {completeAppt && activity && (
          <CompleteSessionDialog
            open={!!completeAppt}
            onClose={() => setCompleteAppt(null)}
            appointmentId={completeAppt.id}
            clientId={client.id}
            clientName={client.name}
            activityId={activityId}
            sessionDate={completeAppt.date}
          />
        )}
      </DialogContent>
    </Dialog>

    {/* WorkoutPlan editor (outside Dialog to avoid z-index stacking) */}
    {activity && (
      <WorkoutPlanEditor
        open={planEditorOpen}
        onClose={() => setPlanEditorOpen(false)}
        clientId={client.id}
        clientName={client.name}
        activityId={activityId}
      />
    )}
  </>
  );
}

/* ─── Progress Entry Form ─── */
function ProgressForm({ clientId, activityId, onDone }: { clientId: string; activityId: string; onDone: () => void }) {
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [hips, setHips] = useState('');
  const [chest, setChest] = useState('');
  const [arms, setArms] = useState('');
  const [thighs, setThighs] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.from('progress_entries').insert({
        client_id: clientId, activity_id: activityId,
        weight: weight ? Number(weight) : null, waist: waist ? Number(waist) : null,
        hips: hips ? Number(hips) : null, chest: chest ? Number(chest) : null,
        arms: arms ? Number(arms) : null, thighs: thighs ? Number(thighs) : null,
        notes: notes || null,
      });
      if (error) throw error;
      toast.success('Misurazione salvata');
      onDone();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : String(err)); } finally { setLoading(false); }
  };

  return (
    <div className="border border-border rounded-lg p-4 space-y-3 bg-card">
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Peso (kg)</Label><Input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="es. 75" /></div>
        <div><Label className="text-xs">Girovita (cm)</Label><Input type="number" value={waist} onChange={e => setWaist(e.target.value)} placeholder="es. 82" /></div>
        <div><Label className="text-xs">Fianchi (cm)</Label><Input type="number" value={hips} onChange={e => setHips(e.target.value)} placeholder="es. 95" /></div>
        <div><Label className="text-xs">Petto (cm)</Label><Input type="number" value={chest} onChange={e => setChest(e.target.value)} placeholder="es. 100" /></div>
        <div><Label className="text-xs">Braccia (cm)</Label><Input type="number" value={arms} onChange={e => setArms(e.target.value)} placeholder="es. 34" /></div>
        <div><Label className="text-xs">Cosce (cm)</Label><Input type="number" value={thighs} onChange={e => setThighs(e.target.value)} placeholder="es. 55" /></div>
      </div>
      <div><Label className="text-xs">Note</Label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Note sulla misurazione" /></div>
      <Button variant="hero" size="sm" onClick={save} disabled={loading} className="w-full">
        {loading ? 'Salvataggio...' : 'Salva misurazione'}
      </Button>
    </div>
  );
}
