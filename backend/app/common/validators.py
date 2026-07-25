import re

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalize_email(value: str) -> str:
    if not EMAIL_PATTERN.match(value):
        raise ValueError("Invalid email format")
    return value.lower()
