from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models, schemas

router = APIRouter(prefix="/money-aside", tags=["money-aside"])


@router.get("/", response_model=list[schemas.MoneyAsideWithBill])
def list_money_aside(bill_id: int | None = None, account_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(models.MoneyAside)
    if bill_id:
        q = q.filter(models.MoneyAside.bill_id == bill_id)
    if account_id:
        q = q.filter(models.MoneyAside.account_id == account_id)
    entries = q.order_by(models.MoneyAside.date_recorded.desc()).all()
    bill_ids = {e.bill_id for e in entries}
    bills = {b.id: b.name for b in db.query(models.Bill).filter(models.Bill.id.in_(bill_ids)).all()} if bill_ids else {}
    return [
        schemas.MoneyAsideWithBill(
            id=e.id, bill_id=e.bill_id, account_id=e.account_id,
            amount=e.amount, date_recorded=e.date_recorded,
            notes=e.notes, created_at=e.created_at,
            bill_name=bills.get(e.bill_id, "Unknown"),
        )
        for e in entries
    ]


@router.post("/", response_model=schemas.MoneyAside, status_code=201)
def add_money_aside(payload: schemas.MoneyAsideCreate, db: Session = Depends(get_db)):
    bill = db.query(models.Bill).filter(models.Bill.id == payload.bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    account = db.query(models.Account).filter(models.Account.id == payload.account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    entry = models.MoneyAside(**payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=204)
def delete_money_aside(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(models.MoneyAside).filter(models.MoneyAside.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()
