/**
 * SessionNegotiationPanel
 *
 * Shared component used by both:
 *   - Trainer dashboard  (role='trainer') — sees client proposals, can confirm/reject/counter
 *   - Client dashboard   (role='client')  — sees trainer proposals/counters, can accept/reject/counter
 *
 * State machine:
 *   proposta ──────────┬─ confermata
 *                      ├─ rifiutata
 *                      └─ controproposta ──┬─ confermata
 *                                         ├─ rifiutata
 *                                         └─ controproposta (loop)
 */
import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CoachSession, SessionProposal, TrainerAvailability } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  CheckCircle2, XCircle, RefreshCw, Clock, Calendar, User, ChevronDown, ChevronUp,
  Lock, AlertTriangle, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { notifyTrainer, notifyClient } from '@/lib/notifyService';

// ── Status helpers ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  proposta:        { label: 'Proposta',        color: 'text-amber-700',   bg: 'bg-amber-100',   icon: '📨' },
  controproposta:  { label: 'Controproposta',  color: 'text-violet-700',  bg: 'bg-violet-100',  icon: '🔄' },
  confermata:      { label: 'Confermata',      color: 'text-emerald-700', bg: 'bg-emerald-100', icon: '✅' },
  completata:      { label: 'Completata',      color: 'text-slate-600',   bg: 'bg-slate-100',   icon: '🏁' },
  rifiutata:       { label: 'Rifiutata',       color: 'text-red-700',     bg: 'bg-red-100',     icon: '❌' },
  annullata:       { label: 'Annullata',       color: 'text-red-700',     bg: 'bg-red-100',     icon: '🚫' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: 'text-slate-600', bg: 'bg-slate-100', icon: '❓' };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.color} ${cfg.bg}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function formatDT(iso: string) {
  return new Date(iso).toLocaleString('it-IT', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

// ── Proposal History ───────────────────────────────────────────────────────────
function ProposalHistory({ proposals }: { proposals: SessionProposal[] }) {
  const [open, setOpen] = useState(false);
  if (!proposals.length) return null;
  return (
    <div className="mt-3">
      <button
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(o => !o)}
      >
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        Storico proposte ({proposals.length})
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-muted">
              {proposals.slice().reverse().map((p) => (
                <div key={p.id} className="text-xs text-muted-foreground">
                  <span className={p.proposed_by === 'trainer' ? 'text-violet-600 font-medium' : 'text-emerald-600 font-medium'}>
                    {p.proposed_by === 'trainer' ? '🏋️ Trainer' : '👤 Cliente'}
                  </span>
                  {' · '}{formatDT(p.scheduled_at)}
                  {p.notes && <span className="italic ml-1">"{p.notes}"</span>}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Counter-propose Form ───────────────────────────────────────────────────────
function CounterProposeForm({
  session,
  role,
  onDone,
  onCancel,
}: {
  session: CoachSession;
  role: 'trainer' | 'cliente';
  onDone: () => void;
  onCancel: () => void;
}) {
  const qc = useQueryClient();
  const [date, setDate]     = useState('');
  const [time, setTime]     = useState('');
  const [notes, setNotes]   = useState('');
  const [saving, setSaving] = useState(false);

  // Pre-populate with current scheduled_at if any
  const preFill = () => {
    if (!date && !time && session.scheduled_at) {
      const d = new Date(session.scheduled_at);
      setDate(d.toISOString().slice(0, 10));
      setTime(d.toTimeString().slice(0, 5));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !time) { toast.error('Inserisci data e ora'); return; }
    const iso = new Date(`${date}T${time}:00`).toISOString();
    setSaving(true);
    try {
      // 1. Update session
      const { error: sessErr } = await supabase
        .from('sessions')
        .update({
          scheduled_at: iso,
          status: 'controproposta',
          proposed_by: role,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', session.id);
      if (sessErr) throw sessErr;

      // 2. Log to history
      const { error: propErr } = await supabase
        .from('session_proposals')
        .insert({
          session_id:   session.id,
          proposed_by:  role,
          scheduled_at: iso,
          notes:        notes || null,
        } as never);
      if (propErr) throw propErr;

      qc.invalidateQueries({ queryKey: ['coach-sessions'] });
      qc.invalidateQueries({ queryKey: ['client-all-sessions'] });
      toast.success('Controproposta inviata!');

      // ── Notification: controproposta → notify trainer ──────────────────
      if (session.activity_id) {
        const when = iso
          ? new Date(iso).toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
          : 'nuovo orario';
        notifyTrainer({
          activityId: session.activity_id,
          type:       'session_rescheduled',
          title:      '🔄 Nuova controproposta',
          message:    `Il cliente ha proposto un orario alternativo: ${when}.`,
        });
      }
      onDone();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Errore');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      className="mt-3 p-3 bg-muted/50 rounded-lg space-y-3"
      onFocus={preFill}
    >
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Proponi un orario diverso</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Data *</Label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8 text-sm" required />
        </div>
        <div>
          <Label className="text-xs">Ora *</Label>
          <Input type="time" value={time} onChange={e => setTime(e.target.value)} className="h-8 text-sm" required />
        </div>
      </div>
      <div>
        <Label className="text-xs">Note (opzionale)</Label>
        <Textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="es. Preferisco mattina, va bene venerdì?"
          className="text-sm min-h-[60px]"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving} className="bg-violet-600 hover:bg-violet-700 text-white">
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> {saving ? 'Invio...' : 'Invia controproposta'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Annulla</Button>
      </div>
    </motion.form>
  );
}

// ── Single Session Card ────────────────────────────────────────────────────────
function SessionCard({
  session,
  role,
}: {
  session: CoachSession;
  role: 'trainer' | 'cliente';
}) {
  const qc = useQueryClient();
  const [showCounter, setShowCounter] = useState(false);
  const [loading, setLoading] = useState(false);

  const proposals = session.proposals ?? [];
  const latestProposal = proposals[proposals.length - 1] ?? null;

  // Can the current role act on this session?
  const isMyTurn = (() => {
    if (session.status === 'confermata' || session.status === 'completata'
        || session.status === 'annullata' || session.status === 'rifiutata') return false;
    // If last proposal was by the other party, it's my turn
    if (latestProposal) return latestProposal.proposed_by !== role;
    // Fresh session: trainer always gets the first view
    if (session.status === 'proposta') return role === 'trainer';
    return false;
  })();

  const isLocked = session.status === 'confermata' || session.status === 'completata';
  const isClosed = session.status === 'annullata' || session.status === 'rifiutata';

  const doAction = async (
    newStatus: 'confermata' | 'rifiutata',
    extraFields: Record<string, unknown> = {},
  ) => {
    setLoading(true);
    try {
      const patch: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
        ...extraFields,
      };
      if (newStatus === 'confermata') patch.confirmed_at = new Date().toISOString();
      const { error } = await supabase.from('sessions').update(patch as never).eq('id', session.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['coach-sessions'] });
      qc.invalidateQueries({ queryKey: ['client-all-sessions'] });
      qc.invalidateQueries({ queryKey: ['client-sessions'] });
      toast.success(newStatus === 'confermata' ? '✅ Sessione confermata!' : '❌ Sessione rifiutata');

      // ── Notifications ──────────────────────────────────────────────────
      if (newStatus === 'confermata' && session.client_id && session.activity_id) {
        // Trainer confirmed → notify client
        const when = session.scheduled_at
          ? new Date(session.scheduled_at).toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
          : 'data da definire';
        notifyClient({
          clientId:   session.client_id,
          activityId: session.activity_id,
          type:       'session_confirmed',
          title:      '✅ Sessione confermata',
          message:    `Il trainer ha confermato la sessione per ${when}.`,
        });
      } else if (newStatus === 'rifiutata' && session.client_id && session.activity_id) {
        // Trainer rejected → notify client
        notifyClient({
          clientId:   session.client_id,
          activityId: session.activity_id,
          type:       'session_rejected',
          title:      '❌ Sessione rifiutata',
          message:    'Il trainer non può confermare questa sessione. Puoi proporre un nuovo orario.',
        });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Errore');
    } finally {
      setLoading(false);
    }
  };

  const clientName = session.client?.name ?? (role === 'trainer' ? 'Cliente' : 'Il tuo trainer');

  return (
    <div className={`rounded-xl border p-4 transition-all ${
      isLocked ? 'border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/10' :
      isClosed  ? 'border-slate-200 bg-slate-50/60 dark:bg-slate-900/20 opacity-70' :
      isMyTurn  ? 'border-violet-200 bg-violet-50/40 dark:bg-violet-950/10 shadow-sm' :
                  'border-border bg-muted/20'
    }`}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          {role === 'trainer' && (
            <div className="flex items-center gap-1.5 mb-1">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="font-semibold text-sm">{clientName}</span>
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={session.status} />
            {isMyTurn && !isClosed && !isLocked && (
              <span className="text-[10px] font-semibold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full animate-pulse">
                • In attesa di te
              </span>
            )}
          </div>
        </div>
        {isLocked && <Lock className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
      </div>

      {/* Proposed time */}
      {session.scheduled_at && (
        <div className="flex items-center gap-2 text-sm mb-2">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-medium">{formatDT(session.scheduled_at)}</span>
        </div>
      )}

      {/* Proposed-by label */}
      {latestProposal && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
          <Clock className="w-3 h-3" />
          Ultima proposta da{' '}
          <span className={latestProposal.proposed_by === 'trainer' ? 'text-violet-600 font-medium' : 'text-emerald-600 font-medium'}>
            {latestProposal.proposed_by === 'trainer' ? 'te (trainer)' : (role === 'trainer' ? clientName : 'te')}
          </span>
          {latestProposal.notes && (
            <span className="italic ml-1 text-muted-foreground">"{latestProposal.notes}"</span>
          )}
        </div>
      )}

      {/* Notes */}
      {session.notes && (
        <p className="text-xs text-muted-foreground italic mb-2">"{session.notes}"</p>
      )}

      {/* Confirmed block */}
      {isLocked && (
        <div className="mt-2 p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center gap-2 text-xs text-emerald-700">
          <Lock className="w-3.5 h-3.5" />
          <span className="font-medium">Orario confermato e bloccato.</span>
          {role === 'cliente' && (
            <span className="ml-auto text-muted-foreground">Per modifiche contatta il trainer.</span>
          )}
        </div>
      )}

      {/* Cancelled/rejected */}
      {isClosed && session.cancel_reason && (
        <p className="text-xs text-red-600 mt-1">{session.cancel_reason}</p>
      )}

      {/* Actions (only when it's my turn) */}
      {isMyTurn && !showCounter && (
        <div className="flex flex-wrap gap-2 mt-3">
          {/* Confirm */}
          <Button
            size="sm"
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => doAction('confermata')}
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Conferma
          </Button>
          {/* Counter-propose */}
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            className="border-violet-300 text-violet-700 hover:bg-violet-50"
            onClick={() => setShowCounter(true)}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Proponi altro orario
          </Button>
          {/* Reject */}
          <Button
            size="sm"
            variant="ghost"
            disabled={loading}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => doAction('rifiutata')}
          >
            <XCircle className="w-3.5 h-3.5 mr-1" /> Rifiuta
          </Button>
        </div>
      )}

      {/* Counter-propose form */}
      {showCounter && (
        <CounterProposeForm
          session={session}
          role={role}
          onDone={() => setShowCounter(false)}
          onCancel={() => setShowCounter(false)}
        />
      )}

      {/* Proposal history */}
      <ProposalHistory proposals={proposals} />
    </div>
  );
}

// ── Availability helpers ───────────────────────────────────────────────────────

const IT_MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const CAL_DAYS  = ['L','M','M','G','V','S','D'];

function toHHmm(t: string) { return t.slice(0, 5); }

/** Generate hourly slots within an availability range */
function genSlots(avail: TrainerAvailability[], dow: number): string[] {
  const ranges = avail.filter(a => a.day_of_week === dow);
  const slots: string[] = [];
  for (const r of ranges) {
    const [sh, sm] = r.start_time.split(':').map(Number);
    const [eh, em] = r.end_time.split(':').map(Number);
    let cur = sh * 60 + sm;
    const end = eh * 60 + em;
    while (cur + 60 <= end) {
      slots.push(`${String(Math.floor(cur / 60)).padStart(2,'0')}:${String(cur % 60).padStart(2,'0')}`);
      cur += 60;
    }
  }
  return slots;
}

/** Mini calendar that disables days without trainer availability */
function AvailabilityCalendar({
  avail,
  onSelect,
}: {
  avail: TrainerAvailability[];
  onSelect: (date: string) => void;
}) {
  const today = new Date();
  const [vy, setVy] = useState(today.getFullYear());
  const [vm, setVm] = useState(today.getMonth());
  const [sel, setSel] = useState<string | null>(null);

  const availDows = new Set(avail.map(a => a.day_of_week));
  const hasConfig  = avail.length > 0;

  const firstDow = new Date(vy, vm, 1).getDay(); // JS: 0=Sun
  const startOff = (firstDow + 6) % 7;           // Mon-first offset
  const daysInM  = new Date(vy, vm + 1, 0).getDate();
  const cells    = [...Array(startOff).fill(null), ...Array.from({length: daysInM}, (_, i) => i + 1)];

  const todayStr = today.toISOString().slice(0, 10);

  const isEnabled = (day: number) => {
    const d   = new Date(vy, vm, day);
    const str = d.toISOString().slice(0, 10);
    if (str < todayStr) return false;
    if (!hasConfig) return true;
    return availDows.has(d.getDay());
  };

  const prevMonth = () => { if (vm === 0) { setVy(y => y - 1); setVm(11); } else setVm(m => m - 1); };
  const nextMonth = () => { if (vm === 11) { setVy(y => y + 1); setVm(0); } else setVm(m => m + 1); };

  return (
    <div className="select-none">
      {/* Nav */}
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-muted transition-colors">
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <span className="text-xs font-semibold">{IT_MONTHS[vm]} {vy}</span>
        <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-muted transition-colors">
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 mb-1">
        {CAL_DAYS.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-semibold text-muted-foreground">{d}</div>
        ))}
      </div>
      {/* Cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const enabled  = isEnabled(day);
          const dateStr  = `${vy}-${String(vm + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const isSelected = sel === dateStr;
          return (
            <button
              key={i}
              type="button"
              disabled={!enabled}
              onClick={() => { setSel(dateStr); onSelect(dateStr); }}
              className={`mx-auto w-7 h-7 flex items-center justify-center rounded-full text-xs transition-all
                ${isSelected ? 'bg-emerald-600 text-white font-bold shadow-sm' : ''}
                ${enabled && !isSelected ? 'hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-foreground' : ''}
                ${!enabled ? 'opacity-20 cursor-not-allowed text-muted-foreground' : ''}
              `}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── New Session Proposal Form (client only) ────────────────────────────────────
function NewSessionProposalForm({
  clientId,
  activityId,
  onDone,
}: {
  clientId: string;
  activityId: string;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [date, setDate]     = useState('');
  const [time, setTime]     = useState('');
  const [notes, setNotes]   = useState('');
  const [saving, setSaving] = useState(false);
  const [open, setOpen]     = useState(false);

  // Fetch trainer availability (client-readable via RLS)
  const { data: avail = [] } = useQuery<TrainerAvailability[]>({
    queryKey: ['trainer-availability-client', activityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trainer_availability')
        .select('*')
        .eq('activity_id', activityId)
        .eq('is_active', true)
        .order('day_of_week')
        .order('start_time');
      if (error && error.code !== '42P01') return [];
      return (data ?? []) as TrainerAvailability[];
    },
    enabled: !!activityId && open,
    staleTime: 5 * 60 * 1000,
  });

  const hasAvail = avail.length > 0;

  // Time slots for chosen date
  const slots = useMemo(() => {
    if (!date) return [];
    const dow = new Date(date + 'T12:00:00').getDay(); // noon avoids DST issues
    return genSlots(avail, dow);
  }, [date, avail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !time) { toast.error('Inserisci data e ora'); return; }
    const iso = new Date(`${date}T${time}:00`).toISOString();
    setSaving(true);
    try {
      const { data: sess, error: sessErr } = await supabase
        .from('sessions')
        .insert({
          client_id:    clientId,
          activity_id:  activityId,
          scheduled_at: iso,
          status:       'proposta',
          proposed_by:  'cliente',
          notes:        notes || null,
          proposed_times: [],
        } as never)
        .select('id')
        .single();
      if (sessErr) throw sessErr;

      await supabase.from('session_proposals').insert({
        session_id:   sess.id,
        proposed_by:  'cliente',
        scheduled_at: iso,
        notes:        notes || null,
      } as never);

      notifyTrainer({
        activityId,
        type:    'session_proposed',
        title:   '📨 Nuova richiesta sessione',
        message: `Un cliente ha proposto una sessione per ${new Date(iso).toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.`,
      });

      qc.invalidateQueries({ queryKey: ['client-all-sessions'] });
      toast.success('Proposta inviata al trainer! 📨');
      setDate(''); setTime(''); setNotes(''); setOpen(false);
      onDone();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Errore');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-dashed border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all text-emerald-700 dark:text-emerald-400 text-sm font-medium"
      >
        <span>+ Proponi una sessione al trainer</span>
        <Calendar className="w-4 h-4" />
      </button>
    );
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-4"
    >
      <p className="font-semibold text-sm text-emerald-800 dark:text-emerald-300">Proponi una sessione</p>

      {/* ── Date picker ── */}
      <div>
        <Label className="text-xs mb-2 block">Scegli il giorno *</Label>
        {hasAvail ? (
          <>
            <div className="rounded-lg border border-border bg-background p-3">
              <AvailabilityCalendar avail={avail} onSelect={(d) => { setDate(d); setTime(''); }} />
            </div>
            {hasAvail && (
              <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                I giorni in grigio non sono disponibili
              </p>
            )}
          </>
        ) : (
          <Input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
            className="h-9 text-sm"
            required
          />
        )}
      </div>

      {/* ── Time slot picker or free input ── */}
      <div>
        <Label className="text-xs mb-2 block">Orario *</Label>
        {hasAvail && date ? (
          slots.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {slots.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setTime(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-all font-medium
                    ${time === s
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'border-border hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                    }`}
                >
                  {toHHmm(s)}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2">
              Nessuno slot disponibile per questo giorno. Seleziona un altro giorno.
            </p>
          )
        ) : (
          <Input
            type="time"
            value={time}
            onChange={e => setTime(e.target.value)}
            className="h-9 text-sm"
            required={!hasAvail}
          />
        )}
      </div>

      {/* Selected summary */}
      {date && time && (
        <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg px-3 py-2">
          <Calendar className="w-3.5 h-3.5" />
          {new Date(`${date}T${time}:00`).toLocaleString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      {/* Notes */}
      <div>
        <Label className="text-xs">Messaggio al trainer (opzionale)</Label>
        <Textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="es. Posso solo di mattina, preferibilmente dopo le 9"
          className="text-sm min-h-[60px] mt-1"
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={saving || !date || !time} className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1">
          {saving ? 'Invio...' : '📨 Invia proposta'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annulla</Button>
      </div>
    </motion.form>
  );
}


// ── Main Panel Export ──────────────────────────────────────────────────────────

interface SessionNegotiationPanelProps {
  sessions: CoachSession[];
  role: 'trainer' | 'cliente';
  /** Client-side only: clientId + activityId to create new proposals */
  clientId?: string;
  activityId?: string;
  title?: string;
  emptyMessage?: string;
}

export function SessionNegotiationPanel({
  sessions,
  role,
  clientId,
  activityId,
  title,
  emptyMessage,
}: SessionNegotiationPanelProps) {
  // Separate active (pending action) from settled
  const active = sessions.filter(s => !['confermata', 'completata', 'rifiutata', 'annullata'].includes(s.status));
  const confirmed = sessions.filter(s => s.status === 'confermata');
  const closed = sessions.filter(s => ['rifiutata', 'annullata'].includes(s.status));
  const completed = sessions.filter(s => s.status === 'completata');
  const [showAllSessions, setShowAllSessions] = useState(false);

  const pending = active.filter(s => {
    // Sessions where it's MY turn
    const lastProp = s.proposals?.[s.proposals.length - 1];
    if (!lastProp) return role === 'trainer'; // trainer sees fresh proposals
    return lastProp.proposed_by !== role;
  });
  const waiting = active.filter(s => {
    const lastProp = s.proposals?.[s.proposals.length - 1];
    if (!lastProp) return role !== 'trainer';
    return lastProp.proposed_by === role;
  });
  const orderedSessions = [...pending, ...waiting, ...confirmed, ...completed, ...closed];
  const visibleSessionIds = new Set(
    (showAllSessions ? orderedSessions : orderedSessions.slice(0, 3)).map(s => s.id)
  );
  const hiddenCount = Math.max(orderedSessions.length - 3, 0);
  const visibleOnly = (list: CoachSession[]) =>
    showAllSessions ? list : list.filter(s => visibleSessionIds.has(s.id));

  return (
    <div className="space-y-4">
      {title && (
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          {pending.length > 0 && (
            <span className="bg-violet-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {pending.length} in attesa
            </span>
          )}
        </div>
      )}

      {/* New proposal CTA for clients */}
      {role === 'cliente' && clientId && activityId && (
        <NewSessionProposalForm clientId={clientId} activityId={activityId} onDone={() => {}} />
      )}

      {/* Pending my action */}
      {visibleOnly(pending).length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> In attesa di risposta
          </p>
          {visibleOnly(pending).map(s => <SessionCard key={s.id} session={s} role={role} />)}
        </div>
      )}

      {/* Waiting for other party */}
      {visibleOnly(waiting).length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 flex items-center gap-1">
            <Clock className="w-3 h-3" /> In attesa dell'altro
          </p>
          {visibleOnly(waiting).map(s => <SessionCard key={s.id} session={s} role={role} />)}
        </div>
      )}

      {/* Confirmed sessions */}
      {visibleOnly(confirmed).length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Sessioni confermate
          </p>
          {visibleOnly(confirmed).map(s => <SessionCard key={s.id} session={s} role={role} />)}
        </div>
      )}

      {/* Completed */}
      {visibleOnly(completed).length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 flex items-center gap-1">
            🏁 Completate
          </p>
          {visibleOnly(completed).map(s => <SessionCard key={s.id} session={s} role={role} />)}
        </div>
      )}

      {/* Closed (rejected/cancelled) */}
      {visibleOnly(closed).length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700 flex items-center gap-1">
            <XCircle className="w-3 h-3" /> Chiuse
          </p>
          {visibleOnly(closed).map(s => <SessionCard key={s.id} session={s} role={role} />)}
        </div>
      )}

      {hiddenCount > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => setShowAllSessions(prev => !prev)}
        >
          {showAllSessions ? 'Mostra meno' : `Vedi tutte (${orderedSessions.length})`}
        </Button>
      )}

      {/* Empty state */}
      {sessions.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          {emptyMessage ?? 'Nessuna sessione trovata.'}
        </div>
      )}
    </div>
  );
}
