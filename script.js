const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// UI Elements
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const finalScoreEl = document.getElementById('final-score');

// Game Config
const TILE_SIZE = 20; // Size of grid squares
const GAME_SPEED = 100; // ms per frame (lower is faster)
let tileCountX = 20;
let tileCountY = 20;

// State
let score = 0;
let highScore = localStorage.getItem('neon-snake-high-score') || 0;
let gameInterval;
let isPlaying = false;
let isPaused = false;

// Snake & Food
let snake = [];
let velocity = { x: 0, y: 0 };
let nextVelocity = { x: 0, y: 0 }; // Buffer for next input to prevent reversing instantly
let food = { x: 10, y: 10 };
let particles = []; // Array for explosion effects

// Colors
const COLOR_PRIMARY = '#00ff88';
const COLOR_SECONDARY = '#00d4ff';
const COLOR_DANGER = '#ff0055';

// Initialize
function init() {
    highScoreEl.innerText = highScore;
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', startGame);
    document.addEventListener('keydown', handleInput);
    
    // Touch controls (simple swipe)
    let touchStartX = 0;
    let touchStartY = 0;
    
    document.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, {passive: false});
    
    document.addEventListener('touchend', e => {
        if (!isPlaying) return;
        
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        
        const dx = touchEndX - touchStartX;
        const dy = touchEndY - touchStartY;
        
        if (Math.abs(dx) > Math.abs(dy)) {
            // Horizontal
            if (dx > 0 && velocity.x === 0) nextVelocity = { x: 1, y: 0 };
            else if (dx < 0 && velocity.x === 0) nextVelocity = { x: -1, y: 0 };
        } else {
            // Vertical
            if (dy > 0 && velocity.y === 0) nextVelocity = { x: 0, y: 1 };
            else if (dy < 0 && velocity.y === 0) nextVelocity = { x: 0, y: -1 };
        }
    }, {passive: false});
}

function resizeCanvas() {
    // Calculate max tiles based on window size to keep them square and fit
    const margin = 40; // Safety margin
    const availableWidth = window.innerWidth - margin;
    const availableHeight = window.innerHeight - margin;
    
    // Ensure multiples of TILE_SIZE
    const cols = Math.floor(availableWidth / TILE_SIZE);
    const rows = Math.floor(availableHeight / TILE_SIZE);
    
    tileCountX = cols > 10 ? cols : 10;
    tileCountY = rows > 10 ? rows : 10;
    
    canvas.width = tileCountX * TILE_SIZE;
    canvas.height = tileCountY * TILE_SIZE;
    
    // Position canvas to look nice
    canvas.style.top = `${(window.innerHeight - canvas.height) / 2}px`;
    canvas.style.left = `${(window.innerWidth - canvas.width) / 2}px`;
    canvas.style.position = 'absolute';
    
    // If resizing during game, we might need to clamp snake/food positions? 
    // For simplicity, we just let them go off screen or wrap around visually, 
    // logic waits for game over or restart.
}

function startGame() {
    score = 0;
    scoreEl.innerText = score;
    
    // Init Snake
    const startX = Math.floor(tileCountX / 2);
    const startY = Math.floor(tileCountY / 2);
    snake = [
        { x: startX, y: startY },
        { x: startX, y: startY + 1 },
        { x: startX, y: startY + 2 }
    ];
    
    velocity = { x: 0, y: -1 }; // Start moving up
    nextVelocity = { x: 0, y: -1 };
    
    placeFood();
    particles = [];
    
    isPlaying = true;
    startScreen.classList.remove('active');
    startScreen.classList.add('hidden');
    gameOverScreen.classList.remove('active');
    gameOverScreen.classList.add('hidden');
    
    if (gameInterval) clearInterval(gameInterval);
    gameInterval = setInterval(gameLoop, GAME_SPEED);
    
    draw(); // Draw immediately
}

function gameOver() {
    isPlaying = false;
    clearInterval(gameInterval);
    
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('neon-snake-high-score', highScore);
        highScoreEl.innerText = highScore;
    }
    
    finalScoreEl.innerText = `Score: ${score}`;
    gameOverScreen.classList.remove('hidden');
    gameOverScreen.classList.add('active');
}

