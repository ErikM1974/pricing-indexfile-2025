"""Prepare selected generated reports in PRIVATE scratch storage for encryption.

Requires beautifulsoup4 and html5lib. No raw source documents, website snapshot or work files
are accepted. Run seal-package.js next; never stage this script's JSON output.
The dated allowlist is kept beside the private transfer, not in the public repo.
"""
import argparse
import base64
import hashlib
import json
import mimetypes
import posixpath
import re
import zipfile
from pathlib import Path
from decimal import Decimal
from urllib.parse import quote, unquote, urlsplit
from bs4 import BeautifulSoup

PREFIX = '/admin/december-finish-line/files/'
BRIDGE = """'use strict';
document.addEventListener('click', event => {
 const button=event.target.closest('[data-report-action]');
 if(!button)return;
 event.preventDefault();
 const action=button.dataset.reportAction;
 if(action==='print')window.print();
 else if(['goChapter','preset','historical','save','download'].includes(action)&&typeof window[action]==='function') {
  const arg=button.dataset.reportArgument;
  if(arg===undefined)window[action]();else window[action](arg);
 }
});
let finishLivePending=false;
async function finishLiveSummary(){
 const host=document.getElementById('finish-current-sales');
 if(!host||finishLivePending)return;
 finishLivePending=true;
 try {
  const response=await fetch('/admin/december-finish-line/live',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(35000)});
  if(response.redirected||!response.ok)throw new Error('unavailable');
  const data=await response.json();
  if(!data.sales)throw new Error('unavailable');
  const value=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(data.sales.revenueCents/100);
  const time=new Date(data.retrievedAt).toLocaleString('en-US',{timeZone:'America/Los_Angeles'});
  host.textContent='Current 2026 ShopWorks invoiced sales: '+value+' · checked '+time+' Pacific. Saved models below remain dated.';
 }catch {host.textContent='Current sales could not be refreshed. Open current sales & reports to retry. The saved plan below remains available.';}
 finally {finishLivePending=false;}
}
finishLiveSummary();
setInterval(()=>{if(!document.hidden)finishLiveSummary();},300000);
"""
CHROME = """.finish-report-bar{position:relative;z-index:20;display:flex;flex-wrap:wrap;gap:var(--space-3);padding:var(--space-3) var(--space-5);background:var(--ui-surface);color:var(--ui-ink);border-bottom:1px solid var(--ui-line);font:var(--font-size-md)/var(--line-height-base) 'Segoe UI',sans-serif}.finish-report-bar a{color:var(--ui-accent);text-decoration:underline}.finish-report-bar span{color:var(--ui-muted)}.finish-source-reference{font-size:inherit}.chapter.op,.chapter.mp{background:var(--ui-surface)} @media print{:root{color-scheme:light}html,body{background:white}.finish-report-bar{display:none}#opPrintSheet{border:0;border-radius:0}} @media(prefers-reduced-motion:reduce){.chapter{animation:none}}"""


