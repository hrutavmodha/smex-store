'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Inbox, ExternalLink } from 'lucide-react';
import { fetchWithAuth, getStoredToken } from '../../lib/api';
import type { NotificationEnvelope } from '@smex/shared';

export interface NotificationCenterProps {
  user?: {
    uid: string;
    email: string;
    ign?: string;
  } | null;
}

export function NotificationCenter({ user }: NotificationCenterProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationEnvelope[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notifications on mount if user is present
  useEffect(() => {
    if (!user?.uid) return;

    let isMounted = true;
    async function loadNotifications() {
      try {
        const res = await fetchWithAuth('/api/v1/notifications?limit=20');
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setNotifications(data.notifications || []);
            setUnreadCount(data.unreadCount ?? 0);
          }
        }
      } catch {
        // Fallback gracefully
      }
    }

    loadNotifications();

    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  // Real-time WebSocket Gateway listener
  useEffect(() => {
    if (!user?.uid) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
    const token = getStoredToken();
    const targetUrl = token ? `${wsUrl}/ws?token=${token}` : `${wsUrl}/ws`;

    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(targetUrl);
      socket.onopen = () => {
        socket?.send(
          JSON.stringify({
            action: 'subscribe',
            channel: `user:${user.uid}`,
          })
        );
      };

      socket.onmessage = (event) => {
        try {
          const frame = JSON.parse(event.data);
          if (frame.event === 'notification:new') {
            const incomingCount =
              frame.unreadCount !== undefined
                ? Number(frame.unreadCount)
                : undefined;

            setUnreadCount((prev) => (incomingCount !== undefined ? incomingCount : prev + 1));

            const rawItem = frame.data || frame;
            const newRecord: NotificationEnvelope = {
              id: rawItem.id || `notif-${Date.now()}`,
              recipientId: rawItem.recipientId || user.uid,
              type: rawItem.type || 'system',
              title: rawItem.title || 'New Notification',
              message: rawItem.message || '',
              payload: rawItem.payload || {},
              isRead: false,
              createdAt: rawItem.createdAt || new Date().toISOString(),
            };

            setNotifications((prev) => [newRecord, ...prev.filter((n) => n.id !== newRecord.id)]);
          }
        } catch {
          // Ignore invalid frames
        }
      };
    } catch {
      // Offline fallback
    }

    return () => {
      if (socket && (socket.readyState === 1 || socket.readyState === 0)) {
        socket.close();
      }
    };
  }, [user?.uid]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = async (notif: NotificationEnvelope) => {
    if (!notif.isRead) {
      // Optimistic unread decrement
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        await fetchWithAuth(`/api/v1/notifications/${notif.id}/read`, {
          method: 'PATCH',
        });
      } catch {
        // Suppress network failure
      }
    }

    if (notif.payload?.actionUrl) {
      setIsOpen(false);
      router.push(notif.payload.actionUrl);
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    try {
      await fetchWithAuth('/api/v1/notifications/read-all', {
        method: 'PATCH',
      });
    } catch {
      // Suppress network failure
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'request':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'update':
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      case 'system':
      default:
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Navbar Notification Bell Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center p-2 text-text-secondary hover:text-text-primary bg-bg-surface hover:bg-bg-surface-elevated rounded-lg border border-border-subtle transition-colors duration-[120ms] min-w-[40px] min-h-[40px]"
        aria-label="Notification Center"
        aria-expanded={isOpen}
        data-testid="notification-bell"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span
            data-testid="notification-badge"
            className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-[#22C58F] text-[#000000] text-[10px] font-bold shadow-md"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Card Center */}
      {isOpen && (
        <div
          data-testid="notification-dropdown"
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-border-subtle bg-[#121C19] shadow-2xl z-50 flex flex-col overflow-hidden transition-all duration-[120ms]"
          style={{ backdropFilter: 'none' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-[#0B0F12]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-wider uppercase text-text-primary">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#22C58F]/20 text-[#22C58F]">
                  {unreadCount} new
                </span>
              )}
            </div>
            {notifications.some((n) => !n.isRead) && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                data-testid="mark-all-read"
                className="flex items-center gap-1 text-[11px] font-medium text-emerald-primary hover:text-emerald-300 transition-colors duration-[120ms]"
              >
                <CheckCheck className="h-3 w-3" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Notifications List or Empty State */}
          <div className="max-h-80 overflow-y-auto divide-y divide-border-subtle/40 bg-[#121C19]">
            {notifications.length === 0 ? (
              <div
                data-testid="notification-empty"
                className="flex flex-col items-center justify-center py-8 px-4 text-center bg-[#000000]"
                style={{ backdropFilter: 'none' }}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-border-subtle/30 text-text-muted mb-2">
                  <Inbox className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-text-primary">
                  No new notifications
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  You&apos;re all caught up!
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  data-testid="notification-item"
                  onClick={() => handleNotificationClick(notif)}
                  className={`flex flex-col gap-1 p-3 text-left transition-colors duration-[120ms] cursor-pointer hover:bg-bg-surface-elevated ${
                    !notif.isRead ? 'bg-[#16211D]' : 'bg-[#121C19]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {!notif.isRead && (
                        <span className="h-2 w-2 rounded-full bg-[#22C58F] shrink-0" />
                      )}
                      <span className="text-xs font-semibold text-text-primary truncate">
                        {notif.title}
                      </span>
                    </div>
                    <span
                      className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 ${getTypeBadgeClass(
                        notif.type
                      )}`}
                    >
                      {notif.type}
                    </span>
                  </div>

                  <p className="text-xs text-text-muted line-clamp-2">
                    {notif.message}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-text-muted/80 mt-0.5">
                    <span>
                      {new Date(notif.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {notif.payload?.actionUrl && (
                      <span className="flex items-center gap-0.5 text-emerald-primary hover:underline">
                        <span>View</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
