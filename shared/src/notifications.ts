export type NotificationType = 'request' | 'update' | 'system';

export interface NotificationPayload {
  actionUrl?: string; // In-app destination route (e.g. "/teams/squad-123")
  entityType?: 'team' | 'tournament' | 'marketplace' | 'boosting' | 'user' | string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationEnvelope {
  id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  payload: NotificationPayload;
  isRead: boolean;
  createdAt: string;
}

export interface PaginatedNotificationsResult {
  unreadCount: number;
  notifications: NotificationEnvelope[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}
