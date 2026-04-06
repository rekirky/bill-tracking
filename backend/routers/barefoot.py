from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import extract
from sqlalchemy.orm import Session
from database import get_db
import models, schemas

router = APIRouter(prefix="/barefoot", tags=["barefoot"])

INCOME_TO_MONTHLY = {
    "weekly": 52 / 12,
    "fortnightly": 26 / 12,
    "monthly": 1.0,
}

BILL_TO_MONTHLY = {
    "once": 0.0,
    "weekly": 52 / 12,
    "fortnightly": 26 / 12,
    "monthly": 1.0,
    "quarterly": 1 / 3,
    "six_monthly": 1 / 6,
    "annually": 1 / 12,
}

BUCKET_PCTS = {"daily": 0.60, "splurge": 0.10, "smile": 0.10, "fire": 0.20}


def _get_or_create_settings(db: Session) -> models.BarefootSettings:
    s = db.query(models.BarefootSettings).first()
    if not s:
        s = models.BarefootSettings()
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


def _latest_snapshot_value(goal: models.BarefootFireGoal) -> float | None:
    """Return the latest Asset Tracker snapshot value for a linked liability, or None."""
    if not goal.wealth_item_id or not goal.linked_wealth_item:
        return None
    snaps = goal.linked_wealth_item.snapshots
    if not snaps:
        return None
    return max(snaps, key=lambda s: (s.year, s.month)).value


def _goal_to_schema(goal: models.BarefootFireGoal) -> schemas.BarefootFireGoalSchema:
    total_allocated = round(sum(a.amount for a in goal.allocations), 2)
    allocations = sorted(goal.allocations, key=lambda a: (a.year, a.month, a.id), reverse=True)

    is_linked = goal.wealth_item_id is not None
    linked_item_name = goal.linked_wealth_item.name if is_linked and goal.linked_wealth_item else None

    if is_linked:
        # Remaining = live snapshot value (fluctuates with market/repayments)
        snapshot_val = _latest_snapshot_value(goal)
        remaining = round(snapshot_val, 2) if snapshot_val is not None else round(goal.total_owed, 2)
        # Progress = how much the balance has dropped from the original total_owed
        if goal.total_owed > 0:
            drop = goal.total_owed - remaining
            progress_pct = round(max(0.0, min(100.0, drop / goal.total_owed * 100)), 1)
        else:
            progress_pct = 0.0
    else:
        # Manual goal: allocations reduce the remaining
        remaining = round(max(0.0, goal.total_owed - total_allocated), 2)
        progress_pct = round(min(100.0, (total_allocated / goal.total_owed * 100) if goal.total_owed > 0 else 0), 1)

    return schemas.BarefootFireGoalSchema(
        id=goal.id,
        name=goal.name,
        total_owed=goal.total_owed,
        priority=goal.priority,
        due_date=goal.due_date,
        is_paid_off=goal.is_paid_off,
        paid_off_at=goal.paid_off_at,
        is_slush_bill=goal.is_slush_bill,
        notes=goal.notes,
        wealth_item_id=goal.wealth_item_id,
        is_linked=is_linked,
        linked_item_name=linked_item_name,
        total_allocated=total_allocated,
        remaining=remaining,
        progress_pct=progress_pct,
        allocations=[schemas.BarefootFireAllocationSchema.model_validate(a) for a in allocations],
        created_at=goal.created_at,
    )


# ── Settings ──────────────────────────────────────────────

@router.get("/settings/", response_model=schemas.BarefootSettingsSchema)
def get_settings(db: Session = Depends(get_db)):
    return _get_or_create_settings(db)


