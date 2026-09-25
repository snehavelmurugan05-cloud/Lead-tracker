import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { employeeEmail, employeeName, taskTitle, taskDescription, dueDate, priority, assignedBy } = await req.json()

    if (!employeeEmail) {
      throw new Error('Employee email is required')
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not set')
    }

    // Determine color based on priority
    let priorityColor = '#3b82f6' // Blue for Medium
    if (priority === 'High') priorityColor = '#ef4444' // Red
    if (priority === 'Low') priorityColor = '#22c55e' // Green

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #111827; margin-bottom: 20px;">New Task Assigned: ${taskTitle}</h2>
        <p style="color: #374151; font-size: 16px;">Hello ${employeeName},</p>
        <p style="color: #374151; font-size: 16px;">A new task has been assigned to you by <strong>${assignedBy}</strong>.</p>
        
        <div style="background-color: #f3f4f6; padding: 16px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0; color: #111827;"><strong>Title:</strong> ${taskTitle}</p>
          <p style="margin: 0 0 10px 0; color: #111827;"><strong>Description:</strong> ${taskDescription || 'No description provided.'}</p>
          <p style="margin: 0 0 10px 0; color: #111827;">
            <strong>Priority:</strong> 
            <span style="color: ${priorityColor}; font-weight: bold;">${priority}</span>
          </p>
          <p style="margin: 0; color: #111827;"><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>
        </div>
        
        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          Please log in to the employee portal or contact your manager for more details.
        </p>
      </div>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'Global Minds <tasks@resend.dev>', // You might need to change this if you verify a domain in Resend
        to: [employeeEmail],
        subject: `New Task Assigned: ${taskTitle}`,
        html: htmlContent
      })
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(`Resend Error: ${JSON.stringify(data)}`)
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully', data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
