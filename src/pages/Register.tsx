import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Scissors, ArrowLeft, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const DAYS = [
  { value: 1, label: 'Lun' }, { value: 2, label: 'Mar' }, { value: 3, label: 'Mer' },
  { value: 4, label: 'Gio' }, { value: 5, label: 'Ven' }, { value: 6, label: 'Sab' }, { value: 0, label: 'Dom' },
];

const generateToken = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 20; i++) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
};

export default function Register() {
  const navigate = useNavigate();
  const { signUp, refreshActivity } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activityName, setActivityName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerSurname, setOwnerSurname] = useState('');
  const [openingDays, setOpeningDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [openStart, setOpenStart] = useState('09:00');
  const [openEnd, setOpenEnd] = useState('19:00');
  const [themeColor, setThemeColor] = useState('#3b82f6');
  const [defaultDuration, setDefaultDuration] = useState(30);
  const [bufferMinutes, setBufferMinutes] = useState(5);
  const [hostWorksInSalon, setHostWorksInSalon] = useState(true);

  const toggleDay = (d: number) => {
    setOpeningDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 6);
  };

  const makeEmployeeSlug = (name: string, surname: string) => {
    return `${name}-${surname}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  };

  const handleSubmit = async () => {
    if (!email || !password || !activityName || !ownerName || !ownerSurname) {
      toast.error('Compila tutti i campi obbligatori');
      return;
    }
    setLoading(true);
    try {
      const { error, session, user: createdUser } = await signUp(email, password);
      if (error) throw error;

      const authUserId = session?.user.id ?? createdUser?.id;
      if (!authUserId) {
        toast.success('Controlla la tua email per confermare la registrazione');
        navigate('/login');
        return;
      }

      // Check existing activity
      const { data: existingActivity } = await supabase
        .from('activities')
        .select('id')
        .eq('user_id', authUserId)
        .limit(1)
        .maybeSingle();

      if (!existingActivity) {
        const { data: newActivity, error: actError } = await supabase.from('activities').insert({
          user_id: authUserId,
          name: activityName,
          slug: generateSlug(activityName),
          category: 'salone',
          owner_name: `${ownerName} ${ownerSurname}`,
          opening_days: openingDays,
          opening_hours: { start: openStart, end: openEnd },
          theme_color: themeColor,
          default_appointment_duration_minutes: defaultDuration,
          buffer_minutes: bufferMinutes,
          host_works_in_salon: hostWorksInSalon,
        }).select('id').single();

        if (actError) throw actError;

        if (newActivity && hostWorksInSalon) {
          await supabase.from('employees').insert({
            activity_id: newActivity.id,
            name: ownerName,
            surname: ownerSurname,
            slug: makeEmployeeSlug(ownerName, ownerSurname),
            token: generateToken(),
            role: 'titolare',
            color: themeColor,
            is_owner: true,
            is_active: true,
          });
        }
      }

      await refreshActivity(authUserId);
      toast.success('Account creato con successo!');
      navigate('/dashboard', { replace: true });
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
          <div className="flex items-center gap-3 mb-1">
            <Scissors className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Crea il tuo salone</h1>
          </div>
          <p className="text-muted-foreground mb-6">Passo {step} di 3</p>

          <div className="flex gap-2 mb-8">
            {[1, 2, 3].map(s => (
              <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-muted'}`} />
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <Label>Nome salone *</Label>
                <Input value={activityName} onChange={e => setActivityName(e.target.value)} placeholder="es. Barber Shop Roma" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nome titolare *</Label>
                  <Input value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Marco" />
                </div>
                <div>
                  <Label>Cognome titolare *</Label>
                  <Input value={ownerSurname} onChange={e => setOwnerSurname(e.target.value)} placeholder="Rossi" />
                </div>
              </div>
              <Button onClick={() => setStep(2)} disabled={!activityName || !ownerName || !ownerSurname} className="w-full" variant="hero">
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
                  <Label>Apertura</Label>
                  <Input type="time" value={openStart} onChange={e => setOpenStart(e.target.value)} />
                </div>
                <div>
                  <Label>Chiusura</Label>
                  <Input type="time" value={openEnd} onChange={e => setOpenEnd(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Durata media appuntamento (min)</Label>
                  <Input type="number" value={defaultDuration} onChange={e => setDefaultDuration(Number(e.target.value))} min={5} max={240} step={5} />
                </div>
                <div>
                  <Label>Buffer tra appuntamenti (min)</Label>
                  <Input type="number" value={bufferMinutes} onChange={e => setBufferMinutes(Number(e.target.value))} min={0} max={60} step={5} />
                </div>
              </div>
              <div>
                <Label>Colore tema</Label>
                <div className="flex items-center gap-3">
                  <input type="color" value={themeColor} onChange={e => setThemeColor(e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer border-0" />
                  <span className="text-sm text-muted-foreground">{themeColor}</span>
                </div>
              </div>
              <div className="rounded-lg border border-border p-4 space-y-2">
                <Label className="text-base">Lavori anche tu nel salone?</Label>
                <p className="text-sm text-muted-foreground">
                  Se sì, avrai un profilo operatore (come gli altri dipendenti) e potrai comparire nelle prenotazioni. Il calendario principale resta il tuo strumento di lavoro.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={hostWorksInSalon ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setHostWorksInSalon(true)}
                  >
                    Sì, opero in salone
                  </Button>
                  <Button
                    type="button"
                    variant={!hostWorksInSalon ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setHostWorksInSalon(false)}
                  >
                    No, solo gestione
                  </Button>
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
                <Label>Email *</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="la-tua@email.com" />
              </div>
              <div>
                <Label>Password *</Label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimo 6 caratteri" />
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
