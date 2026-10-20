// North Server admin panel (ADR 0018 fase 3b). Plain ES module, no build step:
// it talks to the same /api/v1 as the desktop and builds the DOM by hand, so
// nothing a user typed is ever parsed as HTML.

const STRINGS = {
  'pt-BR': {
    title: 'Painel admin',
    signInHint: 'Entre com o seu e-mail de admin desta organização.',
    email: 'E-mail',
    signIn: 'Entrar',
    devNotice: 'Login de teste por e-mail. O login corporativo (Entra ID) chega em breve.',
    entraSoon: 'Este servidor usa login corporativo (Entra ID), que chega em breve no painel.',
    notAdmin: 'Só admins usam este painel. Peça a um admin para mudar o seu papel.',
    signOut: 'Sair',
    people: 'Pessoas',
    projects: 'Projetos',
    audit: 'Auditoria',
    peopleHint:
      'Quem entra pela primeira vez vira membro sem acesso. Adicione a pessoa antes para já liberar projetos.',
    name: 'Nome',
    role: 'Papel',
    status: 'Situação',
    projectsCount: 'Projetos',
    admin: 'Admin',
    member: 'Membro',
    active: 'Ativo',
    disabled: 'Desativado',
    disable: 'Desativar',
    enable: 'Reativar',
    addPerson: 'Adicionar pessoa',
    nameOptional: 'Nome (opcional)',
    add: 'Adicionar',
    you: 'você',
    projectsHint:
      'O acesso vale para o projeto escolhido e tudo abaixo dele. Admins veem tudo e não aparecem aqui.',
    pickProject: 'Escolha um cliente, ambiente ou grupo.',
    whoHasAccess: 'Quem tem acesso',
    nobody: 'Só os admins.',
    noMembers: 'Ainda não há membros. Adicione pessoas na aba Pessoas.',
    inherited: 'herdado de {name}',
    remove: 'Remover',
    person: 'Pessoa',
    give: 'Dar acesso',
    editor: 'Editor',
    viewer: 'Visualizador',
    client: 'cliente',
    environment: 'ambiente',
    group: 'grupo',
    noClients: 'Nenhum cliente ainda. Crie pelo North.',
    auditHint: 'Leituras de senha e mudanças de acesso, das mais novas para as mais antigas.',
    when: 'Quando',
    who: 'Quem',
    action: 'Ação',
    target: 'Alvo',
    detail: 'Detalhe',
    filter: 'Filtrar',
    noEvents: 'Nada registrado ainda.',
    failed: 'Não foi possível concluir. Tente de novo.',
    'action.secret.create': 'senha criada',
    'action.secret.write': 'senha trocada',
    'action.secret.delete': 'senha removida',
    'action.secret.read': 'senha lida',
    'action.user.create': 'pessoa adicionada',
    'action.user.update': 'pessoa alterada',
    'action.grant.set': 'acesso dado',
    'action.grant.delete': 'acesso removido',
    'purpose.session': 'para conectar',
    'purpose.reveal': 'para ver',
    'purpose.paste': 'para colar'
  },
  en: {
    title: 'Admin panel',
    signInHint: 'Sign in with your admin e-mail for this organization.',
    email: 'E-mail',
    signIn: 'Sign in',
    devNotice: 'Test sign-in by e-mail. Corporate sign-in (Entra ID) is coming soon.',
    entraSoon: 'This server uses corporate sign-in (Entra ID), coming soon to the panel.',
    notAdmin: 'Only admins use this panel. Ask an admin to change your role.',
    signOut: 'Sign out',
    people: 'People',
    projects: 'Projects',
    audit: 'Audit',
    peopleHint:
      'First-time sign-ins become members with no access. Add the person first to share projects right away.',
    name: 'Name',
    role: 'Role',
    status: 'Status',
    projectsCount: 'Projects',
    admin: 'Admin',
    member: 'Member',
    active: 'Active',
    disabled: 'Disabled',
    disable: 'Disable',
    enable: 'Enable',
    addPerson: 'Add person',
    nameOptional: 'Name (optional)',
    add: 'Add',
    you: 'you',
    projectsHint:
      'Access applies to the chosen project and everything under it. Admins see everything and are not listed.',
    pickProject: 'Pick a client, environment or group.',
    whoHasAccess: 'Who has access',
    nobody: 'Admins only.',
    noMembers: 'No members yet. Add people in the People tab.',
    inherited: 'inherited from {name}',
    remove: 'Remove',
    person: 'Person',
    give: 'Give access',
    editor: 'Editor',
    viewer: 'Viewer',
    client: 'client',
    environment: 'environment',
    group: 'group',
    noClients: 'No clients yet. Create them in North.',
    auditHint: 'Password reads and access changes, newest first.',
    when: 'When',
    who: 'Who',
    action: 'Action',
    target: 'Target',
    detail: 'Detail',
    filter: 'Filter',
    noEvents: 'Nothing recorded yet.',
    failed: 'Could not finish. Try again.',
    'action.secret.create': 'password created',
    'action.secret.write': 'password changed',
    'action.secret.delete': 'password removed',
    'action.secret.read': 'password read',
    'action.user.create': 'person added',
    'action.user.update': 'person changed',
    'action.grant.set': 'access given',
    'action.grant.delete': 'access removed',
    'purpose.session': 'to connect',
    'purpose.reveal': 'to view',
    'purpose.paste': 'to paste'
  },
  es: {
    title: 'Panel admin',
    signInHint: 'Inicia sesión con tu correo de admin de esta organización.',
    email: 'Correo',
    signIn: 'Entrar',
    devNotice: 'Inicio de prueba por correo. El inicio corporativo (Entra ID) llega pronto.',
    entraSoon: 'Este servidor usa inicio corporativo (Entra ID), que llega pronto al panel.',
    notAdmin: 'Solo los admins usan este panel. Pide a un admin que cambie tu rol.',
    signOut: 'Salir',
    people: 'Personas',
    projects: 'Proyectos',
    audit: 'Auditoría',
    peopleHint:
      'Quien entra por primera vez queda como miembro sin acceso. Agrega a la persona antes para asignarle proyectos.',
    name: 'Nombre',
    role: 'Rol',
    status: 'Estado',
    projectsCount: 'Proyectos',
    admin: 'Admin',
    member: 'Miembro',
    active: 'Activo',
    disabled: 'Desactivado',
    disable: 'Desactivar',
    enable: 'Reactivar',
    addPerson: 'Agregar persona',
    nameOptional: 'Nombre (opcional)',
    add: 'Agregar',
    you: 'tú',
    projectsHint:
      'El acceso vale para el proyecto elegido y todo lo que hay debajo. Los admins ven todo y no aparecen aquí.',
    pickProject: 'Elige un cliente, entorno o grupo.',
    whoHasAccess: 'Quién tiene acceso',
    nobody: 'Solo los admins.',
    noMembers: 'Todavía no hay miembros. Agrega personas en la pestaña Personas.',
    inherited: 'heredado de {name}',
    remove: 'Quitar',
    person: 'Persona',
    give: 'Dar acceso',
    editor: 'Editor',
    viewer: 'Lector',
    client: 'cliente',
    environment: 'entorno',
    group: 'grupo',
    noClients: 'Todavía no hay clientes. Créalos en North.',
    auditHint: 'Lecturas de contraseñas y cambios de acceso, de los más nuevos a los más viejos.',
    when: 'Cuándo',
    who: 'Quién',
    action: 'Acción',
    target: 'Destino',
    detail: 'Detalle',
    filter: 'Filtrar',
    noEvents: 'Nada registrado todavía.',
    failed: 'No se pudo completar. Inténtalo de nuevo.',
    'action.secret.create': 'contraseña creada',
    'action.secret.write': 'contraseña cambiada',
    'action.secret.delete': 'contraseña quitada',
    'action.secret.read': 'contraseña leída',
    'action.user.create': 'persona agregada',
    'action.user.update': 'persona cambiada',
    'action.grant.set': 'acceso dado',
    'action.grant.delete': 'acceso quitado',
    'purpose.session': 'para conectar',
    'purpose.reveal': 'para ver',
    'purpose.paste': 'para pegar'
  }
}