@router.patch("/settings/", response_model=schemas.BarefootSettingsSchema)
def update_settings(payload: schemas.BarefootSettingsUpdate, db: Session = Depends(get_db)):
    s = _get_or_create_settings(db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(s, field, value)
    db.commit()
    db.refresh(s)
    return s


# ── Income Streams ────────────────────────────────────────

@router.get("/income/", response_model=list[schemas.BarefootIncomeStream])
def list_income(db: Session = Depends(get_db)):
    streams = db.query(models.BarefootIncomeStream).order_by(models.BarefootIncomeStream.name).all()
    out = []
    for s in streams:
        monthly = round(s.amount * INCOME_TO_MONTHLY.get(s.frequency, 1.0), 2)
        out.append(schemas.BarefootIncomeStream(
            id=s.id, name=s.name, amount=s.amount, frequency=s.frequency,
            is_active=s.is_active, monthly_equivalent=monthly, created_at=s.created_at,
        ))
    return out


@router.post("/income/", response_model=schemas.BarefootIncomeStream, status_code=201)
def create_income(payload: schemas.BarefootIncomeStreamCreate, db: Session = Depends(get_db)):
    stream = models.BarefootIncomeStream(**payload.model_dump())
    db.add(stream)
    db.commit()
    db.refresh(stream)
    monthly = round(stream.amount * INCOME_TO_MONTHLY.get(stream.frequency, 1.0), 2)
    return schemas.BarefootIncomeStream(
        id=stream.id, name=stream.name, amount=stream.amount, frequency=stream.frequency,
        is_active=stream.is_active, monthly_equivalent=monthly, created_at=stream.created_at,
    )


@router.patch("/income/{stream_id}", response_model=schemas.BarefootIncomeStream)
def update_income(stream_id: int, payload: schemas.BarefootIncomeStreamUpdate, db: Session = Depends(get_db)):
    stream = db.query(models.BarefootIncomeStream).filter(models.BarefootIncomeStream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=404, detail="Income stream not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(stream, field, value)
    db.commit()
    db.refresh(stream)
    monthly = round(stream.amount * INCOME_TO_MONTHLY.get(stream.frequency, 1.0), 2)
    return schemas.BarefootIncomeStream(
        id=stream.id, name=stream.name, amount=stream.amount, frequency=stream.frequency,
        is_active=stream.is_active, monthly_equivalent=monthly, created_at=stream.created_at,
    )


@router.delete("/income/{stream_id}", status_code=204)
def delete_income(stream_id: int, db: Session = Depends(get_db)):
    stream = db.query(models.BarefootIncomeStream).filter(models.BarefootIncomeStream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=404, detail="Income stream not found")
    db.delete(stream)
    db.commit()


# ── Monthly Entries ───────────────────────────────────────

@router.get("/entries/", response_model=list[schemas.BarefootMonthlyEntry])
def list_entries(year: int, month: int, db: Session = Depends(get_db)):
    return (
        db.query(models.BarefootMonthlyEntry)
        .filter(models.BarefootMonthlyEntry.year == year, models.BarefootMonthlyEntry.month == month)
        .all()
    )


@router.post("/entries/upsert", response_model=schemas.BarefootMonthlyEntry)
def upsert_entry(payload: schemas.BarefootMonthlyEntryUpsert, db: Session = Depends(get_db)):
    existing = (
        db.query(models.BarefootMonthlyEntry)
        .filter(
            models.BarefootMonthlyEntry.bucket == payload.bucket,
            models.BarefootMonthlyEntry.year == payload.year,
            models.BarefootMonthlyEntry.month == payload.month,
        )
        .first()
    )
    if existing:
        existing.amount = payload.amount
        db.commit()
        db.refresh(existing)
        return existing
    entry = models.BarefootMonthlyEntry(**payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


# ── Linkable Liabilities ──────────────────────────────────

@router.get("/linkable-liabilities/", response_model=list[schemas.LinkableLiability])
def linkable_liabilities(db: Session = Depends(get_db)):
    """Return active liability wealth items with a 'fire' tag that have no linked fire goal yet."""
    already_linked_ids = {
        g.wealth_item_id
        for g in db.query(models.BarefootFireGoal).filter(models.BarefootFireGoal.wealth_item_id.isnot(None)).all()
    }
    items = (
        db.query(models.WealthItem)
        .filter(models.WealthItem.type == "liability", models.WealthItem.is_active == True)
        .all()
    )
    result = []
    for item in items:
        if item.id in already_linked_ids:
            continue
        tag_names = [t.name.lower() for t in item.tags]
        if "fire" not in tag_names:
            continue
        snaps = item.snapshots
        latest_value = max(snaps, key=lambda s: (s.year, s.month)).value if snaps else None
        result.append(schemas.LinkableLiability(
            id=item.id,
            name=item.name,
            latest_value=latest_value,
            tags=[{"id": t.id, "name": t.name, "color": t.color} for t in item.tags],
        ))
    return result


# ── Fire Goals ────────────────────────────────────────────

@router.get("/fire-goals/", response_model=list[schemas.BarefootFireGoalSchema])
def list_fire_goals(db: Session = Depends(get_db)):
    goals = db.query(models.BarefootFireGoal).order_by(
        models.BarefootFireGoal.is_paid_off,
        models.BarefootFireGoal.is_slush_bill,
        models.BarefootFireGoal.priority.desc(),
        models.BarefootFireGoal.created_at,
    ).all()
    return [_goal_to_schema(g) for g in goals]


@router.post("/fire-goals/", response_model=schemas.BarefootFireGoalSchema, status_code=201)
def create_fire_goal(payload: schemas.BarefootFireGoalCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    # If linking to a wealth item, seed total_owed from its latest snapshot
    if data.get("wealth_item_id"):
        item = db.query(models.WealthItem).filter(models.WealthItem.id == data["wealth_item_id"]).first()
        if item and item.snapshots:
            latest = max(item.snapshots, key=lambda s: (s.year, s.month))
            data["total_owed"] = latest.value
    goal = models.BarefootFireGoal(**data)
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return _goal_to_schema(goal)


@router.patch("/fire-goals/{goal_id}", response_model=schemas.BarefootFireGoalSchema)
def update_fire_goal(goal_id: int, payload: schemas.BarefootFireGoalUpdate, db: Session = Depends(get_db)):
    goal = db.query(models.BarefootFireGoal).filter(models.BarefootFireGoal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Fire goal not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(goal, field, value)
    db.commit()
    db.refresh(goal)
    return _goal_to_schema(goal)


@router.delete("/fire-goals/{goal_id}", status_code=204)
def delete_fire_goal(goal_id: int, db: Session = Depends(get_db)):
    goal = db.query(models.BarefootFireGoal).filter(models.BarefootFireGoal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Fire goal not found")
    db.delete(goal)
    db.commit()


@router.post("/fire-goals/{goal_id}/celebrate", response_model=schemas.BarefootFireGoalSchema)
def celebrate_goal(goal_id: int, db: Session = Depends(get_db)):
    goal = db.query(models.BarefootFireGoal).filter(models.BarefootFireGoal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Fire goal not found")
    goal.is_paid_off = True
    goal.paid_off_at = datetime.utcnow()
    db.commit()
    db.refresh(goal)
    return _goal_to_schema(goal)


# ── Fire Allocations ──────────────────────────────────────

@router.post("/fire-allocations/", response_model=schemas.BarefootFireAllocationSchema, status_code=201)
def create_allocation(payload: schemas.BarefootFireAllocationCreate, db: Session = Depends(get_db)):
    goal = db.query(models.BarefootFireGoal).filter(models.BarefootFireGoal.id == payload.fire_goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Fire goal not found")
    allocation = models.BarefootFireAllocation(**payload.model_dump())
    db.add(allocation)
    db.commit()
    db.refresh(allocation)
    return allocation


@router.delete("/fire-allocations/{allocation_id}", status_code=204)
def delete_allocation(allocation_id: int, db: Session = Depends(get_db)):
    alloc = db.query(models.BarefootFireAllocation).filter(models.BarefootFireAllocation.id == allocation_id).first()
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation not found")
    db.delete(alloc)
    db.commit()


# ── Daily Expenses ────────────────────────────────────────

@router.post("/daily-expenses/", response_model=schemas.BarefootDailyExpenseSchema, status_code=201)
def create_daily_expense(payload: schemas.BarefootDailyExpenseCreate, db: Session = Depends(get_db)):
    expense = models.BarefootDailyExpense(**payload.model_dump())
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/daily-expenses/{expense_id}", status_code=204)
def delete_daily_expense(expense_id: int, db: Session = Depends(get_db)):
    expense = db.query(models.BarefootDailyExpense).filter(models.BarefootDailyExpense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Daily expense not found")
    db.delete(expense)
    db.commit()


# ── Dashboard ─────────────────────────────────────────────

@router.get("/dashboard/", response_model=schemas.BarefootDashboard)
def dashboard(year: int = None, month: int = None, db: Session = Depends(get_db)):
    today = date.today()
    if year is None:
        year = today.year
    if month is None:
        month = today.month

    settings = _get_or_create_settings(db)

    # Normalised monthly income from active streams
    streams = db.query(models.BarefootIncomeStream).filter(models.BarefootIncomeStream.is_active == True).all()
    monthly_income = round(sum(s.amount * INCOME_TO_MONTHLY.get(s.frequency, 1.0) for s in streams), 2)

    # Bucket targets — use user-configured ratios from settings
    bucket_pcts = {
        "daily":   (settings.pct_daily   or 60.0) / 100,
        "splurge": (settings.pct_splurge or 10.0) / 100,
        "smile":   (settings.pct_smile   or 10.0) / 100,
        "fire":    (settings.pct_fire    or 20.0) / 100,
    }
    targets = schemas.BarefootBucketTargets(
        daily=round(monthly_income * bucket_pcts["daily"], 2),
        splurge=round(monthly_income * bucket_pcts["splurge"], 2),
        smile=round(monthly_income * bucket_pcts["smile"], 2),
        fire=round(monthly_income * bucket_pcts["fire"], 2),
    )

    # This month deposits
    this_month_entries = (
        db.query(models.BarefootMonthlyEntry)
        .filter(models.BarefootMonthlyEntry.year == year, models.BarefootMonthlyEntry.month == month)
        .all()
    )
    this_month_deposits = {e.bucket: e.amount for e in this_month_entries}

    # All-time running totals per bucket
    all_entries = db.query(models.BarefootMonthlyEntry).all()
    running_totals: dict[str, float] = {"daily": 0.0, "splurge": 0.0, "smile": 0.0, "fire": 0.0}
    for e in all_entries:
        running_totals[e.bucket] = running_totals.get(e.bucket, 0.0) + e.amount

    # Fire goals
    goals = db.query(models.BarefootFireGoal).order_by(
        models.BarefootFireGoal.is_paid_off,
        models.BarefootFireGoal.is_slush_bill,
    ).all()
    fire_goals_out = [_goal_to_schema(g) for g in goals]

    total_fire_allocated = sum(a.amount for g in goals for a in g.allocations)
    fire_slush_balance = round(max(0.0, running_totals["fire"] - total_fire_allocated), 2)

    active_debts = [g for g in goals if not g.is_paid_off and not g.is_slush_bill]
    fire_mode = "debts" if active_debts else "slush"

    # Smile balance and security
    smile_balance = round(running_totals["smile"], 2)
    bills = db.query(models.Bill).filter(models.Bill.is_active == True).all()
    monthly_bills_total = round(
        sum(b.estimated_amount * BILL_TO_MONTHLY.get(b.frequency.value, 1.0) for b in bills), 2
    )
    smile_months_achieved = round(smile_balance / monthly_bills_total, 2) if monthly_bills_total > 0 else 0.0

    smile_this_month = this_month_deposits.get("smile", 0.0)
    fire_this_month = this_month_deposits.get("fire", 0.0)
    splurge_calculated = round(monthly_income - monthly_bills_total - smile_this_month - fire_this_month, 2)

    # Bills paid this month (payments with date_paid in this year/month)
    payments_this_month = (
        db.query(models.Payment)
        .filter(
            extract("year", models.Payment.date_paid) == year,
            extract("month", models.Payment.date_paid) == month,
        )
        .all()
    )
    bills_paid_this_month = [
        schemas.BarefootBillPaid(
            bill_name=p.bill.name if p.bill else "Unknown",
            amount_paid=p.amount_paid,
            date_paid=p.date_paid,
        )
        for p in payments_this_month
    ]
    bills_paid_total = round(sum(p.amount_paid for p in payments_this_month), 2)

    # Once-off daily expenses this month
    daily_expenses = (
        db.query(models.BarefootDailyExpense)
        .filter(
            models.BarefootDailyExpense.year == year,
            models.BarefootDailyExpense.month == month,
        )
        .order_by(models.BarefootDailyExpense.created_at)
        .all()
    )
    daily_expenses_total = round(sum(e.amount for e in daily_expenses), 2)
    daily_calculated = round(bills_paid_total + daily_expenses_total, 2)

    return schemas.BarefootDashboard(
        year=year,
        month=month,
        monthly_income=monthly_income,
        targets=targets,
        this_month_deposits=this_month_deposits,
        running_totals={k: round(v, 2) for k, v in running_totals.items()},
        fire_mode=fire_mode,
        fire_goals=fire_goals_out,
        fire_slush_balance=fire_slush_balance,
        smile_balance=smile_balance,
        smile_months_target=settings.smile_months_target,
        smile_months_achieved=smile_months_achieved,
        monthly_bills_total=monthly_bills_total,
        splurge_calculated=splurge_calculated,
        daily_calculated=daily_calculated,
        bills_paid_this_month=bills_paid_this_month,
        daily_expenses_this_month=[schemas.BarefootDailyExpenseSchema.model_validate(e) for e in daily_expenses],
        settings=schemas.BarefootSettingsSchema.model_validate(settings),
    )
