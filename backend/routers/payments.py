from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from utils import next_due_date
import models, schemas

router = APIRouter(prefix="/payments", tags=["payments"])


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

    # Calculate next due date from the payment date
    ndd = next_due_date(payload.date_paid, bill.frequency)

    payment = models.Payment(
        **payload.model_dump(),
        next_due_date=ndd,
    )
    db.add(payment)

    # Update the bill's due date and anchor if recurring
    if ndd:
        bill.due_date = ndd
        bill.anchor_date = payload.date_paid

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
