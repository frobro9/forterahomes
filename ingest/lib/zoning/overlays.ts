/**
 * PLACEHOLDER DATA — see zoneReference.ts for the same caveat. These
 * modifiers illustrate the shape of overlay adjustments (heritage,
 * floodplain, corner lot, transit priority) and must be confirmed against
 * the official bylaw and overlay mapping before real use.
 */

export type OverlayType =
  | "heritage"
  | "floodplain"
  | "corner_lot"
  | "transit_priority";

export interface OverlayFlags {
  heritage?: boolean;
  floodplain?: boolean;
  cornerLot?: boolean;
  transitPriority?: boolean;
}

export interface OverlayModifier {
  overlayType: OverlayType;
  description: string;
  apply: (base: {
    maxUnits: number;
    maxHeightM: number;
    sideSetbackM: number;
  }) => { maxUnits: number; maxHeightM: number; sideSetbackM: number };
}

export const OVERLAY_MODIFIERS: OverlayModifier[] = [
  {
    overlayType: "heritage",
    description: "Heritage conservation district — caps height, no unit bump.",
    apply: (base) => ({ ...base, maxHeightM: Math.min(base.maxHeightM, 9) }),
  },
  {
    overlayType: "floodplain",
    description: "Regulatory floodplain — development materially restricted.",
    apply: (base) => ({ ...base, maxUnits: 0 }),
  },
  {
    overlayType: "corner_lot",
    description: "Corner lot — an extra flanking side setback typically applies.",
    apply: (base) => ({ ...base, sideSetbackM: base.sideSetbackM + 1.2 }),
  },
  {
    overlayType: "transit_priority",
    description: "Within a transit-priority corridor buffer — unit count bump.",
    apply: (base) => ({ ...base, maxUnits: base.maxUnits + 2 }),
  },
];

export function applyOverlays(
  base: { maxUnits: number; maxHeightM: number; sideSetbackM: number },
  flags: OverlayFlags
) {
  let result = { ...base };
  for (const modifier of OVERLAY_MODIFIERS) {
    const flagKey = {
      heritage: flags.heritage,
      floodplain: flags.floodplain,
      corner_lot: flags.cornerLot,
      transit_priority: flags.transitPriority,
    }[modifier.overlayType];

    if (flagKey) {
      result = modifier.apply(result);
    }
  }
  return result;
}
