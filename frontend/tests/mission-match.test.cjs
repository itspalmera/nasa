const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/services/api.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

for (const [pillar, expected] of [
  ['all', 'todos'], ['prevention', 'prevencion'],
  ['detection', 'deteccion'], ['suppression', 'supresion'],
  ['prevencion', 'prevencion'], [undefined, undefined],
]) {
  test(`mission ranking sends backend units and pillar ${pillar}`, async () => {
    const exports = {};
    const result = { ranking: [{ investigation_id: 'example', relevance_score: 90 }] };
    let request;
    vm.runInNewContext(compiled, {
      exports, console,
      fetch: async (url, options) => {
        request = { url, ...options };
        return { ok: true, json: async () => result };
      },
    });
    assert.equal(await exports.fetchMissionMatch({
      o2: 30, pressure_psi: 10.2, flow: 10, gravity: 0.167, selected_pillar: pillar,
    }), result);
    assert.equal(request.url, '/api/motor1/match');
    assert.equal(request.method, 'POST');
    const body = JSON.parse(request.body);
    assert.ok(Math.abs(body.pressure - 70.326552) < 1e-6);
    assert.equal(body.pressure_psi, undefined);
    assert.equal(body.selected_pillar, expected);
    assert.equal(body.o2, 30);
    assert.equal(body.flow, 10);
    assert.equal(body.gravity, 0.167);
  });
}
