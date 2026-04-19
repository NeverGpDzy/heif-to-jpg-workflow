# HEIF-to-JPG Local Guidance

For work inside `D:\Code\HEIF-to-JPG`:

- Read [README.md](D:\Code\HEIF-to-JPG\README.md) before running photo operations.
- If the user asks to "execute the script", "run the script", or process a new photo batch, start with:
  `npm run workflow:photos`
- The workflow should gather:
  - JPEG quality
  - filename suffix
  - input folder, default `input`
  - output folder, default `output`
  - OSS folder/prefix
  - whether GPS metadata should be removed
  - whether files should be uploaded now
  - public domain for returned URLs
- Prefer quality `85` for website images unless the user explicitly asks for higher quality.
- Source HEIC/HEIF photos belong in `input/`; processed JPG files belong in `output/`.
- Use environment variables for OSS credentials. Do not write secrets into tracked files.
- If the user wants public website images, remind them that GPS metadata may expose location.
