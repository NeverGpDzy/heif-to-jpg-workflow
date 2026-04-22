# HEIF 转 JPG 工作流

[English](./README.md)

把 HEIC/HEIF 照片批量转换成 JPEG，并把同批次的 JPG/JPEG 一起处理。默认保留 EXIF 元数据，可选移除 GPS 信息，也可以按需上传到阿里云 OSS。

这个项目主要面向本地照片批处理：

- 从 `input/` 读取 `.heic` / `.heif` / `.jpg` / `.jpeg` 文件
- 把处理后的 `.jpg` 文件写入 `output/`
- 对 `Orientation=1` 的 JPG/JPEG 直接复制，不重新编码
- 对 EXIF 方向不为 `1` 的 JPG/JPEG 用 `jpegtran` 做无损归一化，不套用 JPEG 质量参数
- 默认保留 EXIF 元数据
- 默认保留 GPS 元数据，除非显式使用 `--strip-gps`
- 规范化 HEIC/HEIF 的旋转元数据，并把依赖 EXIF 方向的 JPEG 重写为可直接正确显示的输出
- 尽可能保留 Unicode 字母和数字，让中文文件名生成后的结果仍然可读
- 可选上传到阿里云 OSS
- 配置了 OSS 公网域名时输出可访问 URL
- 配置了公网域名时，把上传后的公开链接写入 `output/` 下的 `.txt` 文件

## 环境要求

- Node.js 18 或更高版本
- npm
- Windows、macOS 或 Linux，且系统需要支持随项目安装的 `exiftool-vendored`
- 如果需要归一化 EXIF `Orientation` 不为 `1` 的 JPG/JPEG，系统 `PATH` 中还需要可用的 `jpegtran`

## 安装

```bash
npm install
```

把源照片放进 `input/`。`.gitkeep` 只是为了让这个目录被 Git 跟踪，真实照片文件不会提交。

## 快速开始

运行交互式工作流：

```bash
npm run workflow:photos
```

运行一次只预览、不写文件的 dry run：

```bash
npm run dry-run:photos
```

直接执行本地处理，不上传：

```bash
node scripts/process-photos.js --quality=90 --suffix=converted --input-dir=input --output-dir=output --strip-gps
```

普通处理模式默认只做本地转换。只有显式传入 `--upload` 才会上传。

处理并上传一个批次：

```bash
node scripts/process-photos.js --quality=90 --suffix=Tianjin --input-dir=input --output-dir=output --upload
```

只上传 `output/` 里已经存在的 JPG：

```bash
npm run upload:photos
```

如果配置了 `OSS_PUBLIC_DOMAIN`，上传时还会在 `output/` 中写出一个公开链接列表文件，例如 `output/Travel-Tianjin-public-urls.txt`。

不改已有公网 URL，直接覆盖 OSS 上已发布对象：

```bash
node scripts/process-photos.js --replace-from=replace-urls.txt --quality=90 --suffix=FriendsMeet --input-dir=input --output-dir=output
```

替换模式会逐行读取 URL 列表，按文件名把它们和当前 `input/` 批次在加后缀后的输出名做匹配，重新生成本地 JPG，并上传回 URL 对应的原始 OSS object key。只要有任意一个 URL 无法匹配，这一整批都会在上传前直接失败。

如果源 JPG/JPEG 的 EXIF `Orientation` 不为 `1`，工作流会通过 `jpegtran` 做无损旋转或翻转，再把输出写回为 `Orientation=1`。`--quality` 只作用于 HEIC/HEIF 转 JPEG，不作用于 JPG/JPEG 输入。

## 上传范围

项目里有三种明确不同的上传范围：

- 普通“处理并上传”加 `--upload`：只上传当前 `input/` 批次生成出来的文件，不会扫描并重传 `output/` 里历史遗留的 JPG
- 交互式工作流中回答 `Upload to OSS now? = yes`：作用范围和 `--upload` 相同，只上传当前批次
- `--upload-only` 或 `npm run upload:photos`：上传 `output/` 下当前存在的所有 `.jpg`
- `--replace-from=<file>`：只上传 URL 列表匹配到的文件，并覆盖这些 URL 对应的 OSS object key，公网 URL 不变

