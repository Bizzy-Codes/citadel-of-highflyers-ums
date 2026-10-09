// Where a "you have a new message" click should land: straight in the
// chat the message is in, not just the Messages page.
export type UnreadTarget =
  | { kind: 'dm'; senderId: string }
  | { kind: 'group' }
  | null;

// react-router location state understood by the Messages page.
export const messageNav = (target: UnreadTarget): { view: 'chats' | 'group'; contactId?: string } => {
  if (target?.kind === 'dm') return { view: 'chats', contactId: target.senderId };
  if (target?.kind === 'group') return { view: 'group' };
  return { view: 'chats' };
};
