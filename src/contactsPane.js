/*   Contact AddressBook Pane
**
**  This outline pane allows a user to interact with a contact,
to change its state according to an ontology, comment on it, etc.
**
** See also things like
**  http://www.w3.org/TR/vcard-rdf/
**  http://tools.ietf.org/html/rfc6350
**  http://www.iana.org/assignments/vcard-elements/vcard-elements.xhtml
**
*/

import { authn } from 'solid-logic'
import * as UI from 'solid-ui'
import { mintNewAddressBook } from './mintNewAddressBook'
import { renderIndividual } from './individual'
import { toolsPane } from './toolsPane'
import './styles/utilities.css'
import './styles/contactsPane.css'
import {
  checkDataModel, configureAddressBook, refreshNames, selectAllGroups,
  refreshFilteredPeople, deselectAllPeople
} from './addressBookPresenter'
import { alertDialog, complain, confirmDialog, deleteThingAndDoc, setupResponsiveStacking } from './localUtils'
import * as debug from './debug'
import './styles/contactsRDFFormsEnforced.css'

import NewGroupModal from './components/new-group-modal'
import SharingModal from './components/sharing-modal'
import './components/address-book-header'
import './components/group-bar'

const ns = UI.ns
const utils = UI.utils

export default {
  icon: UI.icons.iconBase + 'noun_99101.svg', // changed from embedded icon 2016-05-01

  name: 'contact',

  global: false,

  // Does the subject deserve a contact pane?
  label: function (subject, context) {
    const t = context.session.store.findTypeURIs(subject)
    // with the new design we only display Address Books
    // individuals are rendered through the profile-pane but not Organizations
    if (t[ns.vcard('Organization').uri]) return 'Contact'
    /*
    if (t[ns.vcard('Individual').uri]) return 'Contact'
    if (t[ns.foaf('Person').uri]) return 'Person'
    if (t[ns.schema('Person').uri]) return 'Person'
    if (t[ns.vcard('Group').uri]) return 'Group'
    */
    if (t[ns.vcard('AddressBook').uri]) return 'Address book'
    return null // No, under other circumstances
  },

  mintClass: UI.ns.vcard('AddressBook'),

  mintNew: mintNewAddressBook, // Make a new address book

  //  Render the pane
  render: function (subject, dataBrowserContext, paneOptions = {}) {
    /*
    function newAddressBookButton (thisAddressBook) {
      return UI.login.newAppInstance(
        dom,
        { noun: 'address book', appPathSegment: 'contactorator.timbl.com' },
        function (ws, newBase) {
          thisPane.mintNew(thisAddressBook, newBase, {
            me,
            div,
            dom
          })
        }
      )
    } */

    const dom = dataBrowserContext.dom
    const kb = dataBrowserContext.session.store
    const div = dom.createElement('div')

    UI.aclControl.preventBrowserDropEvents(dom) // protect drag and drop

    div.setAttribute('class', 'contactPane')
    // Make the pane stack vertically (sidebar -> details) when narrow
    // Set breakpoint to 1000 so it triggers at 980 width too.
    setupResponsiveStacking(div, 1000)

    asyncRender().then(
      () => debug.log('Contacts pane rendered for ' + subject),
      err => complain(div, dom, err.message || '' + err)
    ).catch(err => {
      complain(div, dom, err.message || '' + err)
    })
    return div

    // Async part of render. Maybe API will later allow render to be async
    async function asyncRender () {
      UI.aclControl.preventBrowserDropEvents(dom)

      const t = kb.findTypeURIs(subject)

      // Render a single contact Individual
      if (
        t[ns.vcard('Individual').uri] ||
        t[ns.foaf('Person').uri] ||
        t[ns.schema('Person').uri] ||
        t[ns.vcard('Organization').uri] ||
        t[ns.schema('Organization').uri]
      ) {
        try {
          await renderIndividual(dom, div, subject, dataBrowserContext)
        } catch (err) {
          debug.error('Error rendering contact. Stack: ' + err)
          throw new Error('Failed to render contact: ' + (err.message || err))
        }
      /*
        //          Render a Group instance
      }
        else if (t[ns.vcard('Group').uri]) {
        // If we have a main address book, then render this group as a guest group within it
        UI.login
          .findAppInstances(context, ns.vcard('AddressBook'))
          .then(function (context) {
            const addressBooks = context.instances
            const options = { foreignGroup: subject }
            if (addressBooks.length > 0) {
              // const book = addressBooks[0]
              renderAddressBook(addressBooks, options)
            } else {
              renderAddressBook([], options)
              // @@ button to Make a new addressBook
            }
          })
          .catch(function (e) {
            complain(div, dom, '' + e)
          })
        */
      // Render a AddressBook instance
      } else if (t[ns.vcard('AddressBook').uri]) {
        renderAddressBook([subject], {})
      } else {
        debug.error('No evidence that ' + subject + ' is anything to do with contacts.')
        throw new Error('This does not seem to be a contact or address book.')
      }

      let me = authn.currentUser()

      //  Render AddressBook instance
      function renderAddressBook (books, options) {
        kb.fetcher
          .load(books)
          .then(function (_xhr) {
            renderAddressBookDetails(books, options)
          })
          .catch(function (err) {
            debug.error('Error loading address book. Stack: ' + err)
            throw new Error('Failed to load address book.')
          })
      }

      function renderAddressBookDetails (books, options) {
        const classLabel = utils.label(ns.vcard('AddressBook'))

        let book = options.foreignGroup // in case we have only a Grouo
        let title = ''
        if (books && books.length > 0) {
          book = books[0] // if we have an Address Book, we prefer this
          title = utils.label(book.dir())
        } else {
          kb.any(book, ns.dc('title')) || kb.any(book, ns.vcard('fn'))
          if (paneOptions.solo && title && typeof document !== 'undefined') {
            document.title = title.value // @@ only when the outermmost pane
          }
          title = title ? title.value : classLabel
        }

        const groupIndex = kb.any(book, ns.vcard('groupIndex'))
        const selectedGroups = {}
        let selectedPeople = {} // Actually prob max 1

        // The Sharing / Tools buttons live in the header and track their own
        // highlight; this just tells them to drop it.
        function setActiveActionButton (active) {
          if (!active && ctx.headerSection) ctx.headerSection.clearActiveAction()
        }

        // Shared context passed to all builder functions
        const ctx = {
          dom,
          kb,
          ns,
          book,
          options,
          title,
          groupIndex,
          selectedGroups,
          get selectedPeople () { return selectedPeople },
          set selectedPeople (v) { selectedPeople = v },
          setActiveActionButton,
          dataBrowserContext,
          div,
          me,
          setMe (v) { me = v },
          paneOptions,
        }

        // ── Build layout ────────────────────────────────────────────
        const { main, contentArea, peopleSection, addressBookSection, detailsSection } = buildMainLayout(ctx)
        div.appendChild(main)

        function showDetailsSection () {
          detailsSection.classList.remove('hidden')
        }
        ctx.showDetailsSection = showDetailsSection
        ctx.detailsSection = detailsSection

        // Create shared DOM elements needed by multiple builders
        const ulPeople = dom.createElement('ul')
        ulPeople.setAttribute('role', 'list')
        ulPeople.setAttribute('aria-label', 'People list')
        ctx.ulPeople = ulPeople
        // make the element available on the dataBrowserContext too; other
        // modules (individual/group membership) look for this property when
        // they need to refresh the master list after a mutation.
        if (ctx.dataBrowserContext) ctx.dataBrowserContext.ulPeople = ulPeople

        const detailsSectionContent = dom.createElement('div')
        detailsSectionContent.classList.add('detailsSectionContent')
        detailsSectionContent.setAttribute('role', 'region')
        detailsSectionContent.setAttribute('aria-labelledby', 'detailsSectionContent')
        detailsSectionContent.setAttribute('aria-live', 'polite')
        ctx.detailsSectionContent = detailsSectionContent

        // ── Title bar, spanning the people list and the contact detail ──
        const headerSection = buildHeaderSection(ctx)
        contentArea.insertBefore(headerSection, contentArea.firstChild)

        // ── People column: search, then the people themselves ──────────

        const { searchSection, searchInput } = buildSearchSection(ctx)
        ctx.searchInput = searchInput
        peopleSection.appendChild(searchSection)

        peopleSection.appendChild(ulPeople)

        // The people list and its helpers read these; the group bar renders
        // itself and no longer passes them in on every call.
        configureAddressBook({
          book,
          dom,
          selectedGroups,
          ulPeople,
          searchInput,
          cardMain: detailsSectionContent,
          dataBrowserContext
        })

        // ── Group bar ───────────────────────────────────────────────
        const { buttonSection } = buildGroupBar(ctx)
        ctx.groupBar = buttonSection
        addressBookSection.appendChild(buttonSection)

        // ── Details content section ─────────────────────────────────
        detailsSection.appendChild(detailsSectionContent)

        checkDataModel(book, detailsSectionContent).then(() => { debug.log('Async checkDataModel done.') })
      }

      // /////////////// Fix user when testing on a plane

      if (
        typeof document !== 'undefined' &&
        document.location &&
        ('' + document.location).slice(0, 16) === 'http://localhost'
      ) {
        const inferredOwner = kb.any(subject, UI.ns.acl('owner')) // when testing on plane with no webid
        if (inferredOwner) {
          me = inferredOwner
        }
      }

      return div
    } // asyncRender
  } // render function
} // pane object

