# HEIF to JPG Workflow

Batch convert HEIC/HEIF photos to JPEG, preserve EXIF metadata, optionally remove GPS metadata, and optionally upload the generated files to Aliyun OSS.

This project is designed for local photo batches:

- read source `.heic` / `.heif` files from `input/`
- write processed `.jpg` files to `output/`
- keep EXIF metadata by default
- normalize common rotation metadata after conversion
- optionally strip GPS metadata before publishing
- optionally upload converted files to Aliyun OSS
- print public URLs when an OSS public domain is configured

## Requirements

- Node.js 18 or newer
- npm
- Windows, macOS, or Linux supported by the bundled `exiftool-vendored` package

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

Upload existing JPG files from `output/` only:

```bash
npm run upload:photos
```

## Interactive Workflow

`npm run workflow:photos` asks for:

- config source or config file path, default `key.txt`
- JPEG quality, default `90`
- output filename suffix, default `converted`
- OSS folder/prefix, default `photos`
- local input folder, default `input`
- local output folder, default `output`
- whether GPS metadata should be removed, default `yes`
- whether files should be uploaded immediately
- public domain used to print final URLs

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
OSS_STS_TOKEN=your-sts-token
```

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
- GPS removal default in interactive mode: `yes`

## Output Names

Files named like `IMG_1234.HEIC` become:

```text
IMG_1234_converted.jpg
```

Other filenames are sanitized and get the configured suffix.

## Privacy Notes

EXIF metadata can contain sensitive details such as device model, timestamps, and GPS coordinates. Use `--strip-gps` or answer `yes` to the interactive GPS removal prompt before publishing public website images.

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
