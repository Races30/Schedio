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

    const { email, clientName, trainerName, token } = await req.json();

    if (!email || !clientName || !trainerName || !token) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inviteLink = `https://schedio-five.vercel.app/setup-account?token=${token}`;

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
        subject: "Il tuo trainer ti ha invitato su Schedio",
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #10b981;">Schedio</h2>
            <p>Ciao ${clientName},</p>
            <p><strong>${trainerName}</strong> ti ha invitato a unirti a Schedio, la piattaforma per seguire i tuoi allenamenti e i tuoi progressi.</p>
            <p>Clicca qui per creare il tuo account:</p>
            <p style="margin: 25px 0;">
              <a href="${inviteLink}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; rounded: 8px; font-weight: bold;">Crea il tuo account</a>
            </p>
            <p style="font-size: 14px; color: #666;">Il link è personale e non condividerlo con nessuno.</p>
            <p>A presto,<br>Il team di Schedio</p>
          </div>
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
