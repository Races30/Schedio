import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Copy, ExternalLink, Link as LinkIcon } from 'lucide-react';
import { Employee, EmployeeService, Service } from '@/types';
import { filterManageableEmployees, employeeDisplayLabel } from '@/utils/salonEmployees';

const generateToken = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 20; i++) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
};

const makeSlug = (n: string, s: string) =>
  `${n}-${s}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function EmployeesPage() {
  const { activity } = useAuth();
  const queryClient = useQueryClient();
  const [empDialogOpen, setEmpDialogOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);

  const { data: employeesRaw = [], refetch: refetchEmployees } = useQuery({
    queryKey: ['employees', activity?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('employees')
        .select('*')
        .eq('activity_id', activity!.id)
        .order('is_owner', { ascending: false })
        .order('name');
      return (data || []) as Employee[];
    },
    enabled: !!activity,
  });

  const manageable = filterManageableEmployees(employeesRaw, activity);

  const { data: services = [] } = useQuery({
    queryKey: ['services', activity?.id],
    queryFn: async () => {
      const { data } = await supabase.from('services').select('*').eq('activity_id', activity!.id).order('name');
      return (data || []) as Service[];
    },
    enabled: !!activity,
  });

  const { data: employeeServices = [], refetch: refetchES } = useQuery({
    queryKey: ['employee-services', activity?.id],
    queryFn: async () => {
      const empIds = employeesRaw.map((e) => e.id);
      if (empIds.length === 0) return [];
      const { data } = await supabase.from('employee_services').select('*').in('employee_id', empIds);
      return (data || []) as EmployeeService[];
    },
    enabled: employeesRaw.length > 0,
  });

  if (!activity) return null;

  const copyLink = (emp: Employee) => {
    const url = `${window.location.origin}/${activity.slug}/${emp.slug}--${emp.token}`;
    void navigator.clipboard.writeText(url);
    toast.success('Link copiato negli appunti');
  };

  const toggleActive = async (emp: Employee, next: boolean) => {
    if (emp.is_owner) {
      toast.error('Per il titolare usa l’opzione nelle Impostazioni (lavoro nel salone).');
      return;
    }
    const { error } = await supabase.from('employees').update({ is_active: next }).eq('id', emp.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(next ? 'Dipendente attivato' : 'Dipendente disattivato');
    void refetchEmployees();
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Dipendenti</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Aggiungi il team, assegna i servizi e condividi il calendario personale (link con token).
          </p>
        </div>
        <Button
          onClick={() => {
            setEditEmployee(null);
            setEmpDialogOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Aggiungi
        </Button>
      </div>

      <div className="glass-card p-6 space-y-3">
        {manageable.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nessun dipendente visibile. Attiva &quot;Lavoro nel salone&quot; nelle impostazioni se sei anche operatore.</p>
        ) : (
          manageable.map((emp) => {
            const empSvcIds = employeeServices.filter((es) => es.employee_id === emp.id).map((es) => es.service_id);
            const empSvcNames = services.filter((s) => empSvcIds.includes(s.id)).map((s) => s.name);
            const active = emp.is_active !== false;
            return (
              <div key={emp.id} className="flex flex-wrap items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="w-3 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: emp.color }} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">
                    {employeeDisplayLabel(emp, activity)}
                    {emp.is_owner && (
                      <span className="text-xs text-primary ml-2">Titolare</span>
                    )}
                    {!active && <span className="text-xs text-muted-foreground ml-2">Inattivo</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {emp.role}
                    {empSvcNames.length > 0 && ` • ${empSvcNames.join(', ')}`}
                  </div>
                  <div className="text-xs text-primary/80 truncate mt-1 font-mono">
                    {`${window.location.origin}/${activity.slug}/${emp.slug}--${emp.token}`}
                  </div>
                </div>
                {!emp.is_owner && (
                  <Button variant="outline" size="sm" onClick={() => void toggleActive(emp, !active)}>
                    {active ? 'Disattiva' : 'Attiva'}
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyLink(emp)} title="Copia link">
                  <Copy className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild title="Apri link">
                  <a href={`/${activity.slug}/${emp.slug}--${emp.token}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => {
                    setEditEmployee(emp);
                    setEmpDialogOpen(true);
                  }}
                >
                  <LinkIcon className="w-4 h-4" />
                </Button>
              </div>
            );
          })
        )}
      </div>

      <EmployeeDialog
        open={empDialogOpen}
        onClose={() => setEmpDialogOpen(false)}
        employee={editEmployee}
        activityId={activity.id}
        activity={activity}
        services={services}
        employeeServices={employeeServices}
        onSaved={() => {
          void refetchEmployees();
          void refetchES();
          queryClient.invalidateQueries({ queryKey: ['employees'] });
        }}
      />
    </div>
  );
}

