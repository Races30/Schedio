export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          buffer_minutes: number
          buffer_time_minutes: number
          category: string
          created_at: string
          default_appointment_duration_minutes: number
          default_duration_minutes: number
          description: string | null
          host_works_in_salon: boolean
          id: string
          logo_url: string | null
          max_advance_booking_days: number
          min_booking_notice_hours: number
          name: string
          opening_days: number[]
          opening_hours: Json
          owner_name: string
          slug: string
          theme_color: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          buffer_minutes?: number
          buffer_time_minutes?: number
          category: string
          created_at?: string
          default_appointment_duration_minutes?: number
          default_duration_minutes?: number
          description?: string | null
          host_works_in_salon?: boolean
          id?: string
          logo_url?: string | null
          max_advance_booking_days?: number
          min_booking_notice_hours?: number
          name: string
          opening_days?: number[]
          opening_hours?: Json
          owner_name: string
          slug: string
          theme_color?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          buffer_minutes?: number
          buffer_time_minutes?: number
          category?: string
          created_at?: string
          default_appointment_duration_minutes?: number
          default_duration_minutes?: number
          description?: string | null
          host_works_in_salon?: boolean
          id?: string
          logo_url?: string | null
          max_advance_booking_days?: number
          min_booking_notice_hours?: number
          name?: string
          opening_days?: number[]
          opening_hours?: Json
          owner_name?: string
          slug?: string
          theme_color?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          activity_id: string
          buffer_time_minutes: number
          client_email: string | null
          client_id: string | null
          client_name: string | null
          client_phone: string | null
          color: string | null
          created_at: string
          date: string
          duration_minutes: number
          employee_id: string | null
          end_time: string
          id: string
          notes: string | null
          package_id: string | null
          service_id: string | null
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          activity_id: string
          buffer_time_minutes?: number
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          color?: string | null
          created_at?: string
          date: string
          duration_minutes: number
          employee_id?: string | null
          end_time: string
          id?: string
          notes?: string | null
          package_id?: string | null
          service_id?: string | null
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          activity_id?: string
          buffer_time_minutes?: number
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          color?: string | null
          created_at?: string
          date?: string
          duration_minutes?: number
          employee_id?: string | null
          end_time?: string
          id?: string
          notes?: string | null
          package_id?: string | null
          service_id?: string | null
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_blocks: {
        Row: {
          activity_id: string
          created_at: string
          day_of_week: number
          employee_id: string | null
          end_datetime: string | null
          end_time: string
          id: string
          notes: string | null
          start_datetime: string | null
          start_time: string
          type: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          day_of_week: number
          employee_id?: string | null
          end_datetime?: string | null
          end_time: string
          id?: string
          notes?: string | null
          start_datetime?: string | null
          start_time: string
          type?: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          day_of_week?: number
          employee_id?: string | null
          end_datetime?: string | null
          end_time?: string
          id?: string
          notes?: string | null
          start_datetime?: string | null
          start_time?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_blocks_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_blocks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          activity_id: string
          activity_status: string | null
          active_package_id: string | null
          created_at: string
          email: string | null
          email_normalized: string | null
          first_name: string | null
          frequency: string | null
          full_name_normalized: string | null
          id: string
          important_notes: string | null
          last_booking_at: string | null
          last_completed_at: string | null
          last_name: string | null
          last_service_id: string | null
          last_service_name: string | null
          last_workout_at: string | null
          level: string | null
          name: string
          next_recommended_at: string | null
          notes: string | null
          objective: string | null
          package_expiry_date: string | null
          phone: string | null
          phone_normalized: string | null
          preferences: Json | null
          sessions_purchased: number | null
          sessions_remaining: number | null
          sessions_used: number | null
          status: string | null
          status_reason: string | null
          training_frequency: string | null
          updated_at: string
          visit_frequency_days: number | null
        }
        Insert: {
          activity_id: string
          activity_status?: string | null
          active_package_id?: string | null
          created_at?: string
          email?: string | null
          email_normalized?: string | null
          first_name?: string | null
          frequency?: string | null
          full_name_normalized?: string | null
          id?: string
          important_notes?: string | null
          last_booking_at?: string | null
          last_completed_at?: string | null
          last_name?: string | null
          last_service_id?: string | null
          last_service_name?: string | null
          last_workout_at?: string | null
          level?: string | null
          name: string
          next_recommended_at?: string | null
          notes?: string | null
          objective?: string | null
          package_expiry_date?: string | null
          phone?: string | null
          phone_normalized?: string | null
          preferences?: Json | null
          sessions_purchased?: number | null
          sessions_remaining?: number | null
          sessions_used?: number | null
          status?: string | null
          status_reason?: string | null
          training_frequency?: string | null
          updated_at?: string
          visit_frequency_days?: number | null
        }
        Update: {
          activity_id?: string
          activity_status?: string | null
          active_package_id?: string | null
          created_at?: string
          email?: string | null
          email_normalized?: string | null
          first_name?: string | null
          frequency?: string | null
          full_name_normalized?: string | null
          id?: string
          important_notes?: string | null
          last_booking_at?: string | null
          last_completed_at?: string | null
          last_name?: string | null
          last_service_id?: string | null
          last_service_name?: string | null
          last_workout_at?: string | null
          level?: string | null
          name?: string
          next_recommended_at?: string | null
          notes?: string | null
          objective?: string | null
          package_expiry_date?: string | null
          phone?: string | null
          phone_normalized?: string | null
          preferences?: Json | null
          sessions_purchased?: number | null
          sessions_remaining?: number | null
          sessions_used?: number | null
          status?: string | null
          status_reason?: string | null
          training_frequency?: string | null
          updated_at?: string
          visit_frequency_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_services: {
        Row: {
          employee_id: string
          id: string
          service_id: string
        }
        Insert: {
          employee_id: string
          id?: string
          service_id: string
        }
        Update: {
          employee_id?: string
          id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_services_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          activity_id: string
          color: string
          created_at: string
          id: string
          is_active: boolean
          is_owner: boolean
          name: string
          role: string
          slug: string
          surname: string
          token: string
          updated_at: string
        }
        Insert: {
          activity_id: string
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_owner?: boolean
          name: string
          role?: string
          slug: string
          surname: string
          token: string
          updated_at?: string
        }
        Update: {
          activity_id?: string
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_owner?: boolean
          name?: string
          role?: string
          slug?: string
          surname?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          activity_id: string
          channel: string
          client_id: string | null
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          scheduled_for: string | null
          sent_at: string | null
          title: string
          type: string
        }
        Insert: {
          activity_id: string
          channel?: string
          client_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          scheduled_for?: string | null
          sent_at?: string | null
          title: string
          type?: string
        }
        Update: {
          activity_id?: string
          channel?: string
          client_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          scheduled_for?: string | null
          sent_at?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          activity_id: string
          client_id: string
          created_at: string
          end_date: string | null
          id: string
          name: string
          notes: string | null
          price: number | null
          start_date: string | null
          status: string
          total_sessions: number
          updated_at: string
          used_sessions: number
        }
        Insert: {
          activity_id: string
          client_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          notes?: string | null
          price?: number | null
          start_date?: string | null
          status?: string
          total_sessions: number
          updated_at?: string
          used_sessions?: number
        }
        Update: {
          activity_id?: string
          client_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          price?: number | null
          start_date?: string | null
          status?: string
          total_sessions?: number
          updated_at?: string
          used_sessions?: number
        }
        Relationships: [
          {
            foreignKeyName: "packages_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_entries: {
        Row: {
          activity_id: string
          arms: number | null
          chest: number | null
          client_id: string
          created_at: string
          hips: number | null
          id: string
          measurement_date: string
          notes: string | null
          photo_url: string | null
          thighs: number | null
          waist: number | null
          weight: number | null
        }
        Insert: {
          activity_id: string
          arms?: number | null
          chest?: number | null
          client_id: string
          created_at?: string
          hips?: number | null
          id?: string
          measurement_date?: string
          notes?: string | null
          photo_url?: string | null
          thighs?: number | null
          waist?: number | null
          weight?: number | null
        }
        Update: {
          activity_id?: string
          arms?: number | null
          chest?: number | null
          client_id?: string
          created_at?: string
          hips?: number | null
          id?: string
          measurement_date?: string
          notes?: string | null
          photo_url?: string | null
          thighs?: number | null
          waist?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "progress_entries_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          activity_id: string
          color: string
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          price: number | null
          updated_at: string
        }
        Insert: {
          activity_id: string
          color?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name: string
          price?: number | null
          updated_at?: string
        }
        Update: {
          activity_id?: string
          color?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      // Added dummy definitions for new tables to prevent TS errors before running 'supabase gen types'
      /* eslint-disable @typescript-eslint/no-explicit-any */
      exercises: { Row: any, Insert: any, Update: any, Relationships: any }
      exercise_progress: { Row: any, Insert: any, Update: any, Relationships: any }
      sessions: { Row: any, Insert: any, Update: any, Relationships: any }
      session_exercises: { Row: any, Insert: any, Update: any, Relationships: any }
      session_feedback: { Row: any, Insert: any, Update: any, Relationships: any }
      workout_plans: { Row: any, Insert: any, Update: any, Relationships: any }
      workout_completions: { Row: any, Insert: any, Update: any, Relationships: any }
      /* eslint-enable @typescript-eslint/no-explicit-any */
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_retention_alerts: {
        Args: {
          target_activity_id: string
        }
        Returns: undefined
      }
      recompute_client_metrics: {
        Args: {
          p_client_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