普通处理模式同样会拒绝覆盖 `output/` 中已经存在的同名目标文件。如果目标文件已存在，脚本会在上传前直接失败，而不是静默复用或顺手重传其他历史文件。

## CLI 选项说明

下面列出 `node scripts/process-photos.js` 当前支持的命令行参数。

| 选项 | 默认值 | 普通处理模式 | `--upload-only` 模式 | `--replace-from=<file>` 模式 | 说明 |
| --- | --- | --- | --- | --- | --- |
| `--dry-run` | 关闭 | 打印计划，然后在写文件和上传前退出 | 打印已有 JPG 的上传计划，然后在真正上传前退出 | 打印 replacement 计划，然后在写文件和上传前退出 | 适合先核对文件名和上传目标 |
| `--upload` | 关闭 | 在本地处理完成后上传当前批次 | 冗余 | 冗余 | 普通处理模式默认不上传，只有加上这个参数才会上传 |
| `--upload-only` | 关闭 | 不使用 | 扫描指定输出目录中的 `.jpg` 并上传 | 不能与 `--replace-from` 同时使用 | `npm run upload:photos` 就是 `node scripts/process-photos.js --upload-only` |
| `--replace-from=<file>` | 关闭 | 不使用 | 不能与 `--upload-only` 同时使用 | 读取一个按行分隔的 URL 列表，从当前 `input/` 批次重生成匹配文件，并覆盖这些 URL 对应的 OSS object key | 当 URL 列表正确时，可以保持公网 URL 不变 |
| `--input-dir=<dir>` | `input` | 源照片目录 | 忽略 | replacement 匹配时使用的源照片目录 | 相对路径按当前工作目录解析，空格和点号会被保留 |
| `--output-dir=<dir>` | `output` | 本地输出目录 | 用来扫描已有 `.jpg` 并上传的目录 | replacement 模式重新生成 JPG 时使用的本地输出目录 | 普通处理模式下，如果目标同名文件已存在，会在上传前直接失败 |
| `--suffix=<value>` | `converted` | 用于生成输出文件名，例如 `IMG_0001_converted.jpg` | 忽略 | 用于把 URL 文件名和当前输入批次在加后缀后的结果做匹配 | 后缀会被清洗为 Unicode 字母、Unicode 数字、`_`、`-` |
| `--quality=<1-100>` | `90` | 仅用于 HEIC/HEIF 转 JPEG | 校验后忽略 | 仅用于 replacement 中重新生成的 HEIC/HEIF 文件 | JPG/JPEG 输入不会使用这个值 |
| `--strip-gps` | 关闭 | 从输出文件中移除 GPS 元数据 | 忽略 | 在上传 replacement 文件前，从重生成的文件中移除 GPS 元数据 | 默认保留 EXIF，只有显式传入才去掉 GPS |

未知命令行参数会立刻失败，并报 `Unknown argument: ...`。

## 使用建议

按你的目标选模式，不要只看哪条命令最短。

