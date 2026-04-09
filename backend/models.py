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


# ── Barefoot Investor ─────────────────────────────────────

class BarefootIncomeStream(Base):
    __tablename__ = "barefoot_income_streams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    frequency = Column(String, nullable=False, default="monthly")  # weekly/fortnightly/monthly
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class BarefootSettings(Base):
    __tablename__ = "barefoot_settings"

    id = Column(Integer, primary_key=True)
    smile_months_target = Column(Integer, default=3)
    pct_daily = Column(Float, default=60.0)
    pct_splurge = Column(Float, default=10.0)
    pct_smile = Column(Float, default=10.0)
    pct_fire = Column(Float, default=20.0)


class BarefootMonthlyEntry(Base):
    __tablename__ = "barefoot_monthly_entries"

    id = Column(Integer, primary_key=True, index=True)
    bucket = Column(String, nullable=False)  # daily / splurge / smile / fire
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    amount = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("bucket", "year", "month", name="uq_barefoot_bucket_month"),
    )


class BarefootFireGoal(Base):
    __tablename__ = "barefoot_fire_goals"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    total_owed = Column(Float, nullable=False)
    priority = Column(String, nullable=False, default="medium")  # low / medium / high
    due_date = Column(Date, nullable=True)
    is_paid_off = Column(Boolean, default=False)
    paid_off_at = Column(DateTime, nullable=True)
    is_slush_bill = Column(Boolean, default=False)
    notes = Column(String, nullable=True)
    # Optional link to a wealth liability item — remaining is driven by its snapshots
    wealth_item_id = Column(Integer, ForeignKey("wealth_items.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    allocations = relationship("BarefootFireAllocation", back_populates="goal", cascade="all, delete-orphan")
    linked_wealth_item = relationship("WealthItem", foreign_keys=[wealth_item_id])


class BarefootBucketTransaction(Base):
    __tablename__ = "barefoot_bucket_transactions"

    id = Column(Integer, primary_key=True, index=True)
    bucket = Column(String, nullable=False)  # "smile" or "fire"
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    amount = Column(Float, nullable=False)  # can be negative
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class BarefootFireAllocation(Base):
    __tablename__ = "barefoot_fire_allocations"

    id = Column(Integer, primary_key=True, index=True)
    fire_goal_id = Column(Integer, ForeignKey("barefoot_fire_goals.id"), nullable=False)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    amount = Column(Float, nullable=False)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    goal = relationship("BarefootFireGoal", back_populates="allocations")


class BarefootDailyExpense(Base):
    __tablename__ = "barefoot_daily_expenses"

    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    description = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
