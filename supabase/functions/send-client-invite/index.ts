import { createClient } from "@supabase/supabase-js";

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
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set");
    }

    // APP_URL can be set in Supabase Edge Function secrets; fallback to production URL
    const APP_URL = Deno.env.get("APP_URL") || "https://schedio-five.vercel.app";

    const { email, clientName, trainerName, token } = await req.json();

    if (!email || !clientName || !trainerName || !token) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inviteLink = `${APP_URL}/setup-account?token=${token}`;

    console.log(`Sending invite email to ${email} for client ${clientName}`);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Schedio <onboarding@resend.dev>",
        to: [email],
        subject: `${trainerName} ti ha invitato su Schedio`,
        html: `
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"></head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 40px 20px;">
            <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
              
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #059669, #10b981); padding: 32px 32px 24px; text-align: center;">
                <div style="font-size: 28px; font-weight: 800; color: white; letter-spacing: -0.5px;">💪 Schedio</div>
                <div style="color: rgba(255,255,255,0.85); font-size: 14px; margin-top: 4px;">La tua piattaforma di allenamento</div>
              </div>

              <!-- Body -->
              <div style="padding: 32px;">
                <h2 style="margin: 0 0 12px; font-size: 22px; font-weight: 700; color: #111827;">
                  Ciao ${clientName}! 👋
                </h2>
                <p style="margin: 0 0 16px; color: #4b5563; font-size: 15px; line-height: 1.6;">
                  <strong>${trainerName}</strong> ti ha invitato su Schedio per seguire i tuoi allenamenti
                  e monitorare i tuoi progressi.
                </p>
                <p style="margin: 0 0 24px; color: #4b5563; font-size: 15px; line-height: 1.6;">
                  Clicca il bottone qui sotto per creare il tuo account gratuito:
                </p>

                <!-- CTA Button -->
                <div style="text-align: center; margin: 0 0 28px;">
                  <a href="${inviteLink}"
                     style="display: inline-block; background: #059669; color: white; font-size: 16px; font-weight: 700; padding: 14px 32px; border-radius: 10px; text-decoration: none;">
                    Crea il mio account →
                  </a>
                </div>

                <p style="margin: 0 0 24px; color: #4b5563; font-size: 15px; line-height: 1.6;">
                  Dopo aver creato il tuo account, per accedere in futuro vai su schedio-five.vercel.app,
                  clicca 'Accedi' e inserisci la tua email e password.
                </p>

                <!-- Features -->
                <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                  <p style="margin: 0 0 12px; font-size: 13px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">Con Schedio puoi:</p>
                  <div style="font-size: 14px; color: #4b5563; line-height: 2;">
                    📅 Vedere le tue sessioni programmate<br>
                    📈 Seguire i tuoi progressi nel tempo<br>
                    💪 Svolgere allenamenti autonomi<br>
                    🎯 Monitorare i tuoi obiettivi
                  </div>
                </div>

                <!-- Link fallback -->
                <p style="margin: 0 0 4px; font-size: 12px; color: #9ca3af;">
                  Se il bottone non funziona, copia questo link nel browser:
                </p>
                <p style="margin: 0; font-size: 11px; color: #6b7280; word-break: break-all; font-family: monospace; background: #f3f4f6; padding: 8px; border-radius: 6px;">
                  ${inviteLink}
                </p>
              </div>

              <!-- Footer -->
              <div style="padding: 20px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
                <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                  Questo link è personale. Non condividerlo con nessuno.<br>
                  Hai ricevuto questa email perché ${trainerName} ti ha aggiunto su Schedio.
                </p>
              </div>
            </div>
          </body>
          </html>
        `,
      }),
    });

    const resData = await res.json();
    if (!res.ok) {
      throw new Error(`Resend API error: ${JSON.stringify(resData)}`);
    }

    return new Response(JSON.stringify({ success: true, resendId: resData.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Function error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
