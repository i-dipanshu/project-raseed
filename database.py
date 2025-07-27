# database.py - SQLAlchemy Database Setup

import os
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool

# --- Database Configuration ---

# Get the absolute path of the directory where this file is located
basedir = os.path.abspath(os.path.dirname(__file__))
# Define the database file path
DATABASE_FILE = os.path.join(basedir, 'expenses.db')

# The database URL for SQLite
DATABASE_URL = f'sqlite:///{DATABASE_FILE}'

# Create the SQLAlchemy engine
# connect_args and StaticPool are needed to make SQLite work correctly in some environments like Flask
engine = create_engine(
    DATABASE_URL,
    connect_args={'check_same_thread': False},
    poolclass=StaticPool
)

# Create a session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for our declarative models
Base = declarative_base()

# --- Database Models ---

class Expense(Base):
    """SQLAlchemy model for an expense entry."""
    __tablename__ = 'expenses'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    original_text = Column(Text, nullable=False)
    # Store the complex parsed data as a JSON string
    parsed_data = Column(Text, nullable=False)
    status = Column(String(50), nullable=False, default='pending')
    created_at = Column(DateTime, default=datetime.utcnow)
    expense_date = Column(DateTime, nullable=True)  # Date when the expense occurred

    def to_dict(self):
        """Converts the Expense model instance to a dictionary."""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'original_text': self.original_text,
            'parsed_data': self.parsed_data,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'expense_date': self.expense_date.isoformat() if self.expense_date else None
        }

class Insight(Base):
    """SQLAlchemy model for storing AI-generated insights."""
    __tablename__ = 'insights'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    query = Column(Text, nullable=False)
    insight_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    tags = Column(String(500))  # Comma-separated tags for categorization

    def to_dict(self):
        """Converts the Insight model instance to a dictionary."""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'query': self.query,
            'insight_text': self.insight_text,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'tags': self.tags.split(',') if self.tags else []
        }

# --- Database Utility Functions ---

def init_db():
    """
    Initializes the database.
    This will create the database file and all tables defined in the models.
    It's safe to call this multiple times; it won't recreate existing tables.
    """
    Base.metadata.create_all(bind=engine)

def get_db_session():
    """
    Provides a new database session.
    This should be called for each request that needs database access.
    """
    return SessionLocal()

