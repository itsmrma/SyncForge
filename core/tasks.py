from contextvars import ContextVar
from dataclasses import dataclass


@dataclass
class TaskProgress:
    outputs: int = 0
    warnings: int = 0


current_task = ContextVar("current_task", default=None)


class TaskCancelled(Exception):
    """The user dismissed an interactive task prompt."""
