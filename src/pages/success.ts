import { Env } from "../types.js";
import { escapeHtml, getPublicBase } from "../utils.js";
import { BRAND_FONTS, BRAND_CSS, setupHeader } from "../templates.js";

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
    return `<tr${isCurrent ? ' style="background:#f0fff0;"' : ''}>
      <td style="font-size:.825rem;color:var(--text);"><span data-ts="${e.createdAt}"></span>${isCurrent ? ' <span style="font-size:.7rem;background:var(--red);color:white;padding:1px 6px;border-radius:10px;margin-left:4px;">new</span>' : ''}</td>
      <td style="font-family:monospace;font-size:.75rem;color:var(--text2);">${escapeHtml(e.token.substring(0,12))}…</td>
      <td>${revokeBtn}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Harvia MCP Setup</title>
${BRAND_FONTS}
<style>
${BRAND_CSS}
main{flex:1;padding:2rem 1rem;display:flex;flex-direction:column;align-items:center;}
.card{background:var(--white);border-radius:12px;border:1px solid var(--border);width:100%;max-width:580px;overflow:hidden;margin-bottom:1rem;}
.card-header{background:var(--light-gray);padding:.9rem 1.4rem;display:flex;align-items:center;gap:.6rem;border-bottom:1px solid var(--border);}
.card-header h2{font-size:.875rem;color:var(--text);font-weight:600;}
.instruction{border:1px solid var(--border);border-radius:8px;margin-bottom:.75rem;overflow:hidden;}
.instruction summary{list-style:none;cursor:pointer;padding:.7rem 1rem;font-family:'Montserrat',sans-serif;font-weight:600;font-size:.84rem;color:var(--text);display:flex;align-items:center;gap:.5rem;background:var(--bg);}
.instruction summary::-webkit-details-marker{display:none;}
.instruction summary::before{content:'▶';font-size:.55rem;color:var(--text2);transition:transform .15s;flex-shrink:0;}
.instruction[open]>summary::before{transform:rotate(90deg);}
.instruction-body{padding:.9rem 1rem 1rem;border-top:1px solid var(--border);}
.card-body{padding:1.25rem 1.5rem;}
.url-box{background:var(--cream);border:1px solid var(--light-gray);border-radius:6px;padding:.7rem 1rem;font-family:monospace;font-size:.78rem;color:var(--text);word-break:break-all;margin:.6rem 0 .8rem;}
.btn{display:inline-flex;align-items:center;padding:.4rem .9rem;border:none;border-radius:5px;font-family:'Montserrat',sans-serif;font-weight:600;font-size:.78rem;cursor:pointer;transition:all .15s;}
.btn-red{background:var(--red);color:white;}.btn-red:hover{background:var(--deep-red);}
.btn-dark{background:var(--text);color:white;}.btn-dark:hover{background:var(--near-black);}
.btn-gray{background:var(--warm-gray);color:var(--text);border:1px solid var(--light-gray);}.btn-gray:hover{background:var(--red);color:white;border-color:var(--red);}
.btn-danger{background:white;color:#7a2020;border:1px solid #f5c4c4;}.btn-danger:hover{background:#7a2020;color:white;}
.btn.ok{background:#2d7a2d !important;color:white !important;}
.tabs{display:flex;border-bottom:1px solid var(--border);margin-bottom:.9rem;}
.tab{padding:.4rem 1rem;font-size:.825rem;font-weight:500;color:var(--text2);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;}
.tab.active{color:var(--red);border-bottom-color:var(--red);}
.tab-panel{display:none;}.tab-panel.active{display:block;}
.step-row{display:flex;gap:.6rem;align-items:flex-start;margin-bottom:.6rem;}
.step-dot{width:18px;height:18px;border-radius:50%;background:var(--warm-gray);border:1px solid var(--light-gray);font-family:'Montserrat',sans-serif;font-weight:700;font-size:.65rem;color:var(--text2);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;}
.step-row p{font-size:.84rem;color:var(--text);line-height:1.5;}
.cmd-box{background:var(--near-black);border-radius:6px;padding:.6rem .9rem;font-family:monospace;font-size:.76rem;color:#e8e8e0;word-break:break-all;margin:.4rem 0 .6rem;}
.note{font-size:.76rem;color:var(--text2);padding:.7rem 1rem;background:var(--warm-gray);border-radius:6px;margin-top:.75rem;}
.notice-beta{background:var(--cream);border:1px solid var(--light-gray);border-radius:6px;padding:.75rem 1rem;font-size:.8rem;color:var(--text2);line-height:1.6;margin-bottom:1.1rem;}
.notice-beta strong{font-weight:600;}
details.card>summary{list-style:none;cursor:pointer;}
details.card>summary::-webkit-details-marker{display:none;}
details.card>summary.card-header:hover{filter:brightness(.97);}
table{width:100%;border-collapse:collapse;}
th{text-align:left;font-size:.72rem;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--text2);padding:.6rem 1rem;border-bottom:1px solid var(--border);background:var(--warm-gray);}
td{padding:.65rem 1rem;border-bottom:1px solid var(--border);vertical-align:middle;}
tr:last-child td{border-bottom:none;}
.revoke-btn{padding:.3rem .65rem;background:white;color:#7a2020;border:1px solid #f5c4c4;border-radius:5px;font-family:'Montserrat',sans-serif;font-weight:600;font-size:.72rem;cursor:pointer;}
.revoke-btn:hover{background:#7a2020;color:white;}
.table-footer{padding:.8rem 1rem;display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--border);background:var(--warm-gray);}
footer{text-align:center;padding:1.25rem;font-size:.75rem;color:var(--text2);}
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

<div class="card">
  <div class="card-header"><h2>Your personal Harvia MCP server URL</h2></div>
  <div class="card-body">
    <p style="font-size:.84rem;color:var(--text2);">This URL allows using the Harvia MCP server with your Harvia account. Keep it private and treat it like a password.</p>
    <div id="url-box" class="url-box" data-url="${escapeHtml(mcpUrl)}" data-visible="0">••••••••••••••••••••••••••••••••••••••••</div>
    <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;">
      <button class="btn btn-red" onclick="copyText('${escapeHtml(mcpUrl)}',this)">Copy URL</button>
      <button id="url-toggle" class="btn btn-gray" onclick="toggleUrl()">Show URL</button>
      <a href="#manage-urls" onclick="openManage()" style="font-size:.8rem;color:var(--text2);text-decoration:none;border-bottom:1px solid var(--light-gray);">Manage your URLs</a>
    </div>
    <p style="font-size:.75rem;color:var(--text2);margin-top:1rem;">URLs are valid for 1 year. You need to generate a new URL if you change your password.</p>
  </div>
</div>

<div class="card">
  <div class="card-header"><h2>Getting started with Harvia MCP server</h2></div>
  <div class="card-body">

    <details class="instruction" open>
      <summary>Claude</summary>
      <div class="instruction-body">
        <div class="notice-beta">
          <strong>Beta feature</strong> — Connectors in Claude.ai are currently in beta and subject to change.<br>
          Only available on <strong>personal accounts</strong>. Team workspace users need to contact their admin.<br>
          Free plan users can currently have <strong>one custom connector</strong> at a time.
        </div>
        <div class="step-row"><div class="step-dot">1</div><p>Open <a href="https://claude.ai" target="_blank" rel="noopener" style="color:var(--red);">claude.ai</a> <span style="color:var(--text2);">(These instructions are for the online version. Currently, it is not possible to set up Harvia MCP server in the desktop or mobile application. However, you will be able to use it through the applications after setup.)</span></p></div>
        <div class="step-row"><div class="step-dot">2</div><p>Click <strong>Customize</strong> in the left sidebar</p></div>
        <div class="step-row"><div class="step-dot">3</div><p>Select <strong>Connectors</strong></p></div>
        <div class="step-row"><div class="step-dot">4</div><p>Press the <strong>+</strong> icon in the top right corner</p></div>
        <div class="step-row"><div class="step-dot">5</div><p>Select <strong>Add custom connector</strong></p></div>
        <div class="step-row"><div class="step-dot">6</div><p>Give the server a name (e.g. <strong>"Harvia"</strong>) and paste your URL from above</p></div>
        <div class="step-row"><div class="step-dot">7</div><p><strong>Save</strong> — your Harvia devices are now available in Claude. You may need to start a new chat or restart Claude for the changes to take effect.</p></div>
        <p style="font-size:.8rem;color:var(--text2);margin-top:.9rem;line-height:1.6;">You can edit the connector settings from the same menu to customize which commands require your permission before running.</p>
        <p style="font-size:.8rem;color:var(--text2);margin-top:.75rem;line-height:1.6;">When you're done setting up, you can <a href="${escapeHtml(base + "/setup")}" style="color:var(--red);text-decoration:none;">log out here.</a></p>
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
          <button class="btn btn-red" onclick="copyText('${escapeHtml(cmd)}',this)">Copy command</button>
          <div class="step-row" style="margin-top:.75rem;"><div class="step-dot">3</div><p>Start a <strong>new Claude Code session</strong> — your Harvia devices will be available.</p></div>
        </div>
        <div class="tab-panel" data-os="mac">
          <div class="step-row"><div class="step-dot">1</div><p>Open <strong>Terminal</strong></p></div>
          <div class="step-row"><div class="step-dot">2</div><p>Run this command:</p></div>
          <div class="cmd-box">${escapeHtml(cmd)}</div>
          <button class="btn btn-red" onclick="copyText('${escapeHtml(cmd)}',this)">Copy command</button>
          <div class="step-row" style="margin-top:.75rem;"><div class="step-dot">3</div><p>Start a <strong>new Claude Code session</strong> — your Harvia devices will be available.</p></div>
        </div>
        <div class="note">You can also add this server directly to Claude's MCP config JSON file under <code style="font-size:.76rem;">mcpServers</code>.</div>
        <p style="font-size:.8rem;color:var(--text2);margin-top:.75rem;line-height:1.6;">When you're done setting up, you can <a href="${escapeHtml(base + "/setup")}" style="color:var(--red);text-decoration:none;">log out here.</a></p>
      </div>
    </details>

    <p style="font-size:.78rem;color:var(--text2);margin-top:.5rem;font-style:italic;">More instructions coming soon</p>

  </div>
</div>

<details class="card" id="manage-urls">
  <summary class="card-header" style="display:flex;align-items:center;gap:.6rem;cursor:pointer;">
    <h2>Manage your URLs <span style="font-size:.75rem;font-weight:400;color:var(--text2);margin-left:.4rem;">— click to expand</span></h2>
  </summary>
  <table>
    <thead><tr><th>Created</th><th>Token</th><th></th></tr></thead>
    <tbody>${urlRows}</tbody>
  </table>
  <div class="table-footer">
    <a href="${escapeHtml(base+"/setup?s="+ms)}" class="btn btn-red" style="text-decoration:none;">+ Generate new URL</a>
    ${alive.length > 1 ? `<form method="POST" action="${escapeHtml(base+"/revoke-all?s="+ms)}">
      <input type="hidden" name="current" value="${escapeHtml(sessionToken)}">
      <button type="submit" class="btn btn-danger" onclick="return confirm('Revoke all ${alive.length - 1} previous URL${alive.length - 1 !== 1 ? "s" : ""}?')">Revoke all previous URLs</button>
    </form>` : ""}
  </div>
</details>

</main>
<footer>Created by <a href="https://www.harvialabs.com/" target="_blank" rel="noopener" style="color:inherit;">Harvia Labs</a>. &copy; 2026 Harvia</footer>
</body>
</html>`;
  return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
}
