import enum
from datetime import date, datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, Date, DateTime,
    ForeignKey, Enum as SAEnum, Table, UniqueConstraint
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
    series_id = Column(Integer, nullable=True, index=True)
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


# ── Wealth Tracking ───────────────────────────────────────

wealth_item_tags = Table(
    "wealth_item_tags",
    Base.metadata,
    Column("wealth_item_id", Integer, ForeignKey("wealth_items.id"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("wealth_tags.id"), primary_key=True),
)


class WealthTag(Base):
    __tablename__ = "wealth_tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    color = Column(String, nullable=False, default="#4f7cff")

    items = relationship("WealthItem", secondary="wealth_item_tags", back_populates="tags")


class WealthItem(Base):
    __tablename__ = "wealth_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # "asset" or "liability"
    is_active = Column(Boolean, default=True)
    show_on_dashboard = Column(Boolean, default=False)
    dashboard_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    tags = relationship("WealthTag", secondary="wealth_item_tags", back_populates="items")
    snapshots = relationship("WealthSnapshot", back_populates="item", cascade="all, delete-orphan")


class WealthSnapshot(Base):
    __tablename__ = "wealth_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    wealth_item_id = Column(Integer, ForeignKey("wealth_items.id"), nullable=False)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    value = Column(Float, nullable=False)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    item = relationship("WealthItem", back_populates="snapshots")

    __table_args__ = (
        UniqueConstraint("wealth_item_id", "year", "month", name="uq_snapshot_item_month"),
    )
