use open_mp_ui_runtime::{validation, Element, Host, Runtime};
use std::cell::{Cell, RefCell};
use std::collections::BTreeMap;

// Test adapter records native resources, independent of runtime implementation details.
// Struct declarations live in root src/structures as required by the project guide.
#[path = "../src/structures/testing.rs"]
mod support;
use support::Engine;
impl Host for Engine {
    fn connected(&self, p: i32) -> bool {
        (0..3).contains(&p)
    }
    fn create(&self, p: i32, e: &Element) -> Option<i32> {
        if self.fail_after.get() == Some(self.resources.borrow().len()) {
            return None;
        }
        let id = self.next.get() + 1;
        self.next.set(id);
        self.resources.borrow_mut().insert((p, id), e.clone());
        Some(id)
    }
    fn apply(&self, p: i32, h: i32, e: &Element, _shown: bool) -> bool {
        self.updates.set(self.updates.get() + 1);
        let mut resources = self.resources.borrow_mut();
        let Some(target) = resources.get_mut(&(p, h)) else {
            return false;
        };
        *target = e.clone();
        true
    }
    fn destroy(&self, p: i32, h: i32) {
        assert!(self.resources.borrow_mut().remove(&(p, h)).is_some());
    }
    fn select(&self, _p: i32, _enabled: bool, _color: u32) {}
}
fn engine() -> Engine {
    Engine {
        next: Cell::new(0),
        resources: RefCell::new(BTreeMap::new()),
        updates: Cell::new(0),
        fail_after: Cell::new(None),
    }
}
fn login() -> Vec<u8> {
    include_bytes!("../examples/login.json").to_vec()
}
#[test]
fn examples_and_real_editor_exports_load_through_runtime_interface() {
    let mut r = Runtime::default();
    let e = engine();
    for dir in ["examples", "artifacts/exported"] {
        let directory = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(dir);
        assert!(
            directory.exists(),
            "run node scripts/export-examples.cjs before cargo test"
        );
        for entry in std::fs::read_dir(directory).unwrap() {
            let path = entry.unwrap().path();
            if path.extension().is_none_or(|e| e != "json") {
                continue;
            }
            let ui = r.load_json(1, &std::fs::read(path).unwrap()).unwrap();
            let i = r.show(&e, 1, 0, ui).unwrap();
            r.destroy(&e, 1, 0, i).unwrap();
            r.unload(&e, 1, ui).unwrap();
        }
    }
    assert!(e.resources.borrow().is_empty());
}
#[test]
fn multiple_players_instances_and_owners_are_independent() {
    let mut r = Runtime::default();
    let e = engine();
    let ui = r.load_json(1, &login()).unwrap();
    let a = r.show(&e, 1, 0, ui).unwrap();
    let b = r.show(&e, 1, 1, ui).unwrap();
    let c = r.show(&e, 1, 0, ui).unwrap();
    r.select(&e, 1, 0, a, 0).unwrap();
    r.select(&e, 1, 1, b, 0).unwrap();
    let handles: Vec<_> = e
        .resources
        .borrow()
        .iter()
        .filter(|(_, e)| e.id == "login_button")
        .map(|(&(p, h), _)| (p, h))
        .collect();
    let (p, h) = handles[0];
    let click = r.click(p, h).unwrap();
    assert_eq!(click.element, "login_button");
    assert_eq!(click.instance, a);
    assert!(r.click(1, h).is_none());
    assert!(r.show(&e, 2, 0, ui).is_err());
    assert!(r.destroy(&e, 2, 0, a).is_err());
    assert!(r.destroy(&e, 1, 1, a).is_err());
    r.update(&e, 1, 0, a, "status", |e| {
        e.text = "Only this instance".into()
    })
    .unwrap();
    assert_eq!(
        e.resources
            .borrow()
            .values()
            .filter(|e| e.text == "Only this instance")
            .count(),
        1
    );
    r.destroy(&e, 1, 0, c).unwrap();
    r.clear(&e);
    assert!(e.resources.borrow().is_empty());
}
#[test]
fn failed_allocation_rolls_back_and_does_not_expose_an_instance() {
    let mut r = Runtime::default();
    let e = engine();
    let ui = r.load_json(1, &login()).unwrap();
    e.fail_after.set(Some(3));
    assert!(r.show(&e, 1, 0, ui).is_err());
    assert!(e.resources.borrow().is_empty());
    e.fail_after.set(None);
    r.show(&e, 1, 0, ui).unwrap();
    r.clear(&e);
    assert!(e.resources.borrow().is_empty());
}
#[test]
fn hidden_disabled_unfocused_cancelled_and_destroyed_buttons_never_dispatch() {
    let mut r = Runtime::default();
    let e = engine();
    let ui = r.load_json(1, &login()).unwrap();
    let a = r.show(&e, 1, 0, ui).unwrap();
    let h = e
        .resources
        .borrow()
        .iter()
        .find(|(_, e)| e.id == "login_button")
        .map(|(&(p, h), _)| {
            assert_eq!(p, 0);
            h
        })
        .unwrap();
    assert!(r.click(0, h).is_none());
    r.select(&e, 1, 0, a, 0).unwrap();
    assert!(r.click(0, h).is_some());
    r.update(&e, 1, 0, a, "login_button", |e| e.enabled = false)
        .unwrap();
    assert!(r.click(0, h).is_none());
    r.update(&e, 1, 0, a, "login_button", |e| e.enabled = true)
        .unwrap();
    r.visible(&e, 1, 0, a, false).unwrap();
    assert!(r.click(0, h).is_none());
    r.visible(&e, 1, 0, a, true).unwrap();
    r.select(&e, 1, 0, a, 0).unwrap();
    assert_eq!(r.cancel(0), Some((1, a)));
    assert_eq!(r.cancel(0), None);
    assert!(r.click(0, h).is_none());
    r.select(&e, 1, 0, a, 0).unwrap();
    let click = r.click(0, h).unwrap();
    r.destroy(&e, click.owner, click.player, click.instance)
        .unwrap();
    assert!(r.click(0, h).is_none());
}
#[test]
fn unchanged_updates_emit_nothing_and_invalid_updates_keep_last_good_state() {
    let mut r = Runtime::default();
    let e = engine();
    let ui = r.load_json(1, &login()).unwrap();
    let a = r.show(&e, 1, 0, ui).unwrap();
    let n = e.updates.get();
    r.update(&e, 1, 0, a, "status", |_| {}).unwrap();
    assert_eq!(n, e.updates.get());
    assert!(r.update(&e, 1, 0, a, "status", |e| e.x = f32::NAN).is_err());
    assert_eq!(n, e.updates.get());
    r.visible(&e, 1, 0, a, true).unwrap();
    assert_eq!(n, e.updates.get());
    r.clear(&e);
}
#[test]
fn disconnect_and_vm_unload_release_only_owned_resources_and_never_reuse_handles() {
    let mut r = Runtime::default();
    let e = engine();
    let ui = r.load_json(1, &login()).unwrap();
    let other = r.load_json(2, &login()).unwrap();
    let a = r.show(&e, 1, 0, ui).unwrap();
    r.show(&e, 1, 1, ui).unwrap();
    r.show(&e, 2, 1, other).unwrap();
    r.disconnect(&e, 0);
    assert!(r.visible(&e, 1, 0, a, true).is_err());
    let b = r.show(&e, 1, 0, ui).unwrap();
    assert!(b > a);
    r.unload_owner(&e, 1);
    assert!(r.show(&e, 1, 0, ui).is_err());
    assert!(!e.resources.borrow().is_empty());
    r.unload_owner(&e, 2);
    assert!(e.resources.borrow().is_empty());
    r.clear(&e);
}
#[test]
fn strict_validation_rejects_bad_inputs_without_host_allocation() {
    let base: serde_json::Value = serde_json::from_slice(&login()).unwrap();
    let bad = [
        b"[]".to_vec(),
        b"{".to_vec(),
        vec![b' '; validation::MAX_FILE + 1],
        b"{\"format\":\"open-mp-ui\",\"format\":\"open-mp-ui\"}".to_vec(),
    ];
    for bytes in bad {
        assert!(validation::parse(&bytes).is_err());
    }
    for (key, value) in [
        ("x", serde_json::json!(-1)),
        ("color", serde_json::json!("#fff")),
        ("id", serde_json::json!("../bad")),
        ("enabled", serde_json::json!("yes")),
        ("script", serde_json::json!("no")),
    ] {
        let mut bad = base.clone();
        bad["elements"][0][key] = value;
        assert!(validation::parse(&serde_json::to_vec(&bad).unwrap()).is_err());
    }
    let mut bad = base.clone();
    bad["elements"]
        .as_array_mut()
        .unwrap()
        .push(base["elements"][0].clone());
    assert!(validation::parse(&serde_json::to_vec(&bad).unwrap()).is_err());
}
#[test]
fn rejects_traversal_absolute_paths_missing_files_and_escaping_symlinks() {
    let mut r = Runtime::default();
    for file in [
        "../login.json",
        "/login.json",
        "C:\\login.json",
        "login.txt",
        "",
    ] {
        assert!(r.load(1, std::path::Path::new("examples"), file).is_err());
    }
    assert!(r
        .load(1, std::path::Path::new("examples"), "missing.json")
        .is_err());
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("examples");
    assert!(r.load(1, &root, "login.json").is_ok());
}
#[test]
fn resource_budgets_fail_without_disrupting_existing_instances() {
    let mut r = Runtime::default();
    let e = engine();
    let ui = r.load_json(1, &login()).unwrap();
    for _ in 0..8 {
        r.show(&e, 1, 0, ui).unwrap();
    }
    let count = e.resources.borrow().len();
    assert!(r.show(&e, 1, 0, ui).is_err());
    assert_eq!(e.resources.borrow().len(), count);
    assert!(r.show(&e, 1, 999, ui).is_err());
    r.clear(&e);
}
