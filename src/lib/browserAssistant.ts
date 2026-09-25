import { supabase, isSupabaseConfigured } from './supabaseClient';
import { 
  getLocalCategories, 
  getLocalCourses, 
  getLocalEnquiries, 
  addLocalEnquiry, 
  updateLocalEnquiry, 
  deleteLocalEnquiry 
} from './localDatabase';
import type { TerminalLine, AssistantResponse } from './geminiSim';

const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

function createLog(prefix: 'system' | 'gemini' | 'success' | 'error', content: string): TerminalLine {
  return {
    id: Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toLocaleTimeString(),
    prefix,
    content
  };
}

export async function callBrowserAssistant(
  command: string,
  isDemo: boolean = false
): Promise<AssistantResponse> {
  const logs: TerminalLine[] = [];
  logs.push(createLog('system', `Browser-Side AI Engine: Processing command "${command}"`));

  if (!geminiApiKey) {
    logs.push(createLog('error', 'Missing VITE_GEMINI_API_KEY in .env configuration.'));
    return {
      reply: "Please configure VITE_GEMINI_API_KEY in your .env file to enable natural language parsing.",
      toolCalled: 'none',
      args: {},
      success: false,
      logs
    };
  }

  try {
    let categories: any[] = [];
    let courses: any[] = [];
    let enquiries: any[] = [];

    // 1. Gather context
    if (!isDemo && isSupabaseConfigured() && supabase) {
      logs.push(createLog('system', 'Fetching context from Supabase...'));
      const { data: catData } = await supabase.from('categories').select('id, name');
      const { data: crsData } = await supabase.from('courses').select('id, name, fee, category_id, description').eq('active', true);
      const { data: enqData } = await supabase.from('enquiries').select('id, contact_name, contact_phone, category_id, course_id, fee_shared, notes, interested, follow_up_done, can_follow_up, next_reminder_at, last_reminded_at, created_at');
      
      if (catData) categories = catData;
      if (crsData) courses = crsData;
      if (enqData) enquiries = enqData;
    } else {
      logs.push(createLog('system', 'Fetching context from local storage...'));
      categories = getLocalCategories();
      courses = getLocalCourses();
      enquiries = getLocalEnquiries();
    }

    const leanCategories = categories.map(c => ({ id: c.id, name: c.name }));
    const leanCourses = courses.map(c => ({ id: c.id, name: c.name, fee: c.fee }));
    const leanEnquiries = enquiries.map(e => {
      const course = courses.find(c => c.id === e.course_id);
      return {
        id: e.id,
        name: e.contact_name,
        phone: e.contact_phone || '',
        course: course ? course.name : 'Unknown',
        fee_shared: e.fee_shared,
        notes: e.notes || '',
        interested: e.interested,
        follow_up_done: e.follow_up_done,
        can_follow_up: e.can_follow_up
      };
    });

    logs.push(createLog('gemini', 'Sending prompt to Gemini API...'));

    // 2. Define Gemini Tool Declarations
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

    const contextPrompt = `
      You are an administrative AI receptionist for an enquiry tracker.
      Your task is to either choose the correct tool to call and extract its arguments, or directly answer the user's natural language question about the database if no action/tool call is needed.

      CRITICAL DATABASE CONTEXT:
      - Valid Categories: ${JSON.stringify(leanCategories)}
      - Valid Active Course Catalog: ${JSON.stringify(leanCourses)}
      - Enquiries Summary Context: ${JSON.stringify(leanEnquiries)}

      Rules for parameters and text responses:
      1. If the user's query asks to perform an action (e.g., add a new enquiry, update status, delete a record, search/filter courses or enquiries), you MUST use the corresponding tool from the list below.
      2. If the user asks a question about the data in the database (e.g., "What is Ashok's phone number?", "Who enquired about JEE?", "How many leads are interested?", "What is the fee for Full Stack Developer?"), you should answer the question directly in plain text based on the database context provided above. Do NOT call a tool; just return the text response.
      3. For create_enquiry: You MUST check if the user explicitly specified a course in their command. If the user ONLY gave a name (e.g., "add Gtyu") without mentioning a course, DO NOT guess or pick a default course! Return plain text asking which course they are inquiring about.
      4. For update_enquiry and delete_enquiry: The identifier parameter is a search term for the customer name.
      5. For boolean statuses (interested, follow_up_done, can_follow_up): Extract only if explicitly mentioned.
    `;

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

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiRequest)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${errText}`);
    }

    const geminiData = await response.json();
    const part = geminiData.candidates?.[0]?.content?.parts?.[0];
    const functionCall = part?.functionCall;
    const textReply = part?.text;

    let toolName = 'none';
    let args: any = {};
    let toolResult: any = null;
    let success = true;
    let reply = '';

    if (functionCall) {
      toolName = functionCall.name;
      args = functionCall.args;

      logs.push(createLog('gemini', `Intent detected: ${toolName}`));
      logs.push(createLog('system', `Executing tool [${toolName}] against database...`));

      if (toolName === 'create_enquiry') {
        const lowerCmd = command.toLowerCase();
        
        // Verify if user actually mentioned any course keyword in their command
        const courseMentionedInCmd = courses.some(c => {
          const cName = c.name.toLowerCase();
          if (lowerCmd.includes(cName)) return true;
          const tokens = cName.split(/\s+/).filter((w: string) => w.length >= 3);
          return tokens.length > 0 && tokens.some((t: string) => lowerCmd.includes(t));
        });

        if (!courseMentionedInCmd) {
          success = false;
          const catalogList = courses.map(c => c.name).join(', ');
          reply = `Which course is ${args.contact_name || 'this lead'} inquiring about? Please specify the course (Available: ${catalogList}) to complete adding the enquiry.`;
          logs.push(createLog('error', reply));
        } else {
          const matchedCourse = courses.find(
            c => c.name.toLowerCase() === args.course_name?.toLowerCase() || lowerCmd.includes(c.name.toLowerCase())
          ) || courses.find(c => {
            const tokens = c.name.toLowerCase().split(/\s+/).filter((w: string) => w.length >= 3);
            return tokens.some((t: string) => lowerCmd.includes(t));
          });

          if (!matchedCourse) {
            success = false;
            reply = `No matching course found for "${args.course_name}" in catalog. Available courses: ${courses.map(c => c.name).join(', ')}.`;
            logs.push(createLog('error', reply));
          } else {
            if (!isDemo && isSupabaseConfigured() && supabase) {
              const { data, error } = await supabase
                .from('enquiries')
                .insert([
                  {
                    contact_name: args.contact_name,
                    contact_phone: args.contact_phone || null,
                    category_id: matchedCourse.category_id,
                    course_id: matchedCourse.id,
                    fee_shared: args.fee_shared,
                    notes: args.notes || 'Logged via browser assistant.'
                  }
                ])
                .select();
              if (error) throw error;
              toolResult = data?.[0];
            } else {
              toolResult = addLocalEnquiry({
                contact_name: args.contact_name,
                contact_phone: args.contact_phone || '',
                category_id: matchedCourse.category_id,
                course_id: matchedCourse.id,
                fee_shared: args.fee_shared,
                notes: args.notes || 'Logged via browser assistant simulation.',
                interested: null,
                follow_up_done: null,
                can_follow_up: null
              });
            }
            reply = `Successfully added enquiry for ${args.contact_name} (${matchedCourse.name}).`;
            logs.push(createLog('success', reply));
          }
        }

      } else if (toolName === 'update_enquiry') {
        const term = args.identifier.toLowerCase();
        let matches = enquiries.filter(e => e.contact_name.toLowerCase().includes(term));
        const unresolvedMatches = matches.filter(e => e.interested === null || e.follow_up_done === null || e.can_follow_up === null);
        if (unresolvedMatches.length > 0) {
          matches = unresolvedMatches;
        }

        if (matches.length === 0) {
          success = false;
          reply = `Could not find any enquiry matching "${args.identifier}".`;
          logs.push(createLog('error', reply));
        } else if (matches.length > 1) {
          success = false;
          reply = `Found multiple matches for "${args.identifier}". Please be more specific:\n` + 
                  matches.map(m => `- ${m.contact_name}`).join('\n');
          logs.push(createLog('error', `Multiple matches found for "${args.identifier}"`));
        } else {
          const target = matches[0];
          const updates: any = {};
          if (args.interested !== undefined) updates.interested = args.interested;
          if (args.follow_up_done !== undefined) updates.follow_up_done = args.follow_up_done;
          if (args.can_follow_up !== undefined) updates.can_follow_up = args.can_follow_up;
          if (args.notes) updates.notes = args.notes;

          if (!isDemo && isSupabaseConfigured() && supabase) {
            const { data, error } = await supabase
              .from('enquiries')
              .update(updates)
              .eq('id', target.id)
              .select();
            if (error) throw error;
            toolResult = data?.[0];
          } else {
            toolResult = updateLocalEnquiry(target.id, updates);
          }
          reply = `Updated status for ${target.contact_name}'s enquiry.`;
          logs.push(createLog('success', reply));
        }

      } else if (toolName === 'delete_enquiry') {
        const term = args.identifier.toLowerCase();
        const matches = enquiries.filter(e => e.contact_name.toLowerCase().includes(term));

        if (matches.length === 0) {
          success = false;
          reply = `Could not find any enquiry matching "${args.identifier}" to delete.`;
          logs.push(createLog('error', reply));
        } else if (matches.length > 1) {
          success = false;
          reply = `Found multiple enquiries for "${args.identifier}". Please specify:\n` + 
                  matches.map(m => `- ${m.contact_name}`).join('\n');
          logs.push(createLog('error', `Multiple matches found for delete`));
        } else {
          const target = matches[0];
          if (!isDemo && isSupabaseConfigured() && supabase) {
            const { error } = await supabase
              .from('enquiries')
              .delete()
              .eq('id', target.id);
            if (error) throw error;
          } else {
            deleteLocalEnquiry(target.id);
          }
          reply = `Deleted enquiry for ${target.contact_name}.`;
          logs.push(createLog('success', reply));
        }

      } else if (toolName === 'get_courses') {
        let filtered = courses;
        if (args.category) {
          const cat = categories.find(c => c.name.toLowerCase() === args.category.toLowerCase());
          if (cat) filtered = filtered.filter(c => c.category_id === cat.id);
        }
        if (args.search_term) {
          filtered = filtered.filter(c => c.name.toLowerCase().includes(args.search_term.toLowerCase()));
        }
        toolResult = filtered;
        reply = filtered.length > 0
          ? `Found ${filtered.length} courses:\n` + filtered.map(c => `- ${c.name} (${c.fee})`).join('\n')
          : 'No matching courses found.';
        logs.push(createLog('success', `Fetched ${filtered.length} courses.`));

      } else if (toolName === 'get_enquiries') {
        let filtered = enquiries;
        if (args.unresolvedOnly !== false) {
          filtered = filtered.filter(e => e.interested === null || e.follow_up_done === null || e.can_follow_up === null);
        }
        if (args.category) {
          const cat = categories.find(c => c.name.toLowerCase() === args.category.toLowerCase());
          if (cat) filtered = filtered.filter(e => e.category_id === cat.id);
        }
        toolResult = filtered;
        reply = filtered.length > 0
          ? `Found ${filtered.length} open enquiries.`
          : 'No enquiries found matching filters.';
        logs.push(createLog('success', `Fetched ${filtered.length} enquiries.`));
      }

    } else if (textReply) {
      reply = textReply;
      logs.push(createLog('gemini', `Direct Answer: "${reply}"`));
    } else {
      reply = geminiData.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join(' ') || "I couldn't process that request.";
      logs.push(createLog('gemini', reply));
    }

    // 3. Summarize outcomes for tool calls
    let summaryReply = reply;
    if (success && toolName !== 'none') {
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
        const sumResponse = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(summaryRequest)
        });
        if (sumResponse.ok) {
          const sumData = await sumResponse.json();
          const sumText = sumData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (sumText) summaryReply = sumText.trim();
        }
      } catch (err) {
        console.warn('Failed to generate friendly summary:', err);
      }
    }

    return {
      reply: summaryReply,
      toolCalled: toolName,
      args,
      success,
      logs
    };

  } catch (error: any) {
    logs.push(createLog('error', `Browser AI execution failed: ${error.message}`));
    return {
      reply: `Error occurred: ${error.message || error}`,
      toolCalled: 'none',
      args: {},
      success: false,
      logs
    };
  }
}
