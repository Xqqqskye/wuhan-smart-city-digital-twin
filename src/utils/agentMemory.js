const STORAGE_KEY = 'wuhan-city-agent-memory-v1';
const MAX_MESSAGES = 60;
const MAX_RECENT_ACTIONS = 12;

export const travelModes = [
  { id: 'driving', label: '驾车' },
  { id: 'transit', label: '公交地铁' },
  { id: 'walking', label: '步行' },
  { id: 'bicycling', label: '骑行' }
];

export function createDefaultAgentMemory() {
  return {
    version: 1,
    profile: {
      name: '',
      home: '',
      work: '',
      frequentPlaces: [],
      preferredMode: 'transit',
      careWeather: true,
      careAirQuality: true,
      careRestriction: true,
      syncEnabled: false,
      syncId: globalThis.crypto?.randomUUID?.() || `local-${Date.now()}`
    },
    recentActions: [],
    messages: [],
    updatedAt: Date.now()
  };
}

const text = (value, max = 120) => typeof value === 'string' ? value.trim().slice(0, max) : '';

function normaliseProfile(value = {}) {
  const frequentPlaces = Array.isArray(value.frequentPlaces)
    ? value.frequentPlaces.slice(0, 8).map(place => ({
        name: text(place?.name, 30),
        address: text(place?.address, 120)
      })).filter(place => place.name && place.address)
    : [];
  return {
    name: text(value.name, 30),
    home: text(value.home, 120),
    work: text(value.work, 120),
    frequentPlaces,
    preferredMode: travelModes.some(mode => mode.id === value.preferredMode) ? value.preferredMode : 'transit',
    careWeather: value.careWeather !== false,
    careAirQuality: value.careAirQuality !== false,
    careRestriction: value.careRestriction !== false,
    syncEnabled: Boolean(value.syncEnabled),
    syncId: text(value.syncId, 80) || (globalThis.crypto?.randomUUID?.() || `local-${Date.now()}`)
  };
}

function normaliseMessage(message) {
  if (!message || !['user', 'assistant'].includes(message.role)) return null;
  const content = text(message.content, 5000);
  if (!content) return null;
  return {
    role: message.role,
    content,
    error: Boolean(message.error),
    proactive: Boolean(message.proactive),
    level: text(message.level, 12),
    ts: Number(message.ts) || Date.now(),
    sources: Array.isArray(message.sources) ? message.sources.slice(0, 10).map(source => ({
      title: text(source?.title, 160),
      url: /^https?:\/\//i.test(source?.url || '') ? text(source.url, 600) : '',
      siteName: text(source?.siteName, 60)
    })).filter(source => source.title && source.url) : []
  };
}

export function normaliseAgentMemory(value = {}) {
  const base = createDefaultAgentMemory();
  return {
    version: 1,
    profile: normaliseProfile(value.profile || base.profile),
    recentActions: Array.isArray(value.recentActions)
      ? value.recentActions.slice(-MAX_RECENT_ACTIONS).map(item => ({
          type: text(item?.type, 40),
          label: text(item?.label, 60),
          args: item?.args && typeof item.args === 'object' ? item.args : {},
          result: text(item?.result, 160),
          at: Number(item?.at) || Date.now()
        })).filter(item => item.type)
      : [],
    messages: Array.isArray(value.messages)
      ? value.messages.slice(-MAX_MESSAGES).map(normaliseMessage).filter(Boolean)
      : [],
    updatedAt: Number(value.updatedAt) || Date.now()
  };
}

export function loadAgentMemory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normaliseAgentMemory(JSON.parse(raw)) : createDefaultAgentMemory();
  } catch {
    return createDefaultAgentMemory();
  }
}

export function saveAgentMemory(memory) {
  const safe = normaliseAgentMemory({ ...memory, updatedAt: Date.now() });
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(safe)); } catch { /* 存储空间不足时保留当前会话 */ }
  return safe;
}

export function clearAgentConversation(memory) {
  return saveAgentMemory({ ...memory, messages: [] });
}

export function rememberAction(memory, action, result) {
  const recentActions = [
    ...(memory.recentActions || []),
    {
      type: text(action?.type, 40),
      label: text(action?.label, 60),
      args: action?.args && typeof action.args === 'object' ? action.args : {},
      result: text(result?.message, 160),
      at: Date.now()
    }
  ].slice(-MAX_RECENT_ACTIONS);
  return saveAgentMemory({ ...memory, recentActions });
}

export function applyProfileMemory(memory, args = {}) {
  const profile = { ...memory.profile };
  ['name', 'home', 'work'].forEach(key => {
    if (typeof args[key] === 'string' && args[key].trim()) profile[key] = text(args[key], key === 'name' ? 30 : 120);
  });
  if (travelModes.some(mode => mode.id === args.preferredMode)) profile.preferredMode = args.preferredMode;
  ['careWeather', 'careAirQuality', 'careRestriction'].forEach(key => {
    if (typeof args[key] === 'boolean') profile[key] = args[key];
  });
  if (args.placeName && args.placeAddress) {
    profile.frequentPlaces = [
      ...profile.frequentPlaces.filter(place => place.name !== text(args.placeName, 30)),
      { name: text(args.placeName, 30), address: text(args.placeAddress, 120) }
    ].slice(-8);
  }
  return saveAgentMemory({ ...memory, profile });
}

export function memoryContext(memory) {
  return {
    profile: normaliseProfile(memory.profile),
    recentActions: (memory.recentActions || []).slice(-6),
    conversationSummary: (memory.messages || []).slice(-8).map(({ role, content }) => ({ role, content }))
  };
}

export { STORAGE_KEY };
