use crate::structures::{Instance, Loaded};
use crate::{validation, Click, Element, Host, Runtime};
use std::io::Read;
use std::path::{Component, Path};

impl Runtime {
    pub fn last_error(&self) -> &str {
        &self.error
    }
    pub fn fail<T>(&mut self, message: impl Into<String>) -> Result<T, String> {
        self.error = message.into();
        Err(self.error.clone())
    }
    fn id(&mut self) -> Result<i32, String> {
        self.next = self
            .next
            .checked_add(1)
            .ok_or("handle space exhausted; restart required")?;
        Ok(self.next)
    }
    /// Resolve beneath scriptfiles/ui; reject absolute paths, traversal and escaping symlinks.
    pub fn load(&mut self, owner: usize, root: &Path, file: &str) -> Result<i32, String> {
        let path = Path::new(file);
        if file.len() > 128
            || file.contains(['\\', ':'])
            || path.extension().and_then(|x| x.to_str()) != Some("json")
            || path
                .components()
                .any(|c| !matches!(c, Component::Normal(_)))
        {
            return self.fail("UI filename must be a relative .json path within scriptfiles/ui");
        }
        let result = (|| {
            let root = root
                .canonicalize()
                .map_err(|_| "create scriptfiles/ui and copy exported JSON there")?;
            let path = root
                .join(path)
                .canonicalize()
                .map_err(|_| "UI file not found")?;
            if !path.starts_with(&root) {
                return Err("UI path escapes scriptfiles/ui".to_owned());
            }
            let file = std::fs::File::open(path).map_err(|_| "cannot open UI file")?;
            if !file
                .metadata()
                .map_err(|_| "cannot read UI metadata")?
                .is_file()
            {
                return Err("UI path is not a regular file".into());
            }
            let mut bytes = Vec::new();
            file.take(validation::MAX_FILE as u64 + 1)
                .read_to_end(&mut bytes)
                .map_err(|_| "cannot read UI file")?;
            Ok(bytes)
        })();
        match result {
            Ok(bytes) => self.load_json(owner, &bytes),
            Err(e) => self.fail(e),
        }
    }
    pub fn load_json(&mut self, owner: usize, bytes: &[u8]) -> Result<i32, String> {
        if self.definitions.len() >= 256 {
            return self.fail("256 loaded definition limit reached");
        }
        let definition = match validation::parse(bytes) {
            Ok(d) => d,
            Err(e) => return self.fail(e),
        };
        let id = self.id()?;
        self.definitions.insert(id, Loaded { owner, definition });
        self.error.clear();
        Ok(id)
    }
    pub fn show(
        &mut self,
        host: &dyn Host,
        owner: usize,
        player: i32,
        definition: i32,
    ) -> Result<i32, String> {
        if !(0..1000).contains(&player) || !host.connected(player) {
            return self.fail("player is not connected");
        }
        let Some(loaded) = self
            .definitions
            .get(&definition)
            .filter(|d| d.owner == owner)
        else {
            return self.fail("invalid UI definition or wrong script owner");
        };
        let count = self
            .instances
            .values()
            .filter(|i| i.player == player)
            .count();
        let used: usize = self
            .instances
            .values()
            .filter(|i| i.player == player)
            .map(|i| i.handles.len())
            .sum();
        if count >= 8 || used + loaded.definition.elements.len() > 256 {
            return self.fail("player instance/textdraw budget exceeded (8 / 256)");
        }
        let elements = loaded.definition.elements.clone();
        let id = self.id()?;
        let mut handles = Vec::new();
        for e in &elements {
            let Some(handle) = host.create(player, e) else {
                for handle in handles {
                    host.destroy(player, handle);
                }
                return self.fail("player textdraw allocation failed; partial instance released (other scripts share the 256 limit)");
            };
            handles.push(handle);
        }
        for (&handle, e) in handles.iter().zip(&elements) {
            if !host.apply(player, handle, e, true) {
                for &h in &handles {
                    host.destroy(player, h);
                }
                return self.fail("textdraw configuration failed; instance released");
            }
        }
        self.instances.insert(
            id,
            Instance {
                owner,
                player,
                definition,
                shown: true,
                elements,
                handles,
            },
        );
        self.error.clear();
        Ok(id)
    }
    fn instance(&self, owner: usize, player: i32, id: i32) -> Option<&Instance> {
        self.instances
            .get(&id)
            .filter(|i| i.owner == owner && i.player == player)
    }
    pub fn visible(
        &mut self,
        host: &dyn Host,
        owner: usize,
        player: i32,
        id: i32,
        visible: bool,
    ) -> Result<(), String> {
        let Some(i) = self.instance(owner, player, id) else {
            return self.fail("invalid instance/player/owner");
        };
        if i.shown == visible {
            return Ok(());
        }
        for (&h, e) in i.handles.iter().zip(&i.elements) {
            if !host.apply(player, h, e, visible) {
                return self.fail("textdraw no longer exists");
            }
        }
        self.instances.get_mut(&id).unwrap().shown = visible;
        if !visible && self.focused.get(&player) == Some(&id) {
            self.focused.remove(&player);
            host.select(player, false, 0);
        }
        Ok(())
    }
    /// Update one owned element atomically; unchanged values produce no network calls.
    pub fn update(
        &mut self,
        host: &dyn Host,
        owner: usize,
        player: i32,
        id: i32,
        element: &str,
        change: impl FnOnce(&mut Element),
    ) -> Result<(), String> {
        let Some(i) = self.instance(owner, player, id) else {
            return self.fail("invalid instance/player/owner");
        };
        let Some(index) = i.elements.iter().position(|e| e.id == element) else {
            return self.fail("element ID not found");
        };
        let mut next = i.elements[index].clone();
        change(&mut next);
        if let Err(e) = validation::element(&next) {
            return self.fail(e);
        }
        if next == i.elements[index] {
            return Ok(());
        }
        if !host.apply(player, i.handles[index], &next, i.shown) {
            return self.fail("textdraw update failed");
        }
        self.instances.get_mut(&id).unwrap().elements[index] = next;
        Ok(())
    }
    pub fn select(
        &mut self,
        host: &dyn Host,
        owner: usize,
        player: i32,
        id: i32,
        color: u32,
    ) -> Result<(), String> {
        let Some(i) = self.instance(owner, player, id) else {
            return self.fail("invalid instance/player/owner");
        };
        if !i.shown
            || !i
                .elements
                .iter()
                .any(|e| e.visible && e.enabled && e.selectable)
        {
            return self.fail("show an instance with enabled selectable elements before selecting");
        }
        if self.focused.get(&player) == Some(&id) {
            return Ok(());
        }
        self.focused.insert(player, id);
        host.select(player, true, color);
        Ok(())
    }
    pub fn click(&self, player: i32, handle: i32) -> Option<Click> {
        let id = *self.focused.get(&player)?;
        let i = self.instances.get(&id)?;
        if !i.shown {
            return None;
        }
        let index = i.handles.iter().position(|&h| h == handle)?;
        let e = &i.elements[index];
        (e.visible && e.enabled && e.selectable).then(|| Click {
            owner: i.owner,
            player,
            definition: i.definition,
            instance: id,
            element: e.id.clone(),
        })
    }
    /// Cancellation consumes focus before calling Pawn, so callbacks may safely show/select another UI.
    pub fn cancel(&mut self, player: i32) -> Option<(usize, i32)> {
        let id = self.focused.remove(&player)?;
        Some((self.instances.get(&id)?.owner, id))
    }
    pub fn destroy(
        &mut self,
        host: &dyn Host,
        owner: usize,
        player: i32,
        id: i32,
    ) -> Result<(), String> {
        if self.instance(owner, player, id).is_none() {
            return self.fail("invalid instance/player/owner");
        }
        let i = self.instances.remove(&id).unwrap();
        if self.focused.get(&player) == Some(&id) {
            self.focused.remove(&player);
            host.select(player, false, 0);
        }
        for h in i.handles {
            host.destroy(player, h);
        }
        Ok(())
    }
    pub fn unload(&mut self, host: &dyn Host, owner: usize, definition: i32) -> Result<(), String> {
        if self
            .definitions
            .get(&definition)
            .is_none_or(|d| d.owner != owner)
        {
            return self.fail("invalid UI definition or wrong script owner");
        }
        let ids: Vec<_> = self
            .instances
            .iter()
            .filter(|(_, i)| i.definition == definition)
            .map(|(&id, i)| (id, i.player))
            .collect();
        for (id, p) in ids {
            self.destroy(host, owner, p, id)?;
        }
        self.definitions.remove(&definition);
        Ok(())
    }
    pub fn disconnect(&mut self, host: &dyn Host, player: i32) {
        let ids: Vec<_> = self
            .instances
            .iter()
            .filter(|(_, i)| i.player == player)
            .map(|(&id, i)| (id, i.owner))
            .collect();
        for (id, owner) in ids {
            let _ = self.destroy(host, owner, player, id);
        }
    }
    pub fn unload_owner(&mut self, host: &dyn Host, owner: usize) {
        let ids: Vec<_> = self
            .definitions
            .iter()
            .filter(|(_, d)| d.owner == owner)
            .map(|(&id, _)| id)
            .collect();
        for id in ids {
            let _ = self.unload(host, owner, id);
        }
    }
    pub fn clear(&mut self, host: &dyn Host) {
        let owners: Vec<_> = self.definitions.values().map(|d| d.owner).collect();
        for owner in owners {
            self.unload_owner(host, owner);
        }
    }
    pub fn element_id(&self, owner: usize, definition: i32, index: usize) -> Option<&str> {
        self.definitions
            .get(&definition)
            .filter(|d| d.owner == owner)?
            .definition
            .elements
            .get(index)
            .map(|e| e.id.as_str())
    }
    pub fn element_count(&self, owner: usize, definition: i32) -> usize {
        self.definitions
            .get(&definition)
            .filter(|d| d.owner == owner)
            .map_or(0, |d| d.definition.elements.len())
    }
}
