import { addPersonToGroup, groupMembers, getDataModelIssues } from './contactLogic'
import * as UI from 'solid-ui'
import { authn, store } from 'solid-logic'
import * as debug from './debug'
import { complain, alertDialog, getSameAs, deleteRecursive, deleteThingAndDoc, compareForSort, nameFor } from './localUtils'
import { renderDeleteButton } from './components/delete-button'
import { groupMembership } from './groupMembershipControl'

const ns = UI.ns
const utils = UI.utils
const kb = store
let dom
let selectedGroups = {}
let selectedPeople = {}
let ulPeople = null
let searchInput = null
let cardMain = null
let book = null
let dataBrowserContext = null

// ######## Group presenter

/** Point the presenter at the current address book and its shared elements.
 * The group bar renders itself now, so this only wires up the module state the
 * people list and its helpers still read.
 */
export function configureAddressBook ({ book: currentBook, dom: domElement, selectedGroups: groupsSelected, ulPeople: peopleUl, searchInput: searchEl, cardMain: cardMainEl, dataBrowserContext: context }) {
  if (domElement) dom = domElement
  if (groupsSelected) selectedGroups = groupsSelected
  if (peopleUl) ulPeople = peopleUl
  if (searchEl) searchInput = searchEl
  if (cardMainEl) cardMain = cardMainEl
  if (context) dataBrowserContext = context
  book = currentBook
}

/** How many contacts a group holds, or null while its document is unread.
 * An empty group still describes itself (type, fn), so "no statements at all"
 * is a reliable stand-in for "not fetched yet" -- and lets us show nothing
 * rather than a misleading 0.
 */
export function groupMemberCount (group) {
  const loaded = kb.statementsMatching(null, null, null, group.doc()).length > 0

  return loaded ? groupMembers(kb, group).length : null
}

export async function handleURIsDroppedOnGroup (uris, group) {
  for (const u of uris) {
    let thing = kb.sym(u)
    try {
      thing = await addPersonToGroup(thing, group)
    } catch (_e) {
      const msg = 'Error adding to group. Make sure you are adding a contact URI.'
      alertDialog(msg)
    }
    if (thing) refreshNames(ulPeople)
  }
}

/** Load and select every group listed in a container whose rows carry `.subject`.
 * The group bar renders itself and selects groups directly; this remains for
 * toolsPane, which drives a table of its own.
 */
export function selectAllGroups (
  selectedGroups,
  ulGroups,
  callbackFunction
) {
  function fetchGroupAndSelect (group, groupLi) {
    return new Promise((resolve, reject) => {
      groupLi.classList.add('group-loading')
      groupLi.setAttribute('aria-busy', 'true')
      kb.fetcher.nowOrWhenFetched(group.doc(), undefined, function (
        ok,
        message
      ) {
        if (!ok) {
          const msg = 'Cannot load group ' + group + '. Stack: ' + message
          debug.error(msg)
          if (callbackFunction) callbackFunction(false, msg)
          reject(msg)
          return
        }
        groupLi.classList.remove('group-loading')
        groupLi.setAttribute('aria-busy', 'false')
        groupLi.classList.add('selected')
        selectedGroups[group.uri] = true
        refreshNames(ulPeople, null) // @@ every time??
        if (callbackFunction) callbackFunction(true)
        resolve(true)
      })
    })
  }

  for (let k = 0; k < ulGroups.children.length; k++) {
    const groupLi = ulGroups.children[k]
    const group = groupLi.subject
    if (!group) continue // Skip non-group items (e.g. All contacts, New group)
    fetchGroupAndSelect(group, groupLi)
      .catch(err => {
        if (callbackFunction) callbackFunction(false, err)
      })
  } // for each row
}

export function groupsInOrder (book, options) {
  let sortMe = []
  if (options.foreignGroup) {
    sortMe.push([
      '',
      kb.any(options.foreignGroup, ns.vcard('fn')),
      options.foreignGroup
    ])
  }
  if (book) {
    const groupIndex = kb.any(book, ns.vcard('groupIndex'))
    const gs = book ? kb.each(book, ns.vcard('includesGroup'), null, groupIndex) : []
    const gs2 = gs.map(function (g) {
      return [book, kb.any(g, ns.vcard('fn')), g]
    })
    sortMe = sortMe.concat(gs2)
    sortMe.sort()
  }
  return sortMe.map(tuple => tuple[2])
}

