import { format, addMinutes, parseISO, isToday, isTomorrow, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { it } from 'date-fns/locale';

export const formatDate = (date: string | Date) => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd MMM yyyy', { locale: it });
};

export const formatTime = (time: string) => time.slice(0, 5);

export const formatDateRelative = (date: string | Date) => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (isToday(d)) return 'Oggi';
  if (isTomorrow(d)) return 'Domani';
  return format(d, 'EEEE dd MMM', { locale: it });
};

export const getWeekDays = (date: Date) => {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end });
};

export const addMinutesToTime = (time: string, minutes: number): string => {
  const [h, m] = time.split(':').map(Number);
  const date = new Date(2000, 0, 1, h, m);
  const result = addMinutes(date, minutes);
  return format(result, 'HH:mm');
};

export const generateTimeSlots = (start: string, end: string, intervalMinutes: number = 30): string[] => {
  const slots: string[] = [];
  let current = start;
  while (current < end) {
    slots.push(current);
    current = addMinutesToTime(current, intervalMinutes);
  }
  return slots;
};

export const getDayName = (dayIndex: number): string => {
  const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  return days[dayIndex];
};

export const getDayNameShort = (dayIndex: number): string => {
  const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
  return days[dayIndex];
};

export { isToday, isTomorrow, isSameDay, format, parseISO };
