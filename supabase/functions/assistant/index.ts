// =========================================================================
// SUPABASE EDGE FUNCTION: assistant
// Handles natural language commands via Gemini tool use/function calling.
// =========================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase credentials in Edge Function environment.");
    }
    if (!geminiApiKey) {
      throw new Error("Missing GEMINI_API_KEY environment variable.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { command } = await req.json();

    if (!command || !command.trim()) {
      return new Response(
        JSON.stringify({ reply: "Please enter a valid command.", success: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. GATHER REAL-TIME DATABASE CONTEXT (Courses & all enquiries)
    const { data: categories } = await supabase.from("categories").select("id, name");
    const { data: courses } = await supabase.from("courses").select("id, name, fee, category_id, description").eq("active", true);
    const { data: enquiries } = await supabase.from("enquiries").select("id, contact_name, contact_phone, category_id, course_id, fee_shared, notes, interested, follow_up_done, can_follow_up, next_reminder_at, last_reminded_at, created_at");

    // Map course IDs to names for enquiries to make it easier for Gemini to understand relationships
    const enquiriesWithCourseNames = enquiries?.map(e => {
      const course = courses?.find(c => c.id === e.course_id);
      const category = categories?.find(cat => cat.id === e.category_id);
      return {
        ...e,
        course_name: course ? course.name : "Unknown",
        category_name: category ? category.name : "Unknown"
      };
    }) || [];

    // 2. DEFINE GEMINI TOOL DECLARATIONS
    const tools = [
      {
        functionDeclarations: [
          {
            name: "create_enquiry",
            description: "Inserts a new customer enquiry. Requires course matching from catalog.",
            parameters: {
              type: "OBJECT",
              properties: {
                contact_name: { type: "STRING", description: "The customer's full name (properly capitalized)." },
                contact_phone: { type: "STRING", description: "Customer phone number if provided." },
                course_name: { type: "STRING", description: "The exact name of the course enquired about." },
                fee_shared: { type: "BOOLEAN", description: "Must be true if fee details were shared or mentioned." },
                notes: { type: "STRING", description: "Any other details mentioned during the inquiry call." }
              },
              required: ["contact_name", "course_name", "fee_shared"]
            }
          },
          {
            name: "update_enquiry",
            description: "Updates status of an existing open enquiry.",
            parameters: {
              type: "OBJECT",
              properties: {
                identifier: { type: "STRING", description: "Search word, typically the customer's name, used to look up their record." },
                interested: { type: "BOOLEAN", description: "Is customer interested? (True = yes, False = no)." },
                follow_up_done: { type: "BOOLEAN", description: "Is follow up call done? (True = yes, False = no)." },
                can_follow_up: { type: "BOOLEAN", description: "Is customer reachable or follow-up possible? (True = yes, False = unreachable/wrong number)." },
                notes: { type: "STRING", description: "Notes to add or append to the record." }
              },
              required: ["identifier"]
            }
          },
          {
            name: "delete_enquiry",
            description: "Removes an enquiry record.",
            parameters: {
              type: "OBJECT",
              properties: {
                identifier: { type: "STRING", description: "Customer name or phrase to find and delete." }
              },
              required: ["identifier"]
            }
          },
          {
            name: "get_courses",
            description: "Lists active courses.",
            parameters: {
              type: "OBJECT",
              properties: {
                category: { type: "STRING", description: "Filter: 'Technologies' or 'Academy'." },
                search_term: { type: "STRING", description: "Keyword for matching course name." }
              }
            }
          },
          {
            name: "get_enquiries",
            description: "Fetches lead records.",
            parameters: {
              type: "OBJECT",
              properties: {
                unresolvedOnly: { type: "BOOLEAN", description: "Fetch only pending enquiries." },
                category: { type: "STRING", description: "Filter: 'Technologies' or 'Academy'." }
              }
            }
          }
        ]
      }
    ];

    // 3. BUILD AI CONTEXT PROMPT
    const contextPrompt = `
      You are an administrative AI receptionist for an enquiry tracker.
      Your task is to either choose the correct tool to call and extract its arguments, or directly answer the user's natural language question about the database if no action/tool call is needed.

      CRITICAL DATABASE CONTEXT:
      - Valid Categories: ${JSON.stringify(categories)}
      - Valid Active Course Catalog: ${JSON.stringify(courses)}
      - All Enquiries in Database (including phone and notes): ${JSON.stringify(enquiriesWithCourseNames)}

      Rules for parameters and text responses:
      1. If the user's query asks to perform an action (e.g., add a new enquiry, update status, delete a record, search/filter courses or enquiries), you MUST use the corresponding tool from the list below.
      2. If the user asks a question about the data in the database (e.g., "What is Ashok's phone number?", "Who enquired about JEE?", "How many leads are interested?", "What is the fee for Full Stack Developer?"), you should answer the question directly in plain text based on the database context provided above. Do NOT call a tool; just return the text response.
      3. For create_enquiry: You MUST check if the user explicitly specified a course in their command. If the user ONLY gave a name (e.g., "add Gtyu") without mentioning a course, DO NOT guess or pick a default course! Return plain text asking which course they are inquiring about.
      4. For update_enquiry and delete_enquiry: The identifier parameter is a search term for the customer name.
      5. For boolean statuses (interested, follow_up_done, can_follow_up): Extract only if explicitly mentioned.
    `;

    // 4. CALL GEMINI FOR TOOL CALLING
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiApiKey}`;
    
    const geminiRequest = {
      contents: [
        {
          role: "user",
          parts: [
            { text: contextPrompt },
            { text: `User command: "${command}"` }
          ]
        }
      ],
      tools: tools,
      toolConfig: {
        functionCallingConfig: {
          mode: "AUTO"
        }
      }
    };

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiRequest)
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      throw new Error(`Gemini API error: ${errorText}`);
    }

    const geminiData = await geminiResponse.json();
    const part = geminiData.candidates?.[0]?.content?.parts?.[0];
    const functionCall = part?.functionCall;
    const textReply = part?.text;

    let toolName = "none";
    let args: any = {};
    let toolResult: any = null;
    let success = true;
    let reply = "";

    if (functionCall) {
      toolName = functionCall.name;
      args = functionCall.args;
    } else if (textReply) {
      reply = textReply;
    } else {
      reply = geminiData.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join(" ") || "I couldn't process that request.";
    }

    // 5. EXECUTE THE SELECTED TOOL
    if (toolName === "create_enquiry") {
      const lowerCmd = command.toLowerCase();
      const allActiveCourses = courses || [];

      // Verify if user actually mentioned any course keyword in their command
      const courseMentionedInCmd = allActiveCourses.some(c => {
        const cName = c.name.toLowerCase();
        if (lowerCmd.includes(cName)) return true;
        const tokens = cName.split(/\s+/).filter(w => w.length >= 3);
        return tokens.length > 0 && tokens.some(t => lowerCmd.includes(t));
      });

      if (!courseMentionedInCmd) {
        success = false;
        const catalogList = allActiveCourses.map(c => c.name).join(", ");
        reply = `Which course is ${args.contact_name || "this lead"} inquiring about? Please specify the course (Available: ${catalogList}) to complete adding the enquiry.`;
      } else {
        const matchedCourse = allActiveCourses.find(
          c => c.name.toLowerCase() === args.course_name?.toLowerCase() || lowerCmd.includes(c.name.toLowerCase())
        ) || allActiveCourses.find(c => {
          const tokens = c.name.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
          return tokens.some(t => lowerCmd.includes(t));
        });

        if (!matchedCourse) {
          success = false;
          reply = `No matching course found for "${args.course_name}" in catalog. Available courses: ${allActiveCourses.map(c => c.name).join(", ")}.`;
        } else {
          const { data, error } = await supabase
            .from("enquiries")
            .insert([
              {
                contact_name: args.contact_name,
                contact_phone: args.contact_phone || null,
                category_id: matchedCourse.category_id,
                course_id: matchedCourse.id,
                fee_shared: args.fee_shared,
                notes: args.notes || "Logged via assistant command."
              }
            ])
            .select();

          if (error) throw error;
          toolResult = data?.[0];
          reply = `Successfully added enquiry for ${args.contact_name} (${matchedCourse.name}).`;
        }
      }

    } else if (toolName === "update_enquiry") {
      const term = args.identifier.toLowerCase();
      // Find matches in all enquiries (unresolved first)
      let matches = enquiries?.filter(e => e.contact_name.toLowerCase().includes(term)) || [];
      const unresolvedMatches = matches.filter(e => e.interested === null || e.follow_up_done === null || e.can_follow_up === null);
      if (unresolvedMatches.length > 0) {
        matches = unresolvedMatches;
      }

      if (matches.length === 0) {
        success = false;
        reply = `Could not find any enquiry matching "${args.identifier}".`;
      } else if (matches.length > 1) {
        success = false;
        reply = `Found multiple matches for "${args.identifier}". Please be more specific:\n` + 
                matches.map(m => `- ${m.contact_name}`).join("\n");
      } else {
        const target = matches[0];
        const updates: any = {};
        if (args.interested !== undefined) updates.interested = args.interested;
        if (args.follow_up_done !== undefined) updates.follow_up_done = args.follow_up_done;
        if (args.can_follow_up !== undefined) updates.can_follow_up = args.can_follow_up;
        if (args.notes) updates.notes = args.notes;

        const { data, error } = await supabase
          .from("enquiries")
          .update(updates)
          .eq("id", target.id)
          .select();

        if (error) throw error;
        toolResult = data?.[0];
        reply = `Updated status for ${target.contact_name}'s enquiry.`;
      }

    } else if (toolName === "delete_enquiry") {
      const term = args.identifier.toLowerCase();
      const matches = enquiries?.filter(e => e.contact_name.toLowerCase().includes(term)) || [];

      if (matches.length === 0) {
        success = false;
        reply = `Could not find any enquiry matching "${args.identifier}" to delete.`;
      } else if (matches.length > 1) {
        success = false;
        reply = `Found multiple enquiries for "${args.identifier}". Please specify:\n` + 
                matches.map(m => `- ${m.contact_name}`).join("\n");
      } else {
        const target = matches[0];
        const { error } = await supabase
          .from("enquiries")
          .delete()
          .eq("id", target.id);
        
        if (error) throw error;
        reply = `Deleted enquiry for ${target.contact_name}.`;
      }

    } else if (toolName === "get_courses") {
      let query = supabase.from("courses").select("*, categories(name)").eq("active", true);
      if (args.category) {
        const cat = categories?.find(c => c.name.toLowerCase() === args.category.toLowerCase());
        if (cat) query = query.eq("category_id", cat.id);
      }
      const { data, error } = await query;
      if (error) throw error;

      toolResult = data;
      reply = data && data.length > 0 
        ? `Found ${data.length} courses:\n` + data.map(c => `- ${c.name} (${c.fee})`).join("\n")
        : "No courses found matching that criteria.";

    } else if (toolName === "get_enquiries") {
      let query = supabase.from("enquiries").select("*, courses(name)");
      if (args.unresolvedOnly !== false) {
        // filter unresolved
        query = query.or("interested.is.null,follow_up_done.is.null,can_follow_up.is.null");
      }
      if (args.category) {
        const cat = categories?.find(c => c.name.toLowerCase() === args.category.toLowerCase());
        if (cat) query = query.eq("category_id", cat.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      toolResult = data;
      reply = data && data.length > 0
        ? `Found ${data.length} open enquiries.`
        : "No enquiries found matching filters.";
    }

    // 6. SUMMARIZE THE OUTPUT WITH GEMINI FOR A FRIENDLY RESPONSE
    let summaryReply = reply;
    if (success && toolName !== "none") {
      try {
        const summaryRequest = {
          contents: [
            {
              role: "user",
              parts: [
                { text: "Generate a friendly, concise administrative confirmation message for this action outcome. Keep it under 2 sentences." },
                { text: `Action outcome: "${reply}". Data details: ${JSON.stringify(toolResult)}` }
              ]
            }
          ]
        };
        const sumResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiApiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(summaryRequest)
        });
        if (sumResponse.ok) {
          const sumData = await sumResponse.json();
          const sumText = sumData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (sumText) summaryReply = sumText.trim();
        }
      } catch (err) {
        console.warn("Failed to generate friendly summary, returning default:", err);
      }
    }

    return new Response(
      JSON.stringify({ 
        reply: summaryReply, 
        toolCalled: toolName, 
        args, 
        data: toolResult,
        success 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ 
        reply: `Error occurred: ${err.message || err}`, 
        success: false 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
