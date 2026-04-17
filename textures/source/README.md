# 纹理源文件 & 生成说明

## 源文件

| 星球 | 文件 | 分辨率 | 说明 |
|------|------|--------|------|
| 地球 | `earth_surface_equirectangular.png` | 8192×4096 | PNG无损，用于生成high/mid |
| 地球 | `earth_surface_equirectangular.jpg` | 8192×4096 | JPG版本 |
| 地球 | `earth_surface_preview.jpg` | 4096×2048 | 预览版，用于生成low |
| 冥王星 | `pluto_surface_equirectangular.png` | 8192×4096 | PNG无损，用于生成high/mid |
| 冥王星 | `pluto_surface_equirectangular.jpg` | 8192×4096 | JPG版本 |
| 冥王星 | `pluto_surface_preview.jpg` | 4096×2048 | 预览版，用于生成low |

## LOD 纹理生成方法

使用 Python Pillow 从源文件生成三级 LOD 纹理：

### 地球
```python
from PIL import Image

# high: PNG无损原尺寸
img = Image.open('source/earth_surface_equirectangular.png').convert('RGB')
img.save('../planets/Earth_high.jpg', 'JPEG', quality=95)

# mid: 缩放到2048x1024
img.resize((2048, 1024), Image.LANCZOS).save('../planets/Earth_mid.jpg', 'JPEG', quality=90)

# low: preview版缩放到512x256
img = Image.open('source/earth_surface_preview.jpg')
img.resize((512, 256), Image.LANCZOS).save('../planets/Earth_low.jpg', 'JPEG', quality=90)
```

### 冥王星
```python
from PIL import Image

# high: PNG无损原尺寸
img = Image.open('source/pluto_surface_equirectangular.png').convert('RGB')
img.save('../planets/Pluto_high.jpg', 'JPEG', quality=95)

# mid: 缩放到2048x1024
img.resize((2048, 1024), Image.LANCZOS).save('../planets/Pluto_mid.jpg', 'JPEG', quality=90)

# low: preview版缩放到512x256
img = Image.open('source/pluto_surface_preview.jpg')
img.resize((512, 256), Image.LANCZOS).save('../planets/Pluto_low.jpg', 'JPEG', quality=90)
```

## JS中的LOD切换逻辑

在 `solar-system.js` 动画循环中，根据摄像机距离自动切换：
- **远距离** (>80单位): `_low.jpg` (512×256)
- **中距离** (20-80): `_mid.jpg` (2048×1024)
- **近距离** (<20): `_high.jpg` (8192×4096)