| 场景 | 推荐模式 | 推荐命令 | 预期输出 | 为什么这样更稳妥 |
| --- | --- | --- | --- | --- |
| 处理一批新的本地照片，并按需上传 | 日常使用推荐交互式工作流；需要脚本化时用普通处理模式 | `npm run workflow:photos` 或 `node scripts/process-photos.js --quality=90 --suffix=TripName --input-dir=input --output-dir=output --upload` | 在 `output/` 中生成新的 `.jpg`；如果启用上传，只上传当前批次，并可能写出公开 URL 列表 | 这是默认工作流，能避免把 `output/` 里历史遗留的旧文件一起上传 |
| 在真正执行前先确认文件名、后缀和上传目标 | dry run | `node scripts/process-photos.js --dry-run --suffix=TripName --input-dir=input --output-dir=output` | 只打印计划，不写文件，也不上传 | 大批量处理或公开发布前最适合先做这一步 |
| 只做本地转换，不碰 OSS | 普通处理模式 | `node scripts/process-photos.js --quality=90 --suffix=TripName --input-dir=input --output-dir=output` | 只在本地生成 `.jpg` | 现在即使 shell 里已经有 OSS 凭证，也不会自动上传 |
| 不重新生成图片，只上传已经处理好的 JPG | upload-only | `node scripts/process-photos.js --upload-only --output-dir=output` | 把所选输出目录中现有的所有 `.jpg` 上传到当前 OSS 配置对应的位置，本地文件不会改动 | 适合网络中断后重试上传，或者图片早就处理完、现在只想补传 |
| 覆盖 OSS 上已存在的对象，但保持公网 URL 不变 | replacement 模式 | `node scripts/process-photos.js --replace-from=replace-urls.txt --suffix=TripName --input-dir=input --output-dir=output` | 重新生成匹配文件，并上传回 URL 列表中对应的原始 object key | 修复已发布图片但不想改链接时，这是最安全的方式 |
| 公开发布图片，但不想保留位置信息 | 普通处理或 replacement 模式，并显式去掉 GPS | 在命令中加上 `--strip-gps` | 输出 JPG 会在上传前去掉 GPS 元数据 | `--upload-only` 不能做这件事，因为它不会改写已有 JPG |

### 实用建议

- 让 `input/` 只保留当前这一批文件，不要把无关照片混在里面
- 每个旅行、活动或发布批次都用一个独立的 `--suffix`
- 把 `output/` 当成工作目录，而不是永久归档目录
- 脚本化运行时，先做 dry run，再决定是否加 `--upload`
- 在公开上传前，尤其是改过 suffix、OSS prefix 或 replacement URL 列表之后，先跑一次 dry run
- 使用 `--upload-only` 前，先明确设置 `OSS_PREFIX`
- 只有确实需要原地覆盖已发布文件时，才使用 `--replace-from=<file>`
- 私有归档或内部分享时，默认保留 GPS 往往更合理；只有在公开发布或隐私要求明确时，再加 `--strip-gps`
- 不要假设 `.env` 会被自动加载。运行脚本前请先把变量导入当前 shell，或改用 `key.txt`

### 各模式输出效果

- 交互式工作流或普通处理模式，不加 `--upload`：
  只生成新的本地 JPG，不尝试连接 OSS
- 普通处理模式，加 `--upload`：
  先生成新的本地 JPG，再上传当前批次；如果配置了 `OSS_PUBLIC_DOMAIN`，还可能生成公开 URL 列表
- `--upload-only`：
  不会创建或改写图片，只会把输出目录中的现有 JPG 上传出去
- `--replace-from=<file>`：
  会先在本地重生成匹配文件，再覆盖 URL 列表中对应的 OSS object key；也可能生成 replacement URL 列表文件

## 上传相关环境变量

`--upload`、`--upload-only` 和 `--replace-from=<file>` 都使用同一套 OSS 环境变量。

| 变量 | 是否必填 | 作用 | 说明 |
| --- | --- | --- | --- |
| `OSS_ACCESS_KEY_ID` | 上传时必填 | 上传鉴权 | 所有显式上传模式都需要 |
| `OSS_ACCESS_KEY_SECRET` | 上传时必填 | 上传鉴权 | 所有显式上传模式都需要 |
| `OSS_BUCKET` | 通常必填 | 目标 bucket | 如果 `OSS_PUBLIC_DOMAIN` 可以推断，也可能自动补出 |
| `OSS_REGION` | 在未设置 `OSS_ENDPOINT` 时必填 | OSS 所在地域 | `cn-chengdu` 会自动规范成 `oss-cn-chengdu` |
| `OSS_ENDPOINT` | 可选 | 覆盖默认 endpoint | 需要自定义 endpoint 时使用 |
| `OSS_PREFIX` | 可选 | bucket 内的对象前缀 | `--upload-only` 和 `--upload` 都使用当前环境中的前缀 |
| `OSS_PUBLIC_DOMAIN` | 可选 | 打印公开 URL，并生成 URL 列表文件 | 不改变真实上传路径 |
| `OSS_DNS_SERVER` | 可选 | 自定义 DNS 解析 | 默认 DNS 不稳定时有用 |
| `OSS_STS_TOKEN` | 可选 | 临时 STS 凭证 | 仅临时凭证场景需要 |
| `JPEGTRAN_BIN` | 可选 | `jpegtran` 命令名或路径 | 仅在归一化 EXIF 方向不为 `1` 的 JPG/JPEG 时需要 |

