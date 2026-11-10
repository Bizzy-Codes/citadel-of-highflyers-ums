import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth, type DirectMessage, type ClassMessage, type ClassSeenRow, type BlockedTerm, type User } from '../../context/AuthContext';
import {
  Send, MessageCircle, MessageSquare, Bell, Users, ArrowLeft, Paperclip, FileDown, Search, ImagePlus, X,
  Pin, PinOff, Trash2, ShieldAlert, MoreHorizontal, Check, CheckCheck,
} from 'lucide-react';
import { compressImageToTarget } from '../../lib/imageCompression';
import SpotlightBanner from '../../components/spotlight/SpotlightBanner';
import './Messages.css';

const ICON = { strokeWidth: 1.5 } as const;

const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
};

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// Time shown on a chat in the list: the clock today, "Yesterday", else the date.
const listTime = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return clock(iso);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
};

const roleLabel = (role: string) => {
  const text = role.replace('_', ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const Avatar = ({ name, url }: { name: string; url?: string }) => (
  <div className="msg-avatar" aria-hidden="true">
    {url ? <img src={url} alt="" /> : name.charAt(0).toUpperCase()}
  </div>
);

const Messages = () => {
  const {
    currentUser, notifications, addNotification, uploadAnnouncementImage, messageContacts, getConversation, sendDirectMessage,
    markConversationRead, subscribeToDirectMessages, uploadChatAttachment, getChatAttachmentUrl, classChatNames, getClassMessages,
    sendClassMessage, subscribeToClassMessages, markClassChatRead, getClassSeen, deleteClassMessage, pinClassMessage,
    getBlockedTerms, addBlockedTerm, removeBlockedTerm, dmSummaries, dmUnread, groupUnread, refreshDmSummaries,
  } = useAuth();
  const location = useLocation();
  const isAdmin = currentUser?.role === 'admin';
  // The notifications table's RLS already lets teachers post ("staff
  // write notifications" covers admin and teacher).
  const canPostAnnouncements = isAdmin || currentUser?.role === 'teacher';
  // Where we were sent: from a link / notification (?chat=<id> or ?group=1)
  // or from a click inside the app (router state). Either way we open the
  // exact chat the message is in.
  const navState = location.state as { view?: 'chats' | 'notifications' | 'whatsapp' | 'group'; contactId?: string } | null;
  const query = new URLSearchParams(location.search);
  const linkedContactId = navState?.contactId ?? query.get('chat') ?? undefined;
  const forcedView = navState?.view ?? (query.get('chat') ? 'chats' : query.get('group') ? 'group' : undefined);
  // Pupils and teachers only have a private chat with the admin; the
  // header's "messages" button takes them to their class group first.
  const startView = forcedView === 'chats' && !linkedContactId && !isAdmin && classChatNames.length > 0 ? 'group' : forcedView;
  const [activeView, setActiveView] = useState<'chats' | 'notifications' | 'whatsapp' | 'group'>(startView ?? (isAdmin ? 'chats' : 'notifications'));

  // ---------- Class group chat ----------
  const [groupClass, setGroupClass] = useState<string>(classChatNames[0] ?? '');
  const [groupMessages, setGroupMessages] = useState<ClassMessage[]>([]);
  const [groupDraft, setGroupDraft] = useState('');
  const [groupLoading, setGroupLoading] = useState(false);
  const groupListRef = useRef<HTMLDivElement>(null);
  const [groupSeen, setGroupSeen] = useState<ClassSeenRow[]>([]);
  const [seenOpenId, setSeenOpenId] = useState<string | null>(null);
  const hasGroup = classChatNames.length > 0;
  const activeGroup = classChatNames.includes(groupClass) ? groupClass : (classChatNames[0] ?? '');

  useEffect(() => {
    if (activeView !== 'group' || !activeGroup) return;
    let cancelled = false;
    setGroupLoading(true);
    getClassMessages(activeGroup).then((msgs) => {
      if (cancelled) return;
      setGroupMessages(msgs);
      setGroupLoading(false);
      markClassChatRead(activeGroup);
    });
    const unsubscribe = subscribeToClassMessages(activeGroup, (msg, change) => {
      if (change === 'DELETE') { setGroupMessages((prev) => prev.filter((m) => m.id !== msg.id)); return; }
      if (change === 'UPDATE') { setGroupMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m))); return; }
      setGroupMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      markClassChatRead(activeGroup);
    });
    return () => { cancelled = true; unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, activeGroup]);

  // Scroll the message list itself (not the whole page) to the newest message.
  const scrollToEnd = (el: HTMLDivElement | null) => el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  useEffect(() => { scrollToEnd(groupListRef.current); }, [groupMessages.length]);

  // Who has seen the group chat (read receipts). Refreshed while it is open.
  useEffect(() => {
    if (activeView !== 'group' || !activeGroup) return;
    let cancelled = false;
    const load = () => getClassSeen(activeGroup).then((rows) => { if (!cancelled) setGroupSeen(rows); });
    load();
    const timer = setInterval(load, 10_000);
    return () => { cancelled = true; clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, activeGroup, groupMessages.length]);

  // Teachers (their own class) and the admin can pin and delete.
  const isStaff = isAdmin || currentUser?.role === 'teacher';
  const pinnedMessages = groupMessages.filter((m) => m.pinnedAt).sort((a, b) => (b.pinnedAt ?? '').localeCompare(a.pinnedAt ?? ''));

  // The strip at the top shows ONE pinned message on ONE line. Tapping it
  // scrolls to that message, and the next tap moves on to the next pin.
  const [pinIndex, setPinIndex] = useState(0);
  const [flashId, setFlashId] = useState<string | null>(null);
  const shownPin = pinnedMessages.length > 0 ? pinnedMessages[pinIndex % pinnedMessages.length] : null;
  const jumpToPinned = () => {
    if (!shownPin) return;
    document.getElementById(`gm-${shownPin.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlashId(shownPin.id);
    setTimeout(() => setFlashId(null), 1400);
    setPinIndex((i) => (i + 1) % pinnedMessages.length);
  };

  // The "..." menu on a message (pin / delete), for teachers and the admin.
  const [menuFor, setMenuFor] = useState<string | null>(null);
  useEffect(() => {
    if (!menuFor) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.msg-menu, .msg-more')) setMenuFor(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuFor]);

  const handlePin = async (msg: ClassMessage) => {
    setMenuFor(null);
    const { error } = await pinClassMessage(msg.id, !msg.pinnedAt);
    if (error) alert('Could not change the pin: ' + error);
  };

  const handleDeleteGroupMessage = async (msg: ClassMessage) => {
    setMenuFor(null);
    if (!confirm(`Delete this message from ${msg.senderName}? Everyone in the class will no longer see it.`)) return;
    const { error } = await deleteClassMessage(msg.id);
    if (error) alert('Could not delete the message: ' + error);
  };

  // Admin: edit the list of words and emojis pupils are not allowed to send.
  const [showBlocked, setShowBlocked] = useState(false);
  const [blockedList, setBlockedList] = useState<BlockedTerm[]>([]);
  const [newTerm, setNewTerm] = useState('');
  const openBlocked = async () => { setShowBlocked(true); setBlockedList(await getBlockedTerms()); };
  const handleAddTerm = async () => {
    const isEmoji = /\P{ASCII}/u.test(newTerm);
    const { error } = await addBlockedTerm(newTerm, isEmoji ? 'emoji' : 'word');
    if (error) { alert(error); return; }
    setNewTerm('');
    setBlockedList(await getBlockedTerms());
  };
  const handleRemoveTerm = async (term: string) => {
    const { error } = await removeBlockedTerm(term);
    if (error) { alert(error); return; }
    setBlockedList(await getBlockedTerms());
  };

  const handleSendGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup || !groupDraft.trim()) return;
    const draft = groupDraft;
    setGroupDraft('');
    const { error } = await sendClassMessage(activeGroup, draft);
    if (error) { alert('Failed to send message: ' + error); setGroupDraft(draft); }
  };

  // ---------- Private chats ----------
  const [selectedContactId, setSelectedContactId] = useState<string | null>(linkedContactId ?? null);
  const [conversation, setConversation] = useState<DirectMessage[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const dmListRef = useRef<HTMLDivElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectedContactId) return;
    let cancelled = false;
    setChatLoading(true);
    getConversation(selectedContactId).then((msgs) => {
      if (cancelled) return;
      setConversation(msgs);
      setChatLoading(false);
      markConversationRead(selectedContactId);
    });
    const unsubscribe = subscribeToDirectMessages(selectedContactId, (msg) => {
      // New message, or an existing one changing (it has now been read).
      setConversation((prev) => (prev.some((m) => m.id === msg.id) ? prev.map((m) => (m.id === msg.id ? msg : m)) : [...prev, msg]));
      if (msg.senderId === selectedContactId && !msg.readAt) markConversationRead(selectedContactId);
    });
    return () => { cancelled = true; unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedContactId]);

  useEffect(() => { scrollToEnd(dmListRef.current); }, [conversation.length, selectedContactId]);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContactId || !chatDraft.trim()) return;
    const draft = chatDraft;
    setChatDraft('');
    const { error } = await sendDirectMessage(selectedContactId, draft);
    if (error) { alert('Failed to send message: ' + error); setChatDraft(draft); return; }
    void refreshDmSummaries();
  };

  const handleAttachmentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedContactId) return;
    setUploadingAttachment(true);
    const { error, path, name } = await uploadChatAttachment(selectedContactId, file);
    if (error || !path || !name) {
      setUploadingAttachment(false);
      alert('Failed to upload attachment: ' + error);
      return;
    }
    const caption = chatDraft.trim();
    setChatDraft('');
    const { error: sendError } = await sendDirectMessage(selectedContactId, caption, { path, name });
    setUploadingAttachment(false);
    if (sendError) alert('Failed to send attachment: ' + sendError);
    else void refreshDmSummaries();
  };

  const handleOpenAttachment = async (path: string) => {
    const url = await getChatAttachmentUrl(path);
    if (url) window.open(url, '_blank');
    else alert('Could not open this attachment.');
  };

  const selectedContact = messageContacts.find((c) => c.id === selectedContactId) ?? null;

  // Chats with something new first (newest on top), then the rest of the
  // chats by most recent message, then everyone else by name.
  const search = contactSearch.trim().toLowerCase();
  const matching = messageContacts.filter((c) => c.name.toLowerCase().includes(search));
  const withChat = matching
    .filter((c) => dmSummaries[c.id])
    .sort((a, b) => {
      const A = dmSummaries[a.id];
      const B = dmSummaries[b.id];
      if ((A.unread > 0) !== (B.unread > 0)) return A.unread > 0 ? -1 : 1;
      return B.lastAt.localeCompare(A.lastAt);
    });
  const noChat = matching.filter((c) => !dmSummaries[c.id]).sort((a, b) => a.name.localeCompare(b.name));

  const renderContact = (contact: User) => {
    const summary = dmSummaries[contact.id];
    const unread = summary?.unread ?? 0;
    return (
      <button
        key={contact.id}
        type="button"
        className={`msg-contact ${unread > 0 ? 'unread' : ''}`}
        aria-current={selectedContactId === contact.id}
        onClick={() => setSelectedContactId(contact.id)}
      >
        <Avatar name={contact.name} url={contact.avatarUrl} />
        <div style={{ minWidth: 0 }}>
          <div className="msg-contact-top">
            <span className="msg-contact-name">{contact.name}</span>
            {summary && <span className="msg-contact-time">{listTime(summary.lastAt)}</span>}
          </div>
          <div className="msg-contact-preview">
            {summary ? `${summary.lastMine ? 'You: ' : ''}${summary.lastText}` : roleLabel(contact.role)}
          </div>
        </div>
        {unread > 0 ? <span className="msg-badge" aria-label={`${unread} unread`}>{unread}</span> : <span />}
      </button>
    );
  };

  // ---------- Notices and WhatsApp (admin) ----------
  const [waMessage, setWaMessage] = useState('');
  const [waImage, setWaImage] = useState<File | null>(null);
  const waImageInputRef = useRef<HTMLInputElement>(null);
  const noticeImageInputRef = useRef<HTMLInputElement>(null);
  const [noticeImage, setNoticeImage] = useState<File | null>(null);
  const [notifPopupDays, setNotifPopupDays] = useState(0);
  const [posting, setPosting] = useState(false);

  // A picture is shown as a preview before it is posted.
  const [noticeImagePreview, setNoticeImagePreview] = useState<string | null>(null);
  const [waImagePreview, setWaImagePreview] = useState<string | null>(null);
  useEffect(() => {
    if (!noticeImage) { setNoticeImagePreview(null); return; }
    const url = URL.createObjectURL(noticeImage);
    setNoticeImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [noticeImage]);
  useEffect(() => {
    if (!waImage) { setWaImagePreview(null); return; }
    const url = URL.createObjectURL(waImage);
    setWaImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [waImage]);

  const pickImage = async (e: React.ChangeEvent<HTMLInputElement>, set: (f: File | null) => void) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please choose an image (JPG or PNG).'); return; }
    if (file.size > 15 * 1024 * 1024) { alert('That picture is too large -- please choose one under 15MB.'); return; }
    let out = file;
    if (file.size > 2 * 1024 * 1024) {
      try { out = await compressImageToTarget(file, 2 * 1024 * 1024); } catch { /* use the original */ }
    }
    set(out);
  };

  const [notifTitle, setNotifTitle] = useState('');
  const [notifMsg, setNotifMsg] = useState('');
  const [notifType, setNotifType] = useState<'info' | 'warning' | 'success'>('info');
  const [notifAudience, setNotifAudience] = useState<'all' | 'students' | 'teachers'>('all');

  const handleSendWhatsApp = async () => {
    if (!waMessage.trim() && !waImage) return;
    // On a phone, the share sheet can hand WhatsApp the picture AND the
    // text together. On a computer that isn't possible, so the picture is
    // put online and its link goes into the message (WhatsApp shows it
    // as a preview).
    if (waImage && typeof navigator.canShare === 'function' && navigator.canShare({ files: [waImage] })) {
      try {
        await navigator.share({ files: [waImage], text: waMessage });
        setWaMessage(''); setWaImage(null);
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return; // closed the share sheet
      }
    }
    let text = waMessage;
    if (waImage) {
      const { error, url: imgUrl } = await uploadAnnouncementImage(waImage);
      if (error || !imgUrl) { alert('Could not upload the picture: ' + error); return; }
      text = `${text}${text ? '\n\n' : ''}${imgUrl}`;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    setWaMessage(''); setWaImage(null);
  };

  const handlePostNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle || !notifMsg) return;
    setPosting(true);
    let imageUrl: string | undefined;
    if (noticeImage) {
      const up = await uploadAnnouncementImage(noticeImage);
      if (up.error || !up.url) { setPosting(false); alert('Could not upload the picture: ' + up.error); return; }
      imageUrl = up.url;
    }
    const { error } = await addNotification({
      title: notifTitle, message: notifMsg, type: notifType, audience: notifAudience,
      imageUrl, popupDays: notifPopupDays,
    });
    setPosting(false);
    if (error) { alert('The announcement could not be posted: ' + error); return; }
    setNotifTitle('');
    setNotifMsg('');
    setNoticeImage(null);
    setNotifPopupDays(0);
    alert(
      notifAudience === 'all' ? 'Announcement posted to everyone.'
      : notifAudience === 'students' ? 'Announcement posted to all pupils.'
      : 'Announcement posted to all staff.'
    );
  };

  const tabs: { id: 'notifications' | 'group' | 'chats' | 'whatsapp'; label: string; icon: React.ReactNode; badge?: number; show: boolean }[] = [
    { id: 'notifications', label: 'Notices', icon: <Bell size={16} {...ICON} />, show: true },
    { id: 'group', label: isAdmin ? 'Class groups' : `${activeGroup} group`, icon: <Users size={16} {...ICON} />, badge: groupUnread, show: hasGroup },
    { id: 'chats', label: isAdmin ? 'Private chats' : 'Message the admin', icon: <MessageSquare size={16} {...ICON} />, badge: dmUnread, show: true },
    { id: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle size={16} {...ICON} />, show: isAdmin },
  ];

  return (
    <PortalLayout title="Messages">
      <div className="msg">
        <div className="msg-tabs" role="tablist" aria-label="Messages">
          {tabs.filter((t) => t.show).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeView === t.id}
              className="msg-tab"
              onClick={() => setActiveView(t.id)}
            >
              {t.icon} {t.label}
              {!!t.badge && t.badge > 0 && <span className="msg-badge" aria-label={`${t.badge} unread`}>{t.badge}</span>}
            </button>
          ))}
        </div>

        <div className="msg-pane">

          {/* ---------- Notices ---------- */}
          {activeView === 'notifications' && (
            <div className="msg-scroll">
              {canPostAnnouncements && (
                <form onSubmit={handlePostNotification} className="msg-form">
                  <h4>Post an announcement</h4>
                  <input className="msg-field" type="text" placeholder="Title" value={notifTitle} onChange={(e) => setNotifTitle(e.target.value)} />
                  <textarea className="msg-field" placeholder="Message" rows={3} value={notifMsg} onChange={(e) => setNotifMsg(e.target.value)} style={{ resize: 'vertical' }} />
                  <input ref={noticeImageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => pickImage(e, setNoticeImage)} />
                  {noticeImagePreview ? (
                    <div style={{ position: 'relative', alignSelf: 'flex-start' }}>
                      <img src={noticeImagePreview} alt="Attached" style={{ maxWidth: '100%', maxHeight: '220px', borderRadius: '8px', display: 'block' }} />
                      <button type="button" className="msg-icon-btn small" onClick={() => setNoticeImage(null)} title="Remove picture" style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.65)', color: '#fff' }}><X size={16} {...ICON} /></button>
                    </div>
                  ) : (
                    <button type="button" className="msg-btn" style={{ alignSelf: 'flex-start' }} onClick={() => noticeImageInputRef.current?.click()}>
                      <ImagePlus size={16} {...ICON} /> Add a picture
                    </button>
                  )}
                  <div className="msg-row-wrap">
                    <label htmlFor="notif-popup-days" style={{ fontSize: '14px', fontWeight: 500 }}>Pop up at login</label>
                    <select id="notif-popup-days" value={notifPopupDays} onChange={(e) => setNotifPopupDays(Number(e.target.value))}>
                      <option value={0}>No pop-up</option>
                      <option value={1}>For 1 day</option>
                      <option value={2}>For 2 days</option>
                      <option value={3}>For 3 days</option>
                      <option value={5}>For 5 days</option>
                      <option value={7}>For 7 days</option>
                      <option value={14}>For 14 days</option>
                      <option value={30}>For 30 days</option>
                    </select>
                  </div>
                  <p className="msg-hint" style={{ margin: 0 }}>Everyone it is for sees it each time they log in during this period.</p>
                  <div className="msg-row-wrap" style={{ justifyContent: 'space-between' }}>
                    <div className="msg-row-wrap">
                      <select aria-label="Who is it for" value={notifAudience} onChange={(e) => setNotifAudience(e.target.value as 'all' | 'students' | 'teachers')}>
                        <option value="all">Everyone</option>
                        <option value="students">Pupils only</option>
                        <option value="teachers">Staff only</option>
                      </select>
                      <select aria-label="Type" value={notifType} onChange={(e) => setNotifType(e.target.value as 'info' | 'warning' | 'success')}>
                        <option value="info">Information</option>
                        <option value="warning">Important</option>
                        <option value="success">Good news</option>
                      </select>
                    </div>
                    <button type="submit" className="msg-btn primary" disabled={posting}>
                      <Send size={16} {...ICON} /> {posting ? 'Posting' : 'Post'}
                    </button>
                  </div>
                </form>
              )}

              {notifications.map((n, i) => (
                <article key={i} className={`msg-notice ${n.type === 'warning' ? 'warning' : n.type === 'success' ? 'success' : ''}`}>
                  <div className="msg-notice-head">
                    <h4>{n.title}</h4>
                    <time>{new Date(n.date).toLocaleDateString()}</time>
                  </div>
                  {n.imageUrl && (
                    <a href={n.imageUrl} target="_blank" rel="noreferrer">
                      <img src={n.imageUrl} alt="" loading="lazy" />
                    </a>
                  )}
                  <p>{n.message}</p>
                </article>
              ))}
              {notifications.length === 0 && (
                <div className="msg-empty">
                  <Bell size={32} {...ICON} />
                  <p>No notices yet</p>
                </div>
              )}
            </div>
          )}

          {/* ---------- WhatsApp (admin) ---------- */}
          {activeView === 'whatsapp' && isAdmin && (
            <div className="msg-scroll">
              <div style={{ width: '100%', maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h2 className="msg-title">WhatsApp group message</h2>
                <p className="msg-hint" style={{ margin: 0 }}>Write the message here. WhatsApp opens with it ready to send to the school group.</p>
                <textarea
                  className="msg-field"
                  value={waMessage}
                  onChange={(e) => setWaMessage(e.target.value)}
                  placeholder="Message"
                  style={{ minHeight: '200px', resize: 'vertical' }}
                />
                <input ref={waImageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => pickImage(e, setWaImage)} />
                {waImagePreview ? (
                  <div style={{ position: 'relative', alignSelf: 'flex-start' }}>
                    <img src={waImagePreview} alt="Attached" style={{ maxWidth: '100%', maxHeight: '240px', borderRadius: '8px', display: 'block' }} />
                    <button type="button" className="msg-icon-btn small" onClick={() => setWaImage(null)} title="Remove picture" style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.65)', color: '#fff' }}><X size={16} {...ICON} /></button>
                  </div>
                ) : (
                  <button type="button" className="msg-btn" style={{ alignSelf: 'flex-start' }} onClick={() => waImageInputRef.current?.click()}>
                    <ImagePlus size={16} {...ICON} /> Add a picture
                  </button>
                )}
                <button type="button" className="msg-btn" onClick={handleSendWhatsApp} style={{ height: '48px', background: '#1fa855', borderColor: 'transparent', color: '#fff' }}>
                  <MessageCircle size={18} {...ICON} /> Open WhatsApp
                </button>
              </div>
            </div>
          )}

          {/* ---------- Class group ---------- */}
          {activeView === 'group' && hasGroup && (
            <div className="msg-thread">
              <div className="msg-head">
                <Avatar name={activeGroup} />
                <div className="msg-head-text">
                  <div className="msg-head-title">{activeGroup} group</div>
                  <div className="msg-head-sub">Everyone in {activeGroup} sees these messages</div>
                </div>
                {isAdmin && (
                  <select value={activeGroup} onChange={(e) => setGroupClass(e.target.value)} aria-label="Class">
                    {classChatNames.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
                {isAdmin && (
                  <button type="button" className="msg-icon-btn" onClick={openBlocked} title="Blocked words and emojis" aria-label="Blocked words and emojis"><ShieldAlert size={18} {...ICON} /></button>
                )}
              </div>

              <SpotlightBanner className={activeGroup} />

              {shownPin && (
                <div
                  className="msg-pinned"
                  role="button"
                  tabIndex={0}
                  onClick={jumpToPinned}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); jumpToPinned(); } }}
                  title="Show this message"
                >
                  <Pin size={16} {...ICON} />
                  <span className="msg-pinned-text"><b>{shownPin.senderName}</b> {shownPin.content.replace(/\s+/g, ' ')}</span>
                  {pinnedMessages.length > 1 && <span className="msg-pinned-count">{(pinIndex % pinnedMessages.length) + 1} of {pinnedMessages.length}</span>}
                  {isStaff && (
                    <button type="button" className="msg-icon-btn small" title="Unpin" aria-label="Unpin" onClick={(e) => { e.stopPropagation(); void handlePin(shownPin); }}>
                      <PinOff size={16} {...ICON} />
                    </button>
                  )}
                </div>
              )}

              <div className="msg-list" ref={groupListRef}>
                {groupLoading && <p className="msg-empty">Loading messages</p>}
                {!groupLoading && groupMessages.length === 0 && (
                  <div className="msg-empty">
                    <Users size={32} {...ICON} />
                    <p>No messages yet. What you write here goes to everyone in {activeGroup}.</p>
                  </div>
                )}
                {groupMessages.map((msg, i) => {
                  const prev = groupMessages[i - 1];
                  const newDay = !prev || !sameDay(prev.createdAt, msg.createdAt);
                  const first = newDay || prev.senderId !== msg.senderId;
                  const mine = msg.senderId === currentUser?.id;
                  const staffSender = msg.senderRole === 'teacher' || msg.senderRole === 'admin';
                  const seenBy = mine ? groupSeen.filter((r) => r.userId !== currentUser?.id && new Date(r.lastReadAt).getTime() >= new Date(msg.createdAt).getTime()) : [];
                  return (
                    <div key={msg.id} style={{ display: 'contents' }}>
                      {newDay && <div className="msg-day">{dayLabel(msg.createdAt)}</div>}
                      <div id={`gm-${msg.id}`} className={`msg-row ${mine ? 'mine' : ''} ${first && !newDay ? 'first' : ''}`}>
                        <div className={`msg-bubble ${staffSender && !mine ? 'staff' : ''} ${flashId === msg.id ? 'flash' : ''}`}>
                          {!mine && first && (
                            <div className="msg-sender">
                              {msg.senderName}
                              {staffSender && <span className="msg-role">{msg.senderRole === 'admin' ? 'Admin' : 'Teacher'}</span>}
                            </div>
                          )}
                          <p className="msg-text">{msg.content}</p>
                          <div className="msg-meta">
                            {msg.pinnedAt && <Pin size={12} {...ICON} aria-label="Pinned" />}
                            {mine && (seenBy.length > 0
                              ? (
                                <button type="button" onClick={() => setSeenOpenId(seenOpenId === msg.id ? null : msg.id)}>
                                  <CheckCheck size={14} {...ICON} /> Seen by {seenBy.length}
                                </button>
                              )
                              : <Check size={14} {...ICON} aria-label="Sent" />)}
                            <span>{clock(msg.createdAt)}</span>
                            {isStaff && (
                              <button type="button" className="msg-more" aria-label="Message options" onClick={() => setMenuFor(menuFor === msg.id ? null : msg.id)}>
                                <MoreHorizontal size={16} {...ICON} />
                              </button>
                            )}
                          </div>
                          {mine && seenOpenId === msg.id && seenBy.length > 0 && (
                            <span className="msg-meta msg-seen-names">{seenBy.map((r) => r.userName).join(', ')}</span>
                          )}
                          {menuFor === msg.id && (
                            <div className="msg-menu" role="menu">
                              <button type="button" role="menuitem" onClick={() => handlePin(msg)}>
                                {msg.pinnedAt ? <><PinOff size={16} {...ICON} /> Unpin</> : <><Pin size={16} {...ICON} /> Pin to the top</>}
                              </button>
                              <button type="button" role="menuitem" className="danger" onClick={() => handleDeleteGroupMessage(msg)}>
                                <Trash2 size={16} {...ICON} /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={handleSendGroup} className="msg-composer">
                <input
                  className="msg-input"
                  type="text"
                  placeholder={`Message ${activeGroup} group`}
                  value={groupDraft}
                  onChange={(e) => setGroupDraft(e.target.value)}
                  enterKeyHint="send"
                />
                <button type="submit" className="msg-send" disabled={!groupDraft.trim()} aria-label="Send"><Send size={18} {...ICON} /></button>
              </form>
            </div>
          )}

          {showBlocked && (
            <div className="msg-modal" role="dialog" aria-modal="true" aria-label="Blocked words and emojis">
              <div className="msg-modal-card">
                <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 600 }}>Blocked words and emojis</h3>
                <p className="msg-hint" style={{ margin: '0 0 16px' }}>
                  Pupils cannot send these in the class chat or to the admin. Teachers and admins are not restricted. A word is only blocked as a whole word: "mad" is blocked, "made" is not.
                </p>
                <div className="msg-row-wrap" style={{ marginBottom: '16px', flexWrap: 'nowrap' }}>
                  <input className="msg-field" type="text" value={newTerm} onChange={(e) => setNewTerm(e.target.value)} placeholder="A word or an emoji"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTerm(); } }} />
                  <button type="button" className="msg-btn primary" onClick={handleAddTerm} disabled={!newTerm.trim()} style={{ flexShrink: 0 }}>Block</button>
                </div>
                <div className="msg-row-wrap">
                  {blockedList.map((t) => (
                    <span key={t.term} className="msg-chip">
                      {t.term}
                      <button type="button" onClick={() => handleRemoveTerm(t.term)} title="Allow it again" aria-label={`Allow ${t.term} again`}><X size={14} {...ICON} /></button>
                    </span>
                  ))}
                </div>
                <button type="button" className="msg-btn" style={{ width: '100%', marginTop: '24px' }} onClick={() => setShowBlocked(false)}>Done</button>
              </div>
            </div>
          )}

          {/* ---------- Private chats ---------- */}
          {activeView === 'chats' && (
            <div className="msg-split">
              <div className={`msg-contacts ${selectedContactId ? 'hide-mobile' : ''}`}>
                {messageContacts.length > 0 && (
                  <div className="msg-search">
                    <Search size={16} {...ICON} />
                    <input type="text" placeholder="Search" aria-label="Search chats" value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} />
                  </div>
                )}
                <div className="msg-contact-list">
                  {messageContacts.length === 0 && (
                    <div className="msg-empty" style={{ padding: '40px 16px' }}>
                      <MessageSquare size={32} {...ICON} />
                      <p>{isAdmin ? 'No contacts yet' : 'The school admin is not available to message yet'}</p>
                    </div>
                  )}
                  {messageContacts.length > 0 && matching.length === 0 && (
                    <p className="msg-empty" style={{ padding: '24px 16px' }}>No chats match "{contactSearch}"</p>
                  )}
                  {withChat.map(renderContact)}
                  {withChat.length > 0 && noChat.length > 0 && <div className="msg-group-label">Everyone else</div>}
                  {noChat.map(renderContact)}
                </div>
              </div>

              <div className={`msg-thread ${selectedContactId ? '' : 'hide-mobile'}`}>
                {!selectedContact && (
                  <div className="msg-empty">
                    <MessageSquare size={32} {...ICON} />
                    <p>Choose a chat to read and reply</p>
                  </div>
                )}
                {selectedContact && (
                  <>
                    <div className="msg-head">
                      <button type="button" className="msg-icon-btn msg-back" onClick={() => setSelectedContactId(null)} aria-label="Back to chats"><ArrowLeft size={20} {...ICON} /></button>
                      <Avatar name={selectedContact.name} url={selectedContact.avatarUrl} />
                      <div className="msg-head-text">
                        <div className="msg-head-title">{selectedContact.name}</div>
                        <div className="msg-head-sub">{roleLabel(selectedContact.role)}</div>
                      </div>
                    </div>

                    <div className="msg-list" ref={dmListRef}>
                      {chatLoading && <p className="msg-empty">Loading conversation</p>}
                      {!chatLoading && conversation.length === 0 && (
                        <div className="msg-empty">
                          <MessageSquare size={32} {...ICON} />
                          <p>No messages yet. Say hello.</p>
                        </div>
                      )}
                      {conversation.map((msg, i) => {
                        const prev = conversation[i - 1];
                        const newDay = !prev || !sameDay(prev.createdAt, msg.createdAt);
                        const first = newDay || prev.senderId !== msg.senderId;
                        const mine = msg.senderId === currentUser?.id;
                        return (
                          <div key={msg.id} style={{ display: 'contents' }}>
                            {newDay && <div className="msg-day">{dayLabel(msg.createdAt)}</div>}
                            <div className={`msg-row ${mine ? 'mine' : ''} ${first && !newDay ? 'first' : ''}`}>
                              <div className="msg-bubble">
                                {msg.content && <p className="msg-text">{msg.content}</p>}
                                {msg.attachmentPath && (
                                  <button type="button" className="msg-attachment" onClick={() => handleOpenAttachment(msg.attachmentPath!)}>
                                    <FileDown size={16} {...ICON} /> {msg.attachmentName ?? 'Attachment'}
                                  </button>
                                )}
                                <div className="msg-meta">
                                  <span>{clock(msg.createdAt)}</span>
                                  {mine && (msg.readAt
                                    ? <CheckCheck size={14} {...ICON} aria-label="Seen" />
                                    : <Check size={14} {...ICON} aria-label="Sent" />)}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <form onSubmit={handleSendChat} className="msg-composer">
                      <input ref={attachInputRef} type="file" style={{ display: 'none' }} onChange={handleAttachmentChange} />
                      <button type="button" className="msg-icon-btn" title="Attach a photo or document" aria-label="Attach a file" disabled={uploadingAttachment} onClick={() => attachInputRef.current?.click()}>
                        <Paperclip size={20} {...ICON} />
                      </button>
                      <input
                        className="msg-input"
                        type="text"
                        placeholder={uploadingAttachment ? 'Uploading' : 'Message'}
                        value={chatDraft}
                        disabled={uploadingAttachment}
                        onChange={(e) => setChatDraft(e.target.value)}
                        enterKeyHint="send"
                      />
                      <button type="submit" className="msg-send" disabled={!chatDraft.trim() || uploadingAttachment} aria-label="Send"><Send size={18} {...ICON} /></button>
                    </form>
                  </>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </PortalLayout>
  );
};

export default Messages;
