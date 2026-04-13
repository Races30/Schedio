import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Activity, Employee, Appointment } from '@/types';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  formatTime,
  generateTimeSlots,
  addMinutesToTime,
  getDayNameShort,
  slotContainingStart,
} from '@/utils/dateHelpers';

const SLOT_INTERVAL = 15;
const SLOT_HEIGHT = 36;

export default function EmployeePage() {
  const { slugAndToken } = useParams<{ slugAndToken: string }>();
  const { slug } = useParams<{ slug: string }>();
  const token = slugAndToken?.split('--').pop() || '';
  const [currentDate, setCurrentDate] = useState(new Date());

  const { data: activity } = useQuery({
    queryKey: ['emp-activity', slug],
    queryFn: async () => {
      const { data } = await supabase.from('activities').select('*').eq('slug', slug!).single();
      return data ? (data as unknown as Activity) : null;
    },
    enabled: !!slug,
  });

  const { data: employee, isLoading } = useQuery({
    queryKey: ['emp-by-token', token],
    queryFn: async () => {
      const { data } = await supabase.from('employees').select('*').eq('token', token).single();
      return data as Employee | null;
    },
    enabled: !!token,
  });

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dateRange = { start: format(weekDays[0], 'yyyy-MM-dd'), end: format(weekDays[6], 'yyyy-MM-dd') };

  const { data: appointments = [] } = useQuery({
    queryKey: ['emp-appointments', employee?.id, dateRange],
    queryFn: async () => {
      const { data } = await supabase
        .from('appointments')
        .select('*, service:services(*), client:clients(*)')
        .eq('employee_id', employee!.id)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)
        .order('date')
        .order('start_time');
      return (data || []) as Appointment[];
    },
    enabled: !!employee,
  });

  const hours = activity ? generateTimeSlots(activity.opening_hours.start, activity.opening_hours.end, SLOT_INTERVAL) : [];
  const now = new Date();
  const currentTimeStr = format(now, 'HH:mm');
  const navigateWeek = (dir: number) => setCurrentDate((prev) => addDays(prev, dir * 7));

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const hostWorks = activity?.host_works_in_salon !== false;
  const blockedOwnerCalendar = employee?.is_owner && !hostWorks;
  const inactive = employee && employee.is_active === false;

  if (!employee || !activity || blockedOwnerCalendar || inactive) {
    return <div className="min-h-screen flex items-center justify-center p-4"><div className="text-center"><h1 className="text-2xl font-bold mb-2">Pagina non trovata</h1><p className="text-muted-foreground">Il link non è valido o non è più attivo.</p></div></div>;
  }

  const getApptsStartingInSlot = (day: Date, time: string) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return appointments.filter((a) => a.date === dateStr && slotContainingStart(a.start_time, time, SLOT_INTERVAL));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ color: employee.color }}>{employee.name} {employee.surname}</h1>
            <p className="text-sm text-muted-foreground">{activity.name} • {employee.role}</p>
          </div>
        </div>
      </header>

      <div className="p-4 md:p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => navigateWeek(-1)}><ChevronLeft className="w-4 h-4" /></Button>
            <h2 className="text-lg font-semibold">{format(weekDays[0], 'dd MMM', { locale: it })} - {format(weekDays[6], 'dd MMM yyyy', { locale: it })}</h2>
            <Button variant="outline" size="icon" onClick={() => navigateWeek(1)}><ChevronRight className="w-4 h-4" /></Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Oggi</Button>
        </div>

        <div className="glass-card overflow-x-auto">
          <div className="min-w-[600px]">
            <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-border">
              <div className="p-2" />
              {weekDays.map((day, i) => {
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
                <div key={time} className={`grid grid-cols-[80px_repeat(7,1fr)] ${isHourMark ? 'border-b border-border/50' : 'border-b border-border/20'}`}>
                  <div className="p-1 text-xs text-muted-foreground text-right pr-3" style={{ height: `${SLOT_HEIGHT}px`, lineHeight: `${SLOT_HEIGHT}px` }}>
                    {isHourMark ? time : ''}
                  </div>
                  {weekDays.map((day, di) => {
                    const slotAppts = getApptsStartingInSlot(day, time);
                    const isNow = isSameDay(day, now) && currentTimeStr >= time && currentTimeStr < addMinutesToTime(time, SLOT_INTERVAL);
                    return (
                      <div key={di} className={`border-l border-border/50 p-0.5 ${isNow ? 'bg-primary/5' : ''}`} style={{ minHeight: `${SLOT_HEIGHT}px` }}>
                        {slotAppts.map((appt) => {
                          const durationSlots = Math.ceil(appt.duration_minutes / SLOT_INTERVAL);
                          const color = appt.color || appt.service?.color || employee.color;
                          return (
                            <div key={appt.id} className="rounded-md p-1 text-xs"
                              style={{ backgroundColor: color + '20', height: `${durationSlots * SLOT_HEIGHT - 4}px`, position: 'relative', zIndex: 10 }}>
                              <div className="font-medium truncate" style={{ color }}>{appt.client?.name || appt.client_name || 'Cliente'}</div>
                              <div className="truncate text-muted-foreground">{formatTime(appt.start_time)} - {formatTime(appt.end_time)}</div>
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
      </div>
    </div>
  );
}
