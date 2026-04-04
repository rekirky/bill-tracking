from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException
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


def _goal_to_schema(goal: models.BarefootFireGoal) -> schemas.BarefootFireGoalSchema:
    total_allocated = sum(a.amount for a in goal.allocations)
    remaining = max(0.0, goal.total_owed - total_allocated)
    progress_pct = round(min(100.0, (total_allocated / goal.total_owed * 100) if goal.total_owed > 0 else 0), 1)
    allocations = sorted(goal.allocations, key=lambda a: (a.year, a.month, a.id), reverse=True)
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
        total_allocated=round(total_allocated, 2),
        remaining=round(remaining, 2),
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
    goal = models.BarefootFireGoal(**payload.model_dump())
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

    # Bucket targets
    targets = schemas.BarefootBucketTargets(
        daily=round(monthly_income * BUCKET_PCTS["daily"], 2),
        splurge=round(monthly_income * BUCKET_PCTS["splurge"], 2),
        smile=round(monthly_income * BUCKET_PCTS["smile"], 2),
        fire=round(monthly_income * BUCKET_PCTS["fire"], 2),
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
        settings=schemas.BarefootSettingsSchema.model_validate(settings),
    )
