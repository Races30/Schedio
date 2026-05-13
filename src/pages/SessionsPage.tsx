import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  History, X, User, Calendar, Clock, CheckCircle2,
  AlertCircle, XCircle, HelpCircle, RotateCcw, Filter,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type SessionStatus = 'proposta' | 'confermata' | 'completata' | 'rifiutata';
type PeriodOption  = '7' | '30' | '90' | 'all';

interface SessionRow {
  id: string;
  status: SessionStatus;
  scheduled_at: string | null;
  confirmed_at: string | null;
  notes: string | null;
  created_at: string;
  client: { id: string; name: string } | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: SessionStatus | 'all'; label: string }[] = [
  { value: 'all',        label: 'Tutti gli stati' },
  { value: 'proposta',   label: 'Proposta' },
  { value: 'confermata', label: 'Confermata' },
  { value: 'completata', label: 'Completata' },
  { value: 'rifiutata',  label: 'Rifiutata' },
];

const PERIOD_OPTIONS: { value: PeriodOption; label: string }[] = [
  { value: '7',   label: 'Ultima settimana' },
  { value: '30',  label: 'Ultimo mese' },
  { value: '90',  label: 'Ultimi 3 mesi' },
  { value: 'all', label: 'Tutto' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatDateShort(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<SessionStatus, {
  label: string; icon: React.ElementType; bg: string; text: string; dot: string;
}> = {
  proposta:   { label: 'Proposta',   icon: HelpCircle,   bg: 'bg-amber-500/10',   text: 'text-amber-600',   dot: 'bg-amber-500' },
  confermata: { label: 'Confermata', icon: Calendar,      bg: 'bg-sky-500/10',     text: 'text-sky-600',     dot: 'bg-sky-500' },
  completata: { label: 'Completata', icon: CheckCircle2,  bg: 'bg-emerald-500/10', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  rifiutata:  { label: 'Rifiutata',  icon: XCircle,       bg: 'bg-red-500/10',     text: 'text-red-600',     dot: 'bg-red-500' },
};

function StatusBadge({ status }: { status: SessionStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.proposta;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Active filter pill
// ─────────────────────────────────────────────────────────────────────────────

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium pl-2.5 pr-1.5 py-1 rounded-full"
    >
      {label}
      <button onClick={onRemove} className="hover:bg-primary/20 rounded-full p-0.5 transition-colors">
        <X className="w-3 h-3" />
      </button>
    </motion.span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function SessionsPage() {
  const { activity } = useAuth();
  const activityId = activity?.id ?? null;

  // ── Filter state ──────────────────────────────────────────────────────────
  const [clientFilter, setClientFilter]  = useState<string>('all');
  const [statusFilter, setStatusFilter]  = useState<SessionStatus | 'all'>('all');
  const [periodFilter, setPeriodFilter]  = useState<PeriodOption>('30');

  const hasActiveFilters = clientFilter !== 'all' || statusFilter !== 'all' || periodFilter !== '30';

  const resetFilters = useCallback(() => {
    setClientFilter('all');
    setStatusFilter('all');
    setPeriodFilter('30');
  }, []);

  // Date cutoff derived from period filter
  const dateCutoff = useMemo(() => {
    if (periodFilter === 'all') return null;
    return daysAgo(Number(periodFilter));
  }, [periodFilter]);

  // ── Fetch clients (for dropdown) ──────────────────────────────────────────
  const { data: clients = [] } = useQuery({
    queryKey: ['sessions-page-clients', activityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .eq('activity_id', activityId!)
        .order('name');
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
    enabled: !!activityId,
  });

  // ── Fetch sessions (queryKey includes all filters → auto-refetch) ─────────
  const {
    data: sessions = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['sessions-history', activityId, clientFilter, statusFilter, dateCutoff],
    queryFn: async () => {
      let query = supabase
        .from('sessions')
        .select('id, status, scheduled_at, confirmed_at, notes, created_at, client:clients(id, name)')
        .eq('activity_id', activityId!)
        .order('scheduled_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (clientFilter !== 'all') {
        query = query.eq('client_id', clientFilter);
      }
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (dateCutoff) {
        // filter by created_at OR scheduled_at being in range
        query = query.gte('created_at', dateCutoff);
      }

      const { data, error } = await query.limit(200);
      if (error) throw error;
      return (data ?? []) as SessionRow[];
    },
    enabled: !!activityId,
  });

  // ── Active filter labels (for pills) ─────────────────────────────────────
  const activeFilterPills = useMemo(() => {
    const pills: { key: string; label: string; onRemove: () => void }[] = [];
    if (clientFilter !== 'all') {
      const client = clients.find((c) => c.id === clientFilter);
      pills.push({ key: 'client', label: client?.name ?? 'Cliente', onRemove: () => setClientFilter('all') });
    }
    if (statusFilter !== 'all') {
      const opt = STATUS_OPTIONS.find((o) => o.value === statusFilter);
      pills.push({ key: 'status', label: opt?.label ?? statusFilter, onRemove: () => setStatusFilter('all') });
    }
    if (periodFilter !== '30') {
      const opt = PERIOD_OPTIONS.find((o) => o.value === periodFilter);
      pills.push({ key: 'period', label: opt?.label ?? periodFilter, onRemove: () => setPeriodFilter('30') });
    }
    return pills;
  }, [clientFilter, statusFilter, periodFilter, clients]);

  // ── Stats summary ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total      = sessions.length;
    const completate = sessions.filter((s) => s.status === 'completata').length;
    const confermate = sessions.filter((s) => s.status === 'confermata').length;
    const rifiutate  = sessions.filter((s) => s.status === 'rifiutata').length;
    return { total, completate, confermate, rifiutate };
  }, [sessions]);

  if (!activity) return null;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="w-6 h-6 text-primary" /> Storico sessioni
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {activity.name} · {sessions.length} risultati
          </p>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="glass-card p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Client filter */}
          <div className="flex flex-col gap-1 min-w-[180px] flex-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <User className="w-3 h-3" /> Cliente
            </label>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className={clientFilter !== 'all' ? 'border-primary ring-1 ring-primary/30' : ''}>
                <SelectValue placeholder="Tutti i clienti" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i clienti</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status filter */}
          <div className="flex flex-col gap-1 min-w-[160px] flex-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Stato
            </label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as SessionStatus | 'all')}>
              <SelectTrigger className={statusFilter !== 'all' ? 'border-primary ring-1 ring-primary/30' : ''}>
                <SelectValue placeholder="Tutti gli stati" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Period filter */}
          <div className="flex flex-col gap-1 min-w-[160px] flex-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> Periodo
            </label>
            <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodOption)}>
              <SelectTrigger className={periodFilter !== '30' ? 'border-primary ring-1 ring-primary/30' : ''}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reset button */}
          <AnimatePresence>
            {hasActiveFilters && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden"
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetFilters}
                  className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/5 whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset filtri
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Active filter pills */}
        <AnimatePresence>
          {activeFilterPills.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border"
            >
              <span className="text-xs text-muted-foreground flex items-center gap-1 self-center">
                <Filter className="w-3 h-3" /> Filtri attivi:
              </span>
              <AnimatePresence>
                {activeFilterPills.map((pill) => (
                  <FilterPill key={pill.key} label={pill.label} onRemove={pill.onRemove} />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Quick stats ── */}
      {!isLoading && sessions.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Totale', value: stats.total,      color: 'text-foreground',    bg: 'bg-muted/50' },
            { label: 'Completate', value: stats.completate, color: 'text-emerald-600', bg: 'bg-emerald-500/5' },
            { label: 'Confermate', value: stats.confermate, color: 'text-sky-600',     bg: 'bg-sky-500/5' },
            { label: 'Rifiutate',  value: stats.rifiutate,  color: 'text-red-600',     bg: 'bg-red-500/5' },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl px-4 py-3 ${s.bg}`}>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── List ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : isError ? (
        <div className="glass-card p-8 text-center text-muted-foreground">
          <XCircle className="w-8 h-8 mx-auto mb-2 text-destructive" />
          <p>Errore nel caricamento delle sessioni. Riprova.</p>
        </div>
      ) : sessions.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card p-12 text-center"
        >
          <History className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="font-medium text-muted-foreground">Nessuna sessione trovata</p>
          {hasActiveFilters && (
            <p className="text-sm text-muted-foreground mt-1">
              Prova a modificare i filtri o{' '}
              <button onClick={resetFilters} className="text-primary hover:underline">
                resettali tutti
              </button>
            </p>
          )}
        </motion.div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {sessions.map((session, idx) => (
              <SessionCard key={session.id} session={session} index={idx} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Session card
// ─────────────────────────────────────────────────────────────────────────────

function SessionCard({ session, index }: { session: SessionRow; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[session.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      className="glass-card overflow-hidden"
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left p-4 flex flex-col sm:flex-row sm:items-center gap-3"
      >
        {/* Status dot stripe */}
        <div className={`hidden sm:block w-1 self-stretch rounded-full flex-shrink-0 ${cfg?.dot ?? 'bg-muted'}`} />

        {/* Client + date */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">
              {session.client?.name ?? <span className="text-muted-foreground italic">Cliente rimosso</span>}
            </span>
            <StatusBadge status={session.status} />
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            {session.scheduled_at ? (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDateShort(session.scheduled_at)}
              </span>
            ) : (
              <span className="flex items-center gap-1 italic">
                <Clock className="w-3 h-3" /> Data da definire
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Creata: {formatDateShort(session.created_at)}
            </span>
          </div>
        </div>

        {/* Expand chevron */}
        <div className={`text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t border-border grid sm:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">Confermata il</div>
                <div>{formatDateTime(session.confirmed_at)}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">Programmata per</div>
                <div>{formatDateTime(session.scheduled_at)}</div>
              </div>
              {session.notes && (
                <div className="sm:col-span-2">
                  <div className="text-xs font-medium text-muted-foreground mb-1">Note</div>
                  <div className="bg-muted/40 rounded-lg px-3 py-2 text-sm">{session.notes}</div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
