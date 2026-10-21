import { objectiveRows, objectiveTitle } from './progression.js';
import { icon } from './icons.js';

export function renderMission(panel, state) {
  const rows = state.campaignComplete ? [{ label: '避難所への補給 完了', value: 1, target: 1, done: true }] : objectiveRows(state).sort((a, b) => Number(a.done) - Number(b.done));
  const title = objectiveTitle(state), completed = rows.filter(row => row.done).length;
  const signature = JSON.stringify([title, rows]);
  if (panel.dataset.mission === signature) return;
  panel.dataset.mission = signature;
  const toggle = document.createElement('button');
  toggle.type = 'button'; toggle.className = 'mission-toggle';
  toggle.setAttribute('aria-label', 'ミッション一覧');
  toggle.setAttribute('aria-expanded', String(panel.classList.contains('expanded')));
  const name = document.createElement('b'); name.textContent = title;
  const count = document.createElement('span'); count.textContent = state.campaignComplete ? '完了' : `${completed}/${rows.length}`; count.append(icon('chevron', 15));
  toggle.append(name, count);
  toggle.onclick = () => {
    panel.classList.toggle('expanded');
    toggle.setAttribute('aria-expanded', String(panel.classList.contains('expanded')));
    panel.dispatchEvent(new Event('mission:toggle'));
  };
  const list = document.createElement('ol'); list.className = 'mission-list';
  for (const row of rows) {
    const item = document.createElement('li'); item.className = `mission-row${row.done ? ' complete' : ''}`;
    const label = document.createElement('span'); label.textContent = `${row.done ? '✓ ' : ''}${row.label}`;
    const value = document.createElement('b'); value.textContent = `${row.value}/${row.target}`;
    const bar = document.createElement('progress'); bar.max = row.target; bar.value = row.value;
    bar.setAttribute('aria-label', row.label);
    item.append(label, value, bar); list.append(item);
  }
  const direction = document.createElement('div'); direction.id = 'navigationHint'; direction.className = 'navigation-hint';
  direction.append(icon('navigation', 14), document.createElement('span'));
  panel.replaceChildren(toggle, list, direction);
}
