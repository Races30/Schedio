/**
 * ClientProgressPage
 * Route: /clients/:clientId/progress
 *
 * Trainer view of a single client's exercise progress over time.
 * Features:
 *  - Sparkline chart per exercise (CSS-only, no heavy deps)
 *  - Progress direction indicator (up/down/same)
 *  - Session feedback log (trainer-only)
 *  - Workout plan status + quick edit button
 *  - All-time bests table
 */
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Client, ExerciseProgress, SessionFeedback, WorkoutPlan, MEASURE_UNIT } from '@/types';
import { ProgressIndicator } from '@/components/coach/ProgressIndicator';
import { WorkoutPlanEditor } from '@/components/coach/WorkoutPlanEditor';
import { Button } from '@/components/ui/button';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Dumbbell, Zap, AlertCircle, Star } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';

// ── Sparkline chart (pure CSS, no library) ────────────────────────────────────
function Sparkline({ values, color = '#10b981' }: { values: number[]; color?: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 180;
  const h = 48;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const polyline = pts.join(' ');

  // area fill
  const area = `${pts[0].split(',')[0]},${h} ${polyline} ${pts[pts.length - 1].split(',')[0]},${h}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 48 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={area}
        fill={`url(#sg-${color.replace('#','')})`}
      />
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={pts[pts.length - 1].split(',')[0]}
        cy={pts[pts.length - 1].split(',')[1]}
        r="3"
        fill={color}
      />
    </svg>
  );
}

// ── Feedback item ──────────────────────────────────────────────────────────────
function EnergyEmojis({ level }: { level: number }) {
  const emojis = Array.from({ length: level }).map(() => '⚡');
  return <span className="text-sm">{emojis.join('')}</span>;
}

function StarRating({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex gap-0.5 text-lg leading-none">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={i <= rating ? 'text-amber-400' : 'text-muted'}>★</span>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ClientProgressPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const { activity } = useAuth();
  const navigate = useNavigate();
  const [planEditorOpen, setPlanEditorOpen] = useState(false);

  // Client info
  const { data: client } = useQuery<Client | null>({
    queryKey: ['client', clientId],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('*').eq('id', clientId!).maybeSingle();
      return data as Client | null;
    },
    enabled: !!clientId,
  });

  // Exercise progress — all history
  const { data: progressRaw = [] } = useQuery<ExerciseProgress[]>({
    queryKey: ['exercise-progress', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('exercise_progress')
        .select('*, exercise:exercises(name, measure_type)')
        .eq('client_id', clientId!)
        .order('recorded_at', { ascending: true });
      return (data || []) as ExerciseProgress[];
    },
    enabled: !!clientId,
  });

  // Group by exercise
  const byExercise = Object.values(
    progressRaw.reduce<Record<string, ExerciseProgress[]>>((acc, ep) => {
      if (!acc[ep.exercise_id]) acc[ep.exercise_id] = [];
      acc[ep.exercise_id].push(ep);
      return acc;
    }, {})
  );

  // Feedback history
  const { data: feedbacks = [] } = useQuery<SessionFeedback[]>({
    queryKey: ['session-feedback', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('session_feedback')
        .select('*')
        .eq('client_id', clientId!)
        .order('created_at', { ascending: false })
        .limit(10);
      return (data || []) as SessionFeedback[];
    },
    enabled: !!clientId,
  });

  // Active workout plan
  const { data: workoutPlan } = useQuery<WorkoutPlan | null>({
    queryKey: ['workout-plan', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('workout_plans')
        .select('*')
        .eq('client_id', clientId!)
        .eq('is_active', true)
        .eq('is_template', false)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as WorkoutPlan | null;
    },
    enabled: !!clientId,
  });

  // Workout completions count
  const { data: completionsCount = 0 } = useQuery<number>({
    queryKey: ['workout-completions-count', clientId],
    queryFn: async () => {
      const { count } = await supabase
        .from('workout_completions')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', clientId!);
      return count || 0;
    },
    enabled: !!clientId,
  });

  if (!activity || !client) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Summary stats for the client
  const improving = byExercise.filter(entries => {
    if (entries.length < 2) return false;
    return entries[entries.length - 1].value > entries[entries.length - 2].value;
  }).length;
  const declining = byExercise.filter(entries => {
    if (entries.length < 2) return false;
    return entries[entries.length - 1].value < entries[entries.length - 2].value;
  }).length;
  const stable = byExercise.length - improving - declining;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/clients')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{client.name}</h1>
          <p className="text-muted-foreground text-sm">Progressi e tracking esercizi</p>
        </div>
        <Button variant="outline" onClick={() => setPlanEditorOpen(true)}>
          <Dumbbell className="w-4 h-4 mr-2" />
          {workoutPlan ? 'Modifica scheda' : 'Crea scheda'}
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { icon: TrendingUp, label: 'In miglioramento', value: improving, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/20' },
          { icon: TrendingDown, label: 'In calo', value: declining, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/20' },
          { icon: Minus, label: 'Stabili', value: stable, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/20' },
          { icon: Dumbbell, label: 'Allenamenti autonomi', value: completionsCount, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/20' },
        ].map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className={`rounded-2xl p-4 ${s.bg} border border-transparent`}
          >
            <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Workout plan banner */}
      <div className={`rounded-xl p-4 mb-6 flex items-center gap-4 ${workoutPlan ? 'bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200' : 'bg-muted border border-dashed border-border'}`}>
        <Dumbbell className={`w-6 h-6 flex-shrink-0 ${workoutPlan ? 'text-emerald-600' : 'text-muted-foreground'}`} />
        <div className="flex-1">
          {workoutPlan ? (
            <>
              <div className="font-semibold text-sm text-emerald-800 dark:text-emerald-300">{workoutPlan.name}</div>
              <div className="text-xs text-muted-foreground">
                {(workoutPlan.exercises as unknown[]).length} esercizi · Scheda attiva
              </div>
            </>
          ) : (
            <>
              <div className="font-semibold text-sm">Nessuna scheda attiva</div>
              <div className="text-xs text-muted-foreground">Crea una scheda di allenamento autonomo per questo cliente</div>
            </>
          )}
        </div>
        <Button size="sm" variant={workoutPlan ? 'outline' : 'default'} onClick={() => setPlanEditorOpen(true)}>
          {workoutPlan ? 'Modifica' : 'Crea'}
        </Button>
      </div>

      {/* Exercise progress cards */}
      {byExercise.length === 0 ? (
        <div className="glass-card p-12 text-center mb-8">
          <TrendingUp className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">Nessun dato di progresso ancora</p>
          <p className="text-xs text-muted-foreground mt-1">I dati appariranno dopo aver completato sessioni con esercizi registrati</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {byExercise.map(entries => {
            const ex = entries[0].exercise;
            const exName = ex?.name ?? 'Esercizio';
            const measureType = entries[0].measure_type;
            const unit = MEASURE_UNIT[measureType as keyof typeof MEASURE_UNIT] ?? '';
            const current = entries[entries.length - 1].value;
            const previous = entries.length > 1 ? entries[entries.length - 2].value : null;
            const best = Math.max(...entries.map(e => e.value));
            const values = entries.map(e => e.value);

            return (
              <motion.div
                key={entries[0].exercise_id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-sm">{exName}</div>
                    <div className="text-xs text-muted-foreground capitalize">{measureType}</div>
                  </div>
                  <ProgressIndicator
                    current={current}
                    previous={previous}
                    measureType={measureType}
                    showDiff={true}
                    size="sm"
                  />
                </div>

                {/* Sparkline */}
                <div className="my-2">
                  <Sparkline
                    values={values}
                    color={current > (previous ?? current) ? '#10b981' : current < (previous ?? current) ? '#ef4444' : '#6366f1'}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                  <span>Attuale: <strong className="text-foreground">{current} {unit}</strong></span>
                  <span>Best: <strong className="text-amber-600">{best} {unit}</strong></span>
                  <span>{entries.length} sessioni</span>
                </div>

                {/* History mini table (last 5) */}
                <div className="mt-3 space-y-1">
                  {entries.slice(-5).reverse().map((ep, i) => (
                    <div key={ep.id} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {new Date(ep.recorded_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                      </span>
                      <span className="font-mono font-medium">{ep.value} {unit}</span>
                      {i < entries.slice(-5).length - 1 && (
                        <ProgressIndicator
                          current={ep.value}
                          previous={entries.slice(-5).reverse()[i + 1]?.value ?? null}
                          measureType={measureType}
                          showDiff={false}
                          size="sm"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Session feedback log */}
      {feedbacks.length > 0 && (
        <div className="glass-card p-6 mb-6">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            Feedback sessioni (visibile solo al trainer)
          </h2>
          <div className="space-y-3">
            {feedbacks.map(fb => (
              <div key={fb.id} className="flex items-start gap-4 p-3 rounded-lg bg-muted/40 text-sm">
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Energia:</span>
                      <EnergyEmojis level={fb.energy_level} />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Valutazione:</span>
                      <StarRating rating={fb.overall_rating} />
                    </div>
                    {fb.was_tired ? (
                      <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">Stanco</span>
                    ) : (
                      <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium">Riposato</span>
                    )}
                    {fb.had_difficulty ? (
                      <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Difficoltà
                      </span>
                    ) : (
                      <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium">
                        Nessuna difficoltà
                      </span>
                    )}
                  </div>
                  {fb.difficulty_notes && (
                    <p className="text-xs text-muted-foreground italic">"{fb.difficulty_notes}"</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {new Date(fb.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Workout Plan Editor */}
      {activity && (
        <WorkoutPlanEditor
          open={planEditorOpen}
          onClose={() => setPlanEditorOpen(false)}
          clientId={client.id}
          clientName={client.name}
          activityId={activity.id}
        />
      )}
    </div>
  );
}