// ── Helper: handle "New group" button click ──────────────────────────
async function handleNewGroupClick (ctx) {
  const { kb, ns, book } = ctx
  const groupIndex = kb.any(book, ns.vcard('groupIndex'))
  try {
    await kb.fetcher.load(groupIndex)
  } catch (e) {
    debug.log('Error: Group index  NOT loaded:' + e + '\n')
  }
  debug.log(' Group index has been loaded\n')

  UI.showDialog(NewGroupModal, {
    props: { book },
    onClose (group) {
      if (!group) {
        return // cancelled by user
      }

      showNewGroup(ctx, group)
    }
  })
}

// ── Helper: reveal a freshly created group ───────────────────────────
function showNewGroup (ctx, group) {
  const { kb, selectedGroups, dataBrowserContext } = ctx
  ctx.showDetailsSection()
  for (const key in selectedGroups) delete selectedGroups[key]
  selectedGroups[group.uri] = true

  // Refresh the group buttons list
  ctx.groupBar.refresh()
  syncHeaderToSelection(ctx)
  refreshNames(ctx.ulPeople, null, false)

  ctx.detailsSectionContent.innerHTML = ''
  ctx.detailsSectionContent.appendChild(UI.aclControl.ACLControlBox5(
    group.doc(), dataBrowserContext, 'group', kb,
    function (ok, body) {
      if (!ok) {
        ctx.detailsSectionContent.innerHTML =
            'Group sharing setup failed: ' + body
      }
    }))
}

