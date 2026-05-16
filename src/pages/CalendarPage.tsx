import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { findActivePackage, decrementPackageSession, findOrCreateClient } from '@/utils/clientMatching';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { Appointment, Client, Service, Employee } from '@/types';
import {
  formatTime,
  generateTimeSlots,
  addMinutesToTime,
  getDayNameShort,
  appointmentOverlapsSlot,
  appointmentWithBufferOverlapsSlot,
  slotIsBufferOnly,
  slotContainingStart,
  roundToInterval,
  timeToMinutes,
} from '@/utils/dateHelpers';
import { filterBookableEmployees, employeeDisplayLabel } from '@/utils/salonEmployees';
import { toast } from 'sonner';

const SLOT_INTERVAL = 15;
const SLOT_HEIGHT = 36; // px per 15-min slot

type ViewMode = 'day' | 'week';

type CalendarCoachSession = {
  id: string;
  scheduled_at: string;
  status: string;
  activity_id: string;
  client?: {
    id?: string;
    name?: string | null;
    surname?: string | null;
    last_name?: string | null;
  } | null;
};

export default function CalendarPage() {
  const { activity } = useAuth();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [isMobileCalendar, setIsMobileCalendar] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string } | null>(null);
  const [editAppt, setEditAppt] = useState<Appointment | null>(null);
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('all');
  const [filterServiceId, setFilterServiceId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const isSalone = activity?.category === 'salone';
  const isCoach = activity?.category === 'coach';

  useEffect(() => {
    if (window.innerWidth < 640) {
      setViewMode('day');
      setIsMobileCalendar(true);
    }
  }, []);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const displayDays = viewMode === 'day' ? [currentDate] : weekDays;

  const dateRange = {
    start: format(displayDays[0], 'yyyy-MM-dd'),
    end: format(displayDays[displayDays.length - 1], 'yyyy-MM-dd'),
  };

  const { data: coachSessions = [] } = useQuery({
    queryKey: ['calendar-sessions', activity?.id, dateRange],
    queryFn: async () => {
      const { data } = await supabase
        .from('sessions')
        .select('*, client:clients(id, name, surname)')
        .eq('activity_id', activity!.id)
        .in('status', ['confermata', 'completata'])
        .gte('scheduled_at', dateRange.start + 'T00:00:00')
        .lte('scheduled_at', dateRange.end + 'T23:59:59')
        .order('scheduled_at');
      return data ?? [];
    },
    enabled: !!activity && isCoach,
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments', activity?.id, dateRange],
    queryFn: async () => {
      const { data } = await supabase
        .from('appointments')
        .select('*, client:clients(*), service:services(*), employee:employees(*)')
        .eq('activity_id', activity!.id)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)
        .order('date')
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
    queryKey: ['services-calendar', activity?.id],
    queryFn: async () => {
      const { data } = await supabase.from('services').select('*').eq('activity_id', activity!.id).order('name');
      return (data || []) as Service[];
    },
    enabled: !!activity,
  });

  const { data: employeesRaw = [] } = useQuery({
    queryKey: ['employees', activity?.id],
    queryFn: async () => {
      const { data } = await supabase.from('employees').select('*').eq('activity_id', activity!.id).order('name');
      return (data || []) as Employee[];
    },
    enabled: !!activity,
  });

  const bookableEmployees = useMemo(
    () => filterBookableEmployees(employeesRaw, activity),
    [employeesRaw, activity]
  );

  const mappedCoachSessions = useMemo(() => {
    return (coachSessions as CalendarCoachSession[]).map((session) => {
      const dateObj = new Date(session.scheduled_at);
      const dateStr = format(dateObj, 'yyyy-MM-dd');
      const timeStr = format(dateObj, 'HH:mm');
      const endTimeStr = addMinutesToTime(timeStr, 60);
      const isCompleted = session.status === 'completata';
      
      const clientName = [session.client?.name, session.client?.surname || session.client?.last_name]
        .filter(Boolean)
        .join(' ');

      return {
        id: session.id,
        date: dateStr,
        start_time: timeStr,
        end_time: endTimeStr,
        duration_minutes: 60,
        buffer_time_minutes: 0,
        status: isCompleted ? 'completed' : 'confirmed',
        client_name: clientName,
        client_id: session.client?.id,
        employee_id: null,
        service_id: null,
        color: isCompleted ? '#888888' : '#3b82f6',
        activity_id: session.activity_id,
        _isCoachSession: true,
      } as unknown as Appointment;
    });
  }, [coachSessions]);

  const filteredAppts = useMemo(() => {
    let list = isCoach ? mappedCoachSessions : appointments;
    if (filterEmployeeId !== 'all') list = list.filter((a) => a.employee_id === filterEmployeeId);
    if (filterServiceId !== 'all') list = list.filter((a) => a.service_id === filterServiceId);
    if (filterStatus !== 'all') list = list.filter((a) => a.status === filterStatus);
    return list;
  }, [appointments, mappedCoachSessions, isCoach, filterEmployeeId, filterServiceId, filterStatus]);

  const hours = activity ? generateTimeSlots(activity.opening_hours.start, activity.opening_hours.end, SLOT_INTERVAL) : [];

  const navigateDate = (dir: number) => {
    setCurrentDate((prev) => addDays(prev, dir * (viewMode === 'day' ? 1 : 7)));
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

  const getApptsStartingInSlot = (day: Date, time: string) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return filteredAppts.filter(
      (a) => a.date === dateStr && slotContainingStart(a.start_time, time, SLOT_INTERVAL)
    );
  };

  const slotHasOverlap = (day: Date, time: string) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return filteredAppts.some(
      (a) =>
        a.date === dateStr &&
        appointmentWithBufferOverlapsSlot(a.start_time, a.end_time, a.buffer_time_minutes || 0, time, SLOT_INTERVAL)
    );
  };

  const slotIsBuffer = (day: Date, time: string) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return filteredAppts.some(
      (a) =>
        a.date === dateStr &&
        slotIsBufferOnly(a.end_time, a.buffer_time_minutes || 0, time, SLOT_INTERVAL)
    );
  };

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      confirmed: 'border-l-4 border-l-success',
      pending: 'border-l-4 border-l-warning',
      cancelled: 'border-l-4 border-l-destructive opacity-50',
      'no-show': 'border-l-4 border-l-destructive',
      completed: 'border-l-4 border-l-muted-foreground',
    };
    return map[status] || '';
  };

  const now = new Date();
  const currentTimeStr = format(now, 'HH:mm');

  const getEmployeeForAppt = (appt: Appointment) =>
    appt.employee || employeesRaw.find((e) => e.id === appt.employee_id);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigateDate(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-bold">
            {viewMode === 'day'
              ? format(currentDate, 'EEEE dd MMMM yyyy', { locale: it })
              : `${format(weekDays[0], 'dd MMM', { locale: it })} - ${format(weekDays[6], 'dd MMM yyyy', { locale: it })}`}
          </h1>
          <Button variant="outline" size="icon" onClick={() => navigateDate(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {isSalone && bookableEmployees.length > 0 && (
            <Select value={filterEmployeeId} onValueChange={setFilterEmployeeId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Dipendente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i dipendenti</SelectItem>
                {bookableEmployees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {employeeDisplayLabel(e, activity)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {!isCoach && (
            <Select value={filterServiceId} onValueChange={setFilterServiceId}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Servizio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i servizi</SelectItem>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                    {!s.is_active ? ' (inattivo)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Stato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli stati</SelectItem>
              {isCoach ? (
                <>
                  <SelectItem value="confirmed">Confermata</SelectItem>
                  <SelectItem value="completed">Completata</SelectItem>
                </>
              ) : (
                <>
                  <SelectItem value="confirmed">Confermato</SelectItem>
                  <SelectItem value="pending">In attesa</SelectItem>
                  <SelectItem value="cancelled">Cancellato</SelectItem>
                  <SelectItem value="no-show">No Show</SelectItem>
                  <SelectItem value="completed">Completato</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
            Oggi
          </Button>
          <div className="inline-flex bg-muted rounded-lg p-1">
            <button type="button" onClick={() => setViewMode('day')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${viewMode === 'day' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
              Giorno
            </button>
            {!isMobileCalendar && (
              <button type="button" onClick={() => setViewMode('week')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${viewMode === 'week' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                Settimana
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="glass-card overflow-x-auto">
        <div className={viewMode === 'day' ? 'min-w-[360px]' : 'min-w-[700px]'}>
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

          {hours.map((time, timeIdx) => {
            const isHourMark = timeIdx % 4 === 0;
            return (
              <div key={time}
                className={`grid ${isHourMark ? 'border-b border-border/50' : 'border-b border-border/20'} ${viewMode === 'day' ? 'grid-cols-[80px_1fr]' : 'grid-cols-[80px_repeat(7,1fr)]'}`}>
                <div className="p-1 text-xs text-muted-foreground text-right pr-3 relative" style={{ height: `${SLOT_HEIGHT}px`, lineHeight: `${SLOT_HEIGHT}px` }}>
                  {isHourMark ? time : ''}
                  {isSameDay(currentDate, now) &&
                    currentTimeStr >= time &&
                    currentTimeStr < addMinutesToTime(time, SLOT_INTERVAL) && (
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-destructive" />
                    )}
                </div>
                {displayDays.map((day, di) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const slotAppts = getApptsStartingInSlot(day, time);
                  const busy = slotHasOverlap(day, time);
                  const isBuffer = slotIsBuffer(day, time);
                  const isNow = isSameDay(day, now) && currentTimeStr >= time && currentTimeStr < addMinutesToTime(time, SLOT_INTERVAL);

                  return (
                    <div key={di} role="button" tabIndex={0}
                      onClick={() => !isCoach && !busy && openNewAppt(dateStr, time)}
                      onKeyDown={(e) => {
                        if (!isCoach && !busy && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openNewAppt(dateStr, time); }
                      }}
                      className={`border-l border-border/50 p-0.5 transition-colors relative ${isNow ? 'bg-primary/5' : ''} ${isBuffer ? 'bg-warning/10' : busy ? 'bg-muted/20' : 'cursor-pointer hover:bg-primary/5'}`}
                      style={{ minHeight: `${SLOT_HEIGHT}px` }}>
                      {isBuffer && slotAppts.length === 0 && (
                        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, currentColor 3px, currentColor 4px)' }} />
                      )}
                      {slotAppts.map((appt: Appointment) => {
                        const isCoachSession = Boolean((appt as Appointment & { _isCoachSession?: boolean })._isCoachSession);
                        const totalSlots = Math.ceil(appt.duration_minutes / SLOT_INTERVAL);
                        const bufferSlots = Math.ceil((appt.buffer_time_minutes || 0) / SLOT_INTERVAL);
                        const emp = getEmployeeForAppt(appt);
                        const apptColor = emp?.color || appt.color || appt.service?.color || '#3b82f6';
                        return (
                          <div key={appt.id} role="button" tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); if (!isCoach) openEditAppt(appt); }}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); if (!isCoach) openEditAppt(appt); } }}
                            className={`rounded-md text-[11px] sm:text-xs cursor-pointer hover:opacity-80 overflow-hidden ${statusColor(appt.status)}`}
                            style={{
                              backgroundColor: apptColor + '20',
                              height: `${(isCoachSession ? 1 : totalSlots) * SLOT_HEIGHT - 4}px`,
                              position: 'relative',
                              zIndex: 10,
                              padding: '2px 6px',
                            }}>
                            <div className="font-medium truncate leading-4" style={{ color: apptColor }}>
                              {appt.client?.name || appt.client_name || 'Cliente'}
                            </div>
                            <div className="truncate text-muted-foreground leading-4">
                              {isCoachSession ? formatTime(appt.start_time) : `${formatTime(appt.start_time)} - ${formatTime(appt.end_time)}`}
                              {emp && <span className="ml-1">• {emp.name}</span>}
                            </div>
                            {!isCoachSession && bufferSlots > 0 && (
                              <div className="absolute bottom-0 left-0 right-0 opacity-30 rounded-b-md"
                                style={{
                                  height: `${bufferSlots * SLOT_HEIGHT}px`,
                                  backgroundColor: apptColor,
                                  backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.4) 3px, rgba(255,255,255,0.4) 4px)',
                                }} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Now-line indicator */}
      {isSameDay(currentDate, now) && activity && (() => {
        const openMins = timeToMinutes(activity.opening_hours.start);
        const nowMins = timeToMinutes(currentTimeStr);
        const offsetSlots = (nowMins - openMins) / SLOT_INTERVAL;
        if (offsetSlots < 0) return null;
        return (
          <div className="relative pointer-events-none" style={{ marginTop: `-${(hours.length - offsetSlots) * SLOT_HEIGHT}px` }}>
            <div className="absolute left-[80px] right-0 border-t-2 border-destructive z-20" />
          </div>
        );
      })()}

      {activity && (
        <AppointmentDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          appointment={editAppt}
          defaultDate={selectedSlot?.date || format(currentDate, 'yyyy-MM-dd')}
          defaultTime={selectedSlot?.time || '09:00'}
          activity={activity}
          clients={clients}
          services={services}
          bookableEmployees={bookableEmployees}
          isSalone={isSalone}
        />
      )}
    </div>
  );
}

function AppointmentDialog({
  open, onClose, appointment, defaultDate, defaultTime, activity, clients, services, bookableEmployees, isSalone,
}: {
  open: boolean; onClose: () => void; appointment: Appointment | null; defaultDate: string; defaultTime: string;
  activity: NonNullable<ReturnType<typeof useAuth>['activity']>;
  clients: Client[]; services: Service[]; bookableEmployees: Employee[]; isSalone: boolean;
}) {
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState(defaultTime);
  const [duration, setDuration] = useState(activity.default_appointment_duration_minutes);
  const [bufferMinutes, setBufferMinutes] = useState(activity.buffer_minutes);
  const [status, setStatus] = useState<Appointment['status']>('confirmed');
  const [notes, setNotes] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setClientId(appointment?.client_id || '');
    setServiceId(appointment?.service_id || '');
    setEmployeeId(appointment?.employee_id || '');
    setDate(appointment?.date || defaultDate);
    setStartTime(formatTime(appointment?.start_time || defaultTime));
    setDuration(appointment?.duration_minutes || activity.default_appointment_duration_minutes);
    setBufferMinutes(appointment?.buffer_time_minutes ?? activity.buffer_minutes);
    setStatus((appointment?.status as Appointment['status']) || 'confirmed');
    setNotes(appointment?.notes || '');
    setClientName(appointment?.client_name || '');
    setClientPhone(appointment?.client_phone || '');
    setClientEmail(appointment?.client_email || '');
  }, [open, appointment?.id, defaultDate, defaultTime, appointment, activity]);

  useEffect(() => {
    if (!clientId) return;
    const selectedClient = clients.find((c) => c.id === clientId);
    if (!selectedClient) return;
    setClientName(selectedClient.name || '');
    setClientPhone(selectedClient.phone || '');
    setClientEmail(selectedClient.email || '');
  }, [clientId, clients]);

  const endTime = addMinutesToTime(startTime, duration);
  const selectedService = services.find((s) => s.id === serviceId);

  const handleServiceChange = (sid: string) => {
    setServiceId(sid);
    if (!sid) return;
    const svc = services.find((s) => s.id === sid);
    if (svc) setDuration(svc.duration_minutes);
  };

  const handleTimeChange = (val: string) => {
    setStartTime(roundToInterval(val, SLOT_INTERVAL));
  };

  const save = async () => {
    if (isSalone && bookableEmployees.length === 0) {
      toast.error('Aggiungi almeno un dipendente attivo prima di creare appuntamenti.');
      return;
    }
    if (isSalone && !employeeId) {
      toast.error('Seleziona il dipendente assegnato.');
      return;
    }
    setLoading(true);
    try {
      const isCoach = activity.category === 'coach';
      let ensuredClientId = clientId || null;

      if (!ensuredClientId && clientName.trim()) {
        ensuredClientId = await findOrCreateClient({
          activityId: activity.id,
          name: clientName.trim(),
          phone: clientPhone || null,
          email: clientEmail || null,
        });
      }

      // Auto-link package for coach on new appointments
      let packageId: string | null = null;
      if (isCoach && !appointment && ensuredClientId) {
        const activePkg = await findActivePackage(ensuredClientId, activity.id);
        if (activePkg && activePkg.used_sessions < activePkg.total_sessions) {
          packageId = activePkg.id;
        }
      }

      const payload = {
        activity_id: activity.id,
        client_id: ensuredClientId,
        service_id: serviceId || null,
        employee_id: isSalone ? employeeId : null,
        date,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: duration,
        buffer_time_minutes: bufferMinutes,
        status,
        notes: notes || null,
        client_name: clientName || null,
        client_phone: clientPhone || null,
        client_email: clientEmail || null,
        color: selectedService?.color || null,
        ...(packageId ? { package_id: packageId } : {}),
      };

      if (appointment) {
        const { error } = await supabase.from('appointments').update(payload).eq('id', appointment.id);
        if (error) throw error;

        // Handle package session decrement when status changes to completed
        const previousStatus = appointment.status;
        if (isCoach && status === 'completed' && previousStatus !== 'completed') {
          // Check if appointment has a linked package
          const { data: apptData } = await supabase
            .from('appointments')
            .select('package_id')
            .eq('id', appointment.id)
            .single();
          if (apptData?.package_id) {
            await decrementPackageSession(apptData.package_id);
          }
        }

        toast.success('Appuntamento aggiornato');
      } else {
        const { error } = await supabase.from('appointments').insert(payload);
        if (error) throw error;
        toast.success('Appuntamento creato');
      }
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Errore';
      toast.error(message);
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Errore';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{appointment ? 'Modifica appuntamento' : 'Nuovo appuntamento'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {clients.length > 0 && (
            <div>
              <Label>Cliente</Label>
              <Select value={clientId || '__none__'} onValueChange={(v) => setClientId(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Seleziona cliente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nessuno / walk-in</SelectItem>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {!clientId && (
            <div className="space-y-3">
              <div><Label>Nome cliente</Label><Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nome cliente" /></div>
              <div><Label>Telefono</Label><Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="+39 333 1234567" /></div>
              <div><Label>Email</Label><Input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="email@esempio.com" type="email" /></div>
            </div>
          )}
          {services.length > 0 && (
            <div>
              <Label>{isSalone ? 'Servizio' : 'Sessione'}</Label>
              <Select value={serviceId || '__none__'} onValueChange={(v) => handleServiceChange(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder={isSalone ? 'Seleziona servizio' : 'Seleziona sessione'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nessuno</SelectItem>
                  {services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.duration_minutes} min){!s.is_active ? ' — inattivo' : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {isSalone && (
            <div>
              <Label>Dipendente *</Label>
              <Select value={employeeId || '__none__'} onValueChange={(v) => setEmployeeId(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Seleziona dipendente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Seleziona…</SelectItem>
                  {bookableEmployees.map((e) => <SelectItem key={e.id} value={e.id}>{employeeDisplayLabel(e, activity)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Data</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div>
              <Label>Orario</Label>
              <Input type="time" step={SLOT_INTERVAL * 60} value={startTime} onChange={(e) => handleTimeChange(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Multipli di {SLOT_INTERVAL} min</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Durata (min)</Label><Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} min={5} step={5} /></div>
            <div><Label>Buffer dopo (min)</Label><Input type="number" value={bufferMinutes} onChange={(e) => setBufferMinutes(Number(e.target.value))} min={0} step={5} /></div>
          </div>
          <div>
            <Label>Stato</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as Appointment['status'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="confirmed">Confermato</SelectItem>
                <SelectItem value="pending">In attesa</SelectItem>
                <SelectItem value="cancelled">Cancellato</SelectItem>
                <SelectItem value="no-show">No Show</SelectItem>
                <SelectItem value="completed">Completato</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Note</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Note opzionali" /></div>
          <div className="text-sm text-muted-foreground">
            Fine prevista: {endTime} {bufferMinutes > 0 && `(+${bufferMinutes} min buffer = libero dalle ${addMinutesToTime(endTime, bufferMinutes)})`}
          </div>
          <div className="flex gap-2">
            {appointment && <Button variant="destructive" onClick={deleteAppt} disabled={loading}>Elimina</Button>}
            <Button variant="hero" onClick={save} disabled={loading} className="flex-1">
              {loading ? 'Salvataggio...' : appointment ? 'Aggiorna' : 'Crea'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
