import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Users, CheckCircle2, Calendar,
  BarChart2, Clock, Dumbbell, AlertCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfPrevMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1);
}
function endOfPrevMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 0, 23, 59, 59);
}
function isoDate(d: Date) {
  return d.toISOString().split('T')[0];
}
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

/** Returns Monday of the ISO week containing `d` */
function weekStart(d: Date) {
  const day = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  const m = new Date(d);
  m.setDate(m.getDate() - day);
  m.setHours(0, 0, 0, 0);
  return m;
}

/** "12 mag" Italian short date */
function shortDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

/** "12 mag 2026" Italian long date */
function longDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  trend?: number | null;
  color?: string;
  delay?: number;
}

function StatCard({ icon: Icon, label, value, sub, trend, color = 'text-primary', delay = 0 }: StatCardProps) {
  const hasTrend  = trend !== null && trend !== undefined;
  const isPositive = hasTrend && trend! >= 0;
  const TrendIcon  = isPositive ? TrendingUp : TrendingDown;
  const trendColor = isPositive ? 'text-emerald-500' : 'text-red-500';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="glass-card p-5 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground font-medium">{label}</span>
        <div className={`w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="text-3xl font-bold tracking-tight">{value}</div>
      {(sub || hasTrend) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {hasTrend && (
            <span className={`flex items-center gap-0.5 font-semibold ${trendColor}`}>
              <TrendIcon className="w-3.5 h-3.5" />
              {Math.abs(trend!).toFixed(1)}%
            </span>
          )}
          {sub && <span>{sub}</span>}
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { activity } = useAuth();
  const activityId = activity?.id ?? null;

  const now             = new Date();
  const thisMonthStart  = isoDate(startOfMonth(now));
  const prevMonthStart  = isoDate(startOfPrevMonth(now));
  const prevMonthEnd    = isoDate(endOfPrevMonth(now));
  const twoMonthsAgo    = isoDate(daysAgo(60));
  const thirtyDaysAgo   = isoDate(daysAgo(30));
  const fourteenDaysAgo = isoDate(daysAgo(14));

  // ── 1. All sessions in last 2 months ─────────────────────────────────────
  const { data: sessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ['analytics-sessions', activityId, twoMonthsAgo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, status, scheduled_at, client_id, created_at')
        .eq('activity_id', activityId!)
        .gte('scheduled_at', twoMonthsAgo)
        .order('scheduled_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        status: string;
        scheduled_at: string;
        client_id: string;
        created_at: string;
      }[];
    },
    enabled: !!activityId,
  });

  // ── 2. All-time session count ─────────────────────────────────────────────
  const { data: totalAllTime = 0 } = useQuery({
    queryKey: ['analytics-total-sessions', activityId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .eq('activity_id', activityId!);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!activityId,
  });

  // ── 3. All clients ─────────────────────────────────────────────────────────
  const { data: clients = [], isLoading: loadingClients } = useQuery({
    queryKey: ['analytics-clients', activityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, last_completed_at')
        .eq('activity_id', activityId!);
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; last_completed_at: string | null }[];
    },
    enabled: !!activityId,
  });

  // ── 4. Top exercises from session_exercises ───────────────────────────────
  const { data: sessionExercises = [], isLoading: loadingExercises } = useQuery({
    queryKey: ['analytics-session-exercises', activityId],
    queryFn: async () => {
      const { data: actSessions } = await supabase
        .from('sessions')
        .select('id')
        .eq('activity_id', activityId!);

      const sessionIds = (actSessions ?? []).map((s: { id: string }) => s.id);
      if (sessionIds.length === 0) return [];

      const { data, error } = await supabase
        .from('session_exercises')
        .select('exercise_id, exercise:exercises(name)')
        .in('session_id', sessionIds);
      if (error) throw error;
      return (data ?? []) as { exercise_id: string; exercise: { name: string } | null }[];
    },
    enabled: !!activityId,
  });

  // ── Derived metrics ────────────────────────────────────────────────────────

  const thisMonthSessions = useMemo(
    () => sessions.filter((s) => s.scheduled_at >= thisMonthStart + 'T00:00:00'),
    [sessions, thisMonthStart],
  );

  const prevMonthSessions = useMemo(
    () => sessions.filter(
      (s) => s.scheduled_at >= prevMonthStart + 'T00:00:00' &&
             s.scheduled_at <= prevMonthEnd   + 'T23:59:59',
    ),
    [sessions, prevMonthStart, prevMonthEnd],
  );

  const monthTrend = useMemo(() => {
    if (prevMonthSessions.length === 0) return null;
    return ((thisMonthSessions.length - prevMonthSessions.length) / prevMonthSessions.length) * 100;
  }, [thisMonthSessions, prevMonthSessions]);

  const activeClientIds = useMemo(() => new Set(
    sessions
      .filter((s) => s.scheduled_at >= thirtyDaysAgo + 'T00:00:00')
      .map((s) => s.client_id),
  ), [sessions, thirtyDaysAgo]);

  const totalClients  = clients.length;
  const activeClients = clients.filter((c) => activeClientIds.has(c.id)).length;

  const completedInWindow = useMemo(
    () => sessions.filter((s) => s.status === 'completata').length,
    [sessions],
  );
  const confirmedInWindow = useMemo(
    () => sessions.filter((s) => ['confermata', 'completata'].includes(s.status)).length,
    [sessions],
  );
  const completionRate = confirmedInWindow > 0
    ? Math.round((completedInWindow / confirmedInWindow) * 100)
    : 0;

  // Inactive clients: no session in last 14 days
  const inactiveClients = useMemo(() => {
    const activeSet = new Set(
      sessions
        .filter((s) => s.scheduled_at >= fourteenDaysAgo + 'T00:00:00')
        .map((s) => s.client_id),
    );
    return clients
      .filter((c) => !activeSet.has(c.id))
      .sort((a, b) => {
        if (!a.last_completed_at) return -1;
        if (!b.last_completed_at) return 1;
        return new Date(a.last_completed_at).getTime() - new Date(b.last_completed_at).getTime();
      });
  }, [clients, sessions, fourteenDaysAgo]);

  // Top 5 exercises
  const topExercises = useMemo(() => {
    const counts: Record<string, { name: string; count: number }> = {};
    for (const se of sessionExercises) {
      const name = se.exercise?.name ?? 'Sconosciuto';
      if (!counts[se.exercise_id]) counts[se.exercise_id] = { name, count: 0 };
      counts[se.exercise_id].count++;
    }
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [sessionExercises]);

  // Weekly bar chart — last 8 ISO-weeks
  const weeklyData = useMemo(() => {
    // Build ordered list of 8 week-start keys
    const buckets: string[] = [];
    for (let i = 7; i >= 0; i--) {
      buckets.push(isoDate(weekStart(daysAgo(i * 7))));
    }

    const weekMap: Record<string, number> = {};
    for (const k of buckets) weekMap[k] = 0;

    for (const s of sessions) {
      const ws = isoDate(weekStart(new Date(s.scheduled_at)));
      if (ws in weekMap) weekMap[ws]++;
    }

    return buckets.map((k) => ({ label: shortDate(k), sessioni: weekMap[k] }));
  }, [sessions]);

  const isLoading = loadingSessions || loadingClients || loadingExercises;

  if (!activity) return null;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart2 className="w-6 h-6 text-primary" /> Analytics
        </h1>
        <p className="text-muted-foreground mt-1">Report attività · {activity.name}</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-32">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── KPI Cards ── */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={Calendar}
              label="Sessioni questo mese"
              value={thisMonthSessions.length}
              sub={`vs ${prevMonthSessions.length} mese scorso`}
              trend={monthTrend}
              delay={0}
            />
            <StatCard
              icon={Users}
              label="Clienti attivi (30 gg)"
              value={`${activeClients} / ${totalClients}`}
              sub="almeno 1 sessione"
              color="text-sky-500"
              delay={0.07}
            />
            <StatCard
              icon={CheckCircle2}
              label="Tasso completamento"
              value={`${completionRate}%`}
              sub={`${completedInWindow} completate / ${confirmedInWindow} confermate`}
              color="text-emerald-500"
              delay={0.14}
            />
            <StatCard
              icon={TrendingUp}
              label="Sessioni totali"
              value={totalAllTime}
              sub="da sempre"
              color="text-violet-500"
              delay={0.21}
            />
          </section>

          {/* ── Bar Chart ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.35 }}
            className="glass-card p-6 mb-8"
          >
            <h2 className="text-base font-semibold mb-5 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Sessioni per settimana · ultimi 2 mesi
            </h2>
            {weeklyData.every((w) => w.sessioni === 0) ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nessuna sessione registrata nel periodo
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={weeklyData}
                  barSize={28}
                  margin={{ top: 4, right: 8, bottom: 0, left: -20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))' }}
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                    formatter={(v: number) => [v, 'Sessioni']}
                  />
                  <Bar
                    dataKey="sessioni"
                    fill="hsl(var(--primary))"
                    radius={[6, 6, 0, 0] as [number, number, number, number]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          {/* ── Lists ── */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Inactive clients */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.35 }}
              className="glass-card p-6"
            >
              <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Clienti inattivi da oltre 2 settimane
                {inactiveClients.length > 0 && (
                  <span className="ml-auto bg-amber-500/10 text-amber-600 text-xs font-bold px-2 py-0.5 rounded-full">
                    {inactiveClients.length}
                  </span>
                )}
              </h2>
              {inactiveClients.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  <p className="text-sm">Tutti i clienti sono attivi di recente</p>
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {inactiveClients.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                      <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-sm font-semibold text-amber-600 flex-shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{c.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Ultima sessione: {longDate(c.last_completed_at)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>

            {/* Top exercises */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.42, duration: 0.35 }}
              className="glass-card p-6"
            >
              <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-violet-500" />
                Top 5 esercizi più usati
              </h2>
              {topExercises.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Nessun esercizio registrato nelle sessioni
                </p>
              ) : (
                <ol className="space-y-3">
                  {topExercises.map((ex, i) => {
                    const pct = topExercises[0].count > 0
                      ? Math.round((ex.count / topExercises[0].count) * 100)
                      : 0;
                    return (
                      <li key={i} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-5 text-right flex-shrink-0">
                          {i + 1}.
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium truncate">{ex.name}</span>
                            <span className="text-muted-foreground ml-2 flex-shrink-0">
                              {ex.count}×
                            </span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-violet-500 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </motion.div>
          </div>
        </>
      )}
    </div>
  );
}
