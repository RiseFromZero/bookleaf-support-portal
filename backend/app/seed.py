import json
import os
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.models.models import User, Book, Ticket
from app.middleware.auth_deps import hash_password


def find_sample_json() -> str:
    """Locates bookleaf_sample_data.json across common project paths."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(base_dir, "../../bookleaf_sample_data.json"),  # Root folder
        os.path.join(base_dir, "../bookleaf_sample_data.json"),     # Backend folder
        "bookleaf_sample_data.json",
        "../bookleaf_sample_data.json",
    ]
    for path in candidates:
        if os.path.exists(path):
            return os.path.abspath(path)
    raise FileNotFoundError(
        "Could not find 'bookleaf_sample_data.json'. Please place it in 'bookleaf-support-portal/' or 'backend/'."
    )


def seed_database():
    """Idempotently seeds Admins, 10 Authors, 18 Books, and 3 Initial Tickets."""
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        # 1. Idempotency Check: Skip if users already exist
        existing_user = db.query(User).first()
        if existing_user:
            print("Database already seeded. Skipping seed execution.")
            return

        json_path = find_sample_json()
        print(f"Loading sample dataset from: {json_path}")
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        # 2. Seed Admin Accounts (Password: admin123)
        admin_pw = hash_password("admin123")
        admin1 = User(
            name="BookLeaf Support Admin",
            email="admin@bookleafpub.com",
            password_hash=admin_pw,
            role="admin",
            city="New Delhi",
            joined_date="2022-01-10",
        )
        admin2 = User(
            name="Operations Lead",
            email="ops@bookleafpub.com",
            password_hash=admin_pw,
            role="admin",
            city="New Delhi",
            joined_date="2022-05-15",
        )
        db.add_all([admin1, admin2])
        db.flush()

        # 3. Seed 10 Authors & 18 Books from JSON (Password: password123)
        author_pw = hash_password("password123")
        author_map = {}
        book_map = {}

        for author_item in data.get("authors", []):
            author = User(
                author_code=author_item["author_id"],
                name=author_item["name"],
                email=author_item["email"],
                password_hash=author_pw,
                role="author",
                phone=author_item.get("phone"),
                city=author_item.get("city"),
                joined_date=author_item.get("joined_date"),
            )
            db.add(author)
            db.flush()
            author_map[author.author_code] = author

            for book_item in author_item.get("books", []):
                book = Book(
                    book_code=book_item["book_id"],
                    author_id=author.id,
                    title=book_item["title"],
                    isbn=book_item["isbn"],
                    genre=book_item["genre"],
                    publication_date=book_item.get("publication_date"),
                    status=book_item["status"],
                    mrp=book_item.get("mrp"),
                    author_royalty_per_copy=book_item.get("author_royalty_per_copy"),
                    total_copies_sold=book_item.get("total_copies_sold", 0),
                    total_royalty_earned=book_item.get("total_royalty_earned", 0.0),
                    royalty_paid=book_item.get("royalty_paid", 0.0),
                    royalty_pending=book_item.get("royalty_pending", 0.0),
                    last_royalty_payout_date=book_item.get("last_royalty_payout_date"),
                    print_partner=book_item.get("print_partner"),
                    available_on=book_item.get("available_on", []),
                )
                db.add(book)
                db.flush()
                book_map[book.book_code] = book

        # 4. Seed 3 Representative Support Tickets with AI Triage & Drafts
        initial_tickets = [
            Ticket(
                author_id=author_map["AUTH003"].id,
                book_id=book_map["BK005"].id,
                subject="Pending royalty of ₹2,546 not yet credited",
                description="Hi team, my book 'Between Two Temples' was published in July 2024 and has sold 67 copies with ₹2,546 earned, but I haven't received any payout yet. Could you check when this will be transferred?",
                status="Open",
                category="Royalty & Payments",
                priority="High",
                ai_classified=True,
                ai_reasoning="Author has ₹2,546 pending royalty (exceeds ₹1,000 threshold) with no prior payout recorded.",
                ai_draft_response=(
                    "Dear Ananya,\n\nThank you for reaching out, and I completely understand your concern regarding the pending royalty payout for 'Between Two Temples' (ISBN: 978-93-5XXXX-05-9).\n\n"
                    "Looking at your royalty ledger, your book has sold 67 copies and earned ₹2,546 in total royalties (at ₹38 per copy). Since ₹2,546 is well above our ₹1,000 minimum payout threshold, your balance is eligible for disbursement.\n\n"
                    "At BookLeaf, royalties are calculated quarterly and paid within 45 days of the quarter ending via bank transfer. Because no prior payout date is recorded on your account yet, this usually indicates either pending bank details verification or a hold in transfer processing.\n\n"
                    "Next Steps:\n1. Please verify that your bank account details are linked in your Author Dashboard.\n2. I have escalated your ₹2,546 payout check to our finance team, and we will get back to you with a confirmed transfer status within 48 hours.\n\nWarm regards,\nBookLeaf Author Support Team"
                ),
            ),
            Ticket(
                author_id=author_map["AUTH009"].id,
                book_id=book_map["BK016"].id,
                subject="Question about my ₹850 royalty for The Nagpur Notebooks",
                description="Hello, I see 34 copies sold and ₹850 pending royalty on my dashboard for 'The Nagpur Notebooks', but royalty paid shows ₹0. Why wasn't it transferred in the December payout?",
                status="Open",
                category="Royalty & Payments",
                priority="Low",
                ai_classified=True,
                ai_reasoning="Pending royalty is ₹850, which is under the ₹1,000 minimum payout threshold and rolls over to next quarter.",
                ai_draft_response=(
                    "Dear Kavita,\n\nThank you for reaching out about 'The Nagpur Notebooks' (ISBN: 978-93-5XXXX-16-5).\n\n"
                    "I checked your account and can confirm your book has sold 34 copies, earning ₹850 in accumulated royalties (at ₹25 royalty per copy). According to BookLeaf's Royalty Policy, our minimum payout threshold is ₹1,000. Whenever accumulated royalties are below ₹1,000 at the end of a quarter, the balance safely rolls over to the next quarterly cycle.\n\n"
                    "Next Steps:\nYour ₹850 balance remains credited in your pending ledger. Once your total pending royalties cross ₹1,000 (just 6 more copies sold!), the full amount will automatically be disbursed via bank transfer within 45 days of that quarter ending.\n\nWarm regards,\nBookLeaf Author Support Team"
                ),
            ),
            Ticket(
                author_id=author_map["AUTH007"].id,
                book_id=book_map["BK013"].id,
                subject="Timeline for Midnight in Mysore cover design",
                description="Hi BookLeaf team, my third book 'Midnight in Mysore' is currently showing as 'In Production - Cover Design'. When will it move to typesetting?",
                status="In Progress",
                category="Book Status & Production Updates",
                priority="Medium",
                ai_classified=True,
                assigned_admin_id=admin1.id,
                ai_reasoning="Book BK013 is currently in 'In Production - Cover Design' stage with null publication metadata.",
                ai_draft_response=(
                    "Dear Sneha,\n\nThank you for checking in on 'Midnight in Mysore' (ISBN: 978-93-5XXXX-13-4)!\n\n"
                    "Your book is currently in the 'In Production - Cover Design' stage. In our production workflow (Manuscript Received → Proofreading/Editing → Cover Design → Typesetting → ISBN Assignment → Printing → Distribution Setup → Published & Live), moving from Cover Design into Typesetting happens right after the cover proof is finalized.\n\n"
                    "Next Steps:\nI am checking with our design team today on the latest cover proof for 'Midnight in Mysore' and will share an updated schedule for Typesetting within 48 hours.\n\nWarm regards,\nBookLeaf Author Support Team"
                ),
            ),
        ]
        db.add_all(initial_tickets)
        db.commit()
        print("Step 4 Seed Complete: 2 Admins, 10 Authors, 18 Books, and 3 Tickets created!")

    finally:
        db.close()


if __name__ == "__main__":
    seed_database()