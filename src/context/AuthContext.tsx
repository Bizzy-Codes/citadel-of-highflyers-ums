import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

export interface Result {
  id?: string;
  subject: string;
  score: number;
  grade: string;
  term: '1st Term' | '2nd Term' | '3rd Term';
  session: string;
  createdAt?: string;
}

export interface PastRecord {
  grade: string;
  session: string;
  results: Result[];
}

export interface User {
  id: string;              // Supabase auth UUID -- the real primary key
  displayId: string;       // human-readable ID, e.g. "CH 001", "CH-STAFF-01"
  name: string;
  role: 'student' | 'teacher' | 'teacher_pending' | 'admin';
  email: string;
  status: 'Active' | 'Inactive';
  createdAt: string;
  grade?: string;
  phone?: string;
  assignedClass?: string;
  results?: Result[];
  history?: PastRecord[];
}

export interface TimetableEntry {
  day: string;
  time: string;
  subject: string;
  teacher: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  date: string;
  type: 'info' | 'warning' | 'success';
}

interface AuthContextType {
  students: User[];
  staff: User[];
  currentUser: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  registerStudent: (name: string, email: string, password: string, grade: string) => Promise<{ error: string | null }>;
  registerStaff: (name: string, email: string, password: string) => Promise<{ error: string | null }>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  inviteUser: (name: string, email: string, role: 'student' | 'teacher', grade?: string) => Promise<{ error: string | null }>;
  updateUser: (id: string, data: Partial<User>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  approveTeacher: (id: string) => Promise<void>;
  promoteStudent: (id: string, nextGrade: string, currentSession: string) => Promise<void>;
  addResult: (studentId: string, result: Result) => Promise<void>;
  subjectsByClass: Record<string, string[]>;
  updateSubjects: (className: string, subjects: string[]) => Promise<void>;
  timetables: Record<string, TimetableEntry[]>;
  updateTimetable: (className: string, entries: TimetableEntry[]) => Promise<void>;
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'date'>) => Promise<void>;
  exportData: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapProfileRow = (row: any): User => ({
  id: row.id,
  displayId: row.display_id,
  name: row.name,
  role: row.role,
  email: row.email ?? '',
  status: row.status,
  createdAt: row.created_at,
  grade: row.grade ?? undefined,
  phone: row.phone ?? undefined,
  assignedClass: row.assigned_class ?? undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  results: (row.results ?? []).map((r: any) => ({
    id: r.id, subject: r.subject, score: r.score, grade: r.grade, term: r.term, session: r.session, createdAt: r.created_at,
  })),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  history: (row.academic_history ?? []).map((h: any) => ({
    grade: h.grade, session: h.session, results: h.results ?? [],
  })),
});

const PROFILE_SELECT = '*, results(*), academic_history(*)';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [students, setStudents] = useState<User[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [subjectsByClass, setSubjectsByClass] = useState<Record<string, string[]>>({});
  const [timetables, setTimetables] = useState<Record<string, TimetableEntry[]>>({});
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshProfiles = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select(PROFILE_SELECT).order('created_at');
    if (error) { console.error('Failed to load profiles', error); return; }
    const rows = (data ?? []).map(mapProfileRow);
    setStudents(rows.filter(u => u.role === 'student'));
    setStaff(rows.filter(u => u.role !== 'student'));
  }, []);

  const refreshCurrentProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase.from('profiles').select(PROFILE_SELECT).eq('id', userId).single();
    if (error) { console.error('Failed to load current profile', error); setCurrentUser(null); return; }
    setCurrentUser(mapProfileRow(data));
  }, []);

  const refreshSubjects = useCallback(async () => {
    const { data, error } = await supabase.from('class_subjects').select('*');
    if (error) { console.error('Failed to load subjects', error); return; }
    const map: Record<string, string[]> = {};
    (data ?? []).forEach((row) => { map[row.class_name] = row.subjects ?? []; });
    setSubjectsByClass(map);
  }, []);

  const refreshTimetables = useCallback(async () => {
    const { data, error } = await supabase.from('timetable_entries').select('*');
    if (error) { console.error('Failed to load timetables', error); return; }
    const map: Record<string, TimetableEntry[]> = {};
    (data ?? []).forEach((row) => {
      if (!map[row.class_name]) map[row.class_name] = [];
      map[row.class_name].push({ day: row.day, time: row.time, subject: row.subject, teacher: row.teacher });
    });
    setTimetables(map);
  }, []);

  const refreshNotifications = useCallback(async () => {
    const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false });
    if (error) { console.error('Failed to load notifications', error); return; }
    setNotifications((data ?? []).map((row) => ({
      id: row.id, title: row.title, message: row.message, date: row.created_at, type: row.type,
    })));
  }, []);

  const refreshAll = useCallback(async (userId: string) => {
    await Promise.all([
      refreshCurrentProfile(userId),
      refreshProfiles(),
      refreshSubjects(),
      refreshTimetables(),
      refreshNotifications(),
    ]);
  }, [refreshCurrentProfile, refreshProfiles, refreshSubjects, refreshTimetables, refreshNotifications]);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      setSession(session);
      if (session?.user) await refreshAll(session.user.id);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        await refreshAll(session.user.id);
      } else {
        setCurrentUser(null);
        setStudents([]);
        setStaff([]);
        setSubjectsByClass({});
        setTimetables({});
        setNotifications([]);
      }
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [refreshAll]);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const registerStudent = async (name: string, email: string, password: string, grade: string) => {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name, role: 'student', grade } },
    });
    return { error: error?.message ?? null };
  };

  const registerStaff = async (name: string, email: string, password: string) => {
    // Always lands as 'teacher_pending' -- an admin must approve before
    // it becomes a real 'teacher' account. See approveTeacher().
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name, role: 'teacher' } },
    });
    return { error: error?.message ?? null };
  };

  const requestPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error?.message ?? null };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message ?? null };
  };

  const inviteUser = async (name: string, email: string, role: 'student' | 'teacher', grade?: string) => {
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: { name, email, role, grade },
    });
    if (error) return { error: error.message };
    if (data?.error) return { error: data.error as string };
    await refreshProfiles();
    return { error: null };
  };

  const updateUser = async (id: string, data: Partial<User>) => {
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.phone !== undefined) patch.phone = data.phone;
    if (data.grade !== undefined) patch.grade = data.grade;
    if (data.assignedClass !== undefined) patch.assigned_class = data.assignedClass;
    if (data.status !== undefined) patch.status = data.status;
    if (data.role !== undefined) patch.role = data.role;

    const { error } = await supabase.from('profiles').update(patch).eq('id', id);
    if (error) { console.error('updateUser failed', error); return; }

    if (session?.user.id === id) await refreshCurrentProfile(id);
    await refreshProfiles();
  };

  const deleteUser = async (id: string) => {
    // NOTE: this removes the profile row (and therefore all app-level
    // access), but does not delete the underlying auth.users login --
    // that requires the service_role key, which the frontend must
    // never hold. If you need full account deletion, extend the
    // admin-create-user edge function with a delete counterpart.
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) { console.error('deleteUser failed', error); return; }
    await refreshProfiles();
  };

  const approveTeacher = async (id: string) => {
    await updateUser(id, { role: 'teacher' });
  };

  const promoteStudent = async (id: string, nextGrade: string, currentSession: string) => {
    const student = students.find(s => s.id === id);
    if (!student) return;

    const currentResults = student.results ?? [];
    if (currentResults.length > 0) {
      await supabase.from('academic_history').insert({
        student_id: id,
        grade: student.grade ?? 'Unknown',
        session: currentSession,
        results: currentResults,
      });
      const resultIds = currentResults.map(r => r.id).filter(Boolean) as string[];
      if (resultIds.length > 0) {
        await supabase.from('results').delete().in('id', resultIds);
      }
    }

    await supabase.from('profiles').update({ grade: nextGrade }).eq('id', id);
    await refreshProfiles();
  };

  const addResult = async (studentId: string, result: Result) => {
    const { error } = await supabase.from('results').insert({
      student_id: studentId,
      subject: result.subject,
      score: result.score,
      grade: result.grade,
      term: result.term,
      session: result.session,
    });
    if (error) { console.error('addResult failed', error); return; }
    if (session?.user.id === studentId) await refreshCurrentProfile(studentId);
    await refreshProfiles();
  };

  const updateSubjects = async (className: string, subjects: string[]) => {
    const { error } = await supabase.from('class_subjects').upsert({ class_name: className, subjects });
    if (error) { console.error('updateSubjects failed', error); return; }
    await refreshSubjects();
  };

  const updateTimetable = async (className: string, entries: TimetableEntry[]) => {
    await supabase.from('timetable_entries').delete().eq('class_name', className);
    if (entries.length > 0) {
      await supabase.from('timetable_entries').insert(
        entries.map(e => ({ class_name: className, day: e.day, time: e.time, subject: e.subject, teacher: e.teacher }))
      );
    }
    await refreshTimetables();
  };

  const addNotification = async (notif: Omit<Notification, 'id' | 'date'>) => {
    const { error } = await supabase.from('notifications').insert({
      title: notif.title, message: notif.message, type: notif.type,
    });
    if (error) { console.error('addNotification failed', error); return; }
    await refreshNotifications();
  };

  const exportData = () => {
    const data = { students, staff, subjects: subjectsByClass, timetables, notifications };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `citadel_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AuthContext.Provider value={{
      students, staff, currentUser, loading,
      login, logout, registerStudent, registerStaff, requestPasswordReset, updatePassword, inviteUser,
      updateUser, deleteUser, approveTeacher, promoteStudent, addResult,
      subjectsByClass, updateSubjects, timetables, updateTimetable,
      notifications, addNotification, exportData,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
