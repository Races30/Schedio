import { supabase } from '@/integrations/supabase/client';

interface ClientMatchInput {
  activityId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  objective?: string | null;
  level?: string | null;
  frequency?: string | null;
}

/**
 * Find an existing client by email > phone > name, or create a new one.
 * Returns the client id.
 */
export async function findOrCreateClient(input: ClientMatchInput): Promise<string> {
  const { activityId, name, phone, email } = input;

  // Priority 1: match by email
  if (email) {
    const { data } = await supabase
      .from('clients')
      .select('id')
      .eq('activity_id', activityId)
      .eq('email', email)
      .limit(1)
      .maybeSingle();
    if (data) {
      // Update missing fields
      const updates: Record<string, string> = {};
      if (phone) updates.phone = phone;
      if (name) updates.name = name;
      if (Object.keys(updates).length > 0) {
        await supabase.from('clients').update(updates).eq('id', data.id);
      }
      return data.id;
    }
  }

  // Priority 2: match by phone
  if (phone) {
    const { data } = await supabase
      .from('clients')
      .select('id')
      .eq('activity_id', activityId)
      .eq('phone', phone)
      .limit(1)
      .maybeSingle();
    if (data) {
      const updates: Record<string, string> = {};
      if (email) updates.email = email;
      if (name) updates.name = name;
      if (Object.keys(updates).length > 0) {
        await supabase.from('clients').update(updates).eq('id', data.id);
      }
      return data.id;
    }
  }

  // Priority 3: match by name (exact, case-insensitive)
  {
    const { data } = await supabase
      .from('clients')
      .select('id')
      .eq('activity_id', activityId)
      .ilike('name', name.trim())
      .limit(1)
      .maybeSingle();
    if (data) {
      const updates: Record<string, string> = {};
      if (email) updates.email = email;
      if (phone) updates.phone = phone;
      if (Object.keys(updates).length > 0) {
        await supabase.from('clients').update(updates).eq('id', data.id);
      }
      return data.id;
    }
  }

  // No match → create new client
  const insertPayload: Record<string, unknown> = {
    activity_id: activityId,
    name: name.trim(),
    phone: phone || null,
    email: email || null,
  };
  if (input.objective) insertPayload.objective = input.objective;
  if (input.level) insertPayload.level = input.level;
  if (input.frequency) insertPayload.frequency = input.frequency;

  const { data: newClient, error } = await supabase
    .from('clients')
    .insert(insertPayload)
    .select('id')
    .single();

  if (error) throw error;
  return newClient.id;
}

/**
 * Find the most recent active package for a client.
 * Returns { id, total_sessions, used_sessions } or null.
 */
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

/**
 * Decrement a session from a package when appointment is completed.
 * Marks package as 'completed' if sessions are exhausted.
 */
export async function decrementPackageSession(packageId: string) {
  // Fetch current state
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
