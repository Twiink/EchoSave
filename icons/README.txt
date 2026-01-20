图标占位符说明
================

请将以下尺寸的图标文件放置在此目录：

- icon16.png  (16x16 像素)
- icon48.png  (48x48 像素)
- icon128.png (128x128 像素)

您可以：
1. 使用在线工具生成图标（如 https://www.favicon-generator.org/）
2. 使用设计软件（如 Photoshop、Figma）创建
3. 使用以下命令生成占位图标（需要 ImageMagick）：

convert -size 16x16 xc:#667eea -gravity center -pointsize 10 -fill white -annotate +0+0 "E" icon16.png
convert -size 48x48 xc:#667eea -gravity center -pointsize 32 -fill white -annotate +0+0 "E" icon48.png
convert -size 128x128 xc:#667eea -gravity center -pointsize 80 -fill white -annotate +0+0 "E" icon128.png

建议图标设计：
- 主色调：紫色渐变 (#667eea -> #764ba2)
- 图案：下载箭头或对话气泡
- 风格：现代、简洁、扁平化
