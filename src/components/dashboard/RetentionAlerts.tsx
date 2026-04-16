import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AlertTriangle, UserX, Package } from 'lucide-react';
import { Link } from 'react-router-dom';

export function RetentionAlerts() {
  const { activity } = useAuth();

  const { data: alerts = [] } = useQuery({
    queryKey: ['notifications', 'retention', activity?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('activity_id', activity!.id)
        .eq('is_read', false)
        .in('type', ['retention_inactive', 'package_expiring'])
        .order('created_at', { ascending: false });
      
      if (error && error.code !== '42P01') throw error;
      return data || [];
    },
    enabled: !!activity,
  });

  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="mb-6 space-y-2">
      {alerts.map(alert => (
        <div key={alert.id} className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-sm">
          {alert.type === 'package_expiring' ? (
            <Package className="w-5 h-5 text-destructive flex-shrink-0" />
          ) : (
            <UserX className="w-5 h-5 text-destructive flex-shrink-0" />
          )}
          <div className="flex-1">
            <strong className="block text-destructive">{alert.title}</strong>
            <span className="text-foreground/80">{alert.message}</span>
          </div>
          <Link to="/clients" className="text-destructive font-medium text-xs hover:underline whitespace-nowrap">
            Gestisci
          </Link>
        </div>
      ))}
    </div>
  );
}
