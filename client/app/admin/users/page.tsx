'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Shield,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  UserX,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { fetchWithAuth } from '../../../lib/api';
import type { AdminUserListItem, UserRole } from '@smex/shared';

export default function AdminUsersPage() {
  const [usersList, setUsersList] = useState<AdminUserListItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const limit = 20;

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      }
      if (roleFilter !== 'all') {
        params.set('role', roleFilter);
      }

      const res = await fetchWithAuth(`/api/v1/admin/users?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUsersList(data.users || []);
        setTotalCount(data.total || 0);
      } else {
        const err = await res.json().catch(() => ({}));
        setNotification({
          type: 'error',
          message: err.detail || err.message || 'Failed to load user directory',
        });
      }
    } catch {
      setNotification({
        type: 'error',
        message: 'Network error while retrieving user list',
      });
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery, roleFilter]);

  useEffect(() => {
    let ignore = false;
    const fetchUsers = async () => {
      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('limit', String(limit));
        if (searchQuery.trim()) params.set('search', searchQuery.trim());
        if (roleFilter !== 'all') params.set('role', roleFilter);

        const res = await fetchWithAuth(`/api/v1/admin/users?${params.toString()}`);
        if (!ignore) {
          if (res.ok) {
            const data = await res.json();
            setUsersList(data.users || []);
            setTotalCount(data.total || 0);
          } else {
            const err = await res.json().catch(() => ({}));
            setNotification({
              type: 'error',
              message: err.detail || err.message || 'Failed to load user directory',
            });
          }
        }
      } catch {
        if (!ignore) {
          setNotification({
            type: 'error',
            message: 'Network error while retrieving user list',
          });
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    void fetchUsers();
    return () => {
      ignore = true;
    };
  }, [page, searchQuery, roleFilter]);

  const handleUpdateRole = async (targetUser: AdminUserListItem, newRole: UserRole) => {
    setActionLoadingId(targetUser.id);
    setNotification(null);

    try {
      const res = await fetchWithAuth(`/api/v1/admin/users/${targetUser.id}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        // Optimistic update in list
        setUsersList((prev) =>
          prev.map((u) => (u.id === targetUser.id ? { ...u, role: newRole } : u))
        );
        const actionLabel = newRole === 'manager' ? 'promoted to Manager' : 'demoted to User';
        setNotification({
          type: 'success',
          message: `User ${targetUser.username || targetUser.email} successfully ${actionLabel}.`,
        });
      } else {
        const err = await res.json().catch(() => ({}));
        setNotification({
          type: 'error',
          message: err.detail || err.message || 'Failed to update user role',
        });
      }
    } catch {
      setNotification({
        type: 'error',
        message: 'Network error while attempting role update',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-primary border border-emerald-500/30">
            <ShieldCheck className="h-3.5 w-3.5" />
            Admin
          </span>
        );
      case 'manager':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/15 text-purple-400 border border-purple-500/40">
            <Shield className="h-3.5 w-3.5" />
            Standing Manager
          </span>
        );
      case 'user':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-bg-surface-elevated text-text-secondary border border-border-subtle">
            User
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-bg-surface-elevated border border-border-subtle text-emerald-primary">
              <Users className="h-5 w-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-text-primary tracking-tight">
              User & Role Management
            </h1>
          </div>
          <p className="mt-1 text-xs text-text-secondary">
            Assign Standing Manager privileges, manage user roles, and monitor account states.
          </p>
        </div>

        <button
          type="button"
          onClick={loadUsers}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-bg-surface border border-border-subtle text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-surface-elevated transition-colors duration-[120ms] disabled:opacity-50 min-h-[36px]"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-emerald-primary' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Notifications Alert Banner */}
      {notification && (
        <div
          role="alert"
          className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-medium ${
            notification.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-primary'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notification.type === 'success' ? (
              <CheckCircle className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-text-muted hover:text-text-primary ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filters & Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search users by email or IGN..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-bg-surface border border-border-subtle text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-emerald-primary transition-colors duration-[120ms]"
          />
        </div>

        <div>
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3.5 py-2.5 rounded-xl bg-bg-surface border border-border-subtle text-xs text-text-primary focus:outline-none focus:border-emerald-primary transition-colors duration-[120ms]"
          >
            <option value="all">All Roles</option>
            <option value="manager">Standing Managers Only</option>
            <option value="user">Normal Users Only</option>
            <option value="admin">Platform Admins Only</option>
          </select>
        </div>
      </div>

      {/* User Table Card */}
      <div className="rounded-2xl border border-border-subtle bg-bg-surface overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border-subtle bg-bg-canvas text-text-secondary uppercase tracking-wider font-mono font-semibold">
                <th className="py-3.5 px-4">User / Account</th>
                <th className="py-3.5 px-4">In-Game ID</th>
                <th className="py-3.5 px-4">Current Role</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Joined</th>
                <th className="py-3.5 px-4 text-right">Role Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-text-primary">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-text-muted">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-emerald-primary border-t-transparent rounded-full animate-spin" />
                      <span>Loading registered users...</span>
                    </div>
                  </td>
                </tr>
              ) : usersList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-text-muted">
                    No users matching criteria
                  </td>
                </tr>
              ) : (
                usersList.map((targetUser) => {
                  const isProcessing = actionLoadingId === targetUser.id;
                  const isTargetAdmin = targetUser.role === 'admin';
                  const isTargetManager = targetUser.role === 'manager';

                  return (
                    <tr
                      key={targetUser.id}
                      className="hover:bg-bg-surface-elevated transition-colors duration-[120ms]"
                    >
                      {/* User / Email */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-text-primary">
                            {targetUser.username || 'No IGN'}
                          </span>
                          <span className="text-[11px] text-text-secondary font-mono">
                            {targetUser.email}
                          </span>
                        </div>
                      </td>

                      {/* In-Game ID */}
                      <td className="py-3.5 px-4 font-mono text-text-secondary">
                        {targetUser.inGameId || '—'}
                      </td>

                      {/* Role Badge */}
                      <td className="py-3.5 px-4">
                        {getRoleBadge(targetUser.role)}
                      </td>

                      {/* Account Status */}
                      <td className="py-3.5 px-4">
                        {targetUser.isBanned ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-red-500/10 text-red-400 border border-red-500/30">
                            <ShieldAlert className="h-3 w-3" />
                            Banned
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-emerald-primary font-medium text-[11px]">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-primary" />
                            Active
                          </span>
                        )}
                      </td>

                      {/* Joined Date */}
                      <td className="py-3.5 px-4 text-text-secondary font-mono text-[11px]">
                        {new Date(targetUser.createdAt).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {isTargetAdmin ? (
                          <span className="text-[11px] text-text-muted font-mono">
                            Protected Admin
                          </span>
                        ) : isTargetManager ? (
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleUpdateRole(targetUser, 'user')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 font-bold text-xs transition-colors duration-[120ms] disabled:opacity-50"
                          >
                            <UserX className="h-3.5 w-3.5" />
                            <span>{isProcessing ? 'Revoking...' : 'Demote to User'}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleUpdateRole(targetUser, 'manager')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-500/40 bg-purple-500/15 text-purple-300 hover:bg-purple-500/25 font-bold text-xs transition-colors duration-[120ms] disabled:opacity-50"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            <span>{isProcessing ? 'Promoting...' : 'Promote to Manager'}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border-subtle bg-bg-canvas text-xs text-text-secondary font-mono">
          <span>
            Total: {totalCount} registered accounts
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 rounded bg-bg-surface border border-border-subtle hover:bg-bg-surface-elevated disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-2 font-bold text-text-primary">Page {page}</span>
            <button
              type="button"
              disabled={page * limit >= totalCount || isLoading}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 rounded bg-bg-surface border border-border-subtle hover:bg-bg-surface-elevated disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
