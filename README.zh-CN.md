# HEIF 转 JPG 工作流

[English](./README.md)

批量将 HEIC/HEIF 照片转换为 JPEG，并将同批次的 JPG/JPEG 一起处理；默认保留 EXIF 元数据，可选移除 GPS 位置信息，并可选将生成后的文件上传到阿里云 OSS。

这个项目主要用于本地照片批处理：

- 从 `input/` 读取源 `.heic` / `.heif` / `.jpg` / `.jpeg` 文件
- 将处理后的 `.jpg` 文件写入 `output/`
- 对 `Orientation=1` 的 JPG/JPEG 直接复制，不重新编码
- 对 EXIF 方向不为 `1` 的 JPG/JPEG 使用 `jpegtran` 做无损归一化，不套用所选 JPEG 质量
- 默认保留 EXIF 元数据
- 默认保留 GPS 元数据，除非显式使用 `--strip-gps`
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

如果配置了 `OSS_PUBLIC_DOMAIN`，上传时还会在 `output/` 中写出一个公开链接列表文件，例如 `output/Travel-Tianjin-public-urls.txt`。

不改变现有公网 URL、直接覆盖 OSS 上已发布对象：

```bash
node scripts/process-photos.js --replace-from=replace-urls.txt --quality=90 --suffix=FriendsMeet --input-dir=input --output-dir=output
```

替换模式会逐行读取 URL 列表，按文件名把它们和当前 `input/` 批次在加后缀后的输出名做匹配，重新生成本地 JPG，并上传回 URL 对应的原始 OSS object key。只要有任意一个 URL 无法匹配，这一整批都会在上传前直接失败。

## 上传范围

这个项目有三种不同的上传范围，行为刻意区分：

- 普通“处理并上传”：只上传这次 `input/` 批次生成出来的文件。它不会扫描并把 `output/` 目录里历史遗留的 JPG 全部重新上传。
- 交互式工作流里回答 `Upload to OSS now? = yes`：走的也是普通“处理并上传”范围，只上传当前批次。
- `--upload-only` 或 `npm run upload:photos`：会把 `output/` 目录下当前存在的所有 `.jpg` 全部上传。
- `--replace-from=<file>`：只会上传 URL 列表匹配到的那一批文件，并覆盖这些 URL 对应的 OSS object key，公网 URL 保持不变。

普通处理模式下，如果 `output/` 里已经存在同名目标文件，脚本会在上传前直接报错并拒绝覆盖，而不是静默复用或顺手把其他历史文件一起上传。

## CLI 选项说明表

下面列出了 `node scripts/process-photos.js` 当前接受的所有命令行选项。

| 选项 | 默认值 | 普通处理模式 | `--upload-only` 模式 | `--replace-from=<file>` 模式 | 说明 |
| --- | --- | --- | --- | --- | --- |
| `--dry-run` | 关闭 | 打印执行计划，然后在写文件和上传前退出。 | 打印已有 JPG 的上传计划，然后在真正上传前退出。 | 打印 replacement 计划，然后在写文件和上传前退出。 | 适合先核对文件名和上传目标。 |
| `--upload-only` | 关闭 | 不使用。 | 扫描指定输出目录中已经存在的 `.jpg` 文件并上传。 | 不能与 `--replace-from` 同时使用。 | `npm run upload:photos` 就是 `node scripts/process-photos.js --upload-only`。 |
| `--replace-from=<file>` | 关闭 | 不使用。 | 不能与 `--upload-only` 同时使用。 | 读取一个按行分隔的 URL 列表，从当前 `input/` 批次重新生成匹配文件，并覆盖这些 URL 对应的 OSS object key。 | 当 URL 列表正确时，可以保持公网 URL 不变。 |
| `--input-dir=<dir>` | `input` | 源照片批次目录。 | 被忽略。 | 用来匹配 replacement 目标的源照片批次目录。 | 传入的路径会按工作目录下的相对路径处理。 |
| `--output-dir=<dir>` | `output` | 本地生成 JPG 的输出目录。 | 用来扫描已有 `.jpg` 文件并上传的本地目录。 | replacement 重新生成 JPG 时的本地输出目录。 | 普通处理模式下，如果目标同名文件已存在，会在上传前直接报错。 |
| `--suffix=<value>` | `converted` | 用于生成输出文件名，例如 `IMG_0001_converted.jpg`。 | 被忽略。 | 用于把 URL 文件名和当前输入批次在加后缀后的结果做匹配。 | 后缀会被清洗为字母、数字、`_`、`-`。 |
| `--quality=<1-100>` | `90` | 只用于 HEIC/HEIF 转 JPEG。 | 在校验后被忽略。 | 只用于 replacement 模式下需要重新生成的 HEIC/HEIF 项。 | 当前 JPG/JPEG 输入不会使用这个值。 |
| `--strip-gps` | 关闭 | 从生成后的输出文件中移除 GPS 元数据。 | 被忽略。 | 在上传 replacement 文件前，从重新生成的文件中移除 GPS 元数据。 | 默认保留 EXIF，只有显式传入这个参数才去掉 GPS。 |

