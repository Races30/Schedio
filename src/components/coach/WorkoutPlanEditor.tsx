/**
 * WorkoutPlanEditor
 *
 * Full CRUD component for managing a client's autonomous workout plan.
 * Used from the ClientDetailDialog in ClientsPage (as a tab/sheet).
 * Allows the trainer to:
 *  - Create/edit the plan name and trainer notes
 *  - Add exercises from the library with sets, reps/secs, rest
 *  - Reorder exercises via up/down arrows
 *  - Activate/deactivate the plan (only one active plan per client)
 */
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Exercise, WorkoutPlan, MEASURE_UNIT } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, X, Search, ChevronUp, ChevronDown, Dumbbell, CheckCircle2, Save, Trash2, LayoutTemplate } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlanExercise {
  exercise_id: string;
  exercise_name: string;
  sets: number;
  reps_or_secs: number;
  measure_type: string;
  rest_secs: number;
  notes: string;
}

// ── Exercise Picker ───────────────────────────────────────────────────────────

function ExercisePicker({
  library,
  usedIds,
  onSelect,
  onClose,
}: {
  library: Exercise[];
  usedIds: string[];
  onSelect: (ex: Exercise) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = library.filter(
    ex => !usedIds.includes(ex.id) && ex.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="border border-border rounded-xl p-3 space-y-2 bg-muted/30">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cerca esercizio..."
          className="pl-9 h-8 text-sm"
          autoFocus
        />
      </div>
      <div className="max-h-44 overflow-y-auto space-y-0.5">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">
            {library.length === 0
              ? 'Nessun esercizio nel database. Creane uno dalla pagina Esercizi.'
              : 'Nessun risultato'}
          </p>
        ) : (
          filtered.map(ex => (
            <button
              key={ex.id}
              onClick={() => onSelect(ex)}
              className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors flex items-center justify-between"
            >
              <span className="font-medium">{ex.name}</span>
              <span className="text-xs text-muted-foreground">{MEASURE_UNIT[ex.measure_type]}</span>
            </button>
          ))
        )}
      </div>
      <Button variant="ghost" size="sm" className="w-full" onClick={onClose}>Annulla</Button>
    </div>
  );
}

// ── Single Exercise Row ────────────────────────────────────────────────────────

function ExerciseRow({
  item,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  item: PlanExercise;
  index: number;
  total: number;
  onChange: (updated: PlanExercise) => void;
  onRemove: () => void;
  onMove: (dir: 'up' | 'down') => void;
}) {
  const isTimed = item.measure_type === 'secondi';
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="border border-border rounded-xl p-4 bg-card space-y-3"
    >
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-0.5">
          <button
            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
            disabled={index === 0}
            onClick={() => onMove('up')}
          ><ChevronUp className="w-3.5 h-3.5" /></button>
          <button
            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
            disabled={index === total - 1}
            onClick={() => onMove('down')}
          ><ChevronDown className="w-3.5 h-3.5" /></button>
        </div>
        <span className="text-xs text-muted-foreground font-mono w-5 text-center">{index + 1}</span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">{item.exercise_name}</div>
          <div className="text-xs text-muted-foreground capitalize">{item.measure_type}</div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onRemove}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Serie</Label>
          <Input
            type="number" min={1} max={20}
            value={item.sets}
            onChange={e => onChange({ ...item, sets: Math.max(1, Number(e.target.value)) })}
            className="h-8 text-sm text-center"
          />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {isTimed ? 'Secondi' : 'Ripetizioni'}
          </Label>
          <Input
            type="number" min={1}
            value={item.reps_or_secs}
            onChange={e => onChange({ ...item, reps_or_secs: Math.max(1, Number(e.target.value)) })}
            className="h-8 text-sm text-center"
          />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Recupero (sec)</Label>
          <Input
            type="number" min={0} step={5}
            value={item.rest_secs}
            onChange={e => onChange({ ...item, rest_secs: Math.max(0, Number(e.target.value)) })}
            className="h-8 text-sm text-center"
          />
        </div>
      </div>

      <div>
        <Input
          value={item.notes}
          onChange={e => onChange({ ...item, notes: e.target.value })}
          placeholder="Note per il cliente (opzionale)"
          className="h-8 text-xs"
        />
      </div>
    </motion.div>
  );
}

