const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');

let width, height;
let particles = [];
let gravitySource = null; // {x, y, strength}

// Configuration
const particleCount = 1200;
const mouseDistance = 100;

// Resize handling
function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
}

window.addEventListener('resize', resize);

resize();

// Mouse tracking
let mouse = { x: null, y: null };
window.addEventListener('mousemove', (e) => {
    mouse.x = e.x;
    mouse.y = e.y;
});

// Particle Class
class Particle {
    constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.3;
        this.vy = (Math.random() - 0.5) * 0.3;
        // Very small particles for "dust" effect
        this.size = Math.random() * 0.8 + 0.1;
        this.baseAlpha = Math.random() * 0.3 + 0.4;
        this.alpha = this.baseAlpha;
    }

    update() {
        // Normal Random Movement (Always apply slightly to keep them alive)
        this.vx += (Math.random() - 0.5) * 0.02;
        this.vy += (Math.random() - 0.5) * 0.02;

        // Gravity/Repulsion Effect
        if (gravitySource) {
            const gravityY = gravitySource.y - window.scrollY;
            const dx = gravitySource.x - this.x;
            const dy = gravityY - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Apply force
            if (dist > 10) {
                const forceMagnitude = 0.05 * (gravitySource.strength || 1);

                if (gravitySource.strength < 0) {
                    // Repulsion
                    if (dist < 250) { // Increased range for better effect
                        this.vx -= (dx / dist) * Math.abs(forceMagnitude) * 5;
                        this.vy -= (dy / dist) * Math.abs(forceMagnitude) * 5;
                    }
                } else {
                    // Attraction
                    this.vx += (dx / dist) * forceMagnitude;
                    this.vy += (dy / dist) * forceMagnitude;
                }
            }
        }

        // Limit speed
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const maxSpeed = gravitySource ? 3 : 1; // Allow faster movement when interacting
        if (speed > maxSpeed) {
            this.vx = (this.vx / speed) * maxSpeed;
            this.vy = (this.vy / speed) * maxSpeed;
        }

        // Dampen velocity
        if (gravitySource) {
            this.vx *= 0.95; // Strong friction during interaction to prevent chaos
            this.vy *= 0.95;
        } else {
            this.vx *= 0.99; // Very slight friction for natural float
            this.vy *= 0.99;
        }

        this.x += this.vx;
        this.y += this.vy;

        // Wrap around
        if (this.x < 0) this.x = width;
        if (this.x > width) this.x = 0;
        if (this.y < 0) this.y = height;
        if (this.y > height) this.y = 0;

        // Mouse Repel (override gravity locally)
        if (mouse.x != null) {
            let dx = mouse.x - this.x;
            let dy = mouse.y - this.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < mouseDistance) {
                const force = (mouseDistance - dist) / mouseDistance;
                this.x -= (dx / dist) * force * 2;
                this.y -= (dy / dist) * force * 2;
            }
        }
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 0, 0, ${this.alpha})`;
        ctx.fill();
    }
}

function init() {
    particles = [];
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }
}

function animate() {
    requestAnimationFrame(animate);
    ctx.clearRect(0, 0, width, height);
    particles.forEach(p => {
        p.update();
        p.draw();
    });
}

init();

// Hero Text Emitter Logic
const heroText = document.querySelector('.hero-name');
let heroTextRect = null;

function updateHeroTextRect() {
    if (heroText) {
        const rect = heroText.getBoundingClientRect();
        heroTextRect = {
            x: rect.left,
            y: rect.top, // Use client coordinates since canvas is fixed
            width: rect.width,
            height: rect.height
        };
    }
}

window.addEventListener('resize', updateHeroTextRect);
window.addEventListener('scroll', updateHeroTextRect);
updateHeroTextRect();

function animate() {
    requestAnimationFrame(animate);
    ctx.clearRect(0, 0, width, height);

    // Bleeding Effect: Respawn a few particles at the text every frame
    if (heroTextRect) {
        for (let i = 0; i < 5; i++) { // Emit 5 particles per frame
            const p = particles[Math.floor(Math.random() * particles.length)];
            p.x = heroTextRect.x + Math.random() * heroTextRect.width;
            p.y = heroTextRect.y + Math.random() * heroTextRect.height;
            // Give them a random outward velocity
            p.vx = (Math.random() - 0.5) * 2;
            p.vy = (Math.random() - 0.5) * 2;
            p.alpha = 1; // Start fully visible
        }
    }

    particles.forEach(p => {
        p.update();
        p.draw();
    });
}

animate();

// Gravity Button Logic
const gravityBtn = document.getElementById('view-projects-btn');
if (gravityBtn) {
    gravityBtn.addEventListener('mouseenter', () => {
        const rect = gravityBtn.getBoundingClientRect();
        gravitySource = {
            x: rect.left + rect.width / 2,
            y: rect.top + window.scrollY + rect.height / 2,
            strength: 1 // Attraction
        };
    });

    gravityBtn.addEventListener('mouseleave', () => {
        gravitySource = null;
        // Give particles a little push to disperse
        particles.forEach(p => {
            p.vx = (Math.random() - 0.5) * 2;
            p.vy = (Math.random() - 0.5) * 2;
        });
    });
}

// Repulsion Project Cards
const projectCards = document.querySelectorAll('.project-card');
projectCards.forEach(card => {
    card.addEventListener('mouseenter', () => {
        const rect = card.getBoundingClientRect();
        gravitySource = {
            x: rect.left + rect.width / 2,
            y: rect.top + window.scrollY + rect.height / 2,
            strength: -1 // Repulsion
        };
    });

    card.addEventListener('mouseleave', () => {
        gravitySource = null;
    });
});

// Scroll Reveal
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.project-card, .section-title, .skill-pill, .use-case-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
    observer.observe(el);
});
