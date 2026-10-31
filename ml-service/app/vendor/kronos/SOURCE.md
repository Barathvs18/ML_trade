# Kronos vendored source

Source: https://github.com/shiyu-coder/Kronos

Pinned upstream commit: `67b630e67f6a18c9e9be918d9b4337c960db1e9a`.

The `model/kronos.py` and `model/module.py` implementation files are vendored
under the upstream MIT license in `LICENSE`. The only source adaptation is the
package-relative import (`from .module import *`) in `kronos.py`; the upstream
relative path manipulation was removed so this code can be imported safely as
`app.vendor.kronos`.
