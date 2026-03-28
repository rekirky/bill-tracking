from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import extract
from database import get_db
import models, schemas

router = APIRouter(prefix="/bills", tags=["bills"])


def _enrich(bill: models.Bill) -> schemas.Bill:
    """Attach computed total_aside, outstanding, and is_paid to a bill."""
    total_aside = sum(m.amount for m in bill.money_aside)
    outstanding = max(bill.estimated_amount - total_aside, 0)
    data = schemas.Bill.model_validate(bill)
    data.total_aside = total_aside
    data.outstanding = outstanding
    data.is_paid = len(bill.payments) > 0
    return data


@router.get("/", response_model=list[schemas.Bill])
def list_bills(
    active_only: bool = True,
    account_id: int | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(models.Bill)
    if active_only:
        q = q.filter(models.Bill.is_active == True)
    if account_id:
        q = q.filter(models.Bill.account_id == account_id)
    bills = q.order_by(models.Bill.due_date).all()
    return [_enrich(b) for b in bills]


@router.get("/by-month", response_model=schemas.MonthSummary)
def bills_by_month(
    year: int = Query(...),
    month: int = Query(...),
    db: Session = Depends(get_db),
):
    bills = (
        db.query(models.Bill)
        .filter(
            models.Bill.is_active == True,
            extract("year", models.Bill.due_date) == year,
            extract("month", models.Bill.due_date) == month,
        )
        .order_by(models.Bill.due_date)
        .all()
    )
    enriched = [_enrich(b) for b in bills]
    return schemas.MonthSummary(
        year=year,
        month=month,
        bills=enriched,
        total_amount=sum(b.estimated_amount for b in enriched),
        total_aside=sum(b.total_aside for b in enriched),
        total_outstanding=sum(b.outstanding for b in enriched),
    )


@router.get("/dashboard", response_model=schemas.DashboardSummary)
def dashboard(db: Session = Depends(get_db)):
    today = date.today()
    all_bills = db.query(models.Bill).filter(models.Bill.is_active == True).all()
    enriched = [_enrich(b) for b in all_bills]

    this_month = [
        b for b in enriched
        if b.due_date.year == today.year and b.due_date.month == today.month
    ]
    unpaid_this_month = [b for b in this_month if not b.is_paid]

    upcoming = sorted(
        [b for b in enriched if b.due_date >= today and not b.is_paid],
        key=lambda b: b.due_date,
    )[:10]

    unpaid = [b for b in enriched if not b.is_paid]

    return schemas.DashboardSummary(
        total_outstanding=sum(b.outstanding for b in unpaid),
        total_money_aside=sum(b.total_aside for b in unpaid),
        difference=sum(b.total_aside for b in unpaid) - sum(b.outstanding for b in unpaid),
        bills_this_month=len(this_month),
        bills_unpaid_this_month=len(unpaid_this_month),
        upcoming_bills=upcoming,
    )


@router.get("/spend-chart", response_model=schemas.SpendChartData)
def spend_chart(db: Session = Depends(get_db)):
    today = date.today()
    current_start = today.replace(day=1)
    prev_start = (current_start - timedelta(days=1)).replace(day=1)

    rows = (
        db.query(models.Payment, models.Bill.name)
        .join(models.Bill)
        .filter(models.Payment.date_paid >= prev_start)
        .filter(models.Payment.date_paid <= today)
        .order_by(models.Payment.date_paid)
        .all()
    )

    def build_series(items):
        cumulative = 0.0
        result = []
        for payment, bill_name in items:
            cumulative += payment.amount_paid
            result.append(schemas.SpendPoint(
                day=payment.date_paid.day,
                bill=bill_name,
                amount=round(payment.amount_paid, 2),
                cumulative=round(cumulative, 2),
            ))
        return result

    prev_rows = [(p, n) for p, n in rows if p.date_paid < current_start]
    curr_rows = [(p, n) for p, n in rows if p.date_paid >= current_start]

    return schemas.SpendChartData(
        previous_month=prev_start.strftime("%B %Y"),
        current_month=current_start.strftime("%B %Y"),
        previous=build_series(prev_rows),
        current=build_series(curr_rows),
    )


@router.post("/", response_model=schemas.Bill, status_code=201)
def create_bill(payload: schemas.BillCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    if not data.get("anchor_date"):
        data["anchor_date"] = data["due_date"]
    bill = models.Bill(**data)
    db.add(bill)
    db.flush()  # get bill.id before commit
    bill.series_id = bill.id  # root of its own series
    db.commit()
    db.refresh(bill)
    return _enrich(bill)


@router.get("/{bill_id}", response_model=schemas.Bill)
def get_bill(bill_id: int, db: Session = Depends(get_db)):
    bill = db.query(models.Bill).filter(models.Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return _enrich(bill)


@router.patch("/{bill_id}", response_model=schemas.Bill)
def update_bill(bill_id: int, payload: schemas.BillUpdate, db: Session = Depends(get_db)):
    bill = db.query(models.Bill).filter(models.Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(bill, field, value)
    db.commit()
    db.refresh(bill)
    return _enrich(bill)


@router.delete("/{bill_id}", status_code=204)
def delete_bill(bill_id: int, db: Session = Depends(get_db)):
    bill = db.query(models.Bill).filter(models.Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    db.delete(bill)
    db.commit()