### 上传路径规则

| 当前设置 | 最终上传的 object key |
| --- | --- |
| `OSS_PREFIX=Travel/Weihai` | `Travel/Weihai/<fileName>` |
| `OSS_PREFIX=photos` | `photos/<fileName>` |
| `OSS_PREFIX=`（空） | `<fileName>` |

示例：

```powershell
$env:OSS_BUCKET = "nevergpdzy-picture"
$env:OSS_REGION = "oss-cn-chengdu"
$env:OSS_PREFIX = "Travel/Weihai"
npm run upload:photos
```

在这个配置下，`output/IMG_0001.jpg` 会被上传到 `oss://nevergpdzy-picture/Travel/Weihai/IMG_0001.jpg`。

## 交互式工作流

`npm run workflow:photos` 会依次询问：

- 配置来源或配置文件路径，默认 `key.txt`
- 输出文件名后缀，默认 `converted`
- OSS 目录/prefix，默认 `photos`
- 本地输入目录，默认 `input`
- 本地输出目录，默认 `output`
- HEIC/HEIF 转 JPEG 的质量，默认 `90`
- 是否移除 GPS 元数据，默认 `no`
- 是否立即上传文件
- 用于输出最终 URL 的公网域名

交互式工作流会保留本地路径里的空格和点号，不再偷偷改写目录名。后缀和最终输出文件名则会尽量保留 Unicode 字母和数字，而不是强行退化成 ASCII。

如果开启上传并且配置了公网域名，工作流还会在输出目录里写出公开链接列表文件。

精确 replacement 模式只提供 CLI 入口。需要原地覆盖已发布对象时，请使用 `--replace-from=<file>` 加按行分隔的 URL 列表。

如果 `key.txt` 不存在，工作流会继续执行，并改用环境变量和本地默认值。

## 配置

上传是可选功能。普通处理默认只做本地转换。只有显式请求上传时，脚本才会检查 OSS 配置；如果缺少必要变量，执行会失败并清楚列出缺失项。

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
OSS_DNS_SERVER=223.5.5.5
OSS_STS_TOKEN=your-sts-token
```

### 环境变量说明

- `OSS_ACCESS_KEY_ID`
  上传时必填。阿里云 OSS 的 AccessKey ID。
- `OSS_ACCESS_KEY_SECRET`
  上传时必填。阿里云 OSS 的 AccessKey Secret。
- `OSS_BUCKET`
  上传时通常必填。OSS bucket 名称，例如 `nevergpdzy-picture`。
  如果未填写，而 `OSS_PUBLIC_DOMAIN` 指向的是阿里云 OSS 的 CNAME 域名，上传器会尝试自动推断 bucket。
- `OSS_REGION`
  在未设置 `OSS_ENDPOINT` 时必填。
  可以写成 `oss-cn-chengdu`，也可以写成 `cn-chengdu`；脚本会自动规范成 `oss-cn-chengdu`。
- `OSS_PREFIX`
  可选。控制上传到 bucket 内的 object key 前缀，也就是实际意义上的“目录”。
  例如：`OSS_PREFIX=Travel/Weihai` 时，`IMG_0001.jpg` 会上传到 `oss://<bucket>/Travel/Weihai/IMG_0001.jpg`。
  如果 `OSS_PREFIX` 为空，则上传到 bucket 根目录。
- `OSS_PUBLIC_DOMAIN`
  可选。只用于打印公开访问链接，以及生成公开 URL 列表文件。
  它不会改变文件实际上传到哪里；上传路径仍由 `OSS_BUCKET` 和 `OSS_PREFIX` 决定。
  如果缺少 `OSS_BUCKET` 或 `OSS_REGION`，且这个域名指向阿里云 OSS CNAME，上传器可能会通过 DNS 推断缺失的 bucket 和 region。
