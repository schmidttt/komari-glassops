# Komari GlassOps attribution

Komari GlassOps is an independent Komari theme maintained by Schmidt.

## Source baseline

- Based on `sanrokamlan-prog/komari-theme-Glassmorphism` commit
  `9c9a7eef514936e4bdf16b41835be52a81453bb2`.
- The upstream MIT license is preserved in `LICENSE`.
- Glassmorphism remains the primary visual and technical baseline.

## Design reference

- `lyimoexiao/komari-theme-naive` is used as a functional information-layout
  reference for the homepage node cards and delay-task configuration flow.
- No Naive source component is copied into the initial GlassOps implementation.

Komari and related names belong to their respective project owners.

## Map data

- The bundled 1:110m country boundaries are derived from Natural Earth data
  distributed with `three-conic-polygon-geometry`.
- Only the fields required by the local Tiled renderer are retained.
- Natural Earth data is in the public domain.

## Earth imagery

- The realistic renderer's 2016 night-light texture is derived from NASA Earth
  Observatory's public Black Marble global color map, based on Suomi NPP VIIRS
  observations.
- Source: <https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/>
- The daytime Blue Marble, elevation and water-mask textures retain their
  existing upstream file paths and provenance.
