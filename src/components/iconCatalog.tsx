import React from "react";
import Icon from "@mdi/react";
import {
  mdiFoodSteak,
  mdiFoodTurkey,
  mdiPigVariant,
  mdiSheep,
  mdiSausage,
  mdiFish,
  mdiFoodDrumstick,
  mdiSilverwareForkKnife,
  mdiBasket,
  mdiLeaf,
} from "@mdi/js";

export const ICONS: Record<string, { label: string; path: string }> = {
  steak: { label: "Steak", path: mdiFoodSteak },
  poultry: { label: "Roast Chicken", path: mdiFoodTurkey }, // closest roast-bird
  pig: { label: "Pig", path: mdiPigVariant },
  sheep: { label: "Sheep", path: mdiSheep },
  sausage: { label: "Sausage", path: mdiSausage },
  fish: { label: "Fish", path: mdiFish },
  drumstick: { label: "Drumstick", path: mdiFoodDrumstick },
  cutlery: { label: "Cutlery", path: mdiSilverwareForkKnife },
  basket: { label: "Basket", path: mdiBasket },
  leaf: { label: "Leaf", path: mdiLeaf },
};

export function IconPreview({
  iconKey,
  size = 0.9,
}: {
  iconKey: string;
  size?: number;
}) {
  const item = ICONS[iconKey];
  if (!item) return null;
  return <Icon path={item.path} size={size} />;
}
