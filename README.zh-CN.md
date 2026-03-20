# chat-ai-template

一个最小化的AI聊天界面，UI参考ChatGPT。

该项目提供了ai聊天用户界面的轻量级、最少依赖的实现，可以直接在任何项目中复制和使用。如果在你的工作中遇到需要写一个ai聊天应用，但同时不能添加其他依赖的时候，也许你可以选择试试这个模板。

## ✨ 功能

- 💬ChatGPT风格的对话界面
- ⚡ 流式响应支持（实时输出）
- 🧩不需要很多外部依赖 (markdwon-it & highlight.js)
- 📦复制粘贴就绪——即使在大型项目中也能工作
- 🔧简单的API配置
- 🧱多个实现包括：
  - 反应版本
  - Vue版本
- 🤖默认使用Ollama API

## 🎯 设计目标

此模板是按照以下原则构建的：

- **极简主义** — 保持代码简单且可读
- **便携性** — 无需过多设置即可放入任何项目
- **框架灵活性** — 使用或不使用框架
- **流式傳輸第一** — 专为实时人工智能输出而設計
- **零锁定** — API和用户界面易于修改

## 📁 项目结构

```
chat-ai-template
├── src
│   ├── assets
│   ├── core        # api logic
│   ├── vue-template
|   |   └──chat       # vue page
│   └── react-template
|       └──chat       # react page
```

## 📄 License

MIT License
