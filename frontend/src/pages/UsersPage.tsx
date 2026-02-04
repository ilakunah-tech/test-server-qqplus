import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import type { User, UserRole } from '@/types/api';
import { Users as UsersIcon, Plus, Trash2, X, Pencil } from 'lucide-react';
import { authStore } from '@/store/authStore';

export const UsersPage = () => {
  const queryClient = useQueryClient();
  const currentUserId = authStore((s) => s.userId);
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('user');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('user');

  const { data, isLoading, error } = useQuery({
    queryKey: ['auth', 'users'],
    queryFn: () => authApi.getUsers(),
  });

  const createUserMutation = useMutation({
    mutationFn: ({ username, email, password, role }: { username: string; email: string; password: string; role: UserRole }) =>
      authApi.createUser(username, email, password, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'users'] });
      setShowCreateForm(false);
      setNewUserUsername('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('user');
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      alert(err.response?.data?.detail ?? 'Failed to create user');
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      authApi.updateUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'users'] });
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      alert(err.response?.data?.detail ?? 'Failed to update role');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => authApi.deleteUser(userId),
    onSuccess: () => {
      setDeleteError(null);
      queryClient.invalidateQueries({ queryKey: ['auth', 'users'] });
    },
    onError: (err: { response?: { data?: { detail?: string | string[] } } }) => {
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail) ? String(detail[0] ?? detail) : detail ?? 'Failed to delete user';
      setDeleteError(msg);
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({
      userId,
      username,
      email,
      password,
      role,
    }: {
      userId: string;
      username?: string;
      email?: string;
      password?: string;
      role?: UserRole;
    }) => authApi.updateUser(userId, { username, email, password, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'users'] });
      setEditingUser(null);
      setEditUsername('');
      setEditEmail('');
      setEditPassword('');
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      alert(err.response?.data?.detail ?? 'Failed to update user');
    },
  });

  const users: User[] = data?.data ?? [];

  const openEditUser = (user: User) => {
    setEditingUser(user);
    setEditUsername(user.username ?? '');
    setEditEmail(user.email);
    setEditPassword('');
    setEditRole(user.role);
  };

  const handleEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editUsername.trim() || !editEmail.trim()) {
      alert('Username and email are required');
      return;
    }
    if (editPassword && editPassword.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }
    updateUserMutation.mutate({
      userId: editingUser.id,
      username: editUsername.trim(),
      email: editEmail.trim(),
      password: editPassword || undefined,
      role: editRole,
    });
  };

  const handleRoleChange = (user: User, newRole: UserRole) => {
    if (user.role === newRole) return;
    updateRoleMutation.mutate({ userId: user.id, role: newRole });
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserUsername.trim() || !newUserEmail || !newUserPassword) {
      alert('Username, email and password are required');
      return;
    }
    if (newUserPassword.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }
    createUserMutation.mutate({
      username: newUserUsername.trim(),
      email: newUserEmail,
      password: newUserPassword,
      role: newUserRole,
    });
  };

  const handleDeleteUser = (user: User) => {
    setDeleteError(null);
    if (user.id === currentUserId) {
      setDeleteError('You cannot delete yourself');
      return;
    }
    if (confirm(`Are you sure you want to delete user ${user.username ?? user.email}?`)) {
      deleteUserMutation.mutate(user.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-gray-500 dark:text-gray-400">Loading users...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-red-600 dark:text-red-400">Failed to load users.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <UsersIcon className="w-8 h-8 text-brand" />
            Users
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Manage users, roles, and permissions. Only admins can access this page.
          </p>
        </div>
        <Button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2"
        >
          {showCreateForm ? (
            <>
              <X className="w-4 h-4" />
              Cancel
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Add User
            </>
          )}
        </Button>
      </div>

      {showCreateForm && (
        <Card className="border-purple-200/60 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-lg">Create New User</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    value={newUserUsername}
                    onChange={(e) => setNewUserUsername(e.target.value)}
                    placeholder="Display name"
                    required
                    maxLength={64}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="user@example.com"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    required
                    minLength={8}
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select
                    id="role"
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createUserMutation.isPending}>
                  {createUserMutation.isPending ? 'Creating...' : 'Create User'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {deleteError && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-red-700 dark:text-red-300 text-sm flex items-center justify-between">
          <span>{deleteError}</span>
          <button
            type="button"
            onClick={() => setDeleteError(null)}
            className="text-red-500 hover:text-red-700 dark:hover:text-red-400"
          >
            ×
          </button>
        </div>
      )}

      {editingUser && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            aria-hidden
            onClick={() => { setEditingUser(null); setEditPassword(''); }}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-card border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Редактировать пользователя</h3>
            <form onSubmit={handleEditUser} className="space-y-4">
              <div>
                <Label htmlFor="edit-username">Username</Label>
                <Input
                  id="edit-username"
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  placeholder="Display name"
                  required
                  maxLength={64}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-password">Новый пароль</Label>
                <Input
                  id="edit-password"
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Оставьте пустым, чтобы не менять"
                  minLength={editPassword ? 8 : undefined}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-role">Role</Label>
                <Select
                  id="edit-role"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="mt-1 w-full"
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </Select>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setEditingUser(null); setEditPassword(''); }}
                >
                  Отмена
                </Button>
                <Button type="submit" disabled={updateUserMutation.isPending}>
                  {updateUserMutation.isPending ? 'Сохранение…' : 'Сохранить'}
                </Button>
              </div>
            </form>
          </div>
        </>
      )}

      <Card className="border-purple-200/60 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg">All Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-600">
                  <th className="text-left py-3 px-2 font-medium text-gray-700 dark:text-gray-300">
                    Username
                  </th>
                  <th className="text-left py-3 px-2 font-medium text-gray-700 dark:text-gray-300">
                    Email
                  </th>
                  <th className="text-left py-3 px-2 font-medium text-gray-700 dark:text-gray-300">
                    Role
                  </th>
                  <th className="text-left py-3 px-2 font-medium text-gray-700 dark:text-gray-300">
                    Status
                  </th>
                  <th className="text-left py-3 px-2 font-medium text-gray-700 dark:text-gray-300">
                    Created
                  </th>
                  <th className="text-right py-3 px-2 font-medium text-gray-700 dark:text-gray-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-gray-100 dark:border-gray-700/80 hover:bg-purple-50/50 dark:hover:bg-gray-800/50"
                  >
                    <td className="py-3 px-2 text-gray-900 dark:text-gray-100">
                      {user.username ?? '—'}
                      {user.id === currentUserId && (
                        <span className="ml-2 text-xs text-brand">(you)</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-gray-700 dark:text-gray-300">
                      {user.email}
                    </td>
                    <td className="py-3 px-2">
                      <Select
                        value={user.role}
                        onChange={(e) =>
                          handleRoleChange(user, e.target.value as UserRole)
                        }
                        disabled={updateRoleMutation.isPending}
                        className="w-28"
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </Select>
                    </td>
                    <td className="py-3 px-2">
                      <span
                        className={
                          user.is_active
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }
                      >
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-gray-600 dark:text-gray-400">
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="py-3 px-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="Редактировать"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditUser(user);
                          }}
                          disabled={updateUserMutation.isPending}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                          title={user.id === currentUserId ? 'Cannot delete yourself' : `Delete ${user.username ?? user.email}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteUser(user);
                          }}
                          disabled={
                            user.id === currentUserId || deleteUserMutation.isPending
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {users.length === 0 && (
            <p className="text-center py-8 text-gray-500 dark:text-gray-400">
              No users found.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
