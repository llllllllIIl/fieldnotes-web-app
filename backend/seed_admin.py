"""One-time admin seed. Usage: python seed_admin.py <email> <password>"""
import os
import sys

from dotenv import load_dotenv

load_dotenv()


def main():
    if len(sys.argv) != 3:
        print("Usage: python seed_admin.py <email> <password>")
        sys.exit(1)
    email, password = sys.argv[1], sys.argv[2]

    url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not service_key:
        print("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env")
        sys.exit(1)

    from supabase import create_client

    svc = create_client(url, service_key)
    created = svc.auth.admin.create_user(
        {"email": email, "password": password, "email_confirm": True}
    )
    user = created.user
    if user is None:
        print("Could not create user (may already exist).")
        sys.exit(1)

    svc.table("profiles").upsert(
        {"id": user.id, "email": email, "is_admin": True}
    ).execute()
    print(f"Admin ready: {email}")


if __name__ == "__main__":
    main()
