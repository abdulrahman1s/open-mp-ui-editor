//! The runtime interface is shared by the SDK adapter, validator and tests.
#[cfg(not(test))]
#[path = "../plugin/ffi.rs"]
mod ffi;
mod runtime;
pub mod structures;
pub mod validation;
pub use structures::{Click, Definition, Element, Kind, Runtime};

/// Calls are synchronous on the open.mp main thread. The host owns native IDs;
/// the runtime exclusively owns and releases the IDs it successfully allocates.
pub trait Host {
    fn connected(&self, player: i32) -> bool;
    fn create(&self, player: i32, element: &Element) -> Option<i32>;
    fn apply(&self, player: i32, handle: i32, element: &Element, shown: bool) -> bool;
    fn destroy(&self, player: i32, handle: i32);
    fn select(&self, player: i32, enabled: bool, color: u32);
}
