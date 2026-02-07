import Bowser from "bowser";

const browser = Bowser.getParser(window.navigator.userAgent);

const os = browser.getOS();

export const platform = {
  os: os.name ?? "Unknown",
  isMac: os.name === "macOS" || os.name === "iOS",

  cmdKey: os.name === "macOS" || os.name === "iOS" ? "⌘" : "Ctrl",
  altKey: os.name === "macOS" || os.name === "iOS" ? "⌥" : "Alt",
  shiftKey: "⇧",

  isElectron: Boolean(window.electronAPI),
  isVSCode: Boolean(window.vscodeapi),
  isElectronMac:
    Boolean(window.electronAPI && !window.vscodeapi) &&
    (os.name === "macOS" || os.name === "iOS"),
};