const locale = (() => {
  const wanted = new URLSearchParams(location.search).get('lang') ?? navigator.language ?? 'pt-BR'
  if (wanted.toLowerCase().startsWith('en')) return 'en'
  if (wanted.toLowerCase().startsWith('es')) return 'es'
  return 'pt-BR'
})()
document.documentElement.lang = locale

const t = (key, vars = {}) =>
  (STRINGS[locale][key] ?? STRINGS['pt-BR'][key] ?? key).replace(/\{(\w+)\}/g, (_, k) =>
    String(vars[k] ?? '')
  )

/** `h('button', { onclick }, 'Save')` — attributes, then text or nodes as children. */
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue
    if (key.startsWith('on')) el.addEventListener(key.slice(2), value)
    else if (key === 'testid') el.dataset.testid = value
    else el.setAttribute(key, value === true ? '' : String(value))
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue
    el.append(child instanceof Node ? child : document.createTextNode(String(child)))
  }
  return el
}

// ── session ────────────────────────────────────────────────────────────────

/** Access token in memory only; the refresh token survives a reload in this tab. */
const REFRESH_KEY = 'north-admin-refresh'
let accessToken = null

const storage = {
  get: () => {
    try {
      return sessionStorage.getItem(REFRESH_KEY)
    } catch {
      return null
    }
  },
  set: (value) => {
    try {
      if (value) sessionStorage.setItem(REFRESH_KEY, value)
      else sessionStorage.removeItem(REFRESH_KEY)
    } catch {
      /* private mode: the session just ends with the tab */
    }
  }
}

