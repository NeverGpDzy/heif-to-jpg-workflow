# HEIF to JPG Workflow

[简体中文](./README.zh-CN.md)

Batch convert HEIC/HEIF photos to JPEG, include existing JPG/JPEG photos in the same batch, preserve EXIF metadata, optionally remove GPS metadata, and optionally upload the generated files to Aliyun OSS.

This project is designed for local photo batches:

- read source `.heic` / `.heif` / `.jpg` / `.jpeg` files from `input/`
- write processed `.jpg` files to `output/`
- copy existing JPG/JPEG inputs without re-encoding when they already use `Orientation=1`
- losslessly normalize EXIF-oriented JPG/JPEG inputs with `jpegtran` without applying the selected JPEG quality
- keep EXIF metadata by default
- keep GPS metadata by default unless `--strip-gps` is used
- normalize HEIC/HEIF conversion rotation metadata and rewrite EXIF-oriented JPEGs so output files display correctly without browser auto-rotation
- optionally strip GPS metadata before publishing
- optionally upload converted files to Aliyun OSS
- print public URLs when an OSS public domain is configured
- write uploaded public URLs to a `.txt` file in `output/` when a public domain is configured

## Requirements

- Node.js 18 or newer
- npm
- Windows, macOS, or Linux supported by the bundled `exiftool-vendored` package
- `jpegtran` available on `PATH` if you need to normalize source JPG/JPEG files whose EXIF `Orientation` is not `1`

## Installation

```bash
npm install
```

Put source photos in `input/`. The `.gitkeep` file keeps the folder in Git; actual photo files are ignored.

## Quick Start

Run the interactive workflow:

```bash
npm run workflow:photos
```

Run a dry run without writing files:

```bash
npm run dry-run:photos
```

Run the processor directly:

```bash
node scripts/process-photos.js --quality=90 --suffix=converted --input-dir=input --output-dir=output --strip-gps
```

Process and upload a named travel batch:

```bash
node scripts/process-photos.js --quality=90 --suffix=Tianjin --input-dir=input --output-dir=output
```

Upload existing JPG files from `output/` only:

```bash
npm run upload:photos
```

When upload runs with `OSS_PUBLIC_DOMAIN` configured, the script also writes a public URL list file such as `output/Travel-Tianjin-public-urls.txt`.

Replace already-published OSS images without changing their public URLs:

```bash
node scripts/process-photos.js --replace-from=replace-urls.txt --quality=90 --suffix=FriendsMeet --input-dir=input --output-dir=output
```

Replacement mode reads one URL per line, matches each URL filename against the current input batch after suffix formatting, regenerates the local JPG, and uploads it to the exact object key from the URL path. The whole batch fails before upload if any URL cannot be matched.

When a source JPG/JPEG depends on EXIF orientation (`Orientation` other than `1`), the workflow uses `jpegtran` for a lossless transform, rotates or flips the pixels into the correct display direction, and writes the output back with `Orientation=1`. The selected JPEG quality applies to HEIC/HEIF conversion only.

## Upload Scope

The project has three different upload scopes. They are intentionally different:

- Normal conversion plus upload: uploads only the files generated for the current `input/` batch after suffix formatting. It does not scan and re-upload every historical JPG already sitting in `output/`.
- Interactive workflow with `Upload to OSS now?` answered `yes`: uses the same scope as normal conversion plus upload. It uploads only the files from the current batch.
- `--upload-only` or `npm run upload:photos`: uploads every `.jpg` file currently found in `output/`.
- `--replace-from=<file>`: uploads only the files matched from the current `input/` batch to the URL list. It overwrites those exact OSS object keys and keeps their public URLs unchanged.

Normal conversion mode also refuses to overwrite an existing local target file in `output/`. If an older processed file already has the same output name, the run fails before upload instead of silently reusing or re-uploading unrelated files.

## CLI Options Reference

All command-line options accepted by `node scripts/process-photos.js` are listed below.

