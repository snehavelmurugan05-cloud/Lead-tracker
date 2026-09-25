export const getResendApiKey = (): string => {
  return localStorage.getItem('resend_api_key') || (import.meta.env.VITE_RESEND_API_KEY as string) || '';
};

export const setResendApiKey = (key: string): void => {
  if (key && key.trim()) {
    localStorage.setItem('resend_api_key', key.trim());
  } else {
    localStorage.removeItem('resend_api_key');
  }
};

export const createMailToLink = (
  employeeEmail: string,
  employeeName: string,
  taskTitle: string,
  taskDescription: string,
  dueDate: string,
  priority: string,
  assignedBy: string = 'Admin'
): string => {
  const formattedDueDate = dueDate ? new Date(dueDate).toLocaleDateString() : 'N/A';
  const subject = encodeURIComponent(`New Task Assigned: ${taskTitle}`);
  const body = encodeURIComponent(
    `Hello ${employeeName},\n\n` +
    `A new task has been assigned to you by ${assignedBy}.\n\n` +
    `--------------------------------------------------\n` +
    `Title: ${taskTitle}\n` +
    `Priority: ${priority}\n` +
    `Due Date: ${formattedDueDate}\n` +
    `Description: ${taskDescription || 'No description provided.'}\n` +
    `--------------------------------------------------\n\n` +
    `Please log in to the Global Minds Employee Portal to update your task status and submit your daily reports.\n\n` +
    `Best regards,\n` +
    `${assignedBy} · Global Minds`
  );
  return `mailto:${employeeEmail}?subject=${subject}&body=${body}`;
};

export interface SendTaskEmailResult {
  success: boolean;
  message?: string;
  mailToUrl: string;
}

export const sendTaskEmail = async (
  employeeEmail: string,
  employeeName: string,
  taskTitle: string,
  taskDescription: string,
  dueDate: string,
  priority: string,
  assignedBy: string = 'Admin'
): Promise<SendTaskEmailResult> => {
  const mailToUrl = createMailToLink(
    employeeEmail,
    employeeName,
    taskTitle,
    taskDescription,
    dueDate,
    priority,
    assignedBy
  );

  const RESEND_API_KEY = getResendApiKey();

  if (!RESEND_API_KEY) {
    return {
      success: false,
      message: 'Resend API key is not configured.',
      mailToUrl
    };
  }

  let priorityColor = '#3b82f6'; // Blue
  if (priority === 'High') priorityColor = '#ef4444'; // Red
  if (priority === 'Low') priorityColor = '#22c55e'; // Green

  const formattedDueDate = dueDate ? new Date(dueDate).toLocaleDateString() : 'N/A';

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
        <p style="margin: 0; color: #111827;"><strong>Due Date:</strong> ${formattedDueDate}</p>
      </div>
      
      <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
        Please log in to the employee portal or contact your manager for more details.
      </p>
    </div>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Global Minds <onboarding@resend.dev>',
        to: [employeeEmail],
        subject: `New Task Assigned: ${taskTitle}`,
        html: htmlContent,
      }),
    });

    if (res.ok) {
      return { success: true, mailToUrl };
    } else {
      const errorData = await res.json().catch(() => ({}));
      const msg = errorData.message || res.statusText || 'Resend API returned an error';
      return { success: false, message: msg, mailToUrl };
    }
  } catch (error: any) {
    return { success: false, message: error.message || 'Network error sending email', mailToUrl };
  }
};
