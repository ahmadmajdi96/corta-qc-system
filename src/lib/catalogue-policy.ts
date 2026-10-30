/** UI safeguard only; externally owned writes must also be enforced server-side at cutover. */
export function catalogueCreationDisabled(options: { hideCreate?: boolean; readOnly?: boolean }): boolean {
  return options.hideCreate === true || options.readOnly === true;
}