function handleInput(e) {
    // Prevent default scrolling for arrow keys
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].indexOf(e.code) > -1) {
        e.preventDefault();
    }

    if (!isPlaying && (e.code === 'Space' || e.code === 'Enter') && startScreen.classList.contains('active')) {
        startGame();
        return;
    }
    
    if (!isPlaying && (e.code === 'Space' || e.code === 'Enter') && gameOverScreen.classList.contains('active')) {
        startGame();
        return;
    }

    switch(e.key) {
        case 'ArrowUp':
            if (velocity.y !== 1) nextVelocity = { x: 0, y: -1 };
            break;
        case 'ArrowDown':
            if (velocity.y !== -1) nextVelocity = { x: 0, y: 1 };
            break;
        case 'ArrowLeft':
            if (velocity.x !== 1) nextVelocity = { x: -1, y: 0 };
            break;
        case 'ArrowRight':
            if (velocity.x !== -1) nextVelocity = { x: 1, y: 0 };
            break;
    }
}

function gameLoop() {
    update();
    draw();
}

function update() {
    // Apply input buffer
    velocity = { ...nextVelocity };
    
    // Move head
    const head = { x: snake[0].x + velocity.x, y: snake[0].y + velocity.y };
    
    // Collision Walls (Wrap around or Die? Let's die for classic feel, or Wrap? 
    // Plan Implementation says "Collision", let's do wall death for challenge)
    if (head.x < 0 || head.x >= tileCountX || head.y < 0 || head.y >= tileCountY) {
        gameOver();
        createExplosion(snake[0].x * TILE_SIZE + TILE_SIZE/2, snake[0].y * TILE_SIZE + TILE_SIZE/2, COLOR_DANGER);
        return;
    }
    
    // Collision Self
    for (let i = 0; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            gameOver();
            createExplosion(head.x * TILE_SIZE + TILE_SIZE/2, head.y * TILE_SIZE + TILE_SIZE/2, COLOR_DANGER);
            return;
        }
    }
    
    snake.unshift(head); // Add new head
    
    // Eat Food
    if (head.x === food.x && head.y === food.y) {
        score += 10;
        scoreEl.innerText = score;
        createExplosion(head.x * TILE_SIZE + TILE_SIZE/2, head.y * TILE_SIZE + TILE_SIZE/2, COLOR_SECONDARY);
        placeFood();
        // Don't pop tail, so we grow
    } else {
        snake.pop(); // Remove tail
    }
    
    updateParticles();
}

function placeFood() {
    // Random position not on snake
    let valid = false;
    while (!valid) {
        food.x = Math.floor(Math.random() * tileCountX);
        food.y = Math.floor(Math.random() * tileCountY);
        
        valid = true;
        for (let part of snake) {
            if (part.x === food.x && part.y === food.y) {
                valid = false;
                break;
            }
        }
    }
}

function createExplosion(x, y, color) {
    for (let i = 0; i < 10; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            life: 1.0,
            color: color
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function draw() {
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background grid (optional subtle effect, handled in CSS mostly but can add extra glow here)
    
    // Draw particles
    for (let p of particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
    
    // Draw Food
    const cx = food.x * TILE_SIZE + TILE_SIZE / 2;
    const cy = food.y * TILE_SIZE + TILE_SIZE / 2;
    const pulse = Math.sin(Date.now() / 200) * 3; // Breathing effect
    
    ctx.shadowBlur = 15;
    ctx.shadowColor = COLOR_SECONDARY;
    ctx.fillStyle = COLOR_SECONDARY;
    ctx.beginPath();
    ctx.arc(cx, cy, (TILE_SIZE / 2 - 2) + pulse * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Draw Snake
    snake.forEach((part, index) => {
        const x = part.x * TILE_SIZE;
        const y = part.y * TILE_SIZE;
        
        // Head
        if (index === 0) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = COLOR_PRIMARY;
            ctx.fillStyle = '#fff'; // Bright center for head
        } else {
            ctx.shadowBlur = 0;
            ctx.fillStyle = COLOR_PRIMARY;
        }
        
        // Slightly smaller than tile for segmented look
        const size = TILE_SIZE - 2;
        const offset = 1;
        
        // Round rect for nicer look
        ctx.beginPath();
        ctx.roundRect(x + offset, y + offset, size, size, 4);
        ctx.fill();
        
        // Eye (on head)
        if (index === 0) {
           // Maybe add eyes later if direction matters visually
        }
    });
}

// Start
init();
