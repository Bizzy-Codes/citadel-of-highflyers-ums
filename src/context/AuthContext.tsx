import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { gradeFromScore } from '../lib/grading';

export interface Result {
  id?: string;
  subject: string;
  score: number;
  grade: string;
  term: '1st Term' | '2nd Term' | '3rd Term';
  session: string;
  createdAt?: string;
  ca1?: number;
  ca2?: number;
  exam?: number;
}

export interface NewResultInput {
  subject: string;
  term: Result['term'];
  session: string;
  ca1: number;
  ca2: number;
  exam: number;
}

// One row per student per term -- the data that doesn't fit on the
// per-subject results table: term dates, remarks/signatures, and the
// fixed psychomotor/affective domain ratings from the official sheet.
export interface ReportCardData {
  termEnds?: string;
  nextTermBegins?: string;
  remark?: string;
  headmasterComment?: string;
  classTeacherComment?: string;
  headmasterSignature?: string;
  classTeacherSignature?: string;
  commOralRating?: string;
  creativityRating?: string;
  drawingPaintingRating?: string;
  musicRating?: string;
  sportsRating?: string;
  honestyRating?: string;
  punctualityRating?: string;
  attentivenessRating?: string;
  politenessRating?: string;
  obedienceRating?: string;
  independenceRating?: string;
  socialRating?: string;
}

export interface SubjectStats {
  lowest: number;
  average: number;
  highest: number;
  classPosition: number | null;
  totalInClass: number;
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
  avatarUrl?: string;
  results?: Result[];
  history?: PastRecord[];
}

export interface Assignment {
  id: string;
  className: string;
  subject: string;
  title: string;
  description?: string;
  dueDate?: string;
  attachmentPath?: string;
  attachmentName?: string;
  createdBy: string;
  createdAt: string;
}

