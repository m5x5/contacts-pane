import { html, nothing, type PropertyValues } from 'lit'
import { keyed } from 'lit/directives/keyed.js'
import { state, property } from 'lit/decorators.js'
import { customElement, WebComponent, showDialog } from 'solid-ui'
import { authn } from 'solid-logic'

import AddContactModal from '../add-contact-modal'
import { documentVisibility } from '../../localUtils'

import 'solid-ui/components/button'
import 'solid-ui/components/icons'
import 'solid-ui/components/menu'
import 'solid-ui/components/menu-item'

import styles from './AddressBookHeader.styles.css'

type Person = any
type Visibility = 'public' | 'private' | null

/** Globe and lock marks for the visibility badge, sized to its text. */
const globeIcon = html`
  <svg width="12" height="12" viewBox="5.5 3.5 13 13" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M12.0013 15.8337C15.223 15.8337 17.8346 13.222 17.8346 10.0003C17.8346 6.77866 15.223 4.16699 12.0013 4.16699C8.77964 4.16699 6.16797 6.77866 6.16797 10.0003C6.16797 13.222 8.77964 15.8337 12.0013 15.8337Z" stroke="currentColor" stroke-width="1.02083" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M12.0013 4.16699C10.5034 5.73975 9.66797 7.82842 9.66797 10.0003C9.66797 12.1722 10.5034 14.2609 12.0013 15.8337C13.4992 14.2609 14.3346 12.1722 14.3346 10.0003C14.3346 7.82842 13.4992 5.73975 12.0013 4.16699Z" stroke="currentColor" stroke-width="1.02083" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M6.16797 10H17.8346" stroke="currentColor" stroke-width="1.02083" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`

const lockIcon = html`
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`

/**
 * The address book's title bar: what is currently being shown, the button that
 * adds a contact, and -- when a single group is in view -- the button that
 * deletes it.
 *
 * Adding a contact is self-contained: the button opens the modal and reports
 * the result. Deleting a group is not, so it only raises an intent; both the
 * confirmation and the deletion are the pane's business.
 */
@customElement('contacts-pane-address-book-header')
export default class AddressBookHeader extends WebComponent {
  static styles = styles

  /** Name of the single group in view, or null when showing everything. */
  @property()
  accessor selectedGroupName: string | null = null;

  @property()
  accessor book: unknown | null = null;

  @property()
  accessor selectedGroups: unknown | null = null;

  /** Whose sharing the badge reports: the group in view, or the book. */
  @property({ attribute: false })
  accessor aclSubject: any | null = null;

  @state()
  private accessor loggedIn = false;

  @state()
  private accessor visibility: Visibility = null;

  /** Stamp for the latest visibility lookup, so a slow older one cannot
   * overwrite the answer for the current subject. */
  private visibilityLookup = 0

  /** Whether the Tools view is the one currently filling the details pane.
   * Sharing opens a dialog instead, so it has nothing to stay marked against. */
  @state()
  private accessor toolsOpen = false;

  /** Whether the search box above the people list is showing. Off until the
   * user asks for it. */
  @state()
  private accessor searchOpen = false;

  connectedCallback () {
    super.connectedCallback()

    // The button stays disabled until we know there is someone to attribute
    // the new contact to.
    authn.checkUser().then((webId: unknown) => {
      if (!webId) {
        return
      }

      this.loggedIn = true
      // The ACL may only be readable now that we know who is asking.
      this.refreshVisibility()
      this.dispatchEvent(new CustomEvent('user-resolved', {
        bubbles: true,
        composed: true,
        detail: { webId }
      }))
    })
  }

  protected updated (changedProperties: PropertyValues<this>) {
    super.updated(changedProperties)

    if (changedProperties.has('aclSubject')) {
      this.refreshVisibility()
    }
  }

  private async refreshVisibility () {
    const lookup = ++this.visibilityLookup
    this.visibility = null
    if (!this.aclSubject) return

    const visibility = await documentVisibility(this.aclSubject)
    if (lookup === this.visibilityLookup) this.visibility = visibility
  }

