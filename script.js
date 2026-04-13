// Procedural Audio Engine setup
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playSplat() {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const bufferSize = audioCtx.sampleRate * 0.05; 
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1; // pure noise
    }
    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = buffer;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.05);
    
    // Much louder impact sound
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0.7, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    
    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    noiseSource.start();
}

function playConfettiSound() {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    // A quick triumphant fanfare chord
    const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    freqs.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        osc.type = 'sine'; 
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.08); 
        
        const gainNode = audioCtx.createGain();
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + i * 0.08 + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.08 + 1);
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + i * 0.08);
        osc.stop(audioCtx.currentTime + i * 0.08 + 1);
    });
}

// Setup Matter.js Variables
const Engine = Matter.Engine,
      Runner = Matter.Runner,
      Bodies = Matter.Bodies,
      Composite = Matter.Composite,
      Events = Matter.Events,
      Body = Matter.Body,
      Mouse = Matter.Mouse,
      MouseConstraint = Matter.MouseConstraint;

const engine = Engine.create();
const world = engine.world;

let ground, leftWall, rightWall;

function createBounds() {
    if (ground) Composite.remove(world, [ground, leftWall, rightWall]);
    const width = window.innerWidth;
    const height = window.innerHeight;
    ground = Bodies.rectangle(width / 2, height + 50, width * 2, 100, { isStatic: true });
    leftWall = Bodies.rectangle(-50, height / 2, 100, height * 2, { isStatic: true });
    rightWall = Bodies.rectangle(width + 50, height / 2, 100, height * 2, { isStatic: true });
    Composite.add(world, [ground, leftWall, rightWall]);
}

createBounds();
window.addEventListener('resize', createBounds);

const runner = Runner.create();
Runner.run(runner, engine);

// Add Mouse Constraint so Bananas can be dragged!
const mouse = Mouse.create(document.body);
const mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: {
        stiffness: 0.2,
        render: { visible: false }
    }
});
Composite.add(world, mouseConstraint);

Events.on(mouseConstraint, 'startdrag', function(event) {
    if (event.body && event.body.isInteractable === false) {
        mouseConstraint.body = null;
    }
});

const bananas = [];
let spawnCount = 0;
const counterElement = document.getElementById('counter');