export async function loadAllGroups (book) {
  const groupIndex = kb.any(book, ns.vcard('groupIndex'))
  if (groupIndex) {
    await kb.fetcher.load(groupIndex)
    const gs = book ? kb.each(book, ns.vcard('includesGroup'), null, groupIndex) : []
    await kb.fetcher.load(gs)
    return gs
  } else {
    return [] // no groups
  }
}

// The book could be the main subject, or linked from a group we are dealing with
export function findBookFromGroups (book) {
  if (book) {
    return book
  }
  let g
  for (const gu in selectedGroups) {
    g = kb.sym(gu)
    const b = kb.any(undefined, ns.vcard('includesGroup'), g)
    if (b) return b
  }
  throw new Error(
    'findBookFromGroups: Cant find address book which this group is part of'
  )
}
// ######## Group presenter - END

// ######## Person presenter
/** Refresh the list of names */
export function refreshNames (ulPeopleArg, detailsView, autoSelect = true) {
  // If the caller did not explicitly pass a list element, fall back to the
  // global variable that other helpers (renderGroupButtons, syncGroupUl, etc.)
  // keep up to date.  This allows callers that don't have easy access to the
  // element to simply invoke `refreshNames()` and get the behaviour they
  // expect when the address-book UI is present.
  const ul = ulPeopleArg || ulPeople

  // Guard: ul must be a DOM element with children.  Callers sometimes pass the
  // wrong thing (e.g. a person object) which leads to the
  // "Cannot read properties of undefined (reading 'length')" error in
  // syncTableToArrayReOrdered.  Bail out early if the value is not valid.
  if (!ul || !ul.children || typeof ul.children.length !== 'number') {
    debug.warn('refreshNames called with invalid ulPeople:', ul)
    return
  }

  function setPersonListener (personLi, person) {
    function handleSelect (event) {
      event.preventDefault()
      selectPerson(ul, person, cardMain)
    }
    personLi.addEventListener('click', handleSelect)
    personLi.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        handleSelect(event)
      }
    })
  }

  let cards = []
  const groups = Object.keys(selectedGroups).map(groupURI => kb.sym(groupURI))
  groups.forEach(group => {
    if (selectedGroups[group.value]) {
      cards = cards.concat(groupMembers(kb, group))
    }
  })
  cards.sort(compareForSort) // @@ sort by name not UID later
  for (let k = 0; k < cards.length - 1;) {
    if (cards[k].uri === cards[k + 1].uri) {
      cards.splice(k, 1) // Eliminate duplicates from more than one group
    } else {
      k++
    }
  }

  function renderNameInGroupList (person, ul) {
    const personLi = dom.createElement('li')
    personLi.setAttribute('role', 'listitem')
    personLi.setAttribute('tabindex', '0')
    personLi.classList.add('personLi')
    personLi.subject = person
    UI.widgets.makeDraggable(personLi, person)

    // Container for the row
    const rowDiv = dom.createElement('div')
    rowDiv.classList.add('personLi-row')

    // Left: Avatar
    const avatarDiv = dom.createElement('div')
    avatarDiv.classList.add('personLi-avatar')
    // Placeholder avatar (shown initially while person doc loads)
    const placeholderEl = dom.createElement('div')
    placeholderEl.classList.add('avatar-placeholder')
    placeholderEl.innerHTML = '<svg aria-hidden="true" width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="18" cy="18" r="18" fill="#e0e0e0"/><text x="50%" y="58%" text-anchor="middle" fill="#595959" font-size="16" font-family="Arial" dy=".3em">?</text></svg>'
    avatarDiv.appendChild(placeholderEl)

    // Get name early so it can be used in trySetAvatar
    const name = nameFor(person) || 'Unknown Name'

    // Try to set avatar from already-loaded data, or fetch the person's doc
    function trySetAvatar () {
      const avatarUrl = kb.any(person, ns.vcard('hasPhoto'))
      if (avatarUrl && avatarUrl.value) {
        const img = dom.createElement('img')
        img.src = avatarUrl.value
        img.alt = name + ' avatar'
        avatarDiv.replaceChild(img, avatarDiv.firstChild)
      }
    }
    trySetAvatar() // check if already in store

    // Load person's own document in background to get hasPhoto
    kb.fetcher.nowOrWhenFetched(person.doc(), undefined, function (ok, message) {
      if (!ok) {
        debug.error('Cannot load contact: ' + person + '. Stack: ' + message)
        personLi.classList.add('personLi--error')
        return // skip avatar – doc is unavailable
      }
      trySetAvatar()
    })

    // Center: Name
    const infoDiv = dom.createElement('div')
    infoDiv.classList.add('personLi-info')

    personLi.setAttribute('aria-label', name)
    const nameDiv = dom.createElement('div')
    nameDiv.classList.add('personLi-name')
    nameDiv.textContent = name

    infoDiv.appendChild(nameDiv)

    // Right: Arrow icon
    const arrowDiv = dom.createElement('div')
    arrowDiv.classList.add('personLi-arrow')
    arrowDiv.innerHTML = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 4.5L11.25 9L6 13.5" stroke="#595959" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'

    // Assemble
    rowDiv.appendChild(avatarDiv)
    rowDiv.appendChild(infoDiv)
    rowDiv.appendChild(arrowDiv)
    personLi.appendChild(rowDiv)

    setPersonListener(personLi, person)
    return personLi
  }

  utils.syncTableToArrayReOrdered(ul, cards, person => renderNameInGroupList(person, ul))
  refreshFilteredPeople(ul, autoSelect, detailsView || cardMain)
} // refreshNames

