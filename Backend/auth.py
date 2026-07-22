
import hashlib
import bcrypt
from datetime import datetime, timedelta
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from database import User

# ─────────────────────────────────────────
# JWT Configuration
# ─────────────────────────────────────────
SECRET_KEY = "renovision_secret_key_2024_lgu"
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24


# ─────────────────────────────────────────
# Password Hashing — SHA256 + bcrypt
# ─────────────────────────────────────────

def hash_password(password: str) -> str:
    """Hash password using SHA256 + bcrypt"""
    # Step 1 — SHA256 digest
    sha_hash = hashlib.sha256(
        password.encode('utf-8')
    ).digest()

    # Step 2 — bcrypt with salt
    salt = bcrypt.gensalt(rounds=12)
    bcrypt_hash = bcrypt.hashpw(sha_hash, salt)

    # Always return as string for DB storage
    return bcrypt_hash.decode('utf-8')


def verify_password(
    plain_password: str,
    stored_hash: str
) -> bool:
    """Verify password against stored hash"""
    try:
        # Step 1 — SHA256 of input
        sha_hash = hashlib.sha256(
            plain_password.encode('utf-8')
        ).digest()

        # Step 2 — ensure stored hash is bytes
        if isinstance(stored_hash, str):
            stored_bytes = stored_hash.encode('utf-8')
        else:
            stored_bytes = stored_hash

        # Step 3 — bcrypt verify
        result = bcrypt.checkpw(
            sha_hash,
            stored_bytes
        )
        return result

    except Exception as e:
        print(f"❌ Password verify error: {e}")
        return False


# ─────────────────────────────────────────
# JWT Token Management
# ─────────────────────────────────────────

def create_token(data: dict) -> str:
    """Create JWT token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(
        hours=TOKEN_EXPIRE_HOURS
    )
    to_encode.update({"exp": expire})
    return jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


def verify_token(token: str):
    """Verify JWT token and return email"""
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )
        email = payload.get("sub")
        if not email:
            print("❌ Token has no 'sub' field")
            return None
        return email
    except JWTError as e:
        print(f"❌ JWT Error: {e}")
        return None
    except Exception as e:
        print(f"❌ Token error: {e}")
        return None


# ─────────────────────────────────────────
# Register User
# ─────────────────────────────────────────

def register_user(
    db: Session,
    name: str,
    email: str,
    password: str
) -> dict:
    """Register a new user"""

    try:
        # Clean inputs
        name = str(name).strip()
        email = str(email).strip().lower()
        password = str(password)

        print(f"📝 Registering: {email}")

        # Validate inputs
        if not name or len(name) < 1:
            return {
                "success": False,
                "error": "Name cannot be empty"
            }

        if not email or "@" not in email:
            return {
                "success": False,
                "error": "Invalid email address"
            }

        if not password or len(password) < 6:
            return {
                "success": False,
                "error": "Password must be at least 6 characters"
            }

        # Check if email already registered
        existing = db.query(User).filter(
            User.email == email
        ).first()

        if existing:
            print(f"⚠️ Email already exists: {email}")
            return {
                "success": False,
                "error": "Email already registered. Please login instead."
            }

        # Hash password
        hashed_pw = hash_password(password)

        # Create user
        new_user = User(
            name=name,
            email=email,
            password=hashed_pw,
            created_at=datetime.utcnow()
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        print(f"✅ User registered: {email} — ID: {new_user.id}")
        print(f"✅ Stored name: {new_user.name}")

        # Create token
        token = create_token({"sub": new_user.email})

        return {
            "success": True,
            "token": token,
            "user": {
                "id": new_user.id,
                "name": str(new_user.name),
                "email": str(new_user.email)
            }
        }

    except Exception as e:
        db.rollback()
        print(f"❌ Register error: {e}")
        return {
            "success": False,
            "error": f"Registration failed: {str(e)}"
        }


# ─────────────────────────────────────────
# Login User
# ─────────────────────────────────────────

def login_user(
    db: Session,
    email: str,
    password: str
) -> dict:
    """Login existing user"""

    try:
        # Clean inputs
        email = str(email).strip().lower()
        password = str(password)

        print(f"🔑 Login attempt: {email}")

        if not email or "@" not in email:
            return {
                "success": False,
                "error": "Invalid email address"
            }

        if not password:
            return {
                "success": False,
                "error": "Password cannot be empty"
            }

        # Find user
        user = db.query(User).filter(
            User.email == email
        ).first()

        if not user:
            print(f"❌ User not found: {email}")
            # Debug — list all users
            all_users = db.query(User).all()
            print(f"📊 Total users in DB: {len(all_users)}")
            for u in all_users:
                print(f"  - {u.email} | {u.name}")

            return {
                "success": False,
                "error": "Email not found. Please register first."
            }

        print(f"✅ User found: {user.email} | Name: {user.name}")

        # Verify password
        if not verify_password(password, user.password):
            print(f"❌ Wrong password for: {email}")
            return {
                "success": False,
                "error": "Incorrect password. Please try again."
            }

        print(f"✅ Login successful: {email}")

        # Create token
        token = create_token({"sub": user.email})

        return {
            "success": True,
            "token": token,
            "user": {
                "id": user.id,
                "name": str(user.name),
                "email": str(user.email)
            }
        }

    except Exception as e:
        print(f"❌ Login error: {e}")
        return {
            "success": False,
            "error": f"Login failed: {str(e)}"
        }


# ─────────────────────────────────────────
# Google OAuth Login
# ─────────────────────────────────────────

def google_login(
    db: Session,
    name: str,
    email: str,
    google_uid: str
) -> dict:
    """Login or register via Google OAuth"""

    try:
        # Clean inputs
        name = str(name).strip()
        email = str(email).strip().lower()

        print(f"🔑 Google login: {email}")

        # Check if user exists
        user = db.query(User).filter(
            User.email == email
        ).first()

        if not user:
            # Create new user
            print(f"📝 Creating Google user: {email}")
            user = User(
                name=name,
                email=email,
                password=f"google_{google_uid}",
                created_at=datetime.utcnow()
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"✅ Google user created: {user.id}")
        else:
            # Update name if changed
            if user.name != name and name:
                user.name = name
                db.commit()
                db.refresh(user)
            print(f"✅ Existing Google user: {user.id}")

        # Create token
        token = create_token({"sub": user.email})

        return {
            "success": True,
            "token": token,
            "user": {
                "id": user.id,
                "name": str(user.name),
                "email": str(user.email)
            }
        }

    except Exception as e:
        db.rollback()
        print(f"❌ Google login error: {e}")
        return {
            "success": False,
            "error": f"Google login failed: {str(e)}"
        }


# ─────────────────────────────────────────
# Get All Users (Admin)
# ─────────────────────────────────────────

def get_all_users(db: Session) -> list:
    """Get all registered users"""
    try:
        users = db.query(User).all()
        return [
            {
                "id": u.id,
                "name": str(u.name),
                "email": str(u.email),
                "created_at": str(u.created_at)
            }
            for u in users
        ]
    except Exception as e:
        print(f"❌ Get users error: {e}")
        return []