// ── Main Editor Component ──────────────────────────────────────────────────────

interface WorkoutPlanEditorProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  activityId: string;
}

export function WorkoutPlanEditor({ open, onClose, clientId, clientName, activityId }: WorkoutPlanEditorProps) {
  const qc = useQueryClient();
  const [planName, setPlanName]         = useState('');
  const [trainerNotes, setTrainerNotes] = useState('');
  const [exercises, setExercises]       = useState<PlanExercise[]>([]);
  const [pickerOpen, setPickerOpen]     = useState(false);
  const [saving, setSaving]             = useState(false);
  const [currentPlan, setCurrentPlan]   = useState<WorkoutPlan | null>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateName, setTemplateName]           = useState('');

  // Load exercise library
  const { data: library = [] } = useQuery<Exercise[]>({
    queryKey: ['exercises', activityId],
    queryFn: async () => {
      const { data } = await supabase.from('exercises').select('*').eq('activity_id', activityId).order('name');
      return (data || []) as Exercise[];
    },
    enabled: open && !!activityId,
  });

  // Load existing active plan
  const { data: existingPlan } = useQuery<WorkoutPlan | null>({
    queryKey: ['workout-plan', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('workout_plans')
        .select('*')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .eq('is_template', false)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as WorkoutPlan | null;
    },
    enabled: open && !!clientId,
  });

  // Hydrate form when existing plan loads
  useEffect(() => {
    if (existingPlan) {
      setCurrentPlan(existingPlan);
      setPlanName(existingPlan.name);
      setTrainerNotes(existingPlan.trainer_notes ?? '');
      setExercises((existingPlan.exercises as unknown as PlanExercise[]) ?? []);
    } else {
      setCurrentPlan(null);
      setPlanName('');
      setTrainerNotes('');
      setExercises([]);
    }
  }, [existingPlan, open]);

  const addExercise = (ex: Exercise) => {
    setExercises(prev => [...prev, {
      exercise_id:   ex.id,
      exercise_name: ex.name,
      sets:          3,
      reps_or_secs:  ex.measure_type === 'secondi' ? 30 : 10,
      measure_type:  ex.measure_type,
      rest_secs:     60,
      notes:         '',
    }]);
    setPickerOpen(false);
  };

  const updateExercise = (i: number, updated: PlanExercise) =>
    setExercises(prev => prev.map((e, idx) => idx === i ? updated : e));

  const removeExercise = (i: number) =>
    setExercises(prev => prev.filter((_, idx) => idx !== i));

  const moveExercise = (i: number, dir: 'up' | 'down') => {
    setExercises(prev => {
      const next = [...prev];
      const swap = dir === 'up' ? i - 1 : i + 1;
      [next[i], next[swap]] = [next[swap], next[i]];
      return next;
    });
  };

  const handleSave = async () => {
    if (!planName.trim()) { toast.error('Il nome della scheda è obbligatorio'); return; }
    if (exercises.length === 0) { toast.error('Aggiungi almeno un esercizio'); return; }
    setSaving(true);
    try {
      const payload = {
        activity_id:   activityId,
        client_id:     clientId,
        name:          planName.trim(),
        exercises:     exercises as unknown as never,
        trainer_notes: trainerNotes.trim() || null,
        is_active:     true,
        updated_at:    new Date().toISOString(),
      };
      if (currentPlan) {
        const { error } = await supabase.from('workout_plans').update(payload as never).eq('id', currentPlan.id);
        if (error) throw error;
        toast.success('Scheda aggiornata!');
      } else {
        // Deactivate previous plans first
        await supabase.from('workout_plans').update({ is_active: false } as never).eq('client_id', clientId);
        const { error } = await supabase.from('workout_plans').insert({ ...payload, created_at: new Date().toISOString() } as never);
        if (error) throw error;
        toast.success('Scheda creata!');
      }
      qc.invalidateQueries({ queryKey: ['workout-plan', clientId] });
      qc.invalidateQueries({ queryKey: ['client-workout-plan', clientId] });
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Errore');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!currentPlan) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('workout_plans').update({ is_active: false } as never).eq('id', currentPlan.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['workout-plan', clientId] });
      qc.invalidateQueries({ queryKey: ['client-workout-plan', clientId] });
      toast.success('Scheda disattivata');
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Errore');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) { toast.error('Il nome del template è obbligatorio'); return; }
    if (exercises.length === 0) { toast.error('Aggiungi almeno un esercizio prima di salvare come template'); return; }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from('workout_plans').insert({
        activity_id:   activityId,
        client_id:     null,
        name:          planName.trim() || templateName.trim(),
        template_name: templateName.trim(),
        exercises:     exercises as unknown as never,
        trainer_notes: trainerNotes.trim() || null,
        is_active:     false,
        is_template:   true,
        created_at:    now,
        updated_at:    now,
      } as never);
      if (error) throw error;
      toast.success(`Template "${templateName.trim()}" salvato!`);
      qc.invalidateQueries({ queryKey: ['workout-templates'] });
      setTemplateModalOpen(false);
      setTemplateName('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Errore');
    } finally {
      setSaving(false);
    }
  };

  const usedIds = exercises.map(e => e.exercise_id);

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-emerald-600" />
              Scheda allenamento — {clientName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Plan name */}
            <div>
              <Label>Nome scheda *</Label>
              <Input
                value={planName}
                onChange={e => setPlanName(e.target.value)}
                placeholder="es. Scheda forza A, Rinforzo dorsale..."
                className="mt-1"
              />
            </div>

            {/* Trainer notes */}
            <div>
              <Label>Note per il cliente</Label>
              <Textarea
                value={trainerNotes}
                onChange={e => setTrainerNotes(e.target.value)}
                placeholder="Indicazioni generali, raccomandazioni, focus della scheda..."
                className="mt-1 text-sm min-h-[60px]"
              />
            </div>

            {/* Exercise list */}
            <div>
              <Label className="mb-2 block">Esercizi ({exercises.length})</Label>
              <AnimatePresence>
                <div className="space-y-2">
                  {exercises.map((ex, i) => (
                    <ExerciseRow
                      key={`${ex.exercise_id}-${i}`}
                      item={ex}
                      index={i}
                      total={exercises.length}
                      onChange={updated => updateExercise(i, updated)}
                      onRemove={() => removeExercise(i)}
                      onMove={dir => moveExercise(i, dir)}
                    />
                  ))}
                </div>
              </AnimatePresence>
            </div>

            {/* Add exercise */}
            {pickerOpen ? (
              <ExercisePicker
                library={library}
                usedIds={usedIds}
                onSelect={addExercise}
                onClose={() => setPickerOpen(false)}
              />
            ) : (
              <Button
                variant="outline"
                className="w-full border-dashed"
                onClick={() => setPickerOpen(true)}
              >
                <Plus className="w-4 h-4 mr-1" /> Aggiungi esercizio
              </Button>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t border-border">
              {currentPlan && (
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleDelete} disabled={saving}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Disattiva
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-primary border-primary/30"
                onClick={() => { setTemplateName(planName.trim()); setTemplateModalOpen(true); }}
                disabled={saving || exercises.length === 0}
                title="Salva una copia come template riutilizzabile"
              >
                <LayoutTemplate className="w-3.5 h-3.5" />
                Salva come template
              </Button>
              <Button
                variant="hero"
                className="flex-1"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Salvataggio...' : (
                  <>
                    {currentPlan ? <Save className="w-4 h-4 mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                    {currentPlan ? 'Aggiorna scheda' : 'Crea scheda'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Template name modal */}
      <Dialog
        open={templateModalOpen}
        onOpenChange={(v) => { if (!v) { setTemplateModalOpen(false); setTemplateName(''); } }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutTemplate className="w-4 h-4 text-primary" /> Salva come template
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Verrà salvata una copia della scheda come template riutilizzabile.
              Il piano attuale del cliente non viene modificato.
            </p>
            <div>
              <Label>Nome template *</Label>
              <Input
                className="mt-1"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="es. Forza base, Full body 3×, Dimagrimento..."
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAsTemplate(); }}
                autoFocus
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => { setTemplateModalOpen(false); setTemplateName(''); }}
              disabled={saving}
            >
              Annulla
            </Button>
            <Button
              variant="hero"
              className="flex-1"
              onClick={handleSaveAsTemplate}
              disabled={saving || !templateName.trim()}
            >
              {saving ? 'Salvataggio...' : 'Salva template'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
