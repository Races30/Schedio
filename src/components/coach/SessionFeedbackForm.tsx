/**
 * SessionFeedbackForm
 *
 * Quick 3-question feedback form for the client after a session/workout.
 * Answers are visible ONLY to the trainer (RLS enforces this).
 *
 * Questions:
 *   1. Energia (1–5 dots)
 *   2. Ti sei sentito stanco? (yes/no)
 *   3. Hai incontrato difficoltà? (yes/no + optional text)
 *   4. Valutazione complessiva (1–5 stars) — optional
 */
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Star, Zap, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface SessionFeedbackFormProps {
  clientId: string;
  sessionId?: string | null;
  appointmentId?: string | null;
  onDone: () => void;
}

function EnergyPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const labels = ['Scarsa', 'Bassa', 'Media', 'Buona', 'Ottima'];
  return (
    <div className="flex gap-2 items-center">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          className={`w-10 h-10 rounded-full border-2 transition-all font-bold text-sm
            ${value >= i
              ? 'bg-emerald-500 border-emerald-500 text-white shadow-md scale-105'
              : 'border-border text-muted-foreground hover:border-emerald-400'
            }`}
        >
          {i}
        </button>
      ))}
      {value > 0 && (
        <span className="text-xs text-muted-foreground ml-1">{labels[value - 1]}</span>
      )}
    </div>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          className="transition-transform hover:scale-110"
        >
          <Star
            className={`w-7 h-7 transition-colors ${
              i <= (hover || value) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function YesNoToggle({
  value, onChange, yesLabel = 'Sì', noLabel = 'No',
}: { value: boolean | null; onChange: (v: boolean) => void; yesLabel?: string; noLabel?: string }) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all
          ${value === true ? 'bg-amber-500 border-amber-500 text-white' : 'border-border text-muted-foreground hover:border-amber-400'}`}
      >
        {yesLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all
          ${value === false ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border text-muted-foreground hover:border-emerald-400'}`}
      >
        {noLabel}
      </button>
    </div>
  );
}

export function SessionFeedbackForm({ clientId, sessionId, appointmentId, onDone }: SessionFeedbackFormProps) {
  const [energy, setEnergy]           = useState(0);
  const [tired, setTired]             = useState<boolean | null>(null);
  const [difficulty, setDifficulty]   = useState<boolean | null>(null);
  const [diffNotes, setDiffNotes]     = useState('');
  const [rating, setRating]           = useState(0);
  const [saving, setSaving]           = useState(false);
  const [done, setDone]               = useState(false);

  const isValid = energy > 0 && tired !== null && difficulty !== null;

  const handleSubmit = async () => {
    if (!isValid) { toast.error('Rispondi a tutte le domande'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('session_feedback').insert({
        client_id:        clientId,
        session_id:       sessionId ?? null,
        appointment_id:   appointmentId ?? null,
        energy_level:     energy,
        was_tired:        tired,
        had_difficulty:   difficulty,
        difficulty_notes: difficulty && diffNotes ? diffNotes : null,
        overall_rating:   rating > 0 ? rating : null,
      } as never);
      if (error) throw error;
      setDone(true);
      setTimeout(onDone, 1800);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Errore');
    } finally { setSaving(false); }
  };

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-3 py-8 text-center"
      >
        <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        <p className="font-semibold text-lg">Grazie per il feedback! 💪</p>
        <p className="text-sm text-muted-foreground">Il tuo trainer lo vedrà a breve.</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Zap className="w-4 h-4 text-amber-500" />
        <span>Feedback sessione — solo il tuo trainer potrà vederlo</span>
      </div>

      {/* Q1: Energy */}
      <div className="space-y-2">
        <p className="font-medium text-sm">1. Come valuteresti il tuo livello di energia durante la sessione?</p>
        <EnergyPicker value={energy} onChange={setEnergy} />
      </div>

      {/* Q2: Tired */}
      <div className="space-y-2">
        <p className="font-medium text-sm">2. Ti sei sentito molto stanco/a?</p>
        <YesNoToggle value={tired} onChange={setTired} />
      </div>

      {/* Q3: Difficulty */}
      <div className="space-y-2">
        <p className="font-medium text-sm">3. Hai incontrato difficoltà particolari?</p>
        <YesNoToggle value={difficulty} onChange={setDifficulty} />
        {difficulty === true && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
            <Textarea
              value={diffNotes}
              onChange={e => setDiffNotes(e.target.value)}
              placeholder="Descrivi brevemente (es. dolore alla spalla, ho saltato squat)"
              className="text-sm min-h-[60px] mt-2"
            />
          </motion.div>
        )}
      </div>

      {/* Q4: Overall rating (optional) */}
      <div className="space-y-2">
        <p className="font-medium text-sm">4. Valutazione complessiva <span className="text-muted-foreground font-normal">(opzionale)</span></p>
        <StarPicker value={rating} onChange={setRating} />
      </div>

      <Button
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
        disabled={!isValid || saving}
        onClick={handleSubmit}
      >
        {saving ? 'Invio...' : 'Invia feedback 📨'}
      </Button>
    </div>
  );
}
