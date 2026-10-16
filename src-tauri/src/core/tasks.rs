use std::cell::RefCell;
use std::fmt;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TaskError {
    Cancelled,
    Message(String),
}

impl fmt::Display for TaskError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            TaskError::Cancelled => write!(f, "Task cancelled"),
            TaskError::Message(msg) => write!(f, "{}", msg),
        }
    }
}

impl std::error::Error for TaskError {}

#[derive(Debug, Default)]
pub struct TaskProgress {
    pub outputs: AtomicUsize,
    pub warnings: AtomicUsize,
    pub cancel_event: AtomicBool,
}

impl TaskProgress {
    pub fn new() -> Arc<Self> {
        Arc::new(Self::default())
    }

    pub fn cancel(&self) {
        self.cancel_event.store(true, Ordering::SeqCst);
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancel_event.load(Ordering::SeqCst)
    }

    pub fn check_cancelled(&self) -> Result<(), TaskError> {
        if self.is_cancelled() {
            Err(TaskError::Cancelled)
        } else {
            Ok(())
        }
    }

    pub fn add_output(&self, count: usize) {
        self.outputs.fetch_add(count, Ordering::SeqCst);
    }

    pub fn add_warning(&self, count: usize) {
        self.warnings.fetch_add(count, Ordering::SeqCst);
    }

    pub fn outputs(&self) -> usize {
        self.outputs.load(Ordering::SeqCst)
    }

    pub fn warnings(&self) -> usize {
        self.warnings.load(Ordering::SeqCst)
    }
}

thread_local! {
    static CURRENT_TASK: RefCell<Option<Arc<TaskProgress>>> = const { RefCell::new(None) };
}

pub fn set_current_task(task: Option<Arc<TaskProgress>>) -> Option<Arc<TaskProgress>> {
    CURRENT_TASK.with(|cell| cell.replace(task))
}

pub fn current_task() -> Option<Arc<TaskProgress>> {
    CURRENT_TASK.with(|cell| cell.borrow().clone())
}

pub fn with_task<F, R>(task: Arc<TaskProgress>, f: F) -> R
where
    F: FnOnce() -> R,
{
    let prev = set_current_task(Some(task));
    struct Guard(Option<Arc<TaskProgress>>);
    impl Drop for Guard {
        fn drop(&mut self) {
            set_current_task(self.0.take());
        }
    }
    let _guard = Guard(prev);
    f()
}

pub fn check_cancelled() -> Result<(), TaskError> {
    if let Some(task) = current_task() {
        task.check_cancelled()?;
    }
    Ok(())
}
