export type LoginPanelLayout = {
  primaryMode: "create-account" | "sign-in";
  showDevQuickLogin: boolean;
  showTokenPaste: boolean;
};

export function resolveLoginPanelLayout(setupRequired: boolean, devQuickLoginAvailable: boolean): LoginPanelLayout {
  return {
    primaryMode: setupRequired ? "create-account" : "sign-in",
    showDevQuickLogin: devQuickLoginAvailable,
    showTokenPaste: !devQuickLoginAvailable,
  };
}