未知命令行参数会立即报错：`Unknown argument: ...`。

## 最佳实践

选择哪种模式，应该看你要达到的目标，而不是只看哪条命令最短。

| 场景 | 推荐模式 | 推荐命令 | 预期输出 | 为什么这是更稳妥的选择 |
| --- | --- | --- | --- | --- |
| 处理一批全新的本地照片，并按需上传 | 日常使用推荐交互式工作流；需要脚本化时用普通处理模式 | `npm run workflow:photos` 或 `node scripts/process-photos.js --quality=90 --suffix=TripName --input-dir=input --output-dir=output` | 在 `output/` 中生成新的 `.jpg` 文件；如果开启上传，只上传当前这批，并且可能写出公开 URL 列表文件。 | 这是默认工作流，能避免把 `output/` 里历史遗留的旧文件一起上传。 |
| 在真正执行前先确认文件名、后缀和上传目标 | dry run | `node scripts/process-photos.js --dry-run --suffix=TripName --input-dir=input --output-dir=output` | 只打印计划，不写文件，也不上传。 | 大批量处理或公开发布前最应该先做这一步。 |
| 不重新生成图片，只上传已经处理好的 JPG | upload-only | `node scripts/process-photos.js --upload-only --output-dir=output` | 把所选输出目录中当前存在的所有 `.jpg` 上传到当前 OSS 配置对应的位置，本地文件不会被修改。 | 适合网络中断后重试上传，或者图片早就处理完、现在只想补传。 |
| 覆盖 OSS 上已存在的对象，但保持公网 URL 不变 | replacement 模式 | `node scripts/process-photos.js --replace-from=replace-urls.txt --suffix=TripName --input-dir=input --output-dir=output` | 重新生成匹配文件，并上传回 URL 列表中对应的原始 object key。 | 修复已发布图片且不想改链接时，这是最安全的方式。 |
| 公开发布图片，但不希望保留位置信息 | 普通处理或 replacement 模式，并显式去掉 GPS | 在命令中加上 `--strip-gps` | 生成或重生成后的 JPG 会在上传前去掉 GPS 元数据。 | `--upload-only` 不能帮你做这件事，因为它不会改写已有 JPG。 |
| 处理一批纯 JPG 输入 | 普通处理模式 | `node scripts/process-photos.js --suffix=TripName --input-dir=input --output-dir=output` | JPG/JPEG 文件会被复制或做方向归一化后写入 `output/`；上传行为由所选模式决定。 | 对纯 JPG 批次来说，`quality` 没意义，重点应该放在后缀、输出命名和上传范围上。 |

### 实用建议

