import { useState, useMemo, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Activity, Service, Appointment, Employee, EmployeeService } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format, addDays, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { generateTimeSlots, addMinutesToTime, formatTime, getDayName } from '@/utils/dateHelpers';
import { filterBookableEmployees } from '@/utils/salonEmployees';
import { toast } from 'sonner';
import { Calendar, Clock, CheckCircle2, ChevronLeft, Shield, Zap, Award, ChevronDown, Scissors, User, Dumbbell } from 'lucide-react';

const SLOT_INTERVAL = 15;

export default function PublicBooking() {
  const { slug } = useParams<{ slug: string }>();
  const bookingRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState(0);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [noPreference, setNoPreference] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [clientObjective, setClientObjective] = useState('');
  const [booked, setBooked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const { data: activity, isLoading } = useQuery({
    queryKey: ['public-activity', slug],
    queryFn: async () => {
      const { data } = await supabase.from('activities').select('*').eq('slug', slug!).single();
      return data ? (data as unknown as Activity) : null;
    },
    enabled: !!slug,
  });

  const isSalone = activity?.category === 'salone';
  const isCoach = activity?.category === 'coach';

  const { data: services = [] } = useQuery({
    queryKey: ['public-services', activity?.id],
    queryFn: async () => {
      const { data } = await supabase.from('services').select('*').eq('activity_id', activity!.id).eq('is_active', true).order('name');
      return (data || []) as Service[];
    },
    enabled: !!activity,
  });

  const { data: employeesRaw = [] } = useQuery({
    queryKey: ['public-employees', activity?.id],
    queryFn: async () => {
      const { data } = await supabase.from('employees').select('*').eq('activity_id', activity!.id).order('name');
      return (data || []) as Employee[];
    },
    enabled: !!activity && isSalone,
  });

  const staff = useMemo(() => (activity && isSalone ? filterBookableEmployees(employeesRaw, activity) : []), [employeesRaw, activity, isSalone]);

  const { data: employeeServices = [] } = useQuery({
    queryKey: ['public-employee-services', activity?.id],
    queryFn: async () => {
      const empIds = staff.map((e) => e.id);
      if (empIds.length === 0) return [];
      const { data } = await supabase.from('employee_services').select('*').in('employee_id', empIds);
      return (data || []) as EmployeeService[];
    },
    enabled: staff.length > 0 && !!activity,
  });

  const compatibleEmployees = useMemo(() => {
    if (!selectedService) return staff;
    const empIds = employeeServices.filter((es) => es.service_id === selectedService.id).map((es) => es.employee_id);
    const filtered = staff.filter((e) => empIds.includes(e.id));
    return filtered.length > 0 ? filtered : staff;
  }, [selectedService, staff, employeeServices]);

  useEffect(() => {
    if (step === 1 && services.length === 0 && activity) setStep(isSalone ? 2 : 3);
    if (step === 2 && isCoach) setStep(3);
  }, [step, services.length, activity, isSalone, isCoach]);

  const { data: existingAppts = [] } = useQuery({
    queryKey: ['public-appointments', activity?.id, selectedDate, selectedEmployee?.id, noPreference],
    queryFn: async () => {
      let query = supabase
        .from('appointments')
        .select('start_time, end_time, duration_minutes, employee_id, buffer_time_minutes')
        .eq('activity_id', activity!.id)
        .eq('date', selectedDate)
        .neq('status', 'cancelled');
      if (selectedEmployee && !noPreference) {
        query = query.eq('employee_id', selectedEmployee.id);
      }
      const { data } = await query;
      return (data || []) as Pick<Appointment, 'start_time' | 'end_time' | 'duration_minutes' | 'employee_id' | 'buffer_time_minutes'>[];
    },
    enabled: !!activity && !!selectedDate,
  });

  const duration = selectedService?.duration_minutes || activity?.default_appointment_duration_minutes || 30;
  const bufferMinutes = activity?.buffer_minutes || 0;

  const availableDates = useMemo(() => {
    if (!activity) return [];
    const dates: Date[] = [];
    const today = new Date();
    for (let i = 1; i <= 14; i++) {
      const d = addDays(today, i);
      if (activity.opening_days.includes(d.getDay())) dates.push(d);
    }
    return dates;
  }, [activity]);

  const slotConflictsForEmployee = (slot: string, empId: string, appts: Pick<Appointment, 'start_time' | 'end_time' | 'employee_id' | 'buffer_time_minutes'>[]) => {
    const slotEnd = addMinutesToTime(slot, duration);
    return appts
      .filter((a) => a.employee_id === empId)
      .some((a) => {
        const aStart = formatTime(a.start_time);
        const aEnd = addMinutesToTime(formatTime(a.end_time), a.buffer_time_minutes || bufferMinutes);
        return slot < aEnd && slotEnd > aStart;
      });
  };

  const availableSlots = useMemo(() => {
    if (!activity || !selectedDate) return [];
    const allSlots = generateTimeSlots(activity.opening_hours.start, activity.opening_hours.end, SLOT_INTERVAL);
    return allSlots.filter((slot) => {
      const slotEnd = addMinutesToTime(slot, duration + bufferMinutes);
      if (slotEnd > activity.opening_hours.end) return false;

      if (isCoach) {
        return !existingAppts.some((a) => {
          const aStart = formatTime(a.start_time);
          const aEnd = addMinutesToTime(formatTime(a.end_time), a.buffer_time_minutes || bufferMinutes);
          const end = addMinutesToTime(slot, duration);
          return slot < aEnd && end > aStart;
        });
      }

      if (noPreference && compatibleEmployees.length > 0) {
        return compatibleEmployees.some((emp) => !slotConflictsForEmployee(slot, emp.id, existingAppts));
      }
      if (selectedEmployee && !noPreference) {
        return !slotConflictsForEmployee(slot, selectedEmployee.id, existingAppts);
      }
      if (compatibleEmployees.length > 0) {
        return compatibleEmployees.some((emp) => !slotConflictsForEmployee(slot, emp.id, existingAppts));
      }
      return true;
    });
  }, [activity, selectedDate, existingAppts, duration, bufferMinutes, noPreference, compatibleEmployees, selectedEmployee, isCoach]);

  const scrollToBooking = () => {
    setStep(1);
    setTimeout(() => bookingRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleBook = async () => {
    if (!activity || !selectedDate || !selectedTime || !clientName) return;
    if (isSalone && staff.length === 0) {
      toast.error('Prenotazione non disponibile: nessun operatore attivo.');
      return;
    }
    setLoading(true);
    try {
      const endTime = addMinutesToTime(selectedTime, duration);
      let assignedEmployeeId: string | null = selectedEmployee?.id || null;

      if (isSalone) {
        const freeAtTime = compatibleEmployees.filter((e) => !slotConflictsForEmployee(selectedTime, e.id, existingAppts));
        if (noPreference && compatibleEmployees.length > 0) {
          if (freeAtTime.length > 0) {
            const counts = new Map<string, number>();
            freeAtTime.forEach((e) => counts.set(e.id, 0));
            existingAppts.forEach((a) => { if (a.employee_id && counts.has(a.employee_id)) counts.set(a.employee_id, (counts.get(a.employee_id) || 0) + 1); });
            let minCount = Infinity; let minEmpId = freeAtTime[0].id;
            counts.forEach((count, empId) => { if (count < minCount) { minCount = count; minEmpId = empId; } });
            assignedEmployeeId = minEmpId;
          } else {
            assignedEmployeeId = null;
          }
        }
        if (!assignedEmployeeId) { toast.error('Nessun operatore libero. Scegli un altro orario.'); setLoading(false); return; }
        if (slotConflictsForEmployee(selectedTime, assignedEmployeeId, existingAppts)) { toast.error('Orario non più disponibile.'); setLoading(false); return; }
      }

      const { error } = await supabase.from('appointments').insert({
        activity_id: activity.id,
        date: selectedDate,
        start_time: selectedTime,
        end_time: endTime,
        duration_minutes: duration,
        buffer_time_minutes: bufferMinutes,
        status: 'pending',
        client_name: clientName,
        client_phone: clientPhone || null,
        client_email: clientEmail || null,
        notes: notes || null,
        service_id: selectedService?.id || null,
        employee_id: assignedEmployeeId,
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

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!activity) return <div className="min-h-screen flex items-center justify-center p-4"><div className="text-center"><h1 className="text-2xl font-bold mb-2">Pagina non trovata</h1><p className="text-muted-foreground">Questa attività non esiste.</p></div></div>;

  if (booked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-card p-8 text-center max-w-md animate-fade-in">
          <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Prenotazione inviata!</h1>
          <p className="text-muted-foreground mb-4">La tua richiesta è stata inviata a {activity.name}.</p>
          <div className="bg-muted/50 rounded-lg p-4 text-left text-sm space-y-1">
            <div><strong>Data:</strong> {format(parseISO(selectedDate), 'EEEE dd MMMM yyyy', { locale: it })}</div>
            <div><strong>Orario:</strong> {formatTime(selectedTime)} - {addMinutesToTime(selectedTime, duration)}</div>
            {selectedService && <div><strong>{isSalone ? 'Servizio' : 'Sessione'}:</strong> {selectedService.name}</div>}
            {selectedEmployee && <div><strong>Con:</strong> {selectedEmployee.name} {selectedEmployee.surname}</div>}
          </div>
        </div>
      </div>
    );
  }

  const openDayNames = activity.opening_days.sort().map(d => getDayName(d)).join(', ');
  const CategoryIcon = isSalone ? Scissors : Dumbbell;
  const categoryLabel = isSalone ? 'Salone' : 'Personal Trainer';

  const faqs = isSalone ? [
    { q: 'Quanto dura un appuntamento?', a: `La durata media è di ${activity.default_appointment_duration_minutes} minuti, ma varia in base al servizio scelto.` },
    { q: 'Come posso cancellare la prenotazione?', a: 'Contatta direttamente il salone per modificare o cancellare il tuo appuntamento.' },
    { q: 'Cosa succede se arrivo in ritardo?', a: 'Ti consigliamo di arrivare puntuali. In caso di ritardo significativo, l\'appuntamento potrebbe essere riprogrammato.' },
    { q: 'Come viene confermata la prenotazione?', a: 'Riceverai una conferma dal salone dopo aver inviato la richiesta.' },
  ] : [
    { q: 'Quanto dura una sessione?', a: `La durata media è di ${activity.default_appointment_duration_minutes} minuti, ma può variare in base al tipo di sessione.` },
    { q: 'Posso cancellare la sessione?', a: 'Contatta direttamente il trainer per modificare o cancellare la sessione.' },
    { q: 'Devo portare qualcosa?', a: 'Porta abbigliamento comodo e una bottiglia d\'acqua. Il trainer ti comunicherà eventuali attrezzature necessarie.' },
    { q: 'Come funzionano i pacchetti?', a: 'Puoi acquistare pacchetti di sessioni con il trainer. Contattalo per maggiori informazioni sui pacchetti disponibili.' },
  ];

  const stepForEmployee = isSalone ? 2 : -1;
  const stepForDate = isSalone ? 3 : 2;
  const stepForTime = isSalone ? 4 : 3;
  const stepForForm = isSalone ? 5 : 4;

  const goBackFromStep = (currentStep: number) => {
    if (isCoach) {
      if (currentStep === 2) setStep(services.length > 0 ? 1 : 0);
      else if (currentStep === 3) setStep(2);
      else if (currentStep === 4) setStep(3);
    } else {
      if (currentStep === 2) setStep(services.length > 0 ? 1 : 0);
      else if (currentStep === 3) setStep(2);
      else if (currentStep === 4) setStep(3);
      else if (currentStep === 5) setStep(4);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-3">
            {activity.logo_url && <img src={activity.logo_url} alt={activity.name} className="w-8 h-8 rounded-lg object-cover" />}
            <span className="font-display text-lg font-bold">{activity.name}</span>
          </div>
          <Button variant="hero" size="sm" onClick={scrollToBooking}>Prenota ora</Button>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 px-4 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto max-w-3xl text-center">
          {/* Coach: photo + badge layout */}
          {isCoach && activity.logo_url && (
            <div className="mb-6">
              <img src={activity.logo_url} alt={activity.owner_name} className="w-24 h-24 rounded-full object-cover mx-auto border-4 border-primary/20 shadow-lg" />
            </div>
          )}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <CategoryIcon className="w-4 h-4" /> {categoryLabel}
          </div>
          <h1 className="text-3xl md:text-5xl font-bold mb-4">{isCoach ? activity.owner_name : activity.name}</h1>
          {isCoach && <p className="text-xl text-foreground/80 font-medium mb-2">{activity.name}</p>}
          {activity.description && <p className="text-lg text-muted-foreground mb-4 max-w-xl mx-auto">{activity.description}</p>}
          <p className="text-lg text-muted-foreground mb-6">{isSalone ? 'Prenota il tuo appuntamento in pochi secondi' : 'Prenota la tua sessione di allenamento personalizzato'}</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {activity.opening_hours.start} - {activity.opening_hours.end}</span>
            <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {openDayNames}</span>
            <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> ~{activity.default_appointment_duration_minutes} min</span>
          </div>
          <Button variant="hero" size="lg" className="mt-8" onClick={scrollToBooking}>
            <CategoryIcon className="w-5 h-5" /> Prenota ora
          </Button>
        </div>
      </section>

      {/* About */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold mb-4">{isSalone ? 'Il nostro salone' : 'Chi sono'}</h2>
          {isCoach ? (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                {activity.logo_url && <img src={activity.logo_url} alt={activity.owner_name} className="w-16 h-16 rounded-xl object-cover flex-shrink-0 hidden sm:block" />}
                <div>
                  <p className="text-muted-foreground leading-relaxed">
                    {activity.description || `${activity.owner_name} è un personal trainer professionista pronto ad accompagnarti nel tuo percorso di fitness personalizzato.`}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground leading-relaxed">
              {`Benvenuto da ${activity.name}! Il nostro team di professionisti è pronto ad accoglierti con servizi di qualità.`}
            </p>
          )}
          {isSalone && staff.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-3">Il nostro team</h3>
              <div className="flex flex-wrap gap-3">
                {staff.map(emp => (
                  <div key={emp.id} className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: emp.color }} />
                    <span className="text-sm font-medium">{emp.name} {emp.surname}</span>
                    <span className="text-xs text-muted-foreground">• {emp.role}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Services/Sessions */}
      {services.length > 0 && (
        <section className="py-16 px-4 bg-secondary/30">
          <div className="container mx-auto max-w-3xl">
            <h2 className="text-2xl font-bold mb-6">{isSalone ? 'I nostri servizi' : 'Sessioni disponibili'}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {services.map(s => (
                <div key={s.id} className="glass-card p-5 flex items-start gap-4">
                  <div className="w-3 h-12 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                  <div className="flex-1">
                    <div className="font-semibold">{s.name}</div>
                    {s.description && <div className="text-xs text-muted-foreground mt-0.5">{s.description}</div>}
                    <div className="text-sm text-muted-foreground mt-1">{s.duration_minutes} min {s.price ? `• €${s.price}` : ''}</div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => { setSelectedService(s); scrollToBooking(); }}>Seleziona</Button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Trust */}
      <section className="py-12 px-4 bg-secondary/30">
        <div className="container mx-auto max-w-3xl">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="flex flex-col items-center gap-2"><Zap className="w-6 h-6 text-primary" /><span className="text-sm font-medium">Prenotazione semplice</span></div>
            <div className="flex flex-col items-center gap-2"><Shield className="w-6 h-6 text-primary" /><span className="text-sm font-medium">Conferma immediata</span></div>
            <div className="flex flex-col items-center gap-2"><Award className="w-6 h-6 text-primary" /><span className="text-sm font-medium">Gestione professionale</span></div>
          </div>
        </div>
      </section>

      {/* Booking */}
      <section ref={bookingRef} className="py-16 px-4" id="prenota">
        <div className="container mx-auto max-w-lg">
          <h2 className="text-2xl font-bold mb-6 text-center">{isSalone ? 'Prenota il tuo appuntamento' : 'Prenota la tua sessione'}</h2>
          <div className="glass-card p-6">
            {/* Step 1: Service */}
            {step === 1 && services.length > 0 && (
              <div>
                <h3 className="font-semibold mb-4 flex items-center gap-2"><CategoryIcon className="w-5 h-5" /> {isSalone ? 'Scegli il servizio' : 'Scegli la sessione'}</h3>
                <div className="space-y-2">
                  {services.map(s => (
                    <button key={s.id} onClick={() => { setSelectedService(s); setStep(isSalone ? 2 : stepForDate); }}
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

            {/* Step 2: Employee (salon only) */}
            {step === stepForEmployee && isSalone && staff.length === 0 && (
              <div>
                <button onClick={() => goBackFromStep(step)} className="text-sm text-primary hover:underline mb-4 flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Indietro</button>
                <p className="text-sm text-destructive">Al momento non è possibile prenotare online: non ci sono operatori attivi.</p>
              </div>
            )}

            {step === stepForEmployee && isSalone && staff.length > 0 && (
              <div>
                <button onClick={() => goBackFromStep(step)} className="text-sm text-primary hover:underline mb-4 flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Indietro</button>
                <h3 className="font-semibold mb-4 flex items-center gap-2"><User className="w-5 h-5" /> Scegli il professionista</h3>
                <div className="space-y-2">
                  <button onClick={() => { setNoPreference(true); setSelectedEmployee(null); setStep(stepForDate); }}
                    className="w-full text-left p-4 rounded-lg border border-border hover:border-primary/50 transition-colors">
                    <div className="font-medium">Nessuna preferenza</div>
                    <div className="text-sm text-muted-foreground">Il primo disponibile</div>
                  </button>
                  {compatibleEmployees.map(emp => (
                    <button key={emp.id} onClick={() => { setSelectedEmployee(emp); setNoPreference(false); setStep(stepForDate); }}
                      className="w-full text-left p-4 rounded-lg border border-border hover:border-primary/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: emp.color }} />
                        <div><div className="font-medium">{emp.name} {emp.surname}</div><div className="text-sm text-muted-foreground">{emp.role}</div></div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Date step */}
            {step === stepForDate && (
              <div>
                <button onClick={() => goBackFromStep(step)} className="text-sm text-primary hover:underline mb-4 flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Indietro</button>
                <h3 className="font-semibold mb-4 flex items-center gap-2"><Calendar className="w-5 h-5" /> Scegli la data</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {availableDates.map(d => {
                    const dateStr = format(d, 'yyyy-MM-dd');
                    return (
                      <button key={dateStr} onClick={() => { setSelectedDate(dateStr); setStep(stepForTime); }}
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

            {/* Time step */}
            {step === stepForTime && (
              <div>
                <button onClick={() => goBackFromStep(step)} className="text-sm text-primary hover:underline mb-4 flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Indietro</button>
                <h3 className="font-semibold mb-4 flex items-center gap-2"><Clock className="w-5 h-5" /> Scegli l'orario</h3>
                <p className="text-sm text-muted-foreground mb-4">{format(parseISO(selectedDate), 'EEEE dd MMMM', { locale: it })}</p>
                {availableSlots.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Nessun orario disponibile</p>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {availableSlots.map(t => (
                      <button key={t} onClick={() => { setSelectedTime(t); setStep(stepForForm); }}
                        className={`p-2.5 rounded-lg border text-center font-medium text-sm transition-colors ${selectedTime === t ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Form step */}
            {step === stepForForm && (
              <div>
                <button onClick={() => goBackFromStep(step)} className="text-sm text-primary hover:underline mb-4 flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Indietro</button>
                <h3 className="font-semibold mb-4">I tuoi dati</h3>
                <div className="space-y-4">
                  <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                    {selectedService && <div><strong>{isSalone ? 'Servizio' : 'Sessione'}:</strong> {selectedService.name}</div>}
                    {selectedEmployee && <div><strong>Con:</strong> {selectedEmployee.name} {selectedEmployee.surname}</div>}
                    {noPreference && isSalone && <div><strong>Con:</strong> Primo disponibile</div>}
                    <div><strong>Data:</strong> {format(parseISO(selectedDate), 'EEEE dd MMMM', { locale: it })}</div>
                    <div><strong>Orario:</strong> {selectedTime} - {addMinutesToTime(selectedTime, duration)}</div>
                  </div>
                  <div><Label>Nome e cognome *</Label><Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Il tuo nome" /></div>
                  <div><Label>Telefono</Label><Input value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="+39 123 456 7890" /></div>
                  <div><Label>Email</Label><Input value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="email@esempio.com" type="email" /></div>
                  {isCoach && (
                    <div><Label>Obiettivo (opzionale)</Label><Input value={clientObjective} onChange={e => setClientObjective(e.target.value)} placeholder="es. Dimagrimento, Tonificazione..." /></div>
                  )}
                  <div><Label>Note</Label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Note opzionali" /></div>
                  <Button variant="hero" className="w-full" onClick={handleBook} disabled={loading || !clientName.trim()}>
                    {loading ? 'Prenotazione...' : 'Conferma prenotazione'}
                  </Button>
                </div>
              </div>
            )}

            {step === 0 && (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">Seleziona {isSalone ? 'un servizio' : 'una sessione'} sopra o clicca qui per iniziare</p>
                <Button variant="hero" onClick={() => setStep(1)}>Inizia la prenotazione</Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4 bg-secondary/30">
        <div className="container mx-auto max-w-2xl">
          <h2 className="text-2xl font-bold text-center mb-8">Domande frequenti</h2>
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <div key={i} className="glass-card overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-4 text-left">
                  <span className="font-medium">{f.q}</span>
                  <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && <div className="px-4 pb-4 text-muted-foreground">{f.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8 px-4">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">{activity.name}</p>
          <p>© {new Date().getFullYear()} • Powered by PrenotaPro</p>
        </div>
      </footer>
    </div>
  );
}
