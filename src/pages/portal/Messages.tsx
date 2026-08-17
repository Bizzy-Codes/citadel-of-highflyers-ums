import { useEffect, useRef, useState } from 'react';
import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth, type DirectMessage } from '../../context/AuthContext';
import { Send, MessageCircle, Bell, User, ArrowLeft } from 'lucide-react';

const Messages = () => {
  const { currentUser, notifications, addNotification, messageContacts, getConversation, sendDirectMessage, markConversationRead, subscribeToDirectMessages } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const [activeView, setActiveView] = useState<'chats' | 'notifications' | 'whatsapp'>(isAdmin ? 'whatsapp' : 'notifications');

  // Private Chats state
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<DirectMessage[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);

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
      setConversation((prev) => [...prev, msg]);
      if (msg.senderId === selectedContactId) markConversationRead(selectedContactId);
    });
    return () => { cancelled = true; unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedContactId]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContactId || !chatDraft.trim()) return;
    const draft = chatDraft;
    setChatDraft('');
    const { error } = await sendDirectMessage(selectedContactId, draft);
    if (error) { alert('Failed to send message: ' + error); setChatDraft(draft); }
  };

  const selectedContact = messageContacts.find(c => c.id === selectedContactId) ?? null;

  // WhatsApp State
  const [waMessage, setWaMessage] = useState('');
  
  // Notification State
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMsg, setNotifMsg] = useState('');
  const [notifType, setNotifType] = useState<'info' | 'warning' | 'success'>('info');

  const handleSendWhatsApp = () => {
    if (!waMessage) return;
    // Replace with actual group link if available, or just open WhatsApp with message
    const url = `https://wa.me/?text=${encodeURIComponent(waMessage)}`;
    window.open(url, '_blank');
    setWaMessage('');
  };

  const handlePostNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (notifTitle && notifMsg) {
      await addNotification({ title: notifTitle, message: notifMsg, type: notifType });
      setNotifTitle('');
      setNotifMsg('');
      alert("Notification posted to all users!");
    }
  };

  return (
    <PortalLayout title="Communication Center">
      <div className="animate-fade-in comm-center-grid" style={{ gap: '24px' }}>

        {/* Sidebar Navigation */}
        <div className="card glass comm-center-sidebar" style={{ padding: '20px', borderRadius: '24px', gap: '12px' }}>
           <button
            onClick={() => setActiveView('notifications')}
            className={`btn ${activeView === 'notifications' ? 'btn-primary' : 'btn-outline'}`}
            style={{ justifyContent: 'flex-start' }}
           >
             <Bell size={18} /> System Notices
           </button>

           {isAdmin && (
             <button
              onClick={() => setActiveView('whatsapp')}
              className={`btn ${activeView === 'whatsapp' ? 'btn-primary' : 'btn-outline'}`}
              style={{ justifyContent: 'flex-start' }}
             >
               <MessageCircle size={18} /> WhatsApp Group
             </button>
           )}

           <button
            onClick={() => setActiveView('chats')}
            className={`btn ${activeView === 'chats' ? 'btn-primary' : 'btn-outline'}`}
            style={{ justifyContent: 'flex-start' }}
           >
             <User size={18} /> Private Chats
           </button>
        </div>

        {/* Main Content Area */}
        <div className="card glass comm-center-main" style={{ padding: '30px', borderRadius: '24px', overflowY: 'auto' }}>
           
           {activeView === 'notifications' && (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <h3>System Notifications</h3>
                   {isAdmin && <span className="badge" style={{ background: 'var(--primary)', color: 'white' }}>Admin View</span>}
                </div>

                {isAdmin && (
                  <form onSubmit={handlePostNotification} className="blend-bg" style={{ padding: '24px', borderRadius: '20px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                     <h4 style={{ fontSize: '15px' }}>Post New Announcement</h4>
                     <input
                      type="text"
                      placeholder="Title"
                      value={notifTitle}
                      onChange={(e) => setNotifTitle(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }}
                     />
                     <textarea
                      placeholder="Message content..."
                      rows={3}
                      value={notifMsg}
                      onChange={(e) => setNotifMsg(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)', resize: 'none' }}
                     />
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        <select
                          value={notifType}
                          onChange={(e) => setNotifType(e.target.value as any)}
                          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }}
                        >
                           <option value="info">Information (Blue)</option>
                           <option value="warning">Important (Orange)</option>
                           <option value="success">Success (Green)</option>
                        </select>
                        <button type="submit" className="btn btn-primary">
                           <Send size={18} /> Post to All Portals
                        </button>
                     </div>
                  </form>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                   {notifications.map((n, i) => (
                     <div key={i} className="hover-scale" style={{ padding: '20px', borderRadius: '16px', borderLeft: `6px solid ${n.type === 'warning' ? 'var(--warning)' : n.type === 'success' ? 'var(--success)' : 'var(--primary)'}`, background: 'var(--bg-surface)', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                           <h4 style={{ fontWeight: '800' }}>{n.title}</h4>
                           <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(n.date).toLocaleDateString()}</span>
                        </div>
                        <p style={{ fontSize: '14px', color: 'var(--text-main)', lineHeight: '1.6' }}>{n.message}</p>
                     </div>
                   ))}
                   {notifications.length === 0 && (
                     <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        <Bell size={40} style={{ opacity: 0.2, marginBottom: '16px' }} />
                        <p>No system notifications yet.</p>
                     </div>
                   )}
                </div>
             </div>
           )}

           {activeView === 'whatsapp' && isAdmin && (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center', justifyContent: 'center', height: '100%', maxWidth: '600px', margin: '0 auto' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#25D366', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                   <MessageCircle size={40} />
                </div>
                <h2 style={{ textAlign: 'center' }}>WhatsApp Broadcast Control</h2>
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '20px' }}>Compose a message below to send directly to the school's WhatsApp group as an Administrator.</p>
                
                <textarea 
                  value={waMessage}
                  onChange={(e) => setWaMessage(e.target.value)}
                  placeholder="Type your group announcement here..."
                  style={{ width: '100%', padding: '24px', borderRadius: '20px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)', minHeight: '200px', fontSize: '16px', resize: 'none' }}
                />
                
                <button 
                  onClick={handleSendWhatsApp}
                  className="btn btn-primary lg" 
                  style={{ width: '100%', background: '#25D366 !important', borderColor: '#25D366 !important', boxShadow: '0 8px 20px rgba(37, 211, 102, 0.3)' }}
                >
                   <MessageCircle size={20} /> Open WhatsApp & Send to Group
                </button>
             </div>
           )}

           {activeView === 'chats' && (
             <div className="chats-panel">
                {/* Contact list */}
                <div className={`chats-contact-list ${selectedContactId ? 'chats-contact-list-hidden-mobile' : ''}`}>
                   {messageContacts.length === 0 && (
                     <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                        <User size={36} style={{ opacity: 0.2, marginBottom: '12px' }} />
                        <p style={{ fontSize: '13px' }}>No contacts available yet.</p>
                     </div>
                   )}
                   {messageContacts.map((contact) => (
                     <button
                      key={contact.id}
                      onClick={() => setSelectedContactId(contact.id)}
                      className="chats-contact-item"
                      style={{
                        background: selectedContactId === contact.id ? 'var(--accent)' : 'transparent',
                        color: selectedContactId === contact.id ? 'var(--primary)' : 'var(--text-main)',
                      }}
                     >
                        <div className="chats-contact-avatar">
                           {contact.avatarUrl
                             ? <img src={contact.avatarUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                             : contact.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ textAlign: 'left', overflow: 'hidden' }}>
                           <div style={{ fontWeight: '700', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{contact.name}</div>
                           <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{contact.role.replace('_', ' ')}</div>
                        </div>
                     </button>
                   ))}
                </div>

                {/* Thread */}
                <div className={`chats-thread ${selectedContactId ? '' : 'chats-thread-hidden-mobile'}`}>
                   {!selectedContact && (
                     <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                        <MessageCircle size={40} style={{ opacity: 0.2, marginBottom: '16px' }} />
                        <p>Select a contact to start chatting.</p>
                     </div>
                   )}
                   {selectedContact && (
                     <>
                       <div className="chats-thread-header">
                          <button className="chats-back-btn" onClick={() => setSelectedContactId(null)}><ArrowLeft size={18} /></button>
                          <div className="chats-contact-avatar">
                             {selectedContact.avatarUrl
                               ? <img src={selectedContact.avatarUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                               : selectedContact.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                             <div style={{ fontWeight: '700', fontSize: '15px' }}>{selectedContact.name}</div>
                             <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{selectedContact.role.replace('_', ' ')}</div>
                          </div>
                       </div>

                       <div className="chats-thread-messages">
                          {chatLoading && <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Loading conversation...</p>}
                          {!chatLoading && conversation.length === 0 && (
                            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No messages yet. Say hello!</p>
                          )}
                          {conversation.map((msg) => {
                            const mine = msg.senderId === currentUser?.id;
                            return (
                              <div key={msg.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                                 <div className="chats-bubble" style={{
                                   background: mine ? 'var(--primary)' : 'var(--bg-surface)',
                                   color: mine ? '#fff' : 'var(--text-main)',
                                   border: mine ? 'none' : '1px solid var(--glass-border)',
                                 }}>
                                    <p style={{ fontSize: '14px', wordBreak: 'break-word' }}>{msg.content}</p>
                                    <span style={{ fontSize: '10px', opacity: 0.7, display: 'block', marginTop: '4px' }}>
                                       {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                 </div>
                              </div>
                            );
                          })}
                          <div ref={threadEndRef} />
                       </div>

                       <form onSubmit={handleSendChat} className="chats-thread-input">
                          <input
                            type="text"
                            placeholder="Type a message..."
                            value={chatDraft}
                            onChange={(e) => setChatDraft(e.target.value)}
                            style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }}
                          />
                          <button type="submit" className="btn btn-primary" disabled={!chatDraft.trim()}><Send size={18} /></button>
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
