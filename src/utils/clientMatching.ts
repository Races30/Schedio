import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type ClientRow = Database['public']['Tables']['clients']['Row'];
type ClientUpdate = Database['public']['Tables']['clients']['Update'];
type ClientInsert = Database['public']['Tables']['clients']['Insert'];

interface ClientMatchInput {
  activityId: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  objective?: string | null;
  level?: string | null;
  frequency?: string | null;
  notes?: string | null;
  importantNotes?: string | null;
}

function normalizeEmail(email?: string | null): string | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  return normalized || null;
}

function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const normalized = phone.trim().replace(/[^\d+]/g, '');
  return normalized || null;
}

function normalizeName(name?: string | null): string | null {
  if (!name) return null;
  return name.trim().replace(/\s+/g, ' ').toLowerCase() || null;
}

function splitName(name: string): { firstName: string; lastName: string | null } {
  const clean = name.trim().replace(/\s+/g, ' ');
  const [first, ...rest] = clean.split(' ');
  return {
    firstName: first,
    lastName: rest.length ? rest.join(' ') : null,
  };
}

function fillIfMissing(current?: string | null, incoming?: string | null): string | undefined {
  if (!incoming) return undefined;
  if (!current || !current.trim()) return incoming;
  return undefined;
}

export async function findOrCreateClient(input: ClientMatchInput): Promise<string> {
  const { activityId, name, objective, level, frequency, notes, importantNotes } = input;
  const parsedName = splitName(name);
  const firstName = input.firstName?.trim() || parsedName.firstName;
  const lastName = input.lastName?.trim() || parsedName.lastName;
  const fullName = `${firstName}${lastName ? ` ${lastName}` : ''}`.trim();

  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const fullNameNormalized = normalizeName(fullName);

  // Helper to fetch client with fallback for missing columns
  // We use 'as any' to wrap the supabase query builder because the complex 
  // column selection logic triggers "Type instantiation is excessively deep" errors.
  const getClientSafely = async (filterCol: string, filterVal: string): Promise<Partial<ClientRow> | null> => {
    // 1. Try with all columns (Unified CRM)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const crmQuery = supabase.from('clients').select('id, name, phone, email, first_name, last_name, notes, important_notes, email_normalized, phone_normalized') as any;
    const crmResult = await crmQuery
      .eq('activity_id', activityId)
      .eq(filterCol, filterVal)
      .limit(1)
      .maybeSingle();

    if (crmResult.error && (crmResult.error.code === '42703' || crmResult.error.message?.includes('column'))) {
      // 2. Fallback to basic columns if CRM columns don't exist
      const fallbackCol = filterCol.replace('_normalized', '');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fallbackQuery = supabase.from('clients').select('id, name, phone, email, notes') as any;
      const fallbackResult = await fallbackQuery
        .eq('activity_id', activityId)
        .eq(fallbackCol, filterVal)
        .limit(1)
        .maybeSingle();
      return fallbackResult.data as Partial<ClientRow> | null;
    }
    return crmResult.data as Partial<ClientRow> | null;
  };

  const findByEmail = () => email ? getClientSafely('email_normalized', email) : Promise.resolve(null);
  const findByPhone = () => phone ? getClientSafely('phone_normalized', phone) : Promise.resolve(null);

  const findByName = async (): Promise<Partial<ClientRow> | null> => {
    if (!fullNameNormalized) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const crmQuery = supabase.from('clients').select('id, name, phone, email, first_name, last_name, notes, important_notes, full_name_normalized') as any;
    const crmResult = await crmQuery
      .eq('activity_id', activityId)
      .eq('full_name_normalized', fullNameNormalized)
      .limit(2);

    if (crmResult.error && (crmResult.error.code === '42703' || crmResult.error.message?.includes('column'))) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fallbackQuery = supabase.from('clients').select('id, name, phone, email, notes') as any;
      const fallbackResult = await fallbackQuery
        .eq('activity_id', activityId)
        .eq('name', fullName)
        .limit(2);
      
      if (!fallbackResult.data || fallbackResult.data.length !== 1) return null;
      return fallbackResult.data[0] as Partial<ClientRow>;
    }
    
    if (!crmResult.data || crmResult.data.length !== 1) return null;
    return crmResult.data[0] as Partial<ClientRow>;
  };

  const mergeClient = async (clientId: string, existing?: Partial<ClientRow>) => {
    const updatePayload: ClientUpdate = {
      name: fillIfMissing(existing?.name, fullName),
      email: fillIfMissing(existing?.email, email),
      phone: fillIfMissing(existing?.phone, phone),
      notes: fillIfMissing(existing?.notes, notes || undefined),
      objective: objective || undefined,
      level: level || undefined,
      frequency: frequency || undefined,
    };

    // Add CRM columns only if they appear to be supported in the schema
    const hasCRM = existing && ('email_normalized' in existing || 'first_name' in existing);
    if (hasCRM) {
      updatePayload.first_name = fillIfMissing(existing?.first_name, firstName);
      updatePayload.last_name = fillIfMissing(existing?.last_name, lastName);
      updatePayload.email_normalized = fillIfMissing(existing?.email_normalized, email);
      updatePayload.phone_normalized = fillIfMissing(existing?.phone_normalized, phone);
      updatePayload.full_name_normalized = fullNameNormalized || undefined;
      updatePayload.important_notes = fillIfMissing(existing?.important_notes, importantNotes || undefined);
      updatePayload.training_frequency = frequency || undefined;
    }

    const { error } = await supabase.from('clients').update(updatePayload).eq('id', clientId);
    
    // If update fails due to missing columns, retry with basic payload
    if (error && (error.code === '42703' || error.message?.includes('column'))) {
      const basicPayload: ClientUpdate = {
        name: updatePayload.name,
        email: updatePayload.email,
        phone: updatePayload.phone,
        notes: updatePayload.notes,
        objective: updatePayload.objective,
        level: updatePayload.level,
        frequency: updatePayload.frequency,
      };
      await supabase.from('clients').update(basicPayload).eq('id', clientId);
    }
    return clientId;
  };

  // Matching strategy
  let matchedClient = await findByEmail();
  if (!matchedClient) matchedClient = await findByPhone();
  if (!matchedClient) matchedClient = await findByName();

  if (matchedClient?.id) {
    return mergeClient(matchedClient.id, matchedClient);
  }

  // No match → create new client
  const baseInsert: ClientInsert = {
    activity_id: activityId,
    name: fullName,
    phone: phone || null,
    email: email || null,
    objective: objective || null,
    level: level || null,
    frequency: frequency || null,
    notes: notes || null,
  };

  const extendedInsert: ClientInsert = {
    ...baseInsert,
    first_name: firstName,
    last_name: lastName,
    full_name_normalized: fullNameNormalized,
    phone_normalized: phone || null,
    email_normalized: email || null,
    training_frequency: frequency || null,
    important_notes: importantNotes || null,
  };

  let insertRes = await supabase.from('clients').insert(extendedInsert).select('id').single();

  if (insertRes.error && (insertRes.error.code === '42703' || insertRes.error.message?.includes('column'))) {
    insertRes = await supabase.from('clients').insert(baseInsert).select('id').single();
  }

  if (insertRes.error) throw insertRes.error;
  return insertRes.data.id;
}

export async function refreshClientMetrics(clientId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (supabase.rpc as any)('recompute_client_metrics', { p_client_id: clientId });
  return result;
}

export async function findActivePackage(clientId: string, activityId: string) {
  const query = supabase
    .from('packages')
    .select('id, total_sessions, used_sessions')
    .eq('client_id', clientId)
    .eq('activity_id', activityId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .limit(1) as any;
    
  const { data } = await query.maybeSingle();
  return data;
}

export async function decrementPackageSession(packageId: string) {
  const { data: pkg } = await (supabase
    .from('packages')
    .select('used_sessions, total_sessions')
    .eq('id', packageId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .single() as any);

  if (!pkg) return;

  const newUsed = pkg.used_sessions + 1;
  const isExhausted = newUsed >= pkg.total_sessions;

  await supabase
    .from('packages')
    .update({
      used_sessions: newUsed,
      ...(isExhausted ? { status: 'completed' } : {}),
    })
    .eq('id', packageId);
}
