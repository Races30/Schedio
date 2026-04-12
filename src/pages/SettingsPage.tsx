import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Save, Plus, Trash2, ExternalLink, Copy, Link as LinkIcon } from 'lucide-react';
import { Service, Employee, EmployeeService } from '@/types';

const DAYS = [
  { value: 1, label: 'Lunedì' }, { value: 2, label: 'Martedì' }, { value: 3, label: 'Mercoledì' },
  { value: 4, label: 'Giovedì' }, { value: 5, label: 'Venerdì' }, { value: 6, label: 'Sabato' }, { value: 0, label: 'Domenica' },
];

const generateToken = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 20; i++) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
};

export default function SettingsPage() {
  const { activity, refreshActivity } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [openingDays, setOpeningDays] = useState<number[]>([]);
  const [openStart, setOpenStart] = useState('09:00');
  const [openEnd, setOpenEnd] = useState('19:00');
  const [themeColor, setThemeColor] = useState('#3b82f6');
  const [defaultDuration, setDefaultDuration] = useState(30);
  const [bufferMinutes, setBufferMinutes] = useState(5);

  useEffect(() => {
    if (activity) {
      setName(activity.name);
      setOwnerName(activity.owner_name);
      setOpeningDays(activity.opening_days);
      setOpenStart(activity.opening_hours.start);
      setOpenEnd(activity.opening_hours.end);
      setThemeColor(activity.theme_color);
      setDefaultDuration(activity.default_appointment_duration_minutes);
      setBufferMinutes(activity.buffer_minutes);
    }
  }, [activity]);

  const { data: services = [], refetch: refetchServices } = useQuery({
    queryKey: ['services', activity?.id],
    queryFn: async () => {
      const { data } = await supabase.from('services').select('*').eq('activity_id', activity!.id).order('name');
      return (data || []) as Service[];
    },
    enabled: !!activity,
  });

  const { data: employees = [], refetch: refetchEmployees } = useQuery({
    queryKey: ['employees', activity?.id],
    queryFn: async () => {
      const { data } = await supabase.from('employees').select('*').eq('activity_id', activity!.id).order('is_owner', { ascending: false }).order('name');
      return (data || []) as Employee[];
    },
    enabled: !!activity,
  });

  const { data: employeeServices = [], refetch: refetchES } = useQuery({
    queryKey: ['employee-services', activity?.id],
    queryFn: async () => {
      const empIds = employees.map(e => e.id);
      if (empIds.length === 0) return [];
      const { data } = await supabase.from('employee_services').select('*').in('employee_id', empIds);
      return (data || []) as EmployeeService[];
    },
    enabled: employees.length > 0,
  });

  const toggleDay = (d: number) => {
    setOpeningDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const saveSettings = async () => {
    if (!activity) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('activities').update({
        name,
        owner_name: ownerName,
        opening_days: openingDays,
        opening_hours: { start: openStart, end: openEnd },
        theme_color: themeColor,
        default_appointment_duration_minutes: defaultDuration,
        buffer_minutes: bufferMinutes,
      }).eq('id', activity.id);
      if (error) throw error;
      await refreshActivity();
      toast.success('Impostazioni salvate');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Employee dialog
  const [empDialogOpen, setEmpDialogOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);

  if (!activity) return null;

  const copyLink = (emp: Employee) => {
    const url = `${window.location.origin}/${activity.slug}/${emp.slug}--${emp.token}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiato!');
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">Impostazioni</h1>

      <div className="space-y-8">
        {/* General */}
        <section className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Informazioni salone</h2>
          <div className="grid gap-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div><Label>Nome salone</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
              <div><Label>Nome titolare</Label><Input value={ownerName} onChange={e => setOwnerName(e.target.value)} /></div>
            </div>
            <div>
              <Label>Link prenotazione pubblica</Label>
              <div className="flex items-center gap-2">
                <Input value={`${window.location.origin}/${activity.slug}`} readOnly className="text-muted-foreground" />
                <Button variant="outline" size="icon" asChild>
                  <a href={`/${activity.slug}`} target="_blank"><ExternalLink className="w-4 h-4" /></a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Schedule */}
        <section className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Orari di apertura</h2>
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Giorni di apertura</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map(d => (
                  <button key={d.value} onClick={() => toggleDay(d.value)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${openingDays.includes(d.value) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Apertura</Label><Input type="time" value={openStart} onChange={e => setOpenStart(e.target.value)} /></div>
              <div><Label>Chiusura</Label><Input type="time" value={openEnd} onChange={e => setOpenEnd(e.target.value)} /></div>
            </div>
          </div>
        </section>

        {/* Preferences */}
        <section className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Preferenze</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <Label>Durata media (min)</Label>
              <Input type="number" value={defaultDuration} onChange={e => setDefaultDuration(Number(e.target.value))} min={5} max={240} step={5} />
            </div>
            <div>
              <Label>Buffer tra app. (min)</Label>
              <Input type="number" value={bufferMinutes} onChange={e => setBufferMinutes(Number(e.target.value))} min={0} max={60} step={5} />
            </div>
            <div>
              <Label>Colore tema</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={themeColor} onChange={e => setThemeColor(e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer border-0" />
                <span className="text-sm text-muted-foreground">{themeColor}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Services */}
        <section className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Servizi</h2>
            <ServiceAddButton activityId={activity.id} onAdded={() => refetchServices()} />
          </div>
          {services.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nessun servizio configurato</p>
          ) : (
            <div className="space-y-2">
              {services.map(s => <ServiceRow key={s.id} service={s} onUpdated={() => refetchServices()} />)}
            </div>
          )}
        </section>

        {/* Employees */}
        <section className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Dipendenti</h2>
            <Button variant="outline" size="sm" onClick={() => { setEditEmployee(null); setEmpDialogOpen(true); }}>
              <Plus className="w-4 h-4" /> Aggiungi
            </Button>
          </div>
          {employees.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nessun dipendente</p>
          ) : (
            <div className="space-y-3">
              {employees.map(emp => {
                const empSvcIds = employeeServices.filter(es => es.employee_id === emp.id).map(es => es.service_id);
                const empSvcNames = services.filter(s => empSvcIds.includes(s.id)).map(s => s.name);
                return (
                  <div key={emp.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-3 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: emp.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{emp.name} {emp.surname} {emp.is_owner && <span className="text-xs text-primary">(Titolare)</span>}</div>
                      <div className="text-xs text-muted-foreground">{emp.role} {empSvcNames.length > 0 && `• ${empSvcNames.join(', ')}`}</div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyLink(emp)} title="Copia link privato">
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditEmployee(emp); setEmpDialogOpen(true); }}>
                      <LinkIcon className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <Button variant="hero" onClick={saveSettings} disabled={loading} className="w-full">
          <Save className="w-4 h-4" /> {loading ? 'Salvataggio...' : 'Salva impostazioni'}
        </Button>
      </div>

      <EmployeeDialog
        open={empDialogOpen}
        onClose={() => setEmpDialogOpen(false)}
        employee={editEmployee}
        activityId={activity.id}
        services={services}
        employeeServices={employeeServices}
        onSaved={() => { refetchEmployees(); refetchES(); }}
      />
    </div>
  );
}

// --- Sub-components ---

function ServiceAddButton({ activityId, onAdded }: { activityId: string; onAdded: () => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState(30);
  const [price, setPrice] = useState('');
  const [color, setColor] = useState('#3b82f6');

  const save = async () => {
    if (!name.trim()) return;
    await supabase.from('services').insert({ activity_id: activityId, name: name.trim(), duration_minutes: duration, price: price ? parseFloat(price) : null, color });
    setName(''); setPrice(''); setDuration(30); setAdding(false);
    onAdded();
    toast.success('Servizio aggiunto');
  };

  if (!adding) return <Button variant="outline" size="sm" onClick={() => setAdding(true)}><Plus className="w-4 h-4" /> Aggiungi</Button>;

  return (
    <div className="flex flex-wrap items-end gap-2 bg-muted/50 p-3 rounded-lg w-full">
      <div className="flex-1 min-w-[120px]"><Label className="text-xs">Nome</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="es. Taglio" className="h-8" /></div>
      <div className="w-20"><Label className="text-xs">Durata</Label><Input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} className="h-8" min={5} step={5} /></div>
      <div className="w-20"><Label className="text-xs">Prezzo €</Label><Input value={price} onChange={e => setPrice(e.target.value)} placeholder="0" className="h-8" /></div>
      <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
      <Button size="sm" onClick={save} className="h-8">Salva</Button>
      <Button size="sm" variant="ghost" onClick={() => setAdding(false)} className="h-8">Annulla</Button>
    </div>
  );
}

function ServiceRow({ service, onUpdated }: { service: Service; onUpdated: () => void }) {
  const deleteService = async () => {
    await supabase.from('services').delete().eq('id', service.id);
    onUpdated();
    toast.success('Servizio eliminato');
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: service.color }} />
      <div className="flex-1 min-w-0">
        <span className="font-medium text-sm">{service.name}</span>
        <span className="text-xs text-muted-foreground ml-2">{service.duration_minutes} min</span>
        {service.price && <span className="text-xs text-muted-foreground ml-2">€{service.price}</span>}
      </div>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={deleteService}>
        <Trash2 className="w-4 h-4 text-destructive" />
      </Button>
    </div>
  );
}

function EmployeeDialog({ open, onClose, employee, activityId, services, employeeServices, onSaved }: {
  open: boolean; onClose: () => void; employee: Employee | null; activityId: string;
  services: Service[]; employeeServices: EmployeeService[]; onSaved: () => void;
}) {
  const [empName, setEmpName] = useState(employee?.name || '');
  const [empSurname, setEmpSurname] = useState(employee?.surname || '');
  const [empRole, setEmpRole] = useState(employee?.role || 'dipendente');
  const [empColor, setEmpColor] = useState(employee?.color || '#3b82f6');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useState(() => {
    setEmpName(employee?.name || '');
    setEmpSurname(employee?.surname || '');
    setEmpRole(employee?.role || 'dipendente');
    setEmpColor(employee?.color || '#3b82f6');
    if (employee) {
      setSelectedServiceIds(employeeServices.filter(es => es.employee_id === employee.id).map(es => es.service_id));
    } else {
      setSelectedServiceIds([]);
    }
  });

  const toggleService = (sId: string) => {
    setSelectedServiceIds(prev => prev.includes(sId) ? prev.filter(x => x !== sId) : [...prev, sId]);
  };

  const makeSlug = (n: string, s: string) => `${n}-${s}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const save = async () => {
    if (!empName.trim() || !empSurname.trim()) { toast.error('Nome e cognome obbligatori'); return; }
    setLoading(true);
    try {
      let empId = employee?.id;
      if (employee) {
        await supabase.from('employees').update({
          name: empName.trim(),
          surname: empSurname.trim(),
          slug: makeSlug(empName, empSurname),
          role: empRole,
          color: empColor,
        }).eq('id', employee.id);
      } else {
        const { data, error } = await supabase.from('employees').insert({
          activity_id: activityId,
          name: empName.trim(),
          surname: empSurname.trim(),
          slug: makeSlug(empName, empSurname),
          token: generateToken(),
          role: empRole,
          color: empColor,
          is_owner: false,
        }).select('id').single();
        if (error) throw error;
        empId = data.id;
      }

      // Sync employee_services
      if (empId) {
        await supabase.from('employee_services').delete().eq('employee_id', empId);
        if (selectedServiceIds.length > 0) {
          await supabase.from('employee_services').insert(
            selectedServiceIds.map(sId => ({ employee_id: empId!, service_id: sId }))
          );
        }
      }

      toast.success(employee ? 'Dipendente aggiornato' : 'Dipendente aggiunto');
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteEmp = async () => {
    if (!employee || employee.is_owner) return;
    setLoading(true);
    try {
      await supabase.from('employees').delete().eq('id', employee.id);
      toast.success('Dipendente eliminato');
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{employee ? 'Modifica dipendente' : 'Nuovo dipendente'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Nome *</Label><Input value={empName} onChange={e => setEmpName(e.target.value)} placeholder="Marco" /></div>
            <div><Label>Cognome *</Label><Input value={empSurname} onChange={e => setEmpSurname(e.target.value)} placeholder="Rossi" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Ruolo</Label><Input value={empRole} onChange={e => setEmpRole(e.target.value)} placeholder="Barbiere" /></div>
            <div>
              <Label>Colore</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={empColor} onChange={e => setEmpColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0" />
                <span className="text-sm text-muted-foreground">{empColor}</span>
              </div>
            </div>
          </div>
          {services.length > 0 && (
            <div>
              <Label className="mb-2 block">Servizi assegnati</Label>
              <div className="flex flex-wrap gap-2">
                {services.map(s => (
                  <button key={s.id} onClick={() => toggleService(s.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedServiceIds.includes(s.id) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            {employee && !employee.is_owner && <Button variant="destructive" onClick={deleteEmp} disabled={loading}>Elimina</Button>}
            <Button variant="hero" onClick={save} disabled={loading} className="flex-1">
              {loading ? 'Salvataggio...' : employee ? 'Aggiorna' : 'Aggiungi'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
