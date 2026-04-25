import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X, Search, CheckCircle2 } from 'lucide-react';
import { Exercise, ExerciseProgress, MEASURE_UNIT, MeasureType } from '@/types';
import { ProgressIndicator } from './ProgressIndicator';
import { toast } from 'sonner';

interface ExerciseEntry {
  exercise: Exercise;
  value: string;
  previousValue: number | null;
  previousDate: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  appointmentId: string;
  clientId: string;
  clientName: string;
  activityId: string;
  sessionDate?: string;
}

export function CompleteSessionDialog({
  open, onClose, appointmentId, clientId, clientName, activityId, sessionDate,
}: Props) {
  const qc = useQueryClient();
  const [entries, setEntries] = useState<ExerciseEntry[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Trainer's exercise library
  const { data: library = [] } = useQuery<Exercise[]>({
    queryKey: ['exercises', activityId],
    queryFn: async () => {
      const { data } = await supabase
        .from('exercises')
        .select('*')
        .eq('activity_id', activityId)
        .order('name');
      return (data || []) as Exercise[];
    },
    enabled: open && !!activityId,
  });

  // Reset on open
  useEffect(() => {
    if (open) { setEntries([]); setSearch(''); }
  }, [open]);

  const fetchPreviousValue = async (exerciseId: string): Promise<{ value: number | null; date: string | null }> => {
    const { data } = await supabase
      .from('exercise_progress')
      .select('value, recorded_at')
      .eq('client_id', clientId)
      .eq('exercise_id', exerciseId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return { value: data?.value ?? null, date: data?.recorded_at ?? null };
  };

  const addExercise = async (ex: Exercise) => {
    if (entries.find(e => e.exercise.id === ex.id)) return;
    const { value, date } = await fetchPreviousValue(ex.id);
    setEntries(prev => [...prev, { exercise: ex, value: '', previousValue: value, previousDate: date }]);
    setPickerOpen(false);
    setSearch('');
  };

  const removeExercise = (id: string) =>
    setEntries(prev => prev.filter(e => e.exercise.id !== id));

  const updateValue = (id: string, val: string) =>
    setEntries(prev => prev.map(e => e.exercise.id === id ? { ...e, value: val } : e));

  const handleSubmit = async () => {
    const filled = entries.filter(e => e.value !== '' && !isNaN(Number(e.value)));
    if (filled.length === 0) {
      toast.error('Inserisci almeno un risultato');
      return;
    }
    setLoading(true);
    try {
      // Save progress entries
      const now = new Date().toISOString();
      const rows = filled.map(e => ({
        activity_id: activityId,
        client_id: clientId,
        exercise_id: e.exercise.id,
        appointment_id: appointmentId,
        value: Number(e.value),
        measure_type: e.exercise.measure_type,
        recorded_at: now,
      }));
      const { error: insertErr } = await supabase.from('exercise_progress').insert(rows);
      if (insertErr) throw insertErr;

      // Mark appointment completed
      await supabase
        .from('appointments')
        .update({ status: 'completed' })
        .eq('id', appointmentId);

      qc.invalidateQueries({ queryKey: ['appointments'] });
      qc.invalidateQueries({ queryKey: ['exercise-progress', clientId] });
      toast.success('Sessione completata!');
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Errore nel salvataggio');
    } finally {
      setLoading(false);
    }
  };

  const filteredLibrary = library
    .filter(ex => ex.name.toLowerCase().includes(search.toLowerCase()))
    .filter(ex => !entries.find(e => e.exercise.id === ex.id));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            Completa sessione — {clientName}
          </DialogTitle>
          {sessionDate && (
            <p className="text-sm text-muted-foreground">
              {new Date(sessionDate).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {/* Exercise entries */}
          {entries.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Aggiungi gli esercizi svolti durante la sessione
            </p>
          )}

          {entries.map(entry => {
            const current = entry.value !== '' && !isNaN(Number(entry.value)) ? Number(entry.value) : null;
            const unit = MEASURE_UNIT[entry.exercise.measure_type];
            return (
              <div key={entry.exercise.id} className="border border-border rounded-xl p-4 bg-muted/20 space-y-3">
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-sm">{entry.exercise.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">{entry.exercise.measure_type}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => removeExercise(entry.exercise.id)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {/* Previous value reference */}
                {entry.previousValue !== null && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-lg">
                    <span>Prec:</span>
                    <span className="font-semibold">{entry.previousValue} {unit}</span>
                    {entry.previousDate && (
                      <span className="opacity-60">
                        · {new Date(entry.previousDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                )}

                {/* Input + comparison */}
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      value={entry.value}
                      onChange={e => updateValue(entry.exercise.id, e.target.value)}
                      placeholder={`es. ${entry.previousValue ?? 10}`}
                      className="pr-14"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                      {unit}
                    </span>
                  </div>

                  {/* Live comparison indicator */}
                  <div className="w-28 flex justify-start">
                    <ProgressIndicator
                      current={current}
                      previous={entry.previousValue}
                      measureType={entry.exercise.measure_type}
                      showDiff={true}
                      size="md"
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add exercise button */}
          {!pickerOpen ? (
            <Button
              variant="outline"
              className="w-full border-dashed"
              onClick={() => setPickerOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1" /> Aggiungi esercizio
            </Button>
          ) : (
            <div className="border border-border rounded-xl p-3 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Cerca nel tuo database esercizi..."
                  className="pl-9"
                  autoFocus
                />
              </div>
              {library.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">
                  Nessun esercizio nel database. Creane uno dalla pagina Esercizi.
                </p>
              ) : filteredLibrary.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">Nessun risultato</p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredLibrary.map(ex => (
                    <button
                      key={ex.id}
                      onClick={() => addExercise(ex)}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors flex items-center justify-between"
                    >
                      <span className="font-medium">{ex.name}</span>
                      <span className="text-xs text-muted-foreground">{MEASURE_UNIT[ex.measure_type]}</span>
                    </button>
                  ))}
                </div>
              )}
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setPickerOpen(false)}>
                Annulla
              </Button>
            </div>
          )}

          {/* Submit */}
          {entries.length > 0 && (
            <Button
              variant="hero"
              className="w-full"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Salvataggio...' : 'Salva e completa sessione'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Quick exercise creator (for trainers with empty library) ─── */
export function QuickExerciseForm({
  activityId,
  onCreated,
}: {
  activityId: string;
  onCreated: (ex: Exercise) => void;
}) {
  const [name, setName] = useState('');
  const [measureType, setMeasureType] = useState<MeasureType>('ripetizioni');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('exercises')
      .insert({ activity_id: activityId, name: name.trim(), measure_type: measureType })
      .select()
      .single();
    if (!error && data) onCreated(data as Exercise);
    setSaving(false);
  };

  return (
    <div className="border border-dashed border-border rounded-xl p-3 space-y-3">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Crea esercizio al volo
      </Label>
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={e => setName(e.target.value.slice(0, 40))}
          placeholder="Nome esercizio (max 40 car.)"
          className="flex-1"
        />
        <Select value={measureType} onValueChange={v => setMeasureType(v as MeasureType)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ripetizioni">Rip.</SelectItem>
            <SelectItem value="kg">Kg</SelectItem>
            <SelectItem value="secondi">Sec</SelectItem>
            <SelectItem value="metri">Metri</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button size="sm" variant="outline" onClick={save} disabled={saving || !name.trim()} className="w-full">
        {saving ? 'Creazione...' : 'Crea e aggiungi'}
      </Button>
    </div>
  );
}
