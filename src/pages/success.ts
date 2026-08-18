import { Env } from "../types.js";
import { escapeHtml, getPublicBase } from "../utils.js";
import { BRAND_FONTS, stylesLink, THEME_COLOR, setupHeader, siteFooter } from "../templates.js";

export async function renderSetupSuccess(request: Request, env: Env, email: string, sessionToken: string, ms: string): Promise<Response> {
  const base = getPublicBase(request);
  const mcpUrl = `${base}/mcp?token=${sessionToken}`;
  const cmd = `claude mcp add harvia --transport http "${mcpUrl}" -s user`;

  const allList = await env.SESSIONS.get<{token:string;createdAt:number}[]>(`user:${email}`, "json") ?? [];
  const alive = (await Promise.all(
    allList.map(async e => {
      const exists = await env.SESSIONS.get(`session:${e.token}`) !== null;
      return exists ? e : null;
    })
  )).filter(Boolean) as {token:string;createdAt:number}[];

  const urlRows = alive.sort((a,b) => b.createdAt - a.createdAt).map(e => {
    const isCurrent = e.token === sessionToken;
    const revokeBtn = isCurrent
      ? `<form method="POST" action="${escapeHtml(base + "/revoke?s=" + ms)}" style="display:inline;">
          <input type="hidden" name="token" value="${escapeHtml(e.token)}">
          <input type="hidden" name="ref" value="logout">
          <button type="submit" class="revoke-btn" onclick="return confirm('Revoke this URL and log out? Claude will lose access to your Harvia devices.')">Revoke &amp; log out</button>
        </form>`
      : `<form method="POST" action="${escapeHtml(base + "/revoke?s=" + ms)}" style="display:inline;">
          <input type="hidden" name="token" value="${escapeHtml(e.token)}">
          <input type="hidden" name="current" value="${escapeHtml(sessionToken)}">
          <button type="submit" class="revoke-btn" onclick="return confirm('Revoke this URL?')">Revoke</button>
        </form>`;
    return `<tr${isCurrent ? ' class="sc-current"' : ''}>
      <td><span data-ts="${e.createdAt}"></span>${isCurrent ? ' <span class="sc-badge">new</span>' : ''}</td>
      <td class="sc-token">${escapeHtml(e.token.substring(0,12))}…</td>
      <td>${revokeBtn}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Harvia MCP Setup</title>
${THEME_COLOR}
${BRAND_FONTS}
${stylesLink(base)}
<style>
main{align-items:center;}
.column{max-width:640px;}
.card{margin-bottom:1rem;}
.sc-lead{font-size:.875rem;color:var(--text-muted);line-height:1.6;}
.sc-actions{display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;}
.sc-link{font-size:.8rem;color:var(--text-dim);text-decoration:none;border-bottom:1px solid var(--line-strong);}
.sc-link:hover{color:var(--text);border-bottom-color:var(--text);}
.sc-hint{margin-top:1.1rem;}
.sc-aside{font-size:.8rem;color:var(--text-muted);line-height:1.6;margin-top:.85rem;}
.sc-muted{color:var(--text-dim);}
.sc-more{margin-top:.6rem;font-style:italic;}
.instruction-body>.notice-beta{margin-bottom:1.15rem;}
/* The row for the URL just issued. */
.sc-current{background:rgba(237,28,36,.08);}
.sc-badge{
  font-family:var(--font-display);font-weight:700;
  font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;
  background:var(--harvia-red);color:var(--natural-white);
  padding:2px 7px;border-radius:var(--radius);margin-left:6px;
}
.sc-token{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.75rem;color:var(--text-dim);}
details.card>summary{list-style:none;cursor:pointer;}
details.card>summary::-webkit-details-marker{display:none;}
details.card>summary.card-header{transition:background-color .15s;}
details.card>summary.card-header:hover{background:rgba(255,255,255,.06);}
.note code{font-size:.76rem;}
</style>
<script>
function copyText(text, btn) {
  navigator.clipboard.writeText(text);
  const orig = btn.textContent;
  btn.textContent = '✓ Copied';
  btn.classList.add('ok');
  setTimeout(() => { btn.textContent = orig; btn.classList.remove('ok'); }, 2000);
}
function switchTab(os) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.os === os));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.dataset.os === os));
}
function openManage() {
  const d = document.getElementById('manage-urls');
  if (d) { d.open = true; setTimeout(() => d.scrollIntoView({behavior:'smooth'}), 50); }
}
function toggleUrl() {
  const box = document.getElementById('url-box');
  const btn = document.getElementById('url-toggle');
  if (!box || !btn) return;
  const visible = box.dataset.visible === '1';
  box.textContent = visible ? '••••••••••••••••••••••••••••••••••••••••' : box.dataset.url;
  box.dataset.visible = visible ? '0' : '1';
  btn.textContent = visible ? 'Show URL' : 'Hide URL';
}
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('[data-ts]').forEach(function(el) {
    const d = new Date(Number(el.getAttribute('data-ts')));
    const date = d.toLocaleDateString(undefined, {day:'numeric', month:'short', year:'numeric'});
    const time = d.toLocaleTimeString(undefined, {hour:'2-digit', minute:'2-digit'});
    el.innerHTML = date + '<br><span style="font-size:.75rem;color:var(--text2);">' + time + '</span>';
  });
});
</script>
</head>
<body>
${setupHeader({ base })}
<main>
<div class="column">

<div class="card">
  <div class="card-header"><h2>Your personal Harvia MCP server URL</h2></div>
  <div class="card-body">
    <p class="sc-lead">This URL allows using the Harvia MCP server with your MyHarvia account. Keep it private and treat it like a password.</p>
    <div id="url-box" class="url-box" data-url="${escapeHtml(mcpUrl)}" data-visible="0">••••••••••••••••••••••••••••••••••••••••</div>
    <div class="sc-actions">
      <button class="btn btn-primary btn-sm" onclick="copyText('${escapeHtml(mcpUrl)}',this)">Copy URL</button>
      <button id="url-toggle" class="btn btn-ghost btn-sm" onclick="toggleUrl()">Show URL</button>
      <a href="#manage-urls" onclick="openManage()" class="sc-link">Manage your URLs</a>
    </div>
    <p class="hint sc-hint">URLs are valid for 1 year. You need to generate a new URL if you change your password.</p>
  </div>
</div>

<div class="card">
  <div class="card-header"><h2>Getting started with Harvia MCP server</h2></div>
  <div class="card-body">

    <details class="instruction" open>
      <summary>Claude</summary>
      <div class="instruction-body">
        <div class="notice-beta">
          <strong>Beta feature</strong> — Connectors in Claude.ai are currently in beta and subject to change.
          <ul>
            <li>Using account-specific URLs only available on <strong>personal accounts</strong>.</li>
            <li>Free plan users can currently have <strong>one custom connector</strong> at a time.</li>
          </ul>
        </div>
        <div class="step-row"><div class="step-dot">1</div><p>Open <a href="https://claude.ai" target="_blank" rel="noopener">claude.ai</a> <span class="sc-muted">(These instructions are for the online version. Currently, it is not possible to set up Harvia MCP server in the desktop or mobile application. However, you will be able to use it through the applications after setup.)</span></p></div>
        <div class="step-row"><div class="step-dot">2</div><p>Click <strong>Customize</strong> in the left sidebar</p></div>
        <div class="step-row"><div class="step-dot">3</div><p>Select <strong>Connectors</strong></p></div>
        <div class="step-row"><div class="step-dot">4</div><p>Press the <strong>+</strong> icon in the top right corner</p></div>
        <div class="step-row"><div class="step-dot">5</div><p>Select <strong>Add custom connector</strong></p></div>
        <div class="step-row"><div class="step-dot">6</div><p>Give the server a name (e.g. <strong>"Harvia"</strong>) and paste your URL from above</p></div>
        <div class="step-row"><div class="step-dot">7</div><p><strong>Save</strong> — your Harvia devices are now available in Claude. You may need to start a new chat or restart Claude for the changes to take effect.</p></div>
        <p class="sc-aside">You can edit the connector settings from the same menu to customize which commands require your permission before running.</p>
        <p class="sc-aside">When you're done setting up, you can <a href="${escapeHtml(base + "/setup")}">log out here.</a></p>
      </div>
    </details>

    <details class="instruction">
      <summary>Claude Code</summary>
      <div class="instruction-body">
        <div class="tabs">
          <div class="tab active" data-os="win" onclick="switchTab('win')">Windows</div>
          <div class="tab" data-os="mac" onclick="switchTab('mac')">macOS</div>
        </div>
        <div class="tab-panel active" data-os="win">
          <div class="step-row"><div class="step-dot">1</div><p>Open <strong>PowerShell</strong></p></div>
          <div class="step-row"><div class="step-dot">2</div><p>Run this command:</p></div>
          <div class="cmd-box">${escapeHtml(cmd)}</div>
          <button class="btn btn-primary btn-sm" onclick="copyText('${escapeHtml(cmd)}',this)">Copy command</button>
          <div class="step-row" style="margin-top:.9rem;"><div class="step-dot">3</div><p>Start a <strong>new Claude Code session</strong> — your Harvia devices will be available.</p></div>
        </div>
        <div class="tab-panel" data-os="mac">
          <div class="step-row"><div class="step-dot">1</div><p>Open <strong>Terminal</strong></p></div>
          <div class="step-row"><div class="step-dot">2</div><p>Run this command:</p></div>
          <div class="cmd-box">${escapeHtml(cmd)}</div>
          <button class="btn btn-primary btn-sm" onclick="copyText('${escapeHtml(cmd)}',this)">Copy command</button>
          <div class="step-row" style="margin-top:.9rem;"><div class="step-dot">3</div><p>Start a <strong>new Claude Code session</strong> — your Harvia devices will be available.</p></div>
        </div>
        <div class="note">You can also add this server directly to Claude's MCP config JSON file under <code>mcpServers</code>.</div>
        <p class="sc-aside">When you're done setting up, you can <a href="${escapeHtml(base + "/setup")}">log out here.</a></p>
      </div>
    </details>

    <p class="more-soon sc-more">More instructions coming soon</p>

  </div>
</div>

<details class="card" id="manage-urls">
  <summary class="card-header">
    <h2>Manage your URLs</h2>
  </summary>
  <table>
    <thead><tr><th>Created</th><th>Token</th><th></th></tr></thead>
    <tbody>${urlRows}</tbody>
  </table>
  <div class="table-footer">
    <a href="${escapeHtml(base+"/setup?s="+ms)}" class="btn btn-primary btn-sm">+ Generate new URL</a>
    ${alive.length > 1 ? `<form method="POST" action="${escapeHtml(base+"/revoke-all?s="+ms)}">
      <input type="hidden" name="current" value="${escapeHtml(sessionToken)}">
      <button type="submit" class="btn btn-ghost btn-sm" onclick="return confirm('Revoke all ${alive.length - 1} previous URL${alive.length - 1 !== 1 ? "s" : ""}?')">Revoke all previous URLs</button>
    </form>` : ""}
  </div>
</details>

</div>
</main>
${siteFooter()}
</body>
</html>`;
  return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
}
