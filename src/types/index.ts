export type AppointmentStatus = 'confirmed' | 'pending' | 'cancelled' | 'completed';

export interface Activity {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  category: string;
  owner_name: string;
  timezone: string;
  opening_days: number[];
  opening_hours: { start: string; end: string };
  theme_color: string;
  logo_url: string | null;
  default_appointment_duration_minutes: number;
  buffer_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  activity_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  preferences: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  activity_id: string;
  name: string;
  duration_minutes: number;
  price: number | null;
  color: string;
  is_active: boolean;
  created_at: string;
}

export interface Employee {
  id: string;
  activity_id: string;
  name: string;
  surname: string;
  slug: string;
  token: string;
  role: string;
  color: string;
  is_owner: boolean;
  created_at: string;
}

export interface EmployeeService {
  id: string;
  employee_id: string;
  service_id: string;
}

export interface Appointment {
  id: string;
  activity_id: string;
  client_id: string | null;
  service_id: string | null;
  employee_id: string | null;
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  status: AppointmentStatus;
  color: string | null;
  notes: string | null;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  created_at: string;
  updated_at: string;
  // joined
  client?: Client;
  service?: Service;
  employee?: Employee;
}

export interface AvailabilityBlock {
  id: string;
  activity_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  type: 'available' | 'blocked';
  notes: string | null;
  created_at: string;
}