class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

async function raw(method, path, body, token) {
  const res = await fetch(path, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  if (res.status === 204) return undefined
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data?.error?.message ?? t('failed'))
  return data
}

async function refresh() {
  const token = storage.get()
  if (!token) return false
  try {
    const pair = await raw('POST', '/api/v1/auth/refresh', { refreshToken: token })
    accessToken = pair.accessToken
    storage.set(pair.refreshToken)
    return true
  } catch {
    storage.set(null)
    accessToken = null
    return false
  }
}

/** Calls the API, renewing the access token once on a 401. */
async function api(method, path, body) {
  try {
    return await raw(method, path, body, accessToken)
  } catch (error) {
    if (error.status !== 401 || !(await refresh())) {
      if (error.status === 401) return showLogin()
      throw error
    }
    return raw(method, path, body, accessToken)
  }
}

// ── app ────────────────────────────────────────────────────────────────────

const root = document.getElementById('app')
const state = { info: null, me: null, tab: 'people', selected: null }

function mount(...nodes) {
  root.replaceChildren(...nodes)
}

async function boot() {
  state.info = await raw('GET', '/api/v1/info').catch(() => ({
    name: 'North Server',
    auth: { modes: [] }
  }))
  document.title = `${state.info.name} · ${t('title')}`
  if (await refresh()) return showApp()
  showLogin()
}

