const currentYearEl = document.getElementById('current-year');
if (currentYearEl) {
    currentYearEl.textContent = String(new Date().getFullYear());
}

const MOTION_STORAGE_KEY = 'tishan-motion-mode';
const motionToggleButton = document.getElementById('motion-toggle');
const systemReducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

function readStoredMotionMode() {
    try {
        const storedMode = window.localStorage.getItem(MOTION_STORAGE_KEY);
        if (storedMode === 'reduced' || storedMode === 'full') {
            return storedMode;
        }
    } catch (error) {
        return 'system';
    }
    return 'system';
}

function persistMotionMode(mode) {
    try {
        if (mode === 'system') {
            window.localStorage.removeItem(MOTION_STORAGE_KEY);
        } else {
            window.localStorage.setItem(MOTION_STORAGE_KEY, mode);
        }
    } catch (error) {
        // Ignore storage errors (private mode or blocked storage).
    }
}

let motionMode = readStoredMotionMode();
let motionHoverFreeze = false;

function isMotionPreferenceReduced() {
    if (motionMode === 'reduced') return true;
    if (motionMode === 'full') return false;
    return systemReducedMotionQuery.matches;
}

function isReducedMotionEnabled() {
    if (motionHoverFreeze) return true;
    return isMotionPreferenceReduced();
}

function applyMotionPreference() {
    const preferenceReducedMotion = isMotionPreferenceReduced();
    const effectiveReducedMotion = motionHoverFreeze || preferenceReducedMotion;
    document.documentElement.classList.toggle('motion-reduce', effectiveReducedMotion);
    document.documentElement.classList.toggle('motion-freeze-preview', motionHoverFreeze);
    document.documentElement.setAttribute('data-motion', preferenceReducedMotion ? 'reduced' : 'full');

    if (motionToggleButton) {
        motionToggleButton.dataset.mode = preferenceReducedMotion ? 'reduced' : 'full';
        motionToggleButton.setAttribute('aria-pressed', String(preferenceReducedMotion));
        motionToggleButton.setAttribute('aria-label', preferenceReducedMotion ? 'Switch to full motion' : 'Switch to reduced motion');
        motionToggleButton.textContent = preferenceReducedMotion ? 'Motion: Reduced' : 'Motion: Full';
    }

    window.dispatchEvent(new CustomEvent('motion-preference-change', {
        detail: {
            reducedMotion: effectiveReducedMotion,
            mode: motionMode,
            previewFrozen: motionHoverFreeze
        }
    }));
}

function setMotionMode(mode) {
    motionMode = mode;
    persistMotionMode(mode);
    applyMotionPreference();
}

function setMotionHoverFreeze(active) {
    if (motionHoverFreeze === active) return;
    motionHoverFreeze = active;
    applyMotionPreference();
}

if (motionToggleButton) {
    motionToggleButton.addEventListener('click', () => {
        setMotionMode(isMotionPreferenceReduced() ? 'full' : 'reduced');
    });

    motionToggleButton.addEventListener('mouseenter', () => {
        setMotionHoverFreeze(true);
    });

    motionToggleButton.addEventListener('mouseleave', () => {
        setMotionHoverFreeze(false);
    });
}

const systemMotionChangeHandler = () => {
    if (motionMode === 'system') {
        applyMotionPreference();
    }
};

if (typeof systemReducedMotionQuery.addEventListener === 'function') {
    systemReducedMotionQuery.addEventListener('change', systemMotionChangeHandler);
} else if (typeof systemReducedMotionQuery.addListener === 'function') {
    systemReducedMotionQuery.addListener(systemMotionChangeHandler);
}

applyMotionPreference();

