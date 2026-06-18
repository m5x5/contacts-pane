// Jest mock for `~icons/*` imports used by solid-ui source.
// These imports are side-effect-only in solid-ui and do not export values.

if (typeof customElements !== 'undefined') {
  class MockIcon extends HTMLElement {}
  // Define a generic icon element to avoid unknown element warnings.
  if (!customElements.get('icon-mock')) {
    customElements.define('icon-mock', MockIcon)
  }
}

export default {}