function EmployeeDialog({
  open,
  onClose,
  employee,
  activityId,
  activity,
  services,
  employeeServices,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  employee: Employee | null;
  activityId: string;
  activity: NonNullable<ReturnType<typeof useAuth>['activity']>;
  services: Service[];
  employeeServices: EmployeeService[];
  onSaved: () => void;
}) {
  const [empName, setEmpName] = useState('');
  const [empSurname, setEmpSurname] = useState('');
  const [empRole, setEmpRole] = useState('dipendente');
  const [empColor, setEmpColor] = useState('#3b82f6');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmpName(employee?.name || '');
    setEmpSurname(employee?.surname || '');
    setEmpRole(employee?.role || 'dipendente');
    setEmpColor(employee?.color || '#3b82f6');
    if (employee) {
      setSelectedServiceIds(employeeServices.filter((es) => es.employee_id === employee.id).map((es) => es.service_id));
    } else {
      setSelectedServiceIds([]);
    }
  }, [open, employee?.id, employee, employeeServices]);

  const toggleService = (sId: string) => {
    setSelectedServiceIds((prev) => (prev.includes(sId) ? prev.filter((x) => x !== sId) : [...prev, sId]));
  };

  const save = async () => {
    if (!empName.trim() || !empSurname.trim()) {
      toast.error('Nome e cognome obbligatori');
      return;
    }
    setLoading(true);
    try {
      let empId = employee?.id;
      if (employee?.is_owner) {
        const { error } = await supabase.from('employees').update({ color: empColor }).eq('id', employee.id);
        if (error) throw error;
        empId = employee.id;
      } else if (employee) {
        const { error } = await supabase
          .from('employees')
          .update({
            name: empName.trim(),
            surname: empSurname.trim(),
            slug: makeSlug(empName, empSurname),
            role: empRole,
            color: empColor,
          })
          .eq('id', employee.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('employees')
          .insert({
            activity_id: activityId,
            name: empName.trim(),
            surname: empSurname.trim(),
            slug: makeSlug(empName, empSurname),
            token: generateToken(),
            role: empRole,
            color: empColor,
            is_owner: false,
            is_active: true,
          })
          .select('id')
          .single();
        if (error) throw error;
        empId = data.id;
      }

      if (empId) {
        await supabase.from('employee_services').delete().eq('employee_id', empId);
        if (selectedServiceIds.length > 0) {
          await supabase
            .from('employee_services')
            .insert(selectedServiceIds.map((sId) => ({ employee_id: empId!, service_id: sId })));
        }
      }

      toast.success(employee ? 'Salvato' : 'Dipendente aggiunto');
      onSaved();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Errore';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const deleteEmp = async () => {
    if (!employee || employee.is_owner) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('employees').delete().eq('id', employee.id);
      if (error) throw error;
      toast.success('Dipendente eliminato');
      onSaved();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Errore';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const rotateToken = async () => {
    if (!employee) return;
    setLoading(true);
    try {
      const newTok = generateToken();
      const { error } = await supabase.from('employees').update({ token: newTok }).eq('id', employee.id);
      if (error) throw error;
      toast.success('Nuovo link generato: aggiorna i segnalibri condivisi.');
      onSaved();
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
          <DialogTitle>{employee ? 'Modifica dipendente' : 'Nuovo dipendente'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nome *</Label>
              <Input value={empName} onChange={(e) => setEmpName(e.target.value)} placeholder="Marco" readOnly={!!employee?.is_owner} />
            </div>
            <div>
              <Label>Cognome *</Label>
              <Input value={empSurname} onChange={(e) => setEmpSurname(e.target.value)} placeholder="Rossi" readOnly={!!employee?.is_owner} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Ruolo</Label>
              <Input value={empRole} onChange={(e) => setEmpRole(e.target.value)} placeholder="Barbiere" readOnly={!!employee?.is_owner} />
            </div>
            <div>
              <Label>Colore</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={empColor}
                  onChange={(e) => setEmpColor(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border-0"
                />
                <span className="text-sm text-muted-foreground">{empColor}</span>
              </div>
            </div>
          </div>
          {employee?.is_owner && (
            <p className="text-xs text-muted-foreground">
              Nome e ruolo del titolare sono nelle impostazioni. Qui puoi impostare colore agenda, servizi che esegui e il link personale.
            </p>
          )}
          {services.length > 0 && (
            <div>
              <Label className="mb-2 block">Servizi abilitati</Label>
              <div className="flex flex-wrap gap-2">
                {services.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleService(s.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedServiceIds.includes(s.id) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {employee && activity.host_works_in_salon && (
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => void rotateToken()}>
              Rigenera token / link calendario
            </Button>
          )}
          <div className="flex gap-2">
            {employee && !employee.is_owner && (
              <Button variant="destructive" onClick={() => void deleteEmp()} disabled={loading}>
                Elimina
              </Button>
            )}
            <Button variant="hero" onClick={() => void save()} disabled={loading} className="flex-1">
              {loading ? 'Salvataggio...' : employee ? 'Salva' : 'Aggiungi'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
