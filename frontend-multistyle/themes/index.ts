import { metadata as lightTheme } from "./default/metadata";
import { metadata as darkTheme } from "./dark/metadata";
import { metadata as matrixTheme } from "./matrix/metadata";
import { metadata as vscodeDarkTheme } from "./vscode-dark/metadata";
import { metadata as vscodeLightTheme } from "./vscode-light/metadata";
import { metadata as metalTheme } from "./metal/metadata";
import { metadata as barbieTheme } from "./barbie/metadata";
import { metadata as falloutTheme } from "./fallout/metadata";

export type ThemeMetadata = {
  id: string;
  label: string;
  description: string;
  preview: { brand: string; background: string };
};

export const themes: ThemeMetadata[] = [lightTheme, vscodeLightTheme, darkTheme, vscodeDarkTheme, matrixTheme, metalTheme, barbieTheme, falloutTheme];
