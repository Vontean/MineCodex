import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/frontend/install.mjs', import.meta.url), 'utf8');
const helper = source.slice(source.indexOf('  function prepareSelectedModelReveal('), source.indexOf('  function closeControllerModelMenu('));
function fixture({ offset = 700, zoom = 1, reduced = false, selected = true } = {}) {
  const document = new EventTarget(), frames = new Map();
  let now = 0, id = 0;
  const menu = {
    isConnected: true, scrollTop: 0, scrollHeight: 1300, clientHeight: 300, currentCSSZoom: zoom,
    getBoundingClientRect: () => ({ top: 100, bottom: 100 + 300 * zoom }),
    querySelector: selector => selector.includes('selected')
      ? selected ? { getBoundingClientRect: () => ({ top: 100 + (offset - menu.scrollTop) * zoom, bottom: 100 + (offset + 48 - menu.scrollTop) * zoom }) } : null
      : { getBoundingClientRect: () => ({ bottom: 100 + 40 * zoom }) },
  };
  const prepare = new Function('document', 'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle', 'matchMedia', 'performance', helper + ';return prepareSelectedModelReveal;')(
    document, callback => { frames.set(++id, callback); return id; }, frame => frames.delete(frame),
    () => ({paddingBottom:'6px'}), () => ({matches:reduced}), {now:()=>now},
  );
  const reveal = prepare({menu});
  const tick = time => { now = time; const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(time)); };
  return {menu, reveal, tick, frames, document};
}

test('opening starts at the top and offscreen selection moves to usable viewport center in 400ms', () => {
  for (const zoom of [1, 1.25]) {
    const f = fixture({zoom});
    assert.equal(f.menu.scrollTop, 0);
    f.reveal.finishOpening(); f.tick(320);
    f.tick(336);
    assert.ok(f.menu.scrollTop > 0 && f.menu.scrollTop < 557);
    f.tick(520);
    assert.ok(f.menu.scrollTop < 557);
    f.tick(720);
    assert.equal(f.menu.scrollTop, 557);
    assert.equal(f.frames.size, 0);
  }
});

test('a fully visible selected model stays at the top without an animation', () => {
  const f = fixture({offset:100}); f.reveal.finishOpening(); f.tick(320);
  assert.equal(f.menu.scrollTop, 0); assert.equal(f.frames.size, 0);
});

for (const type of ['wheel','touchstart','pointerdown','keydown','input','click']) {
  test(`${type} interrupts auto positioning before or during animation`, () => {
    for (const during of [false,true]) {
      const f=fixture();
      if(during){f.reveal.finishOpening();f.tick(320);f.tick(500);}
      f.document.dispatchEvent(new Event(type));
      const stopped=f.menu.scrollTop;
      if(!during)f.reveal.finishOpening();
      f.tick(1200);assert.equal(f.menu.scrollTop,stopped);assert.equal(f.frames.size,0);
    }
  });
}

test('reduced motion jumps to the centered target and close/disconnect cancel pending work', () => {
  const f=fixture({reduced:true});f.reveal.finishOpening();f.tick(320);
  assert.equal(f.menu.scrollTop,557);assert.equal(f.frames.size,0);
  for(const mode of ['close','disconnect','missing']){
    const f=fixture({selected:mode!=='missing'});f.reveal.finishOpening();f.tick(320);
    if(mode==='close')f.reveal.cancel();else if(mode==='disconnect')f.menu.isConnected=false;
    f.tick(1200);assert.equal(f.frames.size,0);
  }
});
