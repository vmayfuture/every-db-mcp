"""Build committed GitHub Pages HTML from the repository's Markdown docs."""
from pathlib import Path
from urllib.parse import urlsplit, unquote
import html
import json
import re

import markdown

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / 'docs'
BASE = 'https://vmayfuture.github.io/every-db-mcp/'
REPO = 'https://github.com/vmayfuture/every-db-mcp'
PAGES = [
    ('README.md', 'index.html', 'zh-CN',
     'every-db-mcp — 多数据库 MCP 服务器文档',
     'every-db-mcp 中文接入与使用文档：通过 MCP 查询 MySQL、GaussDB、Oracle 和 DM8，查看表结构、测试连接及配置操作权限。'),
    ('README.en.md', 'en.html', 'en',
     'every-db-mcp — Multi-database MCP server documentation',
     'Install and configure every-db-mcp for MySQL, GaussDB, Oracle and DM8: connection tests, database queries, table inspection and explicit write permissions.'),
    ('docs/database-guides.md', 'database-guides.html', 'en',
     'every-db-mcp — MySQL, GaussDB, Oracle and DM8 connection guides',
     'Source-backed connection templates and troubleshooting for every-db-mcp: Python bridges, Oracle service names, configuration precedence and MCP clients.'),
]
TARGETS = {(ROOT / src).resolve(): out for src, out, *_ in PAGES}


def canonical(output):
    return BASE if output == 'index.html' else BASE + output


def rewrite_links(rendered, source):
    def replace(match):
        target = html.unescape(match.group(2))
        parts = urlsplit(target)
        if parts.scheme or parts.netloc or not parts.path:
            return match.group(0)
        destination = (source.parent / unquote(parts.path)).resolve()
        suffix = ('?' + parts.query if parts.query else '') + ('#' + parts.fragment if parts.fragment else '')
        if destination in TARGETS:
            url = TARGETS[destination] + suffix
        else:
            relative = destination.relative_to(ROOT).as_posix()
            url = REPO + '/blob/main/' + relative + suffix
        return match.group(1) + html.escape(url, quote=True) + match.group(3)
    return re.sub(r'(href=")([^"]*)(")', replace, rendered)


def build():
    schema = {
        '@context': 'https://schema.org',
        '@type': 'SoftwareSourceCode',
        'name': 'every-db-mcp',
        'codeRepository': REPO,
        'license': REPO + '/blob/main/LICENSE',
    }
    for src, output, lang, title, description in PAGES:
        source = ROOT / src
        markdown_source = source.read_text(encoding='utf-8')
        # Badge images are useful on GitHub; the static docs need no remote assets.
        markdown_source = re.sub(r'^\[!\[[^\n]+\n', '', markdown_source, flags=re.M)
        body = markdown.markdown(markdown_source,
                                 extensions=['fenced_code', 'tables', 'toc'],
                                 output_format='html')
        body = rewrite_links(body, source)
        # Wrapper allows wide tables to scroll without moving the whole page.
        body = body.replace('<table>', '<div class="table-scroll" tabindex="0"><table>')
        body = body.replace('</table>', '</table></div>')
        alternates = ''
        if output in ('index.html', 'en.html'):
            alternates = f'<link rel="alternate" hreflang="zh-CN" href="{BASE}">\n<link rel="alternate" hreflang="en" href="{BASE}en.html">'
        skip = '跳至正文' if lang == 'zh-CN' else 'Skip to content'
        nav_label = '文档导航' if lang == 'zh-CN' else 'Documentation navigation'
        document = f'''<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(description, quote=True)}">
<link rel="canonical" href="{canonical(output)}">
{alternates}
<meta property="og:type" content="website">
<meta property="og:title" content="{html.escape(title, quote=True)}">
<meta property="og:description" content="{html.escape(description, quote=True)}">
<meta property="og:url" content="{canonical(output)}">
<meta property="og:site_name" content="every-db-mcp">
<link rel="stylesheet" href="site.css">
<script type="application/ld+json">{json.dumps(schema, ensure_ascii=False, separators=(',', ':'))}</script>
</head>
<body>
<a class="skip-link" href="#main">{skip}</a>
<header><a class="brand" href="index.html">every-db-mcp</a>
<nav aria-label="{nav_label}"><a href="index.html" lang="zh-CN">中文</a><a href="en.html" lang="en">English</a><a href="database-guides.html">Database guides</a><a href="{REPO}">GitHub</a></nav></header>
<main id="main">{body}</main>
<footer><a href="{REPO}">Source repository</a> · <a href="{REPO}/blob/main/LICENSE">MIT License</a></footer>
</body>
</html>
'''
        (DOCS / output).write_text(document, encoding='utf-8', newline='\n')
    urls = ''.join(f'  <url><loc>{canonical(out)}</loc></url>\n' for _, out, *_ in PAGES)
    (DOCS / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '</urlset>\n', encoding='utf-8', newline='\n')
    (DOCS / '.nojekyll').write_text('', encoding='utf-8')


if __name__ == '__main__':
    build()
