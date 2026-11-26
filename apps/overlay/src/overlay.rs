// SPDX-License-Identifier: GPL-3.0-only
//! The desktop puppet: one wlr-layer-shell surface that shows Capri, blinks,
//! reacts to commands and clicks, and can be dragged. It redraws only when the
//! displayed frame changes, so an idle Capri costs no CPU or GPU time.

use crate::{
    protocol::{Command, Frame, frame},
    sprites::SpriteSet,
};
use smithay_client_toolkit::{
    compositor::{CompositorHandler, CompositorState, Region},
    output::{OutputHandler, OutputState},
    reexports::{
        calloop::{
            EventLoop, LoopHandle,
            channel::{self, Channel},
            timer::{TimeoutAction, Timer},
        },
        calloop_wayland_source::WaylandSource,
        client::{
            Connection, QueueHandle,
            globals::registry_queue_init,
            protocol::{wl_output, wl_pointer, wl_seat, wl_shm, wl_surface},
        },
        protocols::wp::cursor_shape::v1::client::wp_cursor_shape_device_v1::{
            Shape, WpCursorShapeDeviceV1,
        },
    },
    registry::{ProvidesRegistryState, RegistryState},
    registry_handlers,
    seat::{
        Capability, SeatHandler, SeatState,
        pointer::{PointerEvent, PointerEventKind, PointerHandler, cursor_shape::CursorShapeManager},
    },
    shell::{
        WaylandSurface,
        wlr_layer::{
            Anchor, KeyboardInteractivity, Layer, LayerShell, LayerShellHandler, LayerSurface,
            LayerSurfaceConfigure,
        },
    },
    shm::{Shm, ShmHandler, slot::SlotPool},
};
use std::{
    collections::VecDeque,
    path::PathBuf,
    time::{Duration, Instant, SystemTime},
};

const BTN_LEFT: u32 = 0x110;
const DRAG_THRESHOLD: f64 = 4.0;

pub struct Options {
    pub sleep_after: Duration,
}

pub fn run(sprites: SpriteSet, commands: Channel<Command>, options: Options) -> Result<(), String> {
    let conn = Connection::connect_to_env().map_err(|e| format!("Wayland: {e}"))?;
    let (globals, queue) = registry_queue_init::<App>(&conn).map_err(|e| e.to_string())?;
    let qh = queue.handle();
    let compositor = CompositorState::bind(&globals, &qh).map_err(|e| e.to_string())?;
    let layer_shell = LayerShell::bind(&globals, &qh).map_err(|_| {
        "This compositor has no wlr-layer-shell (GNOME). Run under KDE, wlroots or Hyprland."
            .to_string()
    })?;
    let shm = Shm::bind(&globals, &qh).map_err(|e| e.to_string())?;
    let cursor_shapes = CursorShapeManager::bind(&globals, &qh).ok();

    let surface = compositor.create_surface(&qh);
    let layer = layer_shell.create_layer_surface(&qh, surface, Layer::Top, Some("capri"), None);
    let (right, bottom) = load_position();
    layer.set_anchor(Anchor::BOTTOM | Anchor::RIGHT);
    layer.set_margin(0, right, bottom, 0);
    layer.set_keyboard_interactivity(KeyboardInteractivity::None);
    layer.set_size(sprites.width, sprites.height);
    layer.commit();

    let pool = SlotPool::new((sprites.width * sprites.height * 4) as usize, &shm)
        .map_err(|e| e.to_string())?;
    let mut event_loop: EventLoop<App> = EventLoop::try_new().map_err(|e| e.to_string())?;
    let handle = event_loop.handle();
    WaylandSource::new(conn.clone(), queue).insert(handle.clone()).map_err(|e| e.to_string())?;
    handle
        .insert_source(commands, |event, _, app: &mut App| {
            if let channel::Event::Msg(command) = event {
                app.command(command);
            }
        })
        .map_err(|e| e.to_string())?;

    let base = sprites.default_id.clone();
    let mut app = App {
        registry: RegistryState::new(&globals),
        seats: SeatState::new(&globals, &qh),
        outputs: OutputState::new(&globals, &qh),
        compositor,
        shm,
        pool,
        layer,
        cursor_shapes,
        pointer: None,
        cursor: None,
        handle: handle.clone(),
        sprites,
        base,
        transient: None,
        queue: VecDeque::new(),
        generation: 0,
        shown: None,
        configured: false,
        exit: false,
        margin: (right, bottom),
        press: None,
        last_activity: Instant::now(),
        sleep_after: options.sleep_after,
        random: SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).map_or(7, |d| d.as_nanos() as u64) | 1,
    };
    let first_blink = app.blink_delay();
    handle
        .insert_source(Timer::from_duration(first_blink), |_, _, app: &mut App| {
            app.blink();
            TimeoutAction::ToDuration(app.blink_delay())
        })
        .map_err(|e| e.to_string())?;
    handle
        .insert_source(Timer::from_duration(Duration::from_secs(30)), |_, _, app: &mut App| {
            app.check_idle();
            TimeoutAction::ToDuration(Duration::from_secs(30))
        })
        .map_err(|e| e.to_string())?;

    while !app.exit {
        event_loop.dispatch(None, &mut app).map_err(|e| e.to_string())?;
    }
    Ok(())
}