function showLogin(message) {
  accessToken = null
  const devMode = state.info?.auth?.modes?.includes('dev')
  const error = h('p', { class: 'error', role: 'alert', testid: 'login-error' }, message ?? '')
  const email = h('input', { id: 'email', type: 'email', required: true, autocomplete: 'email' })
  const form = h(
    'form',
    {
      onsubmit: async (event) => {
        event.preventDefault()
        error.textContent = ''
        try {
          const session = await raw('POST', '/api/v1/auth/dev/login', { email: email.value })
          accessToken = session.accessToken
          storage.set(session.refreshToken)
          await showApp()
        } catch (e) {
          error.textContent = e.message
        }
      }
    },
    h('div', { class: 'field' }, h('label', { for: 'email' }, t('email')), email),
    h('button', { class: 'btn primary', type: 'submit' }, t('signIn'))
  )
  mount(
    h(
      'main',
      { class: 'shell' },
      h(
        'div',
        { class: 'panel login' },
        h('h1', {}, state.info?.name ?? 'North Server'),
        h('p', { class: 'hint' }, t(devMode ? 'signInHint' : 'entraSoon')),
        devMode ? form : null,
        devMode ? h('p', { class: 'hint' }, t('devNotice')) : null,
        error
      )
    )
  )
  if (devMode) email.focus()
}

async function signOut() {
  const token = storage.get()
  storage.set(null)
  accessToken = null
  if (token)
    await raw('POST', '/api/v1/auth/logout', { refreshToken: token }).catch(() => undefined)
  showLogin()
}

async function showApp() {
  state.me = await api('GET', '/api/v1/me')
  if (!state.me) return
  if (state.me.role !== 'admin') {
    storage.set(null)
    return showLogin(t('notAdmin'))
  }
  render()
}

function render() {
  const tabs = ['people', 'projects', 'audit']
  const content = h('section', { class: 'stack', testid: `tab-${state.tab}` })
  mount(
    h(
      'main',
      { class: 'shell' },
      h(
        'header',
        { class: 'topbar' },
        h('span', { class: 'brand' }, state.info.name, h('small', {}, t('title'))),
        h('span', { class: 'spacer' }),
        h('span', { class: 'who' }, state.me.email),
        h('button', { class: 'btn ghost', onclick: signOut }, t('signOut'))
      ),
      h(
        'nav',
        { class: 'tabs', role: 'tablist' },
        tabs.map((tab) =>
          h(
            'button',
            {
              role: 'tab',
              'aria-selected': String(state.tab === tab),
              onclick: () => {
                state.tab = tab
                render()
              }
            },
            t(tab)
          )
        )
      ),
      content
    )
  )
  const views = { people: renderPeople, projects: renderProjects, audit: renderAudit }
  views[state.tab](content).catch((error) => {
    content.append(h('p', { class: 'error', role: 'alert' }, error.message))
  })
}

/** Runs an action and re-renders; failures show next to the control instead of throwing. */
function action(fn, errorSlot) {
  return async (event) => {
    event?.preventDefault?.()
    if (errorSlot) errorSlot.textContent = ''
    try {
      await fn()
      render()
    } catch (error) {
      if (errorSlot) errorSlot.textContent = error.message
      else alert(error.message)
    }
  }
}

// ── people ─────────────────────────────────────────────────────────────────

