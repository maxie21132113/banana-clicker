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

// ===== MODE SYSTEM =====
let currentMode = 'normal';
let ground, leftWall, rightWall, ceiling;

function createBounds() {
    // Remove old bounds
    const toRemove = [ground, leftWall, rightWall, ceiling].filter(Boolean);
    if (toRemove.length) Composite.remove(world, toRemove);
    
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    leftWall = Bodies.rectangle(-50, height / 2, 100, height * 2, { isStatic: true });
    rightWall = Bodies.rectangle(width + 50, height / 2, 100, height * 2, { isStatic: true });
    
    if (currentMode === 'freefall' || currentMode === 'gravmouse') {
        // No floor or ceiling
        ground = null;
        ceiling = null;
        Composite.add(world, [leftWall, rightWall]);
    } else if (currentMode === 'volcano') {
        // Floor but no ceiling (bananas fly upward out)
        ground = Bodies.rectangle(width / 2, height + 50, width * 2, 100, { isStatic: true });
        ceiling = null;
        Composite.add(world, [ground, leftWall, rightWall]);
    } else if (currentMode === 'zerograv') {
        // All four walls so bananas bounce around
        ground = Bodies.rectangle(width / 2, height + 50, width * 2, 100, { isStatic: true });
        ceiling = Bodies.rectangle(width / 2, -50, width * 2, 100, { isStatic: true });
        Composite.add(world, [ground, leftWall, rightWall, ceiling]);
    } else {
        // Normal mode — floor + side walls
        ground = Bodies.rectangle(width / 2, height + 50, width * 2, 100, { isStatic: true });
        ceiling = null;
        Composite.add(world, [ground, leftWall, rightWall]);
    }
}

function applyModePhysics() {
    if (currentMode === 'zerograv') {
        engine.gravity.x = 0;
        engine.gravity.y = 0;
    } else if (currentMode === 'volcano') {
        engine.gravity.x = 0;
        engine.gravity.y = -1; // reversed gravity
    } else if (currentMode === 'gravmouse') {
        engine.gravity.x = 0;
        engine.gravity.y = 0.2; // very light downward (so they drift slowly without mouse)
    } else {
        // Normal + Freefall use standard gravity
        engine.gravity.x = 0;
        engine.gravity.y = 1;
    }
}

function setMode(mode) {
    currentMode = mode;
    createBounds();
    applyModePhysics();
}

createBounds();
applyModePhysics();
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

// ===== GRAVITY MOUSE TRACKING =====
let gravMousePos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let gravMouseActive = false; // For mobile: only active while touching

document.addEventListener('mousemove', (e) => {
    gravMousePos.x = e.clientX;
    gravMousePos.y = e.clientY;
});

// On desktop, mouse gravity is always active when in gravmouse mode
document.addEventListener('mouseenter', () => { if (currentMode === 'gravmouse') gravMouseActive = true; });
document.addEventListener('mouseleave', () => { gravMouseActive = false; });
// Always active on desktop when mouse is present
document.addEventListener('mousemove', () => { if (currentMode === 'gravmouse') gravMouseActive = true; });

// On mobile, only active while finger is held down
document.addEventListener('touchstart', (e) => {
    if (currentMode === 'gravmouse') {
        gravMouseActive = true;
        const touch = e.touches[0];
        if (touch) {
            gravMousePos.x = touch.clientX;
            gravMousePos.y = touch.clientY;
        }
    }
}, { passive: true });

document.addEventListener('touchmove', (e) => {
    if (currentMode === 'gravmouse') {
        const touch = e.touches[0];
        if (touch) {
            gravMousePos.x = touch.clientX;
            gravMousePos.y = touch.clientY;
        }
    }
}, { passive: true });

document.addEventListener('touchend', () => {
    gravMouseActive = false;
});

document.addEventListener('touchcancel', () => {
    gravMouseActive = false;
});

// ===== MODE BUTTONS =====
document.querySelectorAll('.mode-btn').forEach(btn => {
    const setModeBtn = (e) => {
        e.stopPropagation();
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        setMode(btn.getAttribute('data-mode'));
    };
    btn.addEventListener('mousedown', setModeBtn);
    btn.addEventListener('touchstart', setModeBtn, { passive: false });
});

// ===== MULTIPLIER BUTTONS =====
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

// ===== LIFETIME BUTTONS =====
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

// ===== CLEAR BUTTON =====
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

// ===== SCOREBOARD SYSTEM =====
let playerName = localStorage.getItem('bananaPlayerName') || '';
const nameModal = document.getElementById('name-modal');
const nameInput = document.getElementById('player-name-input');
const nameSubmitBtn = document.getElementById('name-submit-btn');
const scoreBtn = document.getElementById('score-btn');
const scoreboardOverlay = document.getElementById('scoreboard-overlay');
const scoreboardClose = document.getElementById('scoreboard-close');
const scoreboardEntries = document.getElementById('scoreboard-entries');
const addNameInput = document.getElementById('add-name');
const addScoreInput = document.getElementById('add-score');
const addFriendBtn = document.getElementById('add-friend-btn');

// Show name modal if no name saved
if (!playerName) {
    nameModal.classList.add('active');
}

nameSubmitBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (name) {
        playerName = name;
        localStorage.setItem('bananaPlayerName', name);
        nameModal.classList.remove('active');
    }
});

nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') nameSubmitBtn.click();
});

function getScores() {
    try {
        return JSON.parse(localStorage.getItem('bananaScores') || '[]');
    } catch { return []; }
}

function saveScores(scores) {
    localStorage.setItem('bananaScores', JSON.stringify(scores));
}

function saveCurrentScore() {
    if (!playerName || spawnCount === 0) return;
    const scores = getScores();
    scores.push({ name: playerName, score: spawnCount, date: Date.now() });
    saveScores(scores);
}

function renderScoreboard() {
    const scores = getScores();
    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);
    
    if (scores.length === 0) {
        scoreboardEntries.innerHTML = '<div class="no-scores">No scores yet. Start clicking! 🍌</div>';
        return;
    }
    
    scoreboardEntries.innerHTML = scores.map((entry, i) => {
        const rankEmoji = i === 0 ? '👑' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : `${i+1}`));
        return `<div class="score-entry">
            <span class="rank">${rankEmoji}</span>
            <span class="name">${entry.name}</span>
            <span class="score">${entry.score.toLocaleString()}</span>
            <span class="delete-score" data-idx="${i}">✕</span>
        </div>`;
    }).join('');
    
    // Attach delete handlers
    scoreboardEntries.querySelectorAll('.delete-score').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.getAttribute('data-idx'));
            const sorted = getScores().sort((a, b) => b.score - a.score);
            sorted.splice(idx, 1);
            saveScores(sorted);
            renderScoreboard();
        });
    });
}

// Open / Close scoreboard
function openScoreboard(e) {
    if (e) e.stopPropagation();
    renderScoreboard();
    scoreboardOverlay.classList.add('active');
}

function closeScoreboard(e) {
    if (e) e.stopPropagation();
    scoreboardOverlay.classList.remove('active');
}

scoreBtn.addEventListener('mousedown', openScoreboard);
scoreBtn.addEventListener('touchstart', openScoreboard, { passive: false });
scoreboardClose.addEventListener('click', closeScoreboard);
scoreboardOverlay.addEventListener('click', (e) => {
    if (e.target === scoreboardOverlay) closeScoreboard();
});

// Add friend score
addFriendBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const name = addNameInput.value.trim();
    const score = parseInt(addScoreInput.value);
    if (name && score > 0) {
        const scores = getScores();
        scores.push({ name: name, score: score, date: Date.now() });
        saveScores(scores);
        addNameInput.value = '';
        addScoreInput.value = '';
        renderScoreboard();
    }
});

// Auto-save score on page unload
window.addEventListener('beforeunload', saveCurrentScore);

// ===== IGNORE UI CLICKS =====
const uiSelector = '.multiplier-menu, .lifetime-menu, .clear-btn, .mode-menu, .score-btn, .scoreboard-overlay, .name-modal';

// Changed from click to mousedown so it feels instananeous, and ignores if clicking an existing banana
document.addEventListener('mousedown', (e) => {
    if (e.target.closest(uiSelector)) return;
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
    if (e.target.closest(uiSelector)) return;
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

    // Initial velocity based on mode
    if (currentMode === 'volcano') {
        Body.setVelocity(body, {
            x: (Math.random() - 0.5) * 15,
            y: (Math.random() * 10 + 15) // upward throw (gravity is reversed)
        });
    } else if (currentMode === 'zerograv') {
        Body.setVelocity(body, {
            x: (Math.random() - 0.5) * 10,
            y: (Math.random() - 0.5) * 10
        });
    } else if (currentMode === 'gravmouse') {
        Body.setVelocity(body, {
            x: (Math.random() - 0.5) * 8,
            y: (Math.random() - 0.5) * 8
        });
    } else {
        Body.setVelocity(body, {
            x: (Math.random() - 0.5) * 15,
            y: - (Math.random() * 10 + 15)
        });
    }
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

// ===== MAIN UPDATE LOOP =====
Events.on(engine, 'afterUpdate', function() {
    const gravStrength = 0.0004;
    
    for (let i = bananas.length - 1; i >= 0; i--) {
        const bd = bananas[i];
        const pos = bd.body.position;
        const angle = bd.body.angle;
        
        // Remove bananas that have fallen off screen (freefall/volcano/gravmouse)
        if (currentMode === 'freefall' || currentMode === 'gravmouse') {
            if (pos.y > window.innerHeight + 200 || pos.y < -200) {
                Composite.remove(world, bd.body);
                bd.element.remove();
                bananas.splice(i, 1);
                continue;
            }
        } else if (currentMode === 'volcano') {
            if (pos.y < -200) {
                Composite.remove(world, bd.body);
                bd.element.remove();
                bananas.splice(i, 1);
                continue;
            }
        }
        
        // Gravity Mouse: attract bananas toward mouse/finger position
        if (currentMode === 'gravmouse' && gravMouseActive) {
            const dx = gravMousePos.x - pos.x;
            const dy = gravMousePos.y - pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 5) {
                const force = gravStrength * bd.body.mass;
                Body.applyForce(bd.body, pos, {
                    x: (dx / dist) * force,
                    y: (dy / dist) * force
                });
            }
        }
        
        bd.element.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%) rotate(${angle}rad)`;
    }
});