- 让 `input/` 只保留当前这批文件。使用普通处理或 replacement 模式时，不要把无关照片混在里面。
- 每个旅行、活动或发布批次都用一个独立的 `--suffix`。这样输出文件更容易追踪，也更不容易在 replacement 时对错文件。
- 把 `output/` 当作工作目录，而不是永久归档目录。如果里面长期堆很多历史 JPG，建议按批次切分子目录，或者每次显式传 `--output-dir=<dir>`。
- 在公开上传前先跑一次 dry run，尤其是刚改过 suffix、OSS prefix 或 replacement URL 列表时。
- 使用 `--upload-only` 前，先明确设置 `OSS_PREFIX`。这个模式会把所选输出目录里的所有 `.jpg` 上传到当前 prefix，所以目录绝不能含糊。
- 只有在确实需要原地覆盖已发布文件时，才使用 `--replace-from=<file>`。它比普通上传更严格，只要 URL 列表和当前批次对不上，就会直接失败。
- 私有归档或内部分享时，默认保留 GPS 更合理；只有在公开发布或隐私要求明确时，再加 `--strip-gps`。
- 不要假设 `.env` 会被自动加载。运行脚本前请先把变量导入当前 shell，或者改用 `key.txt`。

### 不同模式下的输出效果

- 交互式工作流或普通处理模式：
  会生成新的本地 JPG 输出；如果启用上传，只上传当前批次；如果配置了 `OSS_PUBLIC_DOMAIN`，可能还会生成公开 URL 列表文件。
- `--upload-only`：
  不会创建或改写图片，只会把所选输出目录中的现有 JPG 上传出去。
- `--replace-from=<file>`：
  会先在本地重生成匹配文件，再覆盖 URL 列表中对应的原始 OSS object key；也可能生成 replacement URL 列表文件。

### `--upload-only` 依赖的环境变量

| 变量 | 是否必填 | 在 `--upload-only` 模式下的作用 | 说明 |
| --- | --- | --- | --- |
| `OSS_ACCESS_KEY_ID` | 是 | 用于上传鉴权。 | 除非你本来就打算让上传被跳过。 |
| `OSS_ACCESS_KEY_SECRET` | 是 | 用于上传鉴权。 | 除非你本来就打算让上传被跳过。 |
| `OSS_BUCKET` | 通常是 | 决定目标 bucket。 | 如果 `OSS_PUBLIC_DOMAIN` 能成功推断，也可能自动补出。 |
| `OSS_REGION` | 在未设置 `OSS_ENDPOINT` 时是 | 决定 OSS 所在地域。 | `cn-chengdu` 会被自动规范成 `oss-cn-chengdu`。 |
| `OSS_ENDPOINT` | 可选 | 覆盖基于 region 的 endpoint 选择。 | 需要自定义 endpoint 时使用。 |
| `OSS_PREFIX` | 可选 | 决定上传到 bucket 内的哪个“目录”。 | `--upload-only` 总是使用当前环境里的 `OSS_PREFIX`，不会沿用上一次处理时的目录。 |
| `OSS_PUBLIC_DOMAIN` | 可选 | 决定打印出来的公开链接，以及 URL 列表文件内容。 | 不改变真实上传路径。 |
| `OSS_DNS_SERVER` | 可选 | 覆盖 OSS 请求使用的 DNS。 | 默认 DNS 不稳定时有用。 |
| `OSS_STS_TOKEN` | 可选 | 给上传请求附加临时 STS token。 | 仅临时凭证场景需要。 |

### `--upload-only` 模式下的上传路径规则

| 当前设置 | 最终上传的 object key |
| --- | --- |
| `OSS_PREFIX=Travel/Weihai` | `Travel/Weihai/<fileName>` |
| `OSS_PREFIX=photos` | `photos/<fileName>` |
| `OSS_PREFIX=`（空） | `<fileName>` |

例如：

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
- OSS 目录/前缀，默认 `photos`
- 本地输入目录，默认 `input`
- 本地输出目录，默认 `output`
- HEIC/HEIF 转 JPEG 的质量，默认 `90`
- 是否移除 GPS 元数据，默认 `no`
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
  可以写成 `oss-cn-chengdu`，也可以写成 `cn-chengdu`；脚本会自动把后者规范成 `oss-cn-chengdu`。