struct Press {
    at: (f64, f64),
    dragging: bool,
}

struct App {
    registry: RegistryState,
    seats: SeatState,
    outputs: OutputState,
    compositor: CompositorState,
    shm: Shm,
    pool: SlotPool,
    layer: LayerSurface,
    cursor_shapes: Option<CursorShapeManager>,
    pointer: Option<wl_pointer::WlPointer>,
    cursor: Option<WpCursorShapeDeviceV1>,
    handle: LoopHandle<'static, App>,
    sprites: SpriteSet,
    /// Persistent expression, shown whenever no reaction is playing.
    base: String,
    transient: Option<String>,
    queue: VecDeque<Frame>,
    generation: u64,
    shown: Option<String>,
    configured: bool,
    exit: bool,
    /// (right, bottom) margins from the anchored corner.
    margin: (i32, i32),
    press: Option<Press>,
    last_activity: Instant,
    sleep_after: Duration,
    random: u64,
}

impl App {
    fn displayed(&self) -> &str {
        self.transient.as_deref().unwrap_or(&self.base)
    }

    fn command(&mut self, command: Command) {
        self.last_activity = Instant::now();
        match command {
            Command::Expression { id } if self.sprites.contains(&id) => {
                self.base = id;
                self.cancel_reaction();
            }
            Command::Expression { id } => eprintln!("capri-overlay: unknown expression {id}"),
            Command::React { frames } => self.play(frames),
            Command::Quit => self.exit = true,
        }
    }

    fn cancel_reaction(&mut self) {
        self.generation += 1;
        self.queue.clear();
        self.transient = None;
        self.present();
    }

    fn play(&mut self, frames: Vec<Frame>) {
        let frames: VecDeque<Frame> =
            frames.into_iter().filter(|f| self.sprites.contains(&f.id)).collect();
        if frames.is_empty() {
            return;
        }
        self.generation += 1;
        self.queue = frames;
        self.step(self.generation);
    }

    fn step(&mut self, generation: u64) {
        if generation != self.generation {
            return;
        }
        match self.queue.pop_front() {
            Some(next) => {
                self.transient = Some(next.id);
                self.present();
                let timer = Timer::from_duration(Duration::from_millis(next.ms.clamp(16, 600_000)));
                let _ = self.handle.insert_source(timer, move |_, _, app: &mut App| {
                    app.step(generation);
                    TimeoutAction::Drop
                });
            }
            None => {
                self.transient = None;
                self.present();
            }
        }
    }

    fn next_random(&mut self) -> u64 {
        // xorshift64: blink timing only needs to look irregular.
        self.random ^= self.random << 13;
        self.random ^= self.random >> 7;
        self.random ^= self.random << 17;
        self.random
    }

    fn blink_delay(&mut self) -> Duration {
        Duration::from_millis(2_500 + self.next_random() % 3_500)
    }

    fn blink(&mut self) {
        // The blink frames are drawn for the neutral face only.
        if self.transient.is_none() && self.base == self.sprites.default_id {
            self.play(vec![
                frame("idle-blink_half", 50),
                frame("idle-blink_closed", 90),
                frame("idle-blink_half", 50),
            ]);
        }
    }

