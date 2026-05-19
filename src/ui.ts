import type { PluginMessage, UIMessage } from './messages';
import type { NodeResult, RuleMeta } from './types';

// State
let currentScope: 'frame' | 'selection' = 'frame';
let results: NodeResult[] = [];
let rules: RuleMeta[] = [];
let scannedCount: number = 0;
let activeFilters: Set<string> = new Set();
let skippedIssues: Set<string> = new Set(); // "nodeId:ruleId:offset"
let fixedIssues: Set<string> = new Set();

// DOM elements
const fixAllBtn = document.getElementById('fix-all-btn') as HTMLButtonElement;
const statsBar = document.getElementById('stats-bar') as HTMLDivElement;
const filterBar = document.getElementById('filter-bar') as HTMLDivElement;
const progressBar = document.getElementById('progress-bar') as HTMLDivElement;
const progressFill = document.getElementById('progress-fill') as HTMLDivElement;
const emptyState = document.getElementById('empty-state') as HTMLDivElement;
const successState = document.getElementById('success-state') as HTMLDivElement;
const successSub = document.getElementById('success-sub') as HTMLParagraphElement;
const issueList = document.getElementById('issue-list') as HTMLDivElement;

// Send message to plugin
function send(msg: UIMessage): void {
  parent.postMessage({ pluginMessage: msg }, '*');
}

// Scope selector — switching scope triggers auto-scan
document.querySelectorAll('.scope-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.scope-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentScope = (btn as HTMLElement).dataset.scope as 'frame' | 'selection';
    skippedIssues.clear();
    fixedIssues.clear();
    send({ type: 'set-scope', scope: currentScope });
  });
});

// Fix all button
fixAllBtn.addEventListener('click', () => {
  fixAllBtn.disabled = true;
  fixAllBtn.textContent = '修复中...';
  send({ type: 'fix-all' });
});

// Get issue key
function issueKey(nodeId: string, ruleId: string, offset: number): string {
  return `${nodeId}:${ruleId}:${offset}`;
}

// Count issues by rule
function countByRule(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const result of results) {
    for (const issue of result.issues) {
      counts.set(issue.ruleId, (counts.get(issue.ruleId) || 0) + 1);
    }
  }
  return counts;
}

// Render filter chips
function renderFilters(): void {
  filterBar.innerHTML = '';
  const counts = countByRule();

  if (counts.size === 0) {
    filterBar.classList.remove('visible');
    return;
  }

  filterBar.classList.add('visible');

  // "All" chip
  const allChip = document.createElement('button');
  allChip.className = `filter-chip ${activeFilters.size === 0 ? 'active' : ''}`;
  allChip.innerHTML = `全部<span class="count">${results.reduce((n, r) => n + r.issues.length, 0)}</span>`;
  allChip.addEventListener('click', () => {
    activeFilters.clear();
    renderFilters();
    renderIssues();
  });
  filterBar.appendChild(allChip);

  for (const rule of rules) {
    const count = counts.get(rule.id);
    if (!count) continue;

    const chip = document.createElement('button');
    chip.className = `filter-chip ${activeFilters.has(rule.id) ? 'active' : ''}`;
    chip.innerHTML = `${rule.name}<span class="count">${count}</span>`;
    chip.addEventListener('click', () => {
      if (activeFilters.has(rule.id)) {
        activeFilters.delete(rule.id);
      } else {
        activeFilters.add(rule.id);
      }
      renderFilters();
      renderIssues();
    });
    filterBar.appendChild(chip);
  }
}

// Render stats
function renderStats(): void {
  const totalIssues = results.reduce((n, r) => n + r.issues.length, 0);
  if (totalIssues === 0) {
    statsBar.classList.remove('visible');
    return;
  }
  statsBar.classList.add('visible');
  statsBar.textContent = `在 ${results.length} 个文本图层中发现 ${totalIssues} 个问题`;
}

