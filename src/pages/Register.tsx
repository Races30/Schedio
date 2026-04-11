import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Scissors, Dumbbell, ArrowLeft, ArrowRight, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ActivityCategory } from '@/types';

const DAYS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mer' },
  { value: 4, label: 'Gio' },
  { value: 5, label: 'Ven' },
  { value: 6, label: 'Sab' },
  { value: 0, label: 'Dom' },
];

export default function Register() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [category, setCategory] = useState<ActivityCategory | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activityName, setActivityName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [openingDays, setOpeningDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [openStart, setOpenStart] = useState('09:00');
  const [openEnd, setOpenEnd] = useState('19:00');
  const [themeColor, setThemeColor] = useState('#3b82f6');
  const [defaultDuration, setDefaultDuration] = useState(30);

  const toggleDay = (d: number) => {
    setOpeningDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 6);
  };

  const handleSubmit = async () => {
    if (!category || !email || !password || !activityName || !ownerName) {
      toast.error('Compila tutti i campi obbligatori');
      return;
    }
    setLoading(true);
    try {
      const { error } = await signUp(email, password);
      if (error) throw error;

      // Wait briefly for auto-confirm session to establish
      let session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        // Retry after a short delay
        await new Promise(r => setTimeout(r, 1500));
        session = (await supabase.auth.getSession()).data.session;
      }

      if (!session) {
        toast.success('Controlla la tua email per confermare la registrazione');
        navigate('/login');
        return;
      }

      const { error: actError } = await supabase.from('activities').insert({
        user_id: session.user.id,
        name: activityName,
        slug: generateSlug(activityName),
        category,
        owner_name: ownerName,
        opening_days: openingDays,
        opening_hours: { start: openStart, end: openEnd },
        theme_color: themeColor,
        default_appointment_duration_minutes: defaultDuration,
      });

      if (actError) throw actError;
      toast.success('Account creato con successo!');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Errore durante la registrazione');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="w-4 h-4" /> Torna alla home
        </Link>

        <div className="glass-card p-8">
          <h1 className="text-2xl font-bold mb-1">Crea il tuo account</h1>
          <p className="text-muted-foreground mb-6">Passo {step} di 3</p>

          {/* Progress bar */}
          <div className="flex gap-2 mb-8">
            {[1, 2, 3].map(s => (
              <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-muted'}`} />
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <Label className="text-base font-medium mb-3 block">Che tipo di attività gestisci?</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => { setCategory('salone'); setDefaultDuration(30); }}
                    className={`p-6 rounded-xl border-2 text-center transition-all ${category === 'salone' ? 'border-salone bg-salone-light' : 'border-border hover:border-salone/50'}`}>
                    <Scissors className={`w-8 h-8 mx-auto mb-2 ${category === 'salone' ? 'text-salone' : 'text-muted-foreground'}`} />
                    <div className="font-medium">Salone</div>
                    <div className="text-xs text-muted-foreground">Barbiere / Parrucchiere</div>
                  </button>
                  <button onClick={() => { setCategory('coach'); setDefaultDuration(60); }}
                    className={`p-6 rounded-xl border-2 text-center transition-all ${category === 'coach' ? 'border-coach bg-coach-light' : 'border-border hover:border-coach/50'}`}>
                    <Dumbbell className={`w-8 h-8 mx-auto mb-2 ${category === 'coach' ? 'text-coach' : 'text-muted-foreground'}`} />
                    <div className="font-medium">Coach</div>
                    <div className="text-xs text-muted-foreground">Personal Trainer</div>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="actName">Nome attività *</Label>
                  <Input id="actName" value={activityName} onChange={e => setActivityName(e.target.value)} placeholder="es. Barber Shop Roma" />
                </div>
                <div>
                  <Label htmlFor="ownerName">Nome titolare *</Label>
                  <Input id="ownerName" value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="es. Marco Rossi" />
                </div>
              </div>
              <Button onClick={() => setStep(2)} disabled={!category || !activityName || !ownerName} className="w-full" variant="hero">
                Continua <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <Label className="mb-3 block">Giorni di apertura</Label>
                <div className="flex gap-2">
                  {DAYS.map(d => (
                    <button key={d.value} onClick={() => toggleDay(d.value)}
                      className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${openingDays.includes(d.value) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="openStart">Apertura</Label>
                  <Input id="openStart" type="time" value={openStart} onChange={e => setOpenStart(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="openEnd">Chiusura</Label>
                  <Input id="openEnd" type="time" value={openEnd} onChange={e => setOpenEnd(e.target.value)} />
                </div>
              </div>
              <div>
                <Label htmlFor="duration">Durata media {category === 'salone' ? 'appuntamento' : 'sessione'} (minuti)</Label>
                <Input id="duration" type="number" value={defaultDuration} onChange={e => setDefaultDuration(Number(e.target.value))} min={5} max={240} step={5} />
              </div>
              <div>
                <Label htmlFor="themeColor">Colore tema</Label>
                <div className="flex items-center gap-3">
                  <input type="color" id="themeColor" value={themeColor} onChange={e => setThemeColor(e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer border-0" />
                  <span className="text-sm text-muted-foreground">{themeColor}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="w-4 h-4" /> Indietro
                </Button>
                <Button onClick={() => setStep(3)} className="flex-1" variant="hero">
                  Continua <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="la-tua@email.com" />
              </div>
              <div>
                <Label htmlFor="password">Password *</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimo 6 caratteri" />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="w-4 h-4" /> Indietro
                </Button>
                <Button onClick={handleSubmit} className="flex-1" variant="hero" disabled={loading || !email || !password}>
                  {loading ? 'Creazione...' : 'Crea account'}
                </Button>
              </div>
            </div>
          )}

          <p className="text-center text-sm text-muted-foreground mt-6">
            Hai già un account? <Link to="/login" className="text-primary hover:underline">Accedi</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