// ── Builder: main layout skeleton ────────────────────────────────────
function buildMainLayout (ctx) {
  const { dom } = ctx
  const main = dom.createElement('main')
  main.id = 'main-content'
  main.classList.add('addressBook-grid')
  main.setAttribute('role', 'main')
  main.setAttribute('aria-label', 'Address Book')
  main.setAttribute('tabindex', '-1')

  const addressBookSection = dom.createElement('section')
  addressBookSection.setAttribute('aria-labelledby', 'addressBook-section')
  addressBookSection.classList.add('addressBookSection', 'section-bg')
  addressBookSection.setAttribute('role', 'region')
  addressBookSection.setAttribute('tabindex', '-1')
  main.appendChild(addressBookSection)

  // Everything right of the address book shares one title bar, so the header
  // spans the people list and the contact detail rather than being squeezed
  // into the people column on its own.
  const contentArea = dom.createElement('div')
  contentArea.classList.add('contentArea')
  main.appendChild(contentArea)

  // The title bar itself is appended here by the caller; the .contentHeader
  // wrapper is part of the component's own template.
  const contentColumns = dom.createElement('div')
  contentColumns.classList.add('contentColumns')
  contentArea.appendChild(contentColumns)

  const peopleSection = dom.createElement('section')
  peopleSection.classList.add('peopleSection')
  peopleSection.setAttribute('role', 'region')
  peopleSection.setAttribute('aria-label', 'People')
  contentColumns.appendChild(peopleSection)

  const detailsSection = dom.createElement('section')
  detailsSection.classList.add('detailSection')
  detailsSection.setAttribute('role', 'region')
  detailsSection.setAttribute('aria-label', 'Details section')
  detailsSection.classList.add('hidden')
  contentColumns.appendChild(detailsSection)

  return { main, contentArea, peopleSection, addressBookSection, detailsSection }
}

