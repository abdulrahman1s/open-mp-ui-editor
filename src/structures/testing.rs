use open_mp_ui_runtime::Element;
use std::cell::{Cell, RefCell};
use std::collections::BTreeMap;
pub struct Engine {
    pub next: Cell<i32>,
    pub resources: RefCell<BTreeMap<(i32, i32), Element>>,
    pub updates: Cell<usize>,
    pub fail_after: Cell<Option<usize>>,
}
