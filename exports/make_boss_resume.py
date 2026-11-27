# 文件说明：生成 BOSS 直聘 / ATS 友好的单栏简历（DOCX），并导出 PDF。
# 设计约束（为了被简历解析器正确识别）：
#   - 单栏、无表格、无文本框、无页眉页脚
#   - 标准小节标题（个人信息/求职意向/教育经历/工作经历/项目经历/专业技能/证书）
#   - 纯文本条目 + 字面项目符号，日期统一 YYYY.MM 格式
import sys
from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

OUT = sys.argv[1] if len(sys.argv) > 1 else "唐文轩-前端开发工程师-简历.docx"

CJK_FONT = "微软雅黑"
LATIN_FONT = "Calibri"
INK = RGBColor(0x1A, 0x1A, 0x1A)
MUTED = RGBColor(0x55, 0x55, 0x55)


def set_run_font(run, size=10.5, bold=False, color=INK):
    run.font.name = LATIN_FONT
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color
    rpr = run._element.get_or_add_rPr()
    fonts = rpr.find(qn("w:rFonts"))
    if fonts is None:
        fonts = OxmlElement("w:rFonts")
        rpr.append(fonts)
    fonts.set(qn("w:ascii"), LATIN_FONT)
    fonts.set(qn("w:hAnsi"), LATIN_FONT)
    fonts.set(qn("w:eastAsia"), CJK_FONT)


def set_bottom_border(paragraph, color="BFBFBF", size=6):
    ppr = paragraph._p.get_or_add_pPr()
    pbdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), str(size))
    bottom.set(qn("w:space"), "2")
    bottom.set(qn("w:color"), color)
    pbdr.append(bottom)
    ppr.append(pbdr)


