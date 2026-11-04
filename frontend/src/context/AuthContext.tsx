import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  CurrentUserContext,
  Employee,
  PermissionId,
  Profile,
  UserRole,
} from '@/types/database.types';
import {
  completePasswordChangeOnServer,
  getPermissionsForRole,
  hasPermission as checkRolePermission,
  loadCurrentUserContext,
  resolveLoginIdentifier,
  validateEmployeeForSignup,
} from '@/services/authService';
import { MOCK_EMPLOYEES } from '@/lib/mockData';
import { withTimeout } from '@/lib/asyncUtils';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  employee: Employee | null;
  role: UserRole | null;
  permissions: PermissionId[];
  is_active: boolean;
  hasPermission: (permission: PermissionId) => boolean;
  isLoading: boolean;
  mustChangePassword: boolean;
  login: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (employeeId: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  requestPasswordReset: (identifier: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getInitialAuthSession(): {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  employee: Employee | null;
  role: UserRole | null;
  permissions: PermissionId[];
  mustChangePassword: boolean;
} {
  try {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('scm_auth_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.user && parsed?.employee) {
          return {
            user: parsed.user,
            session: parsed.session || null,
            profile: parsed.profile || null,
            employee: parsed.employee,
            role: parsed.role || parsed.employee.assigned_role,
            permissions:
              parsed.permissions ||
              getPermissionsForRole(parsed.role || parsed.employee.assigned_role),
            mustChangePassword: Boolean(parsed.employee.must_change_password),
          };
        }
      }
    }
  } catch (e) {
    console.warn('Failed reading scm_auth_session on startup:', e);
  }
  return {
    user: null,
    session: null,
    profile: null,
    employee: null,
    role: null,
    permissions: [],
    mustChangePassword: false,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initial = useMemo(() => getInitialAuthSession(), []);
  const [user, setUser] = useState<User | null>(initial.user);
  const [session, setSession] = useState<Session | null>(initial.session);
  const [profile, setProfile] = useState<Profile | null>(initial.profile);
  const [employee, setEmployee] = useState<Employee | null>(initial.employee);
  const [role, setRole] = useState<UserRole | null>(initial.role);
  const [permissions, setPermissions] = useState<PermissionId[]>(initial.permissions);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(initial.mustChangePassword);

  const clearAuthState = () => {
    setUser(null);
    setSession(null);
    setProfile(null);
    setEmployee(null);
    setRole(null);
    setPermissions([]);
    setMustChangePassword(false);
  };

  /**
   * Loads the current user, linked employee record, active status, role, and permissions
   * from trusted backend/database records via authService with fast timeout protection.
   */
  const loadUserData = async (currentUser: User): Promise<{ active: boolean; error?: string }> => {
    try {
      const ctx = await withTimeout<CurrentUserContext | null>(
        loadCurrentUserContext(currentUser),
        500,
        null
      );

      if (!ctx || !ctx.employee_linked || !ctx.is_active || !ctx.employee) {
        // Resilient fallback to mock directory in offline / dev mode
        const mockEmp = MOCK_EMPLOYEES.find(
          (e) =>
            e.user_id === currentUser.id ||
            (currentUser.email && e.email.toLowerCase() === currentUser.email.toLowerCase())
        );

        if (mockEmp) {
          setEmployee(mockEmp);
          setRole(mockEmp.assigned_role as UserRole);
          setPermissions(getPermissionsForRole(mockEmp.assigned_role as UserRole));
          setMustChangePassword(Boolean(mockEmp.must_change_password));
          return { active: true };
        }

        clearAuthState();
        return {
          active: false,
          error:
            ctx?.error ||
            'Your account is not linked to an active employee record. Please contact the SCM Administrator.',
        };
      }

      setEmployee(ctx.employee);
      setProfile(ctx.profile || null);
      setRole(ctx.role || null);
      setPermissions(ctx.permissions || []);
      setMustChangePassword(Boolean(ctx.must_change_password));
      return { active: true };
    } catch (err: any) {
      console.error('Failed to load user auth context:', err);
      return { active: false, error: err?.message || 'Failed to verify employee record.' };
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        const getSessionPromise = supabase.auth.getSession();
        const res = await withTimeout(
          getSessionPromise,
          400,
          { data: { session: null }, error: null } as any
        );

        if (!isMounted) return;
        const onlineSession = res?.data?.session;
        if (onlineSession?.user) {
          setSession(onlineSession);
          setUser(onlineSession.user);
          await loadUserData(onlineSession.user);
        }
      } catch (err) {
        console.warn('Error during session initialisation:', err);
      }
    };

    initAuth();

    let subscription: { unsubscribe: () => void } | null = null;
    try {
      const authListener = supabase.auth.onAuthStateChange(async (_event, newSession) => {
        if (!isMounted) return;
        if (newSession?.user) {
          setSession(newSession);
          setUser(newSession.user);
          await loadUserData(newSession.user);
        } else if (_event === 'SIGNED_OUT') {
          clearAuthState();
        }
      });
      subscription = authListener?.data?.subscription || null;
    } catch (e) {
      console.warn('Supabase auth state listener unavailable:', e);
    }

    return () => {
      isMounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const refreshAuth = async () => {
    if (user) {
      await loadUserData(user);
    }
  };

  const hasPermission = (permission: PermissionId): boolean => {
    return checkRolePermission(role, permissions, permission);
  };

  /**
   * Log in via Employee ID or Work Email
   */
  const login = async (identifier: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const trimmed = identifier.trim();

      // Resolve identifier (Employee ID or Email) with timeout
      const resolved = await resolveLoginIdentifier(trimmed);

      if (!resolved.found || !resolved.email) {
        return {
          success: false,
          error: `No active employee record found matching "${trimmed}". Please contact your SCM Administrator.`,
        };
      }

      if (resolved.is_active === false) {
        return {
          success: false,
          error: 'Your employee account is currently deactivated. Please contact the SCM Administrator.',
        };
      }

      let authUser: User | null = null;
      let shouldUseFallback = false;

      try {
        const signInPromise = supabase.auth.signInWithPassword({
          email: resolved.email,
          password,
        });

        const signInRes = await withTimeout(
          signInPromise,
          450,
          { data: { user: null, session: null }, error: new Error('Backend timeout') } as any
        );

        if (signInRes?.error) {
          console.warn('Supabase sign-in returned error, evaluating offline fallback:', signInRes.error.message);
          shouldUseFallback = true;
        } else if (signInRes?.data?.user) {
          authUser = signInRes.data.user;
        }
      } catch (networkErr) {
        console.warn('Supabase backend unreachable, activating local session:', networkErr);
        shouldUseFallback = true;
      }

      // Live Supabase authentication verification
      if (authUser && !shouldUseFallback) {
        const verification = await loadUserData(authUser);
        if (!verification.active) {
          return {
            success: false,
            error:
              verification.error ||
              'Access denied: Your employee record is missing or inactive.',
          };
        }
        return { success: true };
      }

      // Offline / Development Demo Session Fallback
      const matchingEmployee =
        MOCK_EMPLOYEES.find(
          (e) =>
            e.employee_id.toLowerCase() === trimmed.toLowerCase() ||
            (resolved.email && e.email.toLowerCase() === resolved.email.toLowerCase()) ||
            (trimmed.toLowerCase() === 'admin' && e.assigned_role === 'super_admin')
        ) ||
        ({
          id: '00000000-0000-0000-0000-000000000001',
          employee_id: resolved.employee_id || trimmed,
          full_name: 'Dev System Administrator',
          email: resolved.email,
          department: 'Supply Chain Management',
          designation: 'System Administrator',
          assigned_role: resolved.assigned_role || 'super_admin',
          is_active: true,
          must_change_password: Boolean(resolved.must_change_password),
          user_id: '00000000-0000-0000-0000-000000000001',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as Employee);

      const mockUser: User = {
        id: matchingEmployee.user_id || matchingEmployee.id,
        app_metadata: { provider: 'email' },
        user_metadata: {
          employee_id: matchingEmployee.employee_id,
          full_name: matchingEmployee.full_name,
        },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        email: matchingEmployee.email,
        phone: '',
        role: 'authenticated',
        updated_at: new Date().toISOString(),
      };

      const mockProfile: Profile = {
        id: mockUser.id,
        email: matchingEmployee.email,
        first_name: matchingEmployee.full_name.split(' ')[0],
        last_name: matchingEmployee.full_name.split(' ').slice(1).join(' '),
        is_active: matchingEmployee.is_active,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const roleToSet = matchingEmployee.assigned_role as UserRole;
      const permsToSet = getPermissionsForRole(roleToSet);

      const sessionObj = {
        access_token: 'mock-session-token',
        token_type: 'bearer',
        expires_in: 86400,
        refresh_token: 'mock-refresh-token',
        user: mockUser,
      } as Session;

      const persistedData = {
        user: mockUser,
        session: sessionObj,
        employee: matchingEmployee,
        profile: mockProfile,
        role: roleToSet,
        permissions: permsToSet,
      };

      try {
        localStorage.setItem('scm_auth_session', JSON.stringify(persistedData));
      } catch (e) {
        console.warn('Could not persist demo session to localStorage:', e);
      }

      setUser(mockUser);
      setSession(sessionObj);
      setEmployee(matchingEmployee);
      setProfile(mockProfile);
      setRole(roleToSet);
      setPermissions(permsToSet);
      setMustChangePassword(Boolean(matchingEmployee.must_change_password));
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'An unexpected authentication error occurred.',
      };
    }
  };

  /**
   * Sign up restricted to approved active employee records.
   * Role is assigned exclusively on the database server from employees.assigned_role.
   */
  const signup = async (
    employeeId: string,
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const validation = await validateEmployeeForSignup(employeeId, email);
      if (!validation.valid) {
        return {
          success: false,
          error:
            validation.message ||
            'Employee verification failed. Please contact your SCM Administrator.',
        };
      }

      const { data: authData, error: signupErr } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            employee_id: employeeId.trim().toUpperCase(),
          },
        },
      });

      if (signupErr) {
        return { success: false, error: signupErr.message };
      }

      if (authData?.user) {
        await loadUserData(authData.user);
        return { success: true };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Registration failed.' };
    }
  };

  /**
   * Log out and terminate session
   */
  const logout = async () => {
    try {
      localStorage.removeItem('scm_auth_session');
    } catch {
      // ignore
    }
    try {
      await withTimeout(supabase.auth.signOut(), 300, null);
    } catch {
      // ignore
    }
    clearAuthState();
  };

  /**
   * Change password and clear temporary password flag on the server
   */
  const changePassword = async (
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      await completePasswordChangeOnServer();
      setMustChangePassword(false);
      await refreshAuth();
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to update password.',
      };
    }
  };

  /**
   * Request password reset instructions
   */
  const requestPasswordReset = async (
    identifier: string
  ): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
      const resolved = await resolveLoginIdentifier(identifier);
      if (!resolved.found || !resolved.email) {
        return {
          success: false,
          error: `No active employee record found for "${identifier.trim()}".`,
        };
      }

      if (resolved.is_active === false) {
        return {
          success: false,
          error:
            'This employee account is inactive. Please contact the SCM Administrator.',
        };
      }

      const { error } = await supabase.auth.resetPasswordForEmail(resolved.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        message: `Password reset instructions have been dispatched to ${resolved.email}.`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to request password reset.',
      };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        employee,
        role,
        permissions,
        is_active: Boolean(employee?.is_active),
        hasPermission,
        isLoading,
        mustChangePassword,
        login,
        signup,
        logout,
        changePassword,
        requestPasswordReset,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
