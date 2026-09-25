// =========================================================================
// SUPABASE EDGE FUNCTION: check-reminders
// Scans for overdue, unresolved enquiries and postpones reminders in DB.
// =========================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.3";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase credentials in Edge Function environment.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date().toISOString();

    // 1. SELECT OVERDUE AND UNRESOLVED ENQUIRIES
    const { data: leads, error } = await supabase
      .from("enquiries")
      .select("*, courses(name)")
      .or("interested.is.null,follow_up_done.is.null,can_follow_up.is.null")
      .lte("next_reminder_at", now);

    if (error) throw error;

    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ message: "No overdue enquiries found. No actions taken." }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    let reminderDays = 2;
    try {
      const body = await req.json();
      if (body && body.reminder_days) {
        reminderDays = Number(body.reminder_days) || 2;
      }
    } catch (_) {
      // Ignore if request body is empty
    }

    // 2. POSTPONE REMINDERS IN DATABASE (+N Days based on user input)
    const updatePromises = leads.map(async (l: any) => {
      const nextReminder = new Date();
      nextReminder.setDate(nextReminder.getDate() + reminderDays);

      return supabase
        .from("enquiries")
        .update({
          next_reminder_at: nextReminder.toISOString(),
          last_reminded_at: new Date().toISOString()
        })
        .eq("id", l.id);
    });

    await Promise.all(updatePromises);

    return new Response(
      JSON.stringify({ 
        message: `Reminders check finished. Rescheduled ${leads.length} leads by +${reminderDays} days.`,
        recipients: leads.map(l => l.contact_name)
      }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || err }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
