import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { authApi } from '../api/platform';
import { readApiSession, writeApiSession } from '../api/client';
import type { DashboardUser } from '../api/types';
import type { Role } from '../types/roles';
import { API_ROLE, ROLE_HOME, ROLE_LABELS, ROLES, roleFromApi } from '../types/roles';

interface RoleContextValue {
  role: Role | null;
  roleLabel: string | null;
  user: DashboardUser | null;
  login: (input: { email: string; password: string; role: Role }) => Promise<void>;
  setRole: (role: Role) => void;
  clearRole: () => void;
  refreshSession: () => Promise<void>;
  homePath: string;
}

const RoleContext = createContext<RoleContextValue | null>(null);

function initialRole(): Role | null {
  const session = readApiSession();
  if (!session) return null;
  const mapped = roleFromApi(session.role);
  return mapped && ROLES.includes(mapped) ? mapped : null;
}

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role | null>(() => initialRole());
  const [user, setUser] = useState<DashboardUser | null>(null);

  const login = useCallback(async (input: { email: string; password: string; role: Role }) => {
    const apiRole = API_ROLE[input.role];
    const result = await authApi.login({
      email: input.email,
      password: input.password,
      role: apiRole,
      companyId: input.role === 'dealer' ? null : 1,
      dealerId: input.role === 'dealer' ? 1 : null,
      siteId: input.role === 'site_manager' || input.role === 'operator' ? 1 : null,
      actorId: input.email,
    });
    writeApiSession({
      accessToken: result.accessToken,
      actorId: result.user.actorId,
      role: result.user.role,
      companyId: result.user.companyId,
      dealerId: result.user.dealerId,
      siteId: result.user.siteId,
    });
    setUser(result.user);
    setRoleState(input.role);
  }, []);

  /** Retained for local role switching while still using backend header authentication. */
  const setRole = useCallback((nextRole: Role) => {
    const apiRole = API_ROLE[nextRole];
    writeApiSession({
      actorId: `demo-${nextRole}`,
      role: apiRole,
      companyId: nextRole === 'dealer' ? null : 1,
      dealerId: nextRole === 'dealer' ? 1 : null,
      siteId: nextRole === 'site_manager' || nextRole === 'operator' ? 1 : null,
    });
    setUser(null);
    setRoleState(nextRole);
  }, []);

  const clearRole = useCallback(() => {
    writeApiSession(null);
    setUser(null);
    setRoleState(null);
  }, []);

  const refreshSession = useCallback(async () => {
    const refreshed = await authApi.refresh();
    const nextRole = roleFromApi(refreshed.user.role);
    writeApiSession({
      accessToken: refreshed.accessToken,
      actorId: refreshed.user.actorId,
      role: refreshed.user.role,
      companyId: refreshed.user.companyId,
      dealerId: refreshed.user.dealerId,
      siteId: refreshed.user.siteId,
    });
    setUser(refreshed.user);
    if (nextRole) setRoleState(nextRole);
  }, []);

  const value = useMemo<RoleContextValue>(
    () => ({
      role,
      roleLabel: role ? ROLE_LABELS[role] : null,
      user,
      login,
      setRole,
      clearRole,
      refreshSession,
      homePath: role ? ROLE_HOME[role] : '/login',
    }),
    [role, user, login, setRole, clearRole, refreshSession],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used within RoleProvider');
  return ctx;
}
