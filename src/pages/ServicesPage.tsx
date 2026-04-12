import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Employee, EmployeeService, Service } from '@/types';
import { filterManageableEmployees } from '@/utils/salonEmployees';

export default function ServicesPage() {
  const { activity } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);

  const { data: services = [], refetch: refetchServices } = useQuery({
    queryKey: ['services', activity?.id],
    queryFn: async () => {
      const { data } = await supabase.from('services').select('*').eq('activity_id', activity!.id).order('name');
      return (data || []) as Service[];
    },
    enabled: !!activity,
  });

  const { data: employeesRaw = [] } = useQuery({
    queryKey: ['employees', activity?.id],
    queryFn: async () => {
      const { data } = await supabase.from('employees').select('*').eq('activity_id', activity!.id);
      return (data || []) as Employee[];
    },
    enabled: !!activity,
  });

  const manageableEmployees = filterManageableEmployees(employeesRaw, activity);

  const serviceIds = services.map((s) => s.id);
  const { data: employeeServices = [], refetch: refetchES } = useQuery({
    queryKey: ['employee-services-by-svc', activity?.id, serviceIds.join(',')],
    queryFn: async () => {
      if (serviceIds.length === 0) return [];
      const { data } = await supabase.from('employee_services').select('*').in('service_id', serviceIds);
      return (data || []) as EmployeeService[];
    },
    enabled: !!activity && serviceIds.length > 0,
  });

  if (!activity) return null;

  const deleteService = async (s: Service) => {
    const { error } = await supabase.from('services').delete().eq('id', s.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Servizio eliminato');
    void refetchServices();
    void refetchES();
    queryClient.invalidateQueries({ queryKey: ['services'] });
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Servizi</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Prezzo, durata e colori si riflettono sul calendario e sulla pagina pubblica.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuovo servizio
        </Button>
      </div>

      <div className="space-y-2">
        {services.length === 0 ? (
          <div className="glass-card p-8 text-center text-muted-foreground text-sm">Nessun servizio. Aggiungine uno per iniziare.</div>
        ) : (
          services.map((s) => {
            const assigned = employeeServices.filter((es) => es.service_id === s.id).length;
            return (
              <div key={s.id} className="glass-card flex flex-wrap items-center gap-3 p-4">
                <div className="w-3 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">
                    {s.name}
                    {!s.is_active && <span className="text-xs text-muted-foreground ml-2">Inattivo</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {s.duration_minutes} min
                    {s.price != null && ` • €${s.price}`}
                    {assigned > 0 && ` • ${assigned} operatori`}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => { setEditing(s); setDialogOpen(true); }}>
                  <Pencil className="w-4 h-4 mr-1" />
                  Modifica
                </Button>
                <Button variant="ghost" size="icon" onClick={() => void deleteService(s)} className="text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })
        )}
      </div>

      <ServiceDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        service={editing}
        activityId={activity.id}
        manageableEmployees={manageableEmployees}
        employeeServices={employeeServices}
        onSaved={() => {
          void refetchServices();
          void refetchES();
          queryClient.invalidateQueries({ queryKey: ['services'] });
        }}
      />
    </div>
  );
}

function ServiceDialog({
  open,
  onClose,
  service,
  activityId,
  manageableEmployees,
  employeeServices,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  service: Service | null;
  activityId: string;
  manageableEmployees: Employee[];
  employeeServices: EmployeeService[];
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [duration, setDuration] = useState(30);
  const [price, setPrice] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (service) {
      setName(service.name);
      setDuration(service.duration_minutes);
      setPrice(service.price != null ? String(service.price) : '');
      setColor(service.color);
      setDescription(service.description || '');
      setIsActive(service.is_active !== false);
      setSelectedEmployeeIds(employeeServices.filter((es) => es.service_id === service.id).map((es) => es.employee_id));
    } else {
      setName('');
      setDuration(30);
      setPrice('');
      setColor('#3b82f6');
      setDescription('');
      setIsActive(true);
      setSelectedEmployeeIds(manageableEmployees.map((e) => e.id));
    }
  }, [open, service?.id, service, employeeServices, manageableEmployees]);

  const toggleEmp = (id: string) => {
    setSelectedEmployeeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const save = async () => {
    if (!name.trim()) {
      toast.error('Il nome è obbligatorio');
      return;
    }
    setLoading(true);
    try {
      let serviceId = service?.id;
      const row = {
        activity_id: activityId,
        name: name.trim(),
        duration_minutes: duration,
        price: price.trim() ? parseFloat(price) : null,
        color,
        description: description.trim() || null,
        is_active: isActive,
      };

      if (service) {
        const { error } = await supabase.from('services').update(row).eq('id', service.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('services').insert(row).select('id').single();
        if (error) throw error;
        serviceId = data.id;
      }

      if (serviceId) {
        await supabase.from('employee_services').delete().eq('service_id', serviceId);
        if (selectedEmployeeIds.length > 0) {
          await supabase
            .from('employee_services')
            .insert(selectedEmployeeIds.map((employee_id) => ({ employee_id, service_id: serviceId! })));
        }
      }

      toast.success(service ? 'Servizio aggiornato' : 'Servizio creato');
      onSaved();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Errore';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{service ? 'Modifica servizio' : 'Nuovo servizio'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="es. Taglio uomo" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Durata (min)</Label>
              <Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} min={5} step={5} />
            </div>
            <div>
              <Label>Prezzo (€)</Label>
              <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
            </div>
          </div>
          <div>
            <Label>Colore in agenda</Label>
            <div className="flex items-center gap-2 mt-1">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0" />
              <span className="text-sm text-muted-foreground">{color}</span>
            </div>
          </div>
          <div>
            <Label>Descrizione (opzionale)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Note per il cliente" />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="svc-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-border"
            />
            <Label htmlFor="svc-active" className="font-normal cursor-pointer">
              Servizio attivo e prenotabile online
            </Label>
          </div>
          {manageableEmployees.length > 0 && (
            <div>
              <Label className="mb-2 block">Operatori che possono eseguirlo</Label>
              <div className="flex flex-wrap gap-2">
                {manageableEmployees.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => toggleEmp(e.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedEmployeeIds.includes(e.id) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                  >
                    {e.name} {e.surname}
                    {e.is_owner ? ' (Io)' : ''}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Button variant="hero" className="w-full" onClick={() => void save()} disabled={loading}>
            {loading ? 'Salvataggio...' : 'Salva'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
