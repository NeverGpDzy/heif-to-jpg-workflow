# HEIF-to-JPG Contributor Guidance

For work in this repository:

- Read [README.md](./README.md) before running photo operations.
- If the user asks to "execute the script", "run the script", or process a new photo batch, start with:
  `npm run workflow:photos`
- The workflow should gather:
  - which config to use, default `key.txt`
  - JPEG quality
  - filename suffix
  - input folder, default `input`
  - output folder, default `output`
  - OSS folder/prefix
  - whether GPS metadata should be removed
  - whether files should be uploaded now
  - public domain for returned URLs
- Prefer quality `90` by default unless the user explicitly asks for another value.
- Source HEIC/HEIF photos belong in `input/`; processed JPG files belong in `output/`.
- Prefer reading `key.txt` for local OSS credentials, then pass them through environment variables at runtime. Do not write secrets into tracked files.
- If the user wants public website images, remind them that GPS metadata may expose location.
