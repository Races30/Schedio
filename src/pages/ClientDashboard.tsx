/**
 * ClientDashboard
 *
 * The client-facing dashboard. Features:
 *  - Next session card + mini calendar
 *  - Countdown to next session
 *  - Active workout plan + "Start workout" button
 *  - Exercise progress sparklines
 *  - Session negotiation panel (proposals)
 *  - Full guided workout player (with timer, rest phase, feedback step)
 */
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  LogOut, Calendar, Clock, Play, TrendingUp, CheckCircle2, Dumbbell,
  Inbox, ChevronRight, SkipForward,
} from 'lucide-react';
import { Client, ExerciseProgress, MEASURE_UNIT, WorkoutPlan } from '@/types';
import { ProgressIndicator } from '@/components/coach/ProgressIndicator';
import { SessionNegotiationPanel } from '@/components/coach/SessionNegotiationPanel';
import { SessionFeedbackForm } from '@/components/coach/SessionFeedbackForm';
import { useCoachSessions } from '@/hooks/useCoachSessions';
import { motion, AnimatePresence } from 'framer-motion';

export default function ClientDashboard() {
  const { clientProfile, signOut } = useAuth();
  const [workoutPlayerOpen, setWorkoutPlayerOpen] = useState(false);
  const client = clientProfile as Client | null;

  // All sessions for this client (negotiation + confirmed)
  const { data: coachSessions = [] } = useCoachSessions({ clientId: client?.id });

  // Next confirmed session
  const { data: sessions = [] } = useQuery({
    queryKey: ['client-sessions', client?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('sessions')
        .select('*')
        .eq('client_id', client!.id)
        .eq('status', 'confermata')
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at')
        .limit(5);
      return data || [];
    },
    enabled: !!client,
  });

  const nextSession = sessions[0] ?? null;
  const daysUntilNext = nextSession
    ? Math.ceil((new Date(nextSession.scheduled_at).getTime() - Date.now()) / 86400000)
    : null;

  // Active workout plan
  const { data: workoutPlan } = useQuery<WorkoutPlan | null>({
    queryKey: ['client-workout-plan', client?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('workout_plans')
        .select('*')
        .eq('client_id', client!.id)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as WorkoutPlan | null;
    },
    enabled: !!client,
  });

  // Last workout completion
  const { data: lastCompletion } = useQuery<{ completed_at: string } | null>({
    queryKey: ['client-last-completion', client?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('workout_completions')
        .select('completed_at')
        .eq('client_id', client!.id)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as { completed_at: string } | null;
    },
    enabled: !!client && !!workoutPlan,
  });

  // Exercise progress for chart
  const { data: progressRaw = [] } = useQuery<ExerciseProgress[]>({
    queryKey: ['client-exercise-progress', client?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('exercise_progress')
        .select('*, exercise:exercises(name, measure_type)')
        .eq('client_id', client!.id)
        .order('recorded_at', { ascending: false })
        .limit(50);
      return (data || []) as ExerciseProgress[];
    },
    enabled: !!client,
  });

  // Group by exercise for the chart
  const exerciseGroups = Object.values(
    progressRaw.reduce<Record<string, ExerciseProgress[]>>((acc, ep) => {
      if (!acc[ep.exercise_id]) acc[ep.exercise_id] = [];
      acc[ep.exercise_id].push(ep);
      return acc;
    }, {})
  ).slice(0, 5);

  // Client stats for history
  const { data: clientStats } = useQuery({
    queryKey: ['client-stats-history', client?.id],
    queryFn: async () => {
      const [sessionsRes, workoutsRes] = await Promise.all([
        supabase
          .from('sessions')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', client!.id)
          .eq('status', 'completata'),
        supabase
          .from('workout_completions')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', client!.id)
      ]);
      return {
        completedSessions: sessionsRes.count || 0,
        completedWorkouts: workoutsRes.count || 0,
      };
    },
    enabled: !!client,
  });

  if (!client) return null;


  const displayName = `${client.first_name || client.name}`;

  // Count sessions where the trainer has counter-proposed (awaiting client reply)
  const awaitingClientReply = coachSessions.filter(s => {
    if (!['proposta', 'controproposta'].includes(s.status)) return false;
    const last = s.proposals?.[s.proposals.length - 1];
    if (!last) return false;
    return last.proposed_by === 'trainer';
  }).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/40 to-background dark:from-emerald-950/10">
      {/* Header bar */}
      <header className="bg-emerald-600 text-white px-4 py-4 flex items-center justify-between">
        <div>
          <div className="font-bold text-lg">{displayName}</div>
          {client.last_name && <div className="text-emerald-100 text-sm">{client.last_name}</div>}
          {client.age && <div className="text-emerald-200 text-xs">{client.age} anni</div>}
        </div>
        <Button variant="ghost" size="icon" className="text-white hover:bg-emerald-700" onClick={signOut}>
          <LogOut className="w-5 h-5" />
        </Button>
      </header>

      <div className="p-4 max-w-lg mx-auto space-y-4 pb-8">

        {/* ─ Card 1: Prossima sessione ─ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-white dark:bg-card border border-border rounded-2xl p-4 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-semibold">Prossima sessione</span>
          </div>
          {nextSession ? (
            <MiniCalendar targetDate={new Date(nextSession.scheduled_at)} />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nessuna sessione confermata.<br />
              <span className="text-xs">Proponi una data al tuo trainer qui sotto.</span>
            </p>
          )}
        </motion.div>

        {/* ─ Card 2: Countdown ─ */}
        {nextSession && daysUntilNext !== null && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-emerald-600 text-white rounded-2xl p-5 text-center shadow-sm"
          >
            <div className="text-5xl font-extrabold mb-1">
              {daysUntilNext === 0 ? '🎯' : daysUntilNext}
            </div>
            <div className="text-emerald-100 font-medium">
              {daysUntilNext === 0
                ? 'Il tuo allenamento è oggi!'
                : `giorn${daysUntilNext === 1 ? 'o' : 'i'} al prossimo allenamento`}
            </div>
            <div className="text-emerald-200 text-xs mt-2 flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(nextSession.scheduled_at).toLocaleString('it-IT', {
                weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
              })}
            </div>
          </motion.div>
        )}

        {/* ─ Card: Status and Goals (Relation with Trainer & Objectives) ─ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
          className="bg-white dark:bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-400">
              Il tuo Percorso
            </div>
            {client.status === 'attivo' && (
              <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">
                In Attività
              </span>
            )}
            {client.status !== 'attivo' && client.status && (
              <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">
                {client.status}
              </span>
            )}
          </div>
          {(client.goal || (client.target_muscles && client.target_muscles.length > 0)) ? (
            <div className="text-sm text-muted-foreground flex flex-col gap-1">
              {client.goal && (
                <div className="flex items-start gap-2">
                  <strong className="text-foreground">Obiettivo:</strong> {client.goal}
                </div>
              )}
              {client.target_muscles && client.target_muscles.length > 0 && (
                <div className="flex items-start gap-2">
                  <strong className="text-foreground">Focus:</strong> {client.target_muscles.join(', ')}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Continua ad allenarti con il tuo trainer per definire i tuoi obiettivi specifici!
            </div>
          )}
        </motion.div>


        {/* ─ Card 3: Allenamento autonomo ─ */}
        {workoutPlan && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="bg-white dark:bg-card border border-emerald-200 dark:border-emerald-900 rounded-2xl p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Dumbbell className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-semibold">Allenamento autonomo</span>
                </div>
                <div className="text-xs text-muted-foreground">{workoutPlan.name}</div>
                {lastCompletion && (
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    Ultimo: {new Date(lastCompletion.completed_at).toLocaleDateString('it-IT', {
                      day: 'numeric', month: 'short',
                    })}
                  </div>
                )}
                {workoutPlan.trainer_notes && (
                  <div className="text-xs text-emerald-700 dark:text-emerald-400 mt-1 italic">
                    "{workoutPlan.trainer_notes}"
                  </div>
                )}
              </div>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                onClick={() => setWorkoutPlayerOpen(true)}
              >
                <Play className="w-4 h-4 mr-1" /> Inizia
              </Button>
            </div>
          </motion.div>
        )}

        {/* ─ Card 4: Progressi esercizi ─ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-white dark:bg-card border border-border rounded-2xl p-4 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-semibold">I tuoi progressi</span>
          </div>

          {exerciseGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Completa una sessione per vedere i tuoi progressi 💪
            </p>
          ) : (
            <div className="space-y-3">
              {exerciseGroups.map(entries => {
                const ex = entries[0].exercise;
                const exName = ex?.name ?? 'Esercizio';
                const measureType = entries[0].measure_type;
                const unit = MEASURE_UNIT[measureType as keyof typeof MEASURE_UNIT] ?? '';
                const sorted = [...entries].sort(
                  (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
                );
                const current  = sorted[sorted.length - 1].value;
                const previous = sorted.length > 1 ? sorted[sorted.length - 2].value : null;

                return (
                  <div key={entries[0].exercise_id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">{exName}</span>
                        <span className="text-sm font-bold text-emerald-600 flex-shrink-0">
                          {current} {unit}
                        </span>
                      </div>
                      {/* Sparkline bar */}
                      <div className="flex items-end gap-0.5 h-8 mt-1">
                        {sorted.slice(0, 8).map((ep, i) => {
                          const vals = sorted.map(e => e.value);
                          const min = Math.min(...vals);
                          const max = Math.max(...vals);
                          const range = max - min || 1;
                          const pct = Math.max(((ep.value - min) / range) * 100, 8);
                          return (
                            <div
                              key={ep.id}
                              className="flex-1 rounded-t transition-all"
                              style={{
                                height: `${pct}%`,
                                background: i === sorted.slice(0, 8).length - 1
                                  ? '#10b981'
                                  : '#d1fae5',
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                    <ProgressIndicator
                      current={current}
                      previous={previous}
                      measureType={measureType}
                      showDiff={true}
                      size="sm"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* ─ Card: Storico (Stats) ─ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
          className="grid grid-cols-2 gap-3"
        >
          <div className="bg-white dark:bg-card border border-border rounded-2xl p-4 shadow-sm text-center">
            <div className="text-xs text-muted-foreground font-semibold uppercase mb-1">Sessioni 1-a-1</div>
            <div className="text-3xl font-bold text-emerald-600">
              {clientStats?.completedSessions ?? 0}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Completate</div>
          </div>
          <div className="bg-white dark:bg-card border border-border rounded-2xl p-4 shadow-sm text-center">
            <div className="text-xs text-muted-foreground font-semibold uppercase mb-1">Autonomi</div>
            <div className="text-3xl font-bold text-violet-600">
              {clientStats?.completedWorkouts ?? 0}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Completati</div>
          </div>
        </motion.div>

        {/* ─ Card 5: Sessioni (proposals + confirmed) ─ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="bg-white dark:bg-card border border-border rounded-2xl p-4 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-4">
            <Inbox className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-semibold">Le mie sessioni</span>
            {awaitingClientReply > 0 && (
              <span className="bg-violet-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                Risposta richiesta
              </span>
            )}
          </div>
          <SessionNegotiationPanel
            sessions={coachSessions}
            role="cliente"
            clientId={client.id}
            activityId={client.activity_id}
            emptyMessage="Nessuna sessione. Usa il bottone qui sopra per proporne una!"
          />
        </motion.div>
      </div>

      {/* Workout player */}
      <AnimatePresence>
        {workoutPlayerOpen && workoutPlan && (
          <WorkoutPlayer
            plan={workoutPlan}
            clientId={client.id}
            sessionId={nextSession?.id}
            onClose={() => setWorkoutPlayerOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Mini Calendar ── */
function MiniCalendar({ targetDate }: { targetDate: Date }) {
  const today = new Date();
  const year  = targetDate.getFullYear();
  const month = targetDate.getMonth();
  const targetDay = targetDate.getDate();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay + 6) % 7;

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const DAYS = ['L','M','M','G','V','S','D'];

  return (
    <div>
      <div className="text-center text-sm font-semibold mb-2 text-emerald-700 dark:text-emerald-400">
        {targetDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {DAYS.map((d, i) => <div key={i} className="text-[10px] text-muted-foreground font-semibold">{d}</div>)}
        {cells.map((day, i) => {
          const isTarget2 = day === targetDay;
          const isToday   = day === today.getDate() && today.getMonth() === month && today.getFullYear() === year;
          return (
            <div
              key={i}
              className={`text-xs w-7 h-7 flex items-center justify-center rounded-full mx-auto
                ${isTarget2 ? 'bg-emerald-600 text-white font-bold' : ''}
                ${isToday && !isTarget2 ? 'border-2 border-emerald-400' : ''}
                ${!day ? 'opacity-0' : ''}`}
            >
              {day ?? ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Guided Workout Player ── */
interface WorkoutExercise {
  exercise_id: string;
  exercise_name: string;
  sets: number;
  reps_or_secs: number;
  measure_type: string;
  rest_secs: number;
  notes?: string;
}

type PlayerPhase = 'exercise' | 'rest' | 'done' | 'feedback';

function WorkoutPlayer({ plan, clientId, sessionId, onClose }: { plan: WorkoutPlan; clientId: string; sessionId?: string; onClose: () => void }) {
  const qc = useQueryClient();
  const exercises: WorkoutExercise[] = (plan.exercises as unknown as WorkoutExercise[]) ?? [];
  const [currentIdx, setCurrentIdx]   = useState(0);
  const [currentSet, setCurrentSet]   = useState(1);
  const [phase, setPhase]             = useState<PlayerPhase>('exercise');
  const [restSecs, setRestSecs]       = useState(0);
  const [timerSecs, setTimerSecs]     = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const ex = exercises[currentIdx];

  // Central tick — avoids stale closure issues via functional setters
  useEffect(() => {
    if (!timerActive) { if (intervalRef.current) clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(() => {
      if (phase === 'exercise') {
        setTimerSecs(s => {
          if (s <= 1) { clearInterval(intervalRef.current!); setTimerActive(false); return 0; }
          return s - 1;
        });
      } else if (phase === 'rest') {
        setRestSecs(s => {
          if (s <= 1) { clearInterval(intervalRef.current!); setTimerActive(false); doNextSet(); return 0; }
          return s - 1;
        });
      }
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerActive, phase]);

  const doNextSet = () => {
    if (!ex) return;
    if (currentSet < ex.sets) {
      setCurrentSet(s => s + 1);
      setPhase('exercise');
      setTimerSecs(0);
      setTimerActive(false);
    } else if (currentIdx < exercises.length - 1) {
      setCurrentIdx(i => i + 1);
      setCurrentSet(1);
      setPhase('exercise');
      setTimerSecs(0);
      setTimerActive(false);
    } else {
      finishWorkout();
    }
  };

  const startRest = () => {
    if (currentSet < ex.sets || currentIdx < exercises.length - 1) {
      setPhase('rest');
      setRestSecs(ex.rest_secs || 60);
      setTimerActive(true);
    } else {
      finishWorkout();
    }
  };

  const finishWorkout = async () => {
    setTimerActive(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    await supabase.from('workout_completions').insert({
      workout_plan_id: plan.id,
      client_id: clientId,
    });
    qc.invalidateQueries({ queryKey: ['client-last-completion', clientId] });
    setPhase('done');
    // Auto-advance to feedback after 2s
    setTimeout(() => setPhase('feedback'), 2000);
  };

  const progress = exercises.length > 0
    ? ((currentIdx * (ex?.sets ?? 1) + (currentSet - 1)) / exercises.reduce((t, e) => t + e.sets, 0)) * 100
    : 0;

  const isTimed = ex?.measure_type === 'secondi';

  // Feedback step
  if (phase === 'feedback') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-background flex flex-col z-50 overflow-y-auto"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <span className="font-semibold">Feedback sessione</span>
          <button onClick={onClose} className="text-muted-foreground text-sm">✕ Chiudi</button>
        </div>
        <div className="flex-1 p-6 max-w-md mx-auto w-full">
          <SessionFeedbackForm
            clientId={clientId}
            sessionId={sessionId}
            onDone={onClose}
          />
        </div>
      </motion.div>
    );
  }

  // Done celebration
  if (phase === 'done') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-emerald-600 flex flex-col items-center justify-center z-50 text-white p-8"
      >
        <CheckCircle2 className="w-20 h-20 mb-6" />
        <h2 className="text-3xl font-bold mb-2">Ottimo lavoro! 🎉</h2>
        <p className="text-emerald-100 mb-8 text-center">Allenamento completato!</p>
        <p className="text-emerald-200 text-sm">Caricamento feedback...</p>
      </motion.div>
    );
  }

  if (!ex) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-background flex flex-col z-50"
    >
      {/* Progress bar */}
      <div className="h-1.5 bg-muted">
        <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="text-sm text-muted-foreground">
          Esercizio {currentIdx + 1}/{exercises.length}
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">✕ Esci</button>
      </div>

      {phase === 'rest' ? (
        /* ─ Rest phase ─ */
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 bg-amber-50 dark:bg-amber-950/20">
          <p className="text-lg font-semibold text-amber-700">⏸ Recupero</p>
          <div className="text-8xl font-extrabold text-amber-600 tabular-nums">{restSecs}</div>
          <p className="text-muted-foreground">secondi</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setTimerActive(false); doNextSet(); }}>
              <SkipForward className="w-4 h-4 mr-1" /> Salta recupero
            </Button>
          </div>
          {exercises[currentIdx + 1] && (
            <p className="text-xs text-muted-foreground text-center">
              Prossimo: <strong>{exercises[currentIdx + 1]?.exercise_name}</strong>
            </p>
          )}
        </div>
      ) : (
        /* ─ Exercise phase ─ */
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
          <div className="text-center">
            <div className="text-2xl font-bold mb-1">{ex.exercise_name}</div>
            <div className="text-muted-foreground text-sm">
              Serie {currentSet} di {ex.sets}
            </div>
          </div>

          {/* Main indicator */}
          {isTimed ? (
            <div className="text-8xl font-extrabold text-emerald-600 tabular-nums">
              {timerActive ? timerSecs : ex.reps_or_secs}
            </div>
          ) : (
            <div className="text-8xl font-extrabold text-emerald-600">
              {ex.reps_or_secs}
            </div>
          )}

          <div className="text-muted-foreground text-sm">
            {isTimed ? 'secondi' : 'ripetizioni'}
          </div>

          {ex.notes && (
            <p className="text-xs text-muted-foreground text-center max-w-xs italic">"{ex.notes}"</p>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3 w-full max-w-xs">
            {isTimed && !timerActive && (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-14 text-base"
                onClick={() => { setTimerSecs(ex.reps_or_secs); setTimerActive(true); }}
              >
                <Play className="w-4 h-4 mr-2" /> Avvia timer
              </Button>
            )}
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white h-14 text-base"
              onClick={startRest}
              disabled={isTimed && timerActive}
            >
              {currentSet === ex.sets && currentIdx === exercises.length - 1
                ? '🎉 Fine! Completa'
                : <><CheckCircle2 className="w-4 h-4 mr-2" /> Fatto → Recupero</>}
            </Button>
          </div>

          {/* Series dots */}
          <div className="flex gap-2 mt-2">
            {Array.from({ length: ex.sets }).map((_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  i < currentSet - 1 ? 'bg-emerald-500' : i === currentSet - 1 ? 'bg-emerald-600 scale-125' : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
