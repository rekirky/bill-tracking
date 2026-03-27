from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel
from models import Frequency


# ── Accounts ──────────────────────────────────────────────

class AccountBase(BaseModel):
    name: str
    is_primary_bills_account: bool = False
    current_balance: float = 0.0

class AccountCreate(AccountBase):
    pass

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    is_primary_bills_account: Optional[bool] = None
    current_balance: Optional[float] = None

class Account(AccountBase):
    id: int
    class Config:
        from_attributes = True


# ── Bills ─────────────────────────────────────────────────

class BillBase(BaseModel):
    name: str
    estimated_amount: float
    due_date: date
    payment_type: str
    account_id: int
    frequency: Frequency = Frequency.monthly
    anchor_date: Optional[date] = None

class BillCreate(BillBase):
    pass

class BillUpdate(BaseModel):
    name: Optional[str] = None
    estimated_amount: Optional[float] = None
    due_date: Optional[date] = None
    payment_type: Optional[str] = None
    account_id: Optional[int] = None
    frequency: Optional[Frequency] = None
    anchor_date: Optional[date] = None
    is_active: Optional[bool] = None

class Bill(BillBase):
    id: int
    is_active: bool
    created_at: datetime
    total_aside: float = 0.0
    outstanding: float = 0.0
    class Config:
        from_attributes = True


# ── Payments ──────────────────────────────────────────────

class PaymentBase(BaseModel):
    bill_id: int
    amount_paid: float
    date_paid: date
    notes: Optional[str] = None

class PaymentCreate(PaymentBase):
    pass

class Payment(PaymentBase):
    id: int
    next_due_date: Optional[date]
    created_at: datetime
    class Config:
        from_attributes = True


# ── Money Aside ───────────────────────────────────────────

class MoneyAsideBase(BaseModel):
    bill_id: int
    account_id: int
    amount: float
    date_recorded: date
    notes: Optional[str] = None

class MoneyAsideCreate(MoneyAsideBase):
    pass

class MoneyAside(MoneyAsideBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True


# ── Reconciliation ────────────────────────────────────────

class ReconciliationCreate(BaseModel):
    account_id: int
    bank_balance: float
    notes: Optional[str] = None

class Reconciliation(BaseModel):
    id: int
    account_id: int
    bank_balance: float
    system_total: float
    difference: float
    notes: Optional[str]
    checked_at: datetime
    class Config:
        from_attributes = True


# ── Dashboard ─────────────────────────────────────────────

class DashboardSummary(BaseModel):
    total_outstanding: float
    total_money_aside: float
    difference: float
    bills_this_month: int
    bills_unpaid_this_month: int
    upcoming_bills: list[Bill]


# ── Monthly Summary ───────────────────────────────────────

class MonthSummary(BaseModel):
    year: int
    month: int
    bills: list[Bill]
    total_amount: float
    total_aside: float
    total_outstanding: float
