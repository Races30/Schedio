import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Save, ExternalLink, Scissors, Users, Upload, X } from 'lucide-react';

const DAYS = [
  { value: 1, label: 'Lunedì' },
  { value: 2, label: 'Martedì' },
  { value: 3, label: 'Mercoledì' },
  { value: 4, label: 'Giovedì' },
  { value: 5, label: 'Venerdì' },
  { value: 6, label: 'Sabato' },
  { value: 0, label: 'Domenica' },
];

const SPECIALIZATIONS = [
  'Dimagrimento', 'Aumento massa', 'Tonificazione', 'Postura',
  'Performance', 'Allenamento funzionale', 'Coaching online', 'Recupero forma',
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

  const isSalone = activity?.category === 'salone';
  const isCoach = activity?.category === 'coach';

  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [description, setDescription] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [openingDays, setOpeningDays] = useState<number[]>([]);
  const [openStart, setOpenStart] = useState('09:00');
  const [openEnd, setOpenEnd] = useState('19:00');
  const [themeColor, setThemeColor] = useState('#3b82f6');
  const [defaultDuration, setDefaultDuration] = useState(30);
  const [bufferMinutes, setBufferMinutes] = useState(5);
  const [hostWorksInSalon, setHostWorksInSalon] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(60);
  const [minNoticeHours, setMinNoticeHours] = useState(2);

  useEffect(() => {
    if (activity) {
      setName(activity.name);
      setOwnerName(activity.owner_name);
      setDescription(activity.description || '');
      setOpeningDays(activity.opening_days);
      setOpenStart(activity.opening_hours.start);
      setOpenEnd(activity.opening_hours.end);
      setThemeColor(activity.theme_color);
      setDefaultDuration(activity.default_appointment_duration_minutes);
      setBufferMinutes(activity.buffer_minutes);
      setHostWorksInSalon(activity.host_works_in_salon !== false);
      setLogoUrl(activity.logo_url || null);
      setMaxAdvanceDays((activity as any).max_advance_booking_days || 60);
      setMinNoticeHours((activity as any).min_booking_notice_hours || 2);
      // Extract specialization from description for coach
      if (activity.category === 'coach' && activity.description) {
        const match = SPECIALIZATIONS.find(s => activity.description?.toLowerCase().includes(s.toLowerCase()));
        if (match) setSpecialization(match);
      }
    }
  }, [activity]);

  const toggleDay = (d: number) => {
    setOpeningDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activity) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${activity.id}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage.from('activity-assets').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('activity-assets').getPublicUrl(path);
      setLogoUrl(publicUrl);
      toast.success('Foto caricata');
    } catch (err: any) {
      toast.error(err.message || 'Errore upload');
    } finally {
      setUploading(false);
    }
  };

  const syncOwnerEmployeeRow = async () => {
    if (!activity || isCoach) return;
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
          activity_id: activity.id, name: oname, surname: osurname,
          slug: makeEmployeeSlug(oname, osurname), token: generateToken(),
          role: 'titolare', color: themeColor, is_owner: true, is_active: true,
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
          name, owner_name: ownerName,
          description: description || null,
          logo_url: logoUrl,
          opening_days: openingDays,
          opening_hours: { start: openStart, end: openEnd },
          theme_color: themeColor,
          default_appointment_duration_minutes: defaultDuration,
          buffer_minutes: bufferMinutes,
          host_works_in_salon: isSalone ? hostWorksInSalon : false,
          max_advance_booking_days: maxAdvanceDays,
          min_booking_notice_hours: minNoticeHours,
        })
        .eq('id', activity.id);
      if (error) throw error;

      if (isSalone) await syncOwnerEmployeeRow();
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
      <h1 className="text-2xl font-bold mb-8">{isCoach ? 'Impostazioni Coach' : 'Impostazioni'}</h1>

      <div className="space-y-8">
        {/* Info section */}
        <section className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">{isCoach ? 'Profilo trainer' : 'Informazioni salone'}</h2>
          <div className="grid gap-4">
            {/* Photo */}
            <div>
              <Label>Foto / Logo</Label>
              <div className="flex items-center gap-4 mt-2">
                {logoUrl ? (
                  <div className="relative">
                    <img src={logoUrl} alt="Logo" className="w-16 h-16 rounded-lg object-cover" />
                    <button onClick={() => setLogoUrl(null)} className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                    <Upload className="w-6 h-6" />
                  </div>
                )}
                <label className="cursor-pointer">
                  <span className="text-sm text-primary hover:underline">{uploading ? 'Caricamento...' : 'Carica immagine'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
                </label>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>{isCoach ? 'Nome attività' : 'Nome salone'}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>{isCoach ? 'Nome trainer' : 'Nome titolare'}</Label>
                <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
              </div>
            </div>

            {/* Coach-specific fields */}
            {isCoach && (
              <>
                <div>
                  <Label>Specializzazione</Label>
                  <Select value={specialization} onValueChange={setSpecialization}>
                    <SelectTrigger><SelectValue placeholder="Seleziona specializzazione" /></SelectTrigger>
                    <SelectContent>
                      {SPECIALIZATIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Bio / Descrizione</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Racconta qualcosa di te e della tua esperienza..." rows={4} />
                </div>
              </>
            )}

            <div>
              <Label>Link prenotazione pubblica</Label>
              <div className="flex items-center gap-2">
                <Input value={`${window.location.origin}/${activity.slug}`} readOnly className="text-muted-foreground" />
                <Button variant="outline" size="icon" asChild>
                  <a href={`/${activity.slug}`} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4" /></a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Salon-only: host role */}
        {isSalone && (
          <section className="glass-card p-6">
            <h2 className="text-lg font-semibold mb-4">Ruolo titolare nel salone</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Se lavori anche tu come operatore, apparirai nei dipendenti, nei filtri del calendario e potrai ricevere prenotazioni.
            </p>
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
              <div>
                <Label htmlFor="host-works" className="text-base font-medium">Lavoro nel salone come operatore</Label>
                <p className="text-xs text-muted-foreground mt-1">Disattiva se gestisci solo il salone senza prendere clienti in agenda.</p>
              </div>
              <Switch id="host-works" checked={hostWorksInSalon} onCheckedChange={setHostWorksInSalon} />
            </div>
          </section>
        )}

        {/* Salon-only: management links */}
        {isSalone && (
          <section className="glass-card p-6">
            <h2 className="text-lg font-semibold mb-4">Gestione salone</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="outline" className="justify-start" asChild>
                <Link to="/services"><Scissors className="w-4 h-4 mr-2" /> Servizi</Link>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <Link to="/employees"><Users className="w-4 h-4 mr-2" /> Dipendenti</Link>
              </Button>
            </div>
          </section>
        )}

        {/* Opening hours */}
        <section className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">{isCoach ? 'Disponibilità' : 'Orari di apertura'}</h2>
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">{isCoach ? 'Giorni lavorativi' : 'Giorni di apertura'}</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => (
                  <button key={d.value} type="button" onClick={() => toggleDay(d.value)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${openingDays.includes(d.value) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{isCoach ? 'Inizio' : 'Apertura'}</Label><Input type="time" value={openStart} onChange={(e) => setOpenStart(e.target.value)} /></div>
              <div><Label>{isCoach ? 'Fine' : 'Chiusura'}</Label><Input type="time" value={openEnd} onChange={(e) => setOpenEnd(e.target.value)} /></div>
            </div>
          </div>
        </section>

        {/* Preferences */}
        <section className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Preferenze</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <Label>{isCoach ? 'Durata media sessione (min)' : 'Durata media (min)'}</Label>
              <Input type="number" value={defaultDuration} onChange={(e) => setDefaultDuration(Number(e.target.value))} min={5} max={240} step={5} />
            </div>
            <div>
              <Label>Buffer tra {isCoach ? 'sessioni' : 'app.'} (min)</Label>
              <Input type="number" value={bufferMinutes} onChange={(e) => setBufferMinutes(Number(e.target.value))} min={0} max={60} step={5} />
            </div>
            <div>
              <Label>Colore tema</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer border-0" />
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
