# HEIF 转 JPG 工作流

[English](./README.md)

批量将 HEIC/HEIF 照片转换为 JPEG，并将同批次的 JPG/JPEG 一起处理；默认保留 EXIF 元数据，可选移除 GPS 位置信息，并可选将生成后的文件上传到阿里云 OSS。

这个项目主要用于本地照片批处理：

- 从 `input/` 读取源 `.heic` / `.heif` / `.jpg` / `.jpeg` 文件
- 将处理后的 `.jpg` 文件写入 `output/`
- 对 `Orientation=1` 的 JPG/JPEG 直接复制，不重新编码
- 对 EXIF 方向不为 `1` 的 JPG/JPEG 使用 `jpegtran` 做无损归一化，不套用所选 JPEG 质量
- 默认保留 EXIF 元数据
- 转换后自动规范常见的旋转元数据
- 发布前可选移除 GPS 元数据
- 可选将转换后的图片上传到阿里云 OSS
- 配置了 OSS 公网域名时输出可直接访问的 URL

## 环境要求

- Node.js 18 或更高版本
- npm
- Windows、macOS 或 Linux，并且系统需支持随项目安装的 `exiftool-vendored`
- 如果需要归一化 EXIF `Orientation` 不为 `1` 的 JPG/JPEG，系统 `PATH` 中还需要可用的 `jpegtran`

## 安装

```bash
npm install
```

把源照片放到 `input/` 目录中。`.gitkeep` 只是为了让该目录被 Git 跟踪，实际照片文件不会被提交。

## 快速开始

运行交互式工作流：

```bash
npm run workflow:photos
```

执行一次只预览、不写入文件的演练：

```bash
npm run dry-run:photos
```

直接运行处理脚本：

```bash
node scripts/process-photos.js --quality=90 --suffix=converted --input-dir=input --output-dir=output --strip-gps
```

如果源 JPG/JPEG 的 EXIF `Orientation` 不为 `1`，工作流会通过 `jpegtran` 做无损旋转或翻转，再把输出写回为 `Orientation=1`。`--quality` 仅作用于 HEIC/HEIF 转 JPEG，不作用于 JPG/JPEG 输入。

只上传 `output/` 中已经存在的 JPG 文件：

```bash
npm run upload:photos
```

## 交互式工作流

`npm run workflow:photos` 会依次询问：

- 配置来源或配置文件路径，默认 `key.txt`
- JPEG 质量，默认 `90`
- 输出文件名后缀，默认 `converted`
- OSS 目录/前缀，默认 `photos`
- 本地输入目录，默认 `input`
- 本地输出目录，默认 `output`
- 是否移除 GPS 元数据，默认 `yes`
- 是否立即上传文件
- 用于输出最终 URL 的公网域名

如果 `key.txt` 不存在，工作流会继续执行，并改为使用环境变量和本地默认值。

## 配置

上传是可选功能。即使没有提供 OSS 凭证，图片转换仍然会执行，只是会跳过上传。

可以通过环境变量配置 OSS：

```bash
OSS_ACCESS_KEY_ID=your-access-key-id
OSS_ACCESS_KEY_SECRET=your-access-key-secret
OSS_BUCKET=your-bucket
OSS_REGION=oss-cn-hangzhou
```

可选变量：

```bash
OSS_PREFIX=photos
OSS_PUBLIC_DOMAIN=cdn.example.com
OSS_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com
OSS_STS_TOKEN=your-sts-token
```

你也可以创建本地 `key.txt` 文件。该文件已被 Git 忽略，不会进入版本库。

```text
accessKeyId your-access-key-id
accessKeySecret your-access-key-secret
bucket your-bucket
region oss-cn-hangzhou
publicDomain cdn.example.com
prefix photos
```

`key.txt` 支持以下几种格式：`name value`、`NAME=value` 或 `name: value`。模板可参考 [key.example.txt](./key.example.txt)。

如果没有填写 `bucket` 或 `region`，但 `publicDomain` 指向的是阿里云 OSS 的 CNAME 域名，上传器会尝试自动解析绑定的 bucket 和 region。

## 默认值

- 输入目录：`input`
- 输出目录：`output`
- 交互模式默认配置文件：`key.txt`
- 默认 JPEG 质量：`90`
- 默认后缀：`converted`
- 默认 OSS 前缀：`photos`
- 交互模式下默认移除 GPS：`yes`

## 输出文件名

例如，`IMG_1234.HEIC` 会变成：

```text
IMG_1234_converted.jpg
```

其他文件名也会先做清理，再附加你配置的后缀。

## 隐私说明

EXIF 元数据可能包含设备型号、拍摄时间、GPS 坐标等敏感信息。若图片会用于公开网站，建议使用 `--strip-gps`，或在交互式流程中对移除 GPS 的问题回答 `yes`。

## 开发

运行语法检查：

```bash
npm test
```

执行 dry run：

```bash
npm run dry-run:photos
```

## 发布版本规则

本项目使用语义化版本（Semantic Versioning）。详见 [VERSIONING.md](./VERSIONING.md)。

## 许可证

ISC。详见 [LICENSE](./LICENSE)。
