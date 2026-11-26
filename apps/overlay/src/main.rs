// SPDX-License-Identifier: GPL-3.0-only
//! Capri desktop overlay for Linux (Wayland layer-shell).
//!
//!   capri-overlay [run] [--height PX] [--assets DIR] [--sleep-after SECONDS]
//!   capri-overlay send '{"cmd":"expression","id":"happy"}'
//!   capri-overlay hook        # Claude Code hook: reads the event JSON on stdin
//!   capri-overlay quit

mod overlay;
mod protocol;
mod sprites;

use protocol::{Command, socket_path};
use smithay_client_toolkit::reexports::calloop::channel;
use std::{
    io::{BufRead, BufReader, Read, Write},
    os::unix::net::{UnixListener, UnixStream},
    path::{Path, PathBuf},
    time::Duration,
};

const USAGE: &str = "\
usage: capri-overlay [run] [--height PX] [--assets DIR] [--sleep-after SECONDS]
       capri-overlay send '{\"cmd\":\"expression\",\"id\":\"happy\"}'
       capri-overlay hook   (Claude Code hook: event JSON on stdin)
       capri-overlay quit";

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let code = match args.first().map(String::as_str) {
        Some("send") => send_lines(args[1..].iter().map(String::as_str)),
        Some("quit") => send_commands(&[Command::Quit]),
        Some("hook") => hook(),
        Some("help" | "--help" | "-h") => {
            println!("{USAGE}");
            0
        }
        Some("run") => run(&args[1..]),
        _ => run(&args),
    };
    std::process::exit(code);
}

fn option(args: &[String], name: &str) -> Option<String> {
    args.iter().position(|a| a == name).and_then(|i| args.get(i + 1).cloned())
}

fn run(args: &[String]) -> i32 {
    let height = option(args, "--height").and_then(|v| v.parse().ok()).unwrap_or(260);
    let sleep_after = option(args, "--sleep-after").and_then(|v| v.parse().ok()).unwrap_or(600);
    let Some(root) = option(args, "--assets").map(PathBuf::from).or_else(find_root) else {
        eprintln!("capri-overlay: cannot find {}; pass --assets <CapriCore folder>", sprites::CATALOG);
        return 2;
    };

    let path = socket_path();
    if UnixStream::connect(&path).is_ok() {
        eprintln!("capri-overlay: already running ({})", path.display());
        return 0;
    }
    let _ = std::fs::remove_file(&path);
    let listener = match UnixListener::bind(&path) {
        Ok(listener) => listener,
        Err(e) => {
            eprintln!("capri-overlay: {}: {e}", path.display());
            return 1;
        }
    };

    let started = std::time::Instant::now();
    let set = match sprites::SpriteSet::load(&root, height) {
        Ok(set) => set,
        Err(e) => {
            eprintln!("capri-overlay: {e}");
            return 1;
        }
    };
    release_decode_memory();
    eprintln!(
        "capri-overlay: {}x{} sprites ready in {} ms; listening on {}",
        set.width,
        set.height,
        started.elapsed().as_millis(),
        path.display()
    );

    let (sender, commands) = channel::channel::<Command>();
    std::thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            let sender = sender.clone();
            std::thread::spawn(move || {
                for line in BufReader::new(stream.take(1 << 20)).lines().map_while(Result::ok) {
                    match serde_json::from_str::<Command>(&line) {
                        Ok(command) => {
                            if sender.send(command).is_err() {
                                return;
                            }
                        }
                        Err(e) => eprintln!("capri-overlay: ignored command: {e}"),
                    }
                }
            });
        }
    });

    let result = overlay::run(set, commands, overlay::Options { sleep_after: Duration::from_secs(sleep_after) });
    let _ = std::fs::remove_file(&path);
    match result {
        Ok(()) => 0,
        Err(e) => {
            eprintln!("capri-overlay: {e}");
            1
        }
    }
}

/// Full-size frames are decoded on several threads; glibc keeps those freed
/// per-thread arenas mapped unless asked to hand them back to the system.
fn release_decode_memory() {
    #[cfg(target_env = "gnu")]
    {
        unsafe extern "C" {
            fn malloc_trim(pad: usize) -> i32;
        }
        // SAFETY: malloc_trim only returns unused heap pages to the kernel.
        unsafe { malloc_trim(0) };
    }
}

/// Finds the CapriCore checkout from the executable's location or the working directory.
fn find_root() -> Option<PathBuf> {
    let candidates = std::env::var_os("CAPRI_ROOT")
        .map(PathBuf::from)
        .into_iter()
        .chain(std::env::current_exe().ok().into_iter().flat_map(ancestors))
        .chain(std::env::current_dir().ok().into_iter().flat_map(ancestors));
    candidates.into_iter().find(|dir| dir.join(sprites::CATALOG).is_file())
}

fn ancestors(path: PathBuf) -> Vec<PathBuf> {
    Path::new(&path).ancestors().map(Path::to_path_buf).collect()
}

/// Delivery is best effort: a missing overlay must never disturb the caller.
fn send_commands(commands: &[Command]) -> i32 {
    if commands.is_empty() {
        return 0;
    }
    let Ok(mut stream) = UnixStream::connect(socket_path()) else { return 0 };
    let _ = stream.set_write_timeout(Some(Duration::from_millis(250)));
    let mut text = String::new();
    for command in commands {
        text.push_str(&serde_json::to_string(command).unwrap());
        text.push('\n');
    }
    let _ = stream.write_all(text.as_bytes());
    0
}

fn send_lines<'a>(lines: impl Iterator<Item = &'a str>) -> i32 {
    let mut commands = Vec::new();
    for line in lines {
        match serde_json::from_str::<Command>(line) {
            Ok(command) => commands.push(command),
            Err(e) => {
                eprintln!("capri-overlay: invalid command {line}: {e}");
                return 2;
            }
        }
    }
    send_commands(&commands)
}

fn hook() -> i32 {
    let mut input = String::new();
    if std::io::stdin().take(4 << 20).read_to_string(&mut input).is_err() {
        return 0;
    }
    match serde_json::from_str(&input) {
        Ok(event) => send_commands(&protocol::from_claude_hook(&event)),
        Err(_) => 0,
    }
}
