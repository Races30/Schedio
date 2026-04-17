import { supabase } from '@/integrations/supabase/client';

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

  const findByEmail = async () => {
    if (!email) return null;
    const { data } = await supabase
      .from('clients')
      .select('id, name, phone, email, first_name, last_name, notes, important_notes')
      .eq('activity_id', activityId)
      .eq('email_normalized', email)
      .limit(1)
      .maybeSingle();
    return data;
  };

  const findByPhone = async () => {
    if (!phone) return null;
    const { data } = await supabase
      .from('clients')
      .select('id, name, phone, email, first_name, last_name, notes, important_notes')
      .eq('activity_id', activityId)
      .eq('phone_normalized', phone)
      .limit(1)
      .maybeSingle();
    return data;
  };

  const findByName = async () => {
    if (!fullNameNormalized) return null;
    const { data } = await supabase
      .from('clients')
      .select('id, name, phone, email, first_name, last_name, notes, important_notes')
      .eq('activity_id', activityId)
      .eq('full_name_normalized', fullNameNormalized)
      .limit(2);
    if (!data || data.length !== 1) return null;
    return data[0];
  };

  const mergeClient = async (clientId: string, existing?: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    notes?: string | null;
    important_notes?: string | null;
  }) => {
    const updatePayload = {
      name: fillIfMissing(existing?.name, fullName),
      first_name: fillIfMissing(existing?.first_name, firstName),
      last_name: fillIfMissing(existing?.last_name, lastName),
      email: fillIfMissing(existing?.email, email),
      email_normalized: fillIfMissing(existing?.email, email),
      phone: fillIfMissing(existing?.phone, phone),
      phone_normalized: fillIfMissing(existing?.phone, phone),
      full_name_normalized: fullNameNormalized || undefined,
      notes: fillIfMissing(existing?.notes, notes || undefined),
      important_notes: fillIfMissing(existing?.important_notes, importantNotes || undefined),
      objective: objective || undefined,
      level: level || undefined,
      frequency: frequency || undefined,
      training_frequency: frequency || undefined,
    };

    await supabase.from('clients').update(updatePayload).eq('id', clientId);
    return clientId;
  };

  // Priority 1: match by normalized email
  if (email) {
    const data = await findByEmail();
    if (data) {
      return mergeClient(data.id, data);
    }
  }

  // Priority 2: match by normalized phone
  if (phone) {
    const data = await findByPhone();
    if (data) {
      return mergeClient(data.id, data);
    }
  }

  // Priority 3: fallback by normalized full name (only if unambiguous)
  if (fullNameNormalized) {
    const data = await findByName();
    if (data) {
      return mergeClient(data.id, data);
    }
  }

  // No match → create new client
  const { data: newClient, error } = await supabase
    .from('clients')
    .insert({
      activity_id: activityId,
      name: fullName,
      first_name: firstName,
      last_name: lastName,
      full_name_normalized: fullNameNormalized,
      phone: phone || null,
      phone_normalized: phone || null,
      email: email || null,
      email_normalized: email || null,
      objective: objective || null,
      level: level || null,
      frequency: frequency || null,
      training_frequency: frequency || null,
      notes: notes || null,
      important_notes: importantNotes || null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return newClient.id;
}

export async function refreshClientMetrics(clientId: string) {
  await supabase.rpc('recompute_client_metrics', { p_client_id: clientId });
}

export async function findActivePackage(clientId: string, activityId: string) {
  const { data } = await supabase
    .from('packages')
    .select('id, total_sessions, used_sessions')
    .eq('client_id', clientId)
    .eq('activity_id', activityId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function decrementPackageSession(packageId: string) {
  const { data: pkg } = await supabase
    .from('packages')
    .select('used_sessions, total_sessions')
    .eq('id', packageId)
    .single();

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
