import { getLocalEnquiries, getLocalNotes, resolveNoteStage } from './localDatabase';

let lastNotifiedTime = 0;

/**
 * Triggers a desktop notification using Electron's native OS Notification API
 * or standard HTML5 Notification API if in browser.
 */
export async function triggerDesktopNotification(title: string, body: string): Promise<boolean> {
  try {
    // 1. Electron Native Desktop Notification
    if (typeof window !== 'undefined' && (window as any).electronAPI?.sendNotification) {
      await (window as any).electronAPI.sendNotification(title, body);
      return true;
    }

    // 2. Browser Fallback Notification
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/global_minds_logo.png'
        });
        return true;
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          new Notification(title, {
            body,
            icon: '/global_minds_logo.png'
          });
          return true;
        }
      }
    }
  } catch (err) {
    console.warn('Desktop notification skipped or blocked:', err);
  }
  return false;
}

/**
 * Automatically inspects leads and notes for overdue or due-today reminders,
 * and triggers a native Windows desktop alert if any are pending.
 * Throttled to once every 20 minutes to avoid repetitive spam.
 */
export async function checkAndNotifyDueReminders(role: 'admin' | 'sales' | string = 'admin', force: boolean = false): Promise<void> {
  // Strictly prevent admin due leads and reminder alerts from showing on employee role
  if (role === 'employee') {
    return;
  }

  const now = Date.now();
  // Don't notify more than once every 20 minutes unless forced
  if (!force && now - lastNotifiedTime < 20 * 60 * 1000) {
    return;
  }

  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const nowDate = new Date();

    // 1. Check Due Lead Enquiries (ADMIN ONLY - Sales handles client leads & sales notes)
    const isSales = role === 'sales';
    const enquiries = !isSales ? getLocalEnquiries() : [];
    const dueLeads = enquiries.filter(e => {
      const isUnresolved = e.interested === null || e.follow_up_done === null || e.can_follow_up === null;
      if (!isUnresolved || !e.next_reminder_at) return false;
      return new Date(e.next_reminder_at) <= nowDate;
    });

    // 2. Check Due Notes (Properly exclude converted / completed notes)
    const notes = getLocalNotes(role);
    const dueNotes = notes.filter(n => {
      if (n.is_completed || !n.reminderDate) return false;
      if (n.stage === 'Converted' || n.stage === 'Customer Onboarding' || n.action_item === 'Converted') return false;
      if (resolveNoteStage(n) === 'Customer Onboarding') return false;
      return n.reminderDate <= todayStr;
    });

    const totalDue = dueLeads.length + dueNotes.length;

    if (totalDue > 0) {
      lastNotifiedTime = now;

      let title = '🔔 Follow-up Reminders Due';
      let message = `You have ${totalDue} reminder${totalDue === 1 ? '' : 's'} scheduled for today.`;

      if (dueLeads.length > 0 && dueNotes.length > 0) {
        message = `${dueLeads.length} client lead${dueLeads.length === 1 ? '' : 's'} and ${dueNotes.length} note reminder${dueNotes.length === 1 ? '' : 's'} require attention.`;
      } else if (dueLeads.length > 0) {
        message = `${dueLeads.length} lead${dueLeads.length === 1 ? '' : 's'} (${dueLeads.slice(0, 2).map(l => l.contact_name).join(', ')}) due for follow-up.`;
      } else if (dueNotes.length > 0) {
        message = `${dueNotes.length} task / discussion reminder${dueNotes.length === 1 ? '' : 's'} due today.`;
      }

      await triggerDesktopNotification(title, message);
    }
  } catch (err) {
    console.warn('Error during reminder desktop check:', err);
  }
}
