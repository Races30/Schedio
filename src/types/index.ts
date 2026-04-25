export type AppointmentStatus = 'confirmed' | 'pending' | 'cancelled' | 'no-show' | 'completed';

export type ActivityCategory = 'salone' | 'coach';

export interface Activity {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  category: string;
  owner_name: string;
  description?: string | null;
  host_works_in_salon?: boolean;
  timezone: string;
  opening_days: number[];
  opening_hours: { start: string; end: string };
  theme_color: string;
  logo_url: string | null;
  default_appointment_duration_minutes: number;
  buffer_minutes: number;
  created_at: string;
  updated_at: string;
  max_advance_booking_days?: number;
  min_booking_notice_hours?: number;
}

export interface Client {
  status: string;
  status_reason: string;
  id: string;
  activity_id: string;
  name: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name_normalized?: string | null;
  phone_normalized?: string | null;
  email_normalized?: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  important_notes?: string | null;
  preferences: Record<string, unknown> | null;
  objective?: string | null;
  level?: string | null;
  frequency?: string | null;
  training_frequency?: string | null;
  last_booking_at?: string | null;
  last_completed_at?: string | null;
  last_workout_at?: string | null;
  last_service_id?: string | null;
  last_service_name?: string | null;
  visit_frequency_days?: number | null;
  next_recommended_at?: string | null;
  active_package_id?: string | null;
  sessions_purchased?: number | null;
  sessions_used?: number | null;
  sessions_remaining?: number | null;
  package_expiry_date?: string | null;
  activity_status?: string | null;
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
  description: string | null;
  created_at: string;
  updated_at?: string;
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
  is_active?: boolean;
  created_at: string;
  updated_at?: string;
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
  buffer_time_minutes?: number;
  package_id?: string | null;
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
  type: 'available' | 'blocked' | 'break' | 'lunch' | 'closure';
  notes: string | null;
  employee_id?: string | null;
  start_datetime?: string | null;
  end_datetime?: string | null;
  created_at: string;
}

export interface Package {
  id: string;
  activity_id: string;
  client_id: string;
  name: string;
  total_sessions: number;
  used_sessions: number;
  price?: number | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProgressEntry {
  id: string;
  activity_id: string;
  client_id: string;
  measurement_date: string;
  weight: number | null;
  waist?: number | null;
  hips?: number | null;
  chest?: number | null;
  arms?: number | null;
  thighs?: number | null;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
}

export type MeasureType = 'ripetizioni' | 'secondi' | 'kg' | 'metri';

export const MEASURE_UNIT: Record<MeasureType, string> = {
  ripetizioni: 'rip',
  secondi: 'sec',
  kg: 'kg',
  metri: 'm',
};

export interface Exercise {
  id: string;
  activity_id: string;
  name: string;
  measure_type: MeasureType;
  muscles: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExerciseProgress {
  id: string;
  activity_id: string;
  client_id: string;
  exercise_id: string;
  appointment_id: string | null;
  value: number;
  measure_type: MeasureType;
  notes: string | null;
  recorded_at: string;
  created_at: string;
  exercise?: Exercise;
}

export interface WorkoutPlan {
  id: string;
  activity_id: string;
  client_id: string;
  name: string;
  exercises: unknown[];
  trainer_notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkoutCompletion {
  id: string;
  workout_plan_id: string;
  client_id: string;
  completed_at: string;
  created_at: string;
}
