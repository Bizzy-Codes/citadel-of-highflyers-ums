const COMMENT_HISTORY_KEY = 'citadel_comment_history';

interface CommentHistory {
  classTeacher: string[];
  headmaster: string[];
}

export function getCommentHistory(): CommentHistory {
  try {
    const stored = localStorage.getItem(COMMENT_HISTORY_KEY);
    return stored ? JSON.parse(stored) : { classTeacher: [], headmaster: [] };
  } catch {
    return { classTeacher: [], headmaster: [] };
  }
}

export function addCommentToHistory(type: 'classTeacher' | 'headmaster', comment: string) {
  if (!comment.trim()) return;

  try {
    const history = getCommentHistory();
    const list = history[type];

    // Remove if it already exists and add to front
    const filtered = list.filter(c => c !== comment);
    filtered.unshift(comment);

    // Keep only last 10 unique comments
    list.splice(0, list.length, ...filtered.slice(0, 10));

    localStorage.setItem(COMMENT_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Silently fail if localStorage unavailable
  }
}

export function getSuggestedComments(type: 'classTeacher' | 'headmaster'): string[] {
  return getCommentHistory()[type] || [];
}
