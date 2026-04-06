from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import extract
from sqlalchemy.orm import Session
from database import get_db
from utils import next_due_date
from models import Frequency
import models, schemas

router = APIRouter(prefix="/payments", tags=["payments"])

SHORT_CYCLE = {Frequency.fortnightly}


def _make_bill(bill, due_date):
    return models.Bill(
        name=bill.name,
        estimated_amount=bill.estimated_amount,
        due_date=due_date,
        payment_type=bill.payment_type,
        account_id=bill.account_id,
        frequency=bill.frequency,
        anchor_date=due_date,
        series_id=bill.series_id or bill.id,
        is_active=True,
    )


def _spawn_next(bill, payment_date, db):
    """Create the next bill instance(s) after a payment."""
    ndd = next_due_date(payment_date, bill.frequency)
    if ndd is None:
        return  # once-off

    series_id = bill.series_id or bill.id

    if bill.frequency in SHORT_CYCLE:
        # For weekly/fortnightly: generate all occurrences in the target month,
        # but only if none from this series already exist there.
        target_month, target_year = ndd.month, ndd.year
        existing = (
            db.query(models.Bill)
            .filter(
                models.Bill.series_id == series_id,
                extract("year", models.Bill.due_date) == target_year,
                extract("month", models.Bill.due_date) == target_month,
            )
            .count()
        )
        if existing > 0:
            return  # mid-series payment, next month already populated

        current = ndd
        while current.month == target_month and current.year == target_year:
            db.add(_make_bill(bill, current))
            current = next_due_date(current, bill.frequency)
    else:
        # Monthly, quarterly, etc. — one next bill
        db.add(_make_bill(bill, ndd))


@router.get("/", response_model=list[schemas.Payment])
def list_payments(bill_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(models.Payment)
    if bill_id:
        q = q.filter(models.Payment.bill_id == bill_id)
    return q.order_by(models.Payment.date_paid.desc()).all()


@router.post("/", response_model=schemas.Payment, status_code=201)
def record_payment(payload: schemas.PaymentCreate, db: Session = Depends(get_db)):
    bill = db.query(models.Bill).filter(models.Bill.id == payload.bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    ndd = next_due_date(payload.date_paid, bill.frequency)
    payment = models.Payment(**payload.model_dump(), next_due_date=ndd)
    db.add(payment)

    # Clear money-aside entries for this bill — the money has now left the account
    db.query(models.MoneyAside).filter(models.MoneyAside.bill_id == payload.bill_id).delete()

    _spawn_next(bill, payload.date_paid, db)

    db.commit()
    db.refresh(payment)
    return payment


@router.delete("/{payment_id}", status_code=204)
def delete_payment(payment_id: int, db: Session = Depends(get_db)):
    payment = db.query(models.Payment).filter(models.Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    db.delete(payment)
    db.commit()
