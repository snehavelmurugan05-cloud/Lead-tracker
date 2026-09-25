import { 
  getLocalCourses, 
  getLocalEnquiries, 
  addLocalEnquiry, 
  updateLocalEnquiry, 
  deleteLocalEnquiry
} from './localDatabase';
import type { Enquiry, Course } from './localDatabase';

export interface TerminalLine {
  id: string;
  timestamp: string;
  prefix: 'system' | 'gemini' | 'success' | 'error';
  content: string;
}

export interface AssistantResponse {
  reply: string;
  toolCalled: string;
  args: any;
  success: boolean;
  logs: TerminalLine[];
  clarificationRequired?: {
    type: 'multiple_matches' | 'no_match';
    candidates?: any[];
    field?: string;
  };
}

function createLog(prefix: 'system' | 'gemini' | 'success' | 'error', content: string): TerminalLine {
  return {
    id: Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toLocaleTimeString(),
    prefix,
    content
  };
}

/**
 * Smart rule-based AI parser that simulates Google Gemini tool calling.
 */
export async function simulateAssistant(command: string): Promise<AssistantResponse> {
  const logs: TerminalLine[] = [];
  logs.push(createLog('system', `Processing raw text: "${command}"`));
  logs.push(createLog('gemini', 'Analyzing syntax and detecting intents...'));

  const text = command.toLowerCase().trim();
  const courses = getLocalCourses();
  const enquiries = getLocalEnquiries();

  // Helper function to find a course in the query
  const findCourseInText = (str: string): Course | null => {
    for (const course of courses) {
      if (str.includes(course.name.toLowerCase())) {
        return course;
      }
    }
    // Try shorter match
    for (const course of courses) {
      const parts = course.name.toLowerCase().split(' ');
      // If course name is long, check if major words are present
      if (parts.length > 1) {
        const matchesAll = parts.filter(p => p.length > 3).every(p => str.includes(p));
        if (matchesAll && parts.filter(p => p.length > 3).length > 0) {
          return course;
        }
      }
    }
    return null;
  };

  // Helper function to find enquiries matching an identifier (e.g. name)
  const findMatchingEnquiries = (identifier: string): Enquiry[] => {
    const term = identifier.toLowerCase().trim();
    if (!term) return [];
    
    // Exact or starting matches on contact_name
    let matches = enquiries.filter(e => {
      // Check if unresolved (at least one status is null)
      const isUnresolved = e.interested === null || e.follow_up_done === null || e.can_follow_up === null;
      return isUnresolved && e.contact_name.toLowerCase().includes(term);
    });

    if (matches.length === 0) {
      // Try including resolved enquiries
      matches = enquiries.filter(e => e.contact_name.toLowerCase().includes(term));
    }
    
    return matches;
  };

  // 1. DELETE ENQUIRY INTENT
  if (text.includes('delete') || text.includes('remove') || text.includes('cancel enquiry')) {
    logs.push(createLog('gemini', 'Intent detected: delete_enquiry'));
    
    // Extract identifier: "delete Ashok's enquiry" -> "ashok"
    // "delete enquiry for priya" -> "priya"
    let identifier = '';
    const deleteRegex = /(?:delete|remove|cancel)(?:\s+enquiry)?(?:\s+for|\s+of)?\s+([a-zA-Z\s]+)(?:'s)?(?:\s+enquiry)?/;
    const match = text.match(deleteRegex);
    if (match && match[1]) {
      identifier = match[1].replace("'s", "").trim();
    } else {
      // Fallback: extract whatever is after "delete"
      identifier = text.replace(/delete|remove|enquiry|cancel/g, '').trim();
    }

    logs.push(createLog('system', `Extracted delete identifier: "${identifier}"`));
    
    if (!identifier) {
      logs.push(createLog('error', 'Delete target could not be identified from input.'));
      return {
        reply: "I couldn't figure out whose enquiry you want to delete. Please specify the name, e.g., 'Delete Ashok's enquiry'.",
        toolCalled: 'delete_enquiry',
        args: { identifier: '' },
        success: false,
        logs
      };
    }

    const matches = findMatchingEnquiries(identifier);
    if (matches.length === 0) {
      logs.push(createLog('error', `No open enquiry found matching: "${identifier}"`));
      return {
        reply: `No open enquiry found for "${identifier}". Please check the name and try again.`,
        toolCalled: 'delete_enquiry',
        args: { identifier },
        success: false,
        logs,
        clarificationRequired: { type: 'no_match', field: 'identifier' }
      };
    } else if (matches.length > 1) {
      logs.push(createLog('error', `Multiple matches found for "${identifier}" (${matches.length} records)`));
      return {
        reply: `I found multiple enquiries matching "${identifier}". Please specify which one to delete:`,
        toolCalled: 'delete_enquiry',
        args: { identifier },
        success: false,
        logs,
        clarificationRequired: {
          type: 'multiple_matches',
          candidates: matches.map(m => {
            const course = courses.find(c => c.id === m.course_id);
            return {
              id: m.id,
              name: m.contact_name,
              course: course ? course.name : 'Unknown Course',
              created_at: new Date(m.created_at).toLocaleDateString()
            };
          })
        }
      };
    }

    // Single match found!
    const target = matches[0];
    const course = courses.find(c => c.id === target.course_id);
    deleteLocalEnquiry(target.id);
    logs.push(createLog('success', `Successfully deleted enquiry ID: ${target.id}`));
    
    return {
      reply: `Deleted enquiry for ${target.contact_name} (${course?.name || 'unknown course'}).`,
      toolCalled: 'delete_enquiry',
      args: { identifier },
      success: true,
      logs
    };
  }

  // 2. UPDATE ENQUIRY INTENT
  // "mark Ashok as interested", "follow up done for Ashok", "Ashok is unreachable"
  if (
    text.includes('mark') || 
    text.includes('update') || 
    text.includes('follow up') || 
    text.includes('interested') || 
    text.includes('not interested') || 
    text.includes('unreachable') || 
    text.includes('reachable') || 
    text.includes('followup')
  ) {
    logs.push(createLog('gemini', 'Intent detected: update_enquiry'));

    // Extract identifier
    // Let's look for common names or parts of string.
    // e.g. "mark Ashok as interested" -> Ashok
    // "follow up done for Priya" -> Priya
    let identifier = '';
    
    // Try to strip known verbs and statuses to extract name
    let nameSegment = text
      .replace(/mark/g, '')
      .replace(/update/g, '')
      .replace(/as/g, '')
      .replace(/interested/g, '')
      .replace(/not/g, '')
      .replace(/follow up/g, '')
      .replace(/followup/g, '')
      .replace(/done/g, '')
      .replace(/completed/g, '')
      .replace(/reachable/g, '')
      .replace(/unreachable/g, '')
      .replace(/can follow up/g, '')
      .replace(/cannot follow up/g, '')
      .replace(/for/g, '')
      .replace(/to/g, '')
      .replace(/and/g, '')
      .trim();
    
    // If nameSegment contains "enquiry", clean it
    nameSegment = nameSegment.replace(/enquiry/g, '').trim();

    // Or search names of existing enquiries to see if they are mentioned
    for (const enq of enquiries) {
      const firstName = enq.contact_name.split(' ')[0].toLowerCase();
      if (text.includes(firstName)) {
        identifier = firstName;
        break;
      }
    }

    if (!identifier) {
      identifier = nameSegment;
    }

    logs.push(createLog('system', `Extracted update identifier: "${identifier}"`));

    if (!identifier) {
      logs.push(createLog('error', 'Update target could not be identified.'));
      return {
        reply: "I couldn't identify which customer's enquiry you wanted to update. Please mention their name.",
        toolCalled: 'update_enquiry',
        args: {},
        success: false,
        logs
      };
    }

    const matches = findMatchingEnquiries(identifier);
    if (matches.length === 0) {
      logs.push(createLog('error', `No open enquiry found matching: "${identifier}"`));
      return {
        reply: `No open enquiry found matching "${identifier}".`,
        toolCalled: 'update_enquiry',
        args: { identifier },
        success: false,
        logs,
        clarificationRequired: { type: 'no_match', field: 'identifier' }
      };
    } else if (matches.length > 1) {
      logs.push(createLog('error', `Multiple matches found for "${identifier}" (${matches.length} records)`));
      return {
        reply: `I found multiple enquiries matching "${identifier}". Please choose one to update:`,
        toolCalled: 'update_enquiry',
        args: { identifier },
        success: false,
        logs,
        clarificationRequired: {
          type: 'multiple_matches',
          candidates: matches.map(m => {
            const course = courses.find(c => c.id === m.course_id);
            return {
              id: m.id,
              name: m.contact_name,
              course: course ? course.name : 'Unknown Course',
              created_at: new Date(m.created_at).toLocaleDateString()
            };
          })
        }
      };
    }

    // Determine status updates
    const target = matches[0];
    const updates: Partial<Enquiry> = {};

    // Interested status
    if (text.includes('not interested') || text.includes('disinterested') || text.includes('uninterested')) {
      updates.interested = false;
      logs.push(createLog('gemini', 'Parameter detected: interested = false'));
    } else if (text.includes('interested')) {
      updates.interested = true;
      logs.push(createLog('gemini', 'Parameter detected: interested = true'));
    }

    // Follow up done status
    if (text.includes('follow up done') || text.includes('followup done') || text.includes('followed up') || text.includes('follow up complete')) {
      updates.follow_up_done = true;
      logs.push(createLog('gemini', 'Parameter detected: follow_up_done = true'));
    } else if (text.includes('follow up pending') || text.includes('follow up not done')) {
      updates.follow_up_done = false;
      logs.push(createLog('gemini', 'Parameter detected: follow_up_done = false'));
    }

    // Reachable / can follow up status
    if (text.includes('unreachable') || text.includes('not reachable') || text.includes('wrong number') || text.includes('cannot follow up')) {
      updates.can_follow_up = false;
      logs.push(createLog('gemini', 'Parameter detected: can_follow_up = false'));
    } else if (text.includes('reachable') || text.includes('can follow up')) {
      updates.can_follow_up = true;
      logs.push(createLog('gemini', 'Parameter detected: can_follow_up = true'));
    }

    // Extract notes if any
    const notesRegex = /(?:notes|note|comment):\s*(.*)$/;
    const notesMatch = text.match(notesRegex);
    if (notesMatch && notesMatch[1]) {
      updates.notes = notesMatch[1].trim();
      logs.push(createLog('gemini', `Parameter detected: notes = "${updates.notes}"`));
    }

    if (Object.keys(updates).length === 0) {
      logs.push(createLog('error', 'No status fields extracted from update command.'));
      return {
        reply: `I identified the enquiry for ${target.contact_name}, but I couldn't understand what status to update. You can say e.g. 'Mark Ashok as interested' or 'Mark follow up done for Ashok'.`,
        toolCalled: 'update_enquiry',
        args: { identifier },
        success: false,
        logs
      };
    }

    updateLocalEnquiry(target.id, updates);
    logs.push(createLog('success', `Successfully updated enquiry ID: ${target.id}`));
    
    // Build human confirmation message
    const fieldsUpdated: string[] = [];
    if (updates.interested !== undefined) fieldsUpdated.push(`interested = ${updates.interested}`);
    if (updates.follow_up_done !== undefined) fieldsUpdated.push(`follow_up_done = ${updates.follow_up_done}`);
    if (updates.can_follow_up !== undefined) fieldsUpdated.push(`can_follow_up = ${updates.can_follow_up}`);
    
    return {
      reply: `Updated ${target.contact_name}'s enquiry: ${fieldsUpdated.join(', ')}.`,
      toolCalled: 'update_enquiry',
      args: { identifier, ...updates },
      success: true,
      logs
    };
  }

  // 3. CREATE ENQUIRY INTENT (DEFAULT FALLBACK / TRIGGERED BY "add" or "create" or "new")
  if (text.includes('add') || text.includes('create') || text.includes('new enquiry') || text.includes('log') || text.includes('enquired')) {
    logs.push(createLog('gemini', 'Intent detected: create_enquiry'));

    // Extract Course Name
    const matchedCourse = findCourseInText(text);
    if (!matchedCourse) {
      logs.push(createLog('error', 'No matching course found in the catalog.'));
      return {
        reply: "I couldn't find a course matching that description in the catalog. Please double-check the course name or add it first via the Manage Courses page.",
        toolCalled: 'create_enquiry',
        args: {},
        success: false,
        logs,
        clarificationRequired: { type: 'no_match', field: 'course_name' }
      };
    }

    logs.push(createLog('system', `Matched course: "${matchedCourse.name}" (ID: ${matchedCourse.id})`));

    // Extract Contact Name
    // Look for Ashok in "name Ashok" or "customer Ashok" or "customer name Ashok" or "student Ashok"
    let contact_name = '';
    const nameRegex = /(?:customer name|customer|name|student|for)\s+([a-zA-Z\s]+?)(?:\s+enquired|\s+about|\s+fee|\s+phone|\s+notes|\s+call|\s*,|$)/;
    const nameMatch = text.match(nameRegex);
    if (nameMatch && nameMatch[1]) {
      contact_name = nameMatch[1].trim();
    } else {
      // Fallback: search for words in the command that aren't keywords and capitalize them
      const words = command.split(/[\s,]+/);
      const candidates = words.filter(w => {
        const lw = w.toLowerCase();
        const keywords = ['add', 'enquiry', 'customer', 'name', 'enquired', 'about', 'fee', 'shared', 'phone', 'notes', 'call', 'new', 'create', 'log'];
        return !keywords.includes(lw) && w.length > 2 && isNaN(Number(w)) && w !== matchedCourse.name;
      });
      if (candidates.length > 0) {
        contact_name = candidates.join(' ');
      }
    }

    // Capitalize first letters of contact name
    if (contact_name) {
      contact_name = contact_name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }

    logs.push(createLog('system', `Extracted contact name: "${contact_name}"`));

    if (!contact_name) {
      logs.push(createLog('error', 'Contact name could not be identified.'));
      return {
        reply: "I identified the course but couldn't extract the customer's name. Please phrase it like: 'Add enquiry for Ashok, course Full Stack Developer'.",
        toolCalled: 'create_enquiry',
        args: { course_name: matchedCourse.name },
        success: false,
        logs
      };
    }

    // Extract Phone Number
    let contact_phone = '';
    const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b\d{10,12}\b/;
    const phoneMatch = text.match(phoneRegex);
    if (phoneMatch) {
      contact_phone = phoneMatch[0];
      logs.push(createLog('system', `Extracted contact phone: "${contact_phone}"`));
    }

    // Extract Fee Shared
    const fee_shared = text.includes('fee shared') || text.includes('shared fee') || text.includes('shared fees') || text.includes('shared the fee');
    logs.push(createLog('system', `Extracted fee_shared: ${fee_shared}`));

    // Extract Notes
    let notes = '';
    const notesRegex = /(?:notes|note|comment|says|wants):\s*(.*)$/;
    const notesMatch = text.match(notesRegex);
    if (notesMatch && notesMatch[1]) {
      notes = notesMatch[1].trim();
    } else {
      // Find remaining text
      notes = 'Logged via AI assistant command.';
    }
    
    // Add enquiry to local database
    const newEnq = addLocalEnquiry({
      contact_name,
      contact_phone: contact_phone || '',
      category_id: matchedCourse.category_id,
      course_id: matchedCourse.id,
      fee_shared,
      notes,
      interested: null,
      follow_up_done: null,
      can_follow_up: null
    });

    logs.push(createLog('success', `Created local enquiry record with ID: ${newEnq.id}`));

    return {
      reply: `Added enquiry for ${contact_name} — ${matchedCourse.name}, fee shared: ${fee_shared ? 'Yes' : 'No'}.`,
      toolCalled: 'create_enquiry',
      args: { contact_name, contact_phone, category: matchedCourse.category_id, course_name: matchedCourse.name, fee_shared, notes },
      success: true,
      logs
    };
  }

  // 4. GET COURSES INTENT
  // "get me the technologies courses", "show courses", "list academy courses"
  if (text.includes('course') || text.includes('catalog') || text.includes('fees') || text.includes('fee structure')) {
    logs.push(createLog('gemini', 'Intent detected: get_courses'));

    let categoryFilter: string | undefined = undefined;
    if (text.includes('tech') || text.includes('developer') || text.includes('code')) {
      categoryFilter = 'cat-tech';
      logs.push(createLog('gemini', 'Filter applied: category = Technologies'));
    } else if (text.includes('academy') || text.includes('coaching') || text.includes('class') || text.includes('neet') || text.includes('jee') || text.includes('german')) {
      categoryFilter = 'cat-academy';
      logs.push(createLog('gemini', 'Filter applied: category = Academy'));
    }

    // Search term extraction (if any)
    let search_term: string | undefined = undefined;
    const searchWords = text.split(' ');
    // Simple heuristic: if there are words other than list/show/courses/get/me
    const ignored = ['get', 'me', 'the', 'show', 'list', 'courses', 'course', 'catalog', 'fees', 'fee', 'structure', 'for', 'about', 'in'];
    const cleanSearchWords = searchWords.filter(w => !ignored.includes(w) && w.length > 2 && w !== 'technologies' && w !== 'academy');
    if (cleanSearchWords.length > 0) {
      search_term = cleanSearchWords.join(' ');
      logs.push(createLog('gemini', `Filter applied: search_term = "${search_term}"`));
    }

    let filteredCourses = courses;
    if (categoryFilter) {
      filteredCourses = filteredCourses.filter(c => c.category_id === categoryFilter);
    }
    if (search_term) {
      const term = search_term.toLowerCase();
      filteredCourses = filteredCourses.filter(c => c.name.toLowerCase().includes(term) || c.description.toLowerCase().includes(term));
    }

    if (filteredCourses.length === 0) {
      logs.push(createLog('system', 'No courses matched search parameters.'));
      return {
        reply: "No courses found matching your request.",
        toolCalled: 'get_courses',
        args: { category: categoryFilter, search_term },
        success: true,
        logs
      };
    }

    logs.push(createLog('success', `Found ${filteredCourses.length} matching courses.`));
    const courseListStr = filteredCourses.map(c => `- ${c.name} (${c.fee})`).join('\n');
    const catName = categoryFilter ? (categoryFilter === 'cat-tech' ? 'Technologies' : 'Academy') : 'all';
    
    return {
      reply: `Here are the courses under ${catName} category:\n${courseListStr}`,
      toolCalled: 'get_courses',
      args: { category: categoryFilter, search_term },
      success: true,
      logs
    };
  }

  // 5. GET ENQUIRIES INTENT
  // "get me unresolved enquiries", "show enquiries", "list Academy enquiries"
  if (text.includes('enquiries') || text.includes('enquiry list') || text.includes('show enquir') || text.includes('get enquir') || text.includes('list enquir')) {
    logs.push(createLog('gemini', 'Intent detected: get_enquiries'));

    let unresolvedOnly = false;
    if (text.includes('unresolved') || text.includes('pending') || text.includes('attention') || text.includes('need attention')) {
      unresolvedOnly = true;
      logs.push(createLog('gemini', 'Filter applied: unresolved = true'));
    }

    let categoryFilter: string | undefined = undefined;
    if (text.includes('tech')) {
      categoryFilter = 'cat-tech';
      logs.push(createLog('gemini', 'Filter applied: category = Technologies'));
    } else if (text.includes('academy')) {
      categoryFilter = 'cat-academy';
      logs.push(createLog('gemini', 'Filter applied: category = Academy'));
    }

    let filtered = enquiries;
    if (unresolvedOnly) {
      filtered = filtered.filter(e => e.interested === null || e.follow_up_done === null || e.can_follow_up === null);
    }
    if (categoryFilter) {
      filtered = filtered.filter(e => e.category_id === categoryFilter);
    }

    logs.push(createLog('success', `Fetched ${filtered.length} enquiries.`));
    
    const countStr = `${filtered.length} ${unresolvedOnly ? 'unresolved ' : ''}enquiries`;
    const listStr = filtered.map(e => {
      const course = courses.find(c => c.id === e.course_id);
      return `- ${e.contact_name} enquired about ${course?.name || 'unknown course'}`;
    }).join('\n');

    return {
      reply: `Found ${countStr}:\n${listStr || 'No matching enquiries.'}`,
      toolCalled: 'get_enquiries',
      args: { unresolvedOnly, category: categoryFilter },
      success: true,
      logs
    };
  }

  // Fallback: AI didn't match any intent
  logs.push(createLog('error', 'Could not parse matching command intent.'));
  return {
    reply: "I couldn't understand that command. Try something like:\n" +
           "- 'Add enquiry for Ashok Kumar, course Full Stack Developer, fee shared'\n" +
           "- 'Mark Ashok as interested and follow up done'\n" +
           "- 'Get me the Technologies courses'\n" +
           "- 'Delete Ashok's enquiry'",
    toolCalled: 'none',
    args: {},
    success: false,
    logs
  };
}
