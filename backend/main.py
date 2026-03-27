from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
import models  # noqa: F401 — ensures all models are registered before create_all

from routers import accounts, bills, payments, money_aside, reconciliation

# Create all tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(title="BillTracker API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(accounts.router)
app.include_router(bills.router)
app.include_router(payments.router)
app.include_router(money_aside.router)
app.include_router(reconciliation.router)


@app.get("/health")
def health():
    return {"status": "ok"}