export interface NewAssignmentInput {
  subject: string;
  title: string;
  description?: string;
  dueDate?: string;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName?: string;
  studentDisplayId?: string;
  filePath: string;
  fileName: string;
  submittedAt: string;
  grade?: string;
  feedback?: string;
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

export interface DirectMessage {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  createdAt: string;
  readAt?: string;
  attachmentPath?: string;
  attachmentName?: string;
}

export interface TestQuestionOption {
  key: string;
  text: string;
}

// Teacher-side: the full row, including the answer key. Never sent
// to a student -- see get_attempt_questions()/AttemptQuestion.
export interface TestQuestion {
  id: string;
  testId: string;
  orderIndex: number;
  type: 'objective' | 'essay';
  prompt: string;
  points: number;
  options?: TestQuestionOption[];
  correctOption?: string;
  modelAnswer?: string;
  keywords?: { phrase: string; points: number }[];
}

// The single shape both a hand-typed question and a future
// AI-extracted-then-reviewed question flow through into saveQuestion().
export interface NewTestQuestionInput {
  id?: string;
  type: 'objective' | 'essay';
  prompt: string;
  points: number;
  options?: TestQuestionOption[];
  correctOption?: string;
  modelAnswer?: string;
  keywords?: { phrase: string; points: number }[];
}

// Student-side: sanitized shape from the get_attempt_questions RPC --
// structurally cannot include correctOption/modelAnswer/keywords.
export interface AttemptQuestion {
  questionId: string;
  orderIndex: number;
  type: 'objective' | 'essay';
  prompt: string;
  points: number;
  options?: TestQuestionOption[];
  selectedOption?: string;
  essayText?: string;
}

export interface Test {
  id: string;
  className: string;
  subject: string;
  title: string;
  instructions?: string;
  durationMinutes: number;
  status: 'draft' | 'published' | 'closed';
  totalPoints: number;
  createdBy: string;
  createdAt: string;
  publishedAt?: string;
}

export interface NewTestInput {
  subject: string;
  title: string;
  instructions?: string;
  durationMinutes: number;
}

export interface TestAttempt {
  id: string;
  testId: string;
  studentId: string;
  studentName?: string;
  studentDisplayId?: string;
  status: 'in_progress' | 'submitted' | 'terminated' | 'expired';
  startedAt: string;
  expiresAt: string;
  submittedAt?: string;
  score?: number;
  maxScore: number;
  violationCount: number;
  terminatedReason?: string;
}

export interface TestAnswerForGrading {
  id: string;
  attemptId: string;
  questionId: string;
  questionPrompt?: string;
  questionType?: 'objective' | 'essay';
  questionPoints?: number;
  selectedOption?: string;
  essayText?: string;
  isCorrect?: boolean;
  pointsAwarded?: number;
  feedback?: string;
}

export interface NewAdmissionApplicationInput {
  surname: string;
  firstName: string;
  otherNames?: string;
  sex: 'Male' | 'Female';
  dateOfBirth: string;
  homeAddress: string;
  nationality: string;
  stateOfOrigin: string;
  lga: string;
  religion?: string;
  bloodGroup?: string;
  genotype?: string;
  fatherName?: string;
  fatherOccupation?: string;
  fatherOfficeAddress?: string;
  fatherPhone?: string;
  motherName?: string;
  motherOccupation?: string;
  motherOfficeAddress?: string;
  motherPhone?: string;
  healthChallenge?: string;
  healthChallengeDetails?: string;
  schoolLastAttended?: string;
  pickupPerson: string;
  pickupPhone: string;
  siblingNames?: string;
}

export interface AdmissionApplication extends NewAdmissionApplicationInput {
  id: string;
  photoPath?: string;
  status: 'pending' | 'reviewed' | 'admitted' | 'declined';
  adminNote?: string;
  createdAt: string;
}

export interface PaymentReceipt {
  id: string;
  studentId: string;
  studentName?: string;
  studentDisplayId?: string;
  amount: number;
  note?: string;
  filePath: string;
  fileName: string;
  status: 'pending' | 'acknowledged' | 'rejected';
  adminNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface ExamViolation {
  id: string;
  attemptId: string;
  testId: string;
  studentId: string;
  studentName?: string;
  occurredAt: string;
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
  verifySignupOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  verifyRecoveryOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  inviteUser: (name: string, email: string, role: 'student' | 'teacher', grade?: string) => Promise<{ error: string | null }>;
  updateUser: (id: string, data: Partial<User>) => Promise<void>;
  uploadAvatar: (file: File) => Promise<{ error: string | null }>;
  removeAvatar: () => Promise<{ error: string | null }>;
  deleteUser: (id: string) => Promise<void>;
  approveTeacher: (id: string) => Promise<void>;
  promoteStudent: (id: string, nextGrade: string, currentSession: string) => Promise<void>;
  addResult: (studentId: string, result: NewResultInput) => Promise<void>;
  getReportCard: (studentId: string, term: Result['term'], session: string) => Promise<ReportCardData | null>;
  upsertReportCard: (studentId: string, term: Result['term'], session: string, data: ReportCardData) => Promise<void>;
  getSubjectStats: (studentId: string, subject: string, term: Result['term'], session: string) => Promise<SubjectStats | null>;
  subjectsByClass: Record<string, string[]>;
  updateSubjects: (className: string, subjects: string[]) => Promise<void>;
  timetables: Record<string, TimetableEntry[]>;
  updateTimetable: (className: string, entries: TimetableEntry[]) => Promise<void>;
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'date'>) => Promise<void>;
  exportData: () => void;
  assignments: Assignment[];
  mySubmissions: Record<string, AssignmentSubmission>;
  createAssignment: (input: NewAssignmentInput, file: File | null) => Promise<{ error: string | null }>;
  deleteAssignment: (id: string) => Promise<void>;
  submitAssignment: (assignmentId: string, file: File) => Promise<{ error: string | null }>;
  getSubmissionsForAssignment: (assignmentId: string) => Promise<AssignmentSubmission[]>;
  gradeSubmission: (submissionId: string, grade: string, feedback: string) => Promise<{ error: string | null }>;
  getAssignmentFileUrl: (path: string) => Promise<string | null>;
  messageContacts: User[];
  getConversation: (otherUserId: string) => Promise<DirectMessage[]>;
  sendDirectMessage: (recipientId: string, content: string, attachment?: { path: string; name: string }) => Promise<{ error: string | null }>;
  markConversationRead: (otherUserId: string) => Promise<void>;
  subscribeToDirectMessages: (otherUserId: string, onMessage: (message: DirectMessage) => void) => () => void;
  uploadChatAttachment: (recipientId: string, file: File) => Promise<{ error: string | null; path?: string; name?: string }>;
  getChatAttachmentUrl: (path: string) => Promise<string | null>;
  submitAdmissionApplication: (input: NewAdmissionApplicationInput, photo: File | null) => Promise<{ error: string | null }>;
  getAdmissionApplications: () => Promise<AdmissionApplication[]>;
  reviewAdmissionApplication: (id: string, status: 'reviewed' | 'admitted' | 'declined', adminNote: string) => Promise<{ error: string | null }>;
  getAdmissionPhotoUrl: (path: string) => Promise<string | null>;
  submitPaymentReceipt: (amount: number, note: string, file: File) => Promise<{ error: string | null }>;
  getMyPaymentReceipts: () => Promise<PaymentReceipt[]>;
  getAllPaymentReceipts: () => Promise<PaymentReceipt[]>;
  reviewPaymentReceipt: (id: string, status: 'acknowledged' | 'rejected', adminNote: string) => Promise<{ error: string | null }>;
  getPaymentReceiptUrl: (path: string) => Promise<string | null>;
  tests: Test[];
  createTest: (input: NewTestInput) => Promise<{ error: string | null; testId?: string }>;
  updateTest: (id: string, input: Partial<NewTestInput>) => Promise<{ error: string | null }>;
  publishTest: (id: string) => Promise<{ error: string | null }>;
  closeTest: (id: string) => Promise<{ error: string | null }>;
  deleteTest: (id: string) => Promise<void>;
  getTestQuestions: (testId: string) => Promise<TestQuestion[]>;
  saveQuestion: (testId: string, input: NewTestQuestionInput) => Promise<{ error: string | null; id?: string }>;
  deleteQuestion: (id: string) => Promise<void>;
  reorderQuestions: (orderedIds: string[]) => Promise<void>;
  getAttemptsForTest: (testId: string) => Promise<TestAttempt[]>;
  getAnswersForAttempt: (attemptId: string) => Promise<TestAnswerForGrading[]>;
  gradeEssayAnswer: (answerId: string, pointsAwarded: number, feedback: string) => Promise<{ error: string | null }>;
  getViolationsForTest: (testId: string) => Promise<ExamViolation[]>;
  subscribeToTestAttempts: (testId: string, onChange: (attempt: TestAttempt) => void) => () => void;
  subscribeToTestViolations: (testId: string, onViolation: (violation: ExamViolation) => void) => () => void;
  sweepExpiredAttempts: (testId: string) => Promise<void>;
  getMyAttemptForTest: (testId: string) => Promise<TestAttempt | null>;
  getAttemptById: (attemptId: string) => Promise<TestAttempt | null>;
  startTestAttempt: (testId: string) => Promise<{ error: string | null; attemptId?: string; expiresAt?: string }>;
  getAttemptQuestions: (attemptId: string) => Promise<AttemptQuestion[]>;
  saveTestAnswer: (attemptId: string, questionId: string, answer: { selectedOption?: string; essayText?: string }) => Promise<{ error: string | null }>;
  submitTestAttempt: (attemptId: string) => Promise<{ error: string | null; score?: number; maxScore?: number; status?: string }>;
  recordTestViolation: (attemptId: string) => Promise<{ error: string | null; violationCount?: number; status?: string }>;
  finalizeMyExpiredAttempts: () => Promise<void>;
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
  avatarUrl: row.avatar_url ?? undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  results: (row.results ?? []).map((r: any) => ({
    id: r.id, subject: r.subject, score: r.score, grade: r.grade, term: r.term, session: r.session, createdAt: r.created_at,
    ca1: r.ca1 ?? undefined, ca2: r.ca2 ?? undefined, exam: r.exam ?? undefined,
  })),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  history: (row.academic_history ?? []).map((h: any) => ({
    grade: h.grade, session: h.session, results: h.results ?? [],
  })),
});

