from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models, schemas

router = APIRouter(prefix="/money-aside", tags=["money-aside"])


@router.get("/", response_model=list[schemas.MoneyAside])
def list_money_aside(bill_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(models.MoneyAside)
    if bill_id:
        q = q.filter(models.MoneyAside.bill_id == bill_id)
    return q.order_by(models.MoneyAside.date_recorded.desc()).all()


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
