import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const game = new URL(process.env.GAME_URL || 'http://127.0.0.1:5189/');
game.searchParams.set('qa', '1');
const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch(existsSync(chrome) ? { executablePath: chrome, headless: true } : { channel: 'chromium', headless: true });
const errors = [];
const action = (page, key) => page.locator(`[data-online-action="${key}"]`);
const playerCount = page => page.locator('.online-players li').count();
const waitMode = (page, mode) => page.waitForFunction(value => window.__THREE_GAME_DIAGNOSTICS__?.mode === value, mode, { timeout: 40000 });

async function pilot(viewport) {
  const context = await browser.newContext({ viewport, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  return page;
}

try {
  const host = await pilot({ width: 1440, height: 900 });
  const guest = await pilot({ width: 390, height: 844 });
  await host.goto(game.href);
  await host.getByRole('button', { name: 'Multijugador' }).click();
  await host.locator('#online-name').fill('Alba');
  await action(host, 'create').click();
  await host.locator('.online-code-display').waitFor();
  const code = await host.locator('.online-code-display').textContent();
  assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/);
  await action(host, 'copy-link').click();
  await host.getByText('Invitación copiada.').waitFor();
  const invite = new URL(await host.evaluate(() => navigator.clipboard.readText()));
  assert.equal(invite.searchParams.get('sala'), code);
  invite.searchParams.set('qa', '1');
  await guest.goto(invite.href);
  assert.equal(await guest.locator('#online-code').inputValue(), code);
  await guest.locator('#online-name').fill('alba');
  await action(guest, 'join').click();
  await guest.getByRole('alert').filter({ hasText: 'apodo ya está en uso' }).waitFor();
  await guest.locator('#online-name').fill('Bruno');
  await action(guest, 'join').click();
  await guest.locator('.online-code-display').waitFor();
  assert.equal(await playerCount(guest), 2);
  assert.equal(await action(host, 'start').isDisabled(), true);
  assert.equal(await guest.locator('#online-course').isDisabled(), true);
  await host.locator('#online-course').selectOption('garage');
  await guest.waitForFunction(() => document.querySelector('#online-course').value === 'garage');
  await action(guest, 'ready').click();
  await host.waitForFunction(() => !document.querySelector('[data-online-action="start"]').disabled);
  mkdirSync('artifacts/online-qa', { recursive: true });
  await host.screenshot({ path: 'artifacts/online-qa/lobby.png' });
  await guest.screenshot({ path: 'artifacts/online-qa/mobile-lobby.png' });
  await action(host, 'start').click();
  await Promise.all([waitMode(host, 'countdown'), waitMode(guest, 'countdown')]);
  const start = page => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.online.startAt);
  assert.equal(await start(host), await start(guest));
  await host.keyboard.down('w');
  await host.keyboard.down('Shift');
  await Promise.all([waitMode(host, 'racing'), waitMode(guest, 'racing')]);
  // Let the host move ahead before the guest starts accelerating.
  await guest.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__.online.opponents > 0);
  await guest.screenshot({ path: 'artifacts/online-qa/remote-car.png' });
  await guest.keyboard.down('w');
  await host.keyboard.down('w');
  await Promise.all([host.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__.distance > 80), guest.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__.distance > 30)]);
  await host.keyboard.up('Shift');
  await Promise.all([waitMode(host, 'online'), waitMode(guest, 'online')]);
  await Promise.all([host.getByRole('heading', { name: 'Resultados' }).waitFor(), guest.getByRole('heading', { name: 'Resultados' }).waitFor()]);
  const results = page => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.online.players);
  const finished = await results(host);
  assert.ok(finished.every(player => player.status === 'finished' && player.time > 0));
  assert.deepEqual(finished, await results(guest));
  await host.screenshot({ path: 'artifacts/online-qa/results.png' });
  await action(host, 'rematch').click();
  await action(guest, 'ready').waitFor();
  assert.equal(await action(host, 'start').isDisabled(), true);
  await action(host, 'leave').click();
  await guest.locator('.online-players li').filter({ hasText: 'Bruno (tú)' }).getByText('Anfitrión', { exact: false }).waitFor();
  assert.equal(await playerCount(guest), 1);
  await action(guest, 'leave').click();
  await waitMode(guest, 'menu');
  assert.deepEqual(errors, []);
  console.log('PASS two browsers, copied invitation, duplicate name, host controls, common start, remote car, two finishes, rematch and host transfer');
  console.log(JSON.stringify(finished.map(({ name, time }) => ({ name, time }))));
} finally {
  await browser.close();
}
