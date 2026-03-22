import React, { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useParams, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, auth, db, doc, getDoc, setDoc, serverTimestamp, FirebaseUser, signInWithPopup, googleProvider, signOut, getDocs, updateDoc, deleteDoc, onSnapshot, collection, query, where, addDoc } from './firebase';
import { UserProfile } from './types';
import { LogOut, ShoppingCart, Users, List, Plus, ChevronRight, CheckCircle2, Circle, Trash2, Edit2, ArrowLeft, Home, User as UserIcon, RotateCw } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Context ---
interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setProfile(userDoc.data() as UserProfile);
        } else {
          const newProfile: UserProfile = {
            uid: user.uid,
            displayName: user.displayName || 'Utente',
            email: user.email || '',
            photoURL: user.photoURL,
            createdAt: serverTimestamp() as any,
          };
          await setDoc(doc(db, 'users', user.uid), newProfile);
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Error signing in:', error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// --- Components ---

function Navbar() {
  const { profile, logout } = useAuth();
  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-emerald-600 font-bold text-xl">
          <ShoppingCart className="w-6 h-6" />
          <span>FamigliaSpesa</span>
        </Link>
        {profile && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              {profile.photoURL ? (
                <img src={profile.photoURL} alt="" className="w-8 h-8 rounded-full border border-gray-200" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
              <div className="flex flex-col items-start">
                <span className="font-medium leading-none">{profile.displayName}</span>
                <span className="text-[10px] text-gray-400 leading-none mt-1">{profile.email}</span>
              </div>
            </div>
            <button
              onClick={logout}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
    </div>
  );
}

function LoginPage() {
  const { signIn } = useAuth();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center border border-gray-100">
        <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <ShoppingCart className="w-10 h-10 text-emerald-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">FamigliaSpesa</h1>
        <p className="text-gray-500 mb-8">Gestisci la spesa di casa insieme alla tua famiglia in tempo reale.</p>
        <button
          onClick={signIn}
          className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-3"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="" />
          Accedi con Google
        </button>
        <p className="mt-8 text-xs text-gray-400 uppercase tracking-widest font-medium">
          Semplice • Condiviso • Veloce
        </p>
      </div>
    </div>
  );
}

// --- Dashboard ---
import { Group, GroceryList as GroceryListType, GroceryItem, GroupMember } from './types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function Dashboard() {
  const { profile } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  useEffect(() => {
    if (!profile) return;

    // First find groups where user is a member
    const membersQuery = query(collection(db, 'groups'), where('id', '!=', '')); // Placeholder, we need a better way
    // Actually, we should query group_members collection
    // But my rules structure was /groups/{groupId}/members/{userId}
    // Firestore doesn't support querying across subcollections easily without collectionGroup
    // Let's simplify: store groupIds in user profile or use a top-level group_members collection
    
    // Correction: I'll use a top-level members collection for easier querying
    // Wait, I already defined /groups/{groupId}/members/{userId}
    // I'll use a collectionGroup query if possible, or just query all groups and filter (not efficient)
    // Better: I'll add a top-level 'group_members' collection instead for this prototype.
  }, [profile]);

  // Re-thinking: Let's use a simpler structure for the prototype to avoid complex queries
  // /groups/{groupId}
  // /members/{memberId} (where memberId is groupId_userId)
  
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-gray-900">I tuoi Gruppi</h2>
        <button
          onClick={() => setShowAddGroup(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          Nuovo Gruppo
        </button>
      </div>

      {/* Group List Placeholder */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* We will implement real group fetching here */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Users className="w-6 h-6" />
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-emerald-500 transition-colors" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Famiglia Rossi</h3>
          <p className="text-sm text-gray-500">3 membri • 2 liste</p>
        </div>
      </div>
    </div>
  );
}

// --- Main App ---

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  if (!user) return <LoginPage />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/group/:groupId" element={<GroupPage />} />
        <Route path="/group/:groupId/list/:listId" element={<ListPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
}

// --- Real Pages Implementation ---

function DashboardPage() {
  const { profile, logout } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshGroups = async () => {
    if (!profile) return;
    setIsRefreshing(true);
    setError(null);
    try {
      const q = query(collection(db, 'members'), where('userId', '==', profile.uid));
      const snapshot = await getDocs(q);
      const memberDocs = snapshot.docs.map(doc => doc.data() as GroupMember);
      
      if (memberDocs.length === 0) {
        setGroups([]);
      } else {
        const groupPromises = memberDocs.map(member => getDoc(doc(db, 'groups', member.groupId)));
        const groupSnapshots = await Promise.all(groupPromises);
        const g = groupSnapshots
          .filter(snap => snap.exists())
          .map(snap => ({ id: snap.id, ...snap.data() } as Group));
        setGroups(g);
      }
    } catch (err: any) {
      setError(`Errore ricarica: ${err.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!profile) return;
    
    // Sync logic: search for memberships by email that don't have the current UID
    const syncByEmail = async () => {
      try {
        const email = profile.email.toLowerCase();
        const q = query(collection(db, 'members'), where('email', '==', email));
        const snapshot = await getDocs(q);
        
        const updates = snapshot.docs
          .filter(docSnap => docSnap.data().userId !== profile.uid)
          .map(async (docSnap) => {
            const data = docSnap.data();
            // Always move to correct ID format: groupId_userId
            const newId = `${data.groupId}_${profile.uid}`;
            
            if (docSnap.id !== newId) {
              // We need to delete the old one and create the new one
              // The rules must allow this!
              await deleteDoc(doc(db, 'members', docSnap.id));
              await setDoc(doc(db, 'members', newId), {
                ...data,
                id: newId,
                userId: profile.uid,
                email: email // Ensure email is saved
              });
            } else {
              // Just update UID if ID was already correct but UID was wrong (unlikely)
              await updateDoc(doc(db, 'members', docSnap.id), { userId: profile.uid });
            }
          });
        await Promise.all(updates);
      } catch (err) {
        console.error('Error syncing by email:', err);
      }
    };
    
    syncByEmail();
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    
    setError(null);
    // Query members collection to find groups the user belongs to
    const q = query(collection(db, 'members'), where('userId', '==', profile.uid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const memberDocs = snapshot.docs.map(doc => doc.data() as GroupMember);
        if (memberDocs.length === 0) {
          setGroups([]);
          setLoading(false);
          return;
        }
        const groupPromises = memberDocs.map(member => getDoc(doc(db, 'groups', member.groupId)));
        const groupSnapshots = await Promise.all(groupPromises);
        const g = groupSnapshots
          .filter(snap => snap.exists())
          .map(snap => ({ id: snap.id, ...snap.data() } as Group));
        
        setGroups(g);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Errore nel caricamento dei gruppi');
        setLoading(false);
      }
    }, (err) => {
      setError(`Errore Firestore: ${err.message}`);
      setLoading(false);
    });
    return unsubscribe;
  }, [profile]);

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !profile) return;
    
    try {
      const groupRef = doc(collection(db, 'groups'));
      const groupId = groupRef.id;
      const newGroup: Group = {
        id: groupId,
        name: newName,
        createdBy: profile.uid,
        createdAt: serverTimestamp() as any,
      };
      try {
        await setDoc(groupRef, newGroup);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `groups/${groupId}`);
      }
      
      // Add creator as admin member in the top-level members collection
      const memberId = `${groupId}_${profile.uid}`;
      try {
        await setDoc(doc(db, 'members', memberId), {
          id: memberId,
          groupId,
          userId: profile.uid,
          email: profile.email,
          role: 'admin',
          joinedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `members/${memberId}`);
      }
      
      setNewName('');
      setIsAdding(false);
    } catch (error) {
      console.error('Error adding group:', error);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bentornato!</h1>
          <p className="text-gray-500">I tuoi gruppi di spesa</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshGroups}
            disabled={isRefreshing}
            className={cn(
              "p-3 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-2xl transition-all",
              isRefreshing && "animate-spin text-emerald-600 bg-emerald-50"
            )}
            title="Ricarica dati"
          >
            <RotateCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 font-semibold"
          >
            <Plus className="w-5 h-5" />
            Nuovo Gruppo
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleAddGroup} className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md border border-gray-100">
            <h2 className="text-2xl font-bold mb-6">Crea un nuovo gruppo</h2>
            <input
              autoFocus
              type="text"
              placeholder="Nome del gruppo (es. Famiglia Rossi)"
              className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl mb-6 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="flex-1 py-3 text-gray-500 font-medium hover:bg-gray-50 rounded-xl transition-colors"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100"
              >
                Crea
              </button>
            </div>
          </form>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm flex items-center gap-3">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <p><strong>Attenzione:</strong> {error}</p>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 bg-gray-100 animate-pulse rounded-3xl"></div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
          <Users className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-400">Nessun gruppo trovato</h3>
          <p className="text-gray-400">Crea il tuo primo gruppo per iniziare!</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map(group => (
            <Link
              key={group.id}
              to={`/group/${group.id}`}
              className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group"
            >
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-6 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                <Users className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">{group.name}</h3>
              <p className="text-sm text-gray-500 flex items-center gap-1">
                Creato il {format(group.createdAt?.toDate() || new Date(), 'd MMMM yyyy', { locale: it })}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function GroupPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [lists, setLists] = useState<GroceryListType[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingList, setIsAddingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [memberProfiles, setMemberProfiles] = useState<Record<string, UserProfile>>({});
  const [memberError, setMemberError] = useState<string | null>(null);
  const memberProfilesRef = React.useRef<Record<string, UserProfile>>({});

  useEffect(() => {
    if (!groupId) return;
    
    const fetchGroup = async () => {
      try {
        const gDoc = await getDoc(doc(db, 'groups', groupId));
        if (gDoc.exists()) {
          setGroup({ id: gDoc.id, ...gDoc.data() } as Group);
        } else {
          navigate('/');
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `groups/${groupId}`);
      }
    };
    fetchGroup();

    const qLists = query(collection(db, `groups/${groupId}/lists`), where('groupId', '==', groupId));
    const unsubLists = onSnapshot(qLists, (snapshot) => {
      setLists(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GroceryListType)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `groups/${groupId}/lists`);
    });

    const qMembers = query(collection(db, 'members'), where('groupId', '==', groupId));
    const unsubMembers = onSnapshot(qMembers, async (snapshot) => {
      const membersData = snapshot.docs.map(doc => doc.data() as GroupMember);
      setMembers(membersData);
      
      // Fetch profiles for members we don't have yet
      const currentProfiles = memberProfilesRef.current;
      const uidsToFetch = membersData
        .map(m => m.userId)
        .filter(uid => !currentProfiles[uid]);
      
      if (uidsToFetch.length > 0) {
        const newProfiles: Record<string, UserProfile> = { ...currentProfiles };
        await Promise.all(uidsToFetch.map(async (uid) => {
          try {
            const uDoc = await getDoc(doc(db, 'users', uid));
            if (uDoc.exists()) {
              newProfiles[uid] = uDoc.data() as UserProfile;
            }
          } catch (error) {
            handleFirestoreError(error, OperationType.GET, `users/${uid}`);
          }
        }));
        memberProfilesRef.current = newProfiles;
        setMemberProfiles({ ...newProfiles });
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'members');
    });

    return () => {
      unsubLists();
      unsubMembers();
    };
  }, [groupId, navigate]);

  const handleAddList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim() || !groupId) return;
    
    try {
      const listRef = doc(collection(db, `groups/${groupId}/lists`));
      await setDoc(listRef, {
        id: listRef.id,
        groupId,
        name: newListName,
        createdAt: serverTimestamp(),
      });
      setNewListName('');
      setIsAddingList(false);
    } catch (error) {
      console.error('Error adding list:', error);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberError(null);
    const email = newMemberEmail.trim().toLowerCase();
    if (!email || !groupId) return;
    
    try {
      // 1. Search for user by email
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);
      
      let targetUid = 'pending';
      if (!querySnapshot.empty) {
        const targetUser = querySnapshot.docs[0].data() as UserProfile;
        targetUid = targetUser.uid;
      }
      
      // 2. Check if already a member (by UID or Email)
      const qExisting = query(collection(db, 'members'), 
        where('groupId', '==', groupId), 
        where('email', '==', email)
      );
      const existingSnapshot = await getDocs(qExisting);
      
      if (!existingSnapshot.empty) {
        setMemberError('L\'utente è già un membro (o invitato) di questo gruppo.');
        return;
      }

      // 3. Add member
      const memberId = targetUid === 'pending' ? `${groupId}_invite_${Date.now()}` : `${groupId}_${targetUid}`;
      
      await setDoc(doc(db, 'members', memberId), {
        id: memberId,
        groupId,
        userId: targetUid,
        email: email,
        role: 'member',
        joinedAt: serverTimestamp(),
      });
      
      setNewMemberEmail('');
      if (targetUid === 'pending') {
        alert('Utente non ancora registrato. Verrà aggiunto automaticamente al suo primo accesso con questa email.');
      }
    } catch (error) {
      console.error('Error adding member:', error);
      if (error instanceof Error && error.message.startsWith('{')) {
        setMemberError('Errore di permessi. Assicurati di essere un amministratore del gruppo.');
      } else {
        setMemberError('Errore durante l\'aggiunta del membro.');
      }
    }
  };

  const currentMember = members.find(m => m.userId === profile?.uid);
  const isAdmin = currentMember?.role === 'admin';

  if (!group) return <LoadingScreen />;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link to="/" className="p-2 hover:bg-white rounded-xl transition-colors">
            <ArrowLeft className="w-6 h-6 text-gray-400" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{group.name}</h1>
            <p className="text-gray-500">{members.length} membri • {lists.length} liste</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowMembers(!showMembers)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors font-medium"
          >
            <Users className="w-5 h-5" />
            Membri
          </button>
          <button
            onClick={() => setIsAddingList(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            Nuova Lista
          </button>
        </div>
      </div>

      {showMembers && (
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">Gestione Membri</h2>
            <button onClick={() => setShowMembers(false)} className="text-gray-400 hover:text-gray-600">
              Chiudi
            </button>
          </div>
          
          <div className="space-y-4 mb-8">
            {members.map(member => {
              const mProfile = memberProfiles[member.userId];
              const isPending = member.userId === 'pending';
              return (
                <div key={member.id || member.userId} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    {mProfile?.photoURL ? (
                      <img src={mProfile.photoURL} alt="" className="w-10 h-10 rounded-full border border-gray-200" referrerPolicy="no-referrer" />
                    ) : (
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center",
                        isPending ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
                      )}>
                        <UserIcon className="w-5 h-5" />
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-gray-900">
                        {isPending ? 'Invito in attesa' : (mProfile?.displayName || 'Utente...')}
                        {member.userId === profile?.uid && <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Tu</span>}
                      </p>
                      <p className="text-xs text-gray-500">{isPending ? member.email : (mProfile?.email || member.userId)}</p>
                    </div>
                  </div>
                  <span className={cn(
                    "text-xs font-bold uppercase tracking-wider bg-white px-3 py-1 rounded-lg border border-gray-100",
                    isPending ? "text-amber-500" : "text-gray-400"
                  )}>
                    {isPending ? 'Invitato' : (member.role === 'admin' ? 'Amministratore' : 'Membro')}
                  </span>
                </div>
              );
            })}
          </div>

          {isAdmin && (
            <div className="border-t border-gray-100 pt-6">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Invita nuovo membro</h3>
              <form onSubmit={handleAddMember} className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <input
                    type="email"
                    placeholder="Email dell'utente da invitare"
                    className={cn(
                      "w-full p-4 bg-gray-50 border rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all",
                      memberError ? "border-red-300" : "border-gray-200"
                    )}
                    value={newMemberEmail}
                    onChange={(e) => {
                      setNewMemberEmail(e.target.value);
                      if (memberError) setMemberError(null);
                    }}
                  />
                  {memberError && <p className="mt-2 text-xs text-red-500 font-medium ml-2">{memberError}</p>}
                </div>
                <button 
                  type="submit" 
                  className="px-8 py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 whitespace-nowrap"
                >
                  Invia Invito
                </button>
              </form>
              <p className="mt-4 text-xs text-gray-400">
                L'invito verrà associato automaticamente all'utente non appena effettuerà l'accesso con questa email.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {lists.map(list => (
          <Link
            key={list.id}
            to={`/group/${groupId}/list/${list.id}`}
            className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronRight className="w-6 h-6 text-emerald-500" />
            </div>
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 mb-4">
              <List className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-1">{list.name}</h3>
            <p className="text-sm text-gray-500">
              {format(list.createdAt?.toDate() || new Date(), 'd MMM yyyy', { locale: it })}
            </p>
          </Link>
        ))}
      </div>

      {isAddingList && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleAddList} className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md border border-gray-100">
            <h2 className="text-2xl font-bold mb-6">Crea una nuova lista</h2>
            <input
              autoFocus
              type="text"
              placeholder="Nome della lista (es. Spesa Settimanale)"
              className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl mb-6 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsAddingList(false)}
                className="flex-1 py-3 text-gray-500 font-medium hover:bg-gray-50 rounded-xl transition-colors"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100"
              >
                Crea
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function ListPage() {
  const { groupId, listId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [list, setList] = useState<GroceryListType | null>(null);
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('');
  const [editingItem, setEditingItem] = useState<GroceryItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editQty, setEditQty] = useState('');

  useEffect(() => {
    if (!groupId || !listId) return;
    
    const fetchList = async () => {
      const lDoc = await getDoc(doc(db, `groups/${groupId}/lists`, listId));
      if (lDoc.exists()) {
        setList({ id: lDoc.id, ...lDoc.data() } as GroceryListType);
      } else {
        navigate(`/group/${groupId}`);
      }
    };
    fetchList();

    const q = query(collection(db, `groups/${groupId}/lists/${listId}/items`), where('listId', '==', listId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sortedItems = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as GroceryItem))
        .sort((a, b) => {
          // Sort by status (da comprare first) then by date
          if (a.status !== b.status) return a.status === 'da comprare' ? -1 : 1;
          return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
        });
      setItems(sortedItems);
      setLoading(false);
    });
    return unsubscribe;
  }, [groupId, listId, navigate]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !groupId || !listId || !profile) return;
    
    try {
      const itemRef = doc(collection(db, `groups/${groupId}/lists/${listId}/items`));
      await setDoc(itemRef, {
        id: itemRef.id,
        listId,
        name: newItemName,
        quantity: newItemQty,
        status: 'da comprare',
        createdBy: profile.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: profile.uid,
      });
      setNewItemName('');
      setNewItemQty('');
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  const toggleStatus = async (item: GroceryItem) => {
    if (!groupId || !listId || !profile) return;
    try {
      await updateDoc(doc(db, `groups/${groupId}/lists/${listId}/items`, item.id), {
        status: item.status === 'da comprare' ? 'acquistato' : 'da comprare',
        updatedAt: serverTimestamp(),
        updatedBy: profile.uid,
      });
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!groupId || !listId) return;
    try {
      await deleteDoc(doc(db, `groups/${groupId}/lists/${listId}/items`, itemId));
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !groupId || !listId || !profile || !editName.trim()) return;

    try {
      await updateDoc(doc(db, `groups/${groupId}/lists/${listId}/items`, editingItem.id), {
        name: editName,
        quantity: editQty,
        updatedAt: serverTimestamp(),
        updatedBy: profile.uid,
      });
      setEditingItem(null);
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  const startEditing = (item: GroceryItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditQty(item.quantity || '');
  };

  if (!list) return <LoadingScreen />;

  const pendingItems = items.filter(i => i.status === 'da comprare');
  const completedItems = items.filter(i => i.status === 'acquistato');

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <Link to={`/group/${groupId}`} className="p-2 hover:bg-white rounded-xl transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-400" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{list.name}</h1>
          <p className="text-gray-500">{items.length} articoli in totale</p>
        </div>
      </div>

      {/* Add Item Form */}
      <form onSubmit={handleAddItem} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-8 flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Cosa devi comprare?"
            className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            required
          />
        </div>
        <div className="w-full sm:w-32">
          <input
            type="text"
            placeholder="Quantità"
            className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            value={newItemQty}
            onChange={(e) => setNewItemQty(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="px-8 py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
        >
          Aggiungi
        </button>
      </form>

      {/* Items List */}
      <div className="space-y-8">
        {pendingItems.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">Da Comprare</h2>
            <div className="space-y-3">
              {pendingItems.map(item => (
                <div key={item.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 group">
                  <button
                    onClick={() => toggleStatus(item)}
                    className="text-gray-300 hover:text-emerald-500 transition-colors"
                  >
                    <Circle className="w-7 h-7" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-900 truncate">{item.name}</h4>
                    {item.quantity && <span className="text-sm text-emerald-600 font-medium">{item.quantity}</span>}
                  </div>
                  <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all">
                    <button
                      onClick={() => startEditing(item)}
                      className="p-2 text-gray-300 hover:text-emerald-500 transition-colors"
                      title="Modifica"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                      title="Elimina"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {completedItems.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">Acquistati</h2>
            <div className="space-y-3">
              {completedItems.map(item => (
                <div key={item.id} className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 flex items-center gap-4 group">
                  <button
                    onClick={() => toggleStatus(item)}
                    className="text-emerald-500 transition-colors"
                  >
                    <CheckCircle2 className="w-7 h-7" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-400 line-through truncate">{item.name}</h4>
                    {item.quantity && <span className="text-xs text-gray-300 line-through">{item.quantity}</span>}
                  </div>
                  <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all">
                    <button
                      onClick={() => startEditing(item)}
                      className="p-2 text-gray-300 hover:text-emerald-500 transition-colors"
                      title="Modifica"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                      title="Elimina"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {items.length === 0 && !loading && (
          <div className="text-center py-20">
            <ShoppingCart className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 font-medium">La lista è vuota.</p>
          </div>
        )}
      </div>

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleUpdateItem} className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md border border-gray-100">
            <h2 className="text-2xl font-bold mb-6">Modifica articolo</h2>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  autoFocus
                  type="text"
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantità</label>
                <input
                  type="text"
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  value={editQty}
                  onChange={(e) => setEditQty(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="flex-1 py-3 text-gray-500 font-medium hover:bg-gray-50 rounded-xl transition-colors"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100"
              >
                Salva
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
