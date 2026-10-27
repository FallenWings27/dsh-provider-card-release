# dsh-provider-card

切换模型时，会话输入框的座位上会出现一张角色卡。

![15 个主要家族的立绘总览](showcase/families.png)

## 它做什么

- 切 provider / model 时，座位上出现一张卡：卡号、身份名、六轴数值、额度行、一句台词。六轴都占行，没有分数的轴写「？」，不写 0。
- 同一张卡第一次播完整版，之后播精简版。看过的卡记在 localStorage 里，按时间从旧到新裁。
- 只有切走的那个模型额度告急时才提醒。当前在用的模型不弹气泡，只在 HUD 原位提示。
- 额度分 5 小时窗和周窗，两个窗各自判定，取更紧的一档。过期读数判 unknown。
- 跟随系统的「减少动效」设置。
- 宿主自带的模型选择器也带卡面：座位按钮显示当前卡的编号和身份名，展开的列表每行带卡色、身份名与关键分数，鼠标停上去能预览整张卡。选择逻辑还是宿主原来的 select()，插件只加渲染，不接事件。

## 卡从哪来

| 档 | 条件 | 卡的来源 |
|---|---|---|
| 精选卡 | 归一化后的模型名命中一张精选卡 | `data/providers.json`（手填） |
| 数据卡 | 库里没有，但公开基准集里有分数 | 由 `data/benchmarks.json` 派生（编号恒为 `—`，不占精选编号） |
| 通用卡 | 都没有 | 按 provider 名确定性哈希着色 |

三档按顺序匹配，匹配不上就往下走一档。精选卡 23 张，覆盖 15 个 provider；基准集收了 35 个模型的公开分数，生成时间写在 `data/benchmarks.json` 里。

卡片不编分数。缺项的轴照常占行，数值位写「？」，不是 0。厂商自报的分数带 caveat 标注；没裁决的冲突两个值都留着。身份归一化有反例保护：v4 不等于 v4.1，Flash 不等于 Pro，参数量写法也不剥。

## 安装

本插件是 DSH 宿主的 bundle 插件，不从 npm 安装。包名带 `@local/` 作用域，`package.json` 里写着 `"private": true`，那条只拦 `npm publish`，不拦 git 克隆和推送。发布仓的仓名（`dsh-role-card-release`）和包名（`@local/dsh-provider-card`）不一样，是历史原因：仓里放成品，包名是宿主识别 bundle 用的 id。这个 id 不能改，它同时写在 `package.json` 的 `name`、`cordis.patch.yml` 的 `name` 和 `index.js` 的 `TAG` 里，三处必须一致。

包里有什么（`package.json` 的 `files` 白名单覆盖下面全部）：

```
index.js                宿主半体（ESM，导出 apply）
src/client.js           浏览器半体（window.__ModuleLoader__ 装载）
src/locale/*.json       语言字典（宿主读插件元信息用，含 meta.title / meta.description）
src/i18n/*.json         界面英译表（插件自己按路径读，原因见下）
src/icon.svg            图标
lib/*.cjs               纯逻辑层（服务端）
data/*.json             数据与基准集
seed/                   首装素材库（立绘、CG、视频与绑定清单）
showcase/families.png   家族立绘总览图
cordis.patch.yml        宿主注册 patch
```

装机四步。profile 目录指 `<DSH_HOME>/profiles/<名字>`，web 宿主一般是 `web`。

1. 把仓库取到一个稳定目录。宿主每次启动都要读它，别放临时目录。

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

3. 让 profile 的 `node_modules/@local/dsh-provider-card` 指向 `<PLUGIN_DIR>`：Windows 用 `mklink /J`，Git Bash 用 `ln -s`。宿主按包的 `node_modules` 路径找到目录，再读 `dsh.profile.bundles`。第 2 步那条 `link:` 只是给包管理器看的占位，宿主并不读它的值。这一步别用 `pnpm install`，它会按 `package.json` 重建整棵 `node_modules`，把别的插件连同 junction 一起改写。

4. 重启宿主（`dsh web`），刷新页面。设置页的插件列表里出现「角色卡」，模型选择器的座位上出现卡面，就算装好了。

更新：在 `<PLUGIN_DIR>` 里 `git pull --ff-only`，然后重启宿主。

`src/locale/` 里只放语言字典。宿主解析插件元信息时会把那个目录里的每个 `.json` 都当语言字典，文件名必须像语言 id（`en.json`、`zh-CN.json`），否则设置页报「包元信息错误：… must use a language id as its filename」。界面英译表放在 `src/i18n/`，插件自己按路径读。

首装会自动播种：插件的数据目录（`<DSH_HOME>/provider-card/`）里没有素材清单时，首次加载会把包内 `seed/` 的素材库播种过去，已有的素材和绑定不会被覆盖。素材配额默认 1 GiB，可以在数据目录的 `config.json` 里调（键 `totalBytes`）。

## 依赖

没有第三方 npm 依赖。服务端只用 node 内置模块（`node:module` `node:fs` `node:path` `node:os` `node:crypto` `node:stream`）；浏览器半体是随包发布的单文件 `src/client.js`（由模板内联生成），运行时用宿主提供的 React，所以没有 `peerDependencies`，也不带 `node_modules`。

## 数据与隐私

- 判定全部在本机完成，卡面数据与基准集随包发布，不联网取数。
- 额度读的是宿主的路由读数（宿主本地快照类读数），不外发。
- seen 集合存 localStorage；服务端与浏览器两侧合并时取较新的一侧，只在一侧有的键会保留。

## 许可

代码按 MIT 许可发布，见 `LICENSE`；`seed/assets/` 下的美术素材许可见 `ASSET_LICENSE.md`。