export function selectPerson (ulPeople, person, detailsView) {
  if (!detailsView) return
  if (detailsView.parentNode) detailsView.parentNode.classList.remove('hidden')
  detailsView.innerHTML = 'Loading...'
  detailsView.setAttribute('aria-busy', 'true')
  detailsView.classList.add('detailsSectionContent--wide')
  selectedPeople = {}
  selectedPeople[person.uri] = true
  refreshFilteredPeople(ulPeople, false, detailsView) // Color to remember which one you picked
  let local
  try {
    local = book ? localNode(person) : person
  } catch (err) {
    detailsView.innerHTML = ''
    detailsView.setAttribute('aria-busy', 'false')
    complain(detailsView, dom, 'Cannot load contact: ' + err.message)
    return
  }
  kb.fetcher.nowOrWhenFetched(local.doc(), undefined, function (
    ok,
    message
  ) {
    detailsView.innerHTML = ''
    detailsView.setAttribute('aria-busy', 'false')
    if (!ok) {
      debug.error('Failed to load contact card: ' + local + '. Stack: ' + message)
      complain(detailsView, dom, 'Failed to load contact. If it persists, contact your admin.')
      return
    }
    // debug.log("Loaded card " + local + '\n')

    // Top-right toolbar with link icon and delete button
    const toolbar = dom.createElement('div')
    toolbar.classList.add('contact-toolbar')
    const linkEl = UI.widgets.linkIcon(dom, local)
    linkEl.setAttribute('title', 'Uri of contact')
    toolbar.appendChild(linkEl)

    if (authn.currentUser()) {
      // Add in a delete button to delete from AB
      const deleteButton = renderDeleteButton(
        dom,
        toolbar, // appends it to toolbar.appendChild(deleteButton)
        'contact',
        async function () {
          const container = person.dir() // ASSUMPTION THAT CARD IS IN ITS OWN DIRECTORY

          const pname = kb.any(person, ns.vcard('fn'))
          debug.log('We are about to delete the contact ' + pname)

          //  - delete person's WebID's in each Group
          //  - delete the references to it in group files and save them back
          //  - delete the reference in people.ttl and save it back

          let removeFromGroups = []
          try {
            await loadAllGroups() // need to wait for all groups to be loaded in case they have a link to this person
            // load people.ttl
            const nameEmailIndex = kb.any(book, ns.vcard('nameEmailIndex'))
            await kb.fetcher.load(nameEmailIndex)

            // find all Groups
            const groups = groupMembership(person)
            // find person WebID's
            groups.forEach(group => {
              const webids = getSameAs(kb, person, group.doc())
              // for each check in each Group that it is not used by an other person then delete
              webids.forEach(webid => {
                if (getSameAs(kb, webid, group.doc()).length === 1) {
                  removeFromGroups = removeFromGroups.concat(kb.statementsMatching(group, ns.vcard('hasMember'), webid, group.doc()))
                }
              })
            })

            // Only if folder deletion succeeds, proceed with person deletion
            await kb.updater.updateMany(removeFromGroups)
          } catch (err) {
            // Without this the handler rejected silently and nothing at all happened
            debug.error('Error removing contact from its groups. Stack: ' + err)
            complain(detailsView, dom, 'Failed to remove the contact from its groups. If it persists, contact your admin.')
            return
          }

          try {
            await deleteThingAndDoc(person)
          } catch (err) {
            complain(detailsView, dom, 'Failed to delete contact. If it persists, contact your admin.')
            return
          }

          try {
            await deleteRecursive(kb, container, toolbar, dom)
          } catch (err) {
            const msg = 'Failed to delete contact. If it persists, contact your admin.'
            complain(detailsView, dom, msg)
            return
          }
          refreshNames(ulPeople, detailsView)
          detailsView.innerHTML = 'Contact data deleted.'
        }
      )
      deleteButton.classList.add('deleteButton')
    }
    detailsView.appendChild(toolbar)

    detailsView.classList.add('detailsSectionContent--wide')
    detailsView.appendChild(renderPane(local, 'contact'))
  })
}

