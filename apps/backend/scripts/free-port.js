const { execSync } = require('child_process');
const port = process.argv[2] || 4000;

try {
  if (process.platform === 'win32') {
    const cmd = 'powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ' + port + ' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"';
    const out = execSync(cmd).toString().trim();
    if (out) {
      const pids = out.split(/\r?\n/).map(p => p.trim()).filter(Boolean);
      for (const pid of pids) {
        if (pid && pid !== '0' && pid !== String(process.pid)) {
          try { process.kill(Number(pid)); } catch (e) {
            try { execSync('taskkill /F /PID ' + pid + ' 2>nul', { shell: true }); } catch {}
          }
        }
      }
    }
  } else {
    try { execSync('lsof -ti:' + port + ' | xargs kill -9 2>/dev/null', { shell: true }); } catch {}
  }
} catch (e) {}
