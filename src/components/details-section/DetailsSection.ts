import { html } from 'lit'
import { state } from 'lit/decorators.js'
import { customElement, WebComponent } from 'solid-ui'

type View = 'empty' | 'loading' | 'message' | 'error' | 'content'

/** The empty state's circled address-book icon; the wording next to it is
 * plain HTML in renderEmpty. */
const emptyIllustration = html`
  <svg width="80" height="80" viewBox="107 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <mask id="contacts-pane-details-empty-circle" fill="white">
      <path d="M107 40C107 17.9086 124.909 0 147 0C169.091 0 187 17.9086 187 40C187 62.0914 169.091 80 147 80C124.909 80 107 62.0914 107 40Z"/>
    </mask>
    <path d="M107 40C107 17.9086 124.909 0 147 0C169.091 0 187 17.9086 187 40C187 62.0914 169.091 80 147 80C124.909 80 107 62.0914 107 40Z" fill="#F8FAFC"/>
    <path d="M107 40M187 40M187 40M107 40M147 0M187 40M147 80M107 40M147 80V79.2C125.35 79.2 107.8 61.6496 107.8 40H107H106.2C106.2 62.5332 124.467 80.8 147 80.8V80ZM187 40H186.2C186.2 61.6496 168.65 79.2 147 79.2V80V80.8C169.533 80.8 187.8 62.5332 187.8 40H187ZM147 0V0.8C168.65 0.8 186.2 18.3504 186.2 40H187H187.8C187.8 17.4668 169.533 -0.8 147 -0.8V0ZM147 0V-0.8C124.467 -0.8 106.2 17.4668 106.2 40H107H107.8C107.8 18.3504 125.35 0.8 147 0.8V0Z" fill="#E2E8F0" mask="url(#contacts-pane-details-empty-circle)"/>
    <path d="M150.75 41.25C150.75 40.2554 150.355 39.3016 149.652 38.5983C148.948 37.8951 147.995 37.5 147 37.5C146.005 37.5 145.052 37.8951 144.348 38.5983C143.645 39.3016 143.25 40.2554 143.25 41.25" stroke="#90A1B9" stroke-width="2.1875" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M137 49.375V30.625C137 29.7962 137.329 29.0013 137.915 28.4153C138.501 27.8292 139.296 27.5 140.125 27.5H155.75C156.082 27.5 156.399 27.6317 156.634 27.8661C156.868 28.1005 157 28.4185 157 28.75V51.25C157 51.5815 156.868 51.8995 156.634 52.1339C156.399 52.3683 156.082 52.5 155.75 52.5H140.125C139.296 52.5 138.501 52.1708 137.915 51.5847C137.329 50.9987 137 50.2038 137 49.375ZM137 49.375C137 48.5462 137.329 47.7513 137.915 47.1653C138.501 46.5792 139.296 46.25 140.125 46.25H157" stroke="#90A1B9" stroke-width="2.1875" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M147 37.5C148.381 37.5 149.5 36.3807 149.5 35C149.5 33.6193 148.381 32.5 147 32.5C145.619 32.5 144.5 33.6193 144.5 35C144.5 36.3807 145.619 37.5 147 37.5Z" stroke="#90A1B9" stroke-width="2.1875" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`

/**
 * The right-hand details column: one place that knows whether it is hidden,
 * loading, showing a contact, a tool, or a message -- instead of every caller
 * poking at innerHTML, aria-busy, and the `hidden` class themselves.
 *
 * Renders into the light DOM: what it hosts (a rendered pane, solid-ui's ACL
 * box, the Tools view) is legacy DOM styled by the pane's global stylesheet,
 * which a shadow root would cut off. The `detailSection` and
 * `detailsSectionContent` class names stay for the same reason.
 */
@customElement('contacts-pane-details')
export default class DetailsSection extends WebComponent {
  @state()
  private accessor view: View = 'empty';

  @state()
  private accessor message = '';

  @state()
  private accessor content: HTMLElement | null = null;

  /** Starts wide: the empty state holds the width a contact will need. */
  @state()
  private accessor wide = true;

  /** Extra elements shown above the view, e.g. the data-model cleanup
   * prompt. Like content once appended imperatively, they last until the next
   * view change. */
  @state()
  private accessor notices: HTMLElement[] = [];

  /** What kind of thing the content is; 'contact' survives a group change. */
  private contentKind: 'contact' | 'other' | null = null

  /** The section hosts legacy DOM styled by the pane's stylesheet. */
  protected createRenderRoot () {
    return this
  }

  connectedCallback () {
    super.connectedCallback()

    this.classList.add('detailSection')
    this.setAttribute('role', 'region')
    this.setAttribute('aria-label', 'Details section')
  }

  get hasContact () {
    return this.contentKind === 'contact'
  }

  showLoading ({ wide = false } = {}) {
    this.transition('loading', { wide })
  }

  showMessage (message: string) {
    this.transition('message')
    this.message = message
  }

  showError (message: string) {
    this.transition('error')
    this.message = message
  }

  showContent (content: HTMLElement, { wide = false, kind = 'other' as 'contact' | 'other' } = {}) {
    this.transition('content', { wide })
    this.content = content
    this.contentKind = kind
  }

  /** Back to the empty state -- wide, so the column keeps the width a
   * contact would give it instead of jumping when one is picked. */
  clear () {
    this.transition('empty', { wide: true })
  }

  /** Show an extra element above the current view. It does not open the
   * section -- a notice added while hidden waits for whatever opens it -- and
   * the next view change sweeps it away. */
  addNotice (notice: HTMLElement) {
    this.notices = [...this.notices, notice]
  }

  /** A new group selection keeps a contact on screen but sweeps anything
   * else -- tools, messages, a group's sharing pane -- off it. */
  clearUnlessContact () {
    if (this.hasContact) return

    this.clear()
  }

  private transition (view: View, { wide = false } = {}) {
    this.view = view
    this.wide = wide
    this.message = ''
    this.content = null
    this.contentKind = null
    this.notices = []
  }

  protected render () {
    return html`
      <div
        class="detailsSectionContent ${this.wide ? 'detailsSectionContent--wide' : ''}"
        role="region"
        aria-label="Details"
        aria-live="polite"
        aria-busy=${this.view === 'loading' ? 'true' : 'false'}
      >
        ${this.notices}
        ${this.renderView()}
      </div>
    `
  }

  private renderView () {
    switch (this.view) {
      case 'loading':
        return html`Loading...`
      case 'message':
        return html`${this.message}`
      case 'error':
        return html`<div class="detailsError" role="alert">${this.message}</div>`
      case 'content':
        return this.content
      default:
        return this.renderEmpty()
    }
  }

  private renderEmpty () {
    return html`
      <div class="detailsEmpty">
        ${emptyIllustration}
        <h3 class="detailsEmptyTitle">No contact selected</h3>
        <p class="detailsEmptyText">Select a contact from the list to view their profile, edit details, or send a message.</p>
      </div>
    `
  }
}