const canvas = document.getElementById('particle-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;

if (canvas && ctx) {
    let width = 0;
    let height = 0;
    let particles = [];
    let gravitySource = null; // { x, y, strength }

    function getParticleCount() {
        const reducedMotion = isReducedMotionEnabled();
        const isMobileViewport = window.innerWidth <= 768;
        const isTabletViewport = window.innerWidth <= 1200;
        const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
        if (reducedMotion) return 110;
        if (isMobileViewport || isCoarsePointer) return 220;
        if (isTabletViewport) return 420;
        return 920;
    }

    function getEmitPerFrame() {
        const reducedMotion = isReducedMotionEnabled();
        const isMobileViewport = window.innerWidth <= 768;
        const isTabletViewport = window.innerWidth <= 1200;
        const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
        if (reducedMotion) return 0;
        if (isMobileViewport || isCoarsePointer) return 2;
        if (isTabletViewport) return 3;
        return 6;
    }

    function getMouseDistance() {
        return window.innerWidth <= 768 ? 72 : 100;
    }

    function getParticleFrameStride() {
        const reducedMotion = isReducedMotionEnabled();
        if (reducedMotion) return 3;
        if (window.innerWidth <= 1200) return 2;
        return 1;
    }

    let particleCount = getParticleCount();
    let emitPerFrame = getEmitPerFrame();
    let mouseDistance = getMouseDistance();
    let mouseDistanceSq = mouseDistance * mouseDistance;
    let particleFrameStride = getParticleFrameStride();
    let particleFrameCount = 0;

    const mouse = { x: null, y: null };
    const heroText = document.querySelector('.hero-name');
    let heroTextRect = null;
    let heroRectUpdateQueued = false;
    let animationFrameId = null;
    let interestsResizeHandler = null;
    let interestsVisibilityHandler = null;

    function resizeCanvas() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
    }

    function updateHeroTextRect() {
        if (!heroText) {
            heroTextRect = null;
            return;
        }

        const rect = heroText.getBoundingClientRect();
        heroTextRect = {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height
        };
    }

    function scheduleHeroTextRectUpdate() {
        if (heroRectUpdateQueued) {
            return;
        }

        heroRectUpdateQueued = true;
        requestAnimationFrame(() => {
            heroRectUpdateQueued = false;
            updateHeroTextRect();
        });
    }

    class Particle {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.vx = (Math.random() - 0.5) * 0.3;
            this.vy = (Math.random() - 0.5) * 0.3;
            this.size = Math.random() * 1.0 + 0.15;
            this.baseAlpha = Math.random() * 0.42 + 0.35;
            this.alpha = this.baseAlpha;
            this.tintStrength = 0;
            this.tintDecay = 0.92;
            this.tintR = 26;
            this.tintG = 115;
            this.tintB = 232;
        }

        update(scrollY) {
            this.vx += (Math.random() - 0.5) * 0.02;
            this.vy += (Math.random() - 0.5) * 0.02;

            if (gravitySource) {
                const gravityY = gravitySource.y - scrollY;
                const dx = gravitySource.x - this.x;
                const dy = gravityY - this.y;
                const distSq = dx * dx + dy * dy;

                if (distSq > 100) {
                    const dist = Math.sqrt(distSq);
                    const invDist = 1 / dist;
                    const strength = gravitySource.strength || 1;
                    const forceMagnitude = 0.05 * strength;

                    if (strength < 0) {
                        if (distSq < 62500) {
                            const repulsion = Math.abs(forceMagnitude) * 5;
                            this.vx -= dx * invDist * repulsion;
                            this.vy -= dy * invDist * repulsion;
                        }
                    } else {
                        this.vx += dx * invDist * forceMagnitude;
                        this.vy += dy * invDist * forceMagnitude;
                    }
                }
            }

            const maxSpeed = gravitySource ? 3 : 1.2;
            const maxSpeedSq = maxSpeed * maxSpeed;
            const speedSq = this.vx * this.vx + this.vy * this.vy;
            if (speedSq > maxSpeedSq) {
                const speed = Math.sqrt(speedSq);
                const scale = maxSpeed / speed;
                this.vx *= scale;
                this.vy *= scale;
            }

            if (gravitySource) {
                this.vx *= 0.95;
                this.vy *= 0.95;
            } else {
                this.vx *= 0.992;
                this.vy *= 0.992;
            }

            this.x += this.vx;
            this.y += this.vy;

            if (this.x < 0) this.x = width;
            if (this.x > width) this.x = 0;
            if (this.y < 0) this.y = height;
            if (this.y > height) this.y = 0;

            if (mouse.x !== null) {
                const dx = mouse.x - this.x;
                const dy = mouse.y - this.y;
                const distSq = dx * dx + dy * dy;
                if (distSq > 0 && distSq < mouseDistanceSq) {
                    const dist = Math.sqrt(distSq);
                    const invDist = 1 / dist;
                    const force = (mouseDistance - dist) / mouseDistance;
                    this.x -= dx * invDist * force * 2;
                    this.y -= dy * invDist * force * 2;
                }
            }

            if (this.tintStrength > 0) {
                this.tintStrength *= this.tintDecay;
                if (this.tintStrength < 0.03) {
                    this.tintStrength = 0;
                }
            }
        }

        draw() {
            if (this.tintStrength > 0) {
                const t = this.tintStrength;
                const r = Math.round(this.tintR * t);
                const g = Math.round(this.tintG * t);
                const b = Math.round((this.tintB * t) + (22 * (1 - t)));
                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            } else {
                ctx.fillStyle = '#000000';
            }

            ctx.globalAlpha = this.alpha;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function initParticles() {
        particles = new Array(particleCount);
        for (let i = 0; i < particleCount; i++) {
            particles[i] = new Particle();
        }
    }

    function updateParticleSettings() {
        const nextParticleCount = getParticleCount();
        emitPerFrame = getEmitPerFrame();
        mouseDistance = getMouseDistance();
        mouseDistanceSq = mouseDistance * mouseDistance;
        particleFrameStride = getParticleFrameStride();
        if (nextParticleCount !== particleCount) {
            particleCount = nextParticleCount;
            initParticles();
        }
    }

    function emitFromHeroText() {
        if (!heroTextRect) {
            return;
        }

        const isDesktopBleed = window.innerWidth > 1200 && !window.matchMedia('(pointer: coarse)').matches;
        const spawnSpread = isDesktopBleed ? 20 : 14;
        const launchSpeed = isDesktopBleed ? 3.4 : 2.8;

        for (let i = 0; i < emitPerFrame; i++) {
            const p = particles[(Math.random() * particles.length) | 0];
            p.x = heroTextRect.x + Math.random() * heroTextRect.width + (Math.random() - 0.5) * spawnSpread;
            p.y = heroTextRect.y + Math.random() * heroTextRect.height + (Math.random() - 0.5) * spawnSpread;
            p.vx = (Math.random() - 0.5) * launchSpeed;
            p.vy = (Math.random() - 0.5) * launchSpeed;
            p.alpha = 1;
        }
    }

    function emitParticleBurstAt(x, y, config) {
        if (!particles.length) return;

        const count = Math.min(particles.length, config.count);
        for (let i = 0; i < count; i++) {
            const p = particles[(Math.random() * particles.length) | 0];
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * config.spread;
            const speed = config.speedMin + Math.random() * (config.speedMax - config.speedMin);

            p.x = x + Math.cos(angle) * radius;
            p.y = y + Math.sin(angle) * radius;
            p.vx = Math.cos(angle) * speed + (Math.random() - 0.5) * 0.2;
            p.vy = Math.sin(angle) * speed + (Math.random() - 0.5) * 0.2;
            p.alpha = Math.max(p.alpha, config.alpha);

            if (config.tint) {
                p.tintR = config.tint.r;
                p.tintG = config.tint.g;
                p.tintB = config.tint.b;
                p.tintStrength = typeof config.tint.strength === 'number' ? config.tint.strength : 1;
                p.tintDecay = typeof config.tint.decay === 'number' ? config.tint.decay : 0.92;
            }
        }
    }

    function getSkillBurstConfig() {
        const reducedMotion = isReducedMotionEnabled();
        if (reducedMotion) {
            return { count: 0, spread: 0, speedMin: 0, speedMax: 0, alpha: 0 };
        }

        const isMobileViewport = window.innerWidth <= 768;
        const isTabletViewport = window.innerWidth <= 1200;
        const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

        if (isMobileViewport || isCoarsePointer) {
            return { count: 10, spread: 14, speedMin: 1.0, speedMax: 1.9, alpha: 0.85 };
        }

        if (isTabletViewport) {
            return { count: 14, spread: 18, speedMin: 1.1, speedMax: 2.1, alpha: 0.9 };
        }

        return { count: 18, spread: 22, speedMin: 1.2, speedMax: 2.4, alpha: 1 };
    }

    function animate() {
        particleFrameCount++;
        if (particleFrameStride > 1 && particleFrameCount % particleFrameStride !== 0) {
            animationFrameId = requestAnimationFrame(animate);
            return;
        }

        const scrollY = window.scrollY;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#000000';

        emitFromHeroText();
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            p.update(scrollY);
            p.draw();
        }

        ctx.globalAlpha = 1;
        animationFrameId = requestAnimationFrame(animate);
    }

    function startAnimation() {
        if (animationFrameId === null) {
            animationFrameId = requestAnimationFrame(animate);
        }
    }

    function stopAnimation() {
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }

    function setGravityFromElement(element, strength) {
        const rect = element.getBoundingClientRect();
        gravitySource = {
            x: rect.left + rect.width / 2,
            y: rect.top + window.scrollY + rect.height / 2,
            strength
        };
    }

    function setGravityFromPointer(clientX, clientY, strength) {
        gravitySource = {
            x: clientX,
            y: clientY + window.scrollY,
            strength
        };
    }

    const gravityBtn = document.getElementById('view-projects-btn');
    if (gravityBtn) {
        gravityBtn.addEventListener('mouseenter', () => {
            setGravityFromElement(gravityBtn, 1);
        });

        gravityBtn.addEventListener('mouseleave', () => {
            gravitySource = null;
            for (let i = 0; i < particles.length; i++) {
                particles[i].vx = (Math.random() - 0.5) * 2;
                particles[i].vy = (Math.random() - 0.5) * 2;
            }
        });
    }

    const projectCards = document.querySelectorAll('.project-card');
    projectCards.forEach((card) => {
        card.addEventListener('mouseenter', () => {
            setGravityFromElement(card, -1);
        });

        card.addEventListener('mouseleave', () => {
            gravitySource = null;
        });
    });

    const experienceEntries = document.querySelectorAll('.experience-entry');
    experienceEntries.forEach((entry) => {
        const experienceGravityStrength = 0.75;

        entry.addEventListener('mouseenter', () => {
            setGravityFromElement(entry, experienceGravityStrength);
        });

        entry.addEventListener('mousemove', (event) => {
            setGravityFromPointer(event.clientX, event.clientY, experienceGravityStrength);
        });

        entry.addEventListener('mouseleave', () => {
            gravitySource = null;
        });
    });

    const skillPills = document.querySelectorAll('.skill-pill');
    const skillBurstTimestamps = new WeakMap();
    const skillBurstCooldownMs = 140;

    function triggerSkillBurst(pill) {
        const config = getSkillBurstConfig();
        if (!config.count) return;

        const now = performance.now();
        const last = skillBurstTimestamps.get(pill) || 0;
        if (now - last < skillBurstCooldownMs) return;
        skillBurstTimestamps.set(pill, now);

        const rect = pill.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        emitParticleBurstAt(centerX, centerY, config);
    }

    skillPills.forEach((pill) => {
        pill.addEventListener('mouseenter', () => {
            triggerSkillBurst(pill);
        });

        pill.addEventListener('focusin', () => {
            triggerSkillBurst(pill);
        });
    });

    const socialIcons = document.querySelectorAll('.social-icon');
    const socialBurstTimestamps = new WeakMap();
    const socialBurstCooldownMs = 160;

    function triggerSocialBurst(icon) {
        const baseConfig = getSkillBurstConfig();
        if (!baseConfig.count) return;

        const now = performance.now();
        const last = socialBurstTimestamps.get(icon) || 0;
        if (now - last < socialBurstCooldownMs) return;
        socialBurstTimestamps.set(icon, now);

        const rect = icon.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const socialType = icon.dataset.social;
        const shouldUseBlueBurst = socialType === 'linkedin' || socialType === 'github';

        emitParticleBurstAt(centerX, centerY, {
            count: Math.round(baseConfig.count * 1.15),
            spread: baseConfig.spread * 1.1,
            speedMin: baseConfig.speedMin * 1.05,
            speedMax: baseConfig.speedMax * 1.12,
            alpha: baseConfig.alpha,
            tint: shouldUseBlueBurst ? { r: 26, g: 115, b: 232, strength: 1, decay: 0.91 } : null
        });
    }

    socialIcons.forEach((icon) => {
        icon.addEventListener('mouseenter', () => {
            triggerSocialBurst(icon);
        });

        icon.addEventListener('focusin', () => {
            triggerSocialBurst(icon);
        });
    });

    const revealSelector = '.project-card, .section-title, .fde-overview, .fde-column, .experience-entry, .skills-intro, .skill-lane';
    const revealElements = document.querySelectorAll(revealSelector);

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            for (let i = 0; i < entries.length; i++) {
                const entry = entries[i];
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                    observer.unobserve(entry.target);
                }
            }
        }, { threshold: 0.1 });

        revealElements.forEach((el) => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
            observer.observe(el);
        });
    } else {
        revealElements.forEach((el) => {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        });
    }

    const interestsGrid = document.querySelector('#interests .interests-grid');
    if (interestsGrid) {
        const prefersReducedMotion = () => isReducedMotionEnabled();
        const allInterestItems = Array.from(interestsGrid.querySelectorAll('.interest-item'));

        const maxSlots = Math.min(3, allInterestItems.length);
        const slotItems = allInterestItems.slice(0, maxSlots);
        const extraItems = allInterestItems.slice(maxSlots);

        const interestData = allInterestItems.map((item) => {
            const icon = item.querySelector('.interest-icon');
            const title = item.querySelector('h3');
            const desc = item.querySelector('p');
            return {
                iconClass: icon ? icon.className : 'fas fa-circle interest-icon',
                title: title ? title.textContent.trim() : '',
                description: desc ? desc.textContent.trim() : ''
            };
        });

        extraItems.forEach((item) => item.remove());

        let visibleSlots = 0;
        let displayedIndexes = [];
        let nextDataIndex = 0;
        let slotPointer = 0;
        let slotPattern = [];
        let patternIndex = 0;
        let rotationTimer = null;
        let interestsInView = true;
        const swapDurationMs = 420;
        const incomingDelayMs = 40;

        function shuffleArray(values) {
            const arr = values.slice();
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        }

        function getVisibleSlotsByViewport() {
            if (window.innerWidth <= 768) return 1;
            if (window.innerWidth <= 1024) return 2;
            return 3;
        }

        function createInterestContent(data) {
            const content = document.createElement('div');
            content.className = 'interest-content';

            const icon = document.createElement('i');
            icon.className = data.iconClass;

            const title = document.createElement('h3');
            title.textContent = data.title;

            const desc = document.createElement('p');
            desc.textContent = data.description;

            content.appendChild(icon);
            content.appendChild(title);
            content.appendChild(desc);
            return content;
        }

        function updateInterestSlotHeight() {
            if (!interestData.length || !slotItems.length) return;
            const probeHost = slotItems.find((item) => item.style.display !== 'none') || slotItems[0];
            if (!probeHost) return;

            const styles = window.getComputedStyle(probeHost);
            const padTop = parseFloat(styles.paddingTop) || 0;
            const padBottom = parseFloat(styles.paddingBottom) || 0;

            let maxContentHeight = 0;
            for (let i = 0; i < interestData.length; i++) {
                const probe = createInterestContent(interestData[i]);
                probe.classList.add('interest-content--measure');
                probeHost.appendChild(probe);
                const contentHeight = probe.getBoundingClientRect().height;
                if (contentHeight > maxContentHeight) {
                    maxContentHeight = contentHeight;
                }
                probe.remove();
            }

            const totalHeight = Math.ceil(maxContentHeight + padTop + padBottom);
            interestsGrid.style.setProperty('--interest-slot-height', `${totalHeight}px`);
        }

        function renderSlot(slotElement, dataIndex, animate) {
            const data = interestData[dataIndex];
            if (!data) return;

            const current = slotElement.querySelector('.interest-content');
            if (!animate || prefersReducedMotion() || !current) {
                slotElement.replaceChildren(createInterestContent(data));
                return;
            }

            if (slotElement.dataset.swapping === '1') {
                return;
            }

            slotElement.dataset.swapping = '1';
            const incoming = createInterestContent(data);
            incoming.classList.add('is-entering', 'is-animating');
            slotElement.appendChild(incoming);

            current.classList.add('is-animating');

            requestAnimationFrame(() => {
                current.classList.add('is-leaving');
                setTimeout(() => {
                    incoming.classList.remove('is-entering');
                }, incomingDelayMs);
            });

            setTimeout(() => {
                if (current.parentNode === slotElement) {
                    current.remove();
                }
                incoming.classList.remove('is-animating', 'is-entering');
                delete slotElement.dataset.swapping;
            }, swapDurationMs + incomingDelayMs + 40);
        }

        function reshuffleSlotPattern() {
            slotPattern = shuffleArray(Array.from({ length: visibleSlots }, (_, i) => i));
            patternIndex = 0;
        }

        function getNextSlotIndex() {
            if (!slotPattern.length || patternIndex >= slotPattern.length) {
                reshuffleSlotPattern();
            }
            return slotPattern[patternIndex++];
        }

        function resetInterestSlots() {
            visibleSlots = Math.min(getVisibleSlotsByViewport(), maxSlots);
            displayedIndexes = [];
            nextDataIndex = 0;
            slotPointer = 0;
            slotPattern = [];
            patternIndex = 0;

            for (let i = 0; i < slotItems.length; i++) {
                slotItems[i].style.display = i < visibleSlots ? '' : 'none';
                delete slotItems[i].dataset.swapping;
            }

            for (let i = 0; i < visibleSlots; i++) {
                const index = i % interestData.length;
                displayedIndexes.push(index);
                renderSlot(slotItems[i], index, false);
                nextDataIndex = (index + 1) % interestData.length;
            }

            updateInterestSlotHeight();
            reshuffleSlotPattern();
        }

        function getNextInterestIndex() {
            if (interestData.length <= visibleSlots) {
                return displayedIndexes[slotPointer % Math.max(visibleSlots, 1)] || 0;
            }

            let candidate = nextDataIndex;
            let attempts = 0;
            while (displayedIndexes.includes(candidate) && attempts < interestData.length) {
                candidate = (candidate + 1) % interestData.length;
                attempts++;
            }

            nextDataIndex = (candidate + 1) % interestData.length;
            return candidate;
        }

        function swapInterestTile() {
            if (document.hidden || !interestsInView || visibleSlots === 0 || interestData.length <= visibleSlots) {
                return;
            }

            const slotIndex = getNextSlotIndex();
            slotPointer++;
            const newDataIndex = getNextInterestIndex();
            displayedIndexes[slotIndex] = newDataIndex;
            renderSlot(slotItems[slotIndex], newDataIndex, true);
        }

        function stopInterestRotation() {
            if (rotationTimer !== null) {
                clearInterval(rotationTimer);
                rotationTimer = null;
            }
        }

        function startInterestRotation() {
            stopInterestRotation();
            if (interestData.length <= visibleSlots) return;
            if (prefersReducedMotion() || !interestsInView) return;
            rotationTimer = setInterval(swapInterestTile, 2200);
        }

        let lastViewportSlots = getVisibleSlotsByViewport();
        interestsResizeHandler = () => {
            const nextViewportSlots = getVisibleSlotsByViewport();
            if (nextViewportSlots !== lastViewportSlots) {
                lastViewportSlots = nextViewportSlots;
                resetInterestSlots();
                startInterestRotation();
            } else {
                updateInterestSlotHeight();
            }
        };

        interestsVisibilityHandler = () => {
            if (document.hidden) {
                stopInterestRotation();
            } else {
                startInterestRotation();
            }
        };

        resetInterestSlots();
        if ('IntersectionObserver' in window) {
            const interestsObserver = new IntersectionObserver((entries) => {
                interestsInView = entries.some((entry) => entry.isIntersecting);
                if (interestsInView) {
                    startInterestRotation();
                } else {
                    stopInterestRotation();
                }
            }, { threshold: 0.15 });
            interestsObserver.observe(interestsGrid);
        }
        startInterestRotation();
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopAnimation();
        } else {
            startAnimation();
        }

        if (interestsVisibilityHandler) {
            interestsVisibilityHandler();
        }
    });

    window.addEventListener('motion-preference-change', (event) => {
        updateParticleSettings();
        if (interestsVisibilityHandler) {
            interestsVisibilityHandler();
        }

        const previewFrozen = Boolean(event.detail && event.detail.previewFrozen);
        if (previewFrozen) {
            stopAnimation();
        } else if (!document.hidden) {
            startAnimation();
        }
    });

    window.addEventListener('resize', () => {
        resizeCanvas();
        updateParticleSettings();
        scheduleHeroTextRectUpdate();

        if (interestsResizeHandler) {
            interestsResizeHandler();
        }
    }, { passive: true });

    window.addEventListener('scroll', scheduleHeroTextRectUpdate, { passive: true });

    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    }, { passive: true });

    resizeCanvas();
    initParticles();
    updateHeroTextRect();
    startAnimation();
}
