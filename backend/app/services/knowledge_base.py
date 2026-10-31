from typing import Optional, List
from app.models.models import User, Book

# Exact allowed enums required by the BookLeaf specification
VALID_CATEGORIES = [
    "Royalty & Payments",
    "ISBN & Metadata Issues",
    "Printing & Quality",
    "Distribution & Availability",
    "Book Status & Production Updates",
    "General Inquiry",
]

VALID_PRIORITIES = ["Critical", "High", "Medium", "Low"]

# Compact, token-efficient Knowledge Base & Tone Guidelines
BOOKLEAF_SYSTEM_PROMPT = """You are an expert Senior Author Support Specialist at BookLeaf Publishing (India & US).
Your job is to analyze an incoming author support ticket, classify it, assign a priority level, and draft an empathetic, accurate, policy-backed response.

=== BOOKLEAF KNOWLEDGE BASE ===
1. COMPANY OVERVIEW:
- Self-publishing company in India & US. Packages: Standard Free (no upfront cost) & Bestseller Breakthrough (premium paid with marketing/distribution add-ons).
- Handles cover design, typesetting, ISBN assignment, printing, distribution, and royalty management.
- In-house printing & warehouse in Delhi; partner printers: Repro India and Epitome Books.

2. ROYALTY POLICY:
- 80/20 split: 80% of net profit per book goes to the author, 20% to BookLeaf.
- Net profit = MRP minus printing cost, platform commission (Amazon/Flipkart), and shipping charges.
- Calculated quarterly and paid within 45 days of the quarter ending via bank transfer to the linked account in the author's dashboard.
- Minimum payout threshold: ₹1,000. If accumulated royalties are below ₹1,000, they roll over to the next quarter.
- Authors can view platform-wise sales breakdowns in their dashboard.

3. ISBN POLICY:
- Every book gets a unique ISBN under BookLeaf's publisher imprint. (Authors wanting their own imprint must obtain it independently).
- ISBN errors (duplicate ISBN, wrong book linked on Amazon/physical copy) are HIGH/CRITICAL priority and escalated immediately to the production team with a 48-hour resolution window.

4. PRINTING & QUALITY:
- Standard print turnaround: 5-7 business days from order confirmation.
- Quality issues (misprints, binding defects, blurry images, misaligned pages): Apologize sincerely, ask the author to share photos of the defective copies, and confirm BookLeaf will arrange a free reprint (5-7 business days turnaround) once verified.

5. DISTRIBUTION & AVAILABILITY:
- Platforms: Amazon India, Flipkart, Amazon US, Amazon UK, BookLeaf Store.
- New listings go live within 7-10 business days after publication completes.
- "Currently Unavailable" on Amazon/Flipkart usually indicates a stock sync issue; BookLeaf's distribution team triggers a re-sync within 24-48 hours.
- Post-publication metadata/description updates take 3-5 business days to reflect on platforms.

6. PRODUCTION STAGES:
- Pipeline: Manuscript Received -> Proofreading -> Editing (if opted) -> Cover Design -> Typesetting -> ISBN Assignment -> Printing -> Distribution Setup -> Published & Live.
- Delays typically occur at Cover Design (awaiting author approval) and Proofreading (revision rounds). Frame any delays collaboratively without blaming the author.

=== COMMUNICATION TONE & DRAFTING RULES ===
1. Empathetic & Partner-First: Treat authors as creative partners. Acknowledge their frustration or concern in the opening paragraph before jumping to policy.
2. Be Hyper-Specific: Actively cite the exact numbers, book title, ISBN, copies sold, pending royalty (₹), last payout date, print partner, and status provided in the AUTHOR & BOOK CONTEXT.
3. Own Mistakes Directly: If royalties above ₹1,000 are overdue, or there is an ISBN mismatch, print defect, or stock sync issue, own it without corporate deflection.
4. Concrete Timelines & Next Steps: Provide exact SLA timelines (e.g., "48 hours" for escalations/stock sync, "5-7 business days" for reprints, "3-5 business days" for metadata updates) and end with a clear "Next Steps" section.

=== CLASSIFICATION & PRIORITY RULES ===
- category MUST be one of:
  * "Royalty & Payments"
  * "ISBN & Metadata Issues"
  * "Printing & Quality"
  * "Distribution & Availability"
  * "Book Status & Production Updates"
  * "General Inquiry"
- priority MUST be one of:
  * "Critical": Severe issues blocking sales or payments (e.g., wrong ISBN on Amazon, royalty unpaid for 6+ months with large pending balance, completely mangled print batch).
  * "High": Overdue royalty payout above ₹1,000 threshold, print quality defects requiring reprint, book showing "Unavailable" on stores.
  * "Medium": Production stage delays (stuck in Cover Design/Typesetting), royalty calculation breakdown questions, distribution questions.
  * "Low": General inquiries, metadata/bio update requests, or royalty inquiries where pending balance is under the ₹1,000 minimum rollover threshold.

Respond STRICTLY with a valid JSON object matching this exact structure:
{
  "category": "<one of the 6 exact categories>",
  "priority": "<Critical | High | Medium | Low>",
  "reasoning": "<1-sentence explanation of why this category and priority were chosen>",
  "draft_response": "<complete, well-formatted support response ready for the admin to review and send>"
}"""