def package(zip_path, selection, snapshot_label):
    archive = zipfile.ZipFile(zip_path)
    root = 'December-Finish-Line/'
    files = {}
    evidence = []

    def put(name, content, kind, download=False):
        if isinstance(content, str):
            content = content.encode('utf-8')
        if name in files:
            raise ValueError('Duplicate output: ' + name)
        files[name] = {'body': base64.b64encode(content).decode(), 'type': kind, 'download': download}

    for entry in selection['allowlist']:
        name = entry['path']
        if not name.startswith(('planning/outputs/', 'financial/outputs/')) or '..' in name.split('/'):
            raise ValueError('Only selected generated outputs may be packaged')
        raw = archive.read(root + name)
        evidence.append({'path': name, 'sha256': hashlib.sha256(raw).hexdigest()})
        if not name.endswith('.html'):
            kind = mimetypes.guess_type(name)[0] or 'application/octet-stream'
            put(name, raw, kind, download=not name.endswith('.pdf'))
            continue
        html = BeautifulSoup(raw.decode('utf-8'), 'html5lib')
        html.head.insert(0, html.new_tag('link', rel='stylesheet', href='/shared_components/css/tokens.css?v=2026.09.14.1'))
        for node in html.find_all('base'):
            node.decompose()
        for link in html.find_all(['a', 'link'], href=True):
            href = link['href']
            parsed = urlsplit(href)
            target = posixpath.normpath(posixpath.join(posixpath.dirname(name), unquote(parsed.path)))
            if target.startswith('sources/') or parsed.scheme == 'file':
                link.name = 'span'
                link.attrs = {'class': 'finish-source-reference'}
                link.append(' (kept in the private transfer folder)')
        # Data islands retain identical textContent, with no inline script body.
        for i, script in enumerate(html.find_all('script')):
            if script.get('src'):
                raise ValueError('Review external script before importing: ' + name)
            if script.get('type') == 'application/json':
                content = script.string or script.get_text()
                script.name = 'div'
                script.attrs = {'id': script.get('id'), 'hidden': ''}
                script.string = content
                continue
            script_name = name[:-5] + f'.script-{i}.js'
            put(script_name, script.string or script.get_text(), 'application/javascript')
            script.clear()
            script['src'] = PREFIX + '/'.join(quote(p) for p in script_name.split('/'))
        for i, style in enumerate(html.find_all('style')):
            style_name = name[:-5] + f'.style-{i}.css'
            put(style_name, style.string or style.get_text(), 'text/css')
            link = html.new_tag('link', rel='stylesheet', href=PREFIX + '/'.join(quote(p) for p in style_name.split('/')))
            if style.get('media'):
                link['media'] = style['media']
            style.replace_with(link)
        inline_css = []
        for node in html.find_all(style=True):
            klass = f'finish-inline-{len(inline_css)}'
            inline_css.append(f'.{klass}' + '{' + node.attrs.pop('style') + '}')
            node['class'] = node.get('class', []) + [klass]
        for node in html.find_all(True):
            for attr in list(node.attrs):
                if not attr.lower().startswith('on'):
                    continue
                action = node.attrs.pop(attr)
                if attr != 'onclick':
                    raise ValueError('Unsupported event: ' + attr)
                if action == 'window.print()':
                    node['data-report-action'] = 'print'
                    continue
                match = re.fullmatch(r"(goChapter|preset|historical|save|download)\((?:'([^']*)')?\)(?:;return false)?", action)
                if not match:
                    raise ValueError('Unsupported action: ' + action)
                node['data-report-action'] = match[1]
                if match[2] is not None:
                    node['data-report-argument'] = match[2]
        style_name = name[:-5] + '.document.css'
        put(style_name, '\n'.join(inline_css) + '\n' + CHROME, 'text/css')
        html.head.append(html.new_tag('link', rel='stylesheet', href=PREFIX + '/'.join(quote(p) for p in style_name.split('/'))))
        html.body.append(html.new_tag('script', src=PREFIX + 'document-actions.js'))
        bar = html.new_tag('nav', attrs={'class': 'finish-report-bar', 'aria-label': 'Finish Line documents'})
        back = html.new_tag('a', href='/dashboards/december-finish-line.html')
        back.string = 'Finish Line · current sales & reports'
        stamp = html.new_tag('span')
        stamp.string = 'Saved financial plan · ' + snapshot_label + ' · Admin only'
        bar.extend([back, stamp])
        live_status = html.new_tag('span', id='finish-current-sales', attrs={'role':'status'})
        live_status.string = 'Checking current ShopWorks sales…'
        bar.append(live_status)
        html.body.insert(0, bar)
        if name == selection['primary']:
            html.title.string = 'December 2026 Finish Line - Northwest Custom Apparel'
        put(name, str(html), 'text/html')
    put('document-actions.js', BRIDGE, 'application/javascript')
    links = []
    wanted = [
        ('Erik-Weekly-Profit-Plan.html', 'Erik’s weekly plan', 'Friday checks, priority buyers and progress backups'),
        ('NWCA-2026-Monthly-Sales-Payroll-Profit.html', 'Monthly sales, payroll & profit', 'Saved model and overtime scenarios'),
        ('Nika-Q4-Sales-Book.pdf', 'Nika’s sales book', 'Prepared customer plan · PDF'),
        ('Taneisha-Q4-Sales-Book.pdf', 'Taneisha’s sales book', 'Prepared customer plan · PDF'),
        ('Ruthie-Q4-Sales-Book.pdf', 'Ruthie’s sales book', 'Contract customer plan · PDF'),
        ('Erik-Q4-Sales-Plan.pdf', 'Erik’s sales plan', 'Prepared priorities · PDF'),
        ('NWCA-Q4-Marketing-Plan-', 'Q4 marketing plan', 'Campaign plan and proposed spending · PDF'),
        ('NWCA Cash Observatory.html', 'Cash observatory', 'Saved cash and collections analysis'),
    ]
    for suffix, title, description in wanted:
        matches = [k for k in files if posixpath.basename(k).startswith(suffix)]
        if len(matches) != 1:
            raise ValueError('Ambiguous or missing catalog entry: ' + suffix)
        links.append({'path': matches[0], 'title': title, 'description': description})
    model_path = posixpath.join(posixpath.dirname(selection['primary']), '2026-Profit-Projection-Data.json')
    model = json.loads(archive.read(root + model_path))
    net_sales = Decimal(str(model['actuals']['revenue'])) - Decimal(str(model['actuals']['shipping']))
    baseline = {'asOf': model['as_of'], 'netSalesCents': int((net_sales * 100).quantize(Decimal('1')))}
    return {'version': 1, 'primary': selection['primary'], 'aliases': selection.get('alias', {}),
            'catalog': {'primary': selection['primary'], 'snapshotLabel': snapshot_label, 'links': links, 'baseline': baseline},
            'files': files, 'sourceEvidence': evidence}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--zip', required=True)
    parser.add_argument('--allowlist', required=True)
    parser.add_argument('--private-output', required=True)
    parser.add_argument('--snapshot-label', required=True)
    args = parser.parse_args()
    output = Path(args.private_output).resolve()
    repo = Path(__file__).resolve().parents[2]
    if output.is_relative_to(repo):
        raise ValueError('Plaintext output must remain outside the website checkout')
    result = package(args.zip, json.loads(Path(args.allowlist).read_text()), args.snapshot_label)
    output.write_text(json.dumps(result, separators=(',', ':')), encoding='utf-8')
    print(json.dumps({'documents': len(result['sourceEvidence']), 'protectedFiles': len(result['files'])}))
