use crate::{Definition, Element, Kind};
use std::collections::BTreeSet;

pub const MAX_FILE: usize = 256 * 1024;
pub const MAX_ELEMENTS: usize = 128;
pub const MAX_TEXT: usize = 512;

pub fn identifier(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 64
        && value
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || b"_.-".contains(&c))
        && value.as_bytes()[0].is_ascii_alphabetic()
}
pub fn color(value: &str) -> Option<u32> {
    (value.len() == 9 && value.starts_with('#'))
        .then(|| u32::from_str_radix(&value[1..], 16).ok())
        .flatten()
}
pub fn element(e: &Element) -> Result<(), String> {
    let fail = |s: &str| Err(format!("element '{}': {s}", e.id));
    if !identifier(&e.id) {
        return fail("ID must start with a letter, then use 1–64 ASCII letters, digits, _, . or -");
    }
    if ![e.x, e.y, e.w, e.h, e.sx, e.sy]
        .iter()
        .all(|v| v.is_finite())
    {
        return fail("non-finite geometry");
    }
    if e.x < 0.0
        || e.y < 0.0
        || e.w <= 0.0
        || e.h <= 0.0
        || e.x + e.w > 640.01
        || e.y + e.h > 448.01
    {
        return fail("bounds must fit the 640 x 448 client projection");
    }
    if color(&e.color).is_none() {
        return fail("color must be #RRGGBBAA");
    }
    if e.font > 3
        || !(0.01..=4.0).contains(&e.sx)
        || !(0.01..=10.0).contains(&e.sy)
        || e.outline > 8
    {
        return fail("invalid typography");
    }
    if e.text.len() > MAX_TEXT
        || !e.text.is_ascii()
        || e.text.bytes().any(|c| !(32..127).contains(&c))
    {
        return fail(
            "text must contain at most 512 printable ASCII bytes; split lines into elements",
        );
    }
    if e.kind == Kind::Sprite {
        let mut parts = e.text.split(':');
        if !parts.next().is_some_and(|p| {
            !p.is_empty() && p.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_')
        }) || !parts.next().is_some_and(|p| {
            !p.is_empty() && p.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_')
        }) || parts.next().is_some()
            || e.text.len() > 96
        {
            return fail("sprite uses library:texture (96 bytes maximum)");
        }
    }
    if e.kind == Kind::Text && (e.text.is_empty() || e.text.contains(['~', '%', '{', '}'])) {
        return fail("text must be nonempty plain text without ~ % { }");
    }
    if e.kind == Kind::Model && e.model > 20000 {
        return fail("model must be 0..20000");
    }
    Ok(())
}
pub fn parse(bytes: &[u8]) -> Result<Definition, String> {
    if bytes.len() > MAX_FILE {
        return Err("UI exceeds 256 KiB".into());
    }
    let definition: Definition =
        serde_json::from_slice(bytes).map_err(|e| format!("invalid UI JSON: {e}"))?;
    if definition.format != "open-mp-ui" || definition.version != 1 {
        return Err("expected open-mp-ui format version 1".into());
    }
    if !identifier(&definition.name) {
        return Err("invalid UI name".into());
    }
    if definition.elements.is_empty() || definition.elements.len() > MAX_ELEMENTS {
        return Err("UI must contain 1..128 primitives".into());
    }
    let mut ids = BTreeSet::new();
    for e in &definition.elements {
        element(e)?;
        if !ids.insert(&e.id) {
            return Err(format!("duplicate element ID '{}'", e.id));
        }
    }
    Ok(definition)
}
