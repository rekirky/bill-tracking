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
    is_paid: bool = False
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


# ── Spend Chart ───────────────────────────────────────────

class SpendPoint(BaseModel):
    day: int
    bill: str
    amount: float
    cumulative: float

class SpendChartData(BaseModel):
    previous_month: str
    current_month: str
    previous: list[SpendPoint]
    current: list[SpendPoint]


# ── Monthly Summary ───────────────────────────────────────

class MonthSummary(BaseModel):
    year: int
    month: int
    bills: list[Bill]
    total_amount: float
    total_aside: float
    total_outstanding: float


# ── Wealth Tags ───────────────────────────────────────────

class WealthTagBase(BaseModel):
    name: str
    color: str = "#4f7cff"

class WealthTagCreate(WealthTagBase):
    pass

class WealthTagUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None

class WealthTag(WealthTagBase):
    id: int
    class Config:
        from_attributes = True


# ── Wealth Items ──────────────────────────────────────────

class WealthItemBase(BaseModel):
    name: str
    type: str  # "asset" or "liability"
    show_on_dashboard: bool = False
    dashboard_order: int = 0

class WealthItemCreate(WealthItemBase):
    tag_ids: list[int] = []

class WealthItemUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    is_active: Optional[bool] = None
    show_on_dashboard: Optional[bool] = None
    dashboard_order: Optional[int] = None
    tag_ids: Optional[list[int]] = None

class WealthItem(WealthItemBase):
    id: int
    is_active: bool
    created_at: datetime
    tags: list[WealthTag] = []
    latest_value: Optional[float] = None
    class Config:
        from_attributes = True


# ── Wealth Snapshots ──────────────────────────────────────

class WealthSnapshotBase(BaseModel):
    wealth_item_id: int
    year: int
    month: int
    value: float
    notes: Optional[str] = None

class WealthSnapshotCreate(WealthSnapshotBase):
    pass

class WealthSnapshot(WealthSnapshotBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True

class WealthSnapshotUpsert(BaseModel):
    wealth_item_id: int
    year: int
    month: int
    value: Optional[float] = None  # None means skip/clear
    notes: Optional[str] = None


# ── Wealth Dashboard ──────────────────────────────────────

class WealthSparklinePoint(BaseModel):
    year: int
    month: int
    value: float

class WealthPinnedItem(BaseModel):
    id: int
    name: str
    type: str
    tags: list[WealthTag]
    current_value: Optional[float]
    previous_value: Optional[float]
    sparkline: list[WealthSparklinePoint]

class WealthHistoryPoint(BaseModel):
    year: int
    month: int
    label: str
    assets: float
    liabilities: float
    net_worth: float

class WealthItemComparison(BaseModel):
    id: int
    name: str
    type: str
    tags: list[WealthTag]
    current_value: Optional[float]
    previous_value: Optional[float]

class WealthDashboard(BaseModel):
    current_assets: float
    current_liabilities: float
    current_net_worth: float
    previous_assets: Optional[float]
    previous_liabilities: Optional[float]
    previous_net_worth: Optional[float]
    current_month_label: Optional[str]
    previous_month_label: Optional[str]
    history: list[WealthHistoryPoint]
    pinned_items: list[WealthPinnedItem]
    asset_comparisons: list[WealthItemComparison]
    liability_comparisons: list[WealthItemComparison]


# ── Wealth Month Grid ─────────────────────────────────────

class WealthMonthGridRow(BaseModel):
    item: WealthItem
    snapshot_id: Optional[int]
    value: Optional[float]
    notes: Optional[str]


# ── Barefoot Income ───────────────────────────────────────

class BarefootIncomeStreamBase(BaseModel):
    name: str
    amount: float
    frequency: str  # weekly / fortnightly / monthly
    is_active: bool = True

class BarefootIncomeStreamCreate(BarefootIncomeStreamBase):
    pass

class BarefootIncomeStreamUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = None
    frequency: Optional[str] = None
    is_active: Optional[bool] = None

class BarefootIncomeStream(BarefootIncomeStreamBase):
    id: int
    monthly_equivalent: float
    created_at: datetime
    class Config:
        from_attributes = True


# ── Barefoot Settings ─────────────────────────────────────

class BarefootSettingsUpdate(BaseModel):
    smile_months_target: Optional[int] = None

class BarefootSettingsSchema(BaseModel):
    id: int
    smile_months_target: int
    class Config:
        from_attributes = True


# ── Barefoot Monthly Entry ────────────────────────────────

class BarefootMonthlyEntryUpsert(BaseModel):
    bucket: str
    year: int
    month: int
    amount: float

class BarefootMonthlyEntry(BaseModel):
    id: int
    bucket: str
    year: int
    month: int
    amount: float
    created_at: datetime
    class Config:
        from_attributes = True


# ── Barefoot Fire Allocation ──────────────────────────────

class BarefootFireAllocationCreate(BaseModel):
    fire_goal_id: int
    year: int
    month: int
    amount: float
    notes: Optional[str] = None

class BarefootFireAllocationSchema(BaseModel):
    id: int
    fire_goal_id: int
    year: int
    month: int
    amount: float
    notes: Optional[str]
    created_at: datetime
    class Config:
        from_attributes = True


# ── Barefoot Fire Goal ────────────────────────────────────

class BarefootFireGoalCreate(BaseModel):
    name: str
    total_owed: float
    priority: str = "medium"
    due_date: Optional[date] = None
    is_slush_bill: bool = False
    notes: Optional[str] = None

class BarefootFireGoalUpdate(BaseModel):
    name: Optional[str] = None
    total_owed: Optional[float] = None
    priority: Optional[str] = None
    due_date: Optional[date] = None
    notes: Optional[str] = None

class BarefootFireGoalSchema(BaseModel):
    id: int
    name: str
    total_owed: float
    priority: str
    due_date: Optional[date]
    is_paid_off: bool
    paid_off_at: Optional[datetime]
    is_slush_bill: bool
    notes: Optional[str]
    total_allocated: float
    remaining: float
    progress_pct: float
    allocations: list[BarefootFireAllocationSchema]
    created_at: datetime
    class Config:
        from_attributes = True


# ── Barefoot Dashboard ────────────────────────────────────

class BarefootBucketTargets(BaseModel):
    daily: float
    splurge: float
    smile: float
    fire: float

class BarefootDashboard(BaseModel):
    year: int
    month: int
    monthly_income: float
    targets: BarefootBucketTargets
    this_month_deposits: dict
    running_totals: dict
    fire_mode: str  # "debts" or "slush"
    fire_goals: list[BarefootFireGoalSchema]
    fire_slush_balance: float
    smile_balance: float
    smile_months_target: int
    smile_months_achieved: float
    monthly_bills_total: float
    settings: BarefootSettingsSchema
