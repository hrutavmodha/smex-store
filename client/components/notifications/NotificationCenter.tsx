'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Inbox, ExternalLink, Rocket, AlertTriangle, X } from 'lucide-react';
import { fetchWithAuth, getWebSocketUrl } from '../../lib/api';
import type { NotificationEnvelope } from '@smex/shared';

export interface NotificationCenterProps {
  user?: {
    uid?: string;
    id?: string;
    email: string;
    ign?: string;
  } | null;
}

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  type: 'order' | 'incident' | 'system';
  actionUrl?: string;
}

export function NotificationCenter({ user }: NotificationCenterProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationEnvelope[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const accountId = user?.id || user?.uid;

  const addToast = (item: Omit<ToastItem, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newToast: ToastItem = { ...item, id };
    setToasts((prev) => [newToast, ...prev].slice(0, 4));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 7000);
  };

  // Fetch notifications on mount if user is present
  useEffect(() => {
    if (!accountId) return;

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
  }, [accountId]);

  // Real-time WebSocket Gateway listener
  useEffect(() => {
    if (!accountId) return;

    const wsUrl = getWebSocketUrl();
    const targetUrl = `${wsUrl}/ws`;

    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(targetUrl);
      socket.onopen = () => {
        socket?.send(
          JSON.stringify({
            action: 'subscribe',
            channel: `user:${accountId}`,
          })
        );
      };

      socket.onmessage = (event) => {
        try {
          const frame = JSON.parse(event.data);
          if (frame.event === 'NEW_BOOSTING_ORDER') {
            const p = frame.payload || {};
            addToast({
              title: `🚀 New Boosting Order #${p.orderRef || ''}`,
              message: `${p.customerIgn || 'Customer'}: ${p.startingRank || ''} ➔ ${p.targetRank || ''} (₹${p.totalPriceInr || 0})`,
              type: 'order',
              actionUrl: '/boosting',
            });
            setUnreadCount((prev) => prev + 1);
          } else if (frame.event === 'TOURNAMENT_INCIDENT_FLAGGED') {
            const p = frame.payload || {};
            addToast({
              title: `⚠️ Incident Flagged [${String(p.severity || 'ALERT').toUpperCase()}]`,
              message: `${p.reportedByIgn || 'Manager'} reported ${p.targetTeamName || 'a squad'}: ${p.summary || p.incidentType || 'Incident'}`,
              type: 'incident',
              actionUrl: p.tournamentId ? `/tournaments/${p.tournamentId}` : '/tournaments',
            });
            setUnreadCount((prev) => prev + 1);
          } else if (frame.event === 'notification:new') {
            const incomingCount =
              frame.unreadCount !== undefined
                ? Number(frame.unreadCount)
                : undefined;

            setUnreadCount((prev) => (incomingCount !== undefined ? incomingCount : prev + 1));

            const rawItem = frame.data || frame;
            const newRecord: NotificationEnvelope = {
              id: rawItem.id || `notif-${Date.now()}`,
              recipientId: rawItem.recipientId || accountId,
              type: rawItem.type || 'system',
              title: rawItem.title || 'New Notification',
              message: rawItem.message || '',
              payload: rawItem.payload || {},
              isRead: false,
              createdAt: rawItem.createdAt || new Date().toISOString(),
            };

            setNotifications((prev) => [newRecord, ...prev.filter((n) => n.id !== newRecord.id)]);

            // Trigger real-time toast if matching special events
            if (rawItem.payload?.event === 'NEW_BOOSTING_ORDER') {
              addToast({
                title: rawItem.title || '🚀 New Boosting Order',
                message: rawItem.message,
                type: 'order',
                actionUrl: '/boosting',
              });
            } else if (rawItem.payload?.event === 'TOURNAMENT_INCIDENT_FLAGGED') {
              addToast({
                title: rawItem.title || '⚠️ Tournament Incident Flagged',
                message: rawItem.message,
                type: 'incident',
                actionUrl: rawItem.payload.tournamentId ? `/tournaments/${rawItem.payload.tournamentId}` : undefined,
              });
            }
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
  }, [accountId]);

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
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-border-subtle bg-bg-surface shadow-2xl z-50 flex flex-col overflow-hidden transition-all duration-[120ms]"
          style={{ backdropFilter: 'none' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-bg-surface-elevated">
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
          <div className="max-h-80 overflow-y-auto divide-y divide-border-subtle/40 bg-bg-surface">
            {notifications.length === 0 ? (
              <div
                data-testid="notification-empty"
                className="flex flex-col items-center justify-center py-8 px-4 text-center bg-bg-surface"
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
                    !notif.isRead ? 'bg-bg-surface-elevated' : 'bg-bg-surface'
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

      {/* Real-time Floating Toasts Portal */}
      {toasts.length > 0 && (
        <div
          data-testid="toast-container"
          className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              role="alert"
              data-testid={`toast-${toast.type}`}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-2xl backdrop-blur-md transition-all duration-200 ${
                toast.type === 'order'
                  ? 'bg-purple-950/95 border-purple-500/50 text-purple-200 shadow-purple-950/60'
                  : toast.type === 'incident'
                  ? 'bg-red-950/95 border-red-500/50 text-red-200 shadow-red-950/60'
                  : 'bg-bg-surface-elevated/95 border-emerald-500/40 text-text-primary shadow-black/60'
              }`}
            >
              <div className="shrink-0 pt-0.5">
                {toast.type === 'order' ? (
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/20 text-purple-300">
                    <Rocket className="h-4 w-4" />
                  </div>
                ) : toast.type === 'incident' ? (
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/20 text-red-400">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-primary">
                    <Bell className="h-4 w-4" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold tracking-tight text-white">{toast.title}</p>
                <p className="mt-0.5 text-xs text-text-secondary leading-snug break-words">
                  {toast.message}
                </p>
                {toast.actionUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      if (toast.actionUrl) router.push(toast.actionUrl);
                      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
                    }}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-primary hover:underline"
                  >
                    <span>View Details</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="text-text-muted hover:text-white shrink-0 p-1"
                aria-label="Dismiss toast"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