  protected render () {
    return html`
      <header>
        <div class="titles">
          <div class="titleRow">
            <h2 id="addressBook-heading" tabindex="-1">${this.selectedGroupName ?? 'All Contacts'}</h2>
            ${this.renderVisibilityBadge()}
          </div>
          <p>Search contacts by name, email, WebID, or profile URL</p>
        </div>
        <div class="actions">
          <solid-ui-button
            variant="ghost"
            aria-pressed=${this.searchOpen ? 'true' : 'false'}
            @click=${this.onToggleSearch}
          >
            <icon-lucide-search slot="left-icon"></icon-lucide-search>
            Search
          </solid-ui-button>
          <solid-ui-button
            variant="secondary"
            ?disabled=${!this.loggedIn}
            @click=${this.onAddContact}
          >
            <icon-lucide-plus slot="left-icon"></icon-lucide-plus>
            New Contact
          </solid-ui-button>
          ${this.book ? this.renderMenu() : nothing}
        </div>
      </header>
    `
  }

  /**
   * solid-ui-menu assigns each child a slot when it first sees it, and only
   * numbers children that do not have one yet -- so an item appearing later
   * restarts at zero and lands on top of the first one. Keying the menu on the
   * items it contains rebuilds the element instead of mutating it, so it always
   * numbers a complete set.
   */
  private renderMenu () {
    const canDeleteGroup = !!this.selectedGroupName && this.loggedIn

    return keyed(canDeleteGroup, html`
      <solid-ui-menu placement="bottom-end" distance="5">
        <solid-ui-button slot="trigger" variant="ghost" title="More actions">
          <span class="sr-only">More actions</span>
          <icon-lucide-ellipsis-vertical slot="icon"></icon-lucide-ellipsis-vertical>
        </solid-ui-button>

        <solid-ui-menu-item @solid-ui-select=${this.onSharing}>
          Sharing
        </solid-ui-menu-item>
        <solid-ui-menu-item
          ?selected=${this.toolsOpen}
          @solid-ui-select=${this.onTools}
        >
          Tools
        </solid-ui-menu-item>
        ${canDeleteGroup
          ? html`
            <solid-ui-menu-item @solid-ui-select=${this.onDeleteGroup}>
              <icon-lucide-trash-2 slot="left-icon"></icon-lucide-trash-2>
              Delete Group
            </solid-ui-menu-item>
          `
          : nothing}
      </solid-ui-menu>
    `)
  }

  /** The pill next to the title saying whether the web can read what is on
   * show. Hidden while unknown -- e.g. the ACL is unreadable before login. */
  private renderVisibilityBadge () {
    if (!this.visibility) return nothing

    const isPublic = this.visibility === 'public'

    return html`
      <span class="badge ${isPublic ? 'badge--public' : 'badge--private'}">
        ${isPublic ? globeIcon : lockIcon}
        ${isPublic ? 'Public' : 'Private'}
      </span>
    `
  }

  /** Drop the Sharing / Tools highlight when something else takes the stage. */
  clearActiveAction () {
    this.toolsOpen = false
  }

  private onToggleSearch () {
    this.searchOpen = !this.searchOpen
    this.dispatchEvent(new CustomEvent('search-toggled', {
      bubbles: true,
      composed: true,
      detail: { open: this.searchOpen }
    }))
  }

  private onSharing () {
    // Opens a dialog rather than taking over the details pane, so nothing
    // here stays marked afterwards.
    this.request('sharing')
  }

  private onTools () {
    this.toolsOpen = true
    this.request('tools')
  }

  private request (action: 'sharing' | 'tools') {
    this.dispatchEvent(new CustomEvent(`${action}-requested`, {
      bubbles: true,
      composed: true
    }))
  }

  private onDeleteGroup () {
    this.dispatchEvent(new CustomEvent('delete-group-requested', {
      bubbles: true,
      composed: true
    }))
  }

  private onAddContact () {
    if (!this.book || !this.selectedGroups) {
      throw new Error('Book and selectedGroups are required for <contacts-pane-address-book-header>')
    }

    showDialog(AddContactModal, {
      props: { book: this.book, selectedGroups: this.selectedGroups },
      onClose: (person?: Person) => {
        if (!person) {
          return
        }

        this.dispatchEvent(new CustomEvent('contact-added', {
          bubbles: true,
          composed: true,
          detail: { person }
        }))
      }
    })
  }
}
