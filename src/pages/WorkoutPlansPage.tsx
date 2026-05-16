/**
 * WorkoutPlansPage
 * Route: /workout-plans
 *
 * Two-tab view for the trainer:
 *   Tab "Schede clienti" — all active workout plans (is_template=false) with client info
 *   Tab "Template"       — all template plans (is_template=true)
 *
 * From here the trainer can:
 *  - Open/edit any client's plan via WorkoutPlanEditor
 *  - Manage templates via WorkoutTemplatesTab
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { WorkoutPlanEditor } from '@/components/coach/WorkoutPlanEditor';
import { WorkoutTemplatesTab } from '@/components/coach/WorkoutTemplatesTab';
import { Button } from '@/components/ui/button';
import {
  ClipboardList, LayoutTemplate, Dumbbell, User, CheckCircle2,
  Plus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ClientPlanRow {
  id: string;
  name: string;
  exercises: unknown[];
  trainer_notes: string | null;
  is_active: boolean;
  client_id: string;
  client: { id: string; name: string } | null;
  updated_at: string;
}

interface Client {
  id: string;
  name: string;
}

type TabId = 'plans' | 'templates';

// ─────────────────────────────────────────────────────────────────────────────
// Sub: client plan card
// ─────────────────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  onEdit,
  index,
}: {
  plan: ClientPlanRow;
  onEdit: () => void;
  index: number;
}) {
  const exerciseCount = (plan.exercises as unknown[]).length;
  const updatedAt = new Date(plan.updated_at).toLocaleDateString('it-IT', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="glass-card p-4 sm:p-5 flex items-start gap-3 sm:gap-4"
    >
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
        {plan.client?.name?.charAt(0)?.toUpperCase() ?? '?'}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <span className="font-semibold text-sm leading-snug break-words">{plan.name}</span>
          {plan.is_active && (
            <span className="text-xs bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" /> Attiva
            </span>
          )}
        </div>
        <div className="text-sm text-muted-foreground mt-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {plan.client?.name ?? 'Cliente rimosso'}
          </span>
          <span className="flex items-center gap-1">
            <Dumbbell className="w-3 h-3" />
            {exerciseCount} esercizi
          </span>
          <span>Aggiornata: {updatedAt}</span>
        </div>
      </div>

      {/* Edit button */}
      <Button size="sm" variant="outline" onClick={onEdit} className="flex-shrink-0">
        Modifica
      </Button>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function WorkoutPlansPage() {
  const { activity } = useAuth();
  const activityId = activity?.id ?? null;

  const [activeTab, setActiveTab] = useState<TabId>('plans');
  const [editorTarget, setEditorTarget] = useState<{ clientId: string; clientName: string } | null>(null);

  // ── Fetch all non-template plans ──────────────────────────────────────────
  const { data: plans = [], isLoading: loadingPlans } = useQuery<ClientPlanRow[]>({
    queryKey: ['all-workout-plans', activityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_plans')
        .select('id, name, exercises, trainer_notes, is_active, client_id, updated_at, client:clients(id, name)')
        .eq('activity_id', activityId!)
        .eq('is_template', false)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClientPlanRow[];
    },
    enabled: !!activityId,
  });

  // ── Fetch all clients (for templates → use modal) ─────────────────────────
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['sessions-page-clients', activityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .eq('activity_id', activityId!)
        .order('name');
      if (error) throw error;
      return (data ?? []) as Client[];
    },
    enabled: !!activityId,
  });

  if (!activity) return null;

  const activePlans   = plans.filter((p) => p.is_active);
  const inactivePlans = plans.filter((p) => !p.is_active);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" /> Schede allenamento
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">{activity.name}</p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-xl mb-6 w-fit">
        {([
          { id: 'plans' as TabId,     label: 'Schede clienti', icon: ClipboardList, count: plans.length },
          { id: 'templates' as TabId, label: 'Template',       icon: LayoutTemplate },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {'count' in tab && tab.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                activeTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <AnimatePresence mode="wait">
        {activeTab === 'plans' ? (
          <motion.div
            key="plans"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {loadingPlans ? (
              <div className="flex items-center justify-center py-24">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : plans.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <ClipboardList className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                <p className="font-medium text-muted-foreground">Nessuna scheda ancora</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Crea una scheda dal profilo di un cliente oppure usa un template.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Active plans */}
                {activePlans.length > 0 && (
                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">
                      Schede attive ({activePlans.length})
                    </h2>
                    <div className="space-y-2">
                      {activePlans.map((plan, i) => (
                        <PlanCard
                          key={plan.id}
                          plan={plan}
                          index={i}
                          onEdit={() =>
                            setEditorTarget({
                              clientId:   plan.client_id,
                              clientName: plan.client?.name ?? 'Cliente',
                            })
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Inactive plans */}
                {inactivePlans.length > 0 && (
                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">
                      Schede inattive ({inactivePlans.length})
                    </h2>
                    <div className="space-y-2 opacity-60">
                      {inactivePlans.map((plan, i) => (
                        <PlanCard
                          key={plan.id}
                          plan={plan}
                          index={i}
                          onEdit={() =>
                            setEditorTarget({
                              clientId:   plan.client_id,
                              clientName: plan.client?.name ?? 'Cliente',
                            })
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="templates"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <WorkoutTemplatesTab activityId={activityId!} clients={clients} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Workout plan editor (modal) ── */}
      {editorTarget && (
        <WorkoutPlanEditor
          open
          onClose={() => setEditorTarget(null)}
          clientId={editorTarget.clientId}
          clientName={editorTarget.clientName}
          activityId={activityId!}
        />
      )}
    </div>
  );
}
