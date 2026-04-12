import { format, addMinutes, parseISO, isToday, isTomorrow, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { it } from 'date-fns/locale';

export const formatDate = (date: string | Date) => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd MMM yyyy', { locale: it });
};

export const formatTime = (time: string) => (time || '').slice(0, 5);

/** DB TIME may be HH:MM:SS; slot grid uses HH:MM */
export const normalizeTime = (time: string): string => (time || '').slice(0, 5);

export const timeToMinutes = (time: string): number => {
  const t = normalizeTime(time);
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** True if appointment overlaps the half-hour slot starting at slotTime */
export const appointmentOverlapsSlot = (
  apptStart: string,
  apptEnd: string,
  slotTime: string,
  slotMinutes = 30
): boolean => {
  const a0 = timeToMinutes(apptStart);
  const a1 = timeToMinutes(apptEnd);
  const s0 = timeToMinutes(slotTime);
  const s1 = s0 + slotMinutes;
  return a0 < s1 && a1 > s0;
};

/** Slot row where the appointment block should be anchored (start falls inside this slot) */
export const slotContainingStart = (startTime: string, slotTime: string, slotMinutes = 30): boolean => {
  const s = timeToMinutes(normalizeTime(startTime));
  const slotStart = timeToMinutes(slotTime);
  return s >= slotStart && s < slotStart + slotMinutes;
};

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