// ── Builder: header with title and New Contact button ────────────────
// TODO we should also show whether the address book is public or private
function buildHeaderSection (ctx) {
  const { dom, book, selectedGroups, setMe } = ctx

  const headerSection = dom.createElement('contacts-pane-address-book-header')
  headerSection.book = book
  headerSection.selectedGroups = selectedGroups

  headerSection.addEventListener('user-resolved', event => setMe(event.detail.webId))
  headerSection.addEventListener('contact-added', event => showNewContact(ctx, event.detail.person))
  headerSection.addEventListener('delete-group-requested', () => deleteSelectedGroup(ctx))
  headerSection.addEventListener('sharing-requested', () => showSharing(ctx))
  headerSection.addEventListener('tools-requested', () => showTools(ctx))

  ctx.headerSection = headerSection

  return headerSection
}

/** The one group in view, or null when showing all of them (or none). */
function soleSelectedGroup (ctx) {
  const uris = Object.keys(ctx.selectedGroups).filter(uri => ctx.selectedGroups[uri])
  const groupCount = ctx.groupBar ? ctx.groupBar.groupCount : 0

  // "All groups" selects everything, which is not the same as picking one.
  if (uris.length !== 1 || groupCount <= 1) return null

  return ctx.kb.sym(uris[0])
}

/** Keep the header's title and its Delete Group button in step with the bar. */
function syncHeaderToSelection (ctx) {
  if (!ctx.headerSection) return

  const group = soleSelectedGroup(ctx)
  const name = group && ctx.kb.any(group, ns.vcard('fn'))

  ctx.headerSection.selectedGroupName = name ? name.value : null
}

async function deleteSelectedGroup (ctx) {
  const { selectedGroups } = ctx
  const group = soleSelectedGroup(ctx)
  if (!group) return

  const name = ctx.kb.any(group, ns.vcard('fn'))
  const label = name ? name.value : 'this group'

  if (!(await confirmDialog(`Really delete the group ${label}?`))) return

  try {
    await deleteThingAndDoc(group)
  } catch (err) {
    debug.error('Error deleting group. Stack: ' + err)
    alertDialog('Failed to delete the group. If it persists, contact your admin.')
    return
  }

  delete selectedGroups[group.uri]
  ctx.groupBar.refresh()
  syncHeaderToSelection(ctx)
  refreshNames(ctx.ulPeople, null, false)
}

// ── Helper: reveal a freshly created contact ─────────────────────────
function showNewContact (ctx, person) {
  const { dataBrowserContext } = ctx

  ctx.selectedPeople = {}
  ctx.selectedPeople[person.uri] = true
  refreshNames(ctx.ulPeople, null) // Add name to list of group
  ctx.detailsSectionContent.innerHTML = '' // Clear 'indexing'
  ctx.detailsSectionContent.classList.add('detailsSectionContent--wide')
  const contactPane = dataBrowserContext.session.paneRegistry.byName('contact')
  const paneDiv = contactPane.render(person, dataBrowserContext)
  paneDiv.classList.add('renderPane')
  ctx.detailsSectionContent.appendChild(paneDiv)
}

// ── Builder: search input section ────────────────────────────────────
function buildSearchSection (ctx) {
  const { dom } = ctx
  const searchSection = dom.createElement('section')
  searchSection.classList.add('searchSection')
  const searchDiv = dom.createElement('div')
  searchDiv.classList.add('searchDiv')
  // container for input + clear button
  searchSection.appendChild(searchDiv)
  const searchInput = dom.createElement('input')
  searchInput.setAttribute('type', 'text')
  searchInput.setAttribute('aria-label', 'Search contacts')
  searchInput.classList.add('searchInput')
  searchInput.setAttribute('placeholder', 'Search by name in selected group')
  searchDiv.appendChild(searchInput)

  // clear button that appears when there is text
  const clearBtn = dom.createElement('button')
  clearBtn.setAttribute('type', 'button')
  clearBtn.setAttribute('aria-label', 'Clear search')
  clearBtn.classList.add('searchClearButton', 'hidden')
  clearBtn.textContent = '\u2715' // multiplication sign ×
  searchDiv.appendChild(clearBtn)

  searchInput.addEventListener('input', function (_event) {
    const hasText = searchInput.value.length > 0
    // show/hide using the shared "hidden" utility class instead of direct
    // style manipulation
    clearBtn.classList.toggle('hidden', !hasText)
    refreshFilteredPeople(ctx.ulPeople, true, ctx.detailsSectionContent)
  })

  clearBtn.addEventListener('click', function () {
    searchInput.value = ''
    clearBtn.classList.add('hidden')
    searchInput.focus()
    refreshFilteredPeople(ctx.ulPeople, true, ctx.detailsSectionContent)
  })

  return { searchSection, searchInput }
}