| Option | Default | Normal conversion mode | `--upload-only` mode | `--replace-from=<file>` mode | Notes |
| --- | --- | --- | --- | --- | --- |
| `--dry-run` | Off | Prints the plan, then exits before writing files or uploading. | Prints the upload plan for existing JPG files, then exits before uploading. | Prints the replacement plan, then exits before writing files or uploading. | Useful for checking filenames and upload targets safely. |
| `--upload-only` | Off | Not used. | Scans the chosen output directory for existing `.jpg` files and uploads them. | Invalid with `--replace-from`. | `npm run upload:photos` is exactly `node scripts/process-photos.js --upload-only`. |
| `--replace-from=<file>` | Off | Not used. | Invalid with `--upload-only`. | Reads a newline-delimited URL list, regenerates matching files from the current `input/` batch, and overwrites those exact OSS object keys. | Keeps public URLs unchanged when the URL list is correct. |
| `--input-dir=<dir>` | `input` | Source batch directory. | Ignored. | Source batch directory used to match replacement targets. | Accepted values are sanitized paths relative to the working directory. |
| `--output-dir=<dir>` | `output` | Local directory where generated JPG files are written. | Local directory scanned for existing `.jpg` files to upload. | Local directory where regenerated JPG files are written before replacement upload. | In normal conversion mode, existing target files with the same names cause the run to fail before upload. |
| `--suffix=<value>` | `converted` | Used to build output file names such as `IMG_0001_converted.jpg`. | Ignored. | Used to match URL filenames against the current input batch after suffix formatting. | The suffix is sanitized to letters, numbers, `_`, and `-`. |
| `--quality=<1-100>` | `90` | Used only for HEIC/HEIF to JPEG conversion. | Ignored after validation. | Used only for HEIC/HEIF items being regenerated for replacement. | JPG/JPEG inputs do not use this value unless a future conversion path explicitly adds re-encoding. |
| `--strip-gps` | Off | Removes GPS metadata from generated output files. | Ignored. | Removes GPS metadata from regenerated replacement files before upload. | EXIF is preserved by default unless this flag is passed. |

Unknown command-line options fail immediately with `Unknown argument: ...`.

## Best Practices

Choose the mode based on what you are trying to achieve, not just on which command seems shortest.

| Scenario | Recommended mode | Recommended command | Expected output | Why this is the safest choice |
| --- | --- | --- | --- | --- |
| Process a brand-new local batch and optionally upload it | Interactive workflow for routine use, or normal conversion for scripted use | `npm run workflow:photos` or `node scripts/process-photos.js --quality=90 --suffix=TripName --input-dir=input --output-dir=output` | New `.jpg` files are generated in `output/`. If upload is enabled, only this batch is uploaded and a public URL list file may be written. | This is the default workflow and avoids accidentally uploading unrelated older files already in `output/`. |
| Review filenames, suffixes, and upload targets before making changes | Dry run | `node scripts/process-photos.js --dry-run --suffix=TripName --input-dir=input --output-dir=output` | The plan is printed, but no files are written and nothing is uploaded. | Best first step before large or public batches. |
| Upload a directory of already-generated JPG files without regenerating them | Upload-only | `node scripts/process-photos.js --upload-only --output-dir=output` | Every `.jpg` currently in the selected output directory is uploaded using the current OSS settings. Local files are not modified. | Good for retrying uploads after a network issue or when conversion already happened earlier. |
| Replace existing OSS objects but keep their public URLs unchanged | Replacement mode | `node scripts/process-photos.js --replace-from=replace-urls.txt --suffix=TripName --input-dir=input --output-dir=output` | Matching files are regenerated locally and uploaded back to the exact object keys from the URL list. | Safest way to fix already-published images without breaking links. |
| Publish public images but remove location data | Normal conversion or replacement mode with GPS stripping | Add `--strip-gps` to the command | Generated or regenerated JPG files have GPS metadata removed before upload. | `--upload-only` cannot help here because it does not rewrite existing JPG files. |
| Process a JPG-only batch | Normal conversion mode | `node scripts/process-photos.js --suffix=TripName --input-dir=input --output-dir=output` | JPG/JPEG files are copied or orientation-normalized into `output/`. Upload behavior follows the selected mode. | JPEG quality does not matter for JPG-only input, so focus on suffixes, output naming, and upload scope. |

### Practical Recommendations

- Keep `input/` limited to the current batch. Do not leave unrelated photos there when using normal conversion or replacement mode.
- Use a unique `--suffix` per trip, event, or publish batch. This makes output names easier to track and reduces confusion when matching replacement URLs.
- Treat `output/` as a working directory, not a permanent archive. If you keep many historical JPG files there, prefer a dedicated subdirectory or use `--output-dir=<dir>` per batch.
- Run a dry run before public uploads, especially when changing suffixes, prefixes, or replacement URL lists.
- Set `OSS_PREFIX` explicitly before `--upload-only`. That mode uploads every `.jpg` in the chosen output directory to the current prefix, so the prefix should never be left ambiguous.
- Use `--replace-from=<file>` only when you really need in-place replacement. It is stricter than normal upload and will fail if the URL list and current batch do not match exactly.
- Keep GPS by default for private archives or internal sharing. Add `--strip-gps` only when public publishing or privacy requirements actually demand it.
- Do not rely on `.env` being auto-loaded. Export values into the current shell or use `key.txt` when running the scripts.

### Output Expectations By Mode

- Interactive workflow or normal conversion:
  Creates new local JPG outputs. May upload only the current batch. May write a public URL list file when `OSS_PUBLIC_DOMAIN` is configured.
- `--upload-only`:
  Does not create or rewrite images. Uploads existing local JPG files from the selected output directory.