def section_heading(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(7)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    set_run_font(run, 12, bold=True)
    set_bottom_border(p)
    return p


def body(doc, text, size=10.5, bullet=False, color=INK, space_after=1):
    p = doc.add_paragraph()
    fmt = p.paragraph_format
    fmt.space_before = Pt(0)
    fmt.space_after = Pt(space_after)
    fmt.line_spacing = 1.12
    if bullet:
        fmt.left_indent = Cm(0.55)
        fmt.first_line_indent = Cm(-0.55)
        text = "• " + text
    run = p.add_run(text)
    set_run_font(run, size, color=color)
    return p


def entry_line(doc, left, right):
    """一行内写完「公司 | 职位 | 时间」，不用表格也不靠制表位右对齐。
    这样 PDF/ATS 抽取时能落到同一行，解析器最容易识别出「公司 + 职位 + 起止时间」。"""
    p = doc.add_paragraph()
    fmt = p.paragraph_format
    fmt.space_before = Pt(4)
    fmt.space_after = Pt(1)
    fmt.line_spacing = 1.15
    # 与下面的技术栈/要点保持同页，避免标题孤零零留在页尾
    fmt.keep_with_next = True
    run = p.add_run(left)
    set_run_font(run, 10.5, bold=True)
    run2 = p.add_run("　|　" + right)
    set_run_font(run2, 10, color=MUTED)
    return p


def sub_line(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(1)
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    set_run_font(run, 9.5, color=MUTED)
    return p


doc = Document()

# 页面：A4，上下 1.8cm，左右 2cm
sec = doc.sections[0]
sec.page_width = Cm(21)
sec.page_height = Cm(29.7)
sec.top_margin = Cm(1.5)
sec.bottom_margin = Cm(1.5)
sec.left_margin = Cm(2)
sec.right_margin = Cm(2)

# Normal 样式基础
normal = doc.styles["Normal"]
normal.font.name = LATIN_FONT
normal.font.size = Pt(10.5)
normal.element.rPr.rFonts.set(qn("w:eastAsia"), CJK_FONT)

# ---------------- 抬头 ----------------
p = doc.add_paragraph()
p.paragraph_format.space_after = Pt(2)
set_run_font(p.add_run("唐文轩"), 20, bold=True)

p = doc.add_paragraph()
p.paragraph_format.space_after = Pt(1)
set_run_font(p.add_run("前端开发工程师｜4 年经验｜微前端 / AI 应用"), 11, color=MUTED)

p = doc.add_paragraph()
p.paragraph_format.space_after = Pt(0)
set_run_font(p.add_run("手机：182-6032-9723　｜　邮箱：marcoustang@gmail.com　｜　现居：上海"), 10)

# ---------------- 求职意向 ----------------
section_heading(doc, "求职意向")
body(doc, "前端开发工程师（Vue 3 / 微前端架构 / AI 应用方向），期望城市上海。")

# ---------------- 个人优势 ----------------
section_heading(doc, "个人优势")
for t in [
    "4 年前端开发经验，覆盖工业软件、低代码平台与 AI 应用，能独立负责中台级前端底座的架构设计与落地。",
    "主导过 Vue 3 + Module Federation 微前端底座：4 个子系统独立开发独立部署，解决了刷新深链 404、框架单例失效、样式污染等典型问题。",
    "完整做过 RAG 智能问答前端链路（检索 → Prompt → SSE 流式输出 → 引用回看），熟悉大模型应用的前端工程化与可观测性。",
    "熟悉飞书 aPaaS 低代码开发，可独立交付从数据表设计、流程编排、云函数、权限到上线维护的整套系统。",
]:
    body(doc, t, bullet=True)

# ---------------- 工作经历 ----------------
section_heading(doc, "工作经历")

entry_line(doc, "上海招商局招商智科　|　前端开发工程师", "2026.06 - 至今")
body(doc, "负责船舶智能化中台的 Vue 3 微前端底座与「数字化交付」子系统，覆盖架构设计、接入规范与业务实现。", bullet=True)
body(doc, "设计运行时模块注册表、动态加载器与接入契约，支撑 4 个子系统独立开发与独立部署。", bullet=True)
body(doc, "实现 RAG 智能问答前端链路：知识库导入、向量化状态轮询、检索结果引用回看、LLM 流式输出。", bullet=True)

entry_line(doc, "上海骞行　|　低代码全栈工程师", "2025.06 - 2025.12")
body(doc, "在飞书 aPaaS 上独立交付 YFS 工单系统、CCAB 窗口匹配系统、多维表格合同管理系统三套系统。", bullet=True)
body(doc, "负责数据表字段与关联设计、流程编排、云函数、前端权限与移动端开发，并参与上线后维护。", bullet=True)

entry_line(doc, "上海思创电器设备有限公司　|　前端开发工程师", "2023.09 - 2025.04")
body(doc, "负责国家电网变电设备状态质量管理平台的 PC 端、移动端与数据大屏，项目从零搭建。", bullet=True)
body(doc, "封装 table、formModal、表格请求 hook 等通用能力，统一项目开发范式，支撑多个业务模块快速迭代。", bullet=True)

entry_line(doc, "云智能科技　|　前端开发实习生", "2022.08 - 2023.07")
body(doc, "参与简宜运数字化货代平台的官网、管理后台、DSCFI 与 uni-app 移动端开发，并维护官方组件库文档。", bullet=True)

# ---------------- 项目经历 ----------------
section_heading(doc, "项目经历")

entry_line(doc, "船舶智能化中台 · 微前端底座　|　前端开发（负责人）", "2026.06 - 至今")
sub_line(doc, "技术栈：Vue 3.5、TypeScript、Vite 7、Module Federation、Pinia、Element Plus、Nginx、Docker")
body(doc, "设计注册表 + 动态 Loader + 接入契约，运行时加载各子系统，单个 Remote 异常不影响主应用启动。", bullet=True)
body(doc, "手动构造 shareScope 强制框架单例共享，解决子系统自带 Vue 导致的响应式与状态割裂问题。", bullet=True)
body(doc, "修复子系统深链刷新 404：启动时先初始化模块再 router.isReady，路由守卫等待模块就绪后重新导航。", bullet=True)
body(doc, "统一权限体系与请求头注入（路由 meta 权限、菜单递归过滤、v-permission 按钮指令）。", bullet=True)

entry_line(doc, "数字化交付 · RAG 智能问答与文档工程　|　前端开发", "2026.06 - 至今")
sub_line(doc, "技术栈：Vue 3、TypeScript、SSE、pdfjs-dist、MinIO、markdown-it、KaTeX、ASR/TTS")
body(doc, "打通文件导入 → 向量化 → topK 检索 → Prompt 拼装 → SSE 流式输出 → 引用页码回看 → 会话导出全链路。", bullet=True)
body(doc, "治理向量化轮询竞态：请求序号 + 库快照丢弃过期响应、页面隐藏暂停、连续失败熔断。", bullet=True)
body(doc, "文档工程：MD5 秒传、10MB 分片 4 路并发上传、断点续传，单文件 200MB 稳定可传，弱网可续传。", bullet=True)

entry_line(doc, "延锋 YFS 工单系统　|　独立开发", "2025.06 - 2025.12")
sub_line(doc, "技术栈：飞书 aPaaS、云函数、Webhook、流程编排")
body(doc, "通过 Webhook 拉取四类异常工单入库，飞书卡片一键接单，状态变更回调第三方平台，24 小时定时催办。", bullet=True)

entry_line(doc, "社群 / 内容电商经营报表自动化　|　独立开发（Cursor 辅助）", "2025.12 - 2026.03")
sub_line(doc, "技术栈：Python、吉客云 OpenAPI、Playwright、pandas、SMTP")
body(doc, "对接吉客云接口拉取订单，用 Playwright 导出小红书投放数据，pandas 合并本地 Excel 生成报表并邮件推送。", bullet=True)

# ---------------- 教育经历 ----------------
section_heading(doc, "教育经历")
entry_line(doc, "广东白云学院　|　软件工程　|　本科", "2019.09 - 2023.06")
body(doc, "GPA 4.0（专业前 5%）；主修软件工程、数据结构与算法、线性代数、离散数学。")

# ---------------- 专业技能 ----------------
section_heading(doc, "专业技能")
for t in [
    "前端框架：Vue 3 / Vue 2（Composition API、Options API）、TypeScript、Pinia / Vuex、Element Plus、uni-app、React（了解）",
    "微前端与架构：Module Federation、运行时模块注册、shareScope 单例共享、路由与菜单及 i18n 动态注入、iframe postMessage 桥接",
    "AI 应用：RAG 知识库检索、OpenAI 兼容接口、LLM SSE 流式、Prompt 工程、引用溯源、ASR/TTS",
    "工程化：Vite / Webpack、ESLint / Prettier、前端性能优化、Nginx 与 Docker 部署、Git Flow、CI/CD",
    "低代码与数据：飞书 aPaaS、多维表格与云函数、Webhook、Python / pandas（了解）",
]:
    body(doc, t, bullet=True)

# ---------------- 证书 ----------------
section_heading(doc, "证书")
body(doc, "大学英语四级（CET-4）、大学英语六级（CET-6）、普通话二级甲等")

doc.save(OUT)
print("saved:", OUT)
