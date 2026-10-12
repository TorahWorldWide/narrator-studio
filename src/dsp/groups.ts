/** Effect groups for the "+" sheet and the card badges. Ids that do not exist yet are skipped. */
export interface Group { id: string; icon: string; he: string; modules: string[] }

export const GROUPS: Group[] = [
  { id: 'noise', icon: '🧹', he: 'ניקוי רעש', modules: ['nr', 'ainr', 'hum', 'gate', 'expander', 'dereverb'] },
  { id: 'mouth', icon: '👄', he: 'פה ונשימות', modules: ['declick', 'deplosive', 'debreath', 'deess'] },
  { id: 'level', icon: '🔊', he: 'עוצמה', modules: ['gain', 'comp', 'mbcomp', 'limiter', 'clipper', 'loudness', 'rider', 'transient'] },
  { id: 'tone', icon: '🎨', he: 'צבע הקול', modules: ['hp', 'lp', 'eq', 'geq', 'dyneq', 'tilt', 'exciter', 'sat'] },
  { id: 'space', icon: '🏛', he: 'חלל והד', modules: ['reverb', 'room', 'delay'] },
  { id: 'fun', icon: '🎭', he: 'יצירתי', modules: ['pitch', 'chorus', 'phaser', 'lofi', 'tremolo', 'robot'] },
];

const byModule = new Map(GROUPS.flatMap((g) => g.modules.map((m) => [m, g] as const)));
export const groupOf = (id: string): Group | undefined => byModule.get(id);