const PROFILE_SELECT = '*, results(*), academic_history(*)';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapAssignmentRow = (row: any): Assignment => ({
  id: row.id,
  className: row.class_name,
  subject: row.subject,
  title: row.title,
  description: row.description ?? undefined,
  dueDate: row.due_date ?? undefined,
  attachmentPath: row.attachment_path ?? undefined,
  attachmentName: row.attachment_name ?? undefined,
  createdBy: row.created_by,
  createdAt: row.created_at,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapTestRow = (row: any): Test => ({
  id: row.id,
  className: row.class_name,
  subject: row.subject,
  title: row.title,
  instructions: row.instructions ?? undefined,
  durationMinutes: row.duration_minutes,
  status: row.status,
  totalPoints: Number(row.total_points ?? 0),
  createdBy: row.created_by,
  createdAt: row.created_at,
  publishedAt: row.published_at ?? undefined,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapTestQuestionRow = (row: any): TestQuestion => ({
  id: row.id,
  testId: row.test_id,
  orderIndex: row.order_index,
  type: row.type,
  prompt: row.prompt,
  points: Number(row.points),
  options: row.options ?? undefined,
  correctOption: row.correct_option ?? undefined,
  modelAnswer: row.model_answer ?? undefined,
  keywords: row.keywords ?? undefined,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapAttemptQuestionRow = (row: any): AttemptQuestion => ({
  questionId: row.question_id,
  orderIndex: row.order_index,
  type: row.type,
  prompt: row.prompt,
  points: Number(row.points),
  options: row.options ?? undefined,
  selectedOption: row.selected_option ?? undefined,
  essayText: row.essay_text ?? undefined,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapTestAttemptRow = (row: any): TestAttempt => ({
  id: row.id,
  testId: row.test_id,
  studentId: row.student_id,
  studentName: row.profiles?.name ?? undefined,
  studentDisplayId: row.profiles?.display_id ?? undefined,
  status: row.status,
  startedAt: row.started_at,
  expiresAt: row.expires_at,
  submittedAt: row.submitted_at ?? undefined,
  score: row.score != null ? Number(row.score) : undefined,
  maxScore: Number(row.max_score ?? 0),
  violationCount: row.violation_count,
  terminatedReason: row.terminated_reason ?? undefined,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapTestAnswerRow = (row: any): TestAnswerForGrading => ({
  id: row.id,
  attemptId: row.attempt_id,
  questionId: row.question_id,
  questionPrompt: row.test_questions?.prompt ?? undefined,
  questionType: row.test_questions?.type ?? undefined,
  questionPoints: row.test_questions?.points != null ? Number(row.test_questions.points) : undefined,
  selectedOption: row.selected_option ?? undefined,
  essayText: row.essay_text ?? undefined,
  isCorrect: row.is_correct ?? undefined,
  pointsAwarded: row.points_awarded != null ? Number(row.points_awarded) : undefined,
  feedback: row.feedback ?? undefined,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapAdmissionApplicationRow = (row: any): AdmissionApplication => ({
  id: row.id,
  surname: row.surname,
  firstName: row.first_name,
  otherNames: row.other_names ?? undefined,
  sex: row.sex,
  dateOfBirth: row.date_of_birth,
  homeAddress: row.home_address,
  nationality: row.nationality,
  stateOfOrigin: row.state_of_origin,
  lga: row.lga,
  religion: row.religion ?? undefined,
  bloodGroup: row.blood_group ?? undefined,
  genotype: row.genotype ?? undefined,
  fatherName: row.father_name ?? undefined,
  fatherOccupation: row.father_occupation ?? undefined,
  fatherOfficeAddress: row.father_office_address ?? undefined,
  fatherPhone: row.father_phone ?? undefined,
  motherName: row.mother_name ?? undefined,
  motherOccupation: row.mother_occupation ?? undefined,
  motherOfficeAddress: row.mother_office_address ?? undefined,
  motherPhone: row.mother_phone ?? undefined,
  healthChallenge: row.health_challenge ?? undefined,
  healthChallengeDetails: row.health_challenge_details ?? undefined,
  schoolLastAttended: row.school_last_attended ?? undefined,
  pickupPerson: row.pickup_person,
  pickupPhone: row.pickup_phone,
  siblingNames: row.sibling_names ?? undefined,
  photoPath: row.photo_path ?? undefined,
  status: row.status,
  adminNote: row.admin_note ?? undefined,
  createdAt: row.created_at,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapPaymentReceiptRow = (row: any): PaymentReceipt => ({
  id: row.id,
  studentId: row.student_id,
  studentName: row.profiles?.name ?? undefined,
  studentDisplayId: row.profiles?.display_id ?? undefined,
  amount: Number(row.amount),
  note: row.note ?? undefined,
  filePath: row.file_path,
  fileName: row.file_name,
  status: row.status,
  adminNote: row.admin_note ?? undefined,
  reviewedBy: row.reviewed_by ?? undefined,
  reviewedAt: row.reviewed_at ?? undefined,
  createdAt: row.created_at,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapViolationRow = (row: any): ExamViolation => ({
  id: row.id,
  attemptId: row.attempt_id,
  testId: row.test_id,
  studentId: row.student_id,
  studentName: row.profiles?.name ?? undefined,
  occurredAt: row.occurred_at,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapMessageRow = (row: any): DirectMessage => ({
  id: row.id,
  senderId: row.sender_id,
  recipientId: row.recipient_id,
  content: row.content,
  createdAt: row.created_at,
  readAt: row.read_at ?? undefined,
  attachmentPath: row.attachment_path ?? undefined,
  attachmentName: row.attachment_name ?? undefined,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapSubmissionRow = (row: any): AssignmentSubmission => ({
  id: row.id,
  assignmentId: row.assignment_id,
  studentId: row.student_id,
  studentName: row.profiles?.name ?? undefined,
  studentDisplayId: row.profiles?.display_id ?? undefined,
  filePath: row.file_path,
  fileName: row.file_name,
  submittedAt: row.submitted_at,
  grade: row.grade ?? undefined,
  feedback: row.feedback ?? undefined,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [students, setStudents] = useState<User[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [subjectsByClass, setSubjectsByClass] = useState<Record<string, string[]>>({});
  const [timetables, setTimetables] = useState<Record<string, TimetableEntry[]>>({});
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [mySubmissions, setMySubmissions] = useState<Record<string, AssignmentSubmission>>({});
  const [tests, setTests] = useState<Test[]>([]);
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

  const refreshAssignments = useCallback(async () => {
    const { data, error } = await supabase.from('assignments').select('*').order('due_date', { ascending: true, nullsFirst: false });
    if (error) { console.error('Failed to load assignments', error); return; }
    setAssignments((data ?? []).map(mapAssignmentRow));
  }, []);

  const refreshMySubmissions = useCallback(async () => {
    const { data, error } = await supabase.from('assignment_submissions').select('*');
    if (error) { console.error('Failed to load submissions', error); return; }
    const map: Record<string, AssignmentSubmission> = {};
    (data ?? []).forEach((row) => { map[row.assignment_id] = mapSubmissionRow(row); });
    setMySubmissions(map);
  }, []);

  const refreshTests = useCallback(async () => {
    const { data, error } = await supabase.from('tests').select('*').order('created_at', { ascending: false });
    if (error) { console.error('Failed to load tests', error); return; }
    setTests((data ?? []).map(mapTestRow));
  }, []);

  const refreshAll = useCallback(async (userId: string) => {
    await Promise.all([
      refreshCurrentProfile(userId),
      refreshProfiles(),
      refreshSubjects(),
      refreshTimetables(),
      refreshNotifications(),
      refreshAssignments(),
      refreshMySubmissions(),
      refreshTests(),
    ]);
  }, [refreshCurrentProfile, refreshProfiles, refreshSubjects, refreshTimetables, refreshNotifications, refreshAssignments, refreshMySubmissions, refreshTests]);

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
        setAssignments([]);
        setMySubmissions({});
        setTests([]);
      }
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [refreshAll]);

  const login = async (identifier: string, password: string) => {
    let email = identifier.trim();
    // Supabase's password login only accepts an email. If what was typed
    // isn't one, treat it as the login ID (profiles.display_id, e.g.
    // "CH 001") and resolve it to the account's email first.
    if (!email.includes('@')) {
      const { data, error: lookupError } = await supabase.rpc('email_for_login_id', { p_login_id: email });
      if (lookupError || !data) return { error: 'Invalid login credentials' };
      email = data as string;
    }
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

  const verifySignupOtp = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
    return { error: error?.message ?? null };
  };

  const requestPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error?.message ?? null };
  };

  const verifyRecoveryOtp = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'recovery' });
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
    if (data.avatarUrl !== undefined) patch.avatar_url = data.avatarUrl;

    const { error } = await supabase.from('profiles').update(patch).eq('id', id);
    if (error) { console.error('updateUser failed', error); return; }

    if (session?.user.id === id) await refreshCurrentProfile(id);
    await refreshProfiles();
  };

  const uploadAvatar = async (file: File) => {
    if (!session?.user.id) return { error: 'Not signed in' };
    const userId = session.user.id;
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });
    if (uploadError) return { error: uploadError.message };

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    // Cache-bust so the new image shows immediately instead of a stale
    // cached copy at the same URL.
    const publicUrl = `${data.publicUrl}?v=${Date.now()}`;

    const { error: dbError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId);
    if (dbError) return { error: dbError.message };

    await refreshCurrentProfile(userId);
    await refreshProfiles();
    return { error: null };
  };

  const removeAvatar = async () => {
    if (!session?.user.id) return { error: 'Not signed in' };
    const userId = session.user.id;

    const { data: files } = await supabase.storage.from('avatars').list(userId);
    if (files && files.length > 0) {
      await supabase.storage.from('avatars').remove(files.map(f => `${userId}/${f.name}`));
    }

    const { error: dbError } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId);
    if (dbError) return { error: dbError.message };

    await refreshCurrentProfile(userId);
    await refreshProfiles();
    return { error: null };
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

  const addResult = async (studentId: string, result: NewResultInput) => {
    const score = result.ca1 + result.ca2 + result.exam;
    const { grade } = gradeFromScore(score);
    const { error } = await supabase.from('results').insert({
      student_id: studentId,
      subject: result.subject,
      score,
      grade,
      term: result.term,
      session: result.session,
      ca1: result.ca1,
      ca2: result.ca2,
      exam: result.exam,
    });
    if (error) { console.error('addResult failed', error); return; }
    if (session?.user.id === studentId) await refreshCurrentProfile(studentId);
    await refreshProfiles();
  };

  const REPORT_CARD_COLUMNS = 'term_ends, next_term_begins, remark, headmaster_comment, class_teacher_comment, headmaster_signature, class_teacher_signature, comm_oral_rating, creativity_rating, drawing_painting_rating, music_rating, sports_rating, honesty_rating, punctuality_rating, attentiveness_rating, politeness_rating, obedience_rating, independence_rating, social_rating';

  const getReportCard = async (studentId: string, term: Result['term'], session: string): Promise<ReportCardData | null> => {
    const { data, error } = await supabase
      .from('report_cards')
      .select(REPORT_CARD_COLUMNS)
      .eq('student_id', studentId).eq('term', term).eq('session', session)
      .maybeSingle();
    if (error || !data) return null;
    return {
      termEnds: data.term_ends ?? undefined,
      nextTermBegins: data.next_term_begins ?? undefined,
      remark: data.remark ?? undefined,
      headmasterComment: data.headmaster_comment ?? undefined,
      classTeacherComment: data.class_teacher_comment ?? undefined,
      headmasterSignature: data.headmaster_signature ?? undefined,
      classTeacherSignature: data.class_teacher_signature ?? undefined,
      commOralRating: data.comm_oral_rating ?? undefined,
      creativityRating: data.creativity_rating ?? undefined,
      drawingPaintingRating: data.drawing_painting_rating ?? undefined,
      musicRating: data.music_rating ?? undefined,
      sportsRating: data.sports_rating ?? undefined,
      honestyRating: data.honesty_rating ?? undefined,
      punctualityRating: data.punctuality_rating ?? undefined,
      attentivenessRating: data.attentiveness_rating ?? undefined,
      politenessRating: data.politeness_rating ?? undefined,
      obedienceRating: data.obedience_rating ?? undefined,
      independenceRating: data.independence_rating ?? undefined,
      socialRating: data.social_rating ?? undefined,
    };
  };

  const upsertReportCard = async (studentId: string, term: Result['term'], session: string, data: ReportCardData) => {
    const { error } = await supabase.from('report_cards').upsert({
      student_id: studentId,
      term,
      session,
      term_ends: data.termEnds || null,
      next_term_begins: data.nextTermBegins || null,
      remark: data.remark || null,
      headmaster_comment: data.headmasterComment || null,
      class_teacher_comment: data.classTeacherComment || null,
      headmaster_signature: data.headmasterSignature || null,
      class_teacher_signature: data.classTeacherSignature || null,
      comm_oral_rating: data.commOralRating || null,
      creativity_rating: data.creativityRating || null,
      drawing_painting_rating: data.drawingPaintingRating || null,
      music_rating: data.musicRating || null,
      sports_rating: data.sportsRating || null,
      honesty_rating: data.honestyRating || null,
      punctuality_rating: data.punctualityRating || null,
      attentiveness_rating: data.attentivenessRating || null,
      politeness_rating: data.politenessRating || null,
      obedience_rating: data.obedienceRating || null,
      independence_rating: data.independenceRating || null,
      social_rating: data.socialRating || null,
    }, { onConflict: 'student_id,term,session' });
    if (error) console.error('upsertReportCard failed', error);
  };

  const getSubjectStats = async (studentId: string, subject: string, term: Result['term'], session: string): Promise<SubjectStats | null> => {
    const { data, error } = await supabase.rpc('subject_class_stats', {
      p_student_id: studentId, p_subject: subject, p_term_value: term, p_session: session,
    }).maybeSingle();
    if (error || !data) return null;
    return {
      lowest: Number(data.lowest ?? 0),
      average: Number(data.average ?? 0),
      highest: Number(data.highest ?? 0),
      classPosition: data.class_position != null ? Number(data.class_position) : null,
      totalInClass: Number(data.total_in_class ?? 0),
    };
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

  const createAssignment = async (input: NewAssignmentInput, file: File | null) => {
    if (!currentUser?.assignedClass) return { error: 'No class assigned to your account.' };

    const { data: inserted, error: insertError } = await supabase.from('assignments').insert({
      class_name: currentUser.assignedClass,
      subject: input.subject,
      title: input.title,
      description: input.description || null,
      due_date: input.dueDate || null,
      created_by: currentUser.id,
    }).select().single();
    if (insertError || !inserted) return { error: insertError?.message ?? 'Failed to create assignment' };

    if (file) {
      const path = `${inserted.id}/brief/${file.name}`;
      const { error: uploadError } = await supabase.storage.from('assignment-files').upload(path, file, { upsert: true });
      if (uploadError) return { error: `Assignment created, but the attachment failed to upload: ${uploadError.message}` };
      await supabase.from('assignments').update({ attachment_path: path, attachment_name: file.name }).eq('id', inserted.id);
    }

    await refreshAssignments();
    return { error: null };
  };

  const deleteAssignment = async (id: string) => {
    const { error } = await supabase.from('assignments').delete().eq('id', id);
    if (error) { console.error('deleteAssignment failed', error); return; }
    await refreshAssignments();
  };

  const submitAssignment = async (assignmentId: string, file: File) => {
    if (!session?.user.id) return { error: 'Not signed in' };
    const studentId = session.user.id;

    // Resubmitting: clear out any prior (ungraded) submission first --
    // RLS only allows this delete while grade is still null, so a
    // graded submission simply won't be removed and the insert below
    // will fail on the unique constraint, surfacing as an error.
    await supabase.from('assignment_submissions').delete().eq('assignment_id', assignmentId).eq('student_id', studentId);

    const path = `${assignmentId}/submissions/${studentId}/${file.name}`;
    const { error: uploadError } = await supabase.storage.from('assignment-files').upload(path, file, { upsert: true });
    if (uploadError) return { error: uploadError.message };

    const { error: insertError } = await supabase.from('assignment_submissions').insert({
      assignment_id: assignmentId,
      student_id: studentId,
      file_path: path,
      file_name: file.name,
    });
    if (insertError) {
      const message = insertError.code === '23505'
        ? 'This assignment has already been graded and can no longer be resubmitted.'
        : insertError.message;
      return { error: message };
    }

    await refreshMySubmissions();
    return { error: null };
  };

  const getSubmissionsForAssignment = async (assignmentId: string): Promise<AssignmentSubmission[]> => {
    const { data, error } = await supabase
      .from('assignment_submissions')
      .select('*, profiles(name, display_id)')
      .eq('assignment_id', assignmentId)
      .order('submitted_at', { ascending: false });
    if (error) { console.error('getSubmissionsForAssignment failed', error); return []; }
    return (data ?? []).map(mapSubmissionRow);
  };

  const gradeSubmission = async (submissionId: string, grade: string, feedback: string) => {
    const { error } = await supabase.from('assignment_submissions').update({ grade, feedback }).eq('id', submissionId);
    return { error: error?.message ?? null };
  };

  const getAssignmentFileUrl = async (path: string): Promise<string | null> => {
    const { data, error } = await supabase.storage.from('assignment-files').createSignedUrl(path, 3600);
    if (error || !data) { console.error('getAssignmentFileUrl failed', error); return null; }
    return data.signedUrl;
  };

  const addNotification = async (notif: Omit<Notification, 'id' | 'date'>) => {
    const { error } = await supabase.from('notifications').insert({
      title: notif.title, message: notif.message, type: notif.type,
    });
    if (error) { console.error('addNotification failed', error); return; }
    await refreshNotifications();
  };

  // Who the current user is allowed to see in the "Private Chats"
  // contact list. RLS on profiles already limits what actually comes
  // back over the wire (a student only ever receives their own class
  // teacher and admins, per patch_6.sql) -- this just picks the right
  // slice of that for each role so admins aren't shown to themselves.
  const messageContacts: User[] = (() => {
    if (!currentUser) return [];
    if (currentUser.role === 'admin') {
      return [...students, ...staff].filter(u => u.id !== currentUser.id);
    }
    if (currentUser.role === 'teacher') {
      return [...students, ...staff.filter(u => u.role === 'admin')];
    }
    // student
    return staff.filter(u => u.role === 'teacher' || u.role === 'admin');
  })();

  const getConversation = async (otherUserId: string): Promise<DirectMessage[]> => {
    if (!session?.user.id) return [];
    const userId = session.user.id;
    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`and(sender_id.eq.${userId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${userId})`)
      .order('created_at', { ascending: true });
    if (error) { console.error('getConversation failed', error); return []; }
    return (data ?? []).map(mapMessageRow);
  };

  const sendDirectMessage = async (recipientId: string, content: string, attachment?: { path: string; name: string }) => {
    if (!session?.user.id) return { error: 'Not signed in' };
    // The DB column is not-null -- an attachment-only send falls back
    // to the file name as the message text rather than relaxing that
    // constraint.
    const trimmed = content.trim() || attachment?.name || '';
    if (!trimmed) return { error: 'Message cannot be empty' };
    const { error } = await supabase.from('direct_messages').insert({
      sender_id: session.user.id, recipient_id: recipientId, content: trimmed,
      attachment_path: attachment?.path ?? null, attachment_name: attachment?.name ?? null,
    });
    return { error: error?.message ?? null };
  };

  const uploadChatAttachment = async (recipientId: string, file: File) => {
    if (!session?.user.id) return { error: 'Not signed in' };
    const path = `${session.user.id}/${recipientId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('chat-files').upload(path, file);
    if (error) return { error: error.message };
    return { error: null, path, name: file.name };
  };

  const getChatAttachmentUrl = async (path: string): Promise<string | null> => {
    const { data, error } = await supabase.storage.from('chat-files').createSignedUrl(path, 3600);
    if (error || !data) { console.error('getChatAttachmentUrl failed', error); return null; }
    return data.signedUrl;
  };

  const markConversationRead = async (otherUserId: string) => {
    if (!session?.user.id) return;
    await supabase.from('direct_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id', otherUserId)
      .eq('recipient_id', session.user.id)
      .is('read_at', null);
  };

  // Realtime subscription for one open conversation. Returns an
  // unsubscribe function for the caller's effect cleanup.
  const subscribeToDirectMessages = (otherUserId: string, onMessage: (message: DirectMessage) => void) => {
    if (!session?.user.id) return () => {};
    const userId = session.user.id;
    const channel = supabase
      .channel(`dm-${[userId, otherUserId].sort().join('-')}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, (payload) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = payload.new as any;
        const isThisConversation =
          (row.sender_id === userId && row.recipient_id === otherUserId) ||
          (row.sender_id === otherUserId && row.recipient_id === userId);
        if (isThisConversation) onMessage(mapMessageRow(row));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  // ------------------------------------------------------------
  // Tests / Exams -- teacher side
  // ------------------------------------------------------------
  const createTest = async (input: NewTestInput) => {
    if (!currentUser?.assignedClass) return { error: 'No class assigned to your account.' };
    const { data, error } = await supabase.from('tests').insert({
      class_name: currentUser.assignedClass,
      subject: input.subject,
      title: input.title,
      instructions: input.instructions || null,
      duration_minutes: input.durationMinutes,
      created_by: currentUser.id,
    }).select().single();
    if (error || !data) return { error: error?.message ?? 'Failed to create test' };
    await refreshTests();
    return { error: null, testId: data.id as string };
  };

  const updateTest = async (id: string, input: Partial<NewTestInput>) => {
    const patch: Record<string, unknown> = {};
    if (input.subject !== undefined) patch.subject = input.subject;
    if (input.title !== undefined) patch.title = input.title;
    if (input.instructions !== undefined) patch.instructions = input.instructions || null;
    if (input.durationMinutes !== undefined) patch.duration_minutes = input.durationMinutes;
    const { error } = await supabase.from('tests').update(patch).eq('id', id);
    if (error) return { error: error.message };
    await refreshTests();
    return { error: null };
  };

  const publishTest = async (id: string) => {
    const { error } = await supabase.from('tests').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', id);
    if (error) return { error: error.message };
    await refreshTests();
    return { error: null };
  };

  const closeTest = async (id: string) => {
    const { error } = await supabase.from('tests').update({ status: 'closed' }).eq('id', id);
    if (error) return { error: error.message };
    await refreshTests();
    return { error: null };
  };

  const deleteTest = async (id: string) => {
    const { error } = await supabase.from('tests').delete().eq('id', id);
    if (error) { console.error('deleteTest failed', error); return; }
    await refreshTests();
  };

  const getTestQuestions = async (testId: string): Promise<TestQuestion[]> => {
    const { data, error } = await supabase.from('test_questions').select('*').eq('test_id', testId).order('order_index');
    if (error) { console.error('getTestQuestions failed', error); return []; }
    return (data ?? []).map(mapTestQuestionRow);
  };

  const saveQuestion = async (testId: string, input: NewTestQuestionInput) => {
    const row = {
      test_id: testId,
      type: input.type,
      prompt: input.prompt,
      points: input.points,
      options: input.options ?? null,
      correct_option: input.correctOption ?? null,
      model_answer: input.modelAnswer ?? null,
      keywords: input.keywords ?? null,
    };
    if (input.id) {
      const { error } = await supabase.from('test_questions').update(row).eq('id', input.id);
      if (error) return { error: error.message };
      await refreshTests(); // total_points changed via the recalc_test_points trigger
      return { error: null, id: input.id };
    }
    const { data, error } = await supabase.from('test_questions').insert(row).select().single();
    if (error || !data) return { error: error?.message ?? 'Failed to save question' };
    await refreshTests();
    return { error: null, id: data.id as string };
  };

  const deleteQuestion = async (id: string) => {
    const { error } = await supabase.from('test_questions').delete().eq('id', id);
    if (error) { console.error('deleteQuestion failed', error); return; }
    await refreshTests();
  };

  const reorderQuestions = async (orderedIds: string[]) => {
    await Promise.all(orderedIds.map((id, index) =>
      supabase.from('test_questions').update({ order_index: index }).eq('id', id)
    ));
  };

  const getAttemptsForTest = async (testId: string): Promise<TestAttempt[]> => {
    const { data, error } = await supabase
      .from('test_attempts')
      .select('*, profiles(name, display_id)')
      .eq('test_id', testId)
      .order('started_at', { ascending: false });
    if (error) { console.error('getAttemptsForTest failed', error); return []; }
    return (data ?? []).map(mapTestAttemptRow);
  };

  const getAnswersForAttempt = async (attemptId: string): Promise<TestAnswerForGrading[]> => {
    const { data, error } = await supabase
      .from('test_answers')
      .select('*, test_questions(prompt, type, points)')
      .eq('attempt_id', attemptId);
    if (error) { console.error('getAnswersForAttempt failed', error); return []; }
    return (data ?? []).map(mapTestAnswerRow);
  };

  const gradeEssayAnswer = async (answerId: string, pointsAwarded: number, feedback: string) => {
    if (!currentUser) return { error: 'Not signed in' };
    const { error } = await supabase.from('test_answers').update({
      points_awarded: pointsAwarded, feedback, graded_by: currentUser.id, graded_at: new Date().toISOString(),
    }).eq('id', answerId);
    return { error: error?.message ?? null };
  };

  const getViolationsForTest = async (testId: string): Promise<ExamViolation[]> => {
    const { data, error } = await supabase
      .from('exam_violations')
      .select('*, profiles(name)')
      .eq('test_id', testId)
      .order('occurred_at', { ascending: false });
    if (error) { console.error('getViolationsForTest failed', error); return []; }
    return (data ?? []).map(mapViolationRow);
  };

  const subscribeToTestAttempts = (testId: string, onChange: (attempt: TestAttempt) => void) => {
    const channel = supabase
      .channel(`test-attempts-${testId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'test_attempts', filter: `test_id=eq.${testId}` }, (payload) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onChange(mapTestAttemptRow(payload.new as any));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  const subscribeToTestViolations = (testId: string, onViolation: (violation: ExamViolation) => void) => {
    const channel = supabase
      .channel(`test-violations-${testId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'exam_violations', filter: `test_id=eq.${testId}` }, (payload) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onViolation(mapViolationRow(payload.new as any));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  const sweepExpiredAttempts = async (testId: string) => {
    const { error } = await supabase.rpc('finalize_expired_attempts_for_test', { p_test_id: testId });
    if (error) console.error('sweepExpiredAttempts failed', error);
  };

  // ------------------------------------------------------------
  // Tests / Exams -- student side. Every mutation goes through a
  // SECURITY DEFINER RPC -- see supabase/patch_7.sql -- so timers,
  // one-attempt enforcement, grading, and strike counts can't be
  // forged from the browser console.
  // ------------------------------------------------------------
  const getMyAttemptForTest = async (testId: string): Promise<TestAttempt | null> => {
    if (!session?.user.id) return null;
    const { data, error } = await supabase
      .from('test_attempts')
      .select('*')
      .eq('test_id', testId)
      .eq('student_id', session.user.id)
      .maybeSingle();
    if (error) { console.error('getMyAttemptForTest failed', error); return null; }
    return data ? mapTestAttemptRow(data) : null;
  };

  const getAttemptById = async (attemptId: string): Promise<TestAttempt | null> => {
    const { data, error } = await supabase.from('test_attempts').select('*').eq('id', attemptId).maybeSingle();
    if (error) { console.error('getAttemptById failed', error); return null; }
    return data ? mapTestAttemptRow(data) : null;
  };

  const startTestAttempt = async (testId: string) => {
    const { data, error } = await supabase.rpc('start_test_attempt', { p_test_id: testId });
    if (error) return { error: error.message };
    const row = Array.isArray(data) ? data[0] : data;
    return { error: null, attemptId: row.attempt_id as string, expiresAt: row.expires_at as string };
  };

  const getAttemptQuestions = async (attemptId: string): Promise<AttemptQuestion[]> => {
    const { data, error } = await supabase.rpc('get_attempt_questions', { p_attempt_id: attemptId });
    if (error) { console.error('getAttemptQuestions failed', error); return []; }
    return (data ?? []).map(mapAttemptQuestionRow);
  };

  const saveTestAnswer = async (attemptId: string, questionId: string, answer: { selectedOption?: string; essayText?: string }) => {
    const { error } = await supabase.rpc('save_test_answer', {
      p_attempt_id: attemptId, p_question_id: questionId,
      p_selected_option: answer.selectedOption ?? null, p_essay_text: answer.essayText ?? null,
    });
    return { error: error?.message ?? null };
  };

  const submitTestAttempt = async (attemptId: string) => {
    const { data, error } = await supabase.rpc('submit_test_attempt', { p_attempt_id: attemptId });
    if (error) return { error: error.message };
    const row = Array.isArray(data) ? data[0] : data;
    return { error: null, score: Number(row.score), maxScore: Number(row.max_score), status: row.status as string };
  };

  const recordTestViolation = async (attemptId: string) => {
    const { data, error } = await supabase.rpc('record_test_violation', { p_attempt_id: attemptId });
    if (error) return { error: error.message };
    const row = Array.isArray(data) ? data[0] : data;
    return { error: null, violationCount: row.violation_count as number, status: row.status as string };
  };

  const finalizeMyExpiredAttempts = async () => {
    const { error } = await supabase.rpc('finalize_expired_attempts');
    if (error) console.error('finalizeMyExpiredAttempts failed', error);
  };

  const submitAdmissionApplication = async (input: NewAdmissionApplicationInput, photo: File | null) => {
    const id = crypto.randomUUID();
    let photoPath: string | null = null;
    if (photo) {
      photoPath = `${id}/photo-${photo.name}`;
      const { error: uploadError } = await supabase.storage.from('admission-photos').upload(photoPath, photo);
      if (uploadError) return { error: `Failed to upload photo: ${uploadError.message}` };
    }
    const { error } = await supabase.from('admission_applications').insert({
      id,
      surname: input.surname,
      first_name: input.firstName,
      other_names: input.otherNames || null,
      sex: input.sex,
      date_of_birth: input.dateOfBirth,
      home_address: input.homeAddress,
      nationality: input.nationality,
      state_of_origin: input.stateOfOrigin,
      lga: input.lga,
      religion: input.religion || null,
      blood_group: input.bloodGroup || null,
      genotype: input.genotype || null,
      father_name: input.fatherName || null,
      father_occupation: input.fatherOccupation || null,
      father_office_address: input.fatherOfficeAddress || null,
      father_phone: input.fatherPhone || null,
      mother_name: input.motherName || null,
      mother_occupation: input.motherOccupation || null,
      mother_office_address: input.motherOfficeAddress || null,
      mother_phone: input.motherPhone || null,
      health_challenge: input.healthChallenge || null,
      health_challenge_details: input.healthChallengeDetails || null,
      school_last_attended: input.schoolLastAttended || null,
      pickup_person: input.pickupPerson,
      pickup_phone: input.pickupPhone,
      sibling_names: input.siblingNames || null,
      photo_path: photoPath,
    });
    return { error: error?.message ?? null };
  };

  const getAdmissionApplications = async (): Promise<AdmissionApplication[]> => {
    const { data, error } = await supabase.from('admission_applications').select('*').order('created_at', { ascending: false });
    if (error) { console.error('getAdmissionApplications failed', error); return []; }
    return (data ?? []).map(mapAdmissionApplicationRow);
  };

  const reviewAdmissionApplication = async (id: string, status: 'reviewed' | 'admitted' | 'declined', adminNote: string) => {
    if (!currentUser) return { error: 'Not signed in' };
    const { error } = await supabase.from('admission_applications').update({
      status, admin_note: adminNote || null, reviewed_by: currentUser.id, reviewed_at: new Date().toISOString(),
    }).eq('id', id);
    return { error: error?.message ?? null };
  };

  const getAdmissionPhotoUrl = async (path: string): Promise<string | null> => {
    const { data, error } = await supabase.storage.from('admission-photos').createSignedUrl(path, 3600);
    if (error || !data) { console.error('getAdmissionPhotoUrl failed', error); return null; }
    return data.signedUrl;
  };

  const submitPaymentReceipt = async (amount: number, note: string, file: File) => {
    if (!session?.user.id) return { error: 'Not signed in' };
    const studentId = session.user.id;
    const path = `${studentId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from('payment-receipts').upload(path, file);
    if (uploadError) return { error: uploadError.message };
    const { error } = await supabase.from('payment_receipts').insert({
      student_id: studentId, amount, note: note || null, file_path: path, file_name: file.name,
    });
    return { error: error?.message ?? null };
  };

  const getMyPaymentReceipts = async (): Promise<PaymentReceipt[]> => {
    if (!session?.user.id) return [];
    const { data, error } = await supabase
      .from('payment_receipts')
      .select('*')
      .eq('student_id', session.user.id)
      .order('created_at', { ascending: false });
    if (error) { console.error('getMyPaymentReceipts failed', error); return []; }
    return (data ?? []).map(mapPaymentReceiptRow);
  };

  const getAllPaymentReceipts = async (): Promise<PaymentReceipt[]> => {
    const { data, error } = await supabase
      .from('payment_receipts')
      .select('*, profiles(name, display_id)')
      .order('created_at', { ascending: false });
    if (error) { console.error('getAllPaymentReceipts failed', error); return []; }
    return (data ?? []).map(mapPaymentReceiptRow);
  };

  const reviewPaymentReceipt = async (id: string, status: 'acknowledged' | 'rejected', adminNote: string) => {
    if (!currentUser) return { error: 'Not signed in' };
    const { error } = await supabase.from('payment_receipts').update({
      status, admin_note: adminNote || null, reviewed_by: currentUser.id, reviewed_at: new Date().toISOString(),
    }).eq('id', id);
    return { error: error?.message ?? null };
  };

  const getPaymentReceiptUrl = async (path: string): Promise<string | null> => {
    const { data, error } = await supabase.storage.from('payment-receipts').createSignedUrl(path, 3600);
    if (error || !data) { console.error('getPaymentReceiptUrl failed', error); return null; }
    return data.signedUrl;
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
      login, logout, registerStudent, registerStaff, verifySignupOtp, requestPasswordReset, verifyRecoveryOtp, updatePassword, inviteUser,
      updateUser, uploadAvatar, removeAvatar, deleteUser, approveTeacher, promoteStudent, addResult,
      getReportCard, upsertReportCard, getSubjectStats,
      subjectsByClass, updateSubjects, timetables, updateTimetable,
      notifications, addNotification, exportData,
      assignments, mySubmissions, createAssignment, deleteAssignment, submitAssignment,
      getSubmissionsForAssignment, gradeSubmission, getAssignmentFileUrl,
      messageContacts, getConversation, sendDirectMessage, markConversationRead, subscribeToDirectMessages,
      uploadChatAttachment, getChatAttachmentUrl,
      submitAdmissionApplication, getAdmissionApplications, reviewAdmissionApplication, getAdmissionPhotoUrl,
      submitPaymentReceipt, getMyPaymentReceipts, getAllPaymentReceipts, reviewPaymentReceipt, getPaymentReceiptUrl,
      tests, createTest, updateTest, publishTest, closeTest, deleteTest,
      getTestQuestions, saveQuestion, deleteQuestion, reorderQuestions,
      getAttemptsForTest, getAnswersForAttempt, gradeEssayAnswer, getViolationsForTest,
      subscribeToTestAttempts, subscribeToTestViolations, sweepExpiredAttempts,
      getMyAttemptForTest, getAttemptById, startTestAttempt, getAttemptQuestions, saveTestAnswer,
      submitTestAttempt, recordTestViolation, finalizeMyExpiredAttempts,
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
