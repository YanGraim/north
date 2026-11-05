// North Server admin panel (ADR 0018 fase 3b). Plain ES module, no build step:
// it talks to the same /api/v1 as the desktop and builds the DOM by hand, so
// nothing a user typed is ever parsed as HTML.

const STRINGS = {
  'pt-BR': {
    title: 'Painel admin',
    signInHint: 'Entre com o seu e-mail de admin desta organização.',
    email: 'E-mail',
    signIn: 'Entrar',
    devNotice: 'Login de teste por e-mail — só para servidores de teste.',
    entraButton: 'Entrar com a Microsoft',
    entraHint: 'Entre com a sua conta da empresa para gerenciar quem acessa o quê.',
    orDev: 'ou, num servidor de teste, entre por e-mail:',
    noSignIn: 'Este servidor não tem login configurado.',
    entraRefused: 'A Microsoft recusou o login',
    entraMismatch: 'O login não confere. Tente de novo.',
    notAdmin: 'Só admins usam este painel. Peça a um admin para mudar o seu papel.',
    signOut: 'Sair',
    overview: 'Visão geral',
    people: 'Pessoas',
    teams: 'Equipes',
    projects: 'Projetos',
    audit: 'Auditoria',
    overviewHint: 'Quem está na organização e o que aconteceu por último.',
    activePeople: 'Pessoas ativas',
    connections: 'Conexões',
    clients: 'Clientes',
    recentActivity: 'Atividade recente',
    seeAll: 'Ver tudo',
    howItWorks: 'Como funciona',
    how1: 'Adicione a pessoa pelo e-mail da empresa (ou espere ela entrar pela primeira vez).',
    how2: 'Dê acesso a um cliente, ambiente, grupo ou a uma conexão só — direto ou por uma equipe.',
    how3: 'Para tirar o acesso na hora, remova a liberação ou desative a pessoa.',
    peopleHint:
      'Quem entra pela primeira vez vira membro sem acesso. Adicione a pessoa antes para já liberar projetos.',
    searchPeople: 'Buscar por nome ou e-mail',
    all: 'Todos',
    active: 'Ativo',
    disabled: 'Desativado',
    admins: 'Admins',
    name: 'Nome',
    role: 'Papel',
    admin: 'Admin',
    member: 'Membro',
    disable: 'Desativar',
    enable: 'Reativar',
    disableConfirm: 'Desativar {email}? A pessoa perde o acesso na hora, em todos os computadores.',
    addPerson: 'Adicionar pessoa',
    nameOptional: 'Nome (opcional)',
    add: 'Adicionar',
    cancel: 'Cancelar',
    save: 'Salvar',
    you: 'você',
    nobodyFound: 'Ninguém encontrado.',
    accessCount: '{n} acesso(s)',
    seesEverything: 'vê tudo',
    noAccessYet: 'sem acesso',
    personTeams: 'Equipes',
    noTeams: 'Não está em nenhuma equipe.',
    addToTeam: 'Adicionar a uma equipe…',
    access: 'Acessos',
    accessHint:
      'Tudo o que esta pessoa vê no North. Acessos de equipe saem quando ela sai da equipe.',
    adminSeesAll: 'Admins veem e editam tudo na organização. Não é preciso dar acesso.',
    nothingShared: 'Nada liberado ainda.',
    direct: 'direto',
    viaTeam: 'pela equipe {name}',
    remove: 'Remover',
    giveAccess: 'Dar acesso',
    giveAccessHint: 'Escolha o que liberar. Vale para o item escolhido e tudo abaixo dele.',
    searchTree: 'Buscar cliente, grupo ou conexão',
    pickSomething: 'Escolha um item na lista.',
    give: 'Liberar',
    editor: 'Editor',
    viewer: 'Visualizador',
    editorHelp: 'Conecta, vê as senhas e edita.',
    viewerHelp: 'Conecta com a senha salva, mas não vê nem copia a senha.',
    client: 'cliente',
    environment: 'ambiente',
    group: 'grupo',
    connection: 'conexão',
    noClients: 'Nenhum cliente ainda. Crie pelo North.',
    teamsHint:
      'Libere projetos para uma equipe e todo mundo nela recebe o acesso. Quem sai da equipe perde na hora.',
    newTeam: 'Nova equipe',
    teamName: 'Nome da equipe',
    description: 'Descrição (opcional)',
    entraGroup: 'Grupo do Entra (opcional)',
    entraGroupHint:
      'ID do grupo no Microsoft Entra. Quem estiver no grupo entra na equipe ao fazer login, e sai quando deixar o grupo.',
    create: 'Criar',
    noTeamsYet: 'Nenhuma equipe ainda.',
    membersCount: '{n} pessoa(s)',
    members: 'Membros',
    noMembers: 'Ninguém na equipe ainda.',
    addMember: 'Adicionar pessoa…',
    fromEntra: 'pelo Entra',
    deleteTeam: 'Excluir equipe',
    deleteTeamConfirm: 'Excluir a equipe {name}? Os membros perdem os acessos dela.',
    edit: 'Editar',
    projectsHint:
      'Escolha um item para ver quem tem acesso a ele. Admins veem tudo e não aparecem aqui.',
    pickProject: 'Escolha um cliente, ambiente, grupo ou conexão.',
    whoHasAccess: 'Quem tem acesso',
    onlyAdmins: 'Só os admins.',
    inherited: 'herdado de {name}',
    giveTo: 'Liberar para',
    person: 'Pessoa',
    team: 'Equipe',
    noOneToGive: 'Adicione pessoas ou crie equipes primeiro.',
    auditHint: 'Leituras de senha e mudanças de acesso, das mais novas para as mais antigas.',
    when: 'Quando',
    who: 'Quem',
    action: 'Ação',
    target: 'Alvo',
    detail: 'Detalhe',
    filter: 'Filtrar',
    kindAll: 'Tudo',
    kindSecrets: 'Senhas',
    kindAccess: 'Acessos',
    kindPeople: 'Pessoas e equipes',
    noEvents: 'Nada registrado ainda.',
    failed: 'Não foi possível concluir. Tente de novo.',
    saved: 'Salvo.',
    'action.secret.create': 'senha criada',
    'action.secret.write': 'senha trocada',
    'action.secret.delete': 'senha removida',
    'action.secret.read': 'senha usada',
    'action.user.create': 'pessoa adicionada',
    'action.user.update': 'pessoa alterada',
    'action.grant.set': 'acesso dado',
    'action.grant.delete': 'acesso removido',
    'action.team.create': 'equipe criada',
    'action.team.update': 'equipe alterada',
    'action.team.delete': 'equipe excluída',
    'action.team.member.add': 'entrou na equipe',
    'action.team.member.remove': 'saiu da equipe',
    'purpose.session': 'para conectar',
    'purpose.reveal': 'para ver',
    'purpose.paste': 'para colar'
  },
  en: {
    title: 'Admin panel',
    signInHint: 'Sign in with your admin e-mail for this organization.',
    email: 'E-mail',
    signIn: 'Sign in',
    devNotice: 'Test sign-in by e-mail — for test servers only.',
    entraButton: 'Sign in with Microsoft',
    entraHint: 'Sign in with your work account to manage who can reach what.',
    orDev: 'or, on a test server, sign in by e-mail:',
    noSignIn: 'This server has no sign-in configured.',
    entraRefused: 'Microsoft refused the sign-in',
    entraMismatch: 'The sign-in did not match. Try again.',
    notAdmin: 'Only admins use this panel. Ask an admin to change your role.',
    signOut: 'Sign out',
    overview: 'Overview',
    people: 'People',
    teams: 'Teams',
    projects: 'Projects',
    audit: 'Audit',
    overviewHint: 'Who is in the organization and what happened last.',
    activePeople: 'Active people',
    connections: 'Connections',
    clients: 'Clients',
    recentActivity: 'Recent activity',
    seeAll: 'See all',
    howItWorks: 'How it works',
    how1: 'Add the person by their work e-mail (or wait for their first sign-in).',
    how2: 'Give access to a client, environment, group or a single connection — directly or through a team.',
    how3: 'To take access away right now, remove the grant or disable the person.',
    peopleHint:
      'First-time sign-ins become members with no access. Add the person first to share projects right away.',
    searchPeople: 'Search by name or e-mail',
    all: 'All',
    active: 'Active',
    disabled: 'Disabled',
    admins: 'Admins',
    name: 'Name',
    role: 'Role',
    admin: 'Admin',
    member: 'Member',
    disable: 'Disable',
    enable: 'Enable',
    disableConfirm: 'Disable {email}? They lose access right away, on every computer.',
    addPerson: 'Add person',
    nameOptional: 'Name (optional)',
    add: 'Add',
    cancel: 'Cancel',
    save: 'Save',
    you: 'you',
    nobodyFound: 'Nobody found.',
    accessCount: '{n} grant(s)',
    seesEverything: 'sees everything',
    noAccessYet: 'no access',
    personTeams: 'Teams',
    noTeams: 'Not in any team.',
    addToTeam: 'Add to a team…',
    access: 'Access',
    accessHint:
      'Everything this person sees in North. Team access goes away when they leave the team.',
    adminSeesAll: 'Admins see and edit everything in the organization. No grants needed.',
    nothingShared: 'Nothing shared yet.',
    direct: 'direct',
    viaTeam: 'through team {name}',
    remove: 'Remove',
    giveAccess: 'Give access',
    giveAccessHint: 'Pick what to share. It covers the chosen item and everything under it.',
    searchTree: 'Search client, group or connection',
    pickSomething: 'Pick an item from the list.',
    give: 'Share',
    editor: 'Editor',
    viewer: 'Viewer',
    editorHelp: 'Connects, sees passwords and edits.',
    viewerHelp: 'Connects with the saved password, but never sees or copies it.',
    client: 'client',
    environment: 'environment',
    group: 'group',
    connection: 'connection',
    noClients: 'No clients yet. Create them in North.',
    teamsHint:
      'Share projects with a team and everyone in it gets access. Whoever leaves the team loses it right away.',
    newTeam: 'New team',
    teamName: 'Team name',
    description: 'Description (optional)',
    entraGroup: 'Entra group (optional)',
    entraGroupHint:
      'Microsoft Entra group id. People in the group join the team when they sign in, and leave when they leave the group.',
    create: 'Create',
    noTeamsYet: 'No teams yet.',
    membersCount: '{n} people',
    members: 'Members',
    noMembers: 'Nobody in the team yet.',
    addMember: 'Add a person…',
    fromEntra: 'from Entra',
    deleteTeam: 'Delete team',
    deleteTeamConfirm: 'Delete team {name}? Its members lose the access it gave.',
    edit: 'Edit',
    projectsHint: 'Pick an item to see who can reach it. Admins see everything and are not listed.',
    pickProject: 'Pick a client, environment, group or connection.',
    whoHasAccess: 'Who has access',
    onlyAdmins: 'Admins only.',
    inherited: 'inherited from {name}',
    giveTo: 'Share with',
    person: 'Person',
    team: 'Team',
    noOneToGive: 'Add people or create teams first.',
    auditHint: 'Password reads and access changes, newest first.',
    when: 'When',
    who: 'Who',
    action: 'Action',
    target: 'Target',
    detail: 'Detail',
    filter: 'Filter',
    kindAll: 'All',
    kindSecrets: 'Passwords',
    kindAccess: 'Access',
    kindPeople: 'People and teams',
    noEvents: 'Nothing recorded yet.',
    failed: 'Could not finish. Try again.',
    saved: 'Saved.',
    'action.secret.create': 'password created',
    'action.secret.write': 'password changed',
    'action.secret.delete': 'password removed',
    'action.secret.read': 'password used',
    'action.user.create': 'person added',
    'action.user.update': 'person changed',
    'action.grant.set': 'access given',
    'action.grant.delete': 'access removed',
    'action.team.create': 'team created',
    'action.team.update': 'team changed',
    'action.team.delete': 'team deleted',
    'action.team.member.add': 'joined the team',
    'action.team.member.remove': 'left the team',
    'purpose.session': 'to connect',
    'purpose.reveal': 'to view',
    'purpose.paste': 'to paste'
  },
  es: {
    title: 'Panel admin',
    signInHint: 'Inicia sesión con tu correo de admin de esta organización.',
    email: 'Correo',
    signIn: 'Entrar',
    devNotice: 'Inicio de prueba por correo — solo para servidores de prueba.',
    entraButton: 'Iniciar sesión con Microsoft',
    entraHint: 'Inicia sesión con tu cuenta de la empresa para gestionar quién accede a qué.',
    orDev: 'o, en un servidor de prueba, inicia sesión por correo:',
    noSignIn: 'Este servidor no tiene inicio de sesión configurado.',
    entraRefused: 'Microsoft rechazó el inicio de sesión',
    entraMismatch: 'El inicio de sesión no coincide. Inténtalo de nuevo.',
    notAdmin: 'Solo los admins usan este panel. Pide a un admin que cambie tu rol.',
    signOut: 'Salir',
    overview: 'Resumen',
    people: 'Personas',
    teams: 'Equipos',
    projects: 'Proyectos',
    audit: 'Auditoría',
    overviewHint: 'Quién está en la organización y qué pasó por último.',
    activePeople: 'Personas activas',
    connections: 'Conexiones',
    clients: 'Clientes',
    recentActivity: 'Actividad reciente',
    seeAll: 'Ver todo',
    howItWorks: 'Cómo funciona',
    how1: 'Agrega a la persona por su correo de la empresa (o espera su primer inicio de sesión).',
    how2: 'Da acceso a un cliente, entorno, grupo o a una sola conexión — directo o por un equipo.',
    how3: 'Para quitar el acceso al instante, quita el permiso o desactiva a la persona.',
    peopleHint:
      'Quien entra por primera vez queda como miembro sin acceso. Agrega a la persona antes para asignarle proyectos.',
    searchPeople: 'Buscar por nombre o correo',
    all: 'Todos',
    active: 'Activo',
    disabled: 'Desactivado',
    admins: 'Admins',
    name: 'Nombre',
    role: 'Rol',
    admin: 'Admin',
    member: 'Miembro',
    disable: 'Desactivar',
    enable: 'Reactivar',
    disableConfirm:
      '¿Desactivar a {email}? Pierde el acceso al instante, en todas sus computadoras.',
    addPerson: 'Agregar persona',
    nameOptional: 'Nombre (opcional)',
    add: 'Agregar',
    cancel: 'Cancelar',
    save: 'Guardar',
    you: 'tú',
    nobodyFound: 'No se encontró a nadie.',
    accessCount: '{n} acceso(s)',
    seesEverything: 've todo',
    noAccessYet: 'sin acceso',
    personTeams: 'Equipos',
    noTeams: 'No está en ningún equipo.',
    addToTeam: 'Agregar a un equipo…',
    access: 'Accesos',
    accessHint:
      'Todo lo que esta persona ve en North. El acceso del equipo se va cuando sale del equipo.',
    adminSeesAll: 'Los admins ven y editan todo en la organización. No hace falta dar acceso.',
    nothingShared: 'Nada compartido todavía.',
    direct: 'directo',
    viaTeam: 'por el equipo {name}',
    remove: 'Quitar',
    giveAccess: 'Dar acceso',
    giveAccessHint: 'Elige qué compartir. Vale para el elemento elegido y todo lo que hay debajo.',
    searchTree: 'Buscar cliente, grupo o conexión',
    pickSomething: 'Elige un elemento de la lista.',
    give: 'Compartir',
    editor: 'Editor',
    viewer: 'Lector',
    editorHelp: 'Conecta, ve las contraseñas y edita.',
    viewerHelp: 'Conecta con la contraseña guardada, pero nunca la ve ni la copia.',
    client: 'cliente',
    environment: 'entorno',
    group: 'grupo',
    connection: 'conexión',
    noClients: 'Todavía no hay clientes. Créalos en North.',
    teamsHint:
      'Comparte proyectos con un equipo y todos en él reciben el acceso. Quien sale del equipo lo pierde al instante.',
    newTeam: 'Nuevo equipo',
    teamName: 'Nombre del equipo',
    description: 'Descripción (opcional)',
    entraGroup: 'Grupo de Entra (opcional)',
    entraGroupHint:
      'ID del grupo en Microsoft Entra. Quien esté en el grupo entra al equipo al iniciar sesión, y sale cuando deja el grupo.',
    create: 'Crear',
    noTeamsYet: 'Todavía no hay equipos.',
    membersCount: '{n} persona(s)',
    members: 'Miembros',
    noMembers: 'Todavía no hay nadie en el equipo.',
    addMember: 'Agregar persona…',
    fromEntra: 'por Entra',
    deleteTeam: 'Eliminar equipo',
    deleteTeamConfirm: '¿Eliminar el equipo {name}? Sus miembros pierden los accesos que daba.',
    edit: 'Editar',
    projectsHint:
      'Elige un elemento para ver quién tiene acceso. Los admins ven todo y no aparecen aquí.',
    pickProject: 'Elige un cliente, entorno, grupo o conexión.',
    whoHasAccess: 'Quién tiene acceso',
    onlyAdmins: 'Solo los admins.',
    inherited: 'heredado de {name}',
    giveTo: 'Compartir con',
    person: 'Persona',
    team: 'Equipo',
    noOneToGive: 'Agrega personas o crea equipos primero.',
    auditHint: 'Lecturas de contraseñas y cambios de acceso, de los más nuevos a los más viejos.',
    when: 'Cuándo',
    who: 'Quién',
    action: 'Acción',
    target: 'Destino',
    detail: 'Detalle',
    filter: 'Filtrar',
    kindAll: 'Todo',
    kindSecrets: 'Contraseñas',
    kindAccess: 'Accesos',
    kindPeople: 'Personas y equipos',
    noEvents: 'Nada registrado todavía.',
    failed: 'No se pudo completar. Inténtalo de nuevo.',
    saved: 'Guardado.',
    'action.secret.create': 'contraseña creada',
    'action.secret.write': 'contraseña cambiada',
    'action.secret.delete': 'contraseña quitada',
    'action.secret.read': 'contraseña usada',
    'action.user.create': 'persona agregada',
    'action.user.update': 'persona cambiada',
    'action.grant.set': 'acceso dado',
    'action.grant.delete': 'acceso quitado',
    'action.team.create': 'equipo creado',
    'action.team.update': 'equipo cambiado',
    'action.team.delete': 'equipo eliminado',
    'action.team.member.add': 'entró al equipo',
    'action.team.member.remove': 'salió del equipo',
    'purpose.session': 'para conectar',
    'purpose.reveal': 'para ver',
    'purpose.paste': 'para pegar'
  }
}

