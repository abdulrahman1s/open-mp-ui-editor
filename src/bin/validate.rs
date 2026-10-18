fn main() {
    let mut failed = false;
    for file in std::env::args().skip(1) {
        let result = std::fs::read(&file)
            .map_err(|e| e.to_string())
            .and_then(|b| open_mp_ui_runtime::validation::parse(&b));
        match result {
            Ok(d) => println!("{file}: {} primitives", d.elements.len()),
            Err(e) => {
                eprintln!("{file}: {e}");
                failed = true;
            }
        }
    }
    if failed {
        std::process::exit(1);
    }
}