// ── Builder: group buttons bar ───────────────────────────────────────
function buildGroupBar (ctx) {
  const { dom, kb, book, options, groupIndex, selectedGroups, setActiveActionButton } = ctx

  const buttonSection = dom.createElement('contacts-pane-group-bar')
  buttonSection.classList.add('buttonSection')
  buttonSection.book = book
  buttonSection.options = options
  buttonSection.selectedGroups = selectedGroups

  buttonSection.addEventListener('selection-changed', () => {
    syncHeaderToSelection(ctx)
    setActiveActionButton(null)
    // Keep the details section open when a contact is showing
    if (!ctx.detailsSectionContent.querySelector('.renderPane')) {
      ctx.detailsSectionContent.innerHTML = ''
      ctx.detailsSection.classList.add('hidden')
    }
  })
  buttonSection.addEventListener('new-group-requested', () => {
    setActiveActionButton(null)
    deselectAllPeople(ctx.ulPeople)
    handleNewGroupClick(ctx)
  })

  if (options.foreignGroup) {
    selectedGroups[options.foreignGroup.uri] = true
  }

  if (book) {
    if (groupIndex) {
      kb.fetcher.nowOrWhenFetched(groupIndex.uri, book, function (ok, body) {
        if (!ok) {
          debug.error('Error loading group index. Stack: ' + body)
          alertDialog('Error loading group index. If it persists, contact admin.')
          return
        }
        buttonSection.selectAll() // Show all contacts on load
      })
    }
  } else {
    refreshNames(ctx.ulPeople, null)
    debug.log('No book, only one group -> hide list of groups')
  } // if not book

  return { buttonSection }
}

// ── Address-book-wide views, opened from the header ──────────────────

/** Shared preamble: clear the details pane and give it the stage. */
function openDetailsView (ctx, { wide }) {
  deselectAllPeople(ctx.ulPeople)
  ctx.showDetailsSection()
  ctx.detailsSectionContent.innerHTML = ''
  ctx.detailsSectionContent.classList.toggle('detailsSectionContent--wide', wide)
}

function showSharing (ctx) {
  const { dom, kb, book, dataBrowserContext, div, me } = ctx

  const content = dom.createElement('div')
  content.classList.add('sharingControls')

  content.appendChild(
    UI.aclControl.ACLControlBox5(
      book.dir(),
      dataBrowserContext,
      'book',
      kb,
      (ok, body) => {
        if (!ok) {
          debug.error('ACL control box Failed. Stack: ' + body)
          complain(content, dom, 'Problem displaying sharing controls. If persists, contact admin.')
        }
      }
    )
  )

  const sharingContext = {
    target: book,
    me,
    noun: 'address book',
    div: content,
    dom,
    statusRegion: div
  }
  UI.login.registrationControl(sharingContext, book, ns.vcard('AddressBook'))
    .then(() => debug.log('Registration control finished.'))
    .catch(e => {
      debug.error('Error in registration control. Stack: ' + e)
      complain(content, dom, 'Problem displaying findable controls. If persists, contact admin.')
    })

  UI.showDialog(SharingModal, { props: { content } })
}

function showTools (ctx) {
  const { book, selectedGroups, dataBrowserContext, me } = ctx

  openDetailsView(ctx, { wide: true })

  ctx.detailsSectionContent.appendChild(
    toolsPane(
      selectAllGroups,
      selectedGroups,
      null,
      book,
      dataBrowserContext,
      me,
      (refreshGroups) => {
        ctx.groupBar.refresh()
      }
    )
  )
}

export { saveNewGroup, addPersonToGroup, groupMembers, saveNewContact } from './contactLogic'
export { addWebIDToContacts, removeWebIDFromContacts, getPersonas } from './webidControl'
