from contextvars import ContextVar
from dataclasses import dataclass, field
from threading import Event


@dataclass
class TaskProgress:
    outputs: int = 0
    warnings: int = 0
    cancel_event: Event = field(default_factory=Event)

    def check_cancelled(self):
        if self.cancel_event.is_set():
            raise TaskCancelled()


current_task = ContextVar("current_task", default=None)


class TaskCancelled(Exception):
    """The user dismissed an interactive task prompt."""


def check_cancelled():
    task = current_task.get()
    if task is not None:
        task.check_cancelled()
