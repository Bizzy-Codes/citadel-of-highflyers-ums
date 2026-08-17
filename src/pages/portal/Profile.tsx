import { useRef, useState } from 'react';
import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth } from '../../context/AuthContext';
import { User as UserIcon, Mail, Phone, MapPin, Calendar, Save, Edit3, X, Camera, Trash2, Loader2 } from 'lucide-react';

const Profile = () => {
  const { currentUser, updateUser, uploadAvatar, removeAvatar } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: currentUser?.name || '',
    email: currentUser?.email || '',
    phone: currentUser?.phone || '',
    grade: currentUser?.grade || '',
  });

  if (!currentUser) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const { email: _email, ...editable } = formData;
    void _email; // email isn't editable here -- see the disabled field below
    await updateUser(currentUser.id, editable);
    setIsEditing(false);
    alert("Profile updated successfully!");
  };

  const handleAvatarPick = () => fileInputRef.current?.click();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image is too large -- please choose one under 5MB.');
      return;
    }
    setIsSavingAvatar(true);
    const { error } = await uploadAvatar(file);
    setIsSavingAvatar(false);
    if (error) alert('Failed to upload photo: ' + error);
  };

  const handleAvatarRemove = async () => {
    if (!window.confirm('Remove your profile photo?')) return;
    setIsSavingAvatar(true);
    const { error } = await removeAvatar();
    setIsSavingAvatar(false);
    if (error) alert('Failed to remove photo: ' + error);
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <PortalLayout title="My Profile">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        <div className="card glass" style={{ padding: '40px', borderRadius: '32px' }}>
          <div style={{ display: 'flex', gap: '40px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '150px', height: '150px', flexShrink: 0 }}>
              <div style={{
                width: '150px', height: '150px', borderRadius: '50%',
                background: currentUser.avatarUrl ? undefined : 'linear-gradient(135deg, var(--primary), var(--secondary))',
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '48px', fontWeight: '800', border: '4px solid white', boxShadow: 'var(--shadow-lg)',
                overflow: 'hidden',
              }}>
                {currentUser.avatarUrl
                  ? <img src={currentUser.avatarUrl} alt={currentUser.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : getInitials(currentUser.name)}
                {isSavingAvatar && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Loader2 size={28} className="animate-spin" />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handleAvatarPick}
                title="Upload photo"
                disabled={isSavingAvatar}
                style={{ position: 'absolute', bottom: '4px', right: '4px', width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)', color: 'white', border: '3px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <Camera size={18} />
              </button>
              {currentUser.avatarUrl && (
                <button
                  type="button"
                  onClick={handleAvatarRemove}
                  title="Remove photo"
                  disabled={isSavingAvatar}
                  style={{ position: 'absolute', bottom: '4px', left: '4px', width: '36px', height: '36px', borderRadius: '50%', background: 'var(--error)', color: 'white', border: '3px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <Trash2 size={16} />
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h1 style={{ fontSize: '36px', fontWeight: '900', marginBottom: '8px' }}>{currentUser.name}</h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <UserIcon size={18} /> {currentUser.role.toUpperCase()} ID: {currentUser.displayId} {currentUser.role === 'student' && `| ${currentUser.grade}`}
                  </p>
                </div>
                <button onClick={() => setIsEditing(!isEditing)} className={`btn ${isEditing ? 'btn-outline' : 'btn-primary'}`}>
                  {isEditing ? <><X size={18} /> Cancel</> : <><Edit3 size={18} /> Edit Profile</>}
                </button>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <span style={{ padding: '6px 16px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: '50px', fontSize: '13px', fontWeight: '700' }}>Active Member</span>
                <span style={{ padding: '6px 16px', background: 'rgba(107, 33, 168, 0.1)', color: 'var(--primary)', borderRadius: '50px', fontSize: '13px', fontWeight: '700' }}>{currentUser.role === 'admin' ? 'System Administrator' : 'Academic Profile'}</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '50px', borderTop: '1px solid var(--glass-border)', paddingTop: '40px' }}>
            {!isEditing ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '40px' }}>
                <div className="info-section">
                  <h4 style={{ color: 'var(--primary)', fontSize: '18px', fontWeight: '700', marginBottom: '20px', borderBottom: '2px solid var(--accent)', paddingBottom: '10px' }}>Contact Details</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                       <Mail size={18} style={{ color: 'var(--text-muted)' }} />
                       <span>{currentUser.email || 'No email provided'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                       <Phone size={18} style={{ color: 'var(--text-muted)' }} />
                       <span>{currentUser.phone || 'No phone number provided'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                       <MapPin size={18} style={{ color: 'var(--text-muted)' }} />
                       <span>45 Citadel Heights, Plateau State, Nigeria</span>
                    </div>
                  </div>
                </div>
                <div className="info-section">
                  <h4 style={{ color: 'var(--primary)', fontSize: '18px', fontWeight: '700', marginBottom: '20px', borderBottom: '2px solid var(--accent)', paddingBottom: '10px' }}>Academic Records</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                       <Calendar size={18} style={{ color: 'var(--text-muted)' }} />
                       <span>Member Since: {new Date(currentUser.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p><strong>Department:</strong> {currentUser.role === 'student' ? 'Junior Academic' : 'Administrative'}</p>
                    <p><strong>Status:</strong> {currentUser.status}</p>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                <div className="input-group">
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>Full Name</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }} />
                </div>
                <div className="input-group">
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>Email Address (login)</label>
                  <input type="email" value={formData.email} disabled style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.05)', color: 'var(--text-muted)' }} />
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>This is your login email and can't be changed here. Contact an admin if it needs to change.</p>
                </div>
                <div className="input-group">
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>Phone Number</label>
                  <input type="text" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }} />
                </div>
                {currentUser.role === 'student' && (
                  <div className="input-group">
                    <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>Grade / Class</label>
                    <input type="text" value={formData.grade} disabled style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.05)', color: 'var(--text-muted)' }} />
                  </div>
                )}
                <div style={{ gridColumn: '1 / -1', marginTop: '20px' }}>
                  <button type="submit" className="btn btn-primary lg" style={{ width: '100%' }}>
                    <Save size={18} /> Save Profile Changes
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </PortalLayout>
  );
};

export default Profile;
