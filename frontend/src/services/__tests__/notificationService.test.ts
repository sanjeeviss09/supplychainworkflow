import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  AppNotification,
} from '../notificationService';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

describe('Phase 12 / QA: Notification Service', () => {
  const mockUserId = 'usr-12345';
  const mockNotifications: AppNotification[] = [
    {
      id: 'notif-1',
      recipient_user_id: mockUserId,
      notification_type: 'DOCUMENT_EXPIRING_SOON',
      title: 'Document Expiring Soon',
      message: 'Certificate ISO 9001 validity expires in 30 days',
      is_read: false,
      created_at: '2026-11-04T00:00:00Z',
    },
    {
      id: 'notif-2',
      recipient_user_id: mockUserId,
      notification_type: 'SUPPLY_RISK_ALERT',
      title: 'Critical Supply Risk',
      message: 'Active delivery delay breaches internal required-by date',
      is_read: true,
      created_at: '2026-11-03T10:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches notifications for the current authenticated user', async () => {
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: { id: mockUserId } },
    });

    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockReturnThis();
    const mockLimit = vi.fn().mockResolvedValue({ data: mockNotifications, error: null });

    (supabase.from as any).mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      order: mockOrder,
      limit: mockLimit,
    });

    // Wire chain
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      order: mockOrder,
    });
    mockOrder.mockReturnValue({
      limit: mockLimit,
    });

    const result = await fetchUserNotifications();
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Document Expiring Soon');
    expect(result[0].is_read).toBe(false);
  });

  it('marks a single notification as read', async () => {
    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockResolvedValue({ error: null });

    (supabase.from as any).mockReturnValue({
      update: mockUpdate,
    });
    mockUpdate.mockReturnValue({
      eq: mockEq,
    });

    const success = await markNotificationAsRead('notif-1');
    expect(success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({ is_read: true });
    expect(mockEq).toHaveBeenCalledWith('id', 'notif-1');
  });

  it('marks all unread notifications as read for current user', async () => {
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: { id: mockUserId } },
    });

    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq1 = vi.fn().mockReturnThis();
    const mockEq2 = vi.fn().mockResolvedValue({ error: null });

    (supabase.from as any).mockReturnValue({
      update: mockUpdate,
    });
    mockUpdate.mockReturnValue({
      eq: mockEq1,
    });
    mockEq1.mockReturnValue({
      eq: mockEq2,
    });

    const success = await markAllNotificationsAsRead();
    expect(success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({ is_read: true });
  });

  it('handles unauthenticated session gracefully by returning empty array', async () => {
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: null },
    });

    const result = await fetchUserNotifications();
    expect(result).toEqual([]);
  });
});

