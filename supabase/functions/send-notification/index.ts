import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRecord {
  id: string;
  activity_id: string;
  client_id: string | null;
  type: string;
  channel: string;
  title: string;
  message: string;
  scheduled_for: string | null;
  sent_at: string | null;
}

// Types that go to the trainer/owner (not the client)
const TRAINER_NOTIFICATION_TYPES = new Set([
  'new_booking_owner',
  'invite_accepted',
  'session_confirmed',
  'session_rescheduled',
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY");

    if (!RESEND_API_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables: " + 
        JSON.stringify({
          hasResend: !!RESEND_API_KEY,
          hasUrl: !!SUPABASE_URL, 
          hasKey: !!SERVICE_ROLE_KEY
        }));
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const payload = await req.json();
    
    // Triggered by Supabase Webhook (payload.record) or manually (payload.notification_id)
    let notificationId = payload.notification_id;
    if (payload.record) {
      notificationId = payload.record.id;
    }

    if (!notificationId) {
      return new Response(JSON.stringify({ error: "No notification ID provided" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Fetch notification details
    const { data: notification, error: fetchError } = await supabase
      .from('notifications')
      .select('*, clients(*), activities(*)')
      .eq('id', notificationId)
      .single();

    if (fetchError || !notification) {
      throw new Error(`Notification not found: ${fetchError?.message}`);
    }

    // Skip if already sent (anti-dup)
    if (notification.sent_at) {
      return new Response(JSON.stringify({ skipped: "Already sent" }), { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Only process email channel
    if (notification.channel !== 'email') {
      return new Response(JSON.stringify({ skipped: "Not an email notification" }), { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Determine recipient email
    let toEmail: string | null = null;

    if (TRAINER_NOTIFICATION_TYPES.has(notification.type)) {
      // Send to the trainer/owner
      const { data: ownerData, error: ownerError } = await supabase.auth.admin.getUserById(
        notification.activities.user_id
      );
      if (ownerError) throw new Error(`Could not fetch owner email: ${ownerError.message}`);
      toEmail = ownerData.user?.email || null;
    } else {
      // Send to the client
      toEmail = notification.clients?.email || null;
    }

    if (!toEmail) {
      console.warn(`No recipient email found for notification ${notification.id} (type: ${notification.type})`);
      return new Response(JSON.stringify({ skipped: "No recipient email" }), { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Build email HTML
    const activityName = notification.activities?.name || 'Schedio';
    const isTrainerNotification = TRAINER_NOTIFICATION_TYPES.has(notification.type);
    const headerColor = isTrainerNotification ? '#6366f1' : '#059669';
    const headerEmoji = isTrainerNotification ? '🏋️' : '💪';

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 40px 20px;">
        <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
          
          <div style="background: ${headerColor}; padding: 24px 32px; text-align: center;">
            <div style="font-size: 24px; font-weight: 800; color: white;">${headerEmoji} ${activityName}</div>
          </div>

          <div style="padding: 32px;">
            <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #111827;">${notification.title}</h2>
            <p style="margin: 0 0 24px; color: #4b5563; font-size: 15px; line-height: 1.7;">
              ${notification.message.replace(/\n/g, '<br>')}
            </p>
          </div>

          <div style="padding: 16px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #9ca3af;">
              Comunicazione automatica da Schedio per conto di ${activityName}.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send via Resend
    console.log(`Sending ${notification.type} email to ${toEmail} for notification ${notification.id}`);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Schedio <onboarding@resend.dev>",
        to: [toEmail],
        subject: notification.title,
        html: emailHtml,
      }),
    });

    const resData = await res.json();
    if (!res.ok) {
      throw new Error(`Resend API error: ${JSON.stringify(resData)}`);
    }

    // Mark as sent
    await supabase
      .from('notifications')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', notification.id);

    return new Response(JSON.stringify({ success: true, resendId: resData.id }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error) {
    console.error("Function error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
