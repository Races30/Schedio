/**
 * Generate an .ics calendar file content and trigger download.
 */
export function generateIcsFile(options: {
  title: string;
  description?: string;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  durationMinutes: number;
  location?: string;
}) {
  const { title, description, startDate, startTime, durationMinutes, location } = options;

  const [year, month, day] = startDate.split('-').map(Number);
  const [hour, minute] = startTime.split(':').map(Number);

  const start = new Date(year, month - 1, day, hour, minute);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const fmt = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  };

  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@schedio`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Schedio//Booking//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${title}`,
    ...(description ? [`DESCRIPTION:${description.replace(/\n/g, '\\n')}`] : []),
    ...(location ? [`LOCATION:${location}`] : []),
    `STATUS:CONFIRMED`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  const content = lines.join('\r\n');
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'appuntamento.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
