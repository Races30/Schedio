/**
 * TrainerAvailabilitySection
 *
 * Coach-only section in Settings.
 * Lets the trainer define per-day availability windows (multiple slots/day).
 * Persists to the `trainer_availability` table via delete-then-insert on save.
 */
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TrainerAvailability } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Save, Plus, X, Clock, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Constants ────────────────────────────────────────────────────────────────

const WEEK_DAYS = [
  { dow: 1, label: 'Lunedì',    short: 'Lun' },
  { dow: 2, label: 'Martedì',   short: 'Mar' },
  { dow: 3, label: 'Mercoledì', short: 'Mer' },
  { dow: 4, label: 'Giovedì',   short: 'Gio' },
  { dow: 5, label: 'Venerdì',   short: 'Ven' },
  { dow: 6, label: 'Sabato',    short: 'Sab' },
  { dow: 0, label: 'Domenica',  short: 'Dom' },
];

// ── Types ────────────────────────────────────────────────────────────────────

interface Slot { start: string; end: string }
interface DayConfig { isActive: boolean; slots: Slot[] }
type WeekConfig = Record<number, DayConfig>;

function emptyWeek(): WeekConfig {
  const wc: WeekConfig = {};
  for (let d = 0; d <= 6; d++) wc[d] = { isActive: false, slots: [] };
  return wc;
}

function toHHmm(t: string): string {
  return t.slice(0, 5); // "HH:mm:ss" → "HH:mm"
}

// ── Component ────────────────────────────────────────────────────────────────

