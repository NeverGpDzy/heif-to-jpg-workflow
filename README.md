# HEIF to JPG Workflow

This folder contains a repeatable HEIC/HEIF photo workflow:

- convert photos to JPG
- keep EXIF metadata
- optionally remove GPS metadata
- rename files with a custom suffix
- optionally upload to Aliyun OSS
- optionally print public URLs using a custom domain
- read source photos from `input/`
- write processed photos to `output/`

## Main Commands

Run the interactive workflow:

```powershell
npm run workflow:photos
```

Run a dry run without writing files:

```powershell
npm run dry-run:photos
```

Run the non-interactive processor directly:

```powershell
node scripts/process-photos.js --quality=85 --suffix=FriendsMeet --input-dir=input --output-dir=output --strip-gps
```

Upload existing JPG files from `output/` only:

```powershell
npm run upload:photos
```

## Questions Asked by the Interactive Workflow

`npm run workflow:photos` asks for:

- JPEG quality
- output filename suffix
- OSS folder/prefix
- local input folder
- local output folder
- whether GPS metadata should be removed
- whether files should be uploaded immediately
- public domain used to print final URLs

## OSS Environment Variables

Set these before uploading:

```powershell
$env:OSS_ACCESS_KEY_ID="your-access-key-id"
$env:OSS_ACCESS_KEY_SECRET="your-access-key-secret"
$env:OSS_BUCKET="your-bucket"
$env:OSS_REGION="oss-cn-hangzhou"
```

Optional:

```powershell
$env:OSS_PREFIX="FriendsMeet"
$env:OSS_PUBLIC_DOMAIN="picture.example.com"
$env:OSS_ENDPOINT="https://your-custom-endpoint"
$env:OSS_STS_TOKEN="your-sts-token"
```

If `OSS_PUBLIC_DOMAIN` is set, the script prints public URLs after upload.

## Defaults

- output folder: `output`
- input folder: `input`
- default suffix: `FriendsMeet`
- default quality in interactive mode: `85`
- GPS removal default in interactive mode: `yes`

## Notes

- HEIC is usually more space-efficient than JPEG, so JPG files may be larger than the originals.
- The current converter preserves EXIF and normalizes rotated images when needed.
- Put source `.HEIC/.HEIF` files in `input/`.
- Processed `.jpg` files are written to `output/`.
- Source files are not modified.
