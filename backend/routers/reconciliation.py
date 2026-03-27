from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models, schemas

router = APIRouter(prefix="/reconciliations", tags=["reconciliations"])


@router.get("/", response_model=list[schemas.Reconciliation])
def list_reconciliations(account_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(models.Reconciliation)
    if account_id:
        q = q.filter(models.Reconciliation.account_id == account_id)
    return q.order_by(models.Reconciliation.checked_at.desc()).all()


@router.post("/", response_model=schemas.Reconciliation, status_code=201)
def create_reconciliation(payload: schemas.ReconciliationCreate, db: Session = Depends(get_db)):
    account = db.query(models.Account).filter(models.Account.id == payload.account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # System total = sum of all money aside entries for this account
    system_total = sum(
        m.amount
        for m in db.query(models.MoneyAside)
        .filter(models.MoneyAside.account_id == payload.account_id)
        .all()
    )

    difference = payload.bank_balance - system_total

    rec = models.Reconciliation(
        account_id=payload.account_id,
        bank_balance=payload.bank_balance,
        system_total=system_total,
        difference=difference,
        notes=payload.notes,
    )
    db.add(rec)

    # Update the account's stored balance to match the reconciled bank balance
    account.current_balance = payload.bank_balance

    db.commit()
    db.refresh(rec)
    return rec


@router.get("/{rec_id}", response_model=schemas.Reconciliation)
def get_reconciliation(rec_id: int, db: Session = Depends(get_db)):
    rec = db.query(models.Reconciliation).filter(models.Reconciliation.id == rec_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Reconciliation not found")
    return rec
