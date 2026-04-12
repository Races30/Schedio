import { Activity, Employee } from '@/types';

/** Staff who can receive bookings and appear in public/host calendars. */
export function filterBookableEmployees(employees: Employee[], activity: Activity | null): Employee[] {
  if (!activity) return [];
  return employees.filter((e) => {
    if (e.is_active === false) return false;
    if (e.is_owner && !activity.host_works_in_salon) return false;
    return true;
  });
}

/** Rows to show on the admin Employees screen (excludes owner when they do not work on the floor). */
export function filterManageableEmployees(employees: Employee[], activity: Activity | null): Employee[] {
  if (!activity) return [];
  return employees.filter((e) => !e.is_owner || activity.host_works_in_salon);
}

export function employeeDisplayLabel(e: Employee, activity: Activity | null): string {
  if (e.is_owner && activity?.host_works_in_salon) return `${e.name} ${e.surname} (Io)`;
  return `${e.name} ${e.surname}`;
}
