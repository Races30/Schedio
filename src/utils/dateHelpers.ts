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

/** True if appointment overlaps the slot starting at slotTime (default 15 min) */
export const appointmentOverlapsSlot = (
  apptStart: string,
  apptEnd: string,
  slotTime: string,
  slotMinutes = 15
): boolean => {
  const a0 = timeToMinutes(apptStart);
  const a1 = timeToMinutes(apptEnd);
  const s0 = timeToMinutes(slotTime);
  const s1 = s0 + slotMinutes;
  return a0 < s1 && a1 > s0;
};

/** True if appointment+buffer overlaps the slot */
export const appointmentWithBufferOverlapsSlot = (
  apptStart: string,
  apptEnd: string,
  bufferMinutes: number,
  slotTime: string,
  slotMinutes = 15
): boolean => {
  const a0 = timeToMinutes(apptStart);
  const a1 = timeToMinutes(apptEnd) + bufferMinutes;
  const s0 = timeToMinutes(slotTime);
  const s1 = s0 + slotMinutes;
  return a0 < s1 && a1 > s0;
};

/** Check if a slot falls in the buffer zone only (after end_time, before end_time+buffer) */
export const slotIsBufferOnly = (
  apptEnd: string,
  bufferMinutes: number,
  slotTime: string,
  slotMinutes = 15
): boolean => {
  if (bufferMinutes <= 0) return false;
  const endMin = timeToMinutes(apptEnd);
  const bufferEnd = endMin + bufferMinutes;
  const s0 = timeToMinutes(slotTime);
  const s1 = s0 + slotMinutes;
  return s0 >= endMin && s1 <= bufferEnd;
};

/** Slot row where the appointment block should be anchored (start falls inside this slot) */
export const slotContainingStart = (startTime: string, slotTime: string, slotMinutes = 15): boolean => {
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

export const generateTimeSlots = (start: string, end: string, intervalMinutes: number = 15): string[] => {
  const slots: string[] = [];
  let current = start;
  while (current < end) {
    slots.push(current);
    current = addMinutesToTime(current, intervalMinutes);
  }
  return slots;
};

/** Round a time string down to the nearest N-minute interval */
export const roundToInterval = (time: string, interval: number = 15): string => {
  const mins = timeToMinutes(time);
  const rounded = Math.floor(mins / interval) * interval;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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