- `OSS_ENDPOINT`
  可选。需要自定义 endpoint 时使用；设置后可以替代 `OSS_REGION`。
- `OSS_DNS_SERVER`
  可选。用于 OSS 请求的 DNS 服务器，可写一个或多个，用逗号或空格分隔，例如 `223.5.5.5` 或 `223.5.5.5,119.29.29.29`。
- `OSS_STS_TOKEN`
  可选。临时 STS 凭证场景下使用。
- `JPEGTRAN_BIN`
  可选。`jpegtran` 的命令名或绝对路径。
  仅在需要对 EXIF `Orientation` 不为 `1` 的 JPG/JPEG 做归一化时有用。

### 配置加载方式

- `node scripts/process-photos.js` 直接读取当前 shell 的 `process.env`
- 即使 `process.env` 中已经有 OSS 变量，普通处理模式也不会自动上传；仍然必须显式加 `--upload`
- `npm run workflow:photos` 可以从 `key.txt`、`env`、`none` 或自定义配置文件路径中读取配置
- 交互式工作流读取配置文件时，配置文件中的值会覆盖 shell 里同名的已有变量
- 当前脚本不会自动加载本地 `.env`

### PowerShell 示例

在当前 PowerShell 会话里设置环境变量：

```powershell
$env:OSS_ACCESS_KEY_ID = "your-access-key-id"
$env:OSS_ACCESS_KEY_SECRET = "your-access-key-secret"
$env:OSS_BUCKET = "nevergpdzy-picture"
$env:OSS_REGION = "oss-cn-chengdu"
$env:OSS_PREFIX = "Travel/Weihai"
$env:OSS_PUBLIC_DOMAIN = "picture.example.com"
```

然后显式上传当前批次：

```powershell
node scripts/process-photos.js --quality=90 --suffix=TripName --input-dir=input --output-dir=output --upload
```

或者只上传已经生成好的输出：

```powershell
npm run upload:photos
```

你也可以把密钥放到 `key.txt` 里，再让 `npm run workflow:photos` 直接加载。

本地 `key.txt` 文件示例：

```text
accessKeyId your-access-key-id
accessKeySecret your-access-key-secret
bucket your-bucket
region oss-cn-hangzhou
publicDomain cdn.example.com
prefix photos
```

`key.txt` 支持以下格式：`name value`、`NAME=value` 或 `name: value`。模板可参考 [key.example.txt](./key.example.txt)。

如果没有填写 `bucket` 或 `region`，但 `publicDomain` 指向的是阿里云 OSS 的 CNAME 域名，上传器会尝试自动解析绑定的 bucket 和 region。

## 默认值

- 输入目录：`input`
- 输出目录：`output`
- 交互模式默认配置文件：`key.txt`
- 默认 JPEG 质量：`90`
- 默认后缀：`converted`
- 默认 OSS 前缀：`photos`
- 交互模式下默认移除 GPS：`no`

## 输出文件名

例如，`IMG_1234.HEIC` 会变成：

```text
IMG_1234_converted.jpg
```

现有 JPEG 输入同样遵循这个命名规则，所以 `IMG_1878.JPEG` 配合后缀 `Tianjin` 会变成：

```text
IMG_1878_Tianjin.jpg
```

对于中文等 Unicode 文件名，只要字符适合放进文件名，也会尽量保留。例如 `海边日落.HEIC` 加后缀 `旅行` 会变成：

```text
海边日落_旅行.jpg
```

其他文件名会做必要清洗后再附加后缀。如果多个输入最终会产生相同的输出文件名，工作流会在写文件前直接失败。

## 隐私说明

EXIF 元数据可能包含设备型号、拍摄时间、GPS 坐标等敏感信息。默认会保留 GPS。若图片会用于公开网站，建议使用 `--strip-gps`，或在交互式流程中对移除 GPS 的问题回答 `yes`。

## 开发

运行完整测试：

```bash
npm test
```

执行 dry run：

```bash
npm run dry-run:photos
```

## 版本规则

项目使用 Semantic Versioning。详见 [VERSIONING.md](./VERSIONING.md)。

## 许可证

ISC。详见 [LICENSE](./LICENSE)。
