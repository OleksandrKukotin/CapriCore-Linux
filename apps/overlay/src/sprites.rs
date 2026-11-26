// SPDX-License-Identifier: GPL-3.0-only
//! Loads Capri's existing sprite catalog and prepares compositor-ready pixels once:
//! cropped to the visible bounds, scaled to display size and premultiplied.

use image::{RgbaImage, imageops::FilterType};
use serde::Deserialize;
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
};

pub const CATALOG: &str = "assets/capri/sprites/v1/runtime-sprite-set.json";

#[derive(Deserialize)]
struct Catalog {
    #[serde(rename = "defaultSprite")]
    default_sprite: String,
    sprites: Vec<Entry>,
}

#[derive(Deserialize)]
struct Entry {
    id: String,
    file: String,
    #[serde(rename = "visibleBounds")]
    bounds: Bounds,
}

#[derive(Deserialize, Clone, Copy)]
struct Bounds {
    x: u32,
    y: u32,
    width: u32,
    height: u32,
}

pub struct Sprite {
    /// Premultiplied ARGB8888 in little-endian byte order (B, G, R, A).
    pub pixels: Vec<u8>,
    /// Opaque spans as (x, y, width, height) rectangles, for the input region.
    pub hit: Vec<(i32, i32, i32, i32)>,
}

pub struct SpriteSet {
    pub width: u32,
    pub height: u32,
    pub default_id: String,
    sprites: HashMap<String, Sprite>,
}

impl SpriteSet {
    pub fn get(&self, id: &str) -> Option<&Sprite> {
        self.sprites.get(id)
    }

    pub fn contains(&self, id: &str) -> bool {
        self.sprites.contains_key(id)
    }

    pub fn load(root: &Path, height: u32) -> Result<Self, String> {
        let catalog_path = root.join(CATALOG);
        let text = std::fs::read_to_string(&catalog_path)
            .map_err(|e| format!("{}: {e}", catalog_path.display()))?;
        let catalog: Catalog = serde_json::from_str(&text).map_err(|e| e.to_string())?;
        let folder = catalog_path.parent().unwrap().to_path_buf();

        // One shared crop keeps every frame registered to the same feet position.
        let left = catalog.sprites.iter().map(|s| s.bounds.x).min().ok_or("empty catalog")?;
        let top = catalog.sprites.iter().map(|s| s.bounds.y).min().unwrap();
        let right = catalog.sprites.iter().map(|s| s.bounds.x + s.bounds.width).max().unwrap();
        let bottom = catalog.sprites.iter().map(|s| s.bounds.y + s.bounds.height).max().unwrap();
        let crop = Bounds { x: left, y: top, width: right - left, height: bottom - top };
        let scale = height as f64 / crop.height as f64;
        let width = ((crop.width as f64 * scale).round() as u32).max(1);

        let jobs: Vec<(String, PathBuf)> =
            catalog.sprites.iter().map(|s| (s.id.clone(), folder.join(&s.file))).collect();
        let threads = std::thread::available_parallelism().map_or(4, |n| n.get());
        let chunk = jobs.len().div_ceil(threads).max(1);
        let results: Vec<Result<(String, Sprite), String>> = std::thread::scope(|scope| {
            let handles: Vec<_> = jobs
                .chunks(chunk)
                .map(|part| {
                    scope.spawn(move || {
                        part.iter()
                            .map(|(id, file)| {
                                prepare(file, crop, width, height).map(|sprite| (id.clone(), sprite))
                            })
                            .collect::<Vec<_>>()
                    })
                })
                .collect();
            handles.into_iter().flat_map(|h| h.join().unwrap()).collect()
        });
        let sprites = results.into_iter().collect::<Result<HashMap<_, _>, _>>()?;
        if !sprites.contains_key(&catalog.default_sprite) {
            return Err(format!("default sprite {} is missing", catalog.default_sprite));
        }
        Ok(Self { width, height, default_id: catalog.default_sprite, sprites })
    }
}

fn prepare(file: &Path, crop: Bounds, width: u32, height: u32) -> Result<Sprite, String> {
    let image = image::open(file).map_err(|e| format!("{}: {e}", file.display()))?.into_rgba8();
    let cropped = image::imageops::crop_imm(&image, crop.x, crop.y, crop.width, crop.height).to_image();
    let scaled = image::imageops::resize(&cropped, width, height, FilterType::Lanczos3);
    Ok(Sprite { hit: hit_rectangles(&scaled), pixels: premultiplied_bgra(&scaled) })
}

fn premultiplied_bgra(image: &RgbaImage) -> Vec<u8> {
    let mut out = Vec::with_capacity(image.as_raw().len());
    for pixel in image.pixels() {
        let [r, g, b, a] = pixel.0;
        let mul = |c: u8| ((c as u16 * a as u16 + 127) / 255) as u8;
        out.extend_from_slice(&[mul(b), mul(g), mul(r), a]);
    }
    out
}

/// Coarse alpha mask: horizontal opaque spans per band of rows. Clicks on
/// transparent pixels around Capri pass through to the windows below.
fn hit_rectangles(image: &RgbaImage) -> Vec<(i32, i32, i32, i32)> {
    const BAND: u32 = 4;
    const ALPHA: u8 = 40;
    let (w, h) = image.dimensions();
    let mut rects = Vec::new();
    let mut y = 0;
    while y < h {
        let band = BAND.min(h - y);
        let mut start: Option<u32> = None;
        for x in 0..=w {
            let solid = x < w && (y..y + band).any(|row| image.get_pixel(x, row).0[3] >= ALPHA);
            match (solid, start) {
                (true, None) => start = Some(x),
                (false, Some(s)) => {
                    rects.push((s as i32, y as i32, (x - s) as i32, band as i32));
                    start = None;
                }
                _ => {}
            }
        }
        y += band;
    }
    rects
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::Rgba;

    #[test]
    fn premultiplies_into_bgra_order() {
        let mut image = RgbaImage::new(1, 1);
        image.put_pixel(0, 0, Rgba([255, 128, 0, 128]));
        assert_eq!(premultiplied_bgra(&image), vec![0, 64, 128, 128]);
    }

    #[test]
    fn hit_region_skips_transparent_pixels() {
        let mut image = RgbaImage::new(8, 4);
        for x in 2..5 {
            image.put_pixel(x, 1, Rgba([0, 0, 0, 255]));
        }
        assert_eq!(hit_rectangles(&image), vec![(2, 0, 3, 4)]);
    }
}
