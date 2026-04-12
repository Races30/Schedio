import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Save, ExternalLink, Scissors, Users } from 'lucide-react';

const DAYS = [
  { value: 1, label: 'Lunedì' },
  { value: 2, label: 'Martedì' },
  { value: 3, label: 'Mercoledì' },
  { value: 4, label: 'Giovedì' },
  { value: 5, label: 'Venerdì' },
  { value: 6, label: 'Sabato' },
  { value: 0, label: 'Domenica' },
];

const generateToken = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 20; i++) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
};

const makeEmployeeSlug = (n: string, s: string) =>
  `${n}-${s}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function SettingsPage() {
  const { activity, refreshActivity } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [openingDays, setOpeningDays] = useState<number[]>([]);
  const [openStart, setOpenStart] = useState('09:00');
  const [openEnd, setOpenEnd] = useState('19:00');
  const [themeColor, setThemeColor] = useState('#3b82f6');
  const [defaultDuration, setDefaultDuration] = useState(30);
  const [bufferMinutes, setBufferMinutes] = useState(5);
  const [hostWorksInSalon, setHostWorksInSalon] = useState(true);

  useEffect(() => {
    if (activity) {
      setName(activity.name);
      setOwnerName(activity.owner_name);
      setOpeningDays(activity.opening_days);
      setOpenStart(activity.opening_hours.start);
      setOpenEnd(activity.opening_hours.end);
      setThemeColor(activity.theme_color);
      setDefaultDuration(activity.default_appointment_duration_minutes);
      setBufferMinutes(activity.buffer_minutes);
      setHostWorksInSalon(activity.host_works_in_salon !== false);
    }
  }, [activity]);

  const toggleDay = (d: number) => {
    setOpeningDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const syncOwnerEmployeeRow = async () => {
    if (!activity) return;
    const parts = ownerName.trim().split(/\s+/);
    const oname = parts[0] || 'Titolare';
    const osurname = parts.slice(1).join(' ') || '—';

    const { data: ownerRow } = await supabase
      .from('employees')
      .select('id')
      .eq('activity_id', activity.id)
      .eq('is_owner', true)
      .maybeSingle();

    if (hostWorksInSalon) {
      if (!ownerRow) {
        const { error } = await supabase.from('employees').insert({
          activity_id: activity.id,
          name: oname,
          surname: osurname,
          slug: makeEmployeeSlug(oname, osurname),
          token: generateToken(),
          role: 'titolare',
          color: themeColor,
          is_owner: true,
          is_active: true,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('employees').update({ is_active: true }).eq('id', ownerRow.id);
        if (error) throw error;
      }
    } else if (ownerRow) {
      const { error } = await supabase.from('employees').update({ is_active: false }).eq('id', ownerRow.id);
      if (error) throw error;
    }
  };

  const saveSettings = async () => {
    if (!activity) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('activities')
        .update({
          name,
          owner_name: ownerName,
          opening_days: openingDays,
          opening_hours: { start: openStart, end: openEnd },
          theme_color: themeColor,
          default_appointment_duration_minutes: defaultDuration,
          buffer_minutes: bufferMinutes,
          host_works_in_salon: hostWorksInSalon,
        })
        .eq('id', activity.id);
      if (error) throw error;

      await syncOwnerEmployeeRow();
      await refreshActivity();
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Impostazioni salvate');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Errore';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (!activity) return null;

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">Impostazioni</h1>

      <div className="space-y-8">
        <section className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Informazioni salone</h2>
          <div className="grid gap-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Nome salone</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>Nome titolare</Label>
                <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Link prenotazione pubblica</Label>
              <div className="flex items-center gap-2">
                <Input value={`${window.location.origin}/${activity.slug}`} readOnly className="text-muted-foreground" />
                <Button variant="outline" size="icon" asChild>
                  <a href={`/${activity.slug}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Ruolo titolare nel salone</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Se lavori anche tu come operatore, apparirai nei dipendenti, nei filtri del calendario e potrai ricevere prenotazioni.
            Usa sempre il calendario principale: non serve una pagina privata separata per il titolare.
          </p>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
            <div>
              <Label htmlFor="host-works" className="text-base font-medium">
                Lavoro nel salone come operatore
              </Label>
              <p className="text-xs text-muted-foreground mt-1">Disattiva se gestisci solo il salone senza prendere clienti in agenda.</p>
            </div>
            <Switch id="host-works" checked={hostWorksInSalon} onCheckedChange={setHostWorksInSalon} />
          </div>
        </section>

        <section className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Gestione salone</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Servizi e dipendenti hanno schermate dedicate (non sono più in questa pagina).
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="justify-start" asChild>
              <Link to="/services">
                <Scissors className="w-4 h-4 mr-2" />
                Servizi
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link to="/employees">
                <Users className="w-4 h-4 mr-2" />
                Dipendenti
              </Link>
            </Button>
          </div>
        </section>

        <section className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Orari di apertura</h2>
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Giorni di apertura</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDay(d.value)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${openingDays.includes(d.value) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Apertura</Label>
                <Input type="time" value={openStart} onChange={(e) => setOpenStart(e.target.value)} />
              </div>
              <div>
                <Label>Chiusura</Label>
                <Input type="time" value={openEnd} onChange={(e) => setOpenEnd(e.target.value)} />
              </div>
            </div>
          </div>
        </section>

        <section className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Preferenze</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <Label>Durata media (min)</Label>
              <Input
                type="number"
                value={defaultDuration}
                onChange={(e) => setDefaultDuration(Number(e.target.value))}
                min={5}
                max={240}
                step={5}
              />
            </div>
            <div>
              <Label>Buffer tra app. (min)</Label>
              <Input
                type="number"
                value={bufferMinutes}
                onChange={(e) => setBufferMinutes(Number(e.target.value))}
                min={0}
                max={60}
                step={5}
              />
            </div>
            <div>
              <Label>Colore tema</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={themeColor}
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border-0"
                />
                <span className="text-sm text-muted-foreground">{themeColor}</span>
              </div>
            </div>
          </div>
        </section>

        <Button variant="hero" onClick={saveSettings} disabled={loading} className="w-full">
          <Save className="w-4 h-4" /> {loading ? 'Salvataggio...' : 'Salva impostazioni'}
        </Button>
      </div>
    </div>
  );
}
