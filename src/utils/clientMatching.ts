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
      await supabase.from('clients').update({
        ...(phone ? { phone } : {}),
        ...(name ? { name } : {}),
      }).eq('id', data.id);
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
      await supabase.from('clients').update({
        ...(email ? { email } : {}),
        ...(name ? { name } : {}),
      }).eq('id', data.id);
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
      await supabase.from('clients').update({
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
      }).eq('id', data.id);
      return data.id;
    }
  }

  // No match → create new client
  const { data: newClient, error } = await supabase
    .from('clients')
    .insert({
      activity_id: activityId,
      name: name.trim(),
      phone: phone || null,
      email: email || null,
      objective: input.objective || null,
      level: input.level || null,
      frequency: input.frequency || null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return newClient.id;
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
