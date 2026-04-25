import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Search, Dumbbell, Edit, FileText } from 'lucide-react';
import { Exercise, MeasureType, MEASURE_UNIT } from '@/types';
import { MuscleSelector, getMuscleLabel } from '@/components/coach/MuscleSelector';
import { toast } from 'sonner';

const MEASURE_TYPES: { value: MeasureType; label: string }[] = [
  { value: 'ripetizioni', label: 'Ripetizioni' },
  { value: 'kg',          label: 'Chilogrammi (kg)' },
  { value: 'secondi',     label: 'Secondi' },
  { value: 'metri',       label: 'Metri' },
];

export default function ExercisesPage() {
  const { activity } = useAuth();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editExercise, setEditExercise] = useState<Exercise | null>(null);

  const { data: exercises = [], isLoading } = useQuery<Exercise[]>({
    queryKey: ['exercises', activity?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('exercises')
        .select('*')
        .eq('activity_id', activity!.id)
        .order('name');
      return (data || []) as Exercise[];
    },
    enabled: !!activity,
  });

  const filtered = exercises.filter(ex => {
    const matchSearch = ex.name.toLowerCase().includes(search.toLowerCase());
    const matchType   = filterType === 'all' || ex.measure_type === filterType;
    return matchSearch && matchType;
  });

  if (!activity) return null;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Dumbbell className="w-6 h-6 text-primary" /> Database Esercizi
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            I tuoi esercizi riutilizzabili per qualsiasi cliente o sessione
          </p>
        </div>
        <Button onClick={() => { setEditExercise(null); setDialogOpen(true); }} variant="hero">
          <Plus className="w-4 h-4" /> Nuovo esercizio
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-col sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca esercizio..." className="pl-10" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Tipo misura" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i tipi</SelectItem>
            {MEASURE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Stats strip */}
      <div className="flex gap-4 mb-6">
        {MEASURE_TYPES.map(t => {
          const count = exercises.filter(e => e.measure_type === t.value).length;
          return (
            <div key={t.value} className="text-center">
              <div className="text-xl font-bold text-primary">{count}</div>
              <div className="text-xs text-muted-foreground">{t.label}</div>
            </div>
          );
        })}
      </div>

      {/* Exercise list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Dumbbell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">
            {search || filterType !== 'all' ? 'Nessun risultato' : 'Nessun esercizio ancora'}
          </p>
          {!search && filterType === 'all' && (
            <Button variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
              Crea il primo esercizio
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map(ex => (
            <div
              key={ex.id}
              className="glass-card p-4 flex items-start gap-4 hover:shadow-md transition-shadow"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Dumbbell className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{ex.name}</div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {MEASURE_UNIT[ex.measure_type]} · {MEASURE_TYPES.find(t => t.value === ex.measure_type)?.label}
                  </span>
                </div>
                {(ex.muscles as string[]).length > 0 && (
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {(ex.muscles as string[]).map(getMuscleLabel).join(', ')}
                  </div>
                )}
                {ex.notes && (
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <FileText className="w-3 h-3" /> {ex.notes}
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="flex-shrink-0"
                onClick={() => { setEditExercise(ex); setDialogOpen(true); }}
              >
                <Edit className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <ExerciseDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        exercise={editExercise}
        activityId={activity.id}
      />
    </div>
  );
}

/* ── Exercise Create / Edit Dialog ── */
function ExerciseDialog({
  open, onClose, exercise, activityId,
}: {
  open: boolean; onClose: () => void; exercise: Exercise | null; activityId: string;
}) {
  const qc = useQueryClient();
  const [name, setName]               = useState(exercise?.name ?? '');
  const [measureType, setMeasureType] = useState<MeasureType>(exercise?.measure_type ?? 'ripetizioni');
  const [muscles, setMuscles]         = useState<string[]>((exercise?.muscles as string[]) ?? []);
  const [notes, setNotes]             = useState(exercise?.notes ?? '');
  const [loading, setLoading]         = useState(false);

  // Reset when exercise prop changes
  useState(() => {
    setName(exercise?.name ?? '');
    setMeasureType(exercise?.measure_type ?? 'ripetizioni');
    setMuscles((exercise?.muscles as string[]) ?? []);
    setNotes(exercise?.notes ?? '');
  });

  const save = async () => {
    if (!name.trim()) { toast.error('Il nome è obbligatorio'); return; }
    setLoading(true);
    try {
      const payload = {
        activity_id:  activityId,
        name:         name.trim().slice(0, 40),
        measure_type: measureType,
        muscles:      muscles,
        notes:        notes.trim() || null,
      };
      if (exercise) {
        await supabase.from('exercises').update(payload).eq('id', exercise.id);
        toast.success('Esercizio aggiornato');
      } else {
        await supabase.from('exercises').insert(payload);
        toast.success('Esercizio creato');
      }
      qc.invalidateQueries({ queryKey: ['exercises', activityId] });
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Errore');
    } finally { setLoading(false); }
  };

  const deleteEx = async () => {
    if (!exercise) return;
    setLoading(true);
    await supabase.from('exercises').delete().eq('id', exercise.id);
    qc.invalidateQueries({ queryKey: ['exercises', activityId] });
    toast.success('Esercizio eliminato');
    onClose();
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{exercise ? 'Modifica esercizio' : 'Nuovo esercizio'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {/* Name */}
          <div>
            <Label>Nome * <span className="text-xs text-muted-foreground">({name.length}/40)</span></Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value.slice(0, 40))}
              placeholder="es. Panca piana, Squat, Plank..."
            />
          </div>

          {/* Measure type */}
          <div>
            <Label>Tipo di misura *</Label>
            <Select value={measureType} onValueChange={v => setMeasureType(v as MeasureType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MEASURE_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Muscle selector */}
          <div>
            <Label className="mb-2 block">Muscoli coinvolti</Label>
            <MuscleSelector selected={muscles} onChange={setMuscles} />
          </div>

          {/* Notes */}
          <div>
            <Label>Note</Label>
            <Input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Indicazioni tecniche, varianti, ecc."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {exercise && (
              <Button variant="destructive" onClick={deleteEx} disabled={loading}>
                Elimina
              </Button>
            )}
            <Button variant="hero" onClick={save} disabled={loading} className="flex-1">
              {loading ? 'Salvataggio...' : exercise ? 'Aggiorna' : 'Crea esercizio'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
