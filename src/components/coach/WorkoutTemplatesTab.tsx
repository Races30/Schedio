/**
 * WorkoutTemplatesTab
 *
 * Shown inside the WorkoutPlansPage "Template" tab.
 * Lists all workout_plans where is_template=true for the current activity.
 * Supports:
 *  - "Usa template" → choose client → clone plan as a normal workout_plan
 *  - "Elimina" → delete template
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  LayoutTemplate, Trash2, UserPlus, Dumbbell,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Template {
  id: string;
  template_name: string | null;
  name: string;
  exercises: unknown[];
  trainer_notes: string | null;
  activity_id: string;
  created_at: string;
}

interface Client {
  id: string;
  name: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// "Usa template" modal
// ─────────────────────────────────────────────────────────────────────────────

function UseTemplateDialog({
  template,
  clients,
  activityId,
  onClose,
}: {
  template: Template;
  clients: Client[];
  activityId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [clientId, setClientId] = useState('');
  const [saving, setSaving] = useState(false);

  const handleApply = async () => {
    if (!clientId) { toast.error('Seleziona un cliente'); return; }
    setSaving(true);
    try {
      // Deactivate any existing active plan for the client
      await supabase
        .from('workout_plans')
        .update({ is_active: false })
        .eq('client_id', clientId)
        .eq('is_active', true);

      const now = new Date().toISOString();
      const { error } = await supabase.from('workout_plans').insert({
        activity_id:   activityId,
        client_id:     clientId,
        name:          template.name,
        exercises:     template.exercises as any,
        trainer_notes: template.trainer_notes,
        is_active:     true,
        is_template:   false,
        created_at:    now,
        updated_at:    now,
      });
      if (error) throw error;

      const client = clients.find((c) => c.id === clientId);
      toast.success(`Scheda "${template.name}" assegnata a ${client?.name ?? 'cliente'}`);
      qc.invalidateQueries({ queryKey: ['workout-plan', clientId] });
      qc.invalidateQueries({ queryKey: ['client-workout-plan', clientId] });
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Errore');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" />
            Usa template
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Stai per creare una scheda basata su{' '}
              <span className="font-semibold text-foreground">
                {template.template_name || template.name}
              </span>{' '}
              ({(template.exercises as unknown[])?.length || 0} esercizi).
            </p>
          </div>
          <div>
            <Label>Assegna a cliente *</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Seleziona cliente..." />
              </SelectTrigger>
              <SelectContent>
                {clients.length === 0 ? (
                  <SelectItem value="__empty__" disabled>Nessun cliente</SelectItem>
                ) : (
                  clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Annulla</Button>
          <Button variant="hero" onClick={handleApply} disabled={saving || !clientId}>
            {saving ? 'Assegnazione...' : 'Crea scheda'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete confirmation
// ─────────────────────────────────────────────────────────────────────────────

function DeleteTemplateDialog({
  template,
  onClose,
}: {
  template: Template;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('workout_plans')
        .delete()
        .eq('id', template.id);
      if (error) throw error;
      toast.success('Template eliminato');
      qc.invalidateQueries({ queryKey: ['workout-templates'] });
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Errore');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="w-4 h-4" /> Elimina template
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground py-2">
          Eliminare il template{' '}
          <span className="font-semibold text-foreground">
            {template.template_name || template.name}
          </span>
          ?<br />
          Questa azione è irreversibile. Le schede già assegnate ai clienti{' '}
          <strong>non verranno</strong> eliminate.
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={deleting}>Annulla</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Eliminazione...' : 'Elimina'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

interface WorkoutTemplatesTabProps {
  activityId: string;
  clients: Client[];
}

export function WorkoutTemplatesTab({ activityId, clients }: WorkoutTemplatesTabProps) {
  const [useTarget, setUseTarget] = useState<Template | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ['workout-templates', activityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_plans')
        .select('id, template_name, name, exercises, trainer_notes, activity_id, created_at')
        .eq('activity_id', activityId)
        .eq('is_template', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Template[];
    },
    enabled: !!activityId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass-card p-12 text-center"
      >
        <LayoutTemplate className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
        <p className="font-medium text-muted-foreground">Nessun template ancora</p>
        <p className="text-sm text-muted-foreground mt-1">
          Apri una scheda esistente di un cliente e usa{' '}
          <span className="font-semibold">"Salva come template"</span> per creare il primo.
        </p>
      </motion.div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <AnimatePresence>
          {templates.map((tpl, i) => {
            const exerciseCount = (tpl.exercises as unknown[])?.length || 0;
            const displayName = tpl.template_name || tpl.name;

            return (
              <motion.div
                key={tpl.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ delay: i * 0.04 }}
                className="glass-card p-5 flex items-center gap-4"
              >
                {/* Icon */}
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <LayoutTemplate className="w-5 h-5 text-primary" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{displayName}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <Dumbbell className="w-3 h-3" />
                      {exerciseCount} esercizi
                    </span>
                    {tpl.trainer_notes && (
                      <span className="truncate max-w-[200px] italic">· {tpl.trainer_notes}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => setUseTarget(tpl)}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Usa template
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget(tpl)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Modals */}
      {useTarget && (
        <UseTemplateDialog
          template={useTarget}
          clients={clients}
          activityId={activityId}
          onClose={() => setUseTarget(null)}
        />
      )}
      {deleteTarget && (
        <DeleteTemplateDialog
          template={deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
