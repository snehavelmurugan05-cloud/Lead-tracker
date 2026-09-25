import { supabase, isSupabaseConfigured } from './supabaseClient';
import { simulateAssistant } from './geminiSim';
import { callBrowserAssistant } from './browserAssistant';
import type { AssistantResponse } from './geminiSim';

const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

export async function callAssistant(
  command: string, 
  forceDemo: boolean = false
): Promise<AssistantResponse> {
  
  // If client-side Gemini key is provided, execute directly via browser assistant for lightning-fast response times (~0.5s)
  if (geminiApiKey) {
    return callBrowserAssistant(command, forceDemo);
  }

  if (!isSupabaseConfigured() || !supabase) {
    return simulateAssistant(command);
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    // 3-second timeout controller to prevent UI hanging on slow server cold-starts
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assistant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || import.meta.env.VITE_SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ command }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Edge Function returned status: ${response.status}`);
    }

    const result = await response.json();
    
    // Construct rich logs for Supabase response
    return {
      reply: result.reply,
      toolCalled: result.toolCalled || 'unknown',
      args: result.args || {},
      success: result.success !== false,
      logs: [
        {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toLocaleTimeString(),
          prefix: 'system',
          content: 'Dispatched command to Supabase Edge Function `assistant`.'
        },
        {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toLocaleTimeString(),
          prefix: 'gemini',
          content: `Received natural language response: "${result.reply}"`
        },
        {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toLocaleTimeString(),
          prefix: 'success',
          content: `Executed tool [${result.toolCalled || 'none'}] against database.`
        }
      ]
    };
  } catch (error: any) {
    console.warn('Supabase Edge Function failed, falling back to browser-side AI parser:', error);
    
    if (geminiApiKey) {
      const browserResult = await callBrowserAssistant(command, false);
      return {
        ...browserResult,
        logs: [
          {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toLocaleTimeString(),
            prefix: 'error',
            content: `Network / server error: ${error.message || 'Unknown error'}.`
          },
          {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toLocaleTimeString(),
            prefix: 'system',
            content: 'Failing over to Client-Side browser Gemini AI engine...'
          },
          ...browserResult.logs
        ]
      };
    }

    const simResult = await simulateAssistant(command);
    return {
      ...simResult,
      logs: [
        {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toLocaleTimeString(),
          prefix: 'error',
          content: `Network / server error: ${error.message || 'Unknown error'}.`
        },
        {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toLocaleTimeString(),
          prefix: 'system',
          content: 'Failing over to Client-Side AI Simulation engine...'
        },
        ...simResult.logs
      ]
    };
  }
}
export type { AssistantResponse };