export function TrainerAvailabilitySection({ activityId }: { activityId: string }) {
  const qc = useQueryClient();
  const [weekConfig, setWeekConfig] = useState<WeekConfig>(emptyWeek());
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const { data: rows = [], isLoading } = useQuery<TrainerAvailability[]>({
    queryKey: ['trainer-availability', activityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trainer_availability')
        .select('*')
        .eq('activity_id', activityId)
        .order('day_of_week')
        .order('start_time');
      if (error && error.code !== '42P01') throw error;
      return (data ?? []) as TrainerAvailability[];
    },
    enabled: !!activityId,
  });

  // Populate state from fetched rows
  useEffect(() => {
    const wc = emptyWeek();
    for (const row of rows) {
      const d = row.day_of_week;
      wc[d].isActive = true;
      wc[d].slots.push({ start: toHHmm(row.start_time), end: toHHmm(row.end_time) });
    }
    setWeekConfig(wc);
    setIsDirty(false);
  }, [rows]);

  // ── Mutators ──────────────────────────────────────────────────────────────

  const mark = () => setIsDirty(true);

  const toggleDay = (dow: number, active: boolean) => {
    setWeekConfig(prev => ({
      ...prev,
      [dow]: {
        ...prev[dow],
        isActive: active,
        slots: active && prev[dow].slots.length === 0
          ? [{ start: '09:00', end: '13:00' }]
          : prev[dow].slots,
      },
    }));
    mark();
  };

  const addSlot = (dow: number) => {
    setWeekConfig(prev => ({
      ...prev,
      [dow]: { ...prev[dow], slots: [...prev[dow].slots, { start: '09:00', end: '13:00' }] },
    }));
    mark();
  };

  const removeSlot = (dow: number, idx: number) => {
    setWeekConfig(prev => {
      const slots = prev[dow].slots.filter((_, i) => i !== idx);
      return { ...prev, [dow]: { ...prev[dow], slots, isActive: slots.length > 0 } };
    });
    mark();
  };

  const updateSlot = (dow: number, idx: number, field: 'start' | 'end', val: string) => {
    setWeekConfig(prev => ({
      ...prev,
      [dow]: {
        ...prev[dow],
        slots: prev[dow].slots.map((s, i) => i === idx ? { ...s, [field]: val } : s),
      },
    }));
    mark();
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const save = async () => {
    setSaving(true);
    try {
      // Delete all existing rows for this activity
      const { error: delErr } = await supabase
        .from('trainer_availability')
        .delete()
        .eq('activity_id', activityId);
      if (delErr) throw delErr;

      // Build new rows
      const toInsert: Array<{
        activity_id: string;
        day_of_week: number;
        start_time: string;
        end_time: string;
        is_active?: boolean | null;
      }> = [];

      for (let dow = 0; dow <= 6; dow++) {
        const day = weekConfig[dow];
        if (!day.isActive) continue;
        for (const slot of day.slots) {
          if (!slot.start || !slot.end || slot.start >= slot.end) continue;
          toInsert.push({
            activity_id: activityId,
            day_of_week: dow,
            start_time: slot.start,
            end_time: slot.end,
            is_active: true,
          });
        }
      }

      if (toInsert.length > 0) {
        const { error: insErr } = await supabase
          .from('trainer_availability')
          .insert(toInsert);
        if (insErr) throw insErr;
      }

      qc.invalidateQueries({ queryKey: ['trainer-availability'] });
      qc.invalidateQueries({ queryKey: ['trainer-availability-client'] });
      setIsDirty(false);
      toast.success('Disponibilità salvata!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const totalSlots = Object.values(weekConfig).reduce((acc, d) => acc + (d.isActive ? d.slots.length : 0), 0);

  return (
    <section className="glass-card p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <h2 className="text-lg font-semibold">Disponibilità settimanale</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Definisci gli orari in cui sei disponibile. I clienti vedranno solo questi slot quando propongono una sessione.
          </p>
        </div>
        <AnimatePresence>
          {isDirty && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
              <Button onClick={save} disabled={saving} size="sm" variant="hero">
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Salvando...' : 'Salva'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Empty state */}
      {!isLoading && totalSlots === 0 && !isDirty && (
        <div className="rounded-xl border-2 border-dashed border-border p-6 text-center mb-6">
          <Clock className="w-8 h-8 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-sm font-medium text-muted-foreground">Nessuna disponibilità configurata</p>
          <p className="text-xs text-muted-foreground mt-1 opacity-70">
            Attiva i giorni qui sotto e aggiungi le fasce orarie in cui sei disponibile.
          </p>
        </div>
      )}

      {/* Days */}
      <div className="space-y-3">
        {WEEK_DAYS.map(({ dow, label }) => {
          const day = weekConfig[dow];
          return (
            <div
              key={dow}
              className={`rounded-xl border transition-all ${
                day.isActive ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/20'
              }`}
            >
              {/* Day header row */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={day.isActive}
                    onCheckedChange={(v) => toggleDay(dow, v)}
                    id={`day-switch-${dow}`}
                  />
                  <Label
                    htmlFor={`day-switch-${dow}`}
                    className={`text-sm font-medium cursor-pointer select-none ${
                      day.isActive ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {label}
                  </Label>
                </div>
                {day.isActive && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-primary gap-1"
                    onClick={() => addSlot(dow)}
                  >
                    <Plus className="w-3 h-3" /> Fascia
                  </Button>
                )}
              </div>

              {/* Slots */}
              <AnimatePresence>
                {day.isActive && day.slots.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-3 space-y-2 border-t border-border/40 pt-3">
                      {day.slots.map((slot, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Input
                            type="time"
                            value={slot.start}
                            onChange={(e) => updateSlot(dow, idx, 'start', e.target.value)}
                            className="h-8 text-sm w-32"
                          />
                          <span className="text-xs text-muted-foreground">→</span>
                          <Input
                            type="time"
                            value={slot.end}
                            onChange={(e) => updateSlot(dow, idx, 'end', e.target.value)}
                            className="h-8 text-sm w-32"
                          />
                          <button
                            type="button"
                            onClick={() => removeSlot(dow, idx)}
                            className="ml-1 w-6 h-6 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Bottom save button for convenience */}
      {isDirty && (
        <Button onClick={save} disabled={saving} variant="hero" className="w-full mt-6">
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Salva disponibilità'}
        </Button>
      )}
    </section>
  );
}
