export type LoginPanelLayout = {
  primaryMode: "create-account" | "sign-in";
  /** Account creation outside local dev needs the app access token in the same form. */
  requireSetupToken: boolean;
  showDevQuickLogin: boolean;
  showTokenPaste: boolean;
};

export function resolveLoginPanelLayout(setupRequired: boolean, devQuickLoginAvailable: boolean): LoginPanelLayout {
  const requireSetupToken = setupRequired && !devQuickLoginAvailable;
  return {
    primaryMode: setupRequired ? "create-account" : "sign-in",
    requireSetupToken,
    showDevQuickLogin: devQuickLoginAvailable,
    showTokenPaste: !devQuickLoginAvailable && !requireSetupToken,
  };
}
