'use client';

import { useState, useCallback } from 'react';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';

interface UserRow {
  id: string;
  name: string | null;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: Date;
  _count: { diagnosticSessions: number };
}

interface UserTableProps {
  users: UserRow[];
  totalCount: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
        checked ? 'bg-mp-blue-500' : 'bg-mp-gray-300',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
          checked ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  );
}

export function UserTable({ users, totalCount, page, totalPages, onPageChange }: UserTableProps) {
  const utils = trpc.useUtils();
  const toggleField = trpc.admin.toggleUserField.useMutation({
    onSuccess: () => {
      utils.admin.getUsers.invalidate();
    },
  });

  // Optimistic state: track pending toggles
  const [optimistic, setOptimistic] = useState<Record<string, Record<string, boolean>>>({});

  const handleToggle = useCallback(
    (userId: string, field: 'isAdmin' | 'isActive', currentValue: boolean) => {
      // Optimistic update
      setOptimistic((prev) => ({
        ...prev,
        [userId]: { ...prev[userId], [field]: !currentValue },
      }));

      toggleField.mutate(
        { userId, field },
        {
          onError: () => {
            // Revert optimistic
            setOptimistic((prev) => {
              const copy = { ...prev };
              if (copy[userId]) {
                delete copy[userId][field];
                if (Object.keys(copy[userId]).length === 0) delete copy[userId];
              }
              return copy;
            });
          },
          onSettled: () => {
            // Clear optimistic after server responds
            setOptimistic((prev) => {
              const copy = { ...prev };
              if (copy[userId]) {
                delete copy[userId][field];
                if (Object.keys(copy[userId]).length === 0) delete copy[userId];
              }
              return copy;
            });
          },
        },
      );
    },
    [toggleField],
  );

  const getFieldValue = (userId: string, field: string, serverValue: boolean) => {
    if (optimistic[userId] && field in optimistic[userId]) {
      return optimistic[userId][field];
    }
    return serverValue;
  };

  if (users.length === 0) {
    return (
      <div className="text-center py-12 text-mp-gray-500">
        <p className="text-body-md">No users found</p>
      </div>
    );
  }

  return (
    <div>
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-mp-gray-200">
              <th className="px-4 py-3 text-xs font-semibold text-mp-gray-500 uppercase tracking-wider">User</th>
              <th className="px-4 py-3 text-xs font-semibold text-mp-gray-500 uppercase tracking-wider">Registered</th>
              <th className="px-4 py-3 text-xs font-semibold text-mp-gray-500 uppercase tracking-wider text-center">Diagnostics</th>
              <th className="px-4 py-3 text-xs font-semibold text-mp-gray-500 uppercase tracking-wider text-center">Active</th>
              <th className="px-4 py-3 text-xs font-semibold text-mp-gray-500 uppercase tracking-wider text-center">Admin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mp-gray-100">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-mp-gray-50 transition-colors">
                {/* Avatar + Name */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-mp-blue-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-medium text-mp-blue-700">
                        {(user.name?.[0] || '?').toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-body-sm font-medium text-mp-gray-900">
                        {user.name || 'Unnamed'}
                      </p>
                      <p className="text-xs text-mp-gray-400 truncate max-w-[200px]">
                        {user.id.slice(0, 8)}...
                      </p>
                    </div>
                  </div>
                </td>

                {/* Registration date */}
                <td className="px-4 py-3 text-body-sm text-mp-gray-600">
                  {formatDate(user.createdAt)}
                </td>

                {/* Diagnostics count */}
                <td className="px-4 py-3 text-center">
                  <span className="text-body-sm font-medium text-mp-gray-900">
                    {user._count.diagnosticSessions}
                  </span>
                </td>

                {/* isActive toggle */}
                <td className="px-4 py-3 text-center">
                  <Toggle
                    checked={getFieldValue(user.id, 'isActive', user.isActive)}
                    onChange={() => handleToggle(user.id, 'isActive', user.isActive)}
                    disabled={toggleField.isPending}
                  />
                </td>

                {/* isAdmin toggle */}
                <td className="px-4 py-3 text-center">
                  <Toggle
                    checked={getFieldValue(user.id, 'isAdmin', user.isAdmin)}
                    onChange={() => handleToggle(user.id, 'isAdmin', user.isAdmin)}
                    disabled={toggleField.isPending}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-mp-gray-200">
        <p className="text-body-sm text-mp-gray-500">
          {totalCount} users total
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1.5 text-body-sm font-medium rounded-lg border border-mp-gray-200 text-mp-gray-600 hover:bg-mp-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-body-sm text-mp-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-body-sm font-medium rounded-lg border border-mp-gray-200 text-mp-gray-600 hover:bg-mp-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
