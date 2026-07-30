import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Role } from '../types/roles';
import { ROLE_HOME, ROLE_LABELS, ROLES } from '../types/roles';

const STORAGE_KEY = 'cat_rental_role';

interface RoleContextValue {
  role: Role | null;
  roleLabel: string | null;
  setRole: (role: Role) => void;
  clearRole: () => void;
  homePath: string;
}

const RoleContext = createContext<RoleContextValue | null>(null);

function readStoredRole(): Role | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && (ROLES as string[]).includes(raw)) return raw as Role;
  } catch {
    /* ignore */
  }
  return null;
}

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role | null>(() => readStoredRole());

  useEffect(() => {
    if (role) localStorage.setItem(STORAGE_KEY, role);
    else localStorage.removeItem(STORAGE_KEY);
  }, [role]);

  const setRole = useCallback((r: Role) => setRoleState(r), []);
  const clearRole = useCallback(() => setRoleState(null), []);

  const value = useMemo<RoleContextValue>(
    () => ({
      role,
      roleLabel: role ? ROLE_LABELS[role] : null,
      setRole,
      clearRole,
      homePath: role ? ROLE_HOME[role] : '/login',
    }),
    [role, setRole, clearRole]
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used within RoleProvider');
  return ctx;
}