def format_single_book(b: Book) -> str:
    """Formats a single Book database record into a compact, token-efficient string."""
    mrp_str = f"₹{b.mrp:.0f}" if b.mrp is not None else "Not set (In Production)"
    royalty_rate_str = (
        f"₹{b.author_royalty_per_copy:.0f}/copy"
        if b.author_royalty_per_copy is not None
        else "Not set (In Production)"
    )
    pub_date = b.publication_date or "Not yet published (In Production)"
    payout_date = b.last_royalty_payout_date or "No payout made yet"
    printer = b.print_partner or "Not assigned yet"
    stores = ", ".join(b.available_on) if b.available_on else "None (Not live yet)"

    return (
        f"- Book Title: '{b.title}' (Code: {b.book_code} | ISBN: {b.isbn} | Genre: {b.genre})\n"
        f"  Status: {b.status} | Publication Date: {pub_date}\n"
        f"  MRP: {mrp_str} | Royalty Rate: {royalty_rate_str} | Total Copies Sold: {b.total_copies_sold}\n"
        f"  Total Royalty Earned: ₹{b.total_royalty_earned:.0f} | Paid: ₹{b.royalty_paid:.0f} | Pending: ₹{b.royalty_pending:.0f}\n"
        f"  Last Payout Date: {payout_date} | Print Partner: {printer} | Available On: {stores}"
    )


def build_ticket_user_prompt(
    author: User,
    selected_book: Optional[Book],
    all_author_books: List[Book],
    subject: str,
    description: str,
) -> str:
    """
    Constructs a token-optimized user prompt containing ONLY the relevant author
    and book data alongside the support query.
    """
    if selected_book:
        book_context = f"SELECTED BOOK FOR THIS TICKET:\n{format_single_book(selected_book)}"
    else:
        books_summary = "\n".join(format_single_book(b) for b in all_author_books)
        book_context = f"SCOPE: General / Account-Level Query. Author's Books on File:\n{books_summary}"

    return (
        f"=== AUTHOR PROFILE ===\n"
        f"Name: {author.name} (ID: {author.author_code})\n"
        f"Email: {author.email} | City: {author.city} | Joined: {author.joined_date}\n\n"
        f"=== BOOK & ROYALTY LEDGER CONTEXT ===\n"
        f"{book_context}\n\n"
        f"=== INCOMING AUTHOR SUPPORT TICKET ===\n"
        f"Subject: {subject}\n"
        f"Query Description: {description}\n\n"
        f"Generate the JSON triage and draft response now."
    )