// Render issue list
function renderIssues(): void {
  issueList.innerHTML = '';

  const filteredResults = results.map((r) => ({
    ...r,
    issues: r.issues.filter((i) =>
      activeFilters.size === 0 || activeFilters.has(i.ruleId)
    ),
  })).filter((r) => r.issues.length > 0);

  if (filteredResults.length === 0) {
    issueList.classList.remove('visible');

    // Three states:
    // 1) Text was scanned and no issues found → success state
    // 2) Filtered to empty but issues exist elsewhere → success-like message
    // 3) Nothing scanned (no selection / no text) → idle empty state
    const hasUnfilteredIssues = results.length > 0;

    if (scannedCount > 0 && !hasUnfilteredIssues) {
      // True success: scanned text, zero issues across the board
      emptyState.classList.add('hidden');
      successState.classList.remove('hidden');
      successSub.textContent = `已检查 ${scannedCount} 个文本图层，未发现文法问题`;
    } else if (hasUnfilteredIssues) {
      // Filtered to empty but there are issues in other rules
      emptyState.classList.remove('hidden');
      successState.classList.add('hidden');
      const icon = emptyState.querySelector('.empty-icon') as HTMLDivElement;
      const text = emptyState.querySelector('p') as HTMLParagraphElement;
      icon.textContent = '·';
      text.textContent = '当前筛选下没有匹配的问题';
    } else {
      // Idle: nothing selected or no text in selection
      emptyState.classList.remove('hidden');
      successState.classList.add('hidden');
      const icon = emptyState.querySelector('.empty-icon') as HTMLDivElement;
      const text = emptyState.querySelector('p') as HTMLParagraphElement;
      icon.textContent = '✦';
      text.textContent = '选中画板或文本图层即可自动检查';
    }
    return;
  }

  emptyState.classList.add('hidden');
  successState.classList.add('hidden');
  issueList.classList.add('visible');

  for (const result of filteredResults) {
    const group = document.createElement('div');
    group.className = 'node-group';

    // Node header
    const header = document.createElement('div');
    header.className = 'node-header';

    const hasErrors = result.issues.some((i) => {
      const rule = rules.find((r) => r.id === i.ruleId);
      return rule?.severity === 'error';
    });

    const textPreview = result.text.length > 40
      ? result.text.slice(0, 40) + '...'
      : result.text;

    header.innerHTML = `
      <span class="layer-icon">T</span>
      <span>${escapeHtml(textPreview)}</span>
      <span class="issue-count ${hasErrors ? '' : 'warning'}">${result.issues.length}</span>
    `;

    header.addEventListener('click', () => {
      send({ type: 'focus-node', nodeId: result.nodeId });
    });

    group.appendChild(header);

    // Issues
    for (const issue of result.issues) {
      const key = issueKey(result.nodeId, issue.ruleId, issue.offset);
      const isFixed = fixedIssues.has(key);
      const isSkipped = skippedIssues.has(key);
      const rule = rules.find((r) => r.id === issue.ruleId);

      const item = document.createElement('div');
      item.className = `issue-item ${isFixed ? 'fixed' : ''} ${isSkipped ? 'skipped' : ''}`;

      // Truncate long strings for preview
      const origDisplay = issue.original.length > 30
        ? issue.original.slice(0, 30) + '...'
        : issue.original;
      const replDisplay = issue.replacement.length > 30
        ? issue.replacement.slice(0, 30) + '...'
        : issue.replacement;

      item.innerHTML = `
        <div class="issue-meta">
          <span class="severity-dot ${rule?.severity || 'warning'}"></span>
          <span class="issue-rule">${escapeHtml(rule?.name || issue.ruleId)}</span>
        </div>
        <div class="issue-message">${escapeHtml(issue.message)}</div>
        <div class="issue-preview">
          <span class="issue-original">${escapeHtml(origDisplay)}</span>
          <span class="issue-arrow">→</span>
          <span class="issue-replacement">${escapeHtml(replDisplay)}</span>
        </div>
        <div class="issue-actions">
          ${isFixed ? '<span style="font-size:10px;color:#22863a">已修复</span>' :
            isSkipped ? '<span style="font-size:10px;color:#999">已跳过</span>' : `
            <button class="btn-fix" data-node="${result.nodeId}" data-rule="${issue.ruleId}">修复</button>
            <button class="btn-skip" data-key="${key}">跳过</button>
          `}
        </div>
      `;

      // Fix button
      const fixBtn = item.querySelector('.btn-fix');
      if (fixBtn) {
        fixBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          send({ type: 'fix-one', nodeId: result.nodeId, ruleId: issue.ruleId });
        });
      }

      // Skip button
      const skipBtn = item.querySelector('.btn-skip');
      if (skipBtn) {
        skipBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          skippedIssues.add(key);
          item.classList.add('skipped');
          item.querySelector('.issue-actions')!.innerHTML =
            '<span style="font-size:10px;color:#999">已跳过</span>';
        });
      }

      group.appendChild(item);
    }

    issueList.appendChild(group);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Handle messages from plugin
window.onmessage = (event: MessageEvent) => {
  const msg = event.data.pluginMessage as PluginMessage;
  if (!msg) return;

  switch (msg.type) {
    case 'scan-progress': {
      const pct = Math.round((msg.current / msg.total) * 100);
      progressFill.style.width = `${pct}%`;
      break;
    }

    case 'scan-results': {
      results = msg.results;
      rules = msg.rules;
      scannedCount = msg.scannedCount;
      progressBar.style.display = 'none';

      const totalIssues = results.reduce((n, r) => n + r.issues.length, 0);
      fixAllBtn.disabled = totalIssues === 0;
      fixAllBtn.textContent = '全部修复';

      activeFilters.clear();
      renderStats();
      renderFilters();
      renderIssues();
      break;
    }

    case 'fix-done': {
      // Mark all issues for this node+rule as fixed
      const result = results.find((r) => r.nodeId === msg.nodeId);
      if (result) {
        for (const issue of result.issues) {
          if (issue.ruleId === msg.ruleId) {
            fixedIssues.add(issueKey(msg.nodeId, msg.ruleId, issue.offset));
          }
        }
        // Update text in results
        result.text = msg.newText;
      }
      renderIssues();
      break;
    }

    case 'fix-all-done': {
      results = msg.results;
      scannedCount = msg.scannedCount;
      fixAllBtn.textContent = '全部修复';
      fixAllBtn.disabled = results.length === 0;
      fixedIssues.clear();
      skippedIssues.clear();
      renderStats();
      renderFilters();
      renderIssues();
      break;
    }

    case 'error': {
      console.error('Plugin error:', msg.message);
      fixAllBtn.textContent = '全部修复';
      progressBar.style.display = 'none';

      // Show error visually in stats bar
      statsBar.classList.add('visible');
      statsBar.textContent = msg.message;
      statsBar.style.color = '#e05252';
      setTimeout(function() {
        statsBar.style.color = '';
        renderStats();
      }, 3000);
      break;
    }
  }
};