let currentMultiplier = 1;
document.querySelectorAll('.multiplier-btn').forEach(btn => {
    const setMult = (e) => {
        e.stopPropagation();
        document.querySelectorAll('.multiplier-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentMultiplier = parseInt(btn.getAttribute('data-mult'));
    };
    btn.addEventListener('mousedown', setMult);
    btn.addEventListener('touchstart', setMult, { passive: false });
});

let currentLifetime = 30; // seconds
document.querySelectorAll('.lifetime-btn').forEach(btn => {
    const setLife = (e) => {
        e.stopPropagation();
        document.querySelectorAll('.lifetime-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentLifetime = parseInt(btn.getAttribute('data-life'));
    };
    btn.addEventListener('mousedown', setLife);
    btn.addEventListener('touchstart', setLife, { passive: false });
});

// Clear All button
const clearBtn = document.getElementById('clear-btn');
function clearAllBananas(e) {
    if (e) e.stopPropagation();
    for (let i = bananas.length - 1; i >= 0; i--) {
        Composite.remove(world, bananas[i].body);
        bananas[i].element.remove();
    }
    bananas.length = 0;
}
clearBtn.addEventListener('mousedown', clearAllBananas);
clearBtn.addEventListener('touchstart', clearAllBananas, { passive: false });

// Changed from click to mousedown so it feels instananeous, and ignores if clicking an existing banana
document.addEventListener('mousedown', (e) => {
    if (e.target.closest('.multiplier-menu') || e.target.closest('.lifetime-menu') || e.target.closest('.clear-btn')) return;
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    // Query bodies under mouse to see if we are trying to drag one
    const bodies = Matter.Query.point(Composite.allBodies(world), { x: e.clientX, y: e.clientY });
    // Only grab interactable bananas
    const clickables = bodies.filter(b => b.isBanana && b.isInteractable !== false);
    if (clickables.length > 0) return; 
    
    for (let i = 0; i < currentMultiplier; i++) {
        const offset = currentMultiplier > 1 ? (Math.random() - 0.5) * 40 : 0;
        createBanana(e.clientX + offset, e.clientY + offset);
    }
});

document.addEventListener('touchstart', (e) => {
    if (e.target.closest('.multiplier-menu') || e.target.closest('.lifetime-menu') || e.target.closest('.clear-btn')) return;
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    let spawned = false;
    for(let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const bodies = Matter.Query.point(Composite.allBodies(world), { x: touch.clientX, y: touch.clientY });
        const clickables = bodies.filter(b => b.isBanana && b.isInteractable !== false);
        if (clickables.length === 0) {
            for (let j = 0; j < currentMultiplier; j++) {
                const offset = currentMultiplier > 1 ? (Math.random() - 0.5) * 40 : 0;
                createBanana(touch.clientX + offset, touch.clientY + offset);
            }
            spawned = true;
        }
    }
    if (spawned) e.preventDefault(); 
}, { passive: false });

Events.on(engine, 'collisionStart', function(event) {
    const pairs = event.pairs;
    for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        
        // Trigger sound only on first landing
        if (pair.bodyA.isBanana && !pair.bodyA.hasLanded) {
            pair.bodyA.hasLanded = true;
            playSplat();
        }
        if (pair.bodyB.isBanana && !pair.bodyB.hasLanded) {
            pair.bodyB.hasLanded = true;
            playSplat();
        }
    }
});

const variants = [
    { text: '🍌', filter: 'none' }, 
    { text: '🍌', filter: 'hue-rotate(-40deg) saturate(1.5)' }, // Greenish
    { text: '🍌', filter: 'sepia(1) hue-rotate(-50deg) saturate(2) brightness(0.8)' } // Brownish
];
const bananaSplitText = '🍨';

function createBanana(x, y) {
    spawnCount++;
    if(counterElement) {
        counterElement.textContent = `Spawned: ${spawnCount}`;
    }

    const isGolden = Math.random() < 0.01; // rare 1 in 100!
    // If not golden, evaluate if it's a split
    const isSplit = !isGolden && Math.random() < 0.05; 
    
    // Physics
    const size = isGolden ? 120 : (isSplit ? 150 : 100);
    const body = Bodies.circle(x, y, size * 0.4, {
        restitution: 0.6,
        friction: 0.2,
        density: 0.001
    });

    body.isBanana = true;
    body.hasLanded = false;
    body.isInteractable = false;

    // Become interactable after 250ms (prevents accidently grabbing during spam-clicks)
    setTimeout(() => {
        if(body) body.isInteractable = true;
    }, 250);

    Body.setVelocity(body, {
        x: (Math.random() - 0.5) * 15,
        y: - (Math.random() * 10 + 15)
    });
    Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.4);

    const wrapper = document.createElement('div');
    wrapper.classList.add('banana-wrapper');
    const banana = document.createElement('div');
    banana.classList.add('banana');
    
    if (isGolden) {
        banana.textContent = '🍌✨';
        banana.style.fontSize = '7rem';
        // Extreme performant bloom for golden element
        banana.style.textShadow = '0 0 20px #fceb92, 0 0 50px #ffdf00, 0 0 80px #ffdf00';
        
        // Trigger celebration effects directly
        if (typeof confetti !== 'undefined') {
            confetti({
                particleCount: 150,
                spread: 100,
                origin: { x: x / window.innerWidth, y: y / window.innerHeight },
                zIndex: 100
            });
        }
        playConfettiSound();
    } else if (isSplit) {
        banana.textContent = bananaSplitText;
        banana.style.fontSize = '8rem';
    } else {
        const variant = variants[Math.floor(Math.random() * variants.length)];
        banana.textContent = variant.text;
        // Apply varying filter
        banana.style.filter = variant.filter;
        banana.style.fontSize = '5rem';
    }
    
    banana.style.transform = 'scale(0)';
    banana.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.5s ease';
    setTimeout(() => { banana.style.transform = 'scale(1)'; }, 10);
    
    wrapper.appendChild(banana);
    document.body.appendChild(wrapper);
    Composite.add(world, body);
    
    const bananaData = {
        body: body,
        element: wrapper,
        inner: banana,
        createdAt: Date.now()
    };
    bananas.push(bananaData);

    // Use the current lifetime setting at the time of spawn
    const lifetime = currentLifetime * 1000;
    setTimeout(() => {
        banana.style.opacity = '0';
        setTimeout(() => {
            Composite.remove(world, body);
            wrapper.remove();
            const index = bananas.indexOf(bananaData);
            if (index > -1) {
                bananas.splice(index, 1);
            }
        }, 500); 
    }, lifetime); 
}

Events.on(engine, 'afterUpdate', function() {
    for (let i = 0; i < bananas.length; i++) {
        const bd = bananas[i];
        const pos = bd.body.position;
        const angle = bd.body.angle;
        bd.element.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%) rotate(${angle}rad)`;
    }
});
