import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {join} from 'node:path';

export async function chrome(directory) {
  const executable = process.env.CHROME_EXE || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome');
  if (!existsSync(executable)) throw Error('Set CHROME_EXE to a local Chrome/Chromium binary.');
  const processHandle = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-pipe', '--user-data-dir=' + join(directory, 'profile'), 'about:blank'], {windowsHide: true, stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe']});
  let sequence = 0, buffer = '', sessionId;
  const pending = new Map();
  const fail = error => { for (const task of pending.values()) task.reject(error); pending.clear(); };
  processHandle.once('error', fail);
  processHandle.once('exit', () => fail(Error('Chrome exited during browser checks.')));
  processHandle.stdio[3].on('error', fail);
  processHandle.stdio[4].on('error', fail);
  processHandle.stdio[4].on('data', chunk => {
    buffer += chunk;
    let end;
    while ((end = buffer.indexOf('\0')) !== -1) {
      const raw = buffer.slice(0, end); buffer = buffer.slice(end + 1); if (!raw) continue;
      const message = JSON.parse(raw), task = pending.get(message.id);
      if (task) { pending.delete(message.id); message.error ? task.reject(Error(message.error.message)) : task.resolve(message.result); }
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(Error('Chrome timeout: ' + method)); }, 10000);
    pending.set(id, {resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); }});
    processHandle.stdio[3].write(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}) + '\0');
  });
  const close = async () => {
    try { processHandle.stdio[3].write(JSON.stringify({id: ++sequence, method: 'Browser.close'}) + '\0'); } catch { /* Process already closed. */ }
    await new Promise(resolve => {
      if (processHandle.exitCode !== null) return resolve();
      processHandle.once('exit', resolve);
      setTimeout(() => { processHandle.kill(); resolve(); }, 2000).unref();
    });
  };
  try {
    const target = await send('Target.createTarget', {url: 'about:blank'});
    sessionId = (await send('Target.attachToTarget', {targetId: target.targetId, flatten: true})).sessionId;
  } catch (error) { await close(); throw error; }
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const until = async expression => {
    for (let index = 0; index < 100; index++) { if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 100)); }
    throw Error('Browser condition timed out: ' + expression);
  };
  return {send, evaluate, until, close};
}
