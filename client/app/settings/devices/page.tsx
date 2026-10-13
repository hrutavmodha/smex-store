'use client';

import React, { useState, useEffect } from 'react';
import {
  Laptop,
  Smartphone,
  Globe,
  Shield,
  Trash2,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Clock,
  MapPin,
} from 'lucide-react';
import { fetchWithAuth } from '../../../lib/api';

export interface DeviceSession {
  id?: string;
  sessionId: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  deviceName: string;
  ipAddress: string;
  location?: string;
  isCurrent: boolean;
  createdAt: string;
  lastActive?: string;
  lastActiveAt?: string;
}

export function DeviceManagementDashboard() {
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [isRevokingOthers, setIsRevokingOthers] = useState(false);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      try {
        const response = await fetchWithAuth('/api/v1/devices/sessions');
        if (!response.ok) {
          throw new Error('Failed to load active device sessions');
        }
        const data = await response.json();
        if (!ignore) {
          const rawSessions = (data.sessions || []) as Record<string, unknown>[];
          const normalized: DeviceSession[] = rawSessions.map((s) => ({
            id: typeof s.id === 'string' ? s.id : (typeof s.sessionId === 'string' ? s.sessionId : undefined),
            sessionId: typeof s.sessionId === 'string' ? s.sessionId : String(s.id || ''),
            deviceType: (s.deviceType as DeviceSession['deviceType']) || 'unknown',
            deviceName: typeof s.deviceName === 'string' ? s.deviceName : 'Unknown Device',
            ipAddress: typeof s.ipAddress === 'string' ? s.ipAddress : '',
            location: typeof s.location === 'string' ? s.location : undefined,
            isCurrent: Boolean(s.isCurrent),
            createdAt: typeof s.createdAt === 'string' ? s.createdAt : (s.createdAt ? new Date(String(s.createdAt)).toISOString() : ''),
            lastActive: typeof s.lastActive === 'string' ? s.lastActive : (s.lastActiveAt ? new Date(String(s.lastActiveAt)).toISOString() : undefined),
          }));
          setSessions(normalized);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setErrorMessage(err instanceof Error ? err.message : 'Error fetching active sessions');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };
    void load();
    return () => {
      ignore = true;
    };
  }, []);

  const handleRevokeSingle = async (sessionId: string) => {
    setRevokingId(sessionId);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await fetchWithAuth(`/api/v1/devices/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to revoke session');
      }
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId && s.id !== sessionId));
      setSuccessMessage('Device session successfully revoked');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to revoke session');
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeOthers = async () => {
    setIsRevokingOthers(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await fetchWithAuth('/api/v1/devices/sessions/others', {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to revoke other sessions');
      }
      // Retain only current session
      setSessions((prev) => prev.filter((s) => s.isCurrent));
      setSuccessMessage('All other sessions successfully terminated');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to revoke other sessions');
    } finally {
      setIsRevokingOthers(false);
    }
  };

  const getDeviceIcon = (deviceType?: string) => {
    switch (deviceType) {
      case 'desktop':
        return <Laptop className="h-5 w-5 text-emerald-primary" />;
      case 'mobile':
        return <Smartphone className="h-5 w-5 text-emerald-primary" />;
      default:
        return <Globe className="h-5 w-5 text-cyan-depth" />;
    }
  };

  const otherSessionsCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Header & Action Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-border-subtle">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-emerald-primary" />
            <h1 className="text-xl font-black uppercase tracking-wider text-text-primary">
              Active Device Sessions
            </h1>
          </div>
          <p className="text-xs text-text-secondary max-w-lg">
            Manage your authenticated devices. Revoking a session immediately terminates access
            and requires re-authentication on that device.
          </p>
        </div>

        {/* Revoke All Other Sessions CTA */}
        {otherSessionsCount > 0 && (
          <button
            type="button"
            onClick={handleRevokeOthers}
            disabled={isRevokingOthers}
            data-testid="revoke-others-button"
            className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-red-400 bg-red-950/30 hover:bg-red-950/50 border border-red-900/50 rounded-lg transition-transform duration-[80ms] active:scale-[0.98] disabled:opacity-50 min-h-[44px]"
          >
            {isRevokingOthers ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            <span>Revoke All Other Sessions ({otherSessionsCount})</span>
          </button>
        )}
      </div>

      {/* Alerts */}
      {errorMessage && (
        <div
          role="alert"
          className="mt-4 flex items-center gap-2 p-3 text-xs text-red-400 bg-red-950/40 border border-red-800/60 rounded-lg"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="mt-4 flex items-center gap-2 p-3 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 rounded-lg"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Sessions Grid */}
      <div className="mt-6 flex flex-col gap-3" data-testid="device-sessions-list">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-primary" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-muted bg-bg-surface rounded-xl border border-border-subtle">
            No active sessions found.
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.sessionId}
              data-testid="device-session-card"
              data-current={session.isCurrent}
              className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-colors duration-[120ms] ${
                session.isCurrent
                  ? 'bg-bg-surface-elevated border-emerald-primary/40'
                  : 'bg-bg-surface border-border-subtle hover:border-border-prominent'
              }`}
            >
              {/* Device Details */}
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bg-canvas border border-border-subtle">
                  {getDeviceIcon(session.deviceType)}
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-text-primary" data-testid="device-name">
                      {session.deviceName || 'Unknown Device'}
                    </span>

                    {/* Current Device Badge */}
                    {session.isCurrent && (
                      <span
                        data-testid="current-device-badge"
                        className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide bg-emerald-primary/20 text-emerald-primary rounded-full border border-emerald-primary/40"
                      >
                        Current Device
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
                    <span className="font-mono text-text-muted" data-testid="device-ip">
                      {session.ipAddress}
                    </span>
                    {session.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-text-muted" />
                        {session.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-text-muted">
                      <Clock className="h-3 w-3" />
                      {session.lastActive || session.createdAt}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Remote Revoke */}
              {!session.isCurrent && (
                <div className="mt-3 sm:mt-0 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => handleRevokeSingle(session.sessionId)}
                    disabled={revokingId === session.sessionId}
                    data-testid="revoke-session-button"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-400 hover:text-red-300 bg-red-950/20 hover:bg-red-950/40 border border-red-900/40 rounded-lg transition-transform duration-[80ms] active:scale-[0.98] disabled:opacity-50 min-h-[44px]"
                  >
                    {revokingId === session.sessionId ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    <span>Revoke</span>
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default DeviceManagementDashboard;
