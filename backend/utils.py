from datetime import date
from dateutil.relativedelta import relativedelta
from models import Frequency


def next_due_date(anchor: date, frequency: Frequency) -> date | None:
    """Calculate the next due date from an anchor date based on frequency."""
    if frequency == Frequency.once:
        return None
    if frequency == Frequency.fortnightly:
        return anchor + relativedelta(days=14)
    if frequency == Frequency.monthly:
        return anchor + relativedelta(months=1)
    if frequency == Frequency.quarterly:
        return anchor + relativedelta(months=3)
    if frequency == Frequency.six_monthly:
        return anchor + relativedelta(months=6)
    if frequency == Frequency.annually:
        return anchor + relativedelta(years=1)
    return None
