// =========================================================================
// SUPABASE EDGE FUNCTION: send-telegram
// Shared helper function to dispatch notifications to the Telegram Bot API.
// =========================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
    const defaultChatId = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";

    if (!botToken) {
      throw new Error("Missing TELEGRAM_BOT_TOKEN configuration in Edge Function environment.");
    }

    const { message, chat_id } = await req.json();

    if (!message) {
      throw new Error("Missing 'message' payload parameters.");
    }

    const targetChatId = chat_id || defaultChatId;
    if (!targetChatId) {
      throw new Error("Missing destination Telegram Chat ID.");
    }

    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: targetChatId,
        text: message,
        parse_mode: "Markdown"
      })
    });

    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`Telegram API responded with error: ${responseText}`);
    }

    const result = JSON.parse(responseText);

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || err }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
