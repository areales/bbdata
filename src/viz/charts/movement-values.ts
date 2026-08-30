/**
 * Shared value builder for the movement chart family.
 *
 * Converts raw Savant pfx_* (feet) into the inches / catcher-POV shape
 * both movement charts plot. Pitches with missing movement tracking
 * (null pfx — see P1.11) are dropped so they don't plot at the origin.
 * Any change to the unit convention, coordinate flip, or value shape
 * belongs here so `movement` and `movement-binned` can't drift apart.
 */
// Type alias, not interface — the chart builders cast the untyped
// Record rows to this shape, and only object-literal aliases carry the
// implicit index signature that makes that cast legal.
export type MovementPitch = {
  pitch_type: string;
  pfx_x: number | null;
  pfx_z: number | null;
  release_speed: number | null;
};

export function toMovementValues(pitches: MovementPitch[]) {
  return pitches.flatMap((p) => {
    if (p.pfx_x == null || p.pfx_z == null) return [];
    return [{
      pitch_type: p.pitch_type,
      hBreak: -p.pfx_x * 12, // feet → inches, flipped for catcher POV
      vBreak: p.pfx_z * 12,
      velo: p.release_speed,
    }];
  });
}
