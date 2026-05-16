import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY");
    const APP_URL = Deno.env.get("APP_URL") || "https://schedio-five.vercel.app";

    if (!RESEND_API_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const now = new Date();
    const from = new Date(now.getTime() + 23 * 60 * 60 * 1000).toISOString();
    const to = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();

    console.log("Searching sessions between:", from, "and", to);

    const { data: sessions, error: sessErr } = await supabase
      .from('sessions')
      .select('*, client:clients(name, surname, email), activity:activities(owner_name, name)')
      .eq('status', 'confermata')
      .eq('reminder_sent', false)
      .gte('scheduled_at', from)
      .lte('scheduled_at', to);

    if (sessErr) throw sessErr;
    
    console.log("Sessions found:", sessions?.length ?? 0);

    if (!sessions || sessions.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    for (const session of sessions) {
      const client = session.client;
      const activity = session.activity;
      
      console.log("Processing session for client:", client?.email);
      
      if (!client?.email) continue;

      const sessionDate = new Date(session.scheduled_at);
      const formattedDate = sessionDate.toLocaleDateString('it-IT', {
        weekday: 'long', day: 'numeric', month: 'long'
      });
      const formattedTime = sessionDate.toLocaleTimeString('it-IT', {
        hour: '2-digit', minute: '2-digit'
      });

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Schedio <onboarding@resend.dev>",
          to: [client.email],
          subject: `⏰ Promemoria: sessione domani con ${activity?.owner_name ?? 'il tuo trainer'}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 40px 20px;">
              <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
                <div style="background: linear-gradient(135deg, #059669, #10b981); padding: 32px; text-align: center;">
                  <div style="font-size: 28px; font-weight: 800; color: white;">💪 Schedio</div>
                  <div style="color: rgba(255,255,255,0.85); font-size: 14px; margin-top: 4px;">Promemoria sessione</div>
                </div>
                <div style="padding: 32px;">
                  <h2 style="margin: 0 0 12px; font-size: 22px; font-weight: 700; color: #111827;">
                    Ciao ${client.name}! 👋
                  </h2>
                  <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
                    Ti ricordiamo che domani hai una sessione con 
                    <strong>${activity?.owner_name ?? 'il tuo trainer'}</strong>:
                  </p>
                  <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
                    <div style="font-size: 32px; margin-bottom: 8px;">📅</div>
                    <div style="font-size: 18px; font-weight: 700; color: #059669;">${formattedDate}</div>
                    <div style="font-size: 24px; font-weight: 800; color: #111827; margin-top: 4px;">${formattedTime}</div>
                  </div>
                  <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
                    Preparati al meglio: dormi bene, idratati e arriva puntuale. 
                    Ci vediamo domani! 💪
                  </p>
                  <div style="text-align: center; margin-top: 24px;">
                    <a href="${APP_URL}" style="display: inline-block; background: #059669; color: white; font-size: 15px; font-weight: 700; padding: 12px 28px; border-radius: 10px; text-decoration: none;">
                      Apri Schedio →
                    </a>
                  </div>
                </div>
                <div style="padding: 20px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                    Hai ricevuto questa email perché hai una sessione programmata su Schedio.
                  </p>
                </div>
              </div>
            </body>
            </html>
          `,
        }),
      });

      const resData = await res.json();
      console.log("Resend response:", res.status, JSON.stringify(resData));

      if (res.ok) {
        await supabase.from('sessions').update({ reminder_sent: true }).eq('id', session.id);
        sent++;
      } else {
        console.error("Resend error:", JSON.stringify(resData));
      }
    }

    return new Response(JSON.stringify({ success: true, sent }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("ERROR:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
