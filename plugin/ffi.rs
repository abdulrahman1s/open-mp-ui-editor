//! Raw pointers are confined to this synchronous component adapter.
use crate::structures::{Engine, RenderCommand};
use crate::{validation, Element, Host, Kind, Runtime};
use std::cell::RefCell;
use std::path::Path;
thread_local! { static RUNTIME: RefCell<Runtime> = RefCell::new(Runtime::default()); }
extern "C" {
    fn ui_host_connected(player: i32) -> bool;
    fn ui_host_create(player: i32, command: *const RenderCommand) -> i32;
    fn ui_host_apply(player: i32, handle: i32, command: *const RenderCommand, shown: bool) -> bool;
    fn ui_host_destroy(player: i32, handle: i32);
    fn ui_host_select(player: i32, enabled: bool, color: u32);
}
fn command(e: &Element) -> RenderCommand {
    RenderCommand {
        kind: match e.kind {
            Kind::Text => 0,
            Kind::Rect => 1,
            Kind::Sprite => 2,
            Kind::Model => 3,
        },
        x: e.x,
        y: e.y,
        w: e.w,
        h: e.h,
        sx: e.sx,
        sy: e.sy,
        color: validation::color(&e.color).unwrap_or(0),
        font: e.font.into(),
        outline: e.outline.into(),
        model: e.model.into(),
        selectable: i32::from(e.selectable && e.enabled && e.visible),
        text: e.text.as_ptr(),
        length: e.text.len(),
    }
}
impl Host for Engine {
    fn connected(&self, p: i32) -> bool {
        unsafe { ui_host_connected(p) }
    }
    fn create(&self, p: i32, e: &Element) -> Option<i32> {
        let h = unsafe { ui_host_create(p, &command(e)) };
        (h >= 0).then_some(h)
    }
    fn apply(&self, p: i32, h: i32, e: &Element, shown: bool) -> bool {
        unsafe { ui_host_apply(p, h, &command(e), shown && e.visible) }
    }
    fn destroy(&self, p: i32, h: i32) {
        unsafe { ui_host_destroy(p, h) }
    }
    fn select(&self, p: i32, enabled: bool, color: u32) {
        unsafe { ui_host_select(p, enabled, color) }
    }
}
fn run(f: impl FnOnce(&mut Runtime) -> Result<i32, String>) -> i32 {
    RUNTIME.with(|r| match r.try_borrow_mut() {
        Ok(mut r) => f(&mut r).unwrap_or(0),
        Err(_) => 0,
    })
}
unsafe fn text<'a>(p: *const u8, len: usize, max: usize) -> Option<&'a str> {
    if len > max || p.is_null() {
        return None;
    }
    std::str::from_utf8(unsafe { std::slice::from_raw_parts(p, len) }).ok()
}
unsafe fn output(value: &str, out: *mut u8, size: usize) -> i32 {
    if out.is_null() || size == 0 || size > 4096 {
        return 0;
    }
    let count = value.len().min(size - 1);
    unsafe {
        std::ptr::copy_nonoverlapping(value.as_ptr(), out, count);
        *out.add(count) = 0;
    }
    count as i32
}
#[no_mangle]
pub unsafe extern "C" fn ui_load(owner: usize, path: *const u8, len: usize) -> i32 {
    let Some(path) = (unsafe { text(path, len, 128) }) else {
        return 0;
    };
    run(|r| r.load(owner, Path::new("scriptfiles/ui"), path))
}
#[no_mangle]
pub extern "C" fn ui_show(owner: usize, player: i32, definition: i32) -> i32 {
    run(|r| r.show(&Engine, owner, player, definition))
}
#[no_mangle]
pub extern "C" fn ui_visible(owner: usize, player: i32, instance: i32, shown: bool) -> i32 {
    run(|r| {
        r.visible(&Engine, owner, player, instance, shown)
            .map(|_| 1)
    })
}
#[no_mangle]
pub extern "C" fn ui_destroy(owner: usize, player: i32, instance: i32) -> i32 {
    run(|r| r.destroy(&Engine, owner, player, instance).map(|_| 1))
}
#[no_mangle]
pub extern "C" fn ui_unload(owner: usize, definition: i32) -> i32 {
    run(|r| r.unload(&Engine, owner, definition).map(|_| 1))
}
#[no_mangle]
pub extern "C" fn ui_select(owner: usize, player: i32, instance: i32, color: u32) -> i32 {
    run(|r| r.select(&Engine, owner, player, instance, color).map(|_| 1))
}
#[no_mangle]
pub unsafe extern "C" fn ui_update(
    owner: usize,
    player: i32,
    instance: i32,
    key: *const u8,
    keylen: usize,
    property: i32,
    value: *const u8,
    len: usize,
    a: f32,
    b: f32,
    c: f32,
    d: f32,
) -> i32 {
    let Some(key) = (unsafe { text(key, keylen, 64) }) else {
        return 0;
    };
    let Some(value) = (unsafe { text(value, len, 512) }) else {
        return 0;
    };
    run(|r| {
        if !(0..=5).contains(&property) {
            return r.fail("unsupported property");
        }
        r.update(&Engine, owner, player, instance, key, |e| match property {
            0 => e.text = value.to_owned(),
            1 => e.color = value.to_owned(),
            2 => {
                e.x = a;
                e.y = b;
                e.w = c;
                e.h = d;
            }
            3 => e.enabled = a != 0.0,
            4 => e.visible = a != 0.0,
            5 => e.selectable = a != 0.0,
            _ => {}
        })
        .map(|_| 1)
    })
}
#[no_mangle]
pub unsafe extern "C" fn ui_error(out: *mut u8, size: usize) -> i32 {
    RUNTIME.with(|r| unsafe { output(r.borrow().last_error(), out, size) })
}
#[no_mangle]
pub unsafe extern "C" fn ui_element_id(
    owner: usize,
    definition: i32,
    index: i32,
    out: *mut u8,
    size: usize,
) -> i32 {
    RUNTIME.with(|r| {
        let r = r.borrow();
        let Some(id) = usize::try_from(index)
            .ok()
            .and_then(|i| r.element_id(owner, definition, i))
        else {
            return 0;
        };
        unsafe { output(id, out, size) }
    })
}
#[no_mangle]
pub extern "C" fn ui_element_count(owner: usize, definition: i32) -> i32 {
    RUNTIME.with(|r| r.borrow().element_count(owner, definition) as i32)
}
#[no_mangle]
pub extern "C" fn ui_disconnect(player: i32) {
    let _ = run(|r| {
        r.disconnect(&Engine, player);
        Ok(1)
    });
}
#[no_mangle]
pub extern "C" fn ui_owner_unload(owner: usize) {
    let _ = run(|r| {
        r.unload_owner(&Engine, owner);
        Ok(1)
    });
}
#[no_mangle]
pub extern "C" fn ui_clear() {
    let _ = run(|r| {
        r.clear(&Engine);
        Ok(1)
    });
}
// Callback data is copied out before the SDK enters Pawn (which may reenter any native).
#[no_mangle]
pub unsafe extern "C" fn ui_click(
    player: i32,
    handle: i32,
    owner: *mut usize,
    definition: *mut i32,
    instance: *mut i32,
    out: *mut u8,
    size: usize,
) -> bool {
    let click = RUNTIME.with(|r| r.borrow().click(player, handle));
    let Some(click) = click else {
        return false;
    };
    if owner.is_null() || definition.is_null() || instance.is_null() {
        return false;
    }
    unsafe {
        *owner = click.owner;
        *definition = click.definition;
        *instance = click.instance;
        output(&click.element, out, size);
    }
    true
}
#[no_mangle]
pub unsafe extern "C" fn ui_cancel(player: i32, owner: *mut usize, instance: *mut i32) -> bool {
    let event = RUNTIME.with(|r| r.borrow_mut().cancel(player));
    let Some((o, i)) = event else {
        return false;
    };
    if owner.is_null() || instance.is_null() {
        return false;
    }
    unsafe {
        *owner = o;
        *instance = i;
    }
    true
}
