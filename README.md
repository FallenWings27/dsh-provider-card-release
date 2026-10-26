# dsh-provider-card

切换模型时，在会话输入框的座位上播一张角色登场卡。

## 它做什么

- 你切换 provider / model 的那一刻，座位上出现一张卡：卡号、身份名、六轴数值、额度行、一句台词。**六轴全部占行**，没有分数的轴数值位显示「？」，不是 0。
- 同一张卡首次播完整版，之后播精简版（`localStorage` 记 seen，按时间最旧裁剪）。
- 切走的模型额度告急时才提醒；**当前正在用的模型不弹气泡**，只在 HUD 原位提示。
- 额度读数分 5h 窗与周窗两窗独立判定，取更紧的一档；过期读数判 `unknown`，**不拿旧数当现状**。
- 尊重系统的「减少动效」设置。
- 宿主自己的模型选择器也带卡面：座位按钮显示当前卡的编号与身份名，展开的模型列表每行带卡色、身份名与关键分数，悬停任意一行即可预览整张卡。选择逻辑仍走宿主原有的 `select()`，本插件只做渲染增强，不劫持事件。

## 卡从哪来（三档，不猜）

| 档 | 条件 | 卡的来源 |
|---|---|---|
| 精选卡 | 归一化后的模型名恰好命中一张精选卡 | `data/providers.json`（手填） |
| 数据卡 | 卡库里没有，但公开基准数据集里有分数 | `data/benchmarks.json` 派生（编号恒为 `—`，不占精选编号） |
| 通用卡 | 都没有 | 按 provider 名确定性哈希着色 |

**不做的事**：不编分数。缺项的轴照常占行、数值位显示「？」，不是 0。厂商自报分必须带 `caveat` 标注；
未裁决的冲突两个值都保留，不挑一个当真相。身份归一化有反例保护：`v4 ≠ v4.1`、
`Flash ≠ Pro`、参数量写法不被剥。

## 安装

本插件是 **DSH 宿主插件（bundle 形态）**，不是独立应用，也不从 npm 安装：包名带
`@local/` 作用域、`package.json` 里 `"private": true`——后者只拦 `npm publish`，
**不拦 git 克隆与推送**。发布仓的仓名（`dsh-role-card-release`）与包名
（`@local/dsh-provider-card`）不同是历史原因：仓是成品发布件，包名是宿主识别 bundle 的 id，
**不能被改**（它同时写死在 `package.json` 的 `name`、`cordis.patch.yml` 的 `name`、
`index.js` 的 `TAG` 里，三处必须一致）。

**包里有什么**（`package.json` 的 `files` 白名单覆盖以下全部——**运行时依赖一个都不少**）：

```
index.js                宿主半体（ESM，导出 apply）
src/client.js           浏览器半体（window.__ModuleLoader__ 装载）
src/locale/*.json       语言字典（宿主读插件元信息用，含 meta.title / meta.description）
src/i18n/*.json         界面英译表（插件自己按路径读；**故意不在 src/locale/ 里**，见下）
src/icon.svg            图标
lib/*.cjs               纯逻辑层（服务端）
data/*.json             数据与基准集
seed/                   首装素材库（立绘 / CG / 视频与绑定清单，随包发布）
cordis.patch.yml        宿主注册 patch
```

**装机四步**（profile 目录＝`<DSH_HOME>/profiles/<名字>`，web 宿主一般是 `web`）：

1. 把本仓库取到**一个稳定目录**（宿主每次启动都读它，别放临时目录）：

   ```bash
   git clone git@github.com:FallenWings27/dsh-role-card-release.git <PLUGIN_DIR>
   ```

2. 在 `<profile>/package.json` 里登记两处：

   ```jsonc
   {
     "dependencies": {
       "@local/dsh-provider-card": "link:<PLUGIN_DIR 的绝对路径>"
     },
     "dsh": { "profile": { "bundles": ["@local/dsh-provider-card"] } }
   }
   ```

3. 让 profile 的 `node_modules/@local/dsh-provider-card` 指向 `<PLUGIN_DIR>`：
   Windows 用 `mklink /J`，类 Unix（Git Bash）用 `ln -s`。
   宿主解析插件时按包的 `node_modules` 路径找目录、再读 `dsh.profile.bundles`；
   第 2 步里 `dependencies` 那条 `link:` **只是给包管理器看的占位**（免得它以为缺包），
   宿主并不读它的值——真正让插件被加载的是这一步的链接与第 2 步的 `bundles` 列表。
   **别用 `pnpm install` 做这一步**——它会按 `package.json` 重建整棵 `node_modules`，
   把别的插件（以及它们的 junction 指向）一起改写。

4. 重启宿主（`dsh web`）并刷新页面。设置页的插件列表里出现「角色卡」、
   模型选择器的座位上出现卡面，即为装机成功。

更新：在 `<PLUGIN_DIR>` 里 `git pull --ff-only`，然后重启宿主。

`src/locale/` 里只放语言字典：宿主解析插件元信息时会把该目录里**每个** `.json`
都当语言字典，文件名必须像语言 id（`en.json`、`zh-CN.json`），否则设置页报
「包元信息错误：… must use a language id as its filename」。界面英译表放在
`src/i18n/`（插件自己按路径读），就是为了不落进那条规则。

**首装自动播种**：插件的数据目录（`<DSH_HOME>/provider-card/`）里没有素材清单时，首次加载会自动把包内 `seed/` 的素材库播种过去；已有素材和绑定不会被覆盖。素材配额默认 1 GiB，可在数据目录的 `config.json` 里调整（键 `totalBytes`）。

## 依赖

**无第三方 npm 依赖。** 服务端只用 node 内置模块（`node:module` `node:fs` `node:path`
`node:os` `node:crypto` `node:stream`）；浏览器半体是随包发布的单文件 `src/client.js`
（由模板内联生成），运行时依赖宿主提供的 React，
因此没有 `peerDependencies`，也不带 `node_modules`。

## 数据与隐私

- 全部判定在本机完成，卡面数据与基准集随包发布，**不联网取数**。
- 额度读的是宿主的本地路由快照（宿主本地快照类读数），不外发。
- seen 集合存 `localStorage`；服务端与浏览器两侧合并时取较新，**本地独有的键一条都不丢**。

## 许可

代码按 MIT 许可发布，见 `LICENSE`；`seed/assets/` 下的美术素材许可见 `ASSET_LICENSE.md`。