- `--replace-from=<file>`:
  Regenerates matched files locally, then overwrites exact existing OSS object keys from the URL list. May write a replacement URL list file.

### `--upload-only` Environment Variables

| Variable | Required | Effect in `--upload-only` mode | Notes |
| --- | --- | --- | --- |
| `OSS_ACCESS_KEY_ID` | Yes | Authenticates upload requests. | Required unless upload is intentionally skipped. |
| `OSS_ACCESS_KEY_SECRET` | Yes | Authenticates upload requests. | Required unless upload is intentionally skipped. |
| `OSS_BUCKET` | Usually yes | Selects the destination bucket. | May be inferred from `OSS_PUBLIC_DOMAIN` when DNS-based inference succeeds. |
| `OSS_REGION` | Yes unless `OSS_ENDPOINT` is set | Selects the OSS region. | Values like `cn-chengdu` are normalized to `oss-cn-chengdu`. |
| `OSS_ENDPOINT` | Optional | Overrides region-based endpoint selection. | Use when you need a custom endpoint. |
| `OSS_PREFIX` | Optional | Controls the destination "folder" inside the bucket. | `--upload-only` always uses the current `OSS_PREFIX`; it does not reuse a prefix from a previous run. |
| `OSS_PUBLIC_DOMAIN` | Optional | Controls printed public URLs and the generated URL list file. | Does not change the actual upload path. |
| `OSS_DNS_SERVER` | Optional | Overrides DNS resolution for OSS requests. | Useful when the default DNS is unreliable. |
| `OSS_STS_TOKEN` | Optional | Adds a temporary STS token to upload requests. | Needed only for temporary credentials. |

### `--upload-only` Upload Path Rule

| Current setting | Uploaded object key |
| --- | --- |
| `OSS_PREFIX=Travel/Weihai` | `Travel/Weihai/<fileName>` |
| `OSS_PREFIX=photos` | `photos/<fileName>` |
| `OSS_PREFIX=` (empty) | `<fileName>` |

Example:

```powershell
$env:OSS_BUCKET = "nevergpdzy-picture"
$env:OSS_REGION = "oss-cn-chengdu"
$env:OSS_PREFIX = "Travel/Weihai"
npm run upload:photos
```

With that configuration, `output/IMG_0001.jpg` is uploaded to `oss://nevergpdzy-picture/Travel/Weihai/IMG_0001.jpg`.

## Interactive Workflow

`npm run workflow:photos` asks for:

- config source or config file path, default `key.txt`
- output filename suffix, default `converted`
- OSS folder/prefix, default `photos`
- local input folder, default `input`
- local output folder, default `output`
- JPEG quality for HEIC/HEIF conversion, default `90`
- whether GPS metadata should be removed, default `no`
- whether files should be uploaded immediately
- public domain used to print final URLs

When upload is enabled and a public domain is available, the workflow also writes the uploaded public links to a `.txt` file in the output folder.

Exact replacement mode is CLI-only. Use `--replace-from=<file>` with a newline-delimited URL list when you need to overwrite existing OSS objects in place.

If `key.txt` is missing, the workflow continues with environment variables and local defaults.

## Configuration

Uploading is optional. If OSS credentials are not available, conversion still runs and upload is skipped.

You can configure OSS through environment variables:

```bash
OSS_ACCESS_KEY_ID=your-access-key-id
OSS_ACCESS_KEY_SECRET=your-access-key-secret
OSS_BUCKET=your-bucket
OSS_REGION=oss-cn-hangzhou
```

Optional variables:

```bash
OSS_PREFIX=photos
OSS_PUBLIC_DOMAIN=cdn.example.com
OSS_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com
OSS_DNS_SERVER=223.5.5.5
OSS_STS_TOKEN=your-sts-token
```

### Environment Variable Reference

- `OSS_ACCESS_KEY_ID`
  Required for upload. The Aliyun OSS access key ID.
- `OSS_ACCESS_KEY_SECRET`
  Required for upload. The Aliyun OSS access key secret.
- `OSS_BUCKET`
  Usually required for upload. The OSS bucket name such as `nevergpdzy-picture`.
  If this is omitted and `OSS_PUBLIC_DOMAIN` points to an Aliyun OSS CNAME, the uploader will try to infer the bucket automatically.
- `OSS_REGION`
  Required unless `OSS_ENDPOINT` is set.
  Accepts values like `oss-cn-chengdu` or `cn-chengdu`. The script normalizes `cn-chengdu` to `oss-cn-chengdu`.
- `OSS_PREFIX`
  Optional. Controls the object key prefix, which is the effective "folder" inside the bucket.
  Example: `OSS_PREFIX=Travel/Weihai` uploads `IMG_0001.jpg` to `oss://<bucket>/Travel/Weihai/IMG_0001.jpg`.
  If `OSS_PREFIX` is empty, files are uploaded to the bucket root.
  `--upload-only` also uses the current `OSS_PREFIX`; it does not remember the prefix from a previous conversion run.
