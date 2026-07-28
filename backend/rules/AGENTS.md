# Markdown 规则文件约定

- 格式：YAML frontmatter + Markdown 正文
- frontmatter 必含：name, type, display_name, description, version
- type 取值：generation / platform / style
- 文件名用英文小写 + 连字符
- 运行时由 RulesEngine 读取并注入 AI Prompt
- 修改后立即生效（热更新）