export function deselectAllPeople (ulPeople) {
  selectedPeople = {}
  if (ulPeople) {
    for (let i = 0; i < ulPeople.children.length; i++) {
      ulPeople.children[i].classList.remove('selected')
    }
  }
}

export function refreshFilteredPeople (ulPeople, active, detailsView) {
  let count = 0
  let lastRow = null
  for (let i = 0; i < ulPeople.children.length; i++) {
    const liElement = ulPeople.children[i]
    const matches = filterName(nameFor(liElement.subject))
    if (matches) {
      count++
      lastRow = liElement
    }
    liElement.classList.toggle('selected', matches && !!selectedPeople[liElement.subject.uri])
    liElement.classList.toggle('hidden', !matches)
  }
  if (count === 1 && active) {
    const unique = lastRow.subject
    selectPerson(ulPeople, unique, detailsView)
  }
}

function filterName (name) {
  const filter = searchInput.value.trim().toLowerCase()
  if (filter.length === 0) return true
  const parts = filter.split(' ') // Each name part must be somewhere
  for (let j = 0; j < parts.length; j++) {
    const word = parts[j]
    if (name.toLowerCase().indexOf(word) < 0) return false
  }
  return true
}

function renderPane (subject, paneName) {
  const p = dataBrowserContext.session.paneRegistry.byName(paneName)
  const d = p.render(subject, dataBrowserContext)
  d.classList.add('renderPane')
  return d
}

function localNode (person) {
  const aliases = kb.allAliases(person)
  const prefix = book.dir().uri
  for (let i = 0; i < aliases.length; i++) {
    if (aliases[i].uri.slice(0, prefix.length) === prefix) {
      return aliases[i]
    }
  }
  throw new Error('No local URI for ' + person)
}

// Check every group is in the list and add it if not.
export async function checkDataModel (book, detailsSectionContent) {
  // await kb.fetcher.load(groups) // asssume loaded already
  const groups = await loadAllGroups(book)

  if (groups && groups.length > 0) {
    const { del, ins } = await getDataModelIssues(groups)

    if (authn.currentUser()) {
      if (del.length) {
        renderDeleteButton(
          dom,
          detailsSectionContent, // where it appends it to
          'contact',
          async function () {
            await kb.updater.updateMany(del, ins)
            debug.log('Deleted ' + del.length + ' bad statements from groups')
          },
          { message: 'Clean up ' + del.length + ' bad statement(s) in the group files?' })
      }
    }
  }
}

// Prepare book data once so askName forms load instantly
export async function ensureBookLoaded () {
  const ourBook = findBookFromGroups(book)
  try {
    await kb.fetcher.load(ourBook)
  } catch (err) {
    throw new Error('Book won\'t load:' + ourBook)
  }
  const nameEmailIndex = kb.any(ourBook, ns.vcard('nameEmailIndex'))
  if (!nameEmailIndex) throw new Error('No nameEmailIndex')
  await kb.fetcher.load(nameEmailIndex)
}
