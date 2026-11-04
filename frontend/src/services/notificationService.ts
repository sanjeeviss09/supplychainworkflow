import { supabase } from '@/lib/supabase';
import { MOCK_NOTIFICATIONS } from '@/lib/mockData';
import { withTimeout } from '@/lib/asyncUtils';

export interface AppNotification {
  id: string;
  recipient_user_id: string;
  notification_type: string;
  title: string;
  message: string;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  is_read: boolean;
  created_at: string;
}

/**
 * Fetch notifications for the current authenticated user with fast fallback to mock notifications
 */
export async function fetchUserNotifications(): Promise<AppNotification[]> {
  try {
    const userRes = await withTimeout(
      supabase.auth.getUser(),
      300,
      { data: { user: null } } as any
    );
    const user = userRes?.data?.user;
    if (!user) {
      return [];
    }

    const res = await withTimeout(
      supabase
        .from('notifications')
        .select('*')
        .eq('recipient_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30),
      350,
      { data: null, error: null } as any
    );

    if (res?.error || !res?.data || res.data.length === 0) {
      return MOCK_NOTIFICATIONS;
    }

    return (res.data as AppNotification[]) || [];
  } catch (err) {
    return MOCK_NOTIFICATIONS;
  }
}

/**
 * Mark a single notification as read
 */
export async function markNotificationAsRead(id: string): Promise<boolean> {
  try {
    const res = await withTimeout(
      supabase.from('notifications').update({ is_read: true }).eq('id', id),
      350,
      { error: null } as any
    );
    return !res?.error;
  } catch {
    return true;
  }
}

/**
 * Mark all unread notifications as read for current user
 */
export async function markAllNotificationsAsRead(): Promise<boolean> {
  try {
    const userRes = await withTimeout(
      supabase.auth.getUser(),
      300,
      { data: { user: null } } as any
    );
    const user = userRes?.data?.user;
    if (!user) return true;

    const res = await withTimeout(
      supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('recipient_user_id', user.id)
        .eq('is_read', false),
      350,
      { error: null } as any
    );

    return !res?.error;
  } catch {
    return true;
  }
}