- `OSS_PREFIX`
  可选。控制上传到 bucket 内的 object key 前缀，也就是实际意义上的“目录”。
  例如：`OSS_PREFIX=Travel/Weihai` 时，`IMG_0001.jpg` 会上传到 `oss://<bucket>/Travel/Weihai/IMG_0001.jpg`。
  如果 `OSS_PREFIX` 为空，则上传到 bucket 根目录。
  `--upload-only` 也使用当前环境里的 `OSS_PREFIX`，不会记住上一次转换时使用过的目录。
- `OSS_PUBLIC_DOMAIN`
  可选。只用于打印公开访问链接，以及生成公开 URL 列表文件。
  它不会改变文件实际上传到哪里；上传路径仍然由 `OSS_BUCKET` 和 `OSS_PREFIX` 决定。
  如果缺少 `OSS_BUCKET` 或 `OSS_REGION`，并且这个域名指向阿里云 OSS CNAME，上传器可能会通过 DNS 推断缺失的 bucket 和 region。
- `OSS_ENDPOINT`
  可选。需要自定义 endpoint 时使用；设置后可替代 `OSS_REGION`。
- `OSS_DNS_SERVER`
  可选。用于 OSS 请求的 DNS 服务器，可写一个或多个，用逗号或空格分隔，例如 `223.5.5.5` 或 `223.5.5.5,119.29.29.29`。
  当机器默认 DNS 解析 OSS 域名不稳定时比较有用。
- `OSS_STS_TOKEN`
  可选。使用临时 STS 凭证时填写。
- `JPEGTRAN_BIN`
  可选。`jpegtran` 的命令名或绝对路径。
  仅在需要对 EXIF `Orientation` 不为 `1` 的 JPG/JPEG 做归一化时有用，特别适合系统 `PATH` 中没有 `jpegtran` 的情况。

### 上传路径如何决定

- 普通“处理并上传”：
  如果设置了 `OSS_PREFIX`，上传路径就是 `oss://<bucket>/<prefix>/<fileName>`；否则就是 `oss://<bucket>/<fileName>`。
- `--upload-only`：
  采用同样的上传路径规则，但会把 `output/` 下当前存在的所有 `.jpg` 一起上传。
  最终上传到哪个目录，仍然由当前环境里的 `OSS_PREFIX` 决定。
- `--replace-from=<file>`：
  目标 object path 不再使用 `OSS_PREFIX`，而是直接覆盖 URL 列表中对应的原始 OSS object key。
  如果配置了 `OSS_PUBLIC_DOMAIN`，它仍然会用于打印公开链接。

### 加载方式

- `node scripts/process-photos.js` 直接读取当前 shell 里的 `process.env`。
- `npm run workflow:photos` 可以从 `key.txt`、`env`、`none` 或自定义配置文件路径中读取配置。
- 交互式工作流在读取配置文件时，配置文件中的值会覆盖 shell 环境里同名的现有变量。
- 当前脚本不会自动加载本地 `.env` 文件。
  如果你想使用 `.env` 里的值，需要先把它们导入当前 shell，或者写入 `key.txt`。

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

然后按这个前缀执行 `upload-only`：

```powershell
npm run upload:photos
```

你也可以把密钥保存在 `key.txt` 中，再让 `npm run workflow:photos` 直接加载。

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
- 交互模式下默认移除 GPS：`no`

## 输出文件名

例如，`IMG_1234.HEIC` 会变成：

```text
IMG_1234_converted.jpg
```

其他文件名也会先做清理，再附加你配置的后缀。

## 隐私说明

EXIF 元数据可能包含设备型号、拍摄时间、GPS 坐标等敏感信息。默认会保留 GPS。若图片会用于公开网站，建议使用 `--strip-gps`，或在交互式流程中对移除 GPS 的问题回答 `yes`。

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
