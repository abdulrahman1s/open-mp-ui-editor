use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Definition {
    pub format: String,
    pub version: u32,
    pub name: String,
    pub elements: Vec<Element>,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Kind {
    Text,
    Rect,
    Sprite,
    Model,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Element {
    pub id: String,
    pub kind: Kind,
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
    #[serde(default)]
    pub text: String,
    #[serde(default = "white")]
    pub color: String,
    #[serde(default = "one_u8")]
    pub font: u8,
    #[serde(default = "sx")]
    pub sx: f32,
    #[serde(default = "one")]
    pub sy: f32,
    #[serde(default)]
    pub outline: u8,
    #[serde(default)]
    pub selectable: bool,
    #[serde(default = "yes")]
    pub enabled: bool,
    #[serde(default = "yes")]
    pub visible: bool,
    #[serde(default)]
    pub model: u16,
}
fn white() -> String {
    "#FFFFFFFF".into()
}
fn one_u8() -> u8 {
    1
}
fn one() -> f32 {
    1.0
}
fn sx() -> f32 {
    0.2
}
fn yes() -> bool {
    true
}

#[derive(Clone, Debug, PartialEq)]
pub struct Click {
    pub owner: usize,
    pub player: i32,
    pub definition: i32,
    pub instance: i32,
    pub element: String,
}

pub(crate) struct Loaded {
    pub owner: usize,
    pub definition: Definition,
}
pub(crate) struct Instance {
    pub owner: usize,
    pub player: i32,
    pub definition: i32,
    pub shown: bool,
    pub elements: Vec<Element>,
    pub handles: Vec<i32>,
}
#[derive(Default)]
pub struct Runtime {
    pub(crate) next: i32,
    pub(crate) definitions: BTreeMap<i32, Loaded>,
    pub(crate) instances: BTreeMap<i32, Instance>,
    pub(crate) focused: BTreeMap<i32, i32>,
    pub(crate) error: String,
}

/// Synchronous SDK command; text is borrowed only for the duration of one call.
#[repr(C)]
pub struct RenderCommand {
    pub kind: i32,
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
    pub sx: f32,
    pub sy: f32,
    pub color: u32,
    pub font: i32,
    pub outline: i32,
    pub model: i32,
    pub selectable: i32,
    pub text: *const u8,
    pub length: usize,
}
pub struct Engine;
