import React, { createContext, useContext, useState, useEffect } from 'react';

export interface Result {
  subject: string;
  score: number;
  grade: string;
  term: '1st Term' | '2nd Term' | '3rd Term';
  session: string;
}

export interface PastRecord {
  grade: string;
  session: string;
  results: Result[];
}

export interface User {
  id: string;
  name: string;
  role: 'student' | 'teacher' | 'admin';
  password: string;
  createdAt: string;
  status: 'Active' | 'Inactive';
  grade?: string;
  email?: string;
  phone?: string;
  subjects?: string[];
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
  registerStudent: (name: string, password: string, grade: string) => User;
  registerStaff: (name: string, password: string, role: 'teacher' | 'admin') => User;
  addStudent: (student: Omit<User, 'id' | 'createdAt' | 'status' | 'role'>) => User;
  updateUser: (id: string, data: Partial<User>) => void;
  deleteUser: (id: string) => void;
  promoteStudent: (id: string, nextGrade: string, currentSession: string) => void;
  addResult: (studentId: string, result: Result) => void;
  login: (idOrName: string, password: string, role: string) => User | null;
  currentUser: User | null;
  logout: () => void;
  subjectsByClass: Record<string, string[]>;
  updateSubjects: (className: string, subjects: string[]) => void;
  timetables: Record<string, TimetableEntry[]>;
  updateTimetable: (className: string, entries: TimetableEntry[]) => void;
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'date'>) => void;
  exportData: () => void;
  importData: (jsonData: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [students, setStudents] = useState<User[]>(() => {
    const saved = localStorage.getItem('citadel_students');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [staff, setStaff] = useState<User[]>(() => {
    const saved = localStorage.getItem('citadel_staff');
    const parsed = saved ? JSON.parse(saved) : [];
    if (parsed.length === 0) {
      const defaultStaff: User[] = [
        { 
          id: 'CH-STAFF-01', 
          name: 'Admin', 
          role: 'admin', 
          password: 'password123', 
          createdAt: new Date().toISOString(), 
          status: 'Active' 
        }
      ];
      localStorage.setItem('citadel_staff', JSON.stringify(defaultStaff));
      return defaultStaff;
    }
    return parsed;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const [subjectsByClass, setSubjectsByClass] = useState<Record<string, string[]>>(() => {
    const saved = localStorage.getItem('citadel_subjects');
    return saved ? JSON.parse(saved) : {};
  });
  
  const [timetables, setTimetables] = useState<Record<string, TimetableEntry[]>>(() => {
    const saved = localStorage.getItem('citadel_timetables');
    return saved ? JSON.parse(saved) : {};
  });
  
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    const saved = localStorage.getItem('citadel_notifications');
    return saved ? JSON.parse(saved) : [];
  });

  // Save to localStorage whenever data changes
  useEffect(() => localStorage.setItem('citadel_students', JSON.stringify(students)), [students]);
  useEffect(() => localStorage.setItem('citadel_staff', JSON.stringify(staff)), [staff]);
  useEffect(() => localStorage.setItem('citadel_subjects', JSON.stringify(subjectsByClass)), [subjectsByClass]);
  useEffect(() => localStorage.setItem('citadel_timetables', JSON.stringify(timetables)), [timetables]);
  useEffect(() => localStorage.setItem('citadel_notifications', JSON.stringify(notifications)), [notifications]);

  const generateStudentId = () => `CH ${String(students.length + 1).padStart(3, '0')}`;
  const generateStaffId = () => `CH-STAFF-${String(staff.length + 1).padStart(2, '0')}`;

  const registerStudent = (name: string, password: string, grade: string) => {
    const newStudent: User = {
      id: generateStudentId(),
      name,
      role: 'student',
      password,
      createdAt: new Date().toISOString(),
      status: 'Active',
      grade,
      results: [],
      history: []
    };
    setStudents(prev => [...prev, newStudent]);
    return newStudent;
  };

  const registerStaff = (name: string, password: string, role: 'teacher' | 'admin') => {
    const newStaff: User = {
      id: generateStaffId(),
      name,
      role,
      password,
      createdAt: new Date().toISOString(),
      status: 'Active'
    };
    setStaff(prev => [...prev, newStaff]);
    return newStaff;
  };

  const addStudent = (data: Omit<User, 'id' | 'createdAt' | 'status' | 'role'>) => {
    const newStudent: User = {
      ...data,
      id: generateStudentId(),
      role: 'student',
      createdAt: new Date().toISOString(),
      status: 'Active',
      results: [],
      history: []
    };
    setStudents(prev => [...prev, newStudent]);
    return newStudent;
  };

  const updateUser = (id: string, data: Partial<User>) => {
    setStudents(prev => prev.map(u => u.id === id ? { ...u, ...data } : u));
    setStaff(prev => prev.map(u => u.id === id ? { ...u, ...data } : u));
    if (currentUser?.id === id) setCurrentUser(prev => prev ? { ...prev, ...data } : null);
  };

  const deleteUser = (id: string) => {
    setStudents(prev => prev.filter(u => u.id !== id));
    setStaff(prev => prev.filter(u => u.id !== id));
  };

  const promoteStudent = (id: string, nextGrade: string, currentSession: string) => {
    setStudents(prev => prev.map(u => {
      if (u.id === id) {
        const pastRecord: PastRecord = {
          grade: u.grade || 'Unknown',
          session: currentSession,
          results: u.results || []
        };
        return {
          ...u,
          grade: nextGrade,
          results: [],
          history: [...(u.history || []), pastRecord]
        };
      }
      return u;
    }));
  };

  const addResult = (studentId: string, result: Result) => {
    setStudents(prev => prev.map(u => {
      if (u.id === studentId) {
        return {
          ...u,
          results: [...(u.results || []), result]
        };
      }
      return u;
    }));
  };

  const login = (idOrName: string, password: string, role: string) => {
    const searchId = idOrName.trim().toLowerCase();
    const allUsers = [...students, ...staff];
    const foundUser = allUsers.find(u => 
      (u.id.toLowerCase() === searchId || u.name.toLowerCase() === searchId) && 
      u.password === password &&
      (role === 'student' ? u.role === 'student' : u.role !== 'student')
    );

    if (foundUser) {
      setCurrentUser(foundUser);
      return foundUser;
    }
    return null;
  };

  const logout = () => setCurrentUser(null);

  const updateSubjects = (className: string, subjects: string[]) => {
    setSubjectsByClass(prev => ({ ...prev, [className]: subjects }));
  };

  const updateTimetable = (className: string, entries: TimetableEntry[]) => {
    setTimetables(prev => ({ ...prev, [className]: entries }));
  };

  const addNotification = (notif: Omit<Notification, 'id' | 'date'>) => {
    const newNotif: Notification = {
      ...notif,
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString()
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const exportData = () => {
    const data = {
      students,
      staff,
      subjects: subjectsByClass,
      timetables,
      notifications
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `citadel_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const importData = (jsonData: string) => {
    try {
      const data = JSON.parse(jsonData);
      if (data.students) setStudents(data.students);
      if (data.staff) setStaff(data.staff);
      if (data.subjects) setSubjectsByClass(data.subjects);
      if (data.timetables) setTimetables(data.timetables);
      if (data.notifications) setNotifications(data.notifications);
      alert('Data imported successfully!');
    } catch (e) {
      alert('Failed to import data. Invalid JSON format.');
    }
  };

  return (
    <AuthContext.Provider value={{ 
      students, staff, registerStudent, registerStaff, addStudent, updateUser, deleteUser, 
      promoteStudent, addResult, login, currentUser, logout,
      subjectsByClass, updateSubjects, timetables, updateTimetable, notifications, addNotification,
      exportData, importData
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
