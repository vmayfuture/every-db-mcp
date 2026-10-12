# Rebuild the GitHub Pages documentation

The static pages use the repository's `README.md`, `README.en.md` and `docs/database-guides.md` as sources. Edit those Markdown files, then regenerate the committed HTML:

```bash
python -m pip install -r docs/requirements-site.txt
python docs/build_site.py
```

Run from the repository root. Python Markdown is a documentation build dependency, not a database server runtime dependency. `docs/site.css` supplies the shared responsive style. The generated pages contain the full documentation without requiring JavaScript; the JSON-LD script is metadata only.

GitHub Pages serves the `/docs` folder. The generator rewrites overview/guide links to static pages and other repository-file links to GitHub's `main` branch. It also writes `sitemap.xml` and `.nojekyll`. No deployment is performed by the generator.