const locale = (() => {
  // Back from Microsoft the address has no ?lang; the pending sign-in remembers it.
  let pendingLang = null
  try {
    pendingLang = JSON.parse(sessionStorage.getItem('north-admin-pkce') ?? 'null')?.lang ?? null
  } catch {
    pendingLang = null
  }
  const wanted =
    new URLSearchParams(location.search).get('lang') ?? pendingLang ?? navigator.language ?? 'pt-BR'
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

// Lucide icons (ISC), the same set as the desktop, drawn as SVG nodes.
const ICONS = {
  overview: [
    ['rect', { x: 3, y: 3, width: 7, height: 9, rx: 1 }],
    ['rect', { x: 14, y: 3, width: 7, height: 5, rx: 1 }],
    ['rect', { x: 14, y: 12, width: 7, height: 9, rx: 1 }],
    ['rect', { x: 3, y: 16, width: 7, height: 5, rx: 1 }]
  ],
  people: [
    ['path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }],
    ['circle', { cx: 9, cy: 7, r: 4 }],
    ['path', { d: 'M22 21v-2a4 4 0 0 0-3-3.87' }],
    ['path', { d: 'M16 3.13a4 4 0 0 1 0 7.75' }]
  ],
  teams: [
    ['path', { d: 'M18 21a8 8 0 0 0-16 0' }],
    ['circle', { cx: 10, cy: 8, r: 5 }],
    ['path', { d: 'M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3' }]
  ],
  projects: [
    [
      'path',
      {
        d: 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z'
      }
    ]
  ],
  audit: [
    [
      'path',
      {
        d: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z'
      }
    ]
  ],
  client: [
    ['path', { d: 'M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z' }],
    ['path', { d: 'M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2' }],
    ['path', { d: 'M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2' }],
    ['path', { d: 'M10 6h4M10 10h4M10 14h4M10 18h4' }]
  ],
  environment: [
    [
      'path',
      {
        d: 'm12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z'
      }
    ],
    ['path', { d: 'm22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65' }],
    ['path', { d: 'm22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65' }]
  ],
  group: [
    [
      'path',
      {
        d: 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z'
      }
    ]
  ],
  connection: [
    ['rect', { x: 2, y: 2, width: 20, height: 8, rx: 2 }],
    ['rect', { x: 2, y: 14, width: 20, height: 8, rx: 2 }],
    ['path', { d: 'M6 6h.01M6 18h.01' }]
  ],
  search: [
    ['circle', { cx: 11, cy: 11, r: 8 }],
    ['path', { d: 'm21 21-4.3-4.3' }]
  ],
  plus: [['path', { d: 'M5 12h14M12 5v14' }]],
  x: [['path', { d: 'M18 6 6 18M6 6l12 12' }]],
  chevronRight: [['path', { d: 'm9 18 6-6-6-6' }]],
  chevronLeft: [['path', { d: 'm15 18-6-6 6-6' }]],
  logOut: [
    ['path', { d: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' }],
    ['path', { d: 'm16 17 5-5-5-5M21 12H9' }]
  ],
  key: [
    ['path', { d: 'm15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4' }],
    ['path', { d: 'm21 2-9.6 9.6' }],
    ['circle', { cx: 7.5, cy: 15.5, r: 5.5 }]
  ],
  trash: [
    ['path', { d: 'M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2' }]
  ]
}

const SVG = 'http://www.w3.org/2000/svg'

function icon(name) {
  const svg = document.createElementNS(SVG, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('class', 'icon')
  svg.setAttribute('aria-hidden', 'true')
  for (const [tag, attrs] of ICONS[name] ?? []) {
    const el = document.createElementNS(SVG, tag)
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v))
    svg.append(el)
  }
  return svg
}

const initials = (text) =>
  String(text || '?')
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')

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

// ── app state ──────────────────────────────────────────────────────────────

const root = document.getElementById('app')
const state = {
  info: null,
  me: null,
  data: null,
  peopleFilter: 'all',
  peopleQuery: '',
  auditKind: 'all',
  auditQuery: ''
}

function mount(...nodes) {
  root.replaceChildren(...nodes)
}

function toast(message, isError = false) {
  const el = h('div', { class: isError ? 'toast error-toast' : 'toast', role: 'status' }, message)
  document.body.append(el)
  setTimeout(() => el.remove(), isError ? 6000 : 2500)
}

/** Everything the panel draws from, fetched together and refreshed after each change. */
async function loadData() {
  const [users, teams, clients, environments, groups, connections] = await Promise.all([
    api('GET', '/api/v1/admin/users'),
    api('GET', '/api/v1/admin/teams'),
    api('GET', '/api/v1/clients'),
    api('GET', '/api/v1/environments'),
    api('GET', '/api/v1/groups'),
    api('GET', '/api/v1/connections')
  ])
  const nodes = new Map()
  for (const c of clients) nodes.set(c.id, { type: 'client', id: c.id, name: c.name, parent: null })
  for (const e of environments)
    nodes.set(e.id, { type: 'environment', id: e.id, name: e.name, parent: e.clientId })
  for (const g of groups)
    nodes.set(g.id, { type: 'group', id: g.id, name: g.name, parent: g.environmentId })
  for (const c of connections)
    nodes.set(c.id, {
      type: 'connection',
      id: c.id,
      name: c.name,
      parent: c.groupId,
      host: c.host,
      protocol: c.protocol
    })
  state.data = {
    users,
    teams,
    clients,
    environments,
    groups,
    connections,
    nodes,
    userById: new Map(users.map((u) => [u.id, u])),
    teamById: new Map(teams.map((tm) => [tm.id, tm]))
  }
}

/** "Acme › Prod › Web" for a node, its own name last. */
function pathOf(id) {
  const names = []
  let node = state.data.nodes.get(id)
  while (node) {
    names.unshift(node.name)
    node = node.parent ? state.data.nodes.get(node.parent) : null
  }
  return names
}

/**
 * Runs a change, reloads the data and redraws; errors become a toast. `fn` may
 * return `{ goTo }` to open another page once the fresh data is in.
 */
async function change(fn, message = t('saved')) {
  try {
    const result = await fn()
    await loadData()
    const target = result?.goTo ? `#${result.goTo}` : null
    if (target && location.hash !== target) location.hash = target
    else render()
    if (message) toast(message)
  } catch (error) {
    toast(error.message, true)
  }
}

// ── routing (#/people/<id> …) ──────────────────────────────────────────────

function route() {
  const [section = 'overview', id = null] = location.hash.replace(/^#\/?/, '').split('/')
  return { section, id: id ? decodeURIComponent(id) : null }
}

const go = (path) => {
  location.hash = path
}

window.addEventListener('hashchange', () => {
  if (state.me && state.data) render()
})

// ── boot / sign-in ─────────────────────────────────────────────────────────

async function boot() {
  state.info = await raw('GET', '/api/v1/info').catch(() => ({
    name: 'North Server',
    auth: { modes: [] }
  }))
  document.title = `${state.info.name} · ${t('title')}`
  const params = new URLSearchParams(location.search)
  if (params.has('code') || params.has('error')) return finishEntra(params)
  if (await refresh()) return showApp()
  showLogin()
}

// Entra: authorization code + PKCE in the browser (ADR 0018 fase 0).

const PKCE_KEY = 'north-admin-pkce'
const redirectUri = () => `${location.origin}/admin/`

const base64Url = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const randomText = () => base64Url(crypto.getRandomValues(new Uint8Array(32)))

async function sha256Url(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return base64Url(new Uint8Array(digest))
}

const refusal = (description) => {
  const code = String(description ?? '').match(/AADSTS\d+/)?.[0]
  return code ? `${t('entraRefused')} (${code}).` : `${t('entraRefused')}.`
}

async function startEntra() {
  const oidc = state.info.auth.oidc
  const pending = { verifier: randomText(), state: randomText(), nonce: randomText(), lang: locale }
  try {
    sessionStorage.setItem(PKCE_KEY, JSON.stringify(pending))
  } catch {
    /* without storage the callback cannot be checked; it fails safely */
  }
  const url = new URL(oidc.authorizationEndpoint)
  url.search = new URLSearchParams({
    client_id: oidc.clientId,
    response_type: 'code',
    redirect_uri: redirectUri(),
    response_mode: 'query',
    scope: oidc.scopes.join(' '),
    state: pending.state,
    nonce: pending.nonce,
    code_challenge: await sha256Url(pending.verifier),
    code_challenge_method: 'S256',
    prompt: 'select_account'
  }).toString()
  location.assign(url.toString())
}

async function finishEntra(params) {
  let pending = null
  try {
    pending = JSON.parse(sessionStorage.getItem(PKCE_KEY) ?? 'null')
    sessionStorage.removeItem(PKCE_KEY)
  } catch {
    pending = null
  }
  // Drop ?code= from the address bar (and history) right away.
  const clean = new URL(location.href)
  clean.search = pending?.lang ? `?lang=${pending.lang}` : ''
  history.replaceState(null, '', clean.toString())

  if (params.get('error')) return showLogin(refusal(params.get('error_description')))
  if (!pending || params.get('state') !== pending.state) return showLogin(t('entraMismatch'))
  try {
    const oidc = state.info.auth.oidc
    const res = await fetch(oidc.tokenEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: oidc.clientId,
        grant_type: 'authorization_code',
        code: params.get('code') ?? '',
        redirect_uri: redirectUri(),
        code_verifier: pending.verifier,
        scope: oidc.scopes.join(' ')
      })
    })
    const tokens = await res.json().catch(() => ({}))
    if (!res.ok || !tokens.id_token) return showLogin(refusal(tokens.error_description))
    const session = await raw('POST', '/api/v1/auth/oidc/login', {
      idToken: tokens.id_token,
      nonce: pending.nonce
    })
    accessToken = session.accessToken
    storage.set(session.refreshToken)
    await showApp()
  } catch (e) {
    showLogin(e.message)
  }
}

function orgMark(heading = false) {
  const name = state.info?.name ?? 'North Server'
  return h(
    'div',
    { class: 'org' },
    h('span', { class: 'org-mark', 'aria-hidden': 'true' }, initials(name).slice(0, 1)),
    h(
      'div',
      {},
      h(heading ? 'h1' : 'div', { class: 'org-name' }, name),
      h('div', { class: 'org-sub' }, t('title'))
    )
  )
}

function showLogin(message) {
  accessToken = null
  const devMode = state.info?.auth?.modes?.includes('dev')
  const entra = Boolean(state.info?.auth?.oidc?.authorizationEndpoint)
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
    entra ? h('p', { class: 'hint' }, t('orDev')) : null,
    h('div', { class: 'field' }, h('label', { for: 'email' }, t('email')), email),
    h('button', { class: 'btn primary', type: 'submit' }, t('signIn'))
  )
  const microsoft = h(
    'button',
    {
      class: 'btn primary',
      type: 'button',
      onclick: () =>
        startEntra().catch((e) => {
          error.textContent = e.message
        })
    },
    t('entraButton')
  )
  mount(
    h(
      'main',
      { class: 'login-wrap' },
      h(
        'div',
        { class: 'panel login' },
        orgMark(true),
        h('p', { class: 'hint' }, t(entra ? 'entraHint' : devMode ? 'signInHint' : 'noSignIn')),
        entra ? microsoft : null,
        devMode ? form : null,
        devMode ? h('p', { class: 'hint' }, t('devNotice')) : null,
        error
      )
    )
  )
  if (entra) microsoft.focus()
  else if (devMode) email.focus()
}

async function signOut() {
  const token = storage.get()
  storage.set(null)
  accessToken = null
  state.data = null
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
  await loadData()
  render()
}

// ── shell ──────────────────────────────────────────────────────────────────

const SECTIONS = ['overview', 'people', 'teams', 'projects', 'audit']
const VIEWS = {}

function render() {
  const { section, id } = route()
  const current = SECTIONS.includes(section) ? section : 'overview'
  const counts = {
    people: state.data.users.filter((u) => !u.disabled).length,
    teams: state.data.teams.length,
    projects: state.data.clients.length
  }
  const content = h('div', { class: 'page', testid: `tab-${current}` })
  mount(
    h(
      'div',
      { class: 'app' },
      h(
        'aside',
        { class: 'sidebar' },
        orgMark(),
        h(
          'nav',
          { 'aria-label': t('title') },
          SECTIONS.map((s) =>
            h(
              'a',
              {
                class: 'nav-item',
                href: `#/${s}`,
                'aria-current': s === current ? 'page' : undefined,
                testid: `nav-${s}`
              },
              icon(s),
              t(s),
              counts[s] === undefined ? null : h('span', { class: 'nav-count' }, counts[s])
            )
          )
        ),
        h(
          'div',
          { class: 'sidebar-foot' },
          h('div', { class: 'me', title: state.me.email }, state.me.email),
          h('button', { class: 'nav-item', onclick: signOut }, icon('logOut'), t('signOut'))
        )
      ),
      h('main', { class: 'main' }, content)
    )
  )
  try {
    VIEWS[current](content, id)
  } catch (error) {
    content.append(h('p', { class: 'error', role: 'alert' }, error.message))
  }
  // Async views (audit) report their own errors.
}

function pageHead(title, hint, actions = null, back = null) {
  return h(
    'div',
    { class: 'page-head' },
    h(
      'div',
      {},
      back ? h('a', { class: 'back', href: back.href }, icon('chevronLeft'), back.label) : null,
      h('h1', {}, title),
      hint ? h('p', { class: 'hint' }, hint) : null
    ),
    actions
  )
}

function roleBadge(role) {
  return h('span', { class: role === 'editor' ? 'badge accent' : 'badge' }, t(role))
}

function roleSelect(id, value = 'viewer') {
  return h(
    'select',
    { id, 'aria-label': t('role') },
    h('option', { value: 'viewer', selected: value === 'viewer' }, t('viewer')),
    h('option', { value: 'editor', selected: value === 'editor' }, t('editor'))
  )
}

function roleHelp() {
  return h(
    'div',
    { class: 'role-help' },
    h('div', {}, h('strong', {}, t('viewer')), h('span', { class: 'muted' }, t('viewerHelp'))),
    h('div', {}, h('strong', {}, t('editor')), h('span', { class: 'muted' }, t('editorHelp')))
  )
}

/** One shared item: icon, name and where it sits in the tree. */
function nodeLabel(id) {
  const node = state.data.nodes.get(id)
  if (!node) return h('span', { class: 'muted' }, '—')
  const parents = pathOf(id).slice(0, -1)
  return h(
    'div',
    { class: 'item-main' },
    h(
      'span',
      { class: 'item-title' },
      icon(node.type),
      node.name,
      h('span', { class: 'badge' }, t(node.type))
    ),
    h(
      'span',
      { class: 'item-sub' },
      [parents.join(' › '), node.host].filter(Boolean).join(' · ') || ' '
    )
  )
}

// ── project tree / picker ──────────────────────────────────────────────────

/**
 * The organization's tree down to each connection. `onPick` makes rows
 * selectable; the search keeps matches and the parents that lead to them.
 */
function projectTree({ selected, onPick, query = '' }) {
  const { clients, environments, groups, connections } = state.data
  const q = query.trim().toLowerCase()
  const matches = (node) =>
    !q || [node.name, node.host].filter(Boolean).join(' ').toLowerCase().includes(q)

  const row = (type, item, children) => {
    const keep = matches(item) || children.length > 0
    if (!keep) return null
    return h(
      'li',
      {},
      h(
        'button',
        {
          type: 'button',
          class: 'tree-row',
          'aria-current': String(selected === item.id),
          testid: `project-${item.name}`,
          onclick: () => onPick({ type, id: item.id, name: item.name })
        },
        icon(type),
        h('span', { class: 'tree-name' }, item.name),
        item.host ? h('span', { class: 'tree-host' }, item.host) : null
      ),
      children.length ? h('ul', {}, children) : null
    )
  }

  const items = clients
    .map((c) =>
      row(
        'client',
        c,
        environments
          .filter((e) => e.clientId === c.id)
          .map((e) =>
            row(
              'environment',
              e,
              groups
                .filter((g) => g.environmentId === e.id)
                .map((g) =>
                  row(
                    'group',
                    g,
                    connections
                      .filter((k) => k.groupId === g.id)
                      .map((k) => row('connection', k, []))
                      .filter(Boolean)
                  )
                )
                .filter(Boolean)
            )
          )
          .filter(Boolean)
      )
    )
    .filter(Boolean)

  if (clients.length === 0) return h('p', { class: 'empty' }, t('noClients'))
  if (items.length === 0) return h('p', { class: 'empty' }, t('nobodyFound'))
  return h('ul', { class: 'tree' }, items)
}

/** Search + tree + role + button, for giving one person or team access. */
function grantPicker(principal) {
  let picked = null
  let query = ''
  const treeSlot = h('div', {})
  const pickedSlot = h('span', { class: 'picked muted' }, t('pickSomething'))
  const role = roleSelect(`grant-role-${principal.id}`)
  const give = h('button', { class: 'btn primary', type: 'button', disabled: true }, t('give'))

  const draw = () => {
    treeSlot.replaceChildren(
      projectTree({
        selected: picked?.id,
        query,
        onPick: (node) => {
          picked = node
          give.disabled = false
          pickedSlot.className = 'picked'
          pickedSlot.replaceChildren(
            h('strong', {}, node.name),
            ' ',
            h('span', { class: 'path' }, pathOf(node.id).slice(0, -1).join(' › '))
          )
          draw()
        }
      })
    )
  }
  give.addEventListener('click', () => {
    if (!picked) return
    change(() =>
      api('PUT', '/api/v1/admin/grants', {
        [principal.kind === 'team' ? 'teamId' : 'userId']: principal.id,
        scopeType: picked.type,
        scopeId: picked.id,
        role: role.value
      })
    )
  })
  draw()

  return h(
    'div',
    { class: 'picker', testid: 'grant-picker' },
    h(
      'div',
      { class: 'search' },
      icon('search'),
      h('input', {
        type: 'search',
        placeholder: t('searchTree'),
        'aria-label': t('searchTree'),
        oninput: (e) => {
          query = e.target.value
          draw()
        }
      })
    ),
    treeSlot,
    h('div', { class: 'picker-foot' }, pickedSlot, role, give)
  )
}

/** Grants held by a person or a team, each with where it came from. */
function grantList(entries, onRemove) {
  if (entries.length === 0) return h('p', { class: 'empty' }, t('nothingShared'))
  return h(
    'ul',
    { class: 'list' },
    entries.map((entry) =>
      h(
        'li',
        { testid: `grant-${state.data.nodes.get(entry.scopeId)?.name ?? entry.scopeId}` },
        h(
          'div',
          { class: 'item' },
          nodeLabel(entry.scopeId),
          h(
            'div',
            { class: 'item-side' },
            roleBadge(entry.role),
            entry.via
              ? h('span', { class: 'badge' }, t('viaTeam', { name: entry.via }))
              : h('span', { class: 'badge' }, t('direct')),
            entry.via
              ? null
              : h(
                  'button',
                  {
                    class: 'btn sm danger',
                    type: 'button',
                    onclick: () => onRemove(entry)
                  },
                  t('remove')
                )
          )
        )
      )
    )
  )
}

// ── overview ───────────────────────────────────────────────────────────────

VIEWS.overview = (container) => {
  const { users, teams, clients, connections } = state.data
  const stat = (label, value, href, iconName) =>
    h(
      'a',
      { class: 'panel stat', href },
      h('span', { class: 'stat-label' }, icon(iconName), label),
      h('span', { class: 'stat-value' }, value)
    )
  const recent = h('div', {}, h('p', { class: 'empty' }, '…'))

  container.append(
    pageHead(t('overview'), t('overviewHint')),
    h(
      'div',
      { class: 'stats' },
      stat(t('activePeople'), users.filter((u) => !u.disabled).length, '#/people', 'people'),
      stat(t('teams'), teams.length, '#/teams', 'teams'),
      stat(t('clients'), clients.length, '#/projects', 'client'),
      stat(t('connections'), connections.length, '#/projects', 'connection')
    ),
    h(
      'div',
      { class: 'grid-2' },
      h(
        'section',
        { class: 'panel' },
        h(
          'div',
          { class: 'panel-head' },
          h('h2', {}, t('recentActivity')),
          h('a', { class: 'btn sm ghost', href: '#/audit' }, t('seeAll'))
        ),
        recent
      ),
      h(
        'section',
        { class: 'panel' },
        h('div', { class: 'panel-head' }, h('h2', {}, t('howItWorks'))),
        h(
          'div',
          { class: 'panel-body' },
          h(
            'ol',
            { class: 'hint' },
            h('li', {}, t('how1')),
            h('li', {}, t('how2')),
            h('li', {}, t('how3'))
          ),
          roleHelp()
        )
      )
    )
  )

  api('GET', '/api/v1/audit?limit=8')
    .then((events) => {
      recent.replaceChildren(
        events.length
          ? h(
              'ul',
              { class: 'list' },
              events.map((e) =>
                h(
                  'li',
                  {},
                  h(
                    'div',
                    { class: 'item' },
                    h('span', { class: 'avatar' }, initials(e.userEmail)),
                    h(
                      'div',
                      { class: 'item-main' },
                      h(
                        'span',
                        { class: 'item-title' },
                        t(`action.${e.action}`),
                        e.targetName ? h('span', { class: 'muted' }, e.targetName) : null
                      ),
                      h(
                        'span',
                        { class: 'item-sub' },
                        `${e.userEmail ?? '—'} · ${relativeTime(e.at)}`
                      )
                    )
                  )
                )
              )
            )
          : h('p', { class: 'empty' }, t('noEvents'))
      )
    })
    .catch((error) => recent.replaceChildren(h('p', { class: 'error' }, error.message)))
}

function relativeTime(at) {
  const seconds = Math.round((new Date(at).getTime() - Date.now()) / 1000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const steps = [
    [60, 'second'],
    [3600, 'minute'],
    [86400, 'hour'],
    [604800, 'day']
  ]
  for (const [limit, unit] of steps) {
    if (Math.abs(seconds) < limit) {
      const size = { second: 1, minute: 60, hour: 3600, day: 86400 }[unit]
      return rtf.format(Math.round(seconds / size), unit)
    }
  }
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(at))
}

// ── people ─────────────────────────────────────────────────────────────────

/** A person's grants: their own plus each team's, tagged with the team. */
function effectiveGrants(user) {
  const own = user.grants.map((g) => ({ ...g, via: null }))
  const fromTeams = state.data.teams
    .filter((team) => user.teamIds.includes(team.id))
    .flatMap((team) => team.grants.map((g) => ({ ...g, via: team.name })))
  return [...own, ...fromTeams]
}

VIEWS.people = (container, id) => {
  if (id) return renderPerson(container, id)
  const { users } = state.data
  const listSlot = h('section', { class: 'panel' })
  const addSlot = h('div', {})

  const draw = () => {
    const q = state.peopleQuery.trim().toLowerCase()
    const shown = users.filter((u) => {
      if (state.peopleFilter === 'active' && u.disabled) return false
      if (state.peopleFilter === 'disabled' && !u.disabled) return false
      if (state.peopleFilter === 'admins' && u.role !== 'admin') return false
      return !q || `${u.name} ${u.email}`.toLowerCase().includes(q)
    })
    listSlot.replaceChildren(
      shown.length
        ? h(
            'ul',
            { class: 'list' },
            shown.map((user) => {
              const grants = effectiveGrants(user).length
              return h(
                'li',
                { testid: `user-${user.email}` },
                h(
                  'a',
                  { class: 'item', href: `#/people/${user.id}` },
                  h('span', { class: 'avatar' }, initials(user.name || user.email)),
                  h(
                    'div',
                    { class: 'item-main' },
                    h(
                      'span',
                      { class: 'item-title' },
                      user.name || user.email,
                      user.id === state.me.id ? h('span', { class: 'badge' }, t('you')) : null
                    ),
                    h('span', { class: 'item-sub mono' }, user.email)
                  ),
                  h(
                    'div',
                    { class: 'item-side' },
                    user.teamIds.length
                      ? h(
                          'span',
                          { class: 'badge' },
                          user.teamIds
                            .map((tid) => state.data.teamById.get(tid)?.name)
                            .filter(Boolean)
                            .join(', ')
                        )
                      : null,
                    user.role === 'admin'
                      ? h('span', { class: 'badge accent' }, t('admin'))
                      : h(
                          'span',
                          { class: 'badge' },
                          grants ? t('accessCount', { n: grants }) : t('noAccessYet')
                        ),
                    user.disabled ? h('span', { class: 'badge danger' }, t('disabled')) : null,
                    icon('chevronRight')
                  )
                )
              )
            })
          )
        : h('p', { class: 'empty' }, t('nobodyFound'))
    )
  }

  const showAdd = () => {
    const email = h('input', { id: 'new-email', type: 'email', required: true })
    const name = h('input', { id: 'new-name' })
    addSlot.replaceChildren(
      h(
        'form',
        {
          class: 'panel panel-body',
          onsubmit: (event) => {
            event.preventDefault()
            change(async () => {
              const user = await api('POST', '/api/v1/admin/users', {
                email: email.value,
                name: name.value || undefined
              })
              return { goTo: `/people/${user.id}` }
            })
          }
        },
        h('h2', {}, t('addPerson')),
        h(
          'div',
          { class: 'row' },
          h('div', { class: 'field' }, h('label', { for: 'new-email' }, t('email')), email),
          h('div', { class: 'field' }, h('label', { for: 'new-name' }, t('nameOptional')), name),
          h('button', { class: 'btn primary', type: 'submit' }, t('add')),
          h(
            'button',
            { class: 'btn ghost', type: 'button', onclick: () => addSlot.replaceChildren() },
            t('cancel')
          )
        )
      )
    )
    email.focus()
  }

  const filters = ['all', 'active', 'disabled', 'admins']
  const segmented = h(
    'div',
    { class: 'segmented', role: 'group' },
    filters.map((f) =>
      h(
        'button',
        {
          type: 'button',
          'aria-pressed': String(state.peopleFilter === f),
          onclick: (e) => {
            state.peopleFilter = f
            for (const b of segmented.children) b.setAttribute('aria-pressed', 'false')
            e.currentTarget.setAttribute('aria-pressed', 'true')
            draw()
          }
        },
        t(f)
      )
    )
  )

  container.append(
    pageHead(
      t('people'),
      t('peopleHint'),
      h('button', { class: 'btn primary', onclick: showAdd }, icon('plus'), t('addPerson'))
    ),
    addSlot,
    h(
      'div',
      { class: 'toolbar' },
      h(
        'div',
        { class: 'search' },
        icon('search'),
        h('input', {
          type: 'search',
          value: state.peopleQuery,
          placeholder: t('searchPeople'),
          'aria-label': t('searchPeople'),
          oninput: (e) => {
            state.peopleQuery = e.target.value
            draw()
          }
        })
      ),
      segmented
    ),
    listSlot
  )
  draw()
}

function renderPerson(container, id) {
  const user = state.data.userById.get(id)
  if (!user) return go('/people')
  const self = user.id === state.me.id
  const back = { href: '#/people', label: t('people') }

  const role = h(
    'select',
    {
      'aria-label': t('role'),
      onchange: () =>
        change(() => api('PATCH', `/api/v1/admin/users/${user.id}`, { role: role.value }))
    },
    h('option', { value: 'admin', selected: user.role === 'admin' }, t('admin')),
    h('option', { value: 'member', selected: user.role === 'member' }, t('member'))
  )
  const toggle = h(
    'button',
    {
      class: user.disabled ? 'btn' : 'btn danger',
      onclick: () => {
        if (!user.disabled && !confirm(t('disableConfirm', { email: user.email }))) return
        change(() => api('PATCH', `/api/v1/admin/users/${user.id}`, { disabled: !user.disabled }))
      }
    },
    t(user.disabled ? 'enable' : 'disable')
  )

  const teamsIn = state.data.teams.filter((tm) => user.teamIds.includes(tm.id))
  const teamsOut = state.data.teams.filter((tm) => !user.teamIds.includes(tm.id))
  const joinTeam = h(
    'select',
    {
      'aria-label': t('addToTeam'),
      onchange: () => {
        if (!joinTeam.value) return
        change(() =>
          api('PUT', `/api/v1/admin/teams/${joinTeam.value}/members`, { userId: user.id })
        )
      }
    },
    h('option', { value: '' }, t('addToTeam')),
    teamsOut.map((tm) => h('option', { value: tm.id }, tm.name))
  )

  container.append(
    pageHead(
      user.name || user.email,
      null,
      h('div', { class: 'toolbar' }, role, self ? null : toggle),
      back
    ),
    h(
      'div',
      { class: 'toolbar' },
      h('span', { class: 'avatar lg' }, initials(user.name || user.email)),
      h(
        'div',
        { class: 'item-main' },
        h('span', { class: 'mono' }, user.email),
        h(
          'span',
          { class: 'chips' },
          user.role === 'admin' ? h('span', { class: 'badge accent' }, t('admin')) : null,
          h(
            'span',
            { class: user.disabled ? 'badge danger' : 'badge success' },
            t(user.disabled ? 'disabled' : 'active')
          ),
          self ? h('span', { class: 'badge' }, t('you')) : null
        )
      )
    ),
    h(
      'section',
      { class: 'panel' },
      h(
        'div',
        { class: 'panel-head' },
        h('h2', {}, t('personTeams')),
        teamsOut.length ? joinTeam : null
      ),
      h(
        'div',
        { class: 'panel-body' },
        teamsIn.length
          ? h(
              'div',
              { class: 'chips' },
              teamsIn.map((tm) => {
                const entra = tm.members.find((m) => m.userId === user.id)?.source === 'entra'
                return h(
                  'span',
                  { class: 'chip' },
                  h('a', { href: `#/teams/${tm.id}` }, tm.name),
                  entra ? h('span', { class: 'muted' }, `· ${t('fromEntra')}`) : null,
                  h(
                    'button',
                    {
                      type: 'button',
                      'aria-label': `${t('remove')} ${tm.name}`,
                      onclick: () =>
                        change(() =>
                          api('DELETE', `/api/v1/admin/teams/${tm.id}/members/${user.id}`)
                        )
                    },
                    icon('x')
                  )
                )
              })
            )
          : h('p', { class: 'hint' }, t('noTeams'))
      )
    ),
    user.role === 'admin'
      ? h('section', { class: 'panel panel-body' }, h('p', { class: 'hint' }, t('adminSeesAll')))
      : h(
          'div',
          { class: 'grid-2' },
          h(
            'section',
            { class: 'panel' },
            h(
              'div',
              { class: 'panel-head' },
              h('div', {}, h('h2', {}, t('access')), h('p', { class: 'hint' }, t('accessHint')))
            ),
            grantList(effectiveGrants(user), (entry) =>
              change(() =>
                api('DELETE', '/api/v1/admin/grants', {
                  userId: user.id,
                  scopeType: entry.scopeType,
                  scopeId: entry.scopeId
                })
              )
            )
          ),
          h(
            'section',
            { class: 'panel' },
            h(
              'div',
              { class: 'panel-head' },
              h(
                'div',
                {},
                h('h2', {}, t('giveAccess')),
                h('p', { class: 'hint' }, t('giveAccessHint'))
              )
            ),
            h(
              'div',
              { class: 'panel-body' },
              grantPicker({ kind: 'user', id: user.id }),
              roleHelp()
            )
          )
        )
  )
}

// ── teams ──────────────────────────────────────────────────────────────────

function teamForm(team, onDone) {
  const name = h('input', { id: 'team-name', required: true, value: team?.name ?? '' })
  const description = h('input', { id: 'team-description', value: team?.description ?? '' })
  const entra = h('input', {
    id: 'team-entra',
    class: 'mono',
    value: team?.entraGroupId ?? '',
    placeholder: '00000000-0000-0000-0000-000000000000'
  })
  const form = h(
    'form',
    {
      class: 'panel panel-body',
      onsubmit: (event) => {
        event.preventDefault()
        const body = {
          name: name.value,
          description: description.value,
          entraGroupId: entra.value.trim() || null
        }
        change(async () => {
          const saved = team
            ? await api('PATCH', `/api/v1/admin/teams/${team.id}`, body)
            : await api('POST', '/api/v1/admin/teams', body)
          return team ? null : { goTo: `/teams/${saved.id}` }
        })
      }
    },
    h('h2', {}, team ? t('edit') : t('newTeam')),
    h(
      'div',
      { class: 'row' },
      h('div', { class: 'field' }, h('label', { for: 'team-name' }, t('teamName')), name),
      h(
        'div',
        { class: 'field' },
        h('label', { for: 'team-description' }, t('description')),
        description
      )
    ),
    h(
      'div',
      { class: 'field' },
      h('label', { for: 'team-entra' }, t('entraGroup')),
      entra,
      h('p', { class: 'hint' }, t('entraGroupHint'))
    ),
    h(
      'div',
      { class: 'toolbar' },
      h('button', { class: 'btn primary', type: 'submit' }, team ? t('save') : t('create')),
      h('button', { class: 'btn ghost', type: 'button', onclick: onDone }, t('cancel'))
    )
  )
  setTimeout(() => name.focus())
  return form
}

VIEWS.teams = (container, id) => {
  if (id) return renderTeam(container, id)
  const formSlot = h('div', {})
  const { teams } = state.data
  container.append(
    pageHead(
      t('teams'),
      t('teamsHint'),
      h(
        'button',
        {
          class: 'btn primary',
          onclick: () => formSlot.replaceChildren(teamForm(null, () => formSlot.replaceChildren()))
        },
        icon('plus'),
        t('newTeam')
      )
    ),
    formSlot,
    h(
      'section',
      { class: 'panel' },
      teams.length
        ? h(
            'ul',
            { class: 'list' },
            teams.map((team) =>
              h(
                'li',
                { testid: `team-${team.name}` },
                h(
                  'a',
                  { class: 'item', href: `#/teams/${team.id}` },
                  h('span', { class: 'avatar team' }, initials(team.name)),
                  h(
                    'div',
                    { class: 'item-main' },
                    h('span', { class: 'item-title' }, team.name),
                    h('span', { class: 'item-sub' }, team.description || ' ')
                  ),
                  h(
                    'div',
                    { class: 'item-side' },
                    team.entraGroupId ? h('span', { class: 'badge accent' }, 'Entra') : null,
                    h('span', { class: 'badge' }, t('membersCount', { n: team.members.length })),
                    h('span', { class: 'badge' }, t('accessCount', { n: team.grants.length })),
                    icon('chevronRight')
                  )
                )
              )
            )
          )
        : h('p', { class: 'empty' }, t('noTeamsYet'))
    )
  )
}

function renderTeam(container, id) {
  const team = state.data.teamById.get(id)
  if (!team) return go('/teams')
  const formSlot = h('div', {})
  const memberIds = new Set(team.members.map((m) => m.userId))
  const candidates = state.data.users.filter((u) => !memberIds.has(u.id) && !u.disabled)
  const addMember = h(
    'select',
    {
      'aria-label': t('addMember'),
      onchange: () => {
        if (!addMember.value) return
        change(() =>
          api('PUT', `/api/v1/admin/teams/${team.id}/members`, { userId: addMember.value })
        )
      }
    },
    h('option', { value: '' }, t('addMember')),
    candidates.map((u) =>
      h(
        'option',
        { value: u.id },
        u.name && u.name !== u.email ? `${u.name} · ${u.email}` : u.email
      )
    )
  )

  container.append(
    pageHead(
      team.name,
      team.description || null,
      h(
        'div',
        { class: 'toolbar' },
        h(
          'button',
          {
            class: 'btn',
            onclick: () =>
              formSlot.replaceChildren(teamForm(team, () => formSlot.replaceChildren()))
          },
          t('edit')
        ),
        h(
          'button',
          {
            class: 'btn danger',
            onclick: () => {
              if (!confirm(t('deleteTeamConfirm', { name: team.name }))) return
              change(async () => {
                await api('DELETE', `/api/v1/admin/teams/${team.id}`)
                return { goTo: '/teams' }
              })
            }
          },
          icon('trash'),
          t('deleteTeam')
        )
      ),
      { href: '#/teams', label: t('teams') }
    ),
    formSlot,
    team.entraGroupId
      ? h(
          'p',
          { class: 'hint' },
          h('span', { class: 'badge accent' }, 'Entra'),
          ' ',
          h('span', { class: 'mono' }, team.entraGroupId)
        )
      : null,
    h(
      'div',
      { class: 'grid-2' },
      h(
        'section',
        { class: 'panel' },
        h(
          'div',
          { class: 'panel-head' },
          h('h2', {}, t('members')),
          candidates.length ? addMember : null
        ),
        team.members.length
          ? h(
              'ul',
              { class: 'list' },
              team.members.map((m) => {
                const user = state.data.userById.get(m.userId)
                if (!user) return null
                return h(
                  'li',
                  { testid: `member-${user.email}` },
                  h(
                    'div',
                    { class: 'item' },
                    h('span', { class: 'avatar' }, initials(user.name || user.email)),
                    h(
                      'a',
                      { class: 'item-main', href: `#/people/${user.id}` },
                      h('span', { class: 'item-title' }, user.name || user.email),
                      h('span', { class: 'item-sub mono' }, user.email)
                    ),
                    h(
                      'div',
                      { class: 'item-side' },
                      m.source === 'entra'
                        ? h('span', { class: 'badge accent' }, t('fromEntra'))
                        : null,
                      h(
                        'button',
                        {
                          class: 'btn sm danger',
                          onclick: () =>
                            change(() =>
                              api('DELETE', `/api/v1/admin/teams/${team.id}/members/${user.id}`)
                            )
                        },
                        t('remove')
                      )
                    )
                  )
                )
              })
            )
          : h('p', { class: 'empty' }, t('noMembers'))
      ),
      h(
        'section',
        { class: 'panel' },
        h('div', { class: 'panel-head' }, h('h2', {}, t('access'))),
        grantList(
          team.grants.map((g) => ({ ...g, via: null })),
          (entry) =>
            change(() =>
              api('DELETE', '/api/v1/admin/grants', {
                teamId: team.id,
                scopeType: entry.scopeType,
                scopeId: entry.scopeId
              })
            )
        )
      )
    ),
    h(
      'section',
      { class: 'panel' },
      h(
        'div',
        { class: 'panel-head' },
        h('div', {}, h('h2', {}, t('giveAccess')), h('p', { class: 'hint' }, t('giveAccessHint')))
      ),
      h('div', { class: 'panel-body' }, grantPicker({ kind: 'team', id: team.id }), roleHelp())
    )
  )
}

// ── projects ───────────────────────────────────────────────────────────────

VIEWS.projects = (container, id) => {
  let query = ''
  const treeSlot = h('div', {})
  const selected = id && state.data.nodes.has(id) ? state.data.nodes.get(id) : null
  const drawTree = () =>
    treeSlot.replaceChildren(
      projectTree({ selected: selected?.id, query, onPick: (node) => go(`/projects/${node.id}`) })
    )
  drawTree()

  const detail = h('section', { class: 'panel', testid: 'project-access' })
  if (!selected) detail.append(h('p', { class: 'empty' }, t('pickProject')))
  else renderAccess(detail, selected)

  container.append(
    pageHead(t('projects'), t('projectsHint')),
    h(
      'div',
      { class: 'split' },
      h(
        'nav',
        { class: 'panel', 'aria-label': t('projects') },
        h(
          'div',
          { class: 'search' },
          icon('search'),
          h('input', {
            type: 'search',
            placeholder: t('searchTree'),
            'aria-label': t('searchTree'),
            oninput: (e) => {
              query = e.target.value
              drawTree()
            }
          })
        ),
        treeSlot
      ),
      detail
    )
  )
}

async function renderAccess(container, project) {
  const loading = h('p', { class: 'empty' }, '…')
  container.append(
    h('div', { class: 'panel-head' }, nodeLabel(project.id)),
    h('div', { class: 'panel-body' }, h('h3', {}, t('whoHasAccess'))),
    loading
  )
  let grants
  try {
    grants = await api(
      'GET',
      `/api/v1/admin/grants?scopeType=${project.type}&scopeId=${project.id}`
    )
  } catch (error) {
    loading.replaceWith(h('p', { class: 'error', role: 'alert' }, error.message))
    return
  }

  const rows = grants.map((g) => {
    const direct = g.scopeId === project.id
    const isTeam = g.principal === 'team'
    const href = isTeam ? `#/teams/${g.teamId}` : `#/people/${g.userId}`
    return h(
      'li',
      { testid: `grant-${g.label}` },
      h(
        'div',
        { class: 'item' },
        h('span', { class: isTeam ? 'avatar team' : 'avatar' }, initials(g.name || g.label)),
        h(
          'a',
          { class: 'item-main', href },
          h(
            'span',
            { class: 'item-title' },
            g.name || g.label,
            isTeam ? h('span', { class: 'badge' }, t('team')) : null
          ),
          h(
            'span',
            { class: 'item-sub' },
            [
              isTeam ? null : g.label,
              direct ? null : t('inherited', { name: state.data.nodes.get(g.scopeId)?.name ?? '—' })
            ]
              .filter(Boolean)
              .join(' · ') || ' '
          )
        ),
        h(
          'div',
          { class: 'item-side' },
          roleBadge(g.role),
          direct
            ? h(
                'button',
                {
                  class: 'btn sm danger',
                  onclick: () =>
                    change(() =>
                      api('DELETE', '/api/v1/admin/grants', {
                        [isTeam ? 'teamId' : 'userId']: isTeam ? g.teamId : g.userId,
                        scopeType: g.scopeType,
                        scopeId: g.scopeId
                      })
                    )
                },
                t('remove')
              )
            : null
        )
      )
    )
  })

  const people = state.data.users.filter((u) => u.role !== 'admin' && !u.disabled)
  const teams = state.data.teams
  const who = h(
    'select',
    { id: 'grant-who', 'aria-label': t('giveTo') },
    teams.length
      ? h(
          'optgroup',
          { label: t('teams') },
          teams.map((tm) => h('option', { value: `team:${tm.id}` }, tm.name))
        )
      : null,
    people.length
      ? h(
          'optgroup',
          { label: t('people') },
          people.map((u) => h('option', { value: `user:${u.id}` }, u.email))
        )
      : null
  )
  const role = roleSelect('grant-role')
  const form =
    people.length || teams.length
      ? h(
          'form',
          {
            class: 'row',
            onsubmit: (event) => {
              event.preventDefault()
              const [kind, principalId] = who.value.split(':')
              change(() =>
                api('PUT', '/api/v1/admin/grants', {
                  [kind === 'team' ? 'teamId' : 'userId']: principalId,
                  scopeType: project.type,
                  scopeId: project.id,
                  role: role.value
                })
              )
            }
          },
          h('div', { class: 'field' }, h('label', { for: 'grant-who' }, t('giveTo')), who),
          h('div', { class: 'field' }, h('label', { for: 'grant-role' }, t('role')), role),
          h('button', { class: 'btn primary', type: 'submit' }, t('give'))
        )
      : h('p', { class: 'hint' }, t('noOneToGive'))

  loading.replaceWith(
    rows.length ? h('ul', { class: 'list' }, rows) : h('p', { class: 'empty' }, t('onlyAdmins')),
    h('div', { class: 'panel-body' }, form, roleHelp())
  )
}

// ── audit ──────────────────────────────────────────────────────────────────

const AUDIT_KINDS = {
  all: () => true,
  secrets: (a) => a.startsWith('secret.'),
  access: (a) => a.startsWith('grant.'),
  people: (a) => a.startsWith('user.') || a.startsWith('team.')
}

function describeDetail(event) {
  const d = event.detail ?? {}
  if (d.purpose) return t(`purpose.${d.purpose}`)
  if (d.email && event.action.startsWith('team.member')) return d.email
  if (d.scopeId) {
    const node = state.data.nodes.get(d.scopeId)
    const where = node ? `${t(node.type)} ${node.name}` : t(d.scopeType ?? '')
    return d.role ? `${where} · ${t(d.role)}` : where
  }
  if (d.role) return t(d.role)
  if (d.disabled !== undefined) return t(d.disabled ? 'disabled' : 'active')
  return ''
}

VIEWS.audit = (container) => {
  const body = h('tbody', {})
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'medium' })
  let events = null

  const draw = () => {
    if (!events) return
    const q = state.auditQuery.trim().toLowerCase()
    const rows = events
      .filter((e) => AUDIT_KINDS[state.auditKind](e.action))
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
              h('td', { class: 'mono muted' }, cells[0]),
              h('td', { class: 'mono' }, cells[1]),
              h(
                'td',
                {},
                h(
                  'span',
                  {
                    class: e.action.startsWith('secret.')
                      ? 'badge warning'
                      : e.action.startsWith('grant.')
                        ? 'badge accent'
                        : 'badge'
                  },
                  cells[2]
                )
              ),
              h('td', {}, cells[3]),
              h('td', { class: 'muted' }, cells[4])
            )
          )
        : [h('tr', {}, h('td', { colspan: 5, class: 'empty' }, t('noEvents')))])
    )
  }

  const segmented = h(
    'div',
    { class: 'segmented', role: 'group' },
    [
      ['all', 'kindAll'],
      ['secrets', 'kindSecrets'],
      ['access', 'kindAccess'],
      ['people', 'kindPeople']
    ].map(([kind, label]) =>
      h(
        'button',
        {
          type: 'button',
          'aria-pressed': String(state.auditKind === kind),
          onclick: (e) => {
            state.auditKind = kind
            for (const b of segmented.children) b.setAttribute('aria-pressed', 'false')
            e.currentTarget.setAttribute('aria-pressed', 'true')
            draw()
          }
        },
        t(label)
      )
    )
  )

  container.append(
    pageHead(t('audit'), t('auditHint')),
    h(
      'div',
      { class: 'toolbar' },
      h(
        'div',
        { class: 'search' },
        icon('search'),
        h('input', {
          id: 'audit-filter',
          type: 'search',
          value: state.auditQuery,
          placeholder: t('filter'),
          'aria-label': t('filter'),
          oninput: (e) => {
            state.auditQuery = e.target.value
            draw()
          }
        })
      ),
      segmented
    ),
    h(
      'section',
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

  body.replaceChildren(h('tr', {}, h('td', { colspan: 5, class: 'empty' }, '…')))
  api('GET', '/api/v1/audit?limit=500')
    .then((list) => {
      events = list
      draw()
    })
    .catch((error) =>
      body.replaceChildren(h('tr', {}, h('td', { colspan: 5, class: 'error' }, error.message)))
    )
}

boot()