    fn check_idle(&mut self) {
        if self.transient.is_none()
            && self.base != "sleepy"
            && self.last_activity.elapsed() >= self.sleep_after
        {
            self.base = "sleepy".into();
            self.present();
        }
    }

    fn clicked(&mut self, y: f64) {
        self.last_activity = Instant::now();
        if self.base == "sleepy" {
            self.base = self.sprites.default_id.clone();
        }
        let reaction = if y < self.sprites.height as f64 * 0.28 {
            vec![frame("embarrassed", 1_200), frame("happy", 1_400)] // headpat
        } else {
            vec![frame("surprised", 600), frame("smirk", 1_400)]
        };
        self.play(reaction);
    }

    fn present(&mut self) {
        if !self.configured || self.shown.as_deref() == Some(self.displayed()) {
            return;
        }
        let id = self.displayed().to_string();
        let Some(sprite) = self.sprites.get(&id) else { return };
        let (w, h) = (self.sprites.width as i32, self.sprites.height as i32);
        let Ok((buffer, canvas)) = self.pool.create_buffer(w, h, w * 4, wl_shm::Format::Argb8888)
        else {
            eprintln!("capri-overlay: could not allocate a frame buffer");
            return;
        };
        // The pool may round the slot up for alignment; the frame fills its prefix.
        canvas[..sprite.pixels.len()].copy_from_slice(&sprite.pixels);
        if let Ok(region) = Region::new(&self.compositor) {
            for &(x, y, rw, rh) in &sprite.hit {
                region.add(x, y, rw, rh);
            }
            self.layer.set_input_region(Some(region.wl_region()));
        }
        let surface = self.layer.wl_surface();
        surface.damage_buffer(0, 0, w, h);
        if buffer.attach_to(surface).is_ok() {
            self.layer.commit();
            self.shown = Some(id);
        }
    }

    fn drag_to(&mut self, (dx, dy): (f64, f64)) {
        let (mut max_right, mut max_bottom) = (i32::MAX, i32::MAX);
        if let Some(info) = self.outputs.outputs().next().and_then(|o| self.outputs.info(&o)) {
            if let Some((ow, oh)) = info.logical_size {
                max_right = (ow - self.sprites.width as i32).max(0);
                max_bottom = (oh - self.sprites.height as i32).max(0);
            }
        }
        self.margin.0 = (self.margin.0 - dx.round() as i32).clamp(0, max_right);
        self.margin.1 = (self.margin.1 - dy.round() as i32).clamp(0, max_bottom);
        self.layer.set_margin(0, self.margin.0, self.margin.1, 0);
        self.layer.commit();
    }
}

