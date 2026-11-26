// 文件说明：简历页的自定义事件名常量。
// 单独拆文件是为了让 Astro 页面脚本与 React 抽屉共享同一个常量，又不会互相附带副作用代码。

/** 项目卡片点击后派发的事件，detail 为项目 id */
export const RESUME_PROJECT_EVENT = 'resume:open-project';
