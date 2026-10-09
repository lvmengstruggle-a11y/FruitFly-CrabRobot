# 果蝇大脑 × 螃蟹机器人

**Fruit Fly × Crab Robot**

冻结的果蝇连接组在浏览器里驱动一台 22 自由度仿真螃蟹，穿过管道。界面可在中文和英文之间切换。

A frozen fruit-fly connectome runs in the browser and drives a simulated 22-DoF crab through pipes. The page itself switches between Chinese and English.

[中文](#中文) · [English](#english)

---

## 中文

### 这是什么

这是一个在浏览器里完成的神经计算演示，不是真实果蝇在控制机器人。

1. 场地状态被编成果蝇视觉神经元的输入。
2. MaleCNS v1.0 雄性果蝇连接组在 Web Worker 里以 50 Hz 更新。
3. 下行神经元的活动被解码成「起跳」或「等待」。
4. 起跳驱动仿真螃蟹 **Jumper**：22 个自由度，站姿和连杆长度来自它的 MJCF。

连接组本身不训练。学习只发生在后面的读出层。感官编码和运动解码都是人工接口，不表示真实果蝇能看懂管道，也不表示这只螃蟹按生物学方式走路。

| | |
| --- | --- |
| 神经元 | 166,700 |
| 有效连接 | 25,088,107 |
| 连接组 | MaleCNS v1.0，权重冻结 |
| 机器人 | Jumper，22 自由度 |
| 运行环境 | 浏览器，WebGL 2 + Web Worker |

### 画面

- **果蝇大脑**：视叶、视觉投射、中央脑、下行、上行和腹神经索的实时活动，以及脉冲场。
- **螃蟹场地**：螃蟹在沙地上横着爬，用腿探管沿，开口够大就爬过去，下沿挡路时起跳。loom 下行神经元放电且还没决定起跳时，它会停住并可以倒退。
- **神经数据**：视觉输入、运动输出，以及本浏览器里的最佳成绩。

### 怎么跑

需要 Node.js 20 或更高版本，以及支持 Web Worker、WebGL 2 和 `DecompressionStream` 的浏览器。

螃蟹模型不在本仓库里。开发服务器会从同级目录读取 Jumper 的 MJCF 和网格：

```text
7vmall/
├─ FruitFly&CrabRobot/
└─ jumper-main/assets/jumper/    jumper.xml 和 meshes/
```

```bash
cd FruitFly&CrabRobot
npm install
npm run dev
```

终端会打印本地地址，一般为 `http://127.0.0.1:5173/`。5173 被占用时会改用下一个端口。

加载完成后点击 **唤醒果蝇**。右上角可以切换 **中文 / EN**。

### 怎么玩

| 按钮 | 作用 |
| --- | --- |
| 纯脑模式 | 不学习，直接看 DNp01 的原始解码 |
| 在线训练 | 默认。边爬边更新读出层，大约 1,000 个样本后稳定；重开后保留进度 |
| 快速训练 | 在 Worker 里生成示范并训练。完成后切到冻结的快速模型 |
| 导出 / 导入模型 | 下载或恢复读出层 JSON，也会写入浏览器本地存储 |
| 慢速大脑 | 放慢神经仿真，便于看信号 |
| 自动复活 | 坠落后再开一局 |
| 声音 | 开关动作音效 |
| 暂停 / 重新开始 | 停在当前帧，或换一只螃蟹重来 |

快速训练和在线训练是两套权重，不会互相覆盖。再点「在线训练」会回到快速训练之前的样本数和损失。

读出层只能微调管口附近的起跳时机。它不能越过这些安全边界：身体已经在目标上方时不再起跳；正在快速上升时不再连跳。同一段腾空最多起跳三次，下一次必须等脚落地。

### 地址参数

| 参数 | 作用 |
| --- | --- |
| `?lang=zh` 或 `?lang=en` | 指定界面语言 |
| `?seed=12345` | 固定随机种子，方便复现 |
| `?debug=1` | 显示额外性能信息 |

### 构建与测试

```bash
npm test
npm run build
npm run preview
```

生产环境如果带上 COOP/COEP 响应头，神经活动会走 `SharedArrayBuffer`。没有这些头时自动改用可转移缓冲，主要功能不变。

### 目录

```text
src/brain/        连接组加载、仿真、训练、动作解码
src/game/         场地、管道、碰撞，以及螃蟹运动学
src/renderer/     大脑图、脉冲场、螃蟹外观
src/experiment/   随机种子和成绩
src/i18n/         中英文界面文案
public/brain/     浏览器版连接组与默认读出模型
```

### 连接组数据

`public/brain/` 里已经放了可直接运行的官方浏览器导出：

| 文件 | 内容 |
| --- | --- |
| `brain.json` | 规模清单 |
| `meta.bin` | FLYM 神经元元数据 |
| `weights.0.bin`、`weights.1.bin` | FLYW 压缩稀疏权重 |
| `readout.json` | 默认读出模型 |

这份导出使用 `sensory_input=False`：去掉指向感觉神经元的传入边，感觉神经元的传出连接以及其余连接保持完整。缺少这些文件时页面会提示连接组不可用，不会用假数据代替。

需要重新导出时，安装 fly.ai 后执行：

```bash
python -m flybrain download
python -m flybrain export --web public/brain
```

### 许可

MaleCNS v1.0 连接组数据为 CC BY 4.0。本仓库目前没有单独的代码许可证文件。

---

## English

### What this is

A neuroscience demo that runs entirely in the browser. It is not a real fly controlling a robot.

1. The arena is encoded as input to fruit-fly visual neurons.
2. The MaleCNS v1.0 male connectome steps at 50 Hz inside a Web Worker.
3. Descending-neuron activity is decoded into jump or wait.
4. A jump drives **Jumper**, a simulated crab with 22 degrees of freedom. Stance and link lengths come from its MJCF.

The connectome stays frozen. Learning happens only in the readout. The sensory encoding and the motor decode are designed interfaces. They do not mean a real fly understands pipes, or that this crab walks the way a biological crab does.

| | |
| --- | --- |
| Neurons | 166,700 |
| Active connections | 25,088,107 |
| Connectome | MaleCNS v1.0, weights frozen |
| Robot | Jumper, 22 degrees of freedom |
| Runtime | Browser, WebGL 2 + Web Worker |

### On screen

- **Fly brain.** Live activity across the optic lobes, visual projection neurons, central brain, descending and ascending neurons, and the nerve cord, plus a spike field.
- **Crab arena.** The crab crawls sideways on sand, feels along a pipe lip with its legs, walks through an opening that fits, and jumps when the lower lip is in the way. When loom descending neurons fire and no jump has been decoded, it stops and can back away.
- **Neural data.** Visual input, motor output, and the best runs stored in this browser.

### Run it

Node.js 20 or newer, and a browser with Web Workers, WebGL 2, and `DecompressionStream`.

The crab model is not in this repository. The dev server reads Jumper's MJCF and meshes from a sibling directory:

```text
7vmall/
├─ FruitFly&CrabRobot/
└─ jumper-main/assets/jumper/    jumper.xml and meshes/
```

```bash
cd FruitFly&CrabRobot
npm install
npm run dev
```

Open the local URL printed in the terminal, usually `http://127.0.0.1:5173/`. If 5173 is taken, Vite picks the next free port.

When loading finishes, click **Wake up fly**. Use **中文 / EN** in the header to switch language.

### Controls

| Control | What it does |
| --- | --- |
| Pure brain | No learning. Raw DNp01 decode only |
| Online train | Default. Updates the readout while the crab runs. Settles after about 1,000 samples and keeps progress across restarts |
| Fast train | Builds demonstrations in the worker and trains. Then switches to a frozen fast model |
| Export / import model | Save or restore the readout JSON. A copy also stays in local storage |
| Slow brain | Slows the neural step so the signal is easier to watch |
| Auto revive | Starts the next run after a fall |
| Sound | Action sounds |
| Pause / restart | Hold the current frame, or start over with a new crab |

Fast train and online train keep separate weights. Choosing online train again restores the sample count and loss from before the fast train.

The readout may only nudge jump timing near the opening. It cannot cross these limits: no jump once the body is already above the target, and no second jump while the body is still rising fast. At most three jumps in one flight; the next one waits until the feet are on the ground.

### URL parameters

| Parameter | Effect |
| --- | --- |
| `?lang=zh` or `?lang=en` | Force the interface language |
| `?seed=12345` | Fixed random seed, for a repeatable run |
| `?debug=1` | Extra performance details |

### Build and test

```bash
npm test
npm run build
npm run preview
```

With COOP/COEP headers, neural activity is shared through a `SharedArrayBuffer`. Without them the page falls back to transferable buffers. The demo still runs.

### Layout

```text
src/brain/        Connectome load, simulation, training, action decode
src/game/         Arena, pipes, collision, crab kinematics
src/renderer/     Brain map, spike field, crab mesh
src/experiment/   Seeds and scores
src/i18n/         Chinese and English UI copy
public/brain/     Browser connectome and the default readout
```

### Connectome data

`public/brain/` already contains a verified browser export:

| File | Contents |
| --- | --- |
| `brain.json` | Manifest and scale |
| `meta.bin` | FLYM neuron metadata |
| `weights.0.bin`, `weights.1.bin` | FLYW compressed sparse weights |
| `readout.json` | Default readout |

The export uses `sensory_input=False`: incoming edges onto sensory neurons are removed. Outgoing sensory edges and the rest of the connectome stay intact. If these files are missing, the page reports that the connectome is unavailable. It does not substitute simulated data.

To export again, with fly.ai installed:

```bash
python -m flybrain download
python -m flybrain export --web public/brain
```

### License

MaleCNS v1.0 connectome data is CC BY 4.0. This repository does not yet include a separate license file for the code.
