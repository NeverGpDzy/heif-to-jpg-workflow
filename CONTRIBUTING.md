# Contributing

Thanks for considering a contribution.

## Development Setup

```bash
npm install
npm test
```

Use `input/` for local source photos and `output/` for generated files. Both folders ignore real photo files by default.

## Pull Requests

- Keep changes focused and easy to review.
- Update README examples when workflow behavior changes.
- Do not commit private photos, output images, `key.txt`, `.env`, or OSS credentials.
- Run `npm test` before opening a pull request.

## Security and Privacy

Photo metadata can include GPS coordinates and device details. Prefer `--strip-gps` for examples intended for public publishing.

Report security issues privately according to [SECURITY.md](./SECURITY.md).