fn position_file() -> Option<PathBuf> {
    let state = std::env::var_os("XDG_STATE_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".local/state")))?;
    Some(state.join("capri-overlay/position"))
}

fn load_position() -> (i32, i32) {
    position_file()
        .and_then(|path| std::fs::read_to_string(path).ok())
        .and_then(|text| {
            let mut parts = text.split_whitespace().map(str::parse::<i32>);
            Some((parts.next()?.ok()?, parts.next()?.ok()?))
        })
        .unwrap_or((32, 0))
}

fn save_position((right, bottom): (i32, i32)) {
    if let Some(path) = position_file() {
        let _ = std::fs::create_dir_all(path.parent().unwrap());
        let _ = std::fs::write(path, format!("{right} {bottom}\n"));
    }
}

impl PointerHandler for App {
    fn pointer_frame(
        &mut self,
        _: &Connection,
        _: &QueueHandle<Self>,
        _: &wl_pointer::WlPointer,
        events: &[PointerEvent],
    ) {
        for event in events {
            if &event.surface != self.layer.wl_surface() {
                continue;
            }
            match event.kind {
                PointerEventKind::Enter { serial } => {
                    if let Some(cursor) = &self.cursor {
                        cursor.set_shape(serial, Shape::Grab);
                    }
                }
                PointerEventKind::Press { button: BTN_LEFT, .. } => {
                    self.press = Some(Press { at: event.position, dragging: false });
                }
                PointerEventKind::Motion { .. } => {
                    let Some(press) = &mut self.press else { continue };
                    let delta = (event.position.0 - press.at.0, event.position.1 - press.at.1);
                    if !press.dragging && delta.0.hypot(delta.1) < DRAG_THRESHOLD {
                        continue;
                    }
                    press.dragging = true;
                    self.drag_to(delta);
                }
                PointerEventKind::Release { button: BTN_LEFT, .. } => match self.press.take() {
                    Some(Press { dragging: true, .. }) => save_position(self.margin),
                    Some(Press { at, .. }) => self.clicked(at.1),
                    None => {}
                },
                _ => {}
            }
        }
    }
}

impl LayerShellHandler for App {
    fn closed(&mut self, _: &Connection, _: &QueueHandle<Self>, _: &LayerSurface) {
        self.exit = true;
    }

    fn configure(
        &mut self,
        _: &Connection,
        _: &QueueHandle<Self>,
        _: &LayerSurface,
        _: LayerSurfaceConfigure,
        _: u32,
    ) {
        if !self.configured {
            self.configured = true;
            self.present();
        }
    }
}

impl SeatHandler for App {
    fn seat_state(&mut self) -> &mut SeatState {
        &mut self.seats
    }

    fn new_seat(&mut self, _: &Connection, _: &QueueHandle<Self>, _: wl_seat::WlSeat) {}

    fn new_capability(
        &mut self,
        _: &Connection,
        qh: &QueueHandle<Self>,
        seat: wl_seat::WlSeat,
        capability: Capability,
    ) {
        if capability == Capability::Pointer && self.pointer.is_none() {
            if let Ok(pointer) = self.seats.get_pointer(qh, &seat) {
                self.cursor = self.cursor_shapes.as_ref().map(|m| m.get_shape_device(&pointer, qh));
                self.pointer = Some(pointer);
            }
        }
    }

    fn remove_capability(
        &mut self,
        _: &Connection,
        _: &QueueHandle<Self>,
        _: wl_seat::WlSeat,
        capability: Capability,
    ) {
        if capability == Capability::Pointer {
            if let Some(cursor) = self.cursor.take() {
                cursor.destroy();
            }
            if let Some(pointer) = self.pointer.take() {
                pointer.release();
            }
        }
    }

    fn remove_seat(&mut self, _: &Connection, _: &QueueHandle<Self>, _: wl_seat::WlSeat) {}
}

impl CompositorHandler for App {
    fn scale_factor_changed(
        &mut self,
        _: &Connection,
        _: &QueueHandle<Self>,
        _: &wl_surface::WlSurface,
        _: i32,
    ) {
    }

    fn transform_changed(
        &mut self,
        _: &Connection,
        _: &QueueHandle<Self>,
        _: &wl_surface::WlSurface,
        _: wl_output::Transform,
    ) {
    }

    fn frame(&mut self, _: &Connection, _: &QueueHandle<Self>, _: &wl_surface::WlSurface, _: u32) {}

    fn surface_enter(
        &mut self,
        _: &Connection,
        _: &QueueHandle<Self>,
        _: &wl_surface::WlSurface,
        _: &wl_output::WlOutput,
    ) {
    }

    fn surface_leave(
        &mut self,
        _: &Connection,
        _: &QueueHandle<Self>,
        _: &wl_surface::WlSurface,
        _: &wl_output::WlOutput,
    ) {
    }
}

impl OutputHandler for App {
    fn output_state(&mut self) -> &mut OutputState {
        &mut self.outputs
    }
    fn new_output(&mut self, _: &Connection, _: &QueueHandle<Self>, _: wl_output::WlOutput) {}
    fn update_output(&mut self, _: &Connection, _: &QueueHandle<Self>, _: wl_output::WlOutput) {}
    fn output_destroyed(&mut self, _: &Connection, _: &QueueHandle<Self>, _: wl_output::WlOutput) {}
}

impl ShmHandler for App {
    fn shm_state(&mut self) -> &mut Shm {
        &mut self.shm
    }
}

impl ProvidesRegistryState for App {
    fn registry(&mut self) -> &mut RegistryState {
        &mut self.registry
    }
    registry_handlers![OutputState, SeatState];
}

smithay_client_toolkit::delegate_registry!(App);
smithay_client_toolkit::delegate_dispatch2!(App);
