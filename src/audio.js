export function createAudio() {
  let context, master, engine, gain, filter, boost, boostGain;
  let muted = false;
  function unlock() {
    if (!context) {
      context = new (window.AudioContext || window.webkitAudioContext)();
      master=context.createGain();master.gain.value=muted?0:.16;master.connect(context.destination);
      engine=context.createOscillator();engine.type='sawtooth';
      filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=400;
      gain=context.createGain();gain.gain.value=0;engine.connect(filter).connect(gain).connect(master);engine.start();
      const noise=context.createBuffer(1,context.sampleRate,context.sampleRate);const channel=noise.getChannelData(0);
      for(let i=0;i<channel.length;i++)channel[i]=Math.sin(i*127.1+Math.sin(i*3.12)*22);
      boost=context.createBufferSource();boost.buffer=noise;boost.loop=true;
      const hp=context.createBiquadFilter();hp.type='highpass';hp.frequency.value=2200;
      boostGain=context.createGain();boostGain.gain.value=0;boost.connect(hp).connect(boostGain).connect(master);boost.start();
    }
    if(context.state==='suspended')void context.resume();
  }
  function tone(frequency,duration=.1,type='sine',level=.3) {
    if(!context||context.state!=='running')return;
    const o=context.createOscillator(),g=context.createGain(),t=context.currentTime;
    o.type=type;o.frequency.setValueAtTime(frequency,t);g.gain.setValueAtTime(level,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g).connect(master);o.start(t);o.stop(t+duration);
  }
  return {
    unlock,
    mute(value){muted=value;if(master)master.gain.setTargetAtTime(muted?0:.16,context.currentTime,.03);},
    update(speed,nitro,active){if(!context)return;const t=context.currentTime;engine.frequency.setTargetAtTime(35+speed*5.8,t,.07);filter.frequency.setTargetAtTime(190+speed*32,t,.1);gain.gain.setTargetAtTime(active?.20+speed*.004:0,t,.07);boostGain.gain.setTargetAtTime(active&&nitro?.45:0,t,.06);},
    event(name){if(name==='go')tone(880,.3,'square',.18);if(name==='tick')tone(440,.09,'square',.13);if(name==='scrape')tone(95,.18,'sawtooth',.4);if(name==='crash')tone(65,.7,'sawtooth',.4);if(name==='finish'){tone(660,.6,'triangle');setTimeout(()=>tone(880,.6,'triangle'),150);setTimeout(()=>tone(1320,.7,'triangle'),300);}},
  };
}
