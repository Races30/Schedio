import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { LogOut, Calendar, Clock, Play, TrendingUp, ChevronRight, CheckCircle2, Dumbbell } from 'lucide-react';
import { Client, ExerciseProgress, MEASURE_UNIT, WorkoutPlan } from '@/types';
import { ProgressIndicator } from '@/components/coach/ProgressIndicator';
import { motion } from 'framer-motion';

export default function ClientDashboard() {
  const { clientProfile, signOut } = useAuth();
  const [workoutPlayerOpen, setWorkoutPlayerOpen] = useState(false);

  const client = clientProfile as Client | null;

  // Next session
  const today = new Date().toISOString().split('T')[0];
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
  ).slice(0, 5); // show top 5 exercises

  if (!client) return null;

  const displayName = `${client.first_name || client.name}`;

  return (
    <div className="min-h-screen" style={{ '--client-primary': '#10b981', '--client-primary-light': '#d1fae5' } as React.CSSProperties}>
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

        {/* ─ Card 1: Mini calendario prossima sessione ─ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
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
              Nessuna sessione programmata.<br />
              <span className="text-xs">Proponi una data al tuo trainer.</span>
            </p>
          )}
        </motion.div>

        {/* ─ Card 2: Countdown ─ */}
        {nextSession && daysUntilNext !== null && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
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

        {/* ─ Card 3: Allenamento autonomo ─ */}
        {workoutPlan && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
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

        {/* ─ Card 4: Grafico progressi ─ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
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
                const current = entries[0].value;
                const previous = entries[1]?.value ?? null;

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
                        {entries.slice(0, 8).reverse().map((ep, i) => {
                          const vals = entries.map(e => e.value);
                          const min = Math.min(...vals);
                          const max = Math.max(...vals);
                          const range = max - min || 1;
                          const pct = Math.max(((ep.value - min) / range) * 100, 8);
                          return (
                            <div
                              key={ep.id}
                              className="flex-1 rounded-t"
                              style={{
                                height: `${pct}%`,
                                background: i === entries.slice(0, 8).length - 1
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

        {/* ─ Propose session link ─ */}
        <button className="w-full glass-card p-4 flex items-center justify-between text-sm font-medium hover:shadow-md transition-shadow">
          <span>Proponi una sessione</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Workout player modal */}
      {workoutPlayerOpen && workoutPlan && (
        <WorkoutPlayer
          plan={workoutPlan}
          clientId={client.id}
          onClose={() => setWorkoutPlayerOpen(false)}
        />
      )}
    </div>
  );
}

/* ── Mini Calendar ── */
function MiniCalendar({ targetDate }: { targetDate: Date }) {
  const today = new Date();
  const year  = targetDate.getFullYear();
  const month = targetDate.getMonth();
  const targetDay = targetDate.getDate();

  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay + 6) % 7; // Mon-start

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
        {DAYS.map(d => <div key={d} className="text-[10px] text-muted-foreground font-semibold">{d}</div>)}
        {cells.map((day, i) => {
          const isTarget = day === targetDay &&
            today.getMonth() === month ? false : day === targetDay;
          const isToday  = day === today.getDate() && today.getMonth() === month && today.getFullYear() === year;
          const isTarget2 = day === targetDay;
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

/* ── Workout Player (in-page fullscreen modal) ── */
interface WorkoutExercise {
  exercise_id: string;
  exercise_name: string;
  sets: number;
  reps_or_secs: number;
  measure_type: string;
  rest_secs: number;
  notes?: string;
}

function WorkoutPlayer({ plan, clientId, onClose }: { plan: WorkoutPlan; clientId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const exercises: WorkoutExercise[] = (plan.exercises as unknown as WorkoutExercise[]) ?? [];
  const [currentIdx, setCurrentIdx] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [phase, setPhase] = useState<'exercise' | 'rest'>('exercise');
  const [restSecsLeft, setRestSecsLeft] = useState(0);
  const [done, setDone] = useState(false);
  const [timerActive, setTimerActive] = useState(false);
  const [secsLeft, setSecsLeft] = useState(0);

  const ex = exercises[currentIdx];

  // Timer effect
  useState(() => {
    if (!timerActive) return;
    const interval = setInterval(() => {
      if (phase === 'exercise') {
        setSecsLeft(s => {
          if (s <= 1) { clearInterval(interval); setTimerActive(false); return 0; }
          return s - 1;
        });
      } else {
        setRestSecsLeft(s => {
          if (s <= 1) {
            clearInterval(interval);
            setTimerActive(false);
            handleNextSet();
            return 0;
          }
          return s - 1;
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  });

  const handleNextSet = () => {
    if (currentSet < ex.sets) {
      setCurrentSet(s => s + 1);
      setPhase('exercise');
    } else if (currentIdx < exercises.length - 1) {
      setCurrentIdx(i => i + 1);
      setCurrentSet(1);
      setPhase('exercise');
    } else {
      finishWorkout();
    }
  };

  const startRest = () => {
    setPhase('rest');
    setRestSecsLeft(ex.rest_secs);
    setTimerActive(true);
  };

  const finishWorkout = async () => {
    await supabase.from('workout_completions').insert({
      workout_plan_id: plan.id,
      client_id: clientId,
    });
    qc.invalidateQueries({ queryKey: ['client-last-completion', clientId] });
    setDone(true);
  };

  if (done) {
    return (
      <div className="fixed inset-0 bg-emerald-600 flex flex-col items-center justify-center z-50 text-white p-8">
        <CheckCircle2 className="w-20 h-20 mb-6" />
        <h2 className="text-3xl font-bold mb-2">Ottimo lavoro! 🎉</h2>
        <p className="text-emerald-100 mb-8 text-center">Allenamento completato e registrato.</p>
        <Button variant="outline" className="border-white text-white hover:bg-emerald-700" onClick={onClose}>
          Torna alla dashboard
        </Button>
      </div>
    );
  }

  if (!ex) return null;

  const isTimed = ex.measure_type === 'secondi';
  const progress = ((currentIdx * ex.sets + (currentSet - 1)) / (exercises.length * ex.sets)) * 100;

  return (
    <div className="fixed inset-0 bg-background flex flex-col z-50">
      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
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
          <p className="text-lg font-semibold text-amber-700">Recupero</p>
          <div className="text-8xl font-extrabold text-amber-600 tabular-nums">{restSecsLeft}</div>
          <p className="text-muted-foreground">secondi</p>
          <Button variant="outline" onClick={() => { setTimerActive(false); handleNextSet(); }}>
            Salta recupero →
          </Button>
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
              {timerActive ? secsLeft : ex.reps_or_secs}
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
            <p className="text-xs text-muted-foreground text-center max-w-xs">{ex.notes}</p>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3 w-full max-w-xs">
            {isTimed && !timerActive && (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-14 text-base"
                onClick={() => { setSecsLeft(ex.reps_or_secs); setTimerActive(true); }}
              >
                Avvia timer
              </Button>
            )}
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white h-14 text-base"
              onClick={startRest}
              disabled={isTimed && timerActive}
            >
              {currentSet === ex.sets && currentIdx === exercises.length - 1
                ? 'Fine! Completa 🎉'
                : 'Fatto → Recupero'}
            </Button>
            {currentSet === ex.sets && currentIdx === exercises.length - 1 && (
              <Button variant="outline" onClick={finishWorkout}>
                Completa senza recupero
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
