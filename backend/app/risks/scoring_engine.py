from typing import Tuple
from fastapi import HTTPException, status

LIKELIHOOD_LABELS = {
    1: "Rare",
    2: "Unlikely",
    3: "Possible",
    4: "Likely",
    5: "Almost Certain",
}

IMPACT_LABELS = {
    1: "Insignificant",
    2: "Minor",
    3: "Moderate",
    4: "Major",
    5: "Severe",
}

def validate_rating(val: int, field_name: str) -> None:
    if not isinstance(val, int) or val < 1 or val > 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {field_name}: '{val}'. Must be an integer between 1 and 5."
        )

def calculate_risk_score(likelihood: int, impact: int) -> Tuple[int, str]:
    """
    Authoritative server-side Risk Score calculation:
    Risk Score = Likelihood × Impact (range 1-25)
    Level mapping:
      1–4   -> LOW
      5–9   -> MEDIUM
      10–16 -> HIGH
      17–25 -> CRITICAL
    """
    validate_rating(likelihood, "likelihood")
    validate_rating(impact, "impact")

    score = likelihood * impact

    if 1 <= score <= 4:
        level = "LOW"
    elif 5 <= score <= 9:
        level = "MEDIUM"
    elif 10 <= score <= 16:
        level = "HIGH"
    elif 17 <= score <= 25:
        level = "CRITICAL"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Calculated score '{score}' out of bounds (1-25)."
        )

    return score, level
