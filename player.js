import { StemEngine } from './audio-engine.js';
const tracks = [
  {glyph:'LI',file:'bass grunge.mp3',name:'Bass',left:275,right:510},
  {glyph:'B',file:'drums1 and organ.mp3',name:'Drums + organ',left:510,right:650},
  {glyph:'E',file:'drums 2.mp3',name:'Drums 2',left:650,right:790},
  {glyph:'R',file:'Conga.mp3',name:'Conga',left:790,right:950},
  {glyph:'A',file:'Acoustic Guitar.mp3',name:'Acoustic guitar',left:950,right:1108},
  {glyph:'N',file:'Elect Guitars.mp3',name:'Electric guitars',left:1108,right:1320},
  {glyph:'D',file:'banjo fiddle.mp3',name:'Banjo + fiddle',left:1320,right:1460},
  {glyph:'O',file:'harmonies.mp3',name:'Harmonies',left:1460,right:1637},
  {glyph:'S',file:'Lead Vox.mp3',name:'Lead vocal',left:1637,right:1770}
];
const engine = new StemEngine(), selected = tracks.map(() => false);
const status = document.querySelector('#status'), state = document.querySelector('#state');
const transport = document.querySelector('#transport'), retry = document.querySelector('#retry');
let busy = false, failed = false, loaded = 0;
const buttons = tracks.map((track, i) => {
  const button = document.createElement('button');
  button.className = 'glyph'; button.type = 'button';
  button.setAttribute('aria-label', `${track.glyph} — ${track.name}`);
  button.setAttribute('aria-pressed', 'false');
  button.style.cssText = `--width:${track.right-track.left};--drift:${i%2?2:-2}px;--delay:-${i*.7}s`;
  const scale = 2700/2048;
  button.innerHTML = `<svg viewBox="${track.left*scale} ${280*scale} ${(track.right-track.left)*scale} ${310*scale}" aria-hidden="true"><defs><clipPath id="crop-${i}"><rect x="${track.left*scale}" y="${280*scale}" width="${(track.right-track.left)*scale}" height="${310*scale}"/></clipPath></defs><image href="assets/logo.png" width="2700" height="1150" clip-path="url(#crop-${i})"/></svg><span class="channel" aria-hidden="true">0${i+1}</span>`;
  button.addEventListener('click', () => {
    selected[i] = !selected[i];
    engine.setChannel(i, selected[i]);
    render();
    start();
  });
  document.querySelector('#glyphs').append(button);
  const indicator = document.createElement('i'); document.querySelector('#indicators').append(indicator);
  return button;
});
function render() {
  const count = selected.filter(Boolean).length;
  buttons.forEach((b,i) => b.setAttribute('aria-pressed', String(selected[i])));
  [...document.querySelector('#indicators').children].forEach((b,i) => b.classList.toggle('on',selected[i]));
  document.body.classList.toggle('complete', count === 9 && engine.ready);
  status.textContent = failed ? 'CONNECTION LOST' : busy ? `ACQUIRING SIGNAL · ${loaded}/9` : count === 9 && engine.ready ? 'SIGNAL RECOVERED' : `${count}/9 CHANNELS RECOVERED`;
  retry.hidden = !failed;
  transport.hidden = !engine.ready;
  const running = engine.context?.state === 'running';
  transport.textContent = running ? 'PAUSE' : 'RESUME';
  transport.setAttribute('aria-label', running ? 'Pause all audio' : 'Resume all audio');
  state.textContent = failed ? 'RECONNECT TO CONTINUE' : busy ? 'ESTABLISHING CONTACT' : !engine.ready ? 'AWAITING CONTACT' : running ? 'SIGNAL IN PROGRESS' : 'SIGNAL SUSPENDED';
}
async function start() {
  // Call resume synchronously from the click, before awaiting network/decode.
  try {
    const resumed = engine.unlock();
    engine.context.onstatechange = render;
    if (busy) { await resumed; return; }
    if (engine.ready) { await resumed; render(); return; }
    busy = true; failed = false; loaded = 0; render();
    await Promise.all([resumed, engine.load(tracks, n => { loaded=n; render(); })]);
    selected.forEach((on,i) => engine.setChannel(i,on));
  } catch (error) { failed = true; console.error(error); }
  finally { busy = Boolean(engine.loading); render(); }
}
retry.addEventListener('click', start);
transport.addEventListener('click', async () => {
  try { if (engine.context.state === 'running') await engine.pause(); else await engine.unlock(); }
  catch (error) { console.error(error); failed = true; }
  render();
});
// Read-only diagnostics for local verification; no user data is collected.
window.playerDiagnostics = () => ({ready:engine.ready, channels:selected.slice(), contextState:engine.context?.state, loopDuration:engine.loopDuration, decodedDuration:engine.decodedDuration, startTime:engine.startTime, masterGain:engine.master?.gain.value, sourceCount:engine.sources.length});

// A reminder, not a silent-switch detector. A real tap unlocks mobile audio.
const soundIntro = document.querySelector('#sound-intro');
const mobileScreen = matchMedia('(max-width: 700px), (pointer: coarse) and (max-height: 500px)');
let enteredSignal = false;
function updateSoundIntro() {
  if (mobileScreen.matches && !enteredSignal) {
    if (!soundIntro.open) soundIntro.showModal();
  } else if (soundIntro.open) soundIntro.close();
}
soundIntro.addEventListener('cancel', event => event.preventDefault());
document.querySelector('#enter-signal').addEventListener('click', () => {
  enteredSignal = true;
  soundIntro.close();
  start();
  buttons[0].focus({preventScroll:true});
});
mobileScreen.addEventListener('change', updateSoundIntro);
updateSoundIntro();
