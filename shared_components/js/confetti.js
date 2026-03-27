/**
 * Confetti Celebration — Fires on approval/completion actions
 * Lightweight canvas-based confetti (no external library needed)
 */
(function (global) {
    'use strict';

    var colors = ['#2f661e', '#4ade80', '#fbbf24', '#f87171', '#60a5fa', '#a78bfa', '#fb923c', '#f472b6'];

    function fireConfetti() {
        var canvas = document.createElement('canvas');
        canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99999;';
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        document.body.appendChild(canvas);

        var ctx = canvas.getContext('2d');
        var particles = [];
        var count = 120;

        for (var i = 0; i < count; i++) {
            particles.push({
                x: canvas.width * 0.5 + (Math.random() - 0.5) * canvas.width * 0.4,
                y: canvas.height * 0.4,
                vx: (Math.random() - 0.5) * 15,
                vy: -Math.random() * 18 - 5,
                w: Math.random() * 8 + 4,
                h: Math.random() * 4 + 2,
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * 360,
                rotationSpeed: (Math.random() - 0.5) * 12,
                gravity: 0.35 + Math.random() * 0.15,
                opacity: 1,
                delay: Math.random() * 8
            });
        }

        var frame = 0;
        var maxFrames = 180;

        function animate() {
            frame++;
            if (frame > maxFrames) {
                canvas.remove();
                return;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            var alive = false;
            for (var i = 0; i < particles.length; i++) {
                var p = particles[i];
                if (p.delay > 0) { p.delay--; continue; }

                p.vy += p.gravity;
                p.x += p.vx;
                p.y += p.vy;
                p.vx *= 0.99;
                p.rotation += p.rotationSpeed;

                if (frame > maxFrames * 0.7) {
                    p.opacity -= 0.03;
                }

                if (p.opacity <= 0 || p.y > canvas.height + 20) continue;
                alive = true;

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation * Math.PI / 180);
                ctx.globalAlpha = Math.max(0, p.opacity);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();
            }

            if (alive) {
                requestAnimationFrame(animate);
            } else {
                canvas.remove();
            }
        }

        requestAnimationFrame(animate);
    }

    global.NWCAConfetti = { fire: fireConfetti };

})(window);
