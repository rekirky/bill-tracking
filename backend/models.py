import enum
from datetime import date, datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, Date, DateTime,
    ForeignKey, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from database import Base


class Frequency(str, enum.Enum):
    once = "once"
    fortnightly = "fortnightly"
    monthly = "monthly"
    quarterly = "quarterly"
    six_monthly = "six_monthly"
    annually = "annually"


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    is_primary_bills_account = Column(Boolean, default=False)
    current_balance = Column(Float, default=0.0)

    bills = relationship("Bill", back_populates="account")
    money_aside_entries = relationship("MoneyAside", back_populates="account")
    reconciliations = relationship("Reconciliation", back_populates="account")


class Bill(Base):
    __tablename__ = "bills"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    estimated_amount = Column(Float, nullable=False)
    due_date = Column(Date, nullable=False)
    payment_type = Column(String, nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    frequency = Column(SAEnum(Frequency), nullable=False, default=Frequency.monthly)
    anchor_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    account = relationship("Account", back_populates="bills")
    payments = relationship("Payment", back_populates="bill", cascade="all, delete-orphan")
    money_aside = relationship("MoneyAside", back_populates="bill", cascade="all, delete-orphan")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("bills.id"), nullable=False)
    amount_paid = Column(Float, nullable=False)
    date_paid = Column(Date, nullable=False)
    next_due_date = Column(Date, nullable=True)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    bill = relationship("Bill", back_populates="payments")


class MoneyAside(Base):
    __tablename__ = "money_aside"

    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("bills.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    amount = Column(Float, nullable=False)
    date_recorded = Column(Date, nullable=False, default=date.today)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    bill = relationship("Bill", back_populates="money_aside")
    account = relationship("Account", back_populates="money_aside_entries")


class Reconciliation(Base):
    __tablename__ = "reconciliations"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    bank_balance = Column(Float, nullable=False)
    system_total = Column(Float, nullable=False)
    difference = Column(Float, nullable=False)
    notes = Column(String, nullable=True)
    checked_at = Column(DateTime, default=datetime.utcnow)

    account = relationship("Account", back_populates="reconciliations")
