import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRecord {
  id: string;
  activity_id: string;
  client_id: string;
  type: string;
  channel: string;
  title: string;
  message: string;
  scheduled_for: string | null;
  sent_at: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const payload = await req.json();
    
    // We can be triggered by a Webhook (payload.record) or manually for scheduled reminders (payload.notification_id)
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

    // Skip if already sent
    if (notification.sent_at) {
      return new Response(JSON.stringify({ skipped: "Already sent" }), { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Skip if only internal
    if (notification.channel !== 'email') {
      return new Response(JSON.stringify({ skipped: "Not an email notification" }), { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Determine recipient
    let toEmail: string | null = null;
    if (notification.type === 'new_booking_owner') {
      // Get owner email from auth.users (requires service role)
      const { data: ownerData, error: ownerError } = await supabase.auth.admin.getUserById(notification.activities.user_id);
      if (ownerError) throw new Error(`Could not fetch owner email: ${ownerError.message}`);
      toEmail = ownerData.user?.email || null;
    } else {
      toEmail = notification.clients?.email || null;
    }

    if (!toEmail) {
      throw new Error("Recipient email not found");
    }

    // Send via Resend
    console.log(`Sending email to ${toEmail} for notification ${notification.id}`);
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
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #6366f1;">Schedio</h2>
            <p>${notification.message.replace(/\n/g, '<br>')}</p>
            <hr style="border: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #666;">Hai ricevuto questa comunicazione automatica da Schedio per conto di ${notification.activities.name}.</p>
          </div>
        `,
      }),
    });

    const resData = await res.json();
    if (!res.ok) {
      throw new Error(`Resend API error: ${JSON.stringify(resData)}`);
    }

    // Mark as sent
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', notification.id);

    if (updateError) {
      console.error(`Failed to update notification status: ${updateError.message}`);
    }

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
