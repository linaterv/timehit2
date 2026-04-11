import { metadata as lightTheme } from "./default/metadata";
import { metadata as darkTheme } from "./dark/metadata";
import { metadata as matrixTheme } from "./matrix/metadata";
import { metadata as vscodeDarkTheme } from "./vscode-dark/metadata";
import { metadata as hithunterTheme } from "./hithunter/metadata";
import { metadata as metalTheme } from "./metal/metadata";
import { metadata as barbieTheme } from "./barbie/metadata";
import { metadata as falloutTheme } from "./fallout/metadata";
import { metadata as synthTokyoTheme } from "./synth-tokyo/metadata";
import { metadata as alohaTheme } from "./aloha/metadata";

export type ThemeMetadata = {
  id: string;
  label: string;
  description: string;
  preview: { brand: string; background: string };
};

export const themes: ThemeMetadata[] = [lightTheme, hithunterTheme, darkTheme, vscodeDarkTheme, matrixTheme, metalTheme, barbieTheme, falloutTheme, synthTokyoTheme, alohaTheme];
