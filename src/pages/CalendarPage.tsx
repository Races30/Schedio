import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { format, addDays, startOfWeek, isSameDay, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { Appointment, Client, Service } from '@/types';
import { formatTime, generateTimeSlots, addMinutesToTime, getDayNameShort } from '@/utils/dateHelpers';
import { toast } from 'sonner';

type ViewMode = 'day' | 'week';

export default function CalendarPage() {
  const { activity } = useAuth();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string } | null>(null);
  const [editAppt, setEditAppt] = useState<Appointment | null>(null);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const displayDays = viewMode === 'day' ? [currentDate] : weekDays;

  const dateRange = {
    start: format(displayDays[0], 'yyyy-MM-dd'),
    end: format(displayDays[displayDays.length - 1], 'yyyy-MM-dd'),
  };

  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments', activity?.id, dateRange],
    queryFn: async () => {
      const { data } = await supabase
        .from('appointments')
        .select('*, client:clients(*), service:services(*)')
        .eq('activity_id', activity!.id)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)
        .order('start_time');
      return (data || []) as Appointment[];
    },
    enabled: !!activity,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', activity?.id],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('*').eq('activity_id', activity!.id).order('name');
      return (data || []) as Client[];
    },
    enabled: !!activity,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services', activity?.id],
    queryFn: async () => {
      const { data } = await supabase.from('services').select('*').eq('activity_id', activity!.id).eq('is_active', true).order('name');
      return (data || []) as Service[];
    },
    enabled: !!activity,
  });

  const hours = activity ? generateTimeSlots(
    activity.opening_hours.start,
    activity.opening_hours.end,
    30
  ) : [];

  const navigateDate = (dir: number) => {
    setCurrentDate(prev => addDays(prev, dir * (viewMode === 'day' ? 1 : 7)));
  };

  const openNewAppt = (date: string, time: string) => {
    setSelectedSlot({ date, time });
    setEditAppt(null);
    setDialogOpen(true);
  };

  const openEditAppt = (appt: Appointment) => {
    setEditAppt(appt);
    setSelectedSlot(null);
    setDialogOpen(true);
  };

  const getApptsForSlot = (day: Date, time: string) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return appointments.filter(a => a.date === dateStr && a.start_time <= time && a.end_time > time);
  };

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      confirmed: 'border-l-4 border-l-success',
      pending: 'border-l-4 border-l-warning',
      cancelled: 'border-l-4 border-l-destructive opacity-50',
      completed: 'border-l-4 border-l-muted-foreground',
    };
    return map[status] || '';
  };

  const now = new Date();
  const currentTimeStr = format(now, 'HH:mm');

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigateDate(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-bold">
            {viewMode === 'day'
              ? format(currentDate, 'EEEE dd MMMM yyyy', { locale: it })
              : `${format(weekDays[0], 'dd MMM', { locale: it })} - ${format(weekDays[6], 'dd MMM yyyy', { locale: it })}`
            }
          </h1>
          <Button variant="outline" size="icon" onClick={() => navigateDate(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Oggi</Button>
          <div className="inline-flex bg-muted rounded-lg p-1">
            <button onClick={() => setViewMode('day')} className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${viewMode === 'day' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
              Giorno
            </button>
            <button onClick={() => setViewMode('week')} className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${viewMode === 'week' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
              Settimana
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="glass-card overflow-x-auto">
        <div className={`min-w-[600px] ${viewMode === 'day' ? 'min-w-[400px]' : ''}`}>
          {/* Day headers */}
          <div className={`grid border-b border-border ${viewMode === 'day' ? 'grid-cols-[80px_1fr]' : 'grid-cols-[80px_repeat(7,1fr)]'}`}>
            <div className="p-2" />
            {displayDays.map((day, i) => {
              const isToday = isSameDay(day, now);
              return (
                <div key={i} className={`p-3 text-center border-l border-border ${isToday ? 'bg-primary/5' : ''}`}>
                  <div className="text-xs text-muted-foreground">{getDayNameShort(day.getDay())}</div>
                  <div className={`text-lg font-semibold ${isToday ? 'text-primary' : ''}`}>{format(day, 'd')}</div>
                </div>
              );
            })}
          </div>

          {/* Time slots */}
          {hours.map((time) => (
            <div key={time} className={`grid border-b border-border/50 ${viewMode === 'day' ? 'grid-cols-[80px_1fr]' : 'grid-cols-[80px_repeat(7,1fr)]'}`}>
              <div className="p-2 text-xs text-muted-foreground text-right pr-3 py-3 relative">
                {time}
                {isSameDay(currentDate, now) && currentTimeStr >= time && currentTimeStr < addMinutesToTime(time, 30) && (
                  <div className="absolute right-0 w-2 h-2 rounded-full bg-destructive" />
                )}
              </div>
              {displayDays.map((day, di) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const slotAppts = getApptsForSlot(day, time);
                const isNow = isSameDay(day, now) && currentTimeStr >= time && currentTimeStr < addMinutesToTime(time, 30);

                return (
                  <div key={di}
                    onClick={() => slotAppts.length === 0 && openNewAppt(dateStr, time)}
                    className={`border-l border-border/50 min-h-[48px] p-0.5 cursor-pointer hover:bg-primary/5 transition-colors relative ${isNow ? 'bg-primary/5' : ''}`}>
                    {slotAppts.filter(a => a.start_time === time).map(appt => {
                      const durationSlots = Math.ceil(appt.duration_minutes / 30);
                      return (
                        <div key={appt.id}
                          onClick={(e) => { e.stopPropagation(); openEditAppt(appt); }}
                          className={`rounded-md p-1.5 text-xs cursor-pointer hover:opacity-80 ${statusColor(appt.status)}`}
                          style={{
                            backgroundColor: (appt.color || appt.service?.color || '#3b82f6') + '20',
                            height: `${durationSlots * 48 - 4}px`,
                            position: 'relative',
                            zIndex: 10,
                          }}>
                          <div className="font-medium truncate" style={{ color: appt.color || appt.service?.color || '#3b82f6' }}>
                            {appt.client?.name || appt.client_name || 'Cliente'}
                          </div>
                          <div className="truncate text-muted-foreground">
                            {formatTime(appt.start_time)} - {formatTime(appt.end_time)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Appointment Dialog */}
      <AppointmentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        appointment={editAppt}
        defaultDate={selectedSlot?.date || format(currentDate, 'yyyy-MM-dd')}
        defaultTime={selectedSlot?.time || '09:00'}
        activity={activity!}
        clients={clients}
        services={services}
      />
    </div>
  );
}

function AppointmentDialog({
  open, onClose, appointment, defaultDate, defaultTime, activity, clients, services
}: {
  open: boolean; onClose: () => void; appointment: Appointment | null;
  defaultDate: string; defaultTime: string;
  activity: NonNullable<ReturnType<typeof useAuth>['activity']>;
  clients: Client[]; services: Service[];
}) {
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState(appointment?.client_id || '');
  const [serviceId, setServiceId] = useState(appointment?.service_id || '');
  const [date, setDate] = useState(appointment?.date || defaultDate);
  const [startTime, setStartTime] = useState(appointment?.start_time?.slice(0, 5) || defaultTime);
  const [duration, setDuration] = useState(appointment?.duration_minutes || activity.default_appointment_duration_minutes);
  const [status, setStatus] = useState(appointment?.status || 'confirmed');
  const [notes, setNotes] = useState(appointment?.notes || '');
  const [clientName, setClientName] = useState(appointment?.client_name || '');
  const [loading, setLoading] = useState(false);

  const endTime = addMinutesToTime(startTime, duration);

  // Reset form when dialog opens
  useState(() => {
    if (open) {
      setClientId(appointment?.client_id || '');
      setServiceId(appointment?.service_id || '');
      setDate(appointment?.date || defaultDate);
      setStartTime(appointment?.start_time?.slice(0, 5) || defaultTime);
      setDuration(appointment?.duration_minutes || activity.default_appointment_duration_minutes);
      setStatus(appointment?.status || 'confirmed');
      setNotes(appointment?.notes || '');
      setClientName(appointment?.client_name || '');
    }
  });

  const selectedService = services.find(s => s.id === serviceId);

  const handleServiceChange = (sid: string) => {
    setServiceId(sid);
    const svc = services.find(s => s.id === sid);
    if (svc) setDuration(svc.duration_minutes);
  };

  const save = async () => {
    setLoading(true);
    try {
      const payload = {
        activity_id: activity.id,
        client_id: clientId || null,
        service_id: serviceId || null,
        date,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: duration,
        status,
        notes: notes || null,
        client_name: clientName || null,
        color: selectedService?.color || null,
      };

      if (appointment) {
        const { error } = await supabase.from('appointments').update(payload).eq('id', appointment.id);
        if (error) throw error;
        toast.success('Appuntamento aggiornato');
      } else {
        const { error } = await supabase.from('appointments').insert(payload);
        if (error) throw error;
        toast.success('Appuntamento creato');
      }
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteAppt = async () => {
    if (!appointment) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('appointments').delete().eq('id', appointment.id);
      if (error) throw error;
      toast.success('Appuntamento eliminato');
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{appointment ? 'Modifica appuntamento' : 'Nuovo appuntamento'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {clients.length > 0 && (
            <div>
              <Label>Cliente</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Seleziona cliente" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {!clientId && (
            <div>
              <Label>Nome cliente</Label>
              <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nome cliente" />
            </div>
          )}
          {activity.category === 'salone' && services.length > 0 && (
            <div>
              <Label>Servizio</Label>
              <Select value={serviceId} onValueChange={handleServiceChange}>
                <SelectTrigger><SelectValue placeholder="Seleziona servizio" /></SelectTrigger>
                <SelectContent>
                  {services.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.duration_minutes} min)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Orario</Label>
              <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Durata (min)</Label>
              <Input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} min={5} step={5} />
            </div>
            <div>
              <Label>Stato</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">Confermato</SelectItem>
                  <SelectItem value="pending">In attesa</SelectItem>
                  <SelectItem value="cancelled">Cancellato</SelectItem>
                  <SelectItem value="completed">Completato</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Note</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Note opzionali" />
          </div>
          <div className="text-sm text-muted-foreground">
            Fine prevista: {endTime}
          </div>
          <div className="flex gap-2">
            {appointment && (
              <Button variant="destructive" onClick={deleteAppt} disabled={loading}>Elimina</Button>
            )}
            <Button variant="hero" onClick={save} disabled={loading} className="flex-1">
              {loading ? 'Salvataggio...' : appointment ? 'Aggiorna' : 'Crea'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