- `OSS_PUBLIC_DOMAIN`
  Optional. Used only to print public URLs and to write the public URL list file.
  It does not change where files are uploaded; upload location is still determined by `OSS_BUCKET` plus `OSS_PREFIX`.
  If `OSS_BUCKET` or `OSS_REGION` is missing and this domain points to an Aliyun OSS CNAME, the uploader may infer the missing bucket and region from DNS.
- `OSS_ENDPOINT`
  Optional. Use this instead of `OSS_REGION` when you need a custom endpoint or explicitly want endpoint-based configuration.
- `OSS_DNS_SERVER`
  Optional. Comma- or space-separated DNS servers used for OSS requests, for example `223.5.5.5` or `223.5.5.5,119.29.29.29`.
  Useful when the machine's default DNS has trouble resolving OSS endpoints.
- `OSS_STS_TOKEN`
  Optional. Temporary STS token used together with temporary access keys.
- `JPEGTRAN_BIN`
  Optional. Path or command name for `jpegtran`.
  Only needed when normalizing JPG/JPEG files whose EXIF `Orientation` is not `1`, and useful when `jpegtran` is not already on `PATH`.

### How Upload Paths Are Chosen

- Normal conversion plus upload:
  Upload path is `oss://<bucket>/<prefix>/<fileName>` when `OSS_PREFIX` is set, otherwise `oss://<bucket>/<fileName>`.
- `--upload-only`:
  Uses the same upload path rule, but uploads every `.jpg` currently in `output/`.
  The destination directory still comes from the current `OSS_PREFIX`.
- `--replace-from=<file>`:
  Ignores `OSS_PREFIX` for the target object path and overwrites the exact OSS object keys taken from the URL list.
  `OSS_PUBLIC_DOMAIN` is still used for printed public URLs when available.

### Loading Behavior

- `node scripts/process-photos.js` reads the live shell environment from `process.env`.
- `npm run workflow:photos` can load from `key.txt`, `env`, `none`, or a custom config file path.
- When the interactive workflow loads a config file, values from that file override same-named variables already present in the shell environment.
- A local `.env` file is not loaded automatically by the current scripts.
  If you want to use values stored in `.env`, export them into the shell first or copy them into `key.txt`.

### PowerShell Examples

Set variables for the current PowerShell session:

```powershell
$env:OSS_ACCESS_KEY_ID = "your-access-key-id"
$env:OSS_ACCESS_KEY_SECRET = "your-access-key-secret"
$env:OSS_BUCKET = "nevergpdzy-picture"
$env:OSS_REGION = "oss-cn-chengdu"
$env:OSS_PREFIX = "Travel/Weihai"
$env:OSS_PUBLIC_DOMAIN = "picture.example.com"
```

Then run upload-only against that prefix:

```powershell
npm run upload:photos
```

You can also keep secrets in `key.txt` and let `npm run workflow:photos` load them directly.

You can also create a local `key.txt` file. It is ignored by Git.

```text
accessKeyId your-access-key-id
accessKeySecret your-access-key-secret
bucket your-bucket
region oss-cn-hangzhou
publicDomain cdn.example.com
prefix photos
```

`key.txt` supports either `name value`, `NAME=value`, or `name: value` lines. See [key.example.txt](./key.example.txt) for a template.

If `bucket` or `region` is omitted but `publicDomain` points to an Aliyun OSS CNAME, the uploader tries to resolve the bound bucket and region automatically.

## Defaults

- input folder: `input`
- output folder: `output`
- default config source in interactive mode: `key.txt`
- default JPEG quality: `90`
- default suffix: `converted`
- default OSS prefix: `photos`
- GPS removal default in interactive mode: `no`

## Output Names

Files named like `IMG_1234.HEIC` become:

```text
IMG_1234_converted.jpg
```

Existing JPEG inputs use the same naming rule, so `IMG_1878.JPEG` with suffix `Tianjin` becomes:

```text
IMG_1878_Tianjin.jpg
```

Other filenames are sanitized and get the configured suffix. If multiple inputs would create the same output name, the workflow stops before writing files.

## Privacy Notes

EXIF metadata can contain sensitive details such as device model, timestamps, and GPS coordinates. GPS is preserved by default. Use `--strip-gps` or answer `yes` to the interactive GPS removal prompt before publishing public website images.

## Development

Run syntax checks:

```bash
npm test
```

Run a dry run:

```bash
npm run dry-run:photos
```

## Release Versioning

This project uses Semantic Versioning. See [VERSIONING.md](./VERSIONING.md).

## License

ISC. See [LICENSE](./LICENSE).
