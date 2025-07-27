export interface LineItem {
  description: string;
  price: number;
  category?: string; // Optional for backward compatibility
}

export interface SharedDetails {
  members: string[];
  paidBy: string;
}

export interface SharedSpace {
    id: string;
    name: string;
    members: string[];
}

export interface Expense {
  id: string;
  vendorName: string;
  transactionDate: string;
  totalAmount: number;
  category: string;
  lineItems: LineItem[];
  type: 'personal' | 'shared';
  sharedSpaceId?: string; // Link to a shared space
  sharedDetails?: SharedDetails;
  members?: string[]; // Optional: populated by AI from text
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export type View = 'dashboard' | 'upload' | 'chat' | 'insights';