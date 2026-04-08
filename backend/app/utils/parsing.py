def parse_non_negative_seq(value: str | None) -> int:
    if value is None:
        return 0
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return 0
    return parsed if parsed >= 0 else 0


def parse_pty_dimension(
    value: object,
    *,
    default: int,
    min_value: int,
    max_value: int,
) -> int:
    if not isinstance(value, int) or isinstance(value, bool):
        return default
    return max(min_value, min(value, max_value))
