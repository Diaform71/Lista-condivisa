import { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  createdAt: Timestamp;
}

export interface Group {
  id: string;
  name: string;
  createdBy: string;
  createdAt: Timestamp;
}

export interface GroupMember {
  groupId: string;
  userId: string;
  role: 'admin' | 'member';
  joinedAt: Timestamp;
}

export interface GroceryList {
  id: string;
  groupId: string;
  name: string;
  createdAt: Timestamp;
}

export interface GroceryItem {
  id: string;
  listId: string;
  name: string;
  quantity?: string;
  notes?: string;
  status: 'da comprare' | 'acquistato';
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  updatedBy: string;
}
