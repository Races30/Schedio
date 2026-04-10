import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Save, Plus, Trash2, ExternalLink } from 'lucide-react';
import { Service } from '@/types';

const DAYS = [
  { value: 1, label: 'Lunedì' }, { value: 2, label: 'Martedì' }, { value: 3, label: 'Mercoledì' },
  { value: 4, label: 'Giovedì' }, { value: 5, label: 'Venerdì' }, { value: 6, label: 'Sabato' }, { value: 0, label: 'Domenica' },
];

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

  useEffect(() => {
    if (activity) {
      setName(activity.name);
      setOwnerName(activity.owner_name);
      setOpeningDays(activity.opening_days);
      setOpenStart(activity.opening_hours.start);
      setOpenEnd(activity.opening_hours.end);
      setThemeColor(activity.theme_color);
      setDefaultDuration(activity.default_appointment_duration_minutes);
    }
  }, [activity]);

  const { data: services = [], refetch: refetchServices } = useQuery({
    queryKey: ['services', activity?.id],
    queryFn: async () => {
      const { data } = await supabase.from('services').select('*').eq('activity_id', activity!.id).order('name');
      return (data || []) as Service[];
    },
    enabled: !!activity,
  });

  const toggleDay = (d: number) => {
    setOpeningDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const saveSettings = async () => {
    if (!activity) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('activities').update({
        name,
        owner_name: ownerName,
        opening_days: openingDays,
        opening_hours: { start: openStart, end: openEnd },
        theme_color: themeColor,
        default_appointment_duration_minutes: defaultDuration,
      }).eq('id', activity.id);
      if (error) throw error;
      await refreshActivity();
      toast.success('Impostazioni salvate');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!activity) return null;
  const isSalone = activity.category === 'salone';

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">Impostazioni</h1>

      <div className="space-y-8">
        {/* General */}
        <section className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Informazioni attività</h2>
          <div className="grid gap-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Nome attività</Label>
                <Input value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <Label>Nome titolare</Label>
                <Input value={ownerName} onChange={e => setOwnerName(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Link prenotazione pubblica</Label>
              <div className="flex items-center gap-2">
                <Input value={`${window.location.origin}/book/${activity.slug}`} readOnly className="text-muted-foreground" />
                <Button variant="outline" size="icon" asChild>
                  <a href={`/book/${activity.slug}`} target="_blank"><ExternalLink className="w-4 h-4" /></a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Schedule */}
        <section className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Orari di apertura</h2>
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Giorni di apertura</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map(d => (
                  <button key={d.value} onClick={() => toggleDay(d.value)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${openingDays.includes(d.value) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
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
          </div>
        </section>

        {/* Duration & Theme */}
        <section className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Preferenze</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Durata media {isSalone ? 'appuntamento' : 'sessione'} (minuti)</Label>
              <Input type="number" value={defaultDuration} onChange={e => setDefaultDuration(Number(e.target.value))} min={5} max={240} step={5} />
            </div>
            <div>
              <Label>Colore tema</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={themeColor} onChange={e => setThemeColor(e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer border-0" />
                <span className="text-sm text-muted-foreground">{themeColor}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Services (salone only) */}
        {isSalone && (
          <section className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Servizi</h2>
              <ServiceAddButton activityId={activity.id} onAdded={() => refetchServices()} />
            </div>
            {services.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nessun servizio configurato</p>
            ) : (
              <div className="space-y-2">
                {services.map(s => (
                  <ServiceRow key={s.id} service={s} onUpdated={() => refetchServices()} />
                ))}
              </div>
            )}
          </section>
        )}

        <Button variant="hero" onClick={saveSettings} disabled={loading} className="w-full">
          <Save className="w-4 h-4" /> {loading ? 'Salvataggio...' : 'Salva impostazioni'}
        </Button>
      </div>
    </div>
  );
}

function ServiceAddButton({ activityId, onAdded }: { activityId: string; onAdded: () => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState(30);
  const [price, setPrice] = useState('');
  const [color, setColor] = useState('#3b82f6');

  const save = async () => {
    if (!name.trim()) return;
    await supabase.from('services').insert({
      activity_id: activityId,
      name: name.trim(),
      duration_minutes: duration,
      price: price ? parseFloat(price) : null,
      color,
    });
    setName(''); setPrice(''); setDuration(30);
    setAdding(false);
    onAdded();
    toast.success('Servizio aggiunto');
  };

  if (!adding) return <Button variant="outline" size="sm" onClick={() => setAdding(true)}><Plus className="w-4 h-4" /> Aggiungi</Button>;

  return (
    <div className="flex flex-wrap items-end gap-2 bg-muted/50 p-3 rounded-lg w-full">
      <div className="flex-1 min-w-[120px]">
        <Label className="text-xs">Nome</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="es. Taglio" className="h-8" />
      </div>
      <div className="w-20">
        <Label className="text-xs">Durata</Label>
        <Input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} className="h-8" min={5} step={5} />
      </div>
      <div className="w-20">
        <Label className="text-xs">Prezzo €</Label>
        <Input value={price} onChange={e => setPrice(e.target.value)} placeholder="0" className="h-8" />
      </div>
      <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
      <Button size="sm" onClick={save} className="h-8">Salva</Button>
      <Button size="sm" variant="ghost" onClick={() => setAdding(false)} className="h-8">Annulla</Button>
    </div>
  );
}

function ServiceRow({ service, onUpdated }: { service: Service; onUpdated: () => void }) {
  const deleteService = async () => {
    await supabase.from('services').delete().eq('id', service.id);
    onUpdated();
    toast.success('Servizio eliminato');
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: service.color }} />
      <div className="flex-1 min-w-0">
        <span className="font-medium text-sm">{service.name}</span>
        <span className="text-xs text-muted-foreground ml-2">{service.duration_minutes} min</span>
        {service.price && <span className="text-xs text-muted-foreground ml-2">€{service.price}</span>}
      </div>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={deleteService}>
        <Trash2 className="w-4 h-4 text-destructive" />
      </Button>
    </div>
  );
}
