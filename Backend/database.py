# database.py

import os
import socket
from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    DateTime,
    text
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime


# ─────────────────────────────────────────
# Force IPv4 — fixes Supabase IPv6 DNS issue
# ─────────────────────────────────────────
_original_getaddrinfo = socket.getaddrinfo

def _force_ipv4_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    try:
        return _original_getaddrinfo(
            host, port,
            socket.AF_INET,
            type, proto, flags
        )
    except socket.gaierror:
        # Fallback to default if IPv4 resolution fails
        return _original_getaddrinfo(host, port, family, type, proto, flags)

socket.getaddrinfo = _force_ipv4_getaddrinfo
print("✅ IPv4 forced for all connections")


# ─────────────────────────────────────────
# Database URL
# ─────────────────────────────────────────

def get_database_url():
    env_url = os.getenv("DATABASE_URL", "").strip()

    if env_url:
        print(f"✅ Using DATABASE_URL from environment")
        print(f"✅ DB type: {env_url.split('://')[0]}")

        # Fix legacy postgres:// prefix
        if env_url.startswith("postgres://"):
            env_url = env_url.replace("postgres://", "postgresql://", 1)
            print("✅ Fixed postgres:// → postgresql://")

        if "pooler.supabase.com" in env_url:
            print("⚠️  Supabase pooler URL detected.")
            print("    If DNS errors occur, switch to Direct connection URL in Supabase dashboard.")
            print("    Supabase → Settings → Database → Connection String → Direct")

        return env_url

    print("✅ No DATABASE_URL — using local SQLite")
    return "sqlite:///./renovision.db"


DATABASE_URL = get_database_url()


# ─────────────────────────────────────────
# Create Engine
# ─────────────────────────────────────────

def create_db_engine():
    url = DATABASE_URL

    if "sqlite" in url:
        print("✅ Creating SQLite engine")
        engine = create_engine(
            url,
            connect_args={"check_same_thread": False, "timeout": 30},
            echo=False,
            pool_pre_ping=True
        )
    else:
        print("✅ Creating PostgreSQL engine (IPv4 forced)")
        engine = create_engine(
            url,
            echo=False,
            pool_pre_ping=True,
            pool_size=3,
            max_overflow=5,
            pool_timeout=30,
            pool_recycle=1800,
            connect_args={
                "connect_timeout": 15,
                "options": "-c timezone=utc"
            }
        )

    return engine


# ─────────────────────────────────────────
# Safe engine creation — fallback to SQLite
# if Supabase is unreachable
# ─────────────────────────────────────────
try:
    engine = create_db_engine()
except Exception as e:
    print(f"⚠️  Primary DB engine failed: {e}")
    print("⚠️  Falling back to local SQLite")
    DATABASE_URL = "sqlite:///./renovision.db"
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False, "timeout": 30},
        echo=False,
        pool_pre_ping=True
    )

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


# ─────────────────────────────────────────
# User Model
# ─────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id         = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name       = Column(String(100), nullable=False)
    email      = Column(String(200), unique=True, index=True, nullable=False)
    password   = Column(String(500), nullable=False)
    google_uid = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            "id":         self.id,
            "name":       str(self.name)  if self.name  else "",
            "email":      str(self.email) if self.email else "",
            "created_at": str(self.created_at)
        }


# ─────────────────────────────────────────
# Create Tables
# ─────────────────────────────────────────

def create_tables():
    try:
        print("🔄 Creating database tables...")
        Base.metadata.create_all(bind=engine)
        print("✅ Tables created successfully")

        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))

        db_type = "SQLite (local)" if "sqlite" in DATABASE_URL else "PostgreSQL (Supabase)"
        print(f"✅ Database connection verified — {db_type}")

    except Exception as e:
        print(f"❌ Database setup error: {e}")
        raise e


# ─────────────────────────────────────────
# Get DB Session
# ─────────────────────────────────────────

def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        db.rollback()
        print(f"❌ Session error, rolled back: {e}")
        raise e
    finally:
        db.close()