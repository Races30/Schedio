import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Activity, Service, Appointment } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format, addDays, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { generateTimeSlots, addMinutesToTime, formatTime, getDayName } from '@/utils/dateHelpers';
import { toast } from 'sonner';
import { Calendar, Clock, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';

export default function PublicBooking() {
  const { slug } = useParams<{ slug: string }>();
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [booked, setBooked] = useState(false);
  const [loading, setLoading] = useState(false);

  const { data: activity, isLoading } = useQuery({
    queryKey: ['public-activity', slug],
    queryFn: async () => {
      const { data } = await supabase.from('activities').select('*').eq('slug', slug!).single();
      return data as Activity | null;
    },
    enabled: !!slug,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['public-services', activity?.id],
    queryFn: async () => {
      const { data } = await supabase.from('services').select('*').eq('activity_id', activity!.id).eq('is_active', true).order('name');
      return (data || []) as Service[];
    },
    enabled: !!activity && activity.category === 'salone',
  });

  const { data: existingAppts = [] } = useQuery({
    queryKey: ['public-appointments', activity?.id, selectedDate],
    queryFn: async () => {
      const { data } = await supabase
        .from('appointments')
        .select('start_time, end_time, duration_minutes')
        .eq('activity_id', activity!.id)
        .eq('date', selectedDate)
        .neq('status', 'cancelled');
      return (data || []) as Appointment[];
    },
    enabled: !!activity && !!selectedDate,
  });

  const isSalone = activity?.category === 'salone';
  const duration = selectedService?.duration_minutes || activity?.default_appointment_duration_minutes || 30;

  // Generate available dates (next 14 days)
  const availableDates = useMemo(() => {
    if (!activity) return [];
    const dates: Date[] = [];
    const today = new Date();
    for (let i = 1; i <= 14; i++) {
      const d = addDays(today, i);
      if (activity.opening_days.includes(d.getDay())) {
        dates.push(d);
      }
    }
    return dates;
  }, [activity]);

  // Generate available time slots
  const availableSlots = useMemo(() => {
    if (!activity || !selectedDate) return [];
    const allSlots = generateTimeSlots(activity.opening_hours.start, activity.opening_hours.end, 30);
    return allSlots.filter(slot => {
      const slotEnd = addMinutesToTime(slot, duration);
      if (slotEnd > activity.opening_hours.end) return false;
      return !existingAppts.some(a => {
        const aStart = a.start_time.slice(0, 5);
        const aEnd = a.end_time.slice(0, 5);
        return slot < aEnd && slotEnd > aStart;
      });
    });
  }, [activity, selectedDate, existingAppts, duration]);

  const handleBook = async () => {
    if (!activity || !selectedDate || !selectedTime || !clientName) return;
    setLoading(true);
    try {
      const endTime = addMinutesToTime(selectedTime, duration);
      const { error } = await supabase.from('appointments').insert({
        activity_id: activity.id,
        date: selectedDate,
        start_time: selectedTime,
        end_time: endTime,
        duration_minutes: duration,
        status: 'pending',
        client_name: clientName,
        client_phone: clientPhone || null,
        client_email: clientEmail || null,
        notes: notes || null,
        service_id: selectedService?.id || null,
        color: selectedService?.color || null,
      });
      if (error) throw error;
      setBooked(true);
    } catch (err: any) {
      toast.error(err.message || 'Errore durante la prenotazione');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Pagina non trovata</h1>
          <p className="text-muted-foreground">Questa attività non esiste.</p>
        </div>
      </div>
    );
  }

  if (booked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-card p-8 text-center max-w-md animate-fade-in">
          <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Prenotazione inviata!</h1>
          <p className="text-muted-foreground mb-4">
            La tua richiesta è stata inviata a {activity.name}. Riceverai una conferma a breve.
          </p>
          <div className="bg-muted/50 rounded-lg p-4 text-left text-sm space-y-1">
            <div><strong>Data:</strong> {format(parseISO(selectedDate), 'EEEE dd MMMM yyyy', { locale: it })}</div>
            <div><strong>Orario:</strong> {formatTime(selectedTime)}</div>
            {selectedService && <div><strong>Servizio:</strong> {selectedService.name}</div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-lg mx-auto pt-8">
        {/* Activity header */}
        <div className="text-center mb-8">
          {activity.logo_url && <img src={activity.logo_url} alt={activity.name} className="w-16 h-16 rounded-xl mx-auto mb-3 object-cover" />}
          <h1 className="text-2xl font-bold">{activity.name}</h1>
          <p className="text-muted-foreground">{isSalone ? 'Prenota il tuo appuntamento' : 'Prenota la tua sessione'}</p>
        </div>

        <div className="glass-card p-6">
          {/* Step 1: Select service (salone) */}
          {step === 1 && isSalone && services.length > 0 && (
            <div>
              <h2 className="font-semibold mb-4 flex items-center gap-2"><Calendar className="w-5 h-5" /> Scegli il servizio</h2>
              <div className="space-y-2">
                {services.map(s => (
                  <button key={s.id} onClick={() => { setSelectedService(s); setStep(2); }}
                    className={`w-full text-left p-4 rounded-lg border transition-colors hover:border-primary/50 ${selectedService?.id === s.id ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                      <div className="flex-1">
                        <div className="font-medium">{s.name}</div>
                        <div className="text-sm text-muted-foreground">{s.duration_minutes} min {s.price ? `• €${s.price}` : ''}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Skip to step 2 if coach or no services */}
          {step === 1 && (!isSalone || services.length === 0) && (() => { setStep(2); return null; })()}

          {/* Step 2: Select date */}
          {step === 2 && (
            <div>
              {isSalone && services.length > 0 && (
                <button onClick={() => setStep(1)} className="text-sm text-primary hover:underline mb-4 flex items-center gap-1">
                  <ChevronLeft className="w-4 h-4" /> Cambia servizio
                </button>
              )}
              <h2 className="font-semibold mb-4 flex items-center gap-2"><Calendar className="w-5 h-5" /> Scegli la data</h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {availableDates.map(d => {
                  const dateStr = format(d, 'yyyy-MM-dd');
                  return (
                    <button key={dateStr} onClick={() => { setSelectedDate(dateStr); setStep(3); }}
                      className={`p-3 rounded-lg border text-center transition-colors ${selectedDate === dateStr ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                      <div className="text-xs text-muted-foreground">{format(d, 'EEE', { locale: it })}</div>
                      <div className="font-semibold">{format(d, 'd')}</div>
                      <div className="text-xs text-muted-foreground">{format(d, 'MMM', { locale: it })}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Select time */}
          {step === 3 && (
            <div>
              <button onClick={() => setStep(2)} className="text-sm text-primary hover:underline mb-4 flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" /> Cambia data
              </button>
              <h2 className="font-semibold mb-4 flex items-center gap-2"><Clock className="w-5 h-5" /> Scegli l'orario</h2>
              <p className="text-sm text-muted-foreground mb-4">{format(parseISO(selectedDate), 'EEEE dd MMMM', { locale: it })}</p>
              {availableSlots.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Nessun orario disponibile per questa data</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {availableSlots.map(t => (
                    <button key={t} onClick={() => { setSelectedTime(t); setStep(4); }}
                      className={`p-3 rounded-lg border text-center font-medium transition-colors ${selectedTime === t ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Contact info */}
          {step === 4 && (
            <div>
              <button onClick={() => setStep(3)} className="text-sm text-primary hover:underline mb-4 flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" /> Cambia orario
              </button>
              <h2 className="font-semibold mb-4">I tuoi dati</h2>
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                  {selectedService && <div><strong>Servizio:</strong> {selectedService.name}</div>}
                  <div><strong>Data:</strong> {format(parseISO(selectedDate), 'EEEE dd MMMM', { locale: it })}</div>
                  <div><strong>Orario:</strong> {selectedTime} - {addMinutesToTime(selectedTime, duration)}</div>
                </div>
                <div>
                  <Label>Nome e cognome *</Label>
                  <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Il tuo nome" />
                </div>
                <div>
                  <Label>Telefono</Label>
                  <Input value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="+39 123 456 7890" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="email@esempio.com" type="email" />
                </div>
                <div>
                  <Label>Note</Label>
                  <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Note opzionali" />
                </div>
                <Button variant="hero" className="w-full" onClick={handleBook} disabled={loading || !clientName.trim()}>
                  {loading ? 'Prenotazione...' : 'Conferma prenotazione'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
