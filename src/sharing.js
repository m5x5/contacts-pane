import {
  solidLogicSingleton,
  authn,
} from 'solid-logic'
import { BlankNode, st } from 'rdflib'
import * as UI from 'solid-ui'
import * as debug from './debug'


const {
  getRegistrations,
  loadAllTypeIndexes
} = solidLogicSingleton.typeIndex

/**
 * UI to control registration of instance
 */
export async function registrationControl (
  context,
  instance,
  theClass
) {
  function registrationStatements (index) {
    const registrations = getRegistrations(instance, theClass)
    const reg = registrations.length ? registrations[0] : UI.widgets.newThing(index)
    return [
      st(reg, UI.ns.solid('instance'), instance, index),
      st(reg, UI.ns.solid('forClass'), theClass, index)
    ]
  }

  function renderScopeCheckbox (scope) {
    const statements = registrationStatements(scope.index)
    const name = scopeLabel(context, scope)
    const label = `${name} link to this ${context.noun}`
    return UI.widgets.buildCheckboxForm(
      context.dom,
      solidLogicSingleton.store,
      label,
      null,
      statements,
      form,
      scope.index
    )
  }
  /// / body of registrationControl
  const dom = context.dom
  if (!dom || !context.div) {
    throw new Error('registrationControl: need dom and div')
  }
  const box = dom.createElement('div')
  context.div.appendChild(box)
  context.me = authn.currentUser() // @@
  const me = context.me
  if (!me) {
    box.innerHTML = '<p style="margin:2em;">(Log in to save a link to this)</p>'
    return context
  }

  let scopes // @@ const
  try {
    scopes = await loadAllTypeIndexes(me)
  } catch (e) {
    let msg
    if (context.div && context.preferencesFileError) {
      msg = '(Lists of stuff not available)'
      context.div.appendChild(dom.createElement('p')).textContent = msg
    } else if (context.div) {
      msg = `registrationControl: Type indexes not available: ${e}`
      context.div.appendChild(UI.widgets.errorMessageBlock(context.dom, e))
    }
    debug.log(msg)
    return context
  }

  box.innerHTML = '<table><tbody></tbody></table>' // tbody will be inserted anyway
  box.setAttribute('style', 'font-size: 120%; text-align: right; padding: 1em; border: solid gray 0.05em;')
  const tbody = box.children[0].children[0]
  const form = new BlankNode() // @@ say for now

  for (const scope of scopes) {
    const row = tbody.appendChild(dom.createElement('tr'))
    row.appendChild(renderScopeCheckbox(scope)) // @@ index
  }
  return context
}

function scopeLabel (context, scope) {
  const mine = context.me && context.me.sameTerm(scope.agent)
  const name = mine ? '' : UI.utils.label(scope.agent) + ' '
  return `${name}${scope.label}`
}