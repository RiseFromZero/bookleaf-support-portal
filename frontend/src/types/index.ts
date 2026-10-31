export type UserRole = "author" | "admin";

export type TicketStatus = "Open" | "In Progress" | "Resolved" | "Closed";

export type TicketCategory =
  | "Royalty & Payments"
  | "ISBN & Metadata Issues"
  | "Printing & Quality"
  | "Distribution & Availability"
  | "Book Status & Production Updates"
  | "General Inquiry";

export type TicketPriority = "Critical" | "High" | "Medium" | "Low";

export interface User {
  id: number;
  author_code: string | null;
  name: string;
  email: string;
  role: UserRole;
  phone: string | null;
  city: string | null;
  joined_date: string | null;
}

export interface Book {
  id: number;
  book_code: string;
  author_id: number;
  title: string;
  isbn: string;
  genre: string;
  publication_date: string | null;
  status: string;
  mrp: number | null;
  author_royalty_per_copy: number | null;
  total_copies_sold: number;
  total_royalty_earned: number;
  royalty_paid: number;
  royalty_pending: number;
  last_royalty_payout_date: string | null;
  print_partner: string | null;
  available_on: string[];
}

export interface TicketMessage {
  id: number;
  ticket_id: number;
  sender_id: number;
  content: string;
  is_internal: boolean;
  created_at: string;
  sender: User;
}

export interface Ticket {
  id: number;
  author_id: number;
  book_id: number | null;
  subject: string;
  description: string;
  attachment_name: string | null;
  status: TicketStatus;
  category: TicketCategory;
  priority: TicketPriority;
  ai_draft_response: string | null;
  ai_reasoning: string | null;
  ai_classified: boolean;
  is_category_overridden: boolean;
  is_priority_overridden: boolean;
  assigned_admin_id: number | null;
  created_at: string;
  updated_at: string;
  author: User;
  book: Book | null;
  assigned_admin: User | null;
  messages: TicketMessage[];
}