async function renderPeople(container) {
  const users = await api('GET', '/api/v1/admin/users')
  const error = h('p', { class: 'error', role: 'alert', testid: 'people-error' })
  const email = h('input', { id: 'new-email', type: 'email', required: true })
  const name = h('input', { id: 'new-name' })

  const rows = users.map((user) => {
    const self = user.id === state.me.id
    const role = h(
      'select',
      {
        'aria-label': `${t('role')} — ${user.email}`,
        onchange: action(
          () => api('PATCH', `/api/v1/admin/users/${user.id}`, { role: role.value }),
          error
        )
      },
      h('option', { value: 'admin', selected: user.role === 'admin' }, t('admin')),
      h('option', { value: 'member', selected: user.role === 'member' }, t('member'))
    )
    return h(
      'tr',
      { testid: `user-${user.email}` },
      h('td', { class: 'mono' }, user.email, self ? h('span', { class: 'badge' }, t('you')) : null),
      h('td', {}, user.name),
      h('td', {}, role),
      h(
        'td',
        {},
        h(
          'span',
          { class: user.disabled ? 'badge off' : 'badge' },
          t(user.disabled ? 'disabled' : 'active')
        )
      ),
      h('td', {}, user.role === 'admin' ? '—' : String(user.grants.length)),
      h(
        'td',
        {},
        h(
          'button',
          {
            class: user.disabled ? 'btn' : 'btn danger',
            onclick: action(
              () => api('PATCH', `/api/v1/admin/users/${user.id}`, { disabled: !user.disabled }),
              error
            )
          },
          t(user.disabled ? 'enable' : 'disable')
        )
      )
    )
  })

  container.append(
    h('div', {}, h('h1', {}, t('people')), h('p', { class: 'hint' }, t('peopleHint'))),
    h(
      'form',
      {
        class: 'panel',
        onsubmit: action(
          () =>
            api('POST', '/api/v1/admin/users', {
              email: email.value,
              name: name.value || undefined
            }),
          error
        )
      },
      h('h2', {}, t('addPerson')),
      h(
        'div',
        { class: 'row' },
        h('div', { class: 'field' }, h('label', { for: 'new-email' }, t('email')), email),
        h('div', { class: 'field' }, h('label', { for: 'new-name' }, t('nameOptional')), name),
        h('button', { class: 'btn primary', type: 'submit' }, t('add'))
      )
    ),
    error,
    h(
      'div',
      { class: 'panel table-wrap' },
      h(
        'table',
        {},
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            [t('email'), t('name'), t('role'), t('status'), t('projectsCount'), ''].map((c) =>
              h('th', {}, c)
            )
          )
        ),
        h('tbody', {}, rows)
      )
    )
  )
}

// ── projects ───────────────────────────────────────────────────────────────

async function renderProjects(container) {
  const [clients, environments, groups, users] = await Promise.all([
    api('GET', '/api/v1/clients'),
    api('GET', '/api/v1/environments'),
    api('GET', '/api/v1/groups'),
    api('GET', '/api/v1/admin/users')
  ])
  const names = new Map([...clients, ...environments, ...groups].map((n) => [n.id, n.name]))

  const node = (type, item, children) => {
    const current = state.selected?.id === item.id
    return h(
      'li',
      {},
      h(
        'button',
        {
          'aria-current': String(current),
          testid: `project-${item.name}`,
          onclick: () => {
            state.selected = { type, id: item.id, name: item.name }
            render()
          }
        },
        item.name,
        h('span', { class: 'kind' }, t(type))
      ),
      children?.length ? h('ul', {}, children) : null
    )
  }
  const tree =
    clients.length === 0
      ? h('p', { class: 'empty' }, t('noClients'))
      : h(
          'ul',
          { class: 'tree' },
          clients.map((c) =>
            node(
              'client',
              c,
              environments
                .filter((e) => e.clientId === c.id)
                .map((e) =>
                  node(
                    'environment',
                    e,
                    groups.filter((g) => g.environmentId === e.id).map((g) => node('group', g))
                  )
                )
            )
          )
        )

  const detail = h('div', { class: 'panel stack', testid: 'project-access' })
  if (!state.selected || !names.has(state.selected.id)) {
    state.selected = null
    detail.append(h('p', { class: 'empty' }, t('pickProject')))
  } else {
    await renderAccess(detail, state.selected, users, names)
  }

  container.append(
    h('div', {}, h('h1', {}, t('projects')), h('p', { class: 'hint' }, t('projectsHint'))),
    h(
      'div',
      { class: 'split' },
      h('nav', { class: 'panel', 'aria-label': t('projects') }, tree),
      detail
    )
  )
}

async function renderAccess(container, project, users, names) {
  const grants = await api(
    'GET',
    `/api/v1/admin/grants?scopeType=${project.type}&scopeId=${project.id}`
  )
  const error = h('p', { class: 'error', role: 'alert', testid: 'grant-error' })
  const members = users.filter((u) => u.role !== 'admin' && !u.disabled)
  const person = h(
    'select',
    { id: 'grant-user', required: true },
    members.map((u) => h('option', { value: u.id }, u.email))
  )
  const role = h(
    'select',
    { id: 'grant-role' },
    h('option', { value: 'viewer' }, t('viewer')),
    h('option', { value: 'editor' }, t('editor'))
  )

  const rows = grants.map((g) => {
    const direct = g.scopeId === project.id
    return h(
      'tr',
      { testid: `grant-${g.email}` },
      h('td', { class: 'mono' }, g.email),
      h('td', {}, t(g.role)),
      h('td', {}, direct ? '' : t('inherited', { name: names.get(g.scopeId) ?? '—' })),
      h(
        'td',
        {},
        direct
          ? h(
              'button',
              {
                class: 'btn danger',
                onclick: action(
                  () =>
                    api('DELETE', '/api/v1/admin/grants', {
                      userId: g.userId,
                      scopeType: g.scopeType,
                      scopeId: g.scopeId
                    }),
                  error
                )
              },
              t('remove')
            )
          : null
      )
    )
  })

  container.append(
    h('h2', {}, `${project.name} · ${t('whoHasAccess')}`),
    rows.length
      ? h('div', { class: 'table-wrap' }, h('table', {}, h('tbody', {}, rows)))
      : h('p', { class: 'empty' }, t('nobody')),
    members.length
      ? h(
          'form',
          {
            class: 'row',
            onsubmit: action(
              () =>
                api('PUT', '/api/v1/admin/grants', {
                  userId: person.value,
                  scopeType: project.type,
                  scopeId: project.id,
                  role: role.value
                }),
              error
            )
          },
          h('div', { class: 'field' }, h('label', { for: 'grant-user' }, t('person')), person),
          h('div', { class: 'field' }, h('label', { for: 'grant-role' }, t('role')), role),
          h('button', { class: 'btn primary', type: 'submit' }, t('give'))
        )
      : h('p', { class: 'hint' }, t('noMembers')),
    error
  )
}

// ── audit ──────────────────────────────────────────────────────────────────

function describeDetail(event) {
  const d = event.detail ?? {}
  if (d.purpose) return t(`purpose.${d.purpose}`)
  if (d.role) return t(d.role)
  if (d.disabled !== undefined) return t(d.disabled ? 'disabled' : 'active')
  return ''
}

async function renderAudit(container) {
  const events = await api('GET', '/api/v1/audit?limit=500')
  const filter = h('input', { id: 'audit-filter', type: 'search', placeholder: t('filter') })
  const body = h('tbody', {})
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'medium' })

  const draw = () => {
    const q = filter.value.trim().toLowerCase()
    const rows = events
      .map((e) => ({
        e,
        cells: [
          fmt.format(new Date(e.at)),
          e.userEmail ?? '—',
          t(`action.${e.action}`),
          e.targetName ?? '',
          describeDetail(e)
        ]
      }))
      .filter(({ cells }) => !q || cells.join(' ').toLowerCase().includes(q))
    body.replaceChildren(
      ...(rows.length
        ? rows.map(({ e, cells }) =>
            h(
              'tr',
              { testid: `audit-${e.action}` },
              cells.map((c, i) => h('td', { class: i < 2 ? 'mono' : undefined }, c))
            )
          )
        : [h('tr', {}, h('td', { colspan: 5, class: 'empty' }, t('noEvents')))])
    )
  }
  filter.addEventListener('input', draw)
  draw()

  container.append(
    h('div', {}, h('h1', {}, t('audit')), h('p', { class: 'hint' }, t('auditHint'))),
    h('div', { class: 'field' }, h('label', { for: 'audit-filter' }, t('filter')), filter),
    h(
      'div',
      { class: 'panel table-wrap' },
      h(
        'table',
        {},
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            [t('when'), t('who'), t('action'), t('target'), t('detail')].map((c) => h('th', {}, c))
          )
        ),
        body
      )
    )
  )
}

